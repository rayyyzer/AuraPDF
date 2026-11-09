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

        let render_config = PdfRenderConfig::new()
            .scale_page_by_factor(scale)
            .set_clear_color(PdfColor::WHITE);

        let config_with_rot = match rotation {
            90 => render_config.rotate(PdfPageRenderRotation::Degrees90, true),
            180 => render_config.rotate(PdfPageRenderRotation::Degrees180, true),
            270 => render_config.rotate(PdfPageRenderRotation::Degrees270, true),
            _ => render_config,
        };

        let t_pre_render = std::time::Instant::now();
        let bitmap = page
            .render_with_config(&config_with_rot)
            .map_err(|e| e.to_string())?;
        let t_render = t_pre_render.elapsed();

        let t_pre_conv = std::time::Instant::now();
        let bmp_width = bitmap.width() as u32;
        let bmp_height = bitmap.height() as u32;

        // Single-allocation zero-copy output buffer
        let raw = bitmap.as_raw_bytes();
        let raw_len = raw.len();
        let mut bytes = vec![0u8; 8 + raw_len];
        bytes[0..4].copy_from_slice(&bmp_width.to_le_bytes());
        bytes[4..8].copy_from_slice(&bmp_height.to_le_bytes());
        bytes[8..].copy_from_slice(&raw);

        // Drop the PDFium lock immediately so other threads can render concurrently
        drop(docs);

        // Swizzle BGRA to RGBA in-place inside output buffer
        for chunk in bytes[8..].chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }
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
mod tests {
    use super::*;

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
}
