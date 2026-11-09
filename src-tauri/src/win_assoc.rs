#[cfg(windows)]
mod imp {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use std::process::Command;

    const HKEY_CURRENT_USER: isize = -2147483647i32 as isize; // 0x80000001
    const KEY_READ: u32 = 0x20019;
    const KEY_WRITE: u32 = 0x20006;
    const REG_SZ: u32 = 1;
    const SHCNE_ASSOCCHANGED: i32 = 0x08000000;
    const SHCNF_IDLIST: u32 = 0x0000;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegCreateKeyExW(
            hkey: isize,
            lpsubkey: *const u16,
            reserved: u32,
            lpclass: *const u16,
            dwoptions: u32,
            samdesired: u32,
            lpsecurityattributes: *const core::ffi::c_void,
            phkresult: *mut isize,
            lpdwdisposition: *mut u32,
        ) -> i32;

        fn RegSetValueExW(
            hkey: isize,
            lpvaluename: *const u16,
            reserved: u32,
            dwtype: u32,
            lpdata: *const u8,
            cbdata: u32,
        ) -> i32;

        fn RegQueryValueExW(
            hkey: isize,
            lpvaluename: *const u16,
            lpreserved: *const u32,
            lptype: *mut u32,
            lpdata: *mut u8,
            lpcbdata: *mut u32,
        ) -> i32;

        fn RegCloseKey(hkey: isize) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(
            wEventId: i32,
            uFlags: u32,
            dwItem1: *const core::ffi::c_void,
            dwItem2: *const core::ffi::c_void,
        );
        fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
    }

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    fn set_hkcu_string(subkey: &str, value_name: Option<&str>, data: &str) -> Result<(), String> {
        unsafe {
            let subkey_w = to_wide(subkey);
            let mut hkey: isize = 0;
            let status = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                subkey_w.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_WRITE,
                std::ptr::null(),
                &mut hkey,
                std::ptr::null_mut(),
            );
            if status != 0 {
                return Err(format!("RegCreateKeyExW failed for '{}' with code {}", subkey, status));
            }

            let val_w = value_name.map(to_wide);
            let val_ptr = val_w.as_ref().map(|v| v.as_ptr()).unwrap_or(std::ptr::null());
            let data_w = to_wide(data);
            let byte_len = (data_w.len() * 2) as u32;

            let set_status = RegSetValueExW(
                hkey,
                val_ptr,
                0,
                REG_SZ,
                data_w.as_ptr() as *const u8,
                byte_len,
            );
            RegCloseKey(hkey);

            if set_status != 0 {
                return Err(format!(
                    "RegSetValueExW failed for '{}' with code {}",
                    subkey, set_status
                ));
            }
            Ok(())
        }
    }

    fn has_non_empty_default_value(subkey: &str) -> bool {
        unsafe {
            let subkey_w = to_wide(subkey);
            let mut hkey: isize = 0;
            let status = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                subkey_w.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_READ,
                std::ptr::null(),
                &mut hkey,
                std::ptr::null_mut(),
            );
            if status != 0 {
                return false;
            }
            let mut size: u32 = 0;
            let q_status = RegQueryValueExW(
                hkey,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            );
            RegCloseKey(hkey);
            q_status == 0 && size > 2
        }
    }

    /// Register AuraPDF in HKCU for Windows "Open With" and "Default Apps" WITHOUT overriding
    /// the user's existing default PDF viewer (`UserChoice` or existing `.pdf` default class).
    pub fn register_pdf_file_association_for_exe(exe_path: &Path) -> Result<(), String> {
        let exe_str = crate::launch::normalize_windows_path_string(exe_path);
        let open_cmd = format!("\"{}\" \"%1\"", exe_str);
        let icon_str = format!("\"{}\",0", exe_str);

        // 1. Register ProgID `AuraPDF.pdf`
        set_hkcu_string(r"Software\Classes\AuraPDF.pdf", None, "PDF Document")?;
        set_hkcu_string(
            r"Software\Classes\AuraPDF.pdf",
            Some("FriendlyTypeName"),
            "PDF Document",
        )?;
        set_hkcu_string(
            r"Software\Classes\AuraPDF.pdf\DefaultIcon",
            None,
            &icon_str,
        )?;
        set_hkcu_string(
            r"Software\Classes\AuraPDF.pdf\shell\open",
            None,
            "Open with AuraPDF",
        )?;
        set_hkcu_string(
            r"Software\Classes\AuraPDF.pdf\shell\open",
            Some("FriendlyAppName"),
            "AuraPDF",
        )?;
        set_hkcu_string(
            r"Software\Classes\AuraPDF.pdf\shell\open\command",
            None,
            &open_cmd,
        )?;

        // 2. Register under `.pdf\OpenWithProgids` (adds AuraPDF to Windows "Open with" menu without overriding default)
        set_hkcu_string(
            r"Software\Classes\.pdf\OpenWithProgids",
            Some("AuraPDF.pdf"),
            "",
        )?;
        // Only set `.pdf` fallback default if the user has NO existing class registered in HKCU\.pdf
        if !has_non_empty_default_value(r"Software\Classes\.pdf") {
            let _ = set_hkcu_string(r"Software\Classes\.pdf", None, "AuraPDF.pdf");
        }
        let _ = set_hkcu_string(
            r"Software\Classes\.pdf",
            Some("Content Type"),
            "application/pdf",
        );

        // 3. Register under `Software\Classes\Applications\AuraPDF.exe` (and current exe filename)
        let exe_filename = exe_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "AuraPDF.exe".to_string());

        for app_exe_name in ["AuraPDF.exe", exe_filename.as_str()] {
            let base_key = format!(r"Software\Classes\Applications\{}", app_exe_name);
            set_hkcu_string(&base_key, Some("FriendlyAppName"), "AuraPDF")?;
            set_hkcu_string(&format!(r"{}\DefaultIcon", base_key), None, &icon_str)?;
            set_hkcu_string(&format!(r"{}\SupportedTypes", base_key), Some(".pdf"), "")?;
            set_hkcu_string(
                &format!(r"{}\shell\open\command", base_key),
                None,
                &open_cmd,
            )?;
        }

        // 4. Register Capabilities & RegisteredApplications (makes AuraPDF selectable in Windows Settings -> Default Apps)
        set_hkcu_string(
            r"Software\aurapdf\AuraPDF\Capabilities",
            Some("ApplicationName"),
            "AuraPDF",
        )?;
        set_hkcu_string(
            r"Software\aurapdf\AuraPDF\Capabilities",
            Some("ApplicationDescription"),
            "AuraPDF — Fast, Native Windows PDF Reader",
        )?;
        set_hkcu_string(
            r"Software\aurapdf\AuraPDF\Capabilities\FileAssociations",
            Some(".pdf"),
            "AuraPDF.pdf",
        )?;
        set_hkcu_string(
            r"Software\RegisteredApplications",
            Some("AuraPDF"),
            r"Software\aurapdf\AuraPDF\Capabilities",
        )?;

        unsafe {
            SHChangeNotify(
                SHCNE_ASSOCCHANGED,
                SHCNF_IDLIST,
                std::ptr::null(),
                std::ptr::null(),
            );
        }

        Ok(())
    }

    pub fn ensure_current_exe_registered() -> Result<(), String> {
        let aumid = to_wide("com.aurapdf.app");
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(aumid.as_ptr());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        register_pdf_file_association_for_exe(&exe)
    }

    pub fn open_default_apps_settings() -> Result<(), String> {
        use std::os::windows::process::CommandExt;
        Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Failed to open Windows Default Apps settings: {}", e))?;
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use std::path::Path;
    pub fn register_pdf_file_association_for_exe(_exe_path: &Path) -> Result<(), String> {
        Ok(())
    }
    pub fn ensure_current_exe_registered() -> Result<(), String> {
        Ok(())
    }
    pub fn open_default_apps_settings() -> Result<(), String> {
        Ok(())
    }
}

pub use imp::*;

#[tauri::command]
pub fn pdf_register_file_association() -> Result<(), String> {
    ensure_current_exe_registered()
}

#[tauri::command]
pub fn pdf_open_default_apps_settings() -> Result<(), String> {
    open_default_apps_settings()
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    #[ignore = "writes to the current user's Windows registry"]
    fn test_windows_registry_file_association_registration() {
        let exe_path = PathBuf::from(r"C:\Program Files\AuraPDF\AuraPDF.exe");
        register_pdf_file_association_for_exe(&exe_path)
            .expect("should register HKCU PDF association cleanly");
    }
}
