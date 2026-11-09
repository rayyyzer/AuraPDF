import type { Doc } from "../../types"
import { normalizeDocumentPath } from "../db"
import { NativePdfEngine } from "./engine"

export interface PickedPdf {
  path: string
  size?: number
  data?: Uint8Array
  name: string
}

export interface PdfImportFailure {
  file: PickedPdf
  error: unknown
}

export interface PdfImportResult {
  imported: Doc[]
  failures: PdfImportFailure[]
  skipped: PickedPdf[]
}

export interface PdfDirectOpenResult {
  opened: Doc[]
  failures: PdfImportFailure[]
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function findExistingDocument(path: string, docs: Doc[]): Doc | undefined {
  const target = normalizeDocumentPath(path).toLowerCase()
  return docs.find(
    (doc) =>
      normalizeDocumentPath(doc.path || doc.id).toLowerCase() === target ||
      normalizeDocumentPath(doc.id).toLowerCase() === target,
  )
}

async function extractFirstPageExcerpt(docId: string): Promise<string> {
  let excerpt = "Local document loaded from file system"
  try {
    const firstPageSegments = await NativePdfEngine.getTextLayer(docId, 0)
    const text = firstPageSegments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (text.length > 0) {
      excerpt = text.slice(0, 280)
    }
  } catch {
    // Fallback to default excerpt if text layer extraction fails
  }
  return excerpt
}

/**
 * Workflow A: Open Document Directly
 * Opens PDFs directly from their original filesystem path without requiring Library import.
 * Preserves existing annotations, reading progress, and Library status if a record already exists.
 */
export async function openPdfFilesDirect(
  files: PickedPdf[],
  existingDocuments: Doc[],
): Promise<PdfDirectOpenResult> {
  const opened: Doc[] = []
  const failures: PdfImportFailure[] = []
  const seenKeys = new Set<string>()

  for (const file of files) {
    const cleanPath = normalizeDocumentPath(file.path)
    const key = cleanPath.toLowerCase()
    if (seenKeys.has(key)) continue

    try {
      const existing = findExistingDocument(cleanPath, existingDocuments)
      const docId = existing ? existing.id : cleanPath
      const pdfDoc = await NativePdfEngine.openDocument(docId, cleanPath)
      const now = new Date().toISOString()
      const byteSize = file.size ?? file.data?.length ?? 0

      if (existing) {
        opened.push({
          ...existing,
          pages: pdfDoc.num_pages || existing.pages,
          size: byteSize > 0 ? String(byteSize) : existing.size,
          lastOpened: now,
          path: cleanPath,
          inLibrary: existing.inLibrary ?? true,
        })
      } else {
        const excerpt = await extractFirstPageExcerpt(docId)
        opened.push({
          id: cleanPath,
          name: file.name,
          pages: pdfDoc.num_pages,
          size: String(byteSize),
          lastOpened: now,
          created: now,
          favorite: false,
          folder: "",
          tags: [],
          color: "var(--primary)",
          excerpt,
          path: cleanPath,
          inLibrary: false,
        })
      }

      seenKeys.add(key)
    } catch (error) {
      console.error(`[PDF OPEN] Failed to open ${file.name}`, {
        path: file.path,
        error: errorMessage(error),
      })
      failures.push({ file, error })
    }
  }

  return { opened, failures }
}

/**
 * Workflow B: Add to Library
 * Explicitly imports PDFs into AuraPDF's persistent Library.
 * Promotes any previously opened transient document (`inLibrary === false`) to `inLibrary: true`
 * without creating duplicate database records.
 */
export async function importPdfFiles(
  files: PickedPdf[],
  existingDocuments: Doc[],
  options?: { folderId?: string; folderName?: string; favorite?: boolean },
): Promise<PdfImportResult> {
  const imported: Doc[] = []
  const failures: PdfImportFailure[] = []
  const skipped: PickedPdf[] = []
  const seenKeys = new Set<string>()

  for (const file of files) {
    const cleanPath = normalizeDocumentPath(file.path)
    const key = cleanPath.toLowerCase()
    if (seenKeys.has(key)) {
      skipped.push(file)
      continue
    }

    const existing = findExistingDocument(cleanPath, existingDocuments)
    if (existing && existing.inLibrary !== false) {
      skipped.push({ ...file, path: existing.path || existing.id })
      seenKeys.add(key)
      continue
    }

    try {
      const docId = existing ? existing.id : cleanPath
      const pdfDoc = await NativePdfEngine.openDocument(docId, cleanPath)
      const excerpt =
        existing?.excerpt || (await extractFirstPageExcerpt(docId))
      const now = new Date().toISOString()
      const byteSize = file.size ?? file.data?.length ?? 0

      imported.push({
        id: docId,
        name: existing?.name || file.name,
        pages: pdfDoc.num_pages,
        size: byteSize > 0 ? String(byteSize) : existing?.size || "0",
        lastOpened: now,
        created: existing?.created || now,
        favorite:
          options?.favorite !== undefined
            ? options.favorite
            : (existing?.favorite ?? false),
        folder: options?.folderName || existing?.folder || "Local",
        folderId: options?.folderId ?? existing?.folderId,
        tags: existing?.tags ?? [],
        color: existing?.color || "var(--primary)",
        excerpt,
        path: cleanPath,
        inLibrary: true,
      })
      seenKeys.add(key)
    } catch (error) {
      console.error(`[PDF IMPORT] Failed to import ${file.name}`, {
        path: file.path,
        error: errorMessage(error),
        errorObject: error,
      })
      failures.push({ file, error })
    }
  }

  return { imported, failures, skipped }
}

export function formatPdfImportFailure(error: unknown): string {
  return errorMessage(error)
}
