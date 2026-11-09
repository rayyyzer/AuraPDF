# Licence manifest for bundled binaries

Every file in this folder is shipped inside the AuraPDF installer. This manifest maps each
bundled binary to the upstream project and the licence file that covers it.

Paths are relative to `src-tauri/bin/`.

---

## Core engines

| Binary | Project | Licence file |
|---|---|---|
| `pdfium.dll` | [PDFium](https://pdfium.googlesource.com/pdfium/) | `PDFium-LICENSE.txt` (BSD-3-Clause + patent grant) |
| `tesseract.exe`, `libtesseract-5.dll` | [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) | `Apache-2.0.txt` and `../TESSERACT-LICENSE.txt` |
| `tessdata/eng.traineddata`, `tessdata/configs/tsv` | Tesseract language data | `Apache-2.0.txt` |
| `libleptonica-6.dll` | [Leptonica](http://www.leptonica.org/) | `BSD-2-Clause.txt` |

## C++ runtime (MinGW-w64)

These are the files that make the GPL runtime exception relevant.

| Binary | Project | Licence file |
|---|---|---|
| `libstdc++-6.dll` | GNU libstdc++ | `GPL-3.0.txt` + `GCC-Runtime-Exception-3.1.txt` |
| `libgcc_s_seh-1.dll` | GCC runtime support | `GPL-3.0.txt` + `GCC-Runtime-Exception-3.1.txt` |
| `libwinpthread-1.dll` | MinGW-w64 winpthreads | `GPL-3.0.txt` + `GCC-Runtime-Exception-3.1.txt` |

The GCC Runtime Library Exception is what permits distributing these inside a proprietary
application. Both the GPL text and the exception text must accompany the binaries; they are
adjacent here on purpose.

## Image codecs

| Binary | Project | Licence file |
|---|---|---|
| `libjpeg-8.dll` | libjpeg-turbo | `BSD-3-Clause.txt` |
| `libpng16-16.dll` | libpng | `BSD-3-Clause.txt` |
| `libtiff-6.dll` | libtiff | `BSD-2-Clause.txt` |
| `libwebp-7.dll`, `libwebpmux-3.dll`, `libsharpyuv-0.dll` | libwebp | `BSD-3-Clause.txt` |
| `libopenjp2-7.dll` | OpenJPEG | `BSD-2-Clause.txt` |
| `libgif-7.dll` | giflib | `MIT.txt` |
| `liblerc.dll` | LERC | `Apache-2.0.txt` |
| `libjbig-0.dll` | JBIG-KIT (jbigkit) | `GPL-2.0.txt` — see note |

**Note on `libjbig-0.dll`:** JBIG-KIT is distributed under the GPL-2.0 by its author, with a
separate commercial licence available. The GPL text is included here conservatively. If the
upstream MSYS2 package is found to carry a more permissive licence, replace this entry.

## Compression

| Binary | Project | Licence file |
|---|---|---|
| `zlib1.dll` | zlib | `Zlib.txt` |
| `libdeflate.dll` | libdeflate | `MIT.txt` |
| `libbz2-1.dll` | bzip2 | `BSD-2-Clause.txt` |
| `liblzma-5.dll` | XZ Utils | `Zlib.txt` (public-domain style) |
| `libzstd.dll` | Zstandard | `BSD-3-Clause.txt` |
| `liblz4.dll` | LZ4 | `BSD-2-Clause.txt` |
| `libb2-1.dll` | BLAKE2 | `MIT.txt` |

## Networking and archive

Present only because the MinGW Tesseract build links libcurl. Removing curl from the
Tesseract build removes this entire section — ten files, two LGPL libraries, and roughly
5 MB.

| Binary | Project | Licence file |
|---|---|---|
| `libcurl-4.dll` | curl | `MIT.txt` (curl licence) |
| `libssh2-1.dll` | libssh2 | `BSD-3-Clause.txt` |
| `libpsl-5.dll` | libpsl | `MIT.txt` |
| `libidn2-0.dll` | libidn2 | **`LGPL-3.0.txt`** |
| `libunistring-5.dll` | libunistring | **`LGPL-3.0.txt`** |
| `libbrotlicommon.dll`, `libbrotlidec.dll` | Brotli | `MIT.txt` |
| `libarchive-13.dll` | libarchive | `BSD-2-Clause.txt` |
| `libexpat-1.dll` | Expat | `MIT.txt` |
| `libiconv-2.dll` | libiconv | **`LGPL-2.1.txt`** |
| `libintl-8.dll` | GNU gettext | **`LGPL-2.1.txt`** |

### LGPL obligations

`libidn2`, `libunistring`, `libiconv` and `libintl` are LGPL. Shipping them as separate,
unmodified DLLs that the application merely links against is the standard arrangement and
does **not** require open-sourcing AuraPDF. It does require:

1. This licence text travels with the binaries (done — they are in this folder and the
   folder is bundled).
2. The library remains replaceable. It is: the DLLs sit next to the executable and are not
   statically linked.
3. Corresponding source is available for these library versions. Point users at the exact
   upstream release archives of the versions shipped.

---

## Not covered here

AuraPDF's own source is not covered by this folder. Handwriting recognition and
maths/formula recognition are not bundled.
