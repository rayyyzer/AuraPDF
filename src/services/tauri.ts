import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

export interface LocalPdfSelection {
  path: string
  size: number
  name: string
  data?: Uint8Array
}

export interface ValidatedPdfFile {
  path: string
  name: string
  size: number
  modifiedAt?: number | null
}

export type LaunchQueueItem = { status: "valid" } & ValidatedPdfFile | {
  status: "invalid"
  path: string
  error: string
}

export function isTauriContext() {
  return (
    typeof window !== "undefined" &&
    ((window as any).__TAURI_INTERNALS__ !== undefined ||
      (window as any).__TAURI__ !== undefined)
  )
}

export async function getFileSize(path: string): Promise<number | null> {
  const version = await getFileVersion(path)
  return version?.size ?? null
}

export interface FileVersion {
  size: number
  modifiedAt: number | null
}

export async function getFileVersion(path: string): Promise<FileVersion | null> {
  if (!isTauriContext()) return null
  try {
    const info = await invoke<ValidatedPdfFile>("pdf_inspect_path", { path })
    return {
      size: info.size,
      modifiedAt: info.modifiedAt ?? null,
    }
  } catch {
    return null
  }
}

export async function inspectPdfPath(path: string): Promise<ValidatedPdfFile> {
  if (!isTauriContext()) {
    const name = path.split(/[\\/]/).pop() || "Document.pdf"
    return { path, name, size: 0 }
  }
  return invoke<ValidatedPdfFile>("pdf_inspect_path", { path })
}

export async function takeLaunchQueue(): Promise<LaunchQueueItem[]> {
  if (!isTauriContext()) return []
  try {
    return await invoke<LaunchQueueItem[]>("pdf_take_launch_queue")
  } catch (e) {
    console.warn("[LAUNCH] Failed to read launch queue:", e)
    return []
  }
}

export async function registerWindowsFileAssociation(): Promise<void> {
  if (!isTauriContext()) return
  await invoke("pdf_register_file_association")
}

export async function openWindowsDefaultAppsSettings(): Promise<void> {
  if (!isTauriContext()) return
  await invoke("pdf_open_default_apps_settings")
}

function normalizeSingleSelection(
  value: string | string[] | null | undefined,
): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

function normalizeMultiSelection(
  value: string | string[] | null | undefined,
): string[] {
  if (!value) return []
  if (typeof value === "string") return [value]
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export async function resolvePdfPaths(
  paths: string[],
): Promise<LocalPdfSelection[]> {
  const results: LocalPdfSelection[] = []
  for (const rawPath of paths) {
    if (!rawPath) continue
    if (isTauriContext()) {
      try {
        const validated = await inspectPdfPath(rawPath)
        results.push({
          path: validated.path,
          size: validated.size,
          name: validated.name,
        })
        continue
      } catch {
        // Fallback if inspect fails
      }
    }
    if (rawPath.toLowerCase().endsWith(".pdf")) {
      const size = (await getFileSize(rawPath)) ?? 0
      const name = rawPath.split(/[\\/]/).pop() || "Unknown Document"
      results.push({ path: rawPath, size, name })
    }
  }
  return results
}

export async function validateAndResolvePaths(
  paths: string[],
): Promise<{
  valid: LocalPdfSelection[]
  invalid: { path: string; error: string }[]
}> {
  const valid: LocalPdfSelection[] = []
  const invalid: { path: string; error: string }[] = []

  for (const rawPath of paths) {
    if (!rawPath) continue
    if (isTauriContext()) {
      try {
        const v = await inspectPdfPath(rawPath)
        valid.push({ path: v.path, size: v.size, name: v.name })
      } catch (err) {
        invalid.push({
          path: rawPath,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else if (rawPath.toLowerCase().endsWith(".pdf")) {
      const name = rawPath.split(/[\\/]/).pop() || "Document.pdf"
      valid.push({ path: rawPath, size: 0, name })
    } else {
      invalid.push({
        path: rawPath,
        error: "Unsupported file format (expected .pdf)",
      })
    }
  }

  return { valid, invalid }
}

export async function openLocalPdf(): Promise<LocalPdfSelection | null> {
  if (!isTauriContext()) {
    return new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".pdf"
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return resolve(null)
        const buf = await file.arrayBuffer()
        resolve({
          path: URL.createObjectURL(file),
          size: file.size,
          data: new Uint8Array(buf),
          name: file.name,
        })
      }

      input.click()
    })
  }

  const selected = await open({
    multiple: false,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  })

  const normalized = normalizeSingleSelection(selected)
  if (!normalized) {
    return null
  }

  try {
    const validated = await inspectPdfPath(normalized)
    return {
      path: validated.path,
      size: validated.size,
      name: validated.name,
    }
  } catch {
    const size = (await getFileSize(normalized)) ?? 0
    const name = normalized.split(/[\\/]/).pop() || "Unknown Document"
    return { path: normalized, size, name }
  }
}

export async function openLocalPdfs(): Promise<LocalPdfSelection[]> {
  if (!isTauriContext()) {
    return new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".pdf"
      input.multiple = true
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || [])
        resolve(
          await Promise.all(
            files.map(async (file) => ({
              path: URL.createObjectURL(file),
              size: file.size,
              data: new Uint8Array(await file.arrayBuffer()),
              name: file.name,
            })),
          ),
        )
      }
      input.click()
    })
  }

  const selected = await open({
    multiple: true,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  })
  const paths = normalizeMultiSelection(selected)
  return resolvePdfPaths(paths)
}
