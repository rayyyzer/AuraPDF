use pdfium_render::prelude::*;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, MutexGuard, OnceLock};
use tauri::{AppHandle, Manager};

/// Bumped whenever the OCR pipeline changes in a way that invalidates cached page
/// text. The frontend stamps cached segment ids with this value and refuses to trust
/// caches written by an older pipeline, so stale or garbage caches self-heal instead
/// of being patched over with sentinel heuristics.
pub const PIPELINE_VERSION: &str = "v7";

pub const QUALITY_OK: &str = "ok";
pub const QUALITY_UNCERTAIN: &str = "uncertain";
pub const QUALITY_UNREADABLE: &str = "unreadable";

/// Tesseract confidence below this is treated as unreadable rather than guessed at.
const CONFIDENCE_UNREADABLE: f32 = 40.0;
/// Tesseract confidence below this needs corroboration to count as readable.
const CONFIDENCE_UNCERTAIN: f32 = 60.0;
/// Normalized text similarity at which two engines are considered to agree.
const AGREEMENT_THRESHOLD: f32 = 0.75;

lazy_static::lazy_static! {
    static ref OCR_MUTEX: Mutex<()> = Mutex::new(());
    static ref OCR_ENGINE_WARNING: Mutex<bool> = Mutex::new(false);
}

pub fn lock_ocr() -> MutexGuard<'static, ()> {
    OCR_MUTEX.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct OcrSegment {
    pub id: String,
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub source: String,
    /// Which engine produced this segment: "tesseract" or "winocr".
    pub engine: String,
    /// Real per-word score in 0..=100, or `None` when the engine does not expose one.
    /// Never synthesized: a fabricated score is worse than no score.
    pub confidence: Option<f32>,
    /// "ok" | "uncertain" | "unreadable". Assigned after cross-engine merging.
    pub quality: String,
    pub line: u32,
    pub word: u32,
}

#[derive(Clone, Debug)]
struct TesseractEngine {
    exe: PathBuf,
    tessdata: Option<PathBuf>,
    version: String,
}

#[derive(Clone, Debug, Default)]
struct EngineProbe {
    tesseract: Option<TesseractEngine>,
    tesseract_error: Option<String>,
}

static ENGINE_PROBE: OnceLock<EngineProbe> = OnceLock::new();

/// Engine location is resolved exactly once per process. Re-probing the filesystem on
/// every OCR pass made every page pay a handful of `stat` calls and, worse, hid the
/// reason Tesseract was unavailable because each call site swallowed its own error.
fn engine_probe(app: &AppHandle) -> &'static EngineProbe {
    ENGINE_PROBE.get_or_init(|| probe_engines(app))
}

fn probe_engines(app: &AppHandle) -> EngineProbe {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let current_exe_bin = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join("bin")));

    let candidate_dirs = [
        resource_dir.join("bin"),
        current_exe_bin.unwrap_or_default(),
        PathBuf::from("src-tauri/bin"),
        PathBuf::from("bin"),
        PathBuf::from(r"C:\Program Files\Tesseract-OCR"),
        PathBuf::from(r"C:\Program Files (x86)\Tesseract-OCR"),
    ];

    let exe_name = if cfg!(windows) {
        "tesseract.exe"
    } else {
        "tesseract"
    };

    let mut last_error = String::from("Tesseract executable not found in any known location");

    for dir in candidate_dirs
        .iter()
        .filter(|dir| !dir.as_os_str().is_empty())
    {
        let candidate_exe = dir.join(exe_name);
        if !candidate_exe.exists() {
            continue;
        }
        let exe = PathBuf::from(crate::launch::normalize_windows_path_string(&candidate_exe));
        let candidate_tessdata = dir.join("tessdata");
        let tessdata = candidate_tessdata.exists().then(|| {
            PathBuf::from(crate::launch::normalize_windows_path_string(&candidate_tessdata))
        });

        // `exists()` only proves the file is there. Running the binary is what proves the
        // whole runtime is present, which catches a half-copied directory or a missing DLL.
        match read_tesseract_version(&exe) {
            Ok(version) => {
                return EngineProbe {
                    tesseract: Some(TesseractEngine {
                        exe,
                        tessdata,
                        version,
                    }),
                    tesseract_error: None,
                };
            }
            Err(error) => {
                last_error = format!("{}: {error}", exe.display());
            }
        }
    }

    EngineProbe {
        tesseract: None,
        tesseract_error: Some(last_error),
    }
}

fn read_tesseract_version(exe: &Path) -> Result<String, String> {
    let mut command = Command::new(exe);
    command
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let output = command
        .output()
        .map_err(|error| format!("could not be launched: {error}"))?;
    if !output.status.success() {
        return Err(format!("exited with {:?}", output.status.code()));
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "produced no version output".to_string())
}

/// Logs the OCR engine situation once per session instead of silently degrading.
fn warn_if_tesseract_missing(probe: &EngineProbe) {
    if probe.tesseract.is_some() {
        return;
    }
    let mut warned = OCR_ENGINE_WARNING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if *warned {
        return;
    }
    *warned = true;
    log::warn!(
        "[OCR] Tesseract unavailable ({}); falling back to Windows OCR only. \
         Sparse text, scanned diagrams and multi-column pages will be recognised less reliably.",
        probe
            .tesseract_error
            .as_deref()
            .unwrap_or("unknown reason")
    );
}

/// Performs adaptive integral-image illumination normalization, removes long thin horizontal/vertical
/// diagram box borders and underlines while preserving character junctions, filters out reverse-page
/// bleed-through speckles and hollow frames via connected-component analysis, and returns:
/// 1) `clean_bgra`: illumination-normalized grayscale BGRA
/// 2) `deboxed_bgra`: connected-component character-only BGRA with box borders & underlines removed
fn preprocess_and_debox_for_ocr(
    width: u32,
    height: u32,
    bgra: &[u8],
) -> (Vec<u8>, Vec<u8>) {
    let w = width as usize;
    let h = height as usize;
    if w < 32 || h < 32 || bgra.len() < w * h * 4 {
        return (bgra.to_vec(), bgra.to_vec());
    }

    let mut gray = vec![0u8; w * h];
    for i in 0..(w * h) {
        let idx = i * 4;
        let b = bgra[idx] as u32;
        let g = bgra[idx + 1] as u32;
        let r = bgra[idx + 2] as u32;
        gray[i] = ((r * 77 + g * 150 + b * 29) >> 8) as u8;
    }

    let stride = w + 1;
    let mut integral = vec![0u64; stride * (h + 1)];
    for y in 1..=h {
        let mut row_sum = 0u64;
        for x in 1..=w {
            row_sum += gray[(y - 1) * w + (x - 1)] as u64;
            integral[y * stride + x] = integral[(y - 1) * stride + x] + row_sum;
        }
    }

    let radius = (w.min(h) / 28).clamp(32, 56);
    let mut clean_bgra = vec![255u8; w * h * 4];
    let mut fg = vec![0u8; w * h];
    let mut norm_gray = vec![255u8; w * h];

    for y in 0..h {
        let y0 = y.saturating_sub(radius);
        let y1 = (y + radius + 1).min(h);
        for x in 0..w {
            let x0 = x.saturating_sub(radius);
            let x1 = (x + radius + 1).min(w);
            let count = ((x1 - x0) * (y1 - y0)) as u64;
            let sum = integral[y1 * stride + x1]
                + integral[y0 * stride + x0]
                - integral[y0 * stride + x1]
                - integral[y1 * stride + x0];
            let local_mean = ((sum / count.max(1)) as f32).max(60.0);
            let val = gray[y * w + x] as f32;
            let ratio = val / local_mean;

            // Clean illumination-normalized pixel for standard OCR pass
            let clean_val = if ratio >= 0.88 {
                255u8
            } else {
                (((ratio - 0.52) / (0.88 - 0.52)) * 255.0)
                    .round()
                    .clamp(0.0, 255.0) as u8
            };
            let idx4 = (y * w + x) * 4;
            clean_bgra[idx4] = clean_val;
            clean_bgra[idx4 + 1] = clean_val;
            clean_bgra[idx4 + 2] = clean_val;
            clean_bgra[idx4 + 3] = 255;

            // Foreground ink mask (suppressing faint bleed-through while working on both bright & dark camera scans)
            if ratio < 0.84 && val < 192.0 {
                fg[y * w + x] = 1;
                norm_gray[y * w + x] = (((ratio - 0.56) / 0.28) * 165.0)
                    .round()
                    .clamp(0.0, 240.0) as u8;
            }
        }
    }

    // Step 1: Peel long thin horizontal underlines & vertical diagram box borders without cutting thick letter junctions
    let max_thin = ((w.min(h)) / 145).clamp(6, 10);
    let mut thin_h = vec![0u8; w * h];
    let mut thin_v = vec![0u8; w * h];

    for y in 6..(h.saturating_sub(6)) {
        for x in 6..(w.saturating_sub(6)) {
            if fg[y * w + x] == 0 {
                continue;
            }
            let mut vt = 1usize;
            for d in 1..=(max_thin + 2) {
                if y >= d && fg[(y - d) * w + x] == 1 {
                    vt += 1;
                } else {
                    break;
                }
            }
            for d in 1..=(max_thin + 2) {
                if y + d < h && fg[(y + d) * w + x] == 1 {
                    vt += 1;
                } else {
                    break;
                }
            }
            if vt <= max_thin {
                thin_h[y * w + x] = 1;
            }

            let mut ht = 1usize;
            for d in 1..=(max_thin + 2) {
                if x >= d && fg[y * w + (x - d)] == 1 {
                    ht += 1;
                } else {
                    break;
                }
            }
            for d in 1..=(max_thin + 2) {
                if x + d < w && fg[y * w + (x + d)] == 1 {
                    ht += 1;
                } else {
                    break;
                }
            }
            if ht <= max_thin {
                thin_v[y * w + x] = 1;
            }
        }
    }

    let mut remove_line = vec![false; w * h];
    let min_h_len = (w / 20).max(56);
    let min_v_len = (h / 34).max(44);

    for y in 3..(h.saturating_sub(3)) {
        let mut run_start: Option<usize> = None;
        let mut gap = 0usize;
        for x in 0..w {
            let has_h = thin_h[(y - 1) * w + x] == 1
                || thin_h[y * w + x] == 1
                || thin_h[(y + 1) * w + x] == 1;
            if has_h {
                if run_start.is_none() {
                    run_start = Some(x);
                }
                gap = 0;
            } else if let Some(start_x) = run_start {
                gap += 1;
                if gap > 3 {
                    let end_x = x.saturating_sub(gap);
                    if end_x > start_x && (end_x - start_x) >= min_h_len {
                        for rx in start_x..=end_x {
                            for dy in -1i32..=1i32 {
                                let ny = (y as i32 + dy) as usize;
                                if thin_h[ny * w + rx] == 1 {
                                    remove_line[ny * w + rx] = true;
                                }
                            }
                        }
                    }
                    run_start = None;
                    gap = 0;
                }
            }
        }
    }

    for x in 3..(w.saturating_sub(3)) {
        let mut run_start: Option<usize> = None;
        let mut gap = 0usize;
        for y in 0..h {
            let has_v = thin_v[y * w + (x - 1)] == 1
                || thin_v[y * w + x] == 1
                || thin_v[y * w + (x + 1)] == 1;
            if has_v {
                if run_start.is_none() {
                    run_start = Some(y);
                }
                gap = 0;
            } else if let Some(start_y) = run_start {
                gap += 1;
                if gap > 3 {
                    let end_y = y.saturating_sub(gap);
                    if end_y > start_y && (end_y - start_y) >= min_v_len {
                        for ry in start_y..=end_y {
                            for dx in -1i32..=1i32 {
                                let nx = (x as i32 + dx) as usize;
                                if thin_v[ry * w + nx] == 1 {
                                    remove_line[ry * w + nx] = true;
                                }
                            }
                        }
                    }
                    run_start = None;
                    gap = 0;
                }
            }
        }
    }

    for i in 0..(w * h) {
        if remove_line[i] {
            fg[i] = 0;
        }
    }

    // Step 2: Connected-Component filtering & word-box clustering
    let mut visited = vec![0u8; w * h];
    let mut keep_mask = vec![0u8; w * h];
    let mut comp_boxes: Vec<(usize, usize, usize, usize, usize)> = Vec::new();
    let mut queue: Vec<usize> = Vec::with_capacity(4096);

    let max_char_h = (h / 12).clamp(90, 160);
    let max_word_w = (w / 2).max(380);

    for y in 10..(h.saturating_sub(10)) {
        for x in 10..(w.saturating_sub(10)) {
            let idx = y * w + x;
            if fg[idx] == 1 && visited[idx] == 0 {
                queue.clear();
                queue.push(idx);
                visited[idx] = 1;
                let mut min_x = x;
                let mut max_x = x;
                let mut min_y = y;
                let mut max_y = y;
                let mut head = 0usize;

                while head < queue.len() {
                    let curr = queue[head];
                    head += 1;
                    let cy = curr / w;
                    let cx = curr % w;
                    if cx < min_x {
                        min_x = cx;
                    }
                    if cx > max_x {
                        max_x = cx;
                    }
                    if cy < min_y {
                        min_y = cy;
                    }
                    if cy > max_y {
                        max_y = cy;
                    }
                    for dy in -1i32..=1i32 {
                        let ny = (cy as i32 + dy) as usize;
                        if ny < h {
                            for dx in -1i32..=1i32 {
                                let nx = (cx as i32 + dx) as usize;
                                if nx < w {
                                    let nidx = ny * w + nx;
                                    if fg[nidx] == 1 && visited[nidx] == 0 {
                                        visited[nidx] = 1;
                                        if queue.len() < 25000 {
                                            queue.push(nidx);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                let area = queue.len();
                let bw = max_x - min_x + 1;
                let bh = max_y - min_y + 1;
                let fill = (area as f32) / ((bw * bh).max(1) as f32);
                let is_hollow_box = bw > 80 && bh > 40 && fill < 0.14;
                let is_line_frag =
                    (bw > bh * 5 && bh < 14) || (bh > bw * 5 && bw < 14 && bh > 40);

                if area >= 12
                    && bh >= 7
                    && bh <= max_char_h
                    && bw <= max_word_w
                    && !is_hollow_box
                    && !is_line_frag
                {
                    comp_boxes.push((min_x, min_y, max_x, max_y, area));
                    for &p_idx in &queue {
                        keep_mask[p_idx] = 1;
                        let py = p_idx / w;
                        let px = p_idx % w;
                        for dy in -1i32..=1i32 {
                            for dx in -1i32..=1i32 {
                                let ny = (py as i32 + dy) as usize;
                                if ny < h {
                                    let nx = (px as i32 + dx) as usize;
                                    if nx < w && keep_mask[ny * w + nx] == 0 {
                                        keep_mask[ny * w + nx] = 2;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut deboxed_bgra = vec![255u8; w * h * 4];
    for i in 0..(w * h) {
        let v = if keep_mask[i] == 1 {
            norm_gray[i]
        } else if keep_mask[i] == 2 {
            ((norm_gray[i] as u32 + 255) / 2) as u8
        } else {
            255u8
        };
        let idx4 = i * 4;
        deboxed_bgra[idx4] = v;
        deboxed_bgra[idx4 + 1] = v;
        deboxed_bgra[idx4 + 2] = v;
        deboxed_bgra[idx4 + 3] = 255;
    }

    (clean_bgra, deboxed_bgra)
}

#[cfg(windows)]
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(pv_reserved: *mut std::ffi::c_void, dw_co_init: u32) -> i32;
    fn CoUninitialize();
}

/// Initializes MTA (COINIT_MULTITHREADED = 0) on the current worker thread and balances
/// the uninitialized count on drop. WinRT calls fail outside an apartment.
#[cfg(windows)]
struct ComGuard(bool);

#[cfg(windows)]
impl ComGuard {
    fn new() -> Self {
        let hr = unsafe { CoInitializeEx(std::ptr::null_mut(), 0) };
        // S_OK = 0 means this call newly initialized the apartment.
        ComGuard(hr == 0)
    }
}

#[cfg(windows)]
impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.0 {
            unsafe {
                CoUninitialize();
            }
        }
    }
}

#[cfg(windows)]
fn winrt_ocr_engine() -> Result<windows::Media::Ocr::OcrEngine, String> {
    use windows::core::HSTRING;
    use windows::Globalization::Language;
    use windows::Media::Ocr::OcrEngine;

    OcrEngine::TryCreateFromUserProfileLanguages()
        .or_else(|_| {
            let lang = Language::CreateLanguage(&HSTRING::from("en-US"))?;
            OcrEngine::TryCreateFromLanguage(&lang)
        })
        .map_err(|error| format!("Windows OCR engine init failed: {error}"))
}

#[cfg(windows)]
fn run_windows_native_ocr(
    bgra: &[u8],
    image_width: u32,
    image_height: u32,
    page_width: f32,
    page_height: f32,
    offset_x: f32,
    offset_y: f32,
    pass_tag: &str,
) -> Result<Vec<OcrSegment>, String> {
    use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
    use windows::Security::Cryptography::CryptographicBuffer;

    let _com_guard = ComGuard::new();

    let ibuffer = CryptographicBuffer::CreateFromByteArray(bgra)
        .map_err(|e| format!("WinRT buffer creation failed: {e}"))?;
    let bitmap = SoftwareBitmap::CreateCopyFromBuffer(
        &ibuffer,
        BitmapPixelFormat::Bgra8,
        image_width as i32,
        image_height as i32,
    )
    .map_err(|e| format!("SoftwareBitmap creation failed: {e}"))?;

    let engine = winrt_ocr_engine()?;

    let ocr_result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("RecognizeAsync start failed: {e}"))?
        .get()
        .map_err(|e| format!("RecognizeAsync failed: {e}"))?;

    let lines = ocr_result
        .Lines()
        .map_err(|e| format!("Failed to read OCR lines: {e}"))?;

    let scale_x = page_width / image_width as f32;
    let scale_y = page_height / image_height as f32;
    let mut segments = Vec::new();
    let mut global_idx = 0usize;

    for (line_idx, line) in lines.into_iter().enumerate() {
        let words = match line.Words() {
            Ok(w) => w,
            Err(_) => continue,
        };
        for (word_idx, word) in words.into_iter().enumerate() {
            let text = match word.Text() {
                Ok(t) => t.to_string(),
                Err(_) => continue,
            };
            let trimmed = text.trim();
            if trimmed.is_empty() {
                continue;
            }
            let rect = match word.BoundingRect() {
                Ok(r) => r,
                Err(_) => continue,
            };
            if rect.Width <= 0.0 || rect.Height <= 0.0 {
                continue;
            }
            global_idx += 1;
            segments.push(OcrSegment {
                id: format!("winocr-{pass_tag}-{global_idx}"),
                text: trimmed.to_string(),
                x: offset_x + rect.X * scale_x,
                y: offset_y + page_height - (rect.Y + rect.Height) * scale_y,
                width: rect.Width * scale_x,
                height: rect.Height * scale_y,
                source: "ocr".to_string(),
                engine: "winocr".to_string(),
                // Windows.Media.Ocr exposes no per-word score. Reporting a number here
                // would be an invention; the quality pass relies on cross-engine agreement
                // plus the plausibility rules instead.
                confidence: None,
                quality: QUALITY_UNCERTAIN.to_string(),
                line: (line_idx as u32) + 1,
                word: (word_idx as u32) + 1,
            });
        }
    }

    Ok(segments)
}

fn create_bmp(width: u32, height: u32, bgra: &[u8]) -> Vec<u8> {
    let file_size = (54 + bgra.len()) as u32;
    let mut bmp = Vec::with_capacity(54 + bgra.len());
    // BITMAPFILEHEADER (14 bytes)
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&file_size.to_le_bytes());
    bmp.extend_from_slice(&[0u8; 4]); // reserved
    bmp.extend_from_slice(&54u32.to_le_bytes()); // offset to pixel data
    // BITMAPINFOHEADER (40 bytes)
    bmp.extend_from_slice(&40u32.to_le_bytes()); // biSize
    bmp.extend_from_slice(&(width as i32).to_le_bytes()); // biWidth
    bmp.extend_from_slice(&(-(height as i32)).to_le_bytes()); // biHeight (top-down)
    bmp.extend_from_slice(&1u16.to_le_bytes()); // biPlanes
    bmp.extend_from_slice(&32u16.to_le_bytes()); // biBitCount
    bmp.extend_from_slice(&0u32.to_le_bytes()); // biCompression (BI_RGB)
    bmp.extend_from_slice(&(bgra.len() as u32).to_le_bytes()); // biSizeImage
    bmp.extend_from_slice(&11811i32.to_le_bytes()); // biXPelsPerMeter (300 DPI)
    bmp.extend_from_slice(&11811i32.to_le_bytes()); // biYPelsPerMeter (300 DPI)
    bmp.extend_from_slice(&0u32.to_le_bytes()); // biClrUsed
    bmp.extend_from_slice(&0u32.to_le_bytes()); // biClrImportant
    bmp.extend_from_slice(bgra);
    bmp
}

fn run_tesseract_single_pass(
    engine: &TesseractEngine,
    image_bytes: &[u8],
    psm: &str,
    image_width: u32,
    image_height: u32,
    page_width: f32,
    page_height: f32,
    offset_x: f32,
    offset_y: f32,
) -> Result<Vec<OcrSegment>, String> {
    let executable = engine.exe.as_path();
    let mut command = Command::new(executable);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    if let Some(bin_dir) = executable.parent() {
        if !bin_dir.as_os_str().is_empty() && bin_dir.exists() {
            command.current_dir(bin_dir);
            if let Some(existing_path) = std::env::var_os("PATH") {
                let mut paths = vec![bin_dir.to_path_buf()];
                paths.extend(std::env::split_paths(&existing_path));
                if let Ok(joined) = std::env::join_paths(paths) {
                    command.env("PATH", joined);
                }
            }
        }
    }

    command
        .args(["stdin", "stdout", "--psm", psm, "tsv"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(tessdata_dir) = &engine.tessdata {
        command.env("TESSDATA_PREFIX", tessdata_dir);
    }

    let mut child = command.spawn().map_err(|e| {
        format!("Local OCR engine unavailable. Bundle tesseract.exe and tessdata under src-tauri/bin: {e}")
    })?;

    let mut stdin = child.stdin.take().ok_or("Unable to open OCR input")?;
    let output = std::thread::scope(|s| {
        let writer = s.spawn(move || stdin.write_all(image_bytes));
        let out = child
            .wait_with_output()
            .map_err(|e| format!("OCR process failed: {e}"))?;
        let _ = writer.join();
        Ok::<std::process::Output, String>(out)
    })?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let scale_x = page_width / image_width as f32;
    let scale_y = page_height / image_height as f32;
    let mut segments = Vec::new();

    for (row, line) in String::from_utf8_lossy(&output.stdout)
        .lines()
        .enumerate()
        .skip(1)
    {
        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 12 {
            continue;
        }
        let text = fields[11].trim();
        if text.is_empty() {
            continue;
        }
        let left: f32 = fields[6].parse().unwrap_or(0.0);
        let top: f32 = fields[7].parse().unwrap_or(0.0);
        let width: f32 = fields[8].parse().unwrap_or(0.0);
        let height: f32 = fields[9].parse().unwrap_or(0.0);
        if width <= 0.0 || height <= 0.0 {
            continue;
        }
        let confidence = fields[10].parse::<f32>().ok().filter(|value| *value >= 0.0);
        let line_number = fields[4].parse::<u32>().unwrap_or(0);
        let word_number = fields[5].parse::<u32>().unwrap_or(row as u32);
        segments.push(OcrSegment {
            id: format!("tess-{psm}-{row}"),
            text: text.to_string(),
            x: offset_x + left * scale_x,
            y: offset_y + page_height - (top + height) * scale_y,
            width: width * scale_x,
            height: height * scale_y,
            source: "ocr".to_string(),
            engine: "tesseract".to_string(),
            confidence,
            quality: QUALITY_UNCERTAIN.to_string(),
            line: line_number,
            word: word_number,
        });
    }

    Ok(segments)
}

fn segments_overlap(a: &OcrSegment, b: &OcrSegment) -> bool {
    let x_overlap = (a.x + a.width).min(b.x + b.width) - a.x.max(b.x);
    let y_overlap = (a.y + a.height).min(b.y + b.height) - a.y.max(b.y);
    if x_overlap <= 0.0 || y_overlap <= 0.0 {
        return false;
    }
    let overlap_area = x_overlap * y_overlap;
    let min_area = (a.width * a.height).min(b.width * b.height).max(1.0);
    overlap_area / min_area > 0.35
}

/// Lowercased alphanumerics only, so `Hello,` and `hello` compare equal.
fn normalized_word(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn levenshtein(a: &[char], b: &[char]) -> usize {
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }
    let mut previous: Vec<usize> = (0..=b.len()).collect();
    let mut current = vec![0usize; b.len() + 1];
    for (i, ca) in a.iter().enumerate() {
        current[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            current[j + 1] = (previous[j + 1] + 1)
                .min(current[j] + 1)
                .min(previous[j] + cost);
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous[b.len()]
}

/// 0.0..=1.0 similarity on alphanumeric content. Used to decide whether two engines
/// are describing the same word or two different readings of the same ink.
fn similarity(a: &str, b: &str) -> f32 {
    let left = normalized_word(a);
    let right = normalized_word(b);
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    if left == right {
        return 1.0;
    }
    let a_chars: Vec<char> = left.chars().collect();
    let b_chars: Vec<char> = right.chars().collect();
    let longest = a_chars.len().max(b_chars.len()) as f32;
    1.0 - (levenshtein(&a_chars, &b_chars) as f32 / longest)
}

/// Rejects strings that no printed word can look like. Everything failing this is
/// surfaced as `unreadable` so the UI can show "couldn't read this" instead of
/// feeding mojibake into the search index.
fn is_plausible_word(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    let char_count = trimmed.chars().count();
    if char_count > 30 {
        return false;
    }
    if !trimmed.chars().any(char::is_alphanumeric) {
        return false;
    }
    let symbol_count = trimmed.chars().filter(|c| !c.is_alphanumeric()).count();
    if char_count >= 4 && symbol_count * 2 > char_count {
        return false;
    }
    true
}

fn classify(segment: &OcrSegment, agreement: Option<f32>) -> &'static str {
    // A single glyph filling a 120pt-tall box is a diagram border, not a word.
    if segment.height > 120.0 && segment.text.trim().chars().count() <= 2 {
        return QUALITY_UNREADABLE;
    }
    if !is_plausible_word(&segment.text) {
        return QUALITY_UNREADABLE;
    }

    let corroborated = agreement
        .map(|value| value >= AGREEMENT_THRESHOLD)
        .unwrap_or(false);

    match segment.confidence {
        Some(value) if value < CONFIDENCE_UNREADABLE => QUALITY_UNREADABLE,
        Some(value) if value < CONFIDENCE_UNCERTAIN && !corroborated => QUALITY_UNCERTAIN,
        Some(_) => QUALITY_OK,
        // No score available (Windows OCR). Only a second engine agreeing makes it
        // trustworthy enough to treat as ordinary text.
        None if corroborated => QUALITY_OK,
        None => QUALITY_UNCERTAIN,
    }
}

/// Merges per-engine candidate lists into one reading-order layer and assigns a quality
/// verdict to each survivor. Keeps unreadable segments (with their boxes) because the
/// bounding box is the only evidence that ink existed where text was not recognised.
fn merge_engines(winrt: Vec<OcrSegment>, tesseract: Vec<OcrSegment>) -> Vec<OcrSegment> {
    let mut merged: Vec<OcrSegment> = Vec::new();
    let mut agreement: Vec<Option<f32>> = Vec::new();

    // Tesseract first: it is the only engine reporting a real score, so on conflict its
    // higher-confidence reading wins rather than whichever engine happened to run first.
    for candidate in tesseract.into_iter().chain(winrt.into_iter()) {
        if candidate.text.trim().is_empty() {
            continue;
        }
        let existing_index = merged
            .iter()
            .position(|existing| segments_overlap(&candidate, existing));

        match existing_index {
            Some(index) => {
                let score = similarity(&merged[index].text, &candidate.text);
                let replace = match (&merged[index].confidence, &candidate.confidence) {
                    (Some(current), Some(next)) => next > current,
                    (None, Some(_)) => true,
                    (Some(_), None) => false,
                    (None, None) => candidate.text.len() > merged[index].text.len(),
                };
                if replace {
                    merged[index] = candidate;
                }
                agreement[index] = Some(match agreement[index] {
                    Some(previous) => previous.max(score),
                    None => score,
                });
            }
            None => {
                merged.push(candidate);
                agreement.push(None);
            }
        }
    }

    for (index, segment) in merged.iter_mut().enumerate() {
        segment.quality = classify(segment, agreement[index]).to_string();
    }

    merged
}

fn crop_bgra(
    bgra: &[u8],
    width: u32,
    height: u32,
    left: u32,
    top: u32,
    crop_width: u32,
    crop_height: u32,
) -> Vec<u8> {
    let mut out = vec![255u8; (crop_width * crop_height * 4) as usize];
    for row in 0..crop_height {
        let source_y = top + row;
        if source_y >= height {
            break;
        }
        let copy_width = crop_width.min(width.saturating_sub(left));
        if copy_width == 0 {
            break;
        }
        let source_start = ((source_y * width + left) * 4) as usize;
        let source_end = source_start + (copy_width * 4) as usize;
        let target_start = (row * crop_width * 4) as usize;
        if source_end <= bgra.len() {
            out[target_start..target_start + (copy_width * 4) as usize]
                .copy_from_slice(&bgra[source_start..source_end]);
        }
    }
    out
}

fn sort_ocr_segments_reading_order(segments: &mut [OcrSegment]) {
    segments.sort_by(|a, b| {
        let line_a = (a.y / 8.0).round() as i64;
        let line_b = (b.y / 8.0).round() as i64;
        let ord = line_b.cmp(&line_a);
        if ord != std::cmp::Ordering::Equal {
            ord
        } else {
            a.x.total_cmp(&b.x)
        }
    });
}

/// Renders a whole page to BGRA at a resolution that keeps memory bounded.
fn render_page_bgra(
    id: &str,
    page_index: u16,
    scale: f32,
) -> Result<(Vec<u8>, u32, u32, f32, f32), String> {
    let docs = crate::pdf::lock_documents();
    let doc = docs.get(id).ok_or("Document not found")?;
    let page = doc
        .pages()
        .get(page_index.into())
        .map_err(|error| error.to_string())?;
    let page_width = page.width().value;
    let page_height = page.height().value;
    let render_config = PdfRenderConfig::new()
        .scale_page_by_factor(scale)
        .set_clear_color(PdfColor::WHITE);
    let bitmap = page
        .render_with_config(&render_config)
        .map_err(|error| error.to_string())?;
    let bitmap_width = bitmap.width() as u32;
    let bitmap_height = bitmap.height() as u32;
    let raw = bitmap.as_raw_bytes().to_vec();
    // Release the PDFium document lock before doing expensive image work.
    drop(docs);
    Ok((raw, bitmap_width, bitmap_height, page_width, page_height))
}

#[tauri::command]
pub async fn pdf_ocr_page_direct(
    app: AppHandle,
    id: String,
    page_index: u16,
) -> Result<Vec<OcrSegment>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // WinRT OcrEngine must never be entered concurrently from several worker threads.
        let _ocr_lock = lock_ocr();

        let (raw, bitmap_width, bitmap_height, page_width, page_height) = {
            let docs = crate::pdf::lock_documents();
            let doc = docs.get(&id).ok_or("Document not found")?;
            let page = doc
                .pages()
                .get(page_index.into())
                .map_err(|error| error.to_string())?;
            let page_width = page.width().value;
            let page_height = page.height().value;
            // 2200px on the long edge (was ~1400). Small print and thin strokes were being
            // lost before either engine ever saw them; this is the single biggest accuracy
            // lever available without swapping engines. ~15 MB per page bitmap at A4.
            let max_pt = page_width.max(page_height).max(1.0);
            let scale = (2200.0 / max_pt).clamp(1.0, 3.0).min(2400.0 / max_pt);
            let render_config = PdfRenderConfig::new()
                .scale_page_by_factor(scale)
                .set_clear_color(PdfColor::WHITE);
            let bitmap = page
                .render_with_config(&render_config)
                .map_err(|error| error.to_string())?;
            let bitmap_width = bitmap.width() as u32;
            let bitmap_height = bitmap.height() as u32;
            let raw = bitmap.as_raw_bytes().to_vec();
            drop(docs);
            (raw, bitmap_width, bitmap_height, page_width, page_height)
        };

        let (clean, deboxed) = preprocess_and_debox_for_ocr(bitmap_width, bitmap_height, &raw);

        let probe = engine_probe(&app);
        warn_if_tesseract_missing(probe);

        let mut winrt: Vec<OcrSegment> = Vec::new();
        let mut tesseract: Vec<OcrSegment> = Vec::new();

        #[cfg(windows)]
        {
            // Raw colour first: the unprocessed render is the best input for diagrams and
            // faint print. The normalised passes only run when the raw pass looks sparse.
            if let Ok(Ok(mut segments)) =
                std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    run_windows_native_ocr(
                        &raw,
                        bitmap_width,
                        bitmap_height,
                        page_width,
                        page_height,
                        0.0,
                        0.0,
                        "raw",
                    )
                }))
            {
                winrt.append(&mut segments);
            }

            if winrt.len() < 35 {
                if let Ok(Ok(mut segments)) =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        run_windows_native_ocr(
                            &clean,
                            bitmap_width,
                            bitmap_height,
                            page_width,
                            page_height,
                            0.0,
                            0.0,
                            "clean",
                        )
                    }))
                {
                    winrt.append(&mut segments);
                }
            }

            if winrt.len() < 25 {
                if let Ok(Ok(mut segments)) =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        run_windows_native_ocr(
                            &deboxed,
                            bitmap_width,
                            bitmap_height,
                            page_width,
                            page_height,
                            0.0,
                            0.0,
                            "debox",
                        )
                    }))
                {
                    winrt.append(&mut segments);
                }
            }
        }

        if let Some(engine) = &probe.tesseract {
            if winrt.len() < 120 {
                let clean_bmp = create_bmp(bitmap_width, bitmap_height, &clean);
                let deboxed_bmp = create_bmp(bitmap_width, bitmap_height, &deboxed);

                if let Ok(segments) = run_tesseract_single_pass(
                    engine,
                    &clean_bmp,
                    "6",
                    bitmap_width,
                    bitmap_height,
                    page_width,
                    page_height,
                    0.0,
                    0.0,
                ) {
                    tesseract.extend(segments);
                }

                // PSM 4 assumes a single column of variable-size text, which suits textbook
                // and slide layouts better than PSM 6 once the page has any vertical structure.
                if let Ok(segments) = run_tesseract_single_pass(
                    engine,
                    &deboxed_bmp,
                    "4",
                    bitmap_width,
                    bitmap_height,
                    page_width,
                    page_height,
                    0.0,
                    0.0,
                ) {
                    tesseract.extend(segments);
                }

                if tesseract.len() < 120 {
                    if let Ok(segments) = run_tesseract_single_pass(
                        engine,
                        &deboxed_bmp,
                        "11",
                        bitmap_width,
                        bitmap_height,
                        page_width,
                        page_height,
                        0.0,
                        0.0,
                    ) {
                        tesseract.extend(segments);
                    }
                }
            }
        }

        let mut merged = merge_engines(winrt, tesseract);
        sort_ocr_segments_reading_order(&mut merged);
        Ok(merged)
    })
    .await
    .unwrap_or_else(|error| Err(format!("Task failed: {error}")))
}

/// Re-reads a single user-selected region at high resolution.
///
/// This is a retry mechanism for text the page pass could not read (small print, rotated
/// labels, dense tables). It does not add handwriting or formula recognition: if the crop
/// is genuinely unrecognisable the result comes back empty or marked `unreadable`, and the
/// UI says so rather than inventing text.
#[tauri::command]
pub async fn pdf_ocr_region(
    app: AppHandle,
    id: String,
    page_index: u16,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
) -> Result<Vec<OcrSegment>, String> {
    if width < 8.0 || height < 8.0 {
        return Err("Select a larger region to re-read".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let _ocr_lock = lock_ocr();

        let (raw, bitmap_width, bitmap_height, page_width, page_height) =
            render_page_bgra(&id, page_index, 3.0)?;

        let scale_x = bitmap_width as f32 / page_width;
        let scale_y = bitmap_height as f32 / page_height;

        // Region rectangles arrive in PDF space (origin bottom-left, y up).
        let padding = 6.0;
        let left = ((x - padding) * scale_x).max(0.0) as u32;
        let top = ((page_height - (y + height) - padding) * scale_y).max(0.0) as u32;
        let right = (((x + width + padding) * scale_x) as u32).min(bitmap_width);
        let bottom = (((page_height - y + padding) * scale_y) as u32).min(bitmap_height);

        let crop_width = right.saturating_sub(left);
        let crop_height = bottom.saturating_sub(top);
        if crop_width < 8 || crop_height < 8 {
            return Err("Selected region is too small".to_string());
        }

        let crop = crop_bgra(&raw, bitmap_width, bitmap_height, left, top, crop_width, crop_height);
        let (clean, _) = preprocess_and_debox_for_ocr(crop_width, crop_height, &crop);

        // Report everything relative to the page, not to the crop.
        let origin_x = left as f32 / scale_x;
        let origin_y = page_height - (top + crop_height) as f32 / scale_y;
        let crop_page_width = crop_width as f32 / scale_x;
        let crop_page_height = crop_height as f32 / scale_y;

        let probe = engine_probe(&app);
        warn_if_tesseract_missing(probe);

        let mut winrt: Vec<OcrSegment> = Vec::new();
        let mut tesseract: Vec<OcrSegment> = Vec::new();

        #[cfg(windows)]
        {
            for (buffer, tag) in [(&crop, "region-raw"), (&clean, "region-clean")] {
                if let Ok(Ok(mut segments)) =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        run_windows_native_ocr(
                            buffer,
                            crop_width,
                            crop_height,
                            crop_page_width,
                            crop_page_height,
                            origin_x,
                            origin_y,
                            tag,
                        )
                    }))
                {
                    winrt.append(&mut segments);
                }
            }
        }

        if let Some(engine) = &probe.tesseract {
            let bmp = create_bmp(crop_width, crop_height, &clean);
            // Sparse text needs a different page-segmentation mode than a dense block, and
            // a single line needs another. Running all three on a small crop is cheap.
            for psm in ["6", "7", "11"] {
                if let Ok(segments) = run_tesseract_single_pass(
                    engine,
                    &bmp,
                    psm,
                    crop_width,
                    crop_height,
                    crop_page_width,
                    crop_page_height,
                    origin_x,
                    origin_y,
                ) {
                    tesseract.extend(segments);
                }
            }
        } else if winrt.is_empty() {
            return Err(probe
                .tesseract_error
                .clone()
                .unwrap_or_else(|| "No OCR engine is available".to_string()));
        }

        let mut merged = merge_engines(winrt, tesseract);
        sort_ocr_segments_reading_order(&mut merged);
        Ok(merged)
    })
    .await
    .unwrap_or_else(|error| Err(format!("Task failed: {error}")))
}

#[derive(serde::Serialize)]
pub struct OcrDiagnostics {
    pub pipeline_version: String,
    pub winrt_available: bool,
    pub winrt_error: Option<String>,
    pub tesseract_path: Option<String>,
    pub tesseract_version: Option<String>,
    pub tessdata_path: Option<String>,
    pub tesseract_error: Option<String>,
}

/// Reports what OCR can actually do on this machine. Exists so a degraded install is
/// visible instead of silently producing worse results.
#[tauri::command]
pub fn ocr_diagnostics(app: AppHandle) -> OcrDiagnostics {
    let probe = engine_probe(&app);
    let (winrt_available, winrt_error) = winrt_status();
    OcrDiagnostics {
        pipeline_version: PIPELINE_VERSION.to_string(),
        winrt_available,
        winrt_error,
        tesseract_path: probe
            .tesseract
            .as_ref()
            .map(|engine| engine.exe.display().to_string()),
        tesseract_version: probe
            .tesseract
            .as_ref()
            .map(|engine| engine.version.clone()),
        tessdata_path: probe
            .tesseract
            .as_ref()
            .and_then(|engine| engine.tessdata.as_ref())
            .map(|path| path.display().to_string()),
        tesseract_error: probe.tesseract_error.clone(),
    }
}

#[cfg(windows)]
fn winrt_status() -> (bool, Option<String>) {
    let _com_guard = ComGuard::new();
    match winrt_ocr_engine() {
        Ok(_) => (true, None),
        Err(error) => (false, Some(error)),
    }
}

#[cfg(not(windows))]
fn winrt_status() -> (bool, Option<String>) {
    (
        false,
        Some("Windows OCR is only available on Windows".to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(text: &str, confidence: Option<f32>, x: f32, y: f32) -> OcrSegment {
        OcrSegment {
            id: "test".to_string(),
            text: text.to_string(),
            x,
            y,
            width: 40.0,
            height: 12.0,
            source: "ocr".to_string(),
            engine: if confidence.is_some() {
                "tesseract".to_string()
            } else {
                "winocr".to_string()
            },
            confidence,
            quality: QUALITY_UNCERTAIN.to_string(),
            line: 0,
            word: 0,
        }
    }

    #[test]
    fn similarity_ignores_case_and_punctuation() {
        assert_eq!(similarity("Hello,", "hello"), 1.0);
        assert!(similarity("hello", "world") < 0.4);
        assert!(similarity("invoice", "invoise") > 0.8);
        assert_eq!(similarity("", "hello"), 0.0);
    }

    #[test]
    fn implausible_strings_are_rejected() {
        assert!(is_plausible_word("Word"));
        assert!(is_plausible_word("A1"));
        assert!(!is_plausible_word(""));
        assert!(!is_plausible_word("   "));
        assert!(!is_plausible_word("--..::"));
        assert!(!is_plausible_word(&"x".repeat(31)));
        // A long run of symbols padded with one letter is OCR noise, not a word.
        assert!(!is_plausible_word("a.........."));
    }

    #[test]
    fn low_confidence_is_unreadable_regardless_of_corroboration() {
        let subject = segment("noise?", Some(12.0), 0.0, 0.0);
        assert_eq!(classify(&subject, Some(1.0)), QUALITY_UNREADABLE);
    }

    #[test]
    fn confident_tesseract_word_is_ok() {
        let subject = segment("Invoice", Some(91.0), 0.0, 0.0);
        assert_eq!(classify(&subject, None), QUALITY_OK);
    }

    #[test]
    fn uncertain_tesseract_word_needs_corroboration() {
        let subject = segment("Invoice", Some(50.0), 0.0, 0.0);
        assert_eq!(classify(&subject, None), QUALITY_UNCERTAIN);
        assert_eq!(classify(&subject, Some(0.9)), QUALITY_OK);
    }

    #[test]
    fn unscored_winrt_word_needs_corroboration() {
        let subject = segment("Invoice", None, 0.0, 0.0);
        assert_eq!(classify(&subject, None), QUALITY_UNCERTAIN);
        assert_eq!(classify(&subject, Some(0.95)), QUALITY_OK);
    }

    #[test]
    fn oversized_single_glyph_is_unreadable() {
        let mut subject = segment("l", Some(95.0), 0.0, 0.0);
        subject.height = 200.0;
        assert_eq!(classify(&subject, Some(1.0)), QUALITY_UNREADABLE);
    }

    #[test]
    fn merging_engines_keeps_one_segment_and_records_agreement() {
        let winrt = vec![segment("Invoice", None, 10.0, 700.0)];
        let tesseract = vec![segment("invoice", Some(88.0), 10.0, 700.0)];
        let merged = merge_engines(winrt, tesseract);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].quality, QUALITY_OK);
        // The confident engine wins the text.
        assert_eq!(merged[0].engine, "tesseract");
    }

    #[test]
    fn merging_engines_keeps_disjoint_words() {
        let winrt = vec![segment("Alpha", None, 10.0, 700.0)];
        let tesseract = vec![segment("Beta", Some(88.0), 200.0, 700.0)];
        let merged = merge_engines(winrt, tesseract);
        assert_eq!(merged.len(), 2);
        let alpha = merged.iter().find(|s| s.text == "Alpha").unwrap();
        // No second engine agreed on it, and Windows OCR reports no score.
        assert_eq!(alpha.quality, QUALITY_UNCERTAIN);
    }

    #[test]
    fn crop_clamps_to_image_bounds() {
        let width = 4u32;
        let height = 2u32;
        let bgra = vec![9u8; (width * height * 4) as usize];
        // Source is 4x2; crop from (2,1) sized 4x4, so only 2 columns and 1 row exist.
        let crop = crop_bgra(&bgra, width, height, 2, 1, 4, 4);
        assert_eq!(crop.len(), (4 * 4 * 4) as usize);
        // First crop pixel maps to source (2,1), which is inside the image.
        assert_eq!(&crop[0..4], &[9, 9, 9, 9]);
        // Third crop column maps to source x=4, past the right edge: stays white.
        assert_eq!(&crop[8..12], &[255, 255, 255, 255]);
        // Third crop row maps to source y=3, past the bottom edge: stays white.
        assert_eq!(&crop[(2 * 4) * 4..(2 * 4) * 4 + 4], &[255, 255, 255, 255]);
    }


    /// Builds the engine handle for the Tesseract copy bundled in `src-tauri/bin`.
    fn bundled_engine() -> TesseractEngine {
        let bin = Path::new(env!("CARGO_MANIFEST_DIR")).join("bin");
        TesseractEngine {
            exe: bin.join(if cfg!(windows) {
                "tesseract.exe"
            } else {
                "tesseract"
            }),
            tessdata: Some(bin.join("tessdata")),
            version: "test".to_string(),
        }
    }

    /// A real, font-rendered 24-bit BMP fixture. Hand-drawn glyphs were not legible to
    /// Tesseract (it read "AURA" as "hufa"), which only proved the font was bad, not the
    /// pipeline. A real render makes the assertion mean something.
    fn fixture_bmp() -> Vec<u8> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("ocr_sample.bmp");
        std::fs::read(&path).unwrap_or_else(|error| {
            panic!("missing OCR fixture {}: {error}", path.display())
        })
    }

    #[test]
    fn tesseract_reads_the_committed_fixture() {
        let engine = bundled_engine();
        if !engine.exe.exists() {
            return;
        }
        let bmp = fixture_bmp();
        let width = i32::from_le_bytes([bmp[18], bmp[19], bmp[20], bmp[21]]).unsigned_abs();
        let height = i32::from_le_bytes([bmp[22], bmp[23], bmp[24], bmp[25]]).unsigned_abs();

        let segments = run_tesseract_single_pass(
            &engine,
            &bmp,
            "6",
            width,
            height,
            width as f32,
            height as f32,
            0.0,
            0.0,
        )
        .expect("tesseract pass failed");

        let recognised: String = segments
            .iter()
            .map(|segment| normalized_word(&segment.text))
            .collect::<Vec<_>>()
            .join(" ");
        assert!(
            recognised.contains("aurapdf"),
            "expected AURAPDF in {recognised:?}"
        );

        let best_confidence = segments
            .iter()
            .filter_map(|segment| segment.confidence)
            .fold(0.0_f32, f32::max);
        assert!(
            best_confidence > 50.0,
            "expected a real confidence score, got {best_confidence}"
        );

        // Coordinates must land inside the page, not in some unscaled pixel space.
        for segment in &segments {
            assert!(
                segment.x >= -1.0 && segment.x <= width as f32,
                "x out of page: {}",
                segment.x
            );
            assert!(
                segment.y >= -1.0 && segment.y <= height as f32,
                "y out of page: {}",
                segment.y
            );
        }
    }

    #[test]
    fn region_offsets_shift_segments_into_page_space() {
        let bmp = include_bytes!("../tests/fixtures/ocr_sample.bmp").to_vec();
        let width = i32::from_le_bytes([bmp[18], bmp[19], bmp[20], bmp[21]]).unsigned_abs();
        let height = i32::from_le_bytes([bmp[22], bmp[23], bmp[24], bmp[25]]).unsigned_abs();

        let baseline = run_tesseract_single_pass(
            &bundled_engine(),
            &bmp,
            "6",
            width,
            height,
            width as f32,
            height as f32,
            0.0,
            0.0,
        )
        .expect("tesseract pass failed");
        let shifted = run_tesseract_single_pass(
            &bundled_engine(),
            &bmp,
            "6",
            width,
            height,
            width as f32,
            height as f32,
            100.0,
            50.0,
        )
        .expect("tesseract pass failed");

        assert_eq!(baseline.len(), shifted.len());
        if let (Some(first), Some(second)) = (baseline.first(), shifted.first()) {
            assert!((second.x - first.x - 100.0).abs() < 0.01);
            assert!((second.y - first.y - 50.0).abs() < 0.01);
        }
    }
}
