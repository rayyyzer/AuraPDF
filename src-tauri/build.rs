fn main() {
    // tauri-build does not emit rerun-if-changed for icon files, so updating
    // icons/icon.ico would otherwise leave a stale Windows resource.lib (exe icon).
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.png");
    tauri_build::build()
}
