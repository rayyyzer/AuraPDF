use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct ValidatedPdfFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum LaunchItem {
    Valid(ValidatedPdfFile),
    Invalid { path: String, error: String },
}

lazy_static::lazy_static! {
    static ref LAUNCH_QUEUE: Mutex<Vec<LaunchItem>> = Mutex::new(Vec::new());
}

fn lock_queue() -> MutexGuard<'static, Vec<LaunchItem>> {
    LAUNCH_QUEUE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn enqueue_launch_items(items: Vec<LaunchItem>) {
    if items.is_empty() {
        return;
    }
    let mut queue = lock_queue();
    for item in items {
        // Avoid queuing exact duplicate valid paths back-to-back in the same drain cycle
        let is_dup = match &item {
            LaunchItem::Valid(v) => queue.iter().any(|existing| match existing {
                LaunchItem::Valid(ev) => ev.path.eq_ignore_ascii_case(&v.path),
                _ => false,
            }),
            _ => false,
        };
        if !is_dup {
            queue.push(item);
        }
    }
}

pub fn drain_launch_items() -> Vec<LaunchItem> {
    let mut queue = lock_queue();
    std::mem::take(&mut *queue)
}

/// Strip Windows extended-length path prefix (`\\?\` or `\\?\UNC\`) produced by `std::fs::canonicalize`
/// so paths remain standard, human-readable Windows paths (`C:\...` or `\\server\share\...`).
pub fn normalize_windows_path_string(path: &Path) -> String {
    let raw = path.to_string_lossy().to_string();
    if let Some(stripped_unc) = raw.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", stripped_unc)
    } else if let Some(stripped) = raw.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        raw
    }
}

/// Decode percent-encoded characters in a `file://` URI path (including UTF-8 sequences and spaces).
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Clean raw CLI argument: trim surrounding quotes and convert `file://` URLs if present.
pub fn clean_cli_path_arg(raw: &str) -> Option<String> {
    let trimmed = raw.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return None;
    }
    // Ignore CLI flags (e.g. `-psn_...`, `--flag`, `/embedding`)
    if trimmed.starts_with('-') {
        return None;
    }
    #[cfg(windows)]
    if trimmed.starts_with('/') && !trimmed.contains('\\') && !trimmed.to_ascii_lowercase().ends_with(".pdf") {
        return None;
    }

    if let Some(rest) = trimmed.strip_prefix("file:///") {
        let decoded = percent_decode(rest);
        #[cfg(windows)]
        {
            return Some(decoded.replace('/', "\\"));
        }
        #[cfg(not(windows))]
        {
            return Some(format!("/{}", decoded));
        }
    } else if let Some(rest) = trimmed.strip_prefix("file://") {
        let decoded = percent_decode(rest);
        return Some(decoded.replace('/', std::path::MAIN_SEPARATOR_STR));
    }

    Some(trimmed.to_string())
}

/// Check if a file begins with the `%PDF-` magic header within the first 1024 bytes (ISO 32000-1).
pub fn has_pdf_magic_header(path: &Path) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut buf = [0u8; 1024];
    let n = file
        .read(&mut buf)
        .map_err(|e| format!("Cannot read file header: {}", e))?;
    if n < 5 {
        return Ok(false);
    }
    Ok(buf[..n].windows(5).any(|w| w == b"%PDF-"))
}

/// Validate that `raw_path` exists, is a regular file, and is a valid PDF document.
/// Returns a canonicalized, normalized `ValidatedPdfFile`.
pub fn validate_and_normalize_pdf_path(
    raw_path: &str,
    cwd: Option<&Path>,
) -> Result<ValidatedPdfFile, String> {
    let cleaned = clean_cli_path_arg(raw_path)
        .ok_or_else(|| "Empty or invalid path argument".to_string())?;

    let candidate = PathBuf::from(&cleaned);
    let resolved = if candidate.is_absolute() {
        candidate
    } else if let Some(base) = cwd {
        base.join(candidate)
    } else if let Ok(current) = std::env::current_dir() {
        current.join(candidate)
    } else {
        candidate
    };

    if !resolved.exists() {
        return Err(format!("File does not exist: {}", resolved.display()));
    }

    let metadata = std::fs::metadata(&resolved)
        .map_err(|e| format!("Cannot read file metadata '{}': {}", resolved.display(), e))?;

    if !metadata.is_file() {
        return Err(format!("Path is not a file: {}", resolved.display()));
    }

    if metadata.len() < 5 {
        return Err(format!("File is empty or too small to be a valid PDF: {}", resolved.display()));
    }

    let has_header = has_pdf_magic_header(&resolved)?;
    if !has_header {
        return Err(format!(
            "File is not a valid PDF document (missing %PDF- header): {}",
            resolved.display()
        ));
    }

    let canonical = std::fs::canonicalize(&resolved).unwrap_or(resolved);
    let normalized_path = normalize_windows_path_string(&canonical);
    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Document.pdf".to_string());

    Ok(ValidatedPdfFile {
        path: normalized_path,
        name,
        size: metadata.len(),
        modified_at: metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis().min(u64::MAX as u128) as u64),
    })
}

/// Parse command-line arguments (skipping argv[0]) and extract all requested PDF files or file errors.
pub fn extract_launch_items_from_args<I, S>(args: I, cwd: Option<&Path>) -> Vec<LaunchItem>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut items = Vec::new();
    for (idx, raw_arg) in args.into_iter().enumerate() {
        if idx == 0 {
            continue; // Skip executable path (argv[0])
        }
        let s = raw_arg.as_ref();
        let Some(cleaned) = clean_cli_path_arg(s) else {
            continue;
        };

        // Ignore dev-server URLs if passed by Tauri dev runner
        if cleaned.starts_with("http://") || cleaned.starts_with("https://") {
            continue;
        }

        match validate_and_normalize_pdf_path(&cleaned, cwd) {
            Ok(valid) => items.push(LaunchItem::Valid(valid)),
            Err(error) => {
                items.push(LaunchItem::Invalid {
                    path: cleaned,
                    error,
                });
            }
        }
    }
    items
}

#[tauri::command]
pub fn pdf_take_launch_queue() -> Vec<LaunchItem> {
    drain_launch_items()
}

#[tauri::command]
pub async fn pdf_inspect_path(path: String) -> Result<ValidatedPdfFile, String> {
    tauri::async_runtime::spawn_blocking(move || validate_and_normalize_pdf_path(&path, None))
        .await
        .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn create_temp_pdf(dir: &Path, filename: &str) -> PathBuf {
        let file_path = dir.join(filename);
        let mut f = File::create(&file_path).expect("create temp pdf");
        f.write_all(b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF")
            .expect("write pdf bytes");
        file_path
    }

    #[test]
    fn test_paths_with_spaces_and_quotes() {
        let temp_dir = std::env::temp_dir().join("aurapdf_test_spaces");
        let _ = std::fs::create_dir_all(&temp_dir);
        let pdf_path = create_temp_pdf(&temp_dir, "My Financial Report (2026) - Final.pdf");

        let quoted = format!("\"{}\"", pdf_path.display());
        let res = validate_and_normalize_pdf_path(&quoted, None).expect("should validate path with spaces");
        assert_eq!(res.name, "My Financial Report (2026) - Final.pdf");
        assert!(!res.path.starts_with(r"\\?\"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unicode_filenames_and_paths() {
        let temp_dir = std::env::temp_dir().join("aurapdf_test_日本語_🚀");
        let _ = std::fs::create_dir_all(&temp_dir);
        let pdf_path = create_temp_pdf(&temp_dir, "契約書_Résumé_Αθήνα.pdf");

        let items = extract_launch_items_from_args(
            vec!["AuraPDF.exe".to_string(), pdf_path.to_string_lossy().to_string()],
            None,
        );
        assert_eq!(items.len(), 1);
        match &items[0] {
            LaunchItem::Valid(v) => {
                assert_eq!(v.name, "契約書_Résumé_Αθήνα.pdf");
                assert!(v.size > 0);
            }
            other => panic!("Expected Valid, got {:?}", other),
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_invalid_and_missing_files() {
        let temp_dir = std::env::temp_dir().join("aurapdf_test_invalid");
        let _ = std::fs::create_dir_all(&temp_dir);

        let fake_pdf = temp_dir.join("not_a_real_pdf.pdf");
        std::fs::write(&fake_pdf, b"Hello world, this is plain text").unwrap();

        let missing_pdf = temp_dir.join("does_not_exist.pdf");

        let items = extract_launch_items_from_args(
            vec![
                "AuraPDF.exe".to_string(),
                "--some-flag".to_string(),
                fake_pdf.to_string_lossy().to_string(),
                missing_pdf.to_string_lossy().to_string(),
            ],
            None,
        );

        assert_eq!(items.len(), 2);
        assert!(matches!(items[0], LaunchItem::Invalid { .. }));
        assert!(matches!(items[1], LaunchItem::Invalid { .. }));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
