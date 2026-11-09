# AuraPDF

A native Windows desktop PDF reader and library manager built with Tauri v2, React 19, Tailwind CSS v4, and a native Rust/PDFium rendering engine.

## Development & Testing Commands

- `pnpm dev` - Start Vite dev server on `http://localhost:8443`
- `pnpm build` - Compile frontend assets to `dist/`
- `pnpm typecheck` - Run TypeScript validation (`tsc --noEmit`)
- `pnpm test:rs` - Run Rust backend unit test suite (`cargo test`)
- `pnpm test:e2e` - Run Playwright automated end-to-end feature and interaction test suite
- `pnpm tauri build` - Build production release installer (`AuraPDF_0.1.0_x64-setup.exe`)

## Project Structure

- `src/main.tsx` - React entrypoint; mounts `src/App.tsx`
- `src/App.tsx` - Primary application shell, library views, dashboard, and tab orchestrator
- `src/components/reader/PdfReader.tsx` - Core PDF reader, virtualized pages, and annotation integration
- `src/components/reader/PageCard.tsx` - Virtualized page card rendering, text layer, and annotation overlay
- `src/components/reader/SvgAnnotationLayer.tsx` - Vector annotation layer (chisel highlights, pen ink, shapes, text, eraser)
- `src/components/reader/annotationGeometry.ts` - Math & geometry algorithms for smoothing, chisel highlighting, and eraser clipping
- `src/services/pdf/engine.ts` - Native PDF engine interface (PDFium IPC bridge, text layer, OCR, caching, browser fallback)
- `src/services/db/index.ts` - Local SQLite persistence (documents, folders, reader state, session tabs, vector annotations)
- `src-tauri/src/lib.rs` - Tauri desktop entrypoint, IPC command registration, single-instance listener
- `src-tauri/src/pdf.rs` - Native PDFium renderer, full-text search, bounds-checked rendering
- `src-tauri/src/ocr.rs` - WinRT OCR, adaptive integral-image normalization, connected components, and Tesseract engine
- `src-tauri/src/single_instance.rs` - Single-instance mutex and IPC argument handoff
- `src-tauri/src/win_assoc.rs` - Windows shell file association and Open With registration
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and `@` path alias
- `package.json` - Dependencies and build scripts

## Dependencies & Stack

- Frontend: React 19, Zustand 5, TanStack Virtual 3, Tailwind CSS v4
- Desktop Shell: Tauri v2 (`@tauri-apps/api`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`)
- Native Engine: Rust edition 2021, `pdfium-render` 0.9.4, Windows WinRT OCR (`windows` crate)

## Code Quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.

## Build & Release Rule

- With every prompt that modifies the codebase, automatically trigger `pnpm tauri build` to keep the installation executable (`src-tauri/target/release/bundle/nsis/AuraPDF_0.1.0_x64-setup.exe`) updated and ready for download/install.
