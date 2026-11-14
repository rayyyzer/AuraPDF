use pdfium_render::prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use tauri::Manager;

lazy_static::lazy_static! {
    static ref PDFIUM: Mutex<Option<Pdfium>> = Mutex::new(None);
    static ref DOCUMENTS: Mutex<HashMap<String, PdfDocument<'static>>> = Mutex::new(HashMap::new());
}

fn lock_pdfium() -> MutexGuard<'static, Option<Pdfium>> {
    PDFIUM.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn lock_documents() -> MutexGuard<'static, HashMap<String, PdfDocument<'static>>> {
    DOCUMENTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Borrows the process-wide PDFium instance as `'static`.
///
/// Safety: `PDFIUM` is a `lazy_static` that is initialised once and never dropped, so a
/// reference derived from its contents never dangles. This mirrors the borrow taken by
/// `pdf_open`.
pub(crate) fn pdfium_handle(app: &tauri::AppHandle) -> Result<&'static Pdfium, String> {
    init_pdfium(app)?;
    unsafe {
        let guard = lock_pdfium();
        let pointer = guard.as_ref().ok_or("PDFium not initialized")? as *const Pdfium;
        Ok(&*pointer)
    }
}

/// Turns a PDFium load failure into something the reader can show.
///
/// Password-protected files used to surface as a generic "failed to load PDF", which reads
/// like corruption. Encryption is by far the most common reason a real user's file will not
/// open, so it gets its own message.
fn describe_open_error(
    path: &std::path::Path,
    first: &PdfiumError,
    fallback: &PdfiumError,
) -> String {
    let is_password = |error: &PdfiumError| {
        matches!(
            error,
            PdfiumError::PdfiumLibraryInternalError(
                PdfiumInternalError::PasswordError | PdfiumInternalError::SecurityError
            )
        )
    };

    if is_password(first) || is_password(fallback) {
        return "PASSWORD_PROTECTED".to_string();
    }

    format!("Failed to load PDF '{}': {fallback:?}", path.display())
}

fn init_pdfium(app: &tauri::AppHandle) -> Result<(), String> {
    let mut pdfium_guard = lock_pdfium();
    if pdfium_guard.is_none() {
        let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
        let current_exe_bin = std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join("bin")));
        let candidates = [
            resource_dir.join("bin"),
            current_exe_bin.unwrap_or_default(),
            std::path::PathBuf::from("src-tauri/bin"),
            std::path::PathBuf::from("bin"),
        ];

        let mut bind_error = String::new();
        let bind = candidates
            .iter()
            .filter(|path| !path.as_os_str().is_empty())
            .find_map(|bin_path| {
                let path = bin_path.to_string_lossy();
                match Pdfium::bind_to_library(
                    Pdfium::pdfium_platform_library_name_at_path(path.as_ref()),
                ) {
                    Ok(bind) => Some(bind),
                    Err(error) => {
                        bind_error = format!("{bin_path:?}: {error:?}");
                        None
                    }
                }
            })
            .or_else(|| Pdfium::bind_to_system_library().ok())
            .ok_or_else(|| {
                format!(
                    "Failed to bind to PDFium. Checked resource and local bin directories. Last error: {bind_error}"
                )
            })?;
        *pdfium_guard = Some(Pdfium::new(bind));
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct DocumentMeta {
    pub id: String,
    pub num_pages: u16,
}

#[tauri::command]
pub async fn pdf_open(app: tauri::AppHandle, id: String, path: String) -> Result<DocumentMeta, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let original_path = path.clone();
        let canonical = std::fs::canonicalize(&path)
            .map_err(|e| format!("PDF file is unavailable at '{}': {}", original_path, e))?;
        std::fs::metadata(&canonical)
            .map_err(|e| format!("PDF file is unavailable at '{}': {}", canonical.display(), e))?;
        let clean_path = std::path::PathBuf::from(crate::launch::normalize_windows_path_string(&canonical));
        if let Some(document) = lock_documents().get(&id) {
            return Ok(DocumentMeta {
                id,
                num_pages: document.pages().len() as u16,
            });
        }
        init_pdfium(&app)?;

        // Safety: PDFIUM is lazy_static and never dropped. We can borrow it as 'static.
        let pdfium_ref: &'static Pdfium = unsafe {
            let guard = lock_pdfium();
            let ptr = guard.as_ref().ok_or("PDFium not initialized")? as *const Pdfium;
            &*ptr
        };

        let document = match pdfium_ref.load_pdf_from_file(&clean_path, None) {
            Ok(doc) => doc,
            Err(first_error) => {
                // Fallback for Windows Unicode paths where C's ANSI fopen() inside pdfium.dll
                // cannot open UTF-16 paths directly.
                let bytes = std::fs::read(&canonical).map_err(|e| {
                    format!("Failed to read PDF bytes '{}': {}", clean_path.display(), e)
                })?;
                pdfium_ref
                    .load_pdf_from_byte_vec(bytes, None)
                    .map_err(|fallback_error| describe_open_error(&clean_path, &first_error, &fallback_error))?
            }
        };

        let num_pages = document.pages().len() as u16;

        lock_documents().insert(id.clone(), document);

        Ok(DocumentMeta { id, num_pages })
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[tauri::command]
pub async fn pdf_close(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        lock_documents().remove(&id);
        Ok(())
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[derive(serde::Serialize)]
pub struct PageMeta {
    pub width: f64,
    pub height: f64,
}

#[tauri::command]
pub async fn pdf_get_page_meta(id: String, page_index: u16) -> Result<PageMeta, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let docs = lock_documents();
        let doc = docs.get(&id).ok_or("Document not found")?;
        let page = doc
            .pages()
            .get(page_index.into())
            .map_err(|e| e.to_string())?;

        Ok(PageMeta {
            width: page.width().value as f64,
            height: page.height().value as f64,
        })
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

fn build_page_render_config(scale: f32, rotation: i32) -> PdfRenderConfig {
    let render_config = PdfRenderConfig::new()
        // Render into opaque BGRx so semi-transparent logos and soft masks composite
        // cleanly onto white paper without leaving partial destination alpha, while
        // keeping PDFium's default FPDF_REVERSE_BYTE_ORDER enabled for native RGBA output.
        .set_format(PdfBitmapFormat::BGRx)
        .scale_page_by_factor(scale)
        .set_clear_color(PdfColor::WHITE);

    match rotation {
        90 => render_config.rotate(PdfPageRenderRotation::Degrees90, true),
        180 => render_config.rotate(PdfPageRenderRotation::Degrees180, true),
        270 => render_config.rotate(PdfPageRenderRotation::Degrees270, true),
        _ => render_config,
    }
}

fn copy_bitmap_to_payload(bitmap: &PdfBitmap<'_>) -> Vec<u8> {
    let bmp_width = bitmap.width() as u32;
    let bmp_height = bitmap.height() as u32;
    let expected_len = (bmp_width as usize) * (bmp_height as usize) * 4;
    let raw = bitmap.as_raw_bytes();

    if raw.len() == expected_len {
        let mut bytes = vec![0u8; 8 + expected_len];
        bytes[0..4].copy_from_slice(&bmp_width.to_le_bytes());
        bytes[4..8].copy_from_slice(&bmp_height.to_le_bytes());
        bytes[8..].copy_from_slice(&raw);
        bytes
    } else {
        // Fallback when row stride differs from width * 4; as_rgba_bytes normalizes
        // both stride padding and reverse byte order into packed RGBA.
        let rgba = bitmap.as_rgba_bytes();
        let mut bytes = vec![0u8; 8 + rgba.len()];
        bytes[0..4].copy_from_slice(&bmp_width.to_le_bytes());
        bytes[4..8].copy_from_slice(&bmp_height.to_le_bytes());
        bytes[8..].copy_from_slice(&rgba);
        bytes
    }
}

fn finalize_rgba_payload(bytes: &mut [u8]) {
    // Enforce opaque paper alpha so semi-transparent logos and soft masks never
    // bleed dark backdrop colors into 2D canvases or JPEG print exports.
    for chunk in bytes[8..].chunks_exact_mut(4) {
        chunk[3] = 255;
    }
}

#[tauri::command]
pub async fn pdf_render_page(
    id: String,
    page_index: u16,
    scale: f32,
    rotation: i32,
) -> Result<tauri::ipc::Response, String> {
    if !scale.is_finite() || scale < 0.05 || scale > 10.0 {
        return Err("Invalid scale factor: must be a finite number between 0.05 and 10.0".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let t_start = std::time::Instant::now();
        let docs = lock_documents();
        let t_mutex = t_start.elapsed();
        let doc = docs.get(&id).ok_or("Document not found")?;
        let page = doc
            .pages()
            .get(page_index.into())
            .map_err(|e| e.to_string())?;

        // Guard against excessive pixel allocation from corrupt or malformed PDF point sizes
        let page_w = page.width().value;
        let page_h = page.height().value;
        let est_w = page_w * scale;
        let est_h = page_h * scale;
        if est_w > 16384.0 || est_h > 16384.0 || (est_w * est_h) > 16_000_000.0 {
            return Err(format!(
                "Requested render dimensions ({:.0}x{:.0}) exceed safe maximum limits",
                est_w, est_h
            ));
        }

        let config_with_rot = build_page_render_config(scale, rotation);

        let t_pre_render = std::time::Instant::now();
        let bitmap = page
            .render_with_config(&config_with_rot)
            .map_err(|e| e.to_string())?;
        let t_render = t_pre_render.elapsed();

        let t_pre_conv = std::time::Instant::now();
        let mut bytes = copy_bitmap_to_payload(&bitmap);

        // Drop the PDFium lock immediately so other threads can render concurrently
        drop(docs);

        finalize_rgba_payload(&mut bytes);
        let t_conv = t_pre_conv.elapsed();

        log::debug!(
            "[PDF_RENDER] page={} scale={} rotation={} mutex={:?} render={:?} conv={:?} total={:?}",
            page_index,
            scale,
            rotation,
            t_mutex,
            t_render,
            t_conv,
            t_start.elapsed()
        );

        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[derive(serde::Serialize)]
pub struct OutlineItem {
    pub title: String,
    pub page: u16,
    pub level: u32,
}

fn traverse_bookmarks(
    bookmark: &pdfium_render::prelude::PdfBookmark,
    level: u32,
    items: &mut Vec<OutlineItem>,
) {
    let title = bookmark.title().unwrap_or_default();
    let mut page = 0;

    if let Some(dest) = bookmark.destination() {
        if let Ok(p) = dest.page_index() {
            page = (p as u16) + 1; // 1-indexed for frontend
        }
    }

    if page > 0 {
        items.push(OutlineItem { title, page, level });
    }

    for kid in bookmark.iter_direct_children() {
        traverse_bookmarks(&kid, level + 1, items);
    }
}

#[tauri::command]
pub async fn pdf_get_outline(id: String) -> Result<Vec<OutlineItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let docs = lock_documents();
        let doc = docs.get(&id).ok_or("Document not found")?;

        let mut items = Vec::new();
        let bookmarks = doc.bookmarks();
        for bookmark in bookmarks.iter() {
            traverse_bookmarks(&bookmark, 0, &mut items);
        }
        Ok(items)
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[derive(serde::Serialize)]
pub struct TextSegment {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

pub use crate::ocr::OcrSegment;
#[tauri::command]
pub async fn pdf_get_text_layer(id: String, page_index: u16) -> Result<Vec<TextSegment>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let docs = lock_documents();
        let doc = docs.get(&id).ok_or("Document not found")?;

        let mut items = Vec::new();
        if let Ok(page) = doc.pages().get(page_index.into()) {
            if let Ok(text) = page.text() {
                for segment in text.segments().iter() {
                    let bounds = segment.bounds();
                    items.push(TextSegment {
                        text: segment.text(),
                        x: bounds.left().value,
                        y: bounds.bottom().value,
                        width: bounds.width().value,
                        height: bounds.height().value,
                    });
                }
            }
        }

        Ok(items)
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[derive(serde::Serialize)]
pub struct SearchMatch {
    pub page: u16,
    pub bounds: Vec<TextSegment>,
}

#[tauri::command]
pub async fn pdf_search_document(id: String, query: String) -> Result<Vec<SearchMatch>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let num_pages = {
            let docs = lock_documents();
            let doc = docs.get(&id).ok_or("Document not found")?;
            doc.pages().len()
        };

        let mut results = Vec::new();

        // Process page-by-page and release the lock between pages so viewport renders are never starved
        for page_idx in 0..num_pages {
            let docs = lock_documents();
            let Some(doc) = docs.get(&id) else {
                break;
            };
            if let Ok(page) = doc.pages().get(page_idx) {
                if let Ok(text) = page.text() {
                    let mut page_matches = Vec::new();
                    if let Ok(search) = text.search(&query, &PdfSearchOptions::default()) {
                        for match_item in
                            search.iter(pdfium_render::prelude::PdfSearchDirection::SearchForward)
                        {
                            for segment in match_item.iter() {
                                let bounds = segment.bounds();
                                page_matches.push(TextSegment {
                                    text: segment.text(),
                                    x: bounds.left().value,
                                    y: bounds.bottom().value,
                                    width: bounds.width().value,
                                    height: bounds.height().value,
                                });
                            }
                        }
                    }
                    if !page_matches.is_empty() {
                        results.push(SearchMatch {
                            page: page_idx as u16,
                            bounds: page_matches,
                        });
                    }
                }
            }
            drop(docs);
        }

        Ok(results)
    })
    .await
    .unwrap_or_else(|e| Err(format!("Task failed: {}", e)))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    pub(crate) fn shared_test_pdfium() -> MutexGuard<'static, Pdfium> {
        static TEST_PDFIUM: OnceLock<Mutex<Pdfium>> = OnceLock::new();
        let mutex = TEST_PDFIUM.get_or_init(|| {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("bin");
            let path_string = path.to_string_lossy().to_string();
            let bindings = Pdfium::bind_to_library(
                Pdfium::pdfium_platform_library_name_at_path(&path_string),
            )
            .expect("pdfium.dll must be available in src-tauri/bin");
            Mutex::new(Pdfium::new(bindings))
        });
        mutex.lock().unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn test_render_page_scale_validation() {
        tauri::async_runtime::block_on(async {
            // Non-finite scale (NaN) should be rejected
            let res_nan = pdf_render_page("non_existent".into(), 0, f32::NAN, 0).await;
            match res_nan {
                Err(e) => assert!(e.contains("Invalid scale factor")),
                Ok(_) => panic!("Expected error for NaN scale"),
            }

            // Negative scale should be rejected
            let res_neg = pdf_render_page("non_existent".into(), 0, -1.0, 0).await;
            match res_neg {
                Err(e) => assert!(e.contains("Invalid scale factor")),
                Ok(_) => panic!("Expected error for negative scale"),
            }

            // Excessively large scale (> 10.0) should be rejected
            let res_huge = pdf_render_page("non_existent".into(), 0, 100.0, 0).await;
            match res_huge {
                Err(e) => assert!(e.contains("Invalid scale factor")),
                Ok(_) => panic!("Expected error for oversized scale"),
            }
        });
    }

    #[test]
    fn render_preserves_rgb_channels_and_flattens_transparency() {
        let pdfium = shared_test_pdfium();
        let mut doc = pdfium.create_new_pdf().expect("create new pdf");
        let mut page = doc
            .pages_mut()
            .create_page_at_start(PdfPagePaperSize::Custom(
                PdfPoints::new(300.0),
                PdfPoints::new(300.0),
            ))
            .expect("create page");

        // Solid Red square on the left (x: 20..80, y: 180..240)
        page.objects_mut()
            .create_path_object_rect(
                PdfRect::new_from_values(180.0, 20.0, 240.0, 80.0),
                None,
                None,
                Some(PdfColor::new(255, 0, 0, 255)),
            )
            .expect("red rect");

        // Solid Blue square in the middle (x: 110..170, y: 180..240)
        page.objects_mut()
            .create_path_object_rect(
                PdfRect::new_from_values(180.0, 110.0, 240.0, 170.0),
                None,
                None,
                Some(PdfColor::new(0, 0, 255, 255)),
            )
            .expect("blue rect");

        // Semi-transparent Blue square on the right (x: 200..260, y: 180..240)
        page.objects_mut()
            .create_path_object_rect(
                PdfRect::new_from_values(180.0, 200.0, 240.0, 260.0),
                None,
                None,
                Some(PdfColor::new(0, 80, 255, 128)),
            )
            .expect("semi-transparent blue rect");

        // Regenerate content stream and re-load saved PDF so PDFium renders exact saved graphics
        let pdf_bytes = doc.save_to_bytes().expect("save test pdf");
        let loaded = pdfium
            .load_pdf_from_byte_vec(pdf_bytes, None)
            .expect("reload test pdf");
        let rendered_page = loaded.pages().get(0).expect("page 0");

        let config = build_page_render_config(1.0, 0);
        let bitmap = rendered_page
            .render_with_config(&config)
            .expect("render bitmap");
        let mut payload = copy_bitmap_to_payload(&bitmap);
        finalize_rgba_payload(&mut payload);

        let w = u32::from_le_bytes(payload[0..4].try_into().unwrap()) as usize;
        let h = u32::from_le_bytes(payload[4..8].try_into().unwrap()) as usize;
        assert_eq!((w, h), (300, 300));
        let pixels = &payload[8..];

        let pixel_at = |px: usize, py_from_top: usize| -> [u8; 4] {
            let idx = (py_from_top * w + px) * 4;
            [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
        };

        // PDF Y=180..240 on 300pt page maps to top-down Y=60..120
        let red = pixel_at(50, 90);
        assert_eq!(red, [255, 0, 0, 255], "Red square must stay pure Red in RGBA");

        let blue = pixel_at(140, 90);
        assert_eq!(blue, [0, 0, 255, 255], "Blue square must stay pure Blue in RGBA");

        let semi = pixel_at(230, 90);
        assert_eq!(semi[3], 255, "Semi-transparent graphic must have opaque white-composited alpha");
        assert!(
            semi[2] > 230 && semi[0] > 90 && semi[0] < 160,
            "Semi-transparent blue over white should blend cleanly without channel swap: got {semi:?}"
        );

        let bg = pixel_at(10, 10);
        assert_eq!(bg, [255, 255, 255, 255], "Background must be solid white");
    }
}
