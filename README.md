<div align="center">

<img src="./app-icon.png" alt="AuraPDF Logo" width="108" height="108" style="border-radius: 24px; box-shadow: 0 12px 32px rgba(0,0,0,0.25);" />

# AuraPDF

**The high-performance, distraction-free native PDF studio for Windows.**

[![Release](https://img.shields.io/github/v/release/rayyyzer/AuraPDF?color=d4af6a&label=release&style=flat-square)](https://github.com/rayyyzer/AuraPDF/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B%20%7C%20x64-blue?style=flat-square)](https://github.com/rayyyzer/AuraPDF/releases/latest)
[![Backend](https://img.shields.io/badge/engine-Rust%20%2B%20PDFium-orange?style=flat-square)](https://pdfium.googlesource.com/pdfium/)
[![Frontend](https://img.shields.io/badge/ui-Tauri%20v2%20%2B%20React%2019-61dafb?style=flat-square)](https://tauri.app/)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Vendored-green?style=flat-square)](./THIRD_PARTY_NOTICES.md)

<p align="center">
  <a href="#quick-install">Download</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#shortcuts">Shortcuts</a> •
  <a href="#building-from-source">Build from Source</a>
</p>

---

</div>

<p align="center">
  <img src="./docs/images/dashboard-showcase.png" alt="AuraPDF Dashboard & Library" width="850" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.3);" />
</p>

## Why AuraPDF?

Enterprise PDF suites have become heavy, bloated, and subscription-gated. Web-based readers suffer from sluggish scrolling on 500-page papers and leak your documents to third-party clouds.

**AuraPDF** is engineered from first principles as an editorial reading and annotation environment:
- **100% Local & Private**: No telemetry, no accounts, no cloud dependencies. Your books, medical records, and research never leave your drive.
- **Bare-Metal Speed**: Google’s native **PDFium** C++ engine compiled with Rust bindings drives rendering through zero-copy shared memory.
- **Stationery-Grade Annotations**: Highlighters multiply naturally into page pixels; freehand ink uses cubic Bézier curves; annotations serialize into genuine PDF appearance streams readable in Adobe Acrobat, Apple Books, and Edge.
- **Hybrid Local OCR**: Scanned documents automatically corroborate text between the native **Windows.Media.Ocr** engine and bundled **Tesseract 5**.

---

## Features

### ⚡ Bare-Metal Native Rendering
* **Decoupled Scroll Pipeline**: Continuous reading navigation runs on a unidirectional scroll controller, completely free of React re-render lag.
* **Low-Latency Virtualization**: Only active viewport pages and adjacent lookaheads are kept in GPU memory. Jump 100 pages instantly without freezing the thread.
* **Multi-Tab Workspace**: Open dozens of heavy documents side-by-side with instantaneous tab switching and native drag-and-drop tab reordering.

<p align="center">
  <img src="./docs/images/reader-showcase.png" alt="AuraPDF Document View" width="850" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.3);" />
</p>

### ✍️ Tactile Vector Annotations
* **Chisel Highlighter & Freehand Pen**: Multiple line weights, opacity controls, and custom palettes.
* **Sticky Notes**: Pin expandable notes anywhere on the page canvas.
* **Vector Eraser**: Erase individual strokes without degrading underlying PDF typography.
* **Round-Trip PDF Export**: Annotations aren’t trapped in an app database—export a flattened or vector-annotated PDF that opens seamlessly in Adobe Acrobat, PDF-XChange, or macOS Preview.

<p align="center">
  <img src="./docs/images/annotations-showcase.png" alt="Annotation Options & Palette" width="420" style="border-radius: 8px;" />
  &nbsp;&nbsp;
  <img src="./docs/images/print-showcase.png" alt="Dedicated In-App Print Engine" width="420" style="border-radius: 8px;" />
</p>

### 🔍 Hybrid Local OCR
* Dual-engine OCR architecture compares native **Windows Media OCR** with bundled **Tesseract 5 (Leptonica)**.
* Extract, select, and copy text from scanned photocopies, vintage textbooks, and image-only slides with pixel-accurate bounding rects.

### 🖨️ Dedicated Print Engine
* Composites vector strokes, notes, and PDF pages into an off-screen print root.
* Custom page ranges (`1-5, 8, 11-13`) and live high-resolution print previews before handing off to the Windows spooler.

### 🎨 Editorial Studio Aesthetic
Crafted with typographic warmth inspired by modern editorial tools:
* **Dark Obsidian**: Deep warm black surfaces (`#0E0E0D`–`#161614`) that soften eye fatigue during late-night study sessions.
* **True AMOLED**: Pure `#000000` pitch backgrounds for OLED displays.
* **Alabaster Light**: Soft, warm paper tones (`#F8F6F1`) paired with subtle champagne ivory accents (`#D4AF6A`).

---

## Quick Install

Download the latest installer for Windows 10/11 (64-bit):

* **[Download Setup (.exe)](https://github.com/rayyyzer/AuraPDF/releases/latest/download/AuraPDF_1.0.0_x64-setup.exe)** — Standalone NSIS installer (~20 MB)
* **[Download Enterprise (.msi)](https://github.com/rayyyzer/AuraPDF/releases/latest/download/AuraPDF_1.0.0_x64_en-US.msi)** — WiX Windows Installer package (~27 MB)

> **Note on Windows SmartScreen**:  
> AuraPDF is currently unsigned. If you see *"Windows protected your PC"* on first launch, click **More info → Run anyway**.

---

## Shortcuts

| Key | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Open local PDF file |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Search in current document |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Open print studio |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close active tab |
| <kbd>V</kbd> | Cursor / Select text |
| <kbd>H</kbd> | Chisel Highlighter |
| <kbd>D</kbd> | Freehand Pen tool |
| <kbd>N</kbd> | Sticky Note |
| <kbd>E</kbd> | Eraser |
| <kbd>B</kbd> | Toggle Bookmark |
| <kbd>P</kbd> / <kbd>O</kbd> | Toggle Pages & Outline Drawer |
| <kbd>F</kbd> | Toggle Pro Reader (Distraction-Free Mode) |
| <kbd>Ctrl</kbd> + <kbd>1</kbd>–<kbd>4</kbd> | Switch Layout (Single, Two-Page, Continuous, Two-Page Continuous) |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>−</kbd> | Zoom in / Zoom out |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Fit page |
| Trackpad / Touchscreen Pinch | Fluid focal pinch-to-zoom |

---

## Architecture

```
AuraPDF Architecture
├── src/                          # Frontend (React 19, TypeScript, Tailwind CSS)
│   ├── components/reader/        # Virtualized ContinuousView, PageCard, SvgAnnotationLayer
│   ├── components/library/       # Library grid, search, collections, recent documents
│   ├── services/pdf/             # NativePdfEngine RPC, geometry transforms, selection assembly
│   └── stores/                   # Local state & annotation stores
│
├── src-tauri/                    # Native Backend (Rust, Tauri v2)
│   ├── src/pdf.rs                # PDFium FFI engine (renderPage, getPageMeta, text extraction)
│   ├── src/ocr.rs                # Dual OCR pipeline (WinRT OCR + Tesseract 5 / Leptonica)
│   ├── src/export.rs             # Vector annotation injection & PDF saving
│   ├── src/single_instance.rs    # Named-pipe IPC for Explorer file associations
│   └── bin/                      # Bundled runtime binaries (PDFium, Tesseract, MinGW DLLs)
```

---

## Building from Source

### Prerequisites
1. [Node.js](https://nodejs.org/) (v20+ recommended) & [pnpm](https://pnpm.io/) (`corepack enable pnpm`)
2. [Rust](https://rustup.rs/) (stable toolchain)
3. Windows 10/11 x64

### Steps
```powershell
# 1. Clone the repository
git clone https://github.com/rayyyzer/AuraPDF.git
cd AuraPDF

# 2. Install dependencies
pnpm install

# 3. Run development mode (hot-reloads both Vite & Tauri)
pnpm tauri dev

# 4. Run tests
pnpm typecheck
pnpm test:rs
pnpm test:selection
pnpm test:zoom

# 5. Build production installers
pnpm tauri build
```

The output installers will be placed under:
`src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.

---

## Licenses & Third-Party Notices

AuraPDF is open-source software. All bundled third-party libraries (PDFium, Tesseract OCR, Leptonica, MinGW runtime, and image codecs) are documented in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and mapped in [`src-tauri/bin/LICENSES/MANIFEST.md`](./src-tauri/bin/LICENSES/MANIFEST.md). Canonical license texts are included in all distribution packages.
