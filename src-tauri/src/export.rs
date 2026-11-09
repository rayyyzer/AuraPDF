//! Writes the reader's annotations into a real PDF file.
//!
//! The export always writes a *new* document loaded fresh from the source path, so the
//! open document is never mutated and exporting twice cannot duplicate annotations.
//!
//! Which mechanism is used depends on what PDFium actually exposes:
//!
//! * Markup (highlight/underline/strikeout) and text/note annotations are created as real
//!   PDF annotations, so other readers list them in their own annotation panels.
//! * Freehand ink and shapes are drawn into the page content, because `pdfium-render`
//!   0.9.4 can create an ink annotation but cannot add stroke objects to it, and has no
//!   ellipse annotation. Those marks are therefore flattened into the page.

use pdfium_render::prelude::*;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAnnotation {
    /// 1-based page number, matching how annotations are stored.
    pub page: u16,
    /// highlight | underline | strikethrough | pen | rect | ellipse | line | text | note
    pub kind: String,
    pub color: Option<String>,
    #[serde(default)]
    pub rects: Vec<[f32; 4]>,
    #[serde(default)]
    pub strokes: Vec<Vec<[f32; 2]>>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub stroke_width: Option<f32>,
}

fn parse_color(value: &Option<String>, fallback: PdfColor) -> PdfColor {
    value
        .as_deref()
        .and_then(|hex| PdfColor::from_hex(hex).ok())
        .unwrap_or(fallback)
}

/// `values` is `[x, y, width, height]` in PDF space (origin bottom-left, y up).
fn rect_from_values(values: &[f32; 4]) -> Option<PdfRect> {
    let [x, y, width, height] = *values;
    if !(width > 0.0) || !(height > 0.0) {
        return None;
    }
    Some(PdfRect::new_from_values(y, x, y + height, x + width))
}

/// Quad for a text rectangle in PDF quad-point order:
/// upper-left, upper-right, lower-left, lower-right.
fn quad_from_rect(values: &[f32; 4]) -> Option<PdfQuadPoints> {
    let [x, y, width, height] = *values;
    if !(width > 0.0) || !(height > 0.0) {
        return None;
    }
    Some(PdfQuadPoints::new(
        PdfPoints::new(x),
        PdfPoints::new(y + height),
        PdfPoints::new(x + width),
        PdfPoints::new(y + height),
        PdfPoints::new(x),
        PdfPoints::new(y),
        PdfPoints::new(x + width),
        PdfPoints::new(y),
    ))
}

fn configure_annotation<A: PdfPageAnnotationCommon>(
    annotation: &mut A,
    bounds: PdfRect,
    color: PdfColor,
    note: Option<&str>,
) -> Result<(), String> {
    annotation
        .set_bounds(bounds)
        .map_err(|error| format!("setting bounds failed: {error:?}"))?;
    annotation
        .set_fill_color(color)
        .map_err(|error| format!("setting colour failed: {error:?}"))?;
    annotation
        .set_is_printed(true)
        .map_err(|error| format!("marking printable failed: {error:?}"))?;
    if let Some(note) = note {
        let _ = annotation.set_contents(note);
    }
    Ok(())
}

type AnnotationResult = Result<bool, String>;

fn apply_markup(
    page: &mut PdfPage<'_>,
    kind: &str,
    annotation: &ExportAnnotation,
) -> AnnotationResult {
    let color = parse_color(&annotation.color, PdfColor::new(255, 235, 0, 255));
    let note = annotation.text.as_deref();
    let mut created = false;

    for values in &annotation.rects {
        let Some(bounds) = rect_from_values(values) else {
            continue;
        };
        let Some(quad) = quad_from_rect(values) else {
            continue;
        };

        let annotations = page.annotations_mut();
        // Each markup type is a distinct Rust type, so these branches cannot be unified
        // behind the shared annotation trait without losing `attachment_points_mut`.
        match kind {
            "underline" => {
                let mut item = annotations
                    .create_underline_annotation()
                    .map_err(|error| format!("underline annotation failed: {error:?}"))?;
                configure_annotation(&mut item, bounds, color, note)?;
                if item
                    .attachment_points_mut()
                    .create_attachment_point_at_end(quad)
                    .is_ok()
                {
                    created = true;
                }
            }
            "strikethrough" => {
                let mut item = annotations
                    .create_strikeout_annotation()
                    .map_err(|error| format!("strikeout annotation failed: {error:?}"))?;
                configure_annotation(&mut item, bounds, color, note)?;
                if item
                    .attachment_points_mut()
                    .create_attachment_point_at_end(quad)
                    .is_ok()
                {
                    created = true;
                }
            }
            _ => {
                let mut item = annotations
                    .create_highlight_annotation()
                    .map_err(|error| format!("highlight annotation failed: {error:?}"))?;
                configure_annotation(&mut item, bounds, color, note)?;
                if item
                    .attachment_points_mut()
                    .create_attachment_point_at_end(quad)
                    .is_ok()
                {
                    created = true;
                }
            }
        }
    }

    Ok(created)
}

fn apply_text_block(page: &mut PdfPage<'_>, annotation: &ExportAnnotation) -> AnnotationResult {
    let text = annotation.text.clone().unwrap_or_default();
    if text.trim().is_empty() {
        return Ok(false);
    }
    let Some(bounds) = annotation.rects.first().and_then(rect_from_values) else {
        return Ok(false);
    };
    let color = parse_color(&annotation.color, PdfColor::new(255, 235, 0, 255));

    let annotations = page.annotations_mut();
    let mut created = annotations
        .create_free_text_annotation(&text)
        .map_err(|error| format!("text annotation failed: {error:?}"))?;
    created
        .set_bounds(bounds)
        .map_err(|error| format!("setting text bounds failed: {error:?}"))?;
    created
        .set_is_printed(true)
        .map_err(|error| format!("marking text printable failed: {error:?}"))?;
    let _ = created.set_stroke_color(color);
    Ok(true)
}

fn apply_note(page: &mut PdfPage<'_>, annotation: &ExportAnnotation) -> AnnotationResult {
    let text = annotation.text.clone().unwrap_or_default();
    let Some(bounds) = annotation.rects.first().and_then(rect_from_values) else {
        return Ok(false);
    };
    let color = parse_color(&annotation.color, PdfColor::new(255, 235, 0, 255));

    let annotations = page.annotations_mut();
    let mut created = annotations
        .create_text_annotation(&text)
        .map_err(|error| format!("note annotation failed: {error:?}"))?;
    created
        .set_bounds(bounds)
        .map_err(|error| format!("setting note bounds failed: {error:?}"))?;
    created
        .set_is_printed(true)
        .map_err(|error| format!("marking note printable failed: {error:?}"))?;
    let _ = created.set_fill_color(color);
    Ok(true)
}

/// Draws freehand strokes and shapes into the page content.
///
/// `create_path_object_*` adds the object to the page itself, so the returned object must
/// not be added a second time.
fn apply_flattened(page: &mut PdfPage<'_>, annotation: &ExportAnnotation) -> AnnotationResult {
    let color = parse_color(&annotation.color, PdfColor::new(30, 30, 30, 255));
    let width = PdfPoints::new(annotation.stroke_width.unwrap_or(1.5).max(0.2));
    let mut created = false;
    let objects = page.objects_mut();

    match annotation.kind.as_str() {
        "pen" | "line" => {
            for stroke in &annotation.strokes {
                for pair in stroke.windows(2) {
                    let (from, to) = (pair[0], pair[1]);
                    if objects
                        .create_path_object_line(
                            PdfPoints::new(from[0]),
                            PdfPoints::new(from[1]),
                            PdfPoints::new(to[0]),
                            PdfPoints::new(to[1]),
                            color,
                            width,
                        )
                        .is_ok()
                    {
                        created = true;
                    }
                }
            }
        }
        "rect" | "ellipse" => {
            for values in &annotation.rects {
                let Some(bounds) = rect_from_values(values) else {
                    continue;
                };
                let object = if annotation.kind == "ellipse" {
                    objects.create_path_object_ellipse(bounds, Some(color), Some(width), None)
                } else {
                    objects.create_path_object_rect(bounds, Some(color), Some(width), None)
                };
                if object.is_ok() {
                    created = true;
                }
            }
        }
        _ => {}
    }

    Ok(created)
}

/// Applies every annotation, returning how many were written.
pub fn apply_annotations(
    document: &mut PdfDocument<'_>,
    annotations: &[ExportAnnotation],
) -> Result<usize, String> {
    let page_count = document.pages().len() as u16;
    let mut applied = 0usize;

    for annotation in annotations {
        if annotation.page == 0 || annotation.page > page_count {
            continue;
        }
        let mut page = document
            .pages()
            .get(PdfPageIndex::from(annotation.page as i32 - 1))
            .map_err(|error| format!("page {} is unavailable: {error:?}", annotation.page))?;

        let result = match annotation.kind.as_str() {
            "highlight" | "underline" | "strikethrough" => {
                apply_markup(&mut page, &annotation.kind, annotation)
            }
            "text" => apply_text_block(&mut page, annotation),
            "note" => apply_note(&mut page, annotation),
            "pen" | "rect" | "ellipse" | "line" => apply_flattened(&mut page, annotation),
            other => {
                log::warn!("[EXPORT] Skipping unsupported annotation kind '{other}'");
                Ok(false)
            }
        };

        match result {
            Ok(true) => applied += 1,
            Ok(false) => {}
            Err(error) => {
                // One bad annotation must not abort the whole export.
                log::warn!("[EXPORT] Annotation skipped: {error}");
            }
        }
    }

    Ok(applied)
}

#[tauri::command]
pub async fn pdf_export_annotated(
    app: tauri::AppHandle,
    source_path: String,
    destination: String,
    annotations: Vec<ExportAnnotation>,
) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if source_path.eq_ignore_ascii_case(&destination) {
            return Err(
                "Choose a different file name: the original document is never overwritten."
                    .to_string(),
            );
        }

        let source =
            crate::launch::normalize_windows_path_string(std::path::Path::new(&source_path));
        let pdfium = crate::pdf::pdfium_handle(&app)?;

        // Load a private copy so the document open in the reader is untouched and repeated
        // exports always start from the original.
        let mut document = pdfium.load_pdf_from_file(&source, None).or_else(|_| {
            let bytes = std::fs::read(&source)
                .map_err(|error| format!("could not read '{source}': {error}"))?;
            pdfium
                .load_pdf_from_byte_vec(bytes, None)
                .map_err(|error| format!("could not open '{source}': {error:?}"))
        })?;

        let applied = apply_annotations(&mut document, &annotations)?;
        document
            .save_to_file(&destination)
            .map_err(|error| format!("could not write '{destination}': {error:?}"))?;

        log::info!("[EXPORT] Wrote {applied} annotation(s) to {destination}");
        Ok(applied)
    })
    .await
    .unwrap_or_else(|error| Err(format!("Task failed: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a minimal single-page PDF with a correct cross-reference table, so the test
    /// needs no committed binary fixture.
    fn minimal_pdf() -> Vec<u8> {
        // A filled black rectangle gives the page real content, so a render can be proven to
        // produce pixels rather than a blank buffer.
        let content = "0 0 0 rg 100 100 300 200 re f";
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>"
            ),
            format!(
                "<< /Length {} >>\nstream\n{}\nendstream",
                content.len(),
                content
            ),
        ];

        let mut out = String::from("%PDF-1.4\n");
        let mut offsets = Vec::new();
        for (index, body) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.push_str(&format!("{} 0 obj\n{}\nendobj\n", index + 1, body));
        }
        let xref_offset = out.len();
        out.push_str(&format!("xref\n0 {}\n", objects.len() + 1));
        out.push_str("0000000000 65535 f \n");
        for offset in &offsets {
            out.push_str(&format!("{offset:010} 00000 n \n"));
        }
        out.push_str(&format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
            objects.len() + 1
        ));
        out.into_bytes()
    }

    fn test_pdfium() -> Pdfium {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("bin");
        let path_string = path.to_string_lossy().to_string();
        let bindings = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(
            &path_string,
        ))
        .expect("pdfium.dll must be available in src-tauri/bin");
        Pdfium::new(bindings)
    }

    fn sample_annotations() -> Vec<ExportAnnotation> {
        vec![
            ExportAnnotation {
                page: 1,
                kind: "highlight".to_string(),
                color: Some("#ffe700".to_string()),
                rects: vec![[72.0, 700.0, 200.0, 14.0]],
                strokes: vec![],
                text: None,
                stroke_width: None,
            },
            ExportAnnotation {
                page: 1,
                kind: "pen".to_string(),
                color: Some("#ff0000".to_string()),
                rects: vec![],
                strokes: vec![vec![[100.0, 100.0], [120.0, 140.0], [160.0, 120.0]]],
                text: None,
                stroke_width: Some(2.0),
            },
            ExportAnnotation {
                page: 1,
                kind: "rect".to_string(),
                color: Some("#00ff00".to_string()),
                rects: vec![[200.0, 200.0, 80.0, 40.0]],
                strokes: vec![],
                text: None,
                stroke_width: Some(1.5),
            },
            ExportAnnotation {
                page: 1,
                kind: "text".to_string(),
                color: None,
                rects: vec![[72.0, 600.0, 220.0, 40.0]],
                strokes: vec![],
                text: Some("Reviewed".to_string()),
                stroke_width: None,
            },
        ]
    }

    #[test]
    fn exported_pdf_keeps_its_annotations() {
        let pdfium = test_pdfium();
        let mut document = pdfium
            .load_pdf_from_byte_vec(minimal_pdf(), None)
            .expect("fixture PDF should load");

        let applied =
            apply_annotations(&mut document, &sample_annotations()).expect("should apply");
        assert_eq!(applied, 4, "every annotation kind should be written");

        let saved = document.save_to_bytes().expect("save should succeed");
        assert!(saved.starts_with(b"%PDF"), "output must be a PDF");

        // Round-trip: the saved file must still contain the markup annotations.
        let reloaded = pdfium
            .load_pdf_from_byte_vec(saved, None)
            .expect("saved PDF should reload");
        let page = reloaded.pages().get(0).expect("page should exist");
        let annotations = page.annotations();
        assert!(
            annotations
                .iter()
                .any(|annotation| annotation.annotation_type() == PdfPageAnnotationType::Highlight),
            "highlight annotation missing from the saved file"
        );
        assert!(
            annotations
                .iter()
                .any(|annotation| annotation.annotation_type() == PdfPageAnnotationType::FreeText),
            "free text annotation missing from the saved file"
        );
    }

    #[test]
    fn export_skips_out_of_range_pages_instead_of_failing() {
        let pdfium = test_pdfium();
        let mut document = pdfium
            .load_pdf_from_byte_vec(minimal_pdf(), None)
            .expect("fixture PDF should load");

        let mut annotations = sample_annotations();
        annotations.push(ExportAnnotation {
            page: 99,
            kind: "highlight".to_string(),
            color: None,
            rects: vec![[10.0, 10.0, 5.0, 5.0]],
            strokes: vec![],
            text: None,
            stroke_width: None,
        });

        let applied = apply_annotations(&mut document, &annotations).expect("should not fail");
        assert_eq!(applied, 4);
    }

    /// The only test that exercises actual PDFium rendering. Without it, every other test
    /// would still pass if rendering were completely broken.
    #[test]
    fn page_renders_pixels_and_survives_export() {
        let pdfium = test_pdfium();
        let mut document = pdfium
            .load_pdf_from_byte_vec(minimal_pdf(), None)
            .expect("fixture PDF should load");

        let config = PdfRenderConfig::new().scale_page_by_factor(1.0);
        // The bitmap borrows the page, so the measurements are taken inside the block.
        let (rendered_width, rendered_height, dark_pixels) = {
            let page = document.pages().get(0).expect("page should exist");
            let bitmap = page
                .render_with_config(&config)
                .expect("page should render");
            let dark = bitmap
                .as_raw_bytes()
                .chunks_exact(4)
                .filter(|pixel| pixel[0] < 64 && pixel[1] < 64 && pixel[2] < 64)
                .count();
            (bitmap.width(), bitmap.height(), dark)
        };
        assert!(rendered_width > 0 && rendered_height > 0);
        assert!(
            dark_pixels > 1000,
            "expected the black rectangle to render, found {dark_pixels} dark pixels"
        );

        apply_annotations(&mut document, &sample_annotations()).expect("should apply");
        let saved = document.save_to_bytes().expect("save should succeed");

        let reloaded = pdfium
            .load_pdf_from_byte_vec(saved, None)
            .expect("saved PDF should reload");
        let page = reloaded.pages().get(0).expect("page should exist");
        let re_rendered = page
            .render_with_config(&config)
            .expect("exported page should render");
        assert_eq!(re_rendered.width(), rendered_width);
        assert!(
            !page.annotations().is_empty(),
            "exported file lost its annotations"
        );
    }

    #[test]
    fn zero_sized_rectangles_are_ignored() {
        let pdfium = test_pdfium();
        let mut document = pdfium
            .load_pdf_from_byte_vec(minimal_pdf(), None)
            .expect("fixture PDF should load");

        let applied = apply_annotations(
            &mut document,
            &[ExportAnnotation {
                page: 1,
                kind: "highlight".to_string(),
                color: None,
                rects: vec![[10.0, 10.0, 0.0, 0.0]],
                strokes: vec![],
                text: None,
                stroke_width: None,
            }],
        )
        .expect("should not fail");
        assert_eq!(applied, 0);
    }
}
