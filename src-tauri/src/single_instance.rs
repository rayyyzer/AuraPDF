use crate::launch::{enqueue_launch_items, extract_launch_items_from_args};
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};


/// Per-process authentication token for the loopback handoff socket.
///
/// This used to be a hardcoded constant baked into the binary, so any local process could
/// read the endpoint file and drive the app: write a hand-made
/// `{"token":"aurapdf-single-instance-v1","args":[...]}` line and the running instance would
/// open whatever file it named. The token is now generated per process from OS randomness,
/// so possessing the endpoint file is required to talk to it.
fn ipc_token() -> &'static str {
    static TOKEN: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    TOKEN.get_or_init(|| {
        use std::collections::hash_map::RandomState;
        use std::hash::{BuildHasher, Hasher};

        let mut token = String::with_capacity(64);
        for round in 0..4u64 {
            // `RandomState` is seeded from OS randomness, and mixing in the pid and the
            // clock makes collisions between separate starts impossible in practice.
            let mut hasher = RandomState::new().build_hasher();
            hasher.write_u64(std::process::id() as u64);
            hasher.write_u64(round);
            hasher.write_u128(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|elapsed| elapsed.as_nanos())
                    .unwrap_or(0),
            );
            token.push_str(&format!("{:016x}", hasher.finish()));
        }
        token
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct EndpointInfo {
    addr: String,
    pid: u32,
    token: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct ForwardedInvocation {
    token: String,
    args: Vec<String>,
    cwd: Option<String>,
}

fn endpoint_file_path() -> PathBuf {
    std::env::temp_dir().join("com.aurapdf.app.single_instance.json")
}

/// Attempt to forward the current process's CLI arguments to an already-running primary instance.
/// Returns `true` if an existing instance accepted the invocation (meaning this process should exit).
pub fn try_forward_to_running_instance(args: &[String], cwd: Option<&Path>) -> bool {
    try_forward_to_endpoint(&endpoint_file_path(), args, cwd)
}

pub fn try_forward_to_endpoint(
    endpoint_file: &Path,
    args: &[String],
    cwd: Option<&Path>,
) -> bool {
    let Ok(raw) = std::fs::read_to_string(endpoint_file) else {
        return false;
    };
    let Ok(info) = serde_json::from_str::<EndpointInfo>(&raw) else {
        return false;
    };
    if info.token != ipc_token() {
        return false;
    }
    let Ok(sock_addr) = info.addr.parse::<SocketAddr>() else {
        return false;
    };

    let Ok(mut stream) = TcpStream::connect_timeout(&sock_addr, Duration::from_millis(350)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1200)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1200)));

    let payload = ForwardedInvocation {
        token: ipc_token().to_string(),
        args: args.to_vec(),
        cwd: cwd.map(|p| p.to_string_lossy().to_string()),
    };

    let Ok(mut encoded) = serde_json::to_vec(&payload) else {
        return false;
    };
    encoded.push(b'\n');

    if stream.write_all(&encoded).is_err() || stream.flush().is_err() {
        return false;
    }

    let mut reader = BufReader::new(stream);
    let mut ack = String::new();
    if reader.read_line(&mut ack).is_ok() && ack.trim() == "ACK" {
        return true;
    }

    false
}

/// Start the primary instance IPC listener and register the endpoint file.
pub fn start_primary_instance_listener(app_handle: AppHandle) {
    let endpoint_file = endpoint_file_path();
    let Ok(listener) = TcpListener::bind("127.0.0.1:0") else {
        log::warn!("[SINGLE_INSTANCE] Failed to bind local loopback listener");
        return;
    };
    let Ok(local_addr) = listener.local_addr() else {
        return;
    };

    let info = EndpointInfo {
        addr: local_addr.to_string(),
        pid: std::process::id(),
        token: ipc_token().to_string(),
    };

    if let Ok(serialized) = serde_json::to_string(&info) {
        let _ = std::fs::write(&endpoint_file, serialized);
    }

    std::thread::Builder::new()
        .name("aurapdf-single-instance".to_string())
        .spawn(move || {
            for stream in listener.incoming().flatten() {
                handle_incoming_invocation(stream, &app_handle);
            }
        })
        .ok();
}

fn handle_incoming_invocation(mut stream: TcpStream, app_handle: &AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1500)));

    let mut line = String::new();
    {
        let mut reader = BufReader::new(&mut stream);
        if reader.read_line(&mut line).is_err() {
            return;
        }
    }

    let Ok(invocation) = serde_json::from_str::<ForwardedInvocation>(line.trim()) else {
        return;
    };
    if invocation.token != ipc_token() {
        return;
    }

    let cwd_path = invocation.cwd.as_deref().map(PathBuf::from);
    let items = extract_launch_items_from_args(&invocation.args, cwd_path.as_deref());
    let has_items = !items.is_empty();
    enqueue_launch_items(items);

    let _ = stream.write_all(b"ACK\n");
    let _ = stream.flush();

    // Bring primary window to foreground
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    if has_items {
        let _ = app_handle.emit("aurapdf://open-files", ());
    }
}

pub fn cleanup_endpoint_file() {
    let path = endpoint_file_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(info) = serde_json::from_str::<EndpointInfo>(&raw) {
            if info.pid == std::process::id() {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::launch::{drain_launch_items, LaunchItem};
    use std::fs::File;

    #[test]
    fn test_single_instance_ipc_forwarding() {
        let _ = drain_launch_items();
        let temp_dir = std::env::temp_dir().join("aurapdf_test_ipc");
        let _ = std::fs::create_dir_all(&temp_dir);
        let endpoint_path = temp_dir.join("instance.json");
        let pdf_path = temp_dir.join("forwarded sample.pdf");
        {
            let mut f = File::create(&pdf_path).unwrap();
            f.write_all(b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF").unwrap();
        }

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let info = EndpointInfo {
            addr: addr.to_string(),
            pid: std::process::id(),
            token: ipc_token().to_string(),
        };
        std::fs::write(&endpoint_path, serde_json::to_string(&info).unwrap()).unwrap();

        let server_thread = std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut line = String::new();
                {
                    let mut reader = BufReader::new(&mut stream);
                    reader.read_line(&mut line).unwrap();
                }
                let inv: ForwardedInvocation = serde_json::from_str(line.trim()).unwrap();
                let items = extract_launch_items_from_args(&inv.args, None);
                enqueue_launch_items(items);
                stream.write_all(b"ACK\n").unwrap();
            }
        });

        let args = vec![
            "AuraPDF.exe".to_string(),
            pdf_path.to_string_lossy().to_string(),
        ];
        let forwarded = try_forward_to_endpoint(&endpoint_path, &args, None);
        assert!(forwarded, "Secondary instance should forward to primary instance");

        server_thread.join().unwrap();
        let drained = drain_launch_items();
        assert_eq!(drained.len(), 1);
        match &drained[0] {
            LaunchItem::Valid(v) => assert_eq!(v.name, "forwarded sample.pdf"),
            other => panic!("Unexpected item: {:?}", other),
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
