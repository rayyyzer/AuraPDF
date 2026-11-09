# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows Desktop (Tauri v2 + React 19)

## Users

Students, researchers, engineers, and avid readers on Windows who work daily with academic papers, handwritten lecture notes, technical manuals, and long-form PDFs. They open documents directly from Windows File Explorer or organize their ongoing reading inside a local library.

## Product Purpose

AuraPDF is a native Windows desktop PDF reader and library manager built with Tauri, React, and a Rust/PDFium rendering engine. It separates instant file opening (zero-friction reading from anywhere on disk) from deliberate library curation, while providing fast continuous scrolling, responsive page thumbnails, real-feel chisel highlighting, freehand ink, and local SQLite persistence.

## Positioning

A distraction-free editorial reading studio that pairs native Windows file-system integration (instant double-click launch, single-instance tab handoff, native drag-and-drop) with a warm, calm, high-craft interface inspired by Linear and Readwise Reader rather than bloated enterprise PDF suites.

## Operating Context

Used for long reading and study sessions across both daylight and low-light environments, often alongside code editors or note-taking apps, on mix-DPI laptops and desktop monitors. Documents include both born-digital typeset PDFs and scanned/handwritten notebook pages.

## Capabilities and Constraints

- Native Rust + PDFium backend (`src-tauri`) with progressive tile/bitmap rendering and custom text selection.
- Local SQLite database storing library documents, user folders, reading progress, session tabs, and per-page vector annotations.
- Fullscreen auto-hide chrome with edge-triggered reveal and native Windows fullscreen state synchronization.
- Five curated editorial studio themes across Light, Dark, and AMOLED modes.

## Brand Commitments

- **Clean Editorial Studio aesthetic:** Warm obsidian dark surfaces (`#0E0E0D`–`#161614`), warm alabaster paper light surfaces (`#F8F6F1`), and subtle champagne gold / warm ivory accents (`#D4AF6A` / `#EAE5DC`) instead of cold slate grays or neon purple.
- Typography pairs `Instrument Serif` for editorial accents with `Inter` for UI controls and `JetBrains Mono` for tabular page/zoom metrics.

## Product Principles

1. **The document leads; the chrome recedes.** Every toolbar, border, and surface exists to frame the PDF page calmly without competing for visual attention.
2. **Instantaneous native workflow.** Opening a file from Windows Explorer, `Ctrl+O`, or drag-and-drop is immediate and never forces library import.
3. **Tactile, honest tools.** Highlighter and pen annotations behave like real stationery ink on paper using multiply blending and smooth geometry.
4. **Warm precision over decoration.** Contrast, hairline borders, and warm tonal steps replace glowing halos, saturated card tints, and visual clutter.
