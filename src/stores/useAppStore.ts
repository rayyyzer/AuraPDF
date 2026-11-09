import { create } from "zustand"
import type { View, ThemeMode, ColorTheme, Doc } from "../types"
import { COLOR_THEMES } from "../theme"
import { db } from "../services/db"
import { getFileSize, isTauriContext } from "../services/tauri"

function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem("aura:themeMode")
    if (v === "light" || v === "dark" || v === "system") return v
  } catch {}
  return "dark"
}

function loadColorTheme(): ColorTheme {
  try {
    const v = localStorage.getItem("aura:colorTheme")
    if (v && v in COLOR_THEMES) return v as ColorTheme
  } catch {}
  return "moon"
}

function loadBooleanSetting(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === "true") return true
    if (v === "false") return false
  } catch {}
  return defaultValue
}

interface AppState {
  view: View
  collapsed: boolean
  themeMode: ThemeMode
  colorTheme: ColorTheme
  amoled: boolean
  reopenLastSession: boolean
  confirmBeforeDeleting: boolean
  reduceMotion: boolean
  resumeToast: string | null
  documents: Doc[]
  folders: { id: string; name: string; created: string }[]
  setView: (view: View) => void
  setCollapsed: (collapsed: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  setColorTheme: (theme: ColorTheme) => void
  setAmoled: (amoled: boolean) => void
  setReopenLastSession: (reopen: boolean) => void
  setConfirmBeforeDeleting: (confirm: boolean) => void
  setReduceMotion: (reduce: boolean) => void
  setResumeToast: (toast: string | null) => void
  loadDocuments: () => Promise<void>
  saveDocument: (doc: Doc) => Promise<void>
  saveDocuments: (docs: Doc[]) => Promise<void>
  addDocumentToLibrary: (
    docId: string,
    options?: { folderId?: string; folderName?: string },
  ) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  createFolder: (id: string, name: string) => Promise<void>
  renameFolder: (id: string, newName: string, oldName: string) => Promise<void>
  deleteFolder: (id: string, name: string) => Promise<void>
  setDocumentFolder: (docId: string, folderId: string | null) => Promise<void>
  setDocumentsFolder: (
    docIds: string[],
    folderId: string | null,
  ) => Promise<void>
  toggleFavorite: (docId: string) => Promise<void>
  setDocumentsFavorite: (docIds: string[], favorite: boolean) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "dashboard",
  collapsed: false,
  themeMode: loadThemeMode(),
  colorTheme: loadColorTheme(),
  amoled: loadBooleanSetting("aura:amoled", false),
  reopenLastSession: loadBooleanSetting("aura:reopenLastSession", true),
  confirmBeforeDeleting: loadBooleanSetting("aura:confirmBeforeDeleting", true),
  reduceMotion: loadBooleanSetting("aura:reduceMotion", false),
  resumeToast: null,
  documents: [],
  folders: [],
  setView: (view) => set({ view }),
  setCollapsed: (collapsed) => set({ collapsed }),
  setThemeMode: (themeMode) => {
    try {
      localStorage.setItem("aura:themeMode", themeMode)
    } catch {}
    set({ themeMode })
  },
  setColorTheme: (colorTheme) => {
    try {
      localStorage.setItem("aura:colorTheme", colorTheme)
    } catch {}
    set({ colorTheme })
  },
  setAmoled: (amoled) => {
    try {
      localStorage.setItem("aura:amoled", String(amoled))
    } catch {}
    set({ amoled })
  },
  setReopenLastSession: (reopenLastSession) => {
    try {
      localStorage.setItem("aura:reopenLastSession", String(reopenLastSession))
    } catch {}
    set({ reopenLastSession })
  },
  setConfirmBeforeDeleting: (confirmBeforeDeleting) => {
    try {
      localStorage.setItem(
        "aura:confirmBeforeDeleting",
        String(confirmBeforeDeleting),
      )
    } catch {}
    set({ confirmBeforeDeleting })
  },
  setReduceMotion: (reduceMotion) => {
    try {
      localStorage.setItem("aura:reduceMotion", String(reduceMotion))
    } catch {}
    set({ reduceMotion })
  },
  setResumeToast: (resumeToast) => set({ resumeToast }),

  createFolder: async (id: string, name: string) => {
    try {
      await db.createFolder(id, name)
      const folders = await db.getFolders()
      set({ folders })
    } catch (e) {
      console.error(e)
      throw e
    }
  },
  renameFolder: async (id: string, newName: string, oldName: string) => {
    try {
      await db.renameFolder(id, newName, oldName)
      const folders = await db.getFolders()
      const docs = await db.getDocs()
      set({ folders, documents: docs as Doc[] })
    } catch (e) {
      console.error(e)
      throw e
    }
  },
  deleteFolder: async (id: string, name: string) => {
    try {
      await db.deleteFolder(id, name)
      const folders = await db.getFolders()
      const docs = await db.getDocs()
      set({ folders, documents: docs as Doc[] })
    } catch (e) {
      console.error(e)
    }
  },
  setDocumentFolder: async (docId: string, folderId: string | null) => {
    try {
      await db.setDocumentFolder(docId, folderId)
      const docs = await db.getDocs()
      set({ documents: docs as Doc[] })
    } catch (e) {
      console.error(e)
    }
  },
  loadDocuments: async () => {
    try {
      const docs = await db.getDocs()
      const refreshed = await Promise.all(
        docs.map(async (doc) => {
          if (!isTauriContext() || !doc.path) return doc
          const size = await getFileSize(doc.path)
          if (size === null || String(size) === doc.size) return doc
          return { ...doc, size: String(size) }
        }),
      )
      const changed = refreshed.filter(
        (doc, index) => doc.size !== docs[index].size,
      )
      if (changed.length > 0) await db.saveDocs(changed)
      const folders = await db.getFolders()
      set({ documents: refreshed as Doc[], folders })
    } catch (e) {
      console.error(e)
    }
  },
  setDocumentsFolder: async (docIds: string[], folderId: string | null) => {
    try {
      await db.setDocumentsFolder(docIds, folderId)
      await get().loadDocuments()
    } catch (e) {
      console.error(e)
    }
  },
  toggleFavorite: async (docId: string) => {
    try {
      const doc = get().documents.find((d) => d.id === docId)
      if (!doc) return
      await get().saveDocument({ ...doc, favorite: !doc.favorite })
    } catch (e) {
      console.error(e)
    }
  },
  setDocumentsFavorite: async (docIds: string[], favorite: boolean) => {
    try {
      const docsToUpdate = get()
        .documents.filter((d) => docIds.includes(d.id))
        .map((d) => ({ ...d, favorite }))
      if (docsToUpdate.length > 0) {
        await get().saveDocuments(docsToUpdate)
      }
    } catch (e) {
      console.error(e)
    }
  },
  deleteDocument: async (id: string) => {
    try {
      await db.deleteDoc(id)
      await get().loadDocuments()
    } catch (e) {
      console.error(e)
    }
  },
  saveDocument: async (doc) => {
    try {
      await db.saveDoc(doc)
      await get().loadDocuments()
    } catch (e) {
      console.error(e)
    }
  },
  saveDocuments: async (docs) => {
    try {
      await db.saveDocs(docs)
      await get().loadDocuments()
    } catch (e) {
      console.error(e)
      throw e
    }
  },
  addDocumentToLibrary: async (docId, options) => {
    try {
      await db.addToLibrary(docId, options)
      await get().loadDocuments()
    } catch (e) {
      console.error(e)
      throw e
    }
  },
}))
