# Third-party components bundled with AuraPDF

AuraPDF ships two native runtimes under `src-tauri/bin/`, copied verbatim into the
installer. Nothing is patched or recompiled.

This file is an **inventory**. It states what is shipped and which upstream project each
file belongs to.

**Licence texts are bundled** at `src-tauri/bin/LICENSES/`, which ships inside the installer.
The authoritative per-binary mapping is `src-tauri/bin/LICENSES/MANIFEST.md` — read that one
if you only read one file.

---

## 1. PDFium — `pdfium.dll` (7.0 MB)

PDF rendering, text extraction and annotation writing.

- Upstream: https://pdfium.googlesource.com/pdfium/
- Licence: **BSD-3-Clause**, plus the additional patent grant in the project's `LICENSE`.
- Bundled licence text: `src-tauri/bin/LICENSES/PDFium-LICENSE.txt`

## 2. Tesseract OCR — `tesseract.exe`, `libtesseract-5.dll`

Second OCR engine, used alongside `Windows.Media.Ocr`.

- Upstream: https://github.com/tesseract-ocr/tesseract
- Licence: **Apache-2.0**
- Bundled licence text: `src-tauri/bin/TESSERACT-LICENSE.txt`
- Contributor list: `src-tauri/bin/TESSERACT-AUTHORS.txt`
- Language data: `tessdata/eng.traineddata` and `tessdata/configs/tsv`, both from the
  Tesseract project under the same Apache-2.0 terms.

## 3. Leptonica — `libleptonica-6.dll` (2.7 MB)

Image processing used by Tesseract.

- Upstream: http://www.leptonica.org/
- Licence: **BSD-2-Clause**

## 4. GCC runtime — `libstdc++-6.dll`, `libgcc_s_seh-1.dll`, `libwinpthread-1.dll`

MinGW-w64 C++ runtime required by the MinGW build of Tesseract. `libstdc++-6.dll` alone is
**26 MB — the single largest file in the installer.**

- Upstream: https://gcc.gnu.org/ + MinGW-w64
- Licence: **GPL-3.0-or-later WITH the GCC Runtime Library Exception**. The exception is
  what permits redistribution inside a proprietary application; the GPL notice and a copy
  of the licence must accompany the binary.

## 5. Image codecs

| File | Project | Typical licence |
|---|---|---|
| `libjpeg-8.dll` | libjpeg-turbo | BSD-3-Clause / IJG |
| `libpng16-16.dll` | libpng | libpng-2.0 |
| `libtiff-6.dll` | libtiff | libtiff (BSD-like) |
| `libwebp-7.dll`, `libwebpmux-3.dll`, `libsharpyuv-0.dll` | libwebp | BSD-3-Clause |
| `libopenjp2-7.dll` | OpenJPEG | BSD-2-Clause |
| `libgif-7.dll` | giflib | MIT |
| `libjbig-0.dll` | jbigkit | GPL-2.0+ (verify) |
| `liblerc.dll` | LERC | Apache-2.0 |

## 6. Compression

| File | Project | Typical licence |
|---|---|---|
| `zlib1.dll` | zlib | Zlib |
| `libdeflate.dll` | libdeflate | MIT |
| `libbz2-1.dll` | bzip2 | BSD-like |
| `liblzma-5.dll` | XZ Utils | Public domain / 0BSD |
| `libzstd.dll` | Zstandard | BSD-3-Clause |
| `liblz4.dll` | LZ4 | BSD-2-Clause |
| `libb2-1.dll` | BLAKE2 | CC0 / Apache-2.0 |

## 7. Networking and archive (pulled in by `libcurl`, used by Tesseract only)

| File | Project | Typical licence |
|---|---|---|
| `libcurl-4.dll` | curl | curl (MIT-like) |
| `libssh2-1.dll` | libssh2 | BSD-3-Clause |
| `libpsl-5.dll` | libpsl | MIT |
| `libidn2-0.dll` | libidn2 | LGPL-3.0+ |
| `libunistring-5.dll` | libunistring | LGPL-3.0+ |
| `libbrotlicommon.dll`, `libbrotlidec.dll` | Brotli | MIT |
| `libarchive-13.dll` | libarchive | BSD-2-Clause |
| `libexpat-1.dll` | Expat | MIT |
| `libiconv-2.dll` | libiconv | LGPL-2.1+ |
| `libintl-8.dll` | gettext | LGPL-2.1+ |

Note: `libidn2`, `libunistring`, `libiconv` and `libintl` are **LGPL**. Redistributing them
as separate DLLs is the standard, permissible arrangement, but each requires its licence
text and a written offer of corresponding source to be shipped alongside.

---

## Release status

**Licence texts: bundled.** All texts ship inside the installer under `bin/LICENSES/`.

Two items remain open, and both are notes rather than blockers for a beta:

1. **`libjbig-0.dll`** — recorded conservatively as GPL-2.0 because that is JBIG-KIT's
   licence; confirm against the MSYS2 package metadata.
2. **LGPL corresponding source** — `libidn2`, `libunistring`, `libiconv` and `libintl`
   require users to be able to obtain the source for the exact versions shipped. Link to
   the matching upstream release archives on the download page.

Cheapest way to shrink this surface: the networking stack (`libcurl`, `libssh2`, `libpsl`,
`libidn2`, `libunistring`, `libbrotli`, `libarchive`) exists only because the MinGW Tesseract
build links curl for URL-based language downloads. A Tesseract build without curl removes
ten files, both LGPL-3.0 libraries and roughly 5 MB.

## Not bundled

Handwriting and maths/formula recognition are not provided. The app reports unreadable
regions to the backend instead of guessing at them.
