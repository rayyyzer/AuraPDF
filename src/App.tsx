import { useState, useEffect, useCallback, useRef } from "react"
import type {
  View,
  Doc,
  TabState,
  ViewMode,
  ThemeMode,
  ColorTheme,
} from "./types"
import { getPalette, isDarkMode } from "./theme"

import {
  HomeIcon,
  FileTextIcon,
  StarIcon,
  FolderIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "./icons"
import Dashboard from "./components/library/Dashboard"
import Library from "./components/library/Library"
import PdfReader from "./components/reader/PdfReader"
import SearchView from "./components/library/SearchView"
import Settings from "./components/settings/Settings"
import FolderDialog from "./components/library/FolderDialog"
import AuraLogo from "./components/AuraLogo"
import {
  getFileSize,
  isTauriContext,
  openLocalPdf,
  takeLaunchQueue,
  validateAndResolvePaths,
  type LocalPdfSelection,
} from "./services/tauri"
import {
  formatPdfImportFailure,
  openPdfFilesDirect,
  type PickedPdf,
} from "./services/pdf/import"
import { NativePdfEngine } from "./services/pdf/engine"
import { db, normalizeDocumentPath } from "./services/db"
import { useAppStore } from "./stores/useAppStore"
import { useShallow } from "zustand/react/shallow"

function applyTheme(mode: ThemeMode, colorTheme: ColorTheme, amoled: boolean) {
  const palette = getPalette(mode, colorTheme, amoled)
  const dark = isDarkMode(mode)
  const root = document.documentElement

  root.setAttribute("data-theme-fade", "")
  root.classList.toggle("dark", dark)
  root.classList.toggle("light", !dark)

  root.style.setProperty("--background", palette.background)
  root.style.setProperty("--foreground", palette.foreground)
  root.style.setProperty("--card", palette.card)
  root.style.setProperty("--card-foreground", palette.foreground)
  root.style.setProperty("--secondary", palette.secondary)
  root.style.setProperty("--secondary-foreground", palette.mutedForeground)
  root.style.setProperty("--muted", palette.muted)
  root.style.setProperty("--muted-foreground", palette.mutedForeground)
  root.style.setProperty("--border", palette.border)
  root.style.setProperty("--primary", palette.primary)
  root.style.setProperty("--primary-foreground", palette.primaryForeground)
  root.style.setProperty("--accent", palette.primary)
  root.style.setProperty("--accent-foreground", palette.primaryForeground)
  root.style.setProperty("--ring", palette.ring)

  // Canonical dark theme default icon/logo as main app brand
  root.style.setProperty("--logo-bg-start", "#0F172A")
  root.style.setProperty("--logo-bg-end", "#060A12")
  root.style.setProperty("--logo-border", "#1E293B")

  // Interswitched document colors: Crisp Alabaster White document with active accent
  root.style.setProperty("--logo-doc-bg-start", "#FFFFFF")
  root.style.setProperty("--logo-doc-bg-end", "#F1F5F9")
  root.style.setProperty("--logo-doc-border", "transparent")
  root.style.setProperty("--logo-doc-line-1", "#0F172A")
  root.style.setProperty("--logo-doc-line-2", palette.primary || "#00D2FF")
  root.style.setProperty("--logo-doc-line-3", "#94A3B8")

  // Back sheet & subtle lighting accents
  root.style.setProperty("--logo-back-start", "#0369A1")
  root.style.setProperty("--logo-back-end", "#075985")
  root.style.setProperty("--logo-back-border", "transparent")
  root.style.setProperty("--logo-foil-color", "#BAE6FD")
  root.style.setProperty("--logo-foil-opacity", "0.65")
  root.style.setProperty("--logo-glow-opacity", "0.18")

  setTimeout(() => root.removeAttribute("data-theme-fade"), 280)
}

let readerStateSaveTimer: ReturnType<typeof setTimeout> | undefined
const pendingReaderStates = new Map<string, {
  page: number
  zoom: number
  rotation: number
  viewMode: ViewMode
  bookmarks: TabState["bookmarks"]
}>()

function queueReaderStateSave(
  docId: string,
  state: {
    page: number
    zoom: number
    rotation: number
    viewMode: ViewMode
    bookmarks: TabState["bookmarks"]
  },
) {
  pendingReaderStates.set(docId, state)
  if (readerStateSaveTimer) clearTimeout(readerStateSaveTimer)
  readerStateSaveTimer = setTimeout(async () => {
    const states = [...pendingReaderStates.entries()]
    pendingReaderStates.clear()
    await Promise.all(
      states.map(([id, snapshot]) =>
        db.saveReaderState(id, snapshot).catch((error) =>
          console.warn("Failed to save reader state", error),
        ),
      ),
    )
  }, 500)
}

// ── Nav ───────────────────────────────────────────────────────
type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  view: View
}

const NAV_PRIMARY: NavItem[] = [
  { id: "home", label: "Home", icon: HomeIcon, view: "dashboard" },
  { id: "library", label: "Library", icon: FileTextIcon, view: "library" },
]
const NAV_SECONDARY: NavItem[] = [
  { id: "favorites", label: "Favorites", icon: StarIcon, view: "library" },
  { id: "folders", label: "Folders", icon: FolderIcon, view: "library" },
]
const ALL_FOLDERS = "__folders__"

export default function App() {
  const {
    view,
    setView,
    collapsed,
    setCollapsed,
    themeMode,
    setThemeMode,
    colorTheme,
    setColorTheme,
    amoled,
    setAmoled,
    reopenLastSession,
    setReopenLastSession,
    confirmBeforeDeleting,
    reduceMotion,
    resumeToast,
    setResumeToast,
    documents,
    folders,
    loadDocuments,
    saveDocuments,
    createFolder,
    setDocumentsFolder,
    deleteDocumentFromStore,
  } = useAppStore(
    useShallow((state) => ({
      view: state.view,
      setView: state.setView,
      collapsed: state.collapsed,
      setCollapsed: state.setCollapsed,
      themeMode: state.themeMode,
      setThemeMode: state.setThemeMode,
      colorTheme: state.colorTheme,
      setColorTheme: state.setColorTheme,
      amoled: state.amoled,
      setAmoled: state.setAmoled,
      reopenLastSession: state.reopenLastSession,
      setReopenLastSession: state.setReopenLastSession,
      confirmBeforeDeleting: state.confirmBeforeDeleting,
      reduceMotion: state.reduceMotion,
      resumeToast: state.resumeToast,
      setResumeToast: state.setResumeToast,
      documents: state.documents,
      folders: state.folders,
      loadDocuments: state.loadDocuments,
      saveDocuments: state.saveDocuments,
      createFolder: state.createFolder,
      setDocumentsFolder: state.setDocumentsFolder,
      deleteDocumentFromStore: state.deleteDocument,
    })),
  )

  const [libraryFilter, setLibraryFilter] =
    useState<"all" | "recent" | "favorites" | string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [folderDialog, setFolderDialog] = useState<{
    assignSelected: boolean
  } | null>(null)
  const [folderMenuOpen, setFolderMenuOpen] = useState(false)

  // Tab state
  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeTabIdx, setActiveTabIdx] = useState(0)

  // Startup & native UX state
  const [startupReady, setStartupReady] = useState(() => !isTauriContext())
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [appNotice, setAppNotice] = useState<{
    message: string
    isError?: boolean
  } | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openingDialogRef = useRef(false)

  const showNotice = useCallback((message: string, isError = false) => {
    setAppNotice({ message, isError })
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      setAppNotice(null)
    }, 4200)
  }, [])

  useEffect(() => {
    applyTheme(themeMode, colorTheme, amoled)
    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system", colorTheme, amoled)
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [themeMode, colorTheme, amoled])

  useEffect(() => {
    if (reduceMotion) {
      document.documentElement.setAttribute("data-reduce-motion", "true")
    } else {
      document.documentElement.removeAttribute("data-reduce-motion")
    }
  }, [reduceMotion])

  function recordDocumentAccess(doc: Doc) {
    const updatedDoc = { ...doc, lastOpened: new Date().toISOString() }
    useAppStore
      .getState()
      .saveDocument(updatedDoc)
      .catch((e) => console.warn(e))
  }

  const openDocsInTabs = useCallback(
    async (docsToOpen: Doc[]) => {
      if (docsToOpen.length === 0) return

      const preparedTabs: { doc: Doc; state: Omit<TabState, "doc"> }[] = []
      for (const doc of docsToOpen) {
        recordDocumentAccess(doc)
        let saved = null
        try {
          saved = await db.getReaderState(doc.id)
        } catch (e) {
          console.warn("Failed to load reader state from db", e)
        }
        const page = saved?.page ?? 1
        if (docsToOpen.length === 1 && saved && page > 1) {
          setResumeToast(`Resumed from page ${page}`)
        }
        preparedTabs.push({
          doc,
          state: {
            page,
            zoom: saved?.zoom ?? 100,
            rotation: saved?.rotation ?? 0,
            viewMode: saved?.viewMode as ViewMode ?? "single",
            bookmarks: saved?.bookmarks ?? [],
          },
        })
      }

      setTabs((prev) => {
        const next = [...prev]
        let targetIdx = 0
        for (const item of preparedTabs) {
          const targetIdLower = normalizeDocumentPath(item.doc.id).toLowerCase()
          const existingIdx = next.findIndex(
            (t) =>
              normalizeDocumentPath(t.doc.id).toLowerCase() === targetIdLower,
          )
          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              doc: { ...next[existingIdx].doc, ...item.doc },
            }
            targetIdx = existingIdx
          } else {
            next.push({ doc: item.doc, ...item.state })
            targetIdx = next.length - 1
          }
        }
        setActiveTabIdx(targetIdx)
        return next
      })

      setView("reader")
    },
    [setResumeToast, setView],
  )

  const openDoc = useCallback(
    async (doc: Doc) => {
      await openDocsInTabs([doc])
    },
    [openDocsInTabs],
  )

  /**
   * Workflow A: Open PDF files directly from disk without importing into the persistent Library.
   */
  const openPickedPdfsDirect = useCallback(
    async (pickedFiles: PickedPdf[]) => {
      if (pickedFiles.length === 0) return
      const currentDocs = useAppStore.getState().documents
      const result = await openPdfFilesDirect(pickedFiles, currentDocs)

      if (result.opened.length > 0) {
        await saveDocuments(result.opened)
        await openDocsInTabs(result.opened)
      }

      if (result.failures.length > 0) {
        const firstErr = result.failures[0]
        showNotice(
          `Could not open "${firstErr.file.name}": ${formatPdfImportFailure(firstErr.error)}`,
          true,
        )
      }
    },
    [openDocsInTabs, saveDocuments, showNotice],
  )

  /**
   * Native `Ctrl + O` / Open PDF handler: opens native file picker and immediately opens the PDF.
   */
  const handleNativeOpenFileDialog = useCallback(async () => {
    if (openingDialogRef.current) return
    openingDialogRef.current = true
    try {
      const selected = await openLocalPdf()
      if (!selected) return
      await openPickedPdfsDirect([selected])
    } catch (e) {
      showNotice(`Failed to open PDF: ${formatPdfImportFailure(e)}`, true)
    } finally {
      openingDialogRef.current = false
    }
  }, [openPickedPdfsDirect, showNotice])

  /**
   * Drain any pending CLI / single-instance launch requests from Rust backend.
   */
  const drainAndOpenLaunchQueue = useCallback(
    async (existingDocsOverride?: Doc[]): Promise<Doc[]> => {
      const queue = await takeLaunchQueue()
      if (queue.length === 0) return []

      const validFiles: LocalPdfSelection[] = []
      const invalidMessages: string[] = []

      for (const item of queue) {
        if (item.status === "valid") {
          validFiles.push({
            path: item.path,
            name: item.name,
            size: item.size,
          })
        } else {
          invalidMessages.push(item.error || `Invalid PDF file: ${item.path}`)
        }
      }

      if (invalidMessages.length > 0) {
        showNotice(invalidMessages[0], true)
      }

      if (validFiles.length === 0) return []

      const baseDocs = existingDocsOverride ?? useAppStore.getState().documents
      const result = await openPdfFilesDirect(validFiles, baseDocs)
      if (result.opened.length > 0) {
        await saveDocuments(result.opened)
      }
      if (result.failures.length > 0) {
        const firstErr = result.failures[0]
        showNotice(
          `Could not open "${firstErr.file.name}": ${formatPdfImportFailure(firstErr.error)}`,
          true,
        )
      }
      return result.opened
    },
    [saveDocuments, showNotice],
  )

  // Unified Startup Initialization: load DB, restore session tabs, and handle direct CLI PDF launch without flashing empty UI
  useEffect(() => {
    let mounted = true
    const safetyTimer = window.setTimeout(() => {
      if (mounted) {
        console.warn("[STARTUP] Workspace initialization timeout reached; displaying UI")
        setStartupReady(true)
      }
    }, 1200)

    async function initializeWorkspace() {
      try {
        try {
          await loadDocuments()
        } catch (e) {
          console.warn("Failed to load documents on startup:", e)
        }
        const currentDocs = useAppStore.getState().documents

        // 1. Restore previous session tabs if enabled
        const restoredTabs: TabState[] = []
        let targetActiveIdx = 0

        if (reopenLastSession) {
          try {
            const session = await db.getSession()
            if (session && session.tabs.length > 0) {
              for (const docId of session.tabs) {
                const targetLower = normalizeDocumentPath(docId).toLowerCase()
                const doc = currentDocs.find(
                  (d) =>
                    normalizeDocumentPath(d.id).toLowerCase() === targetLower,
                )
                if (
                  !doc ||
                  !doc.path ||
                  (isTauriContext() && (await getFileSize(doc.path).catch(() => null)) === null)
                ) {
                  continue
                }
                const saved = await db.getReaderState(doc.id).catch(() => null)
                restoredTabs.push({
                  doc: doc as Doc,
                  page: saved?.page ?? 1,
                  zoom: saved?.zoom ?? 100,
                  rotation: saved?.rotation ?? 0,
                  viewMode: (saved?.viewMode as ViewMode) ?? "single",
                  bookmarks: saved?.bookmarks ?? [],
                })
              }
              targetActiveIdx = restoredTabs.length
                ? Math.min(session.activeTabIdx, restoredTabs.length - 1)
                : 0
            }
          } catch (e) {
            console.warn("Failed to restore session", e)
          }
        }

        // 2. Check for direct CLI PDF launch (e.g. double-clicking a PDF in Windows Explorer)
        try {
          const launchedDocs = await drainAndOpenLaunchQueue(
            useAppStore.getState().documents,
          )
          for (const doc of launchedDocs) {
            const targetLower = normalizeDocumentPath(doc.id).toLowerCase()
            const existingIdx = restoredTabs.findIndex(
              (t) =>
                normalizeDocumentPath(t.doc.id).toLowerCase() === targetLower,
            )
            if (existingIdx >= 0) {
              restoredTabs[existingIdx] = { ...restoredTabs[existingIdx], doc }
              targetActiveIdx = existingIdx
            } else {
              const saved = await db.getReaderState(doc.id).catch(() => null)
              restoredTabs.push({
                doc,
                page: saved?.page ?? 1,
                zoom: saved?.zoom ?? 100,
                rotation: saved?.rotation ?? 0,
                viewMode: (saved?.viewMode as ViewMode) ?? "single",
                bookmarks: saved?.bookmarks ?? [],
              })
              targetActiveIdx = restoredTabs.length - 1
            }
          }
        } catch (e) {
          console.warn("Failed to process launch queue on startup:", e)
        }

        if (mounted && restoredTabs.length > 0) {
          setTabs(restoredTabs)
          setActiveTabIdx(targetActiveIdx)
          setView("reader")
        }
      } catch (e) {
        console.warn("Workspace initialization error:", e)
      } finally {
        if (mounted) {
          window.clearTimeout(safetyTimer)
          setStartupReady(true)
        }
      }
    }

    initializeWorkspace()
    return () => {
      mounted = false
      window.clearTimeout(safetyTimer)
    }
  }, [])

  // Keep open tab `doc` metadata in sync when `documents` updates (e.g., when user clicks "Add to Library" or "Favorite")
  useEffect(() => {
    if (tabs.length === 0 || documents.length === 0) return
    setTabs((prev) =>
      prev.map((tab) => {
        const key = normalizeDocumentPath(tab.doc.id).toLowerCase()
        const updated = documents.find(
          (d) => normalizeDocumentPath(d.id).toLowerCase() === key,
        )
        return updated ? { ...tab, doc: updated } : tab
      }),
    )
  }, [documents])

  // Listen for single-instance forwarded PDF launches while AuraPDF is already running
  useEffect(() => {
    if (!isTauriContext()) return
    let unlisten: (() => void) | undefined
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("aurapdf://open-files", async () => {
          const opened = await drainAndOpenLaunchQueue()
          if (opened.length > 0) {
            await openDocsInTabs(opened)
          }
        }),
      )
      .then((fn) => {
        unlisten = fn
      })
      .catch((e) =>
        console.warn("Failed to listen for single-instance events:", e),
      )

    return () => {
      unlisten?.()
    }
  }, [drainAndOpenLaunchQueue, openDocsInTabs])

  // Global keyboard shortcuts: `Ctrl + O` (Open PDF anywhere) and `Alt + Enter` (Fullscreen)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "o"
      ) {
        e.preventDefault()
        e.stopPropagation()
        void handleNativeOpenFileDialog()
        return
      }
      if (e.key === "F11" || (e.key === "Enter" && e.altKey)) {
        e.preventDefault()
        e.stopPropagation()
        if (isTauriContext()) {
          import("@tauri-apps/api/window")
            .then(async ({ getCurrentWindow }) => {
              const win = getCurrentWindow()
              const isFs = await win.isFullscreen()
              const next = !isFs
              await win.setFullscreen(next)
              window.dispatchEvent(
                new CustomEvent("aura:fullscreen-change", { detail: next }),
              )
            })
            .catch((err) => {
              console.warn("[App] F11 fullscreen toggle failed:", err)
            })
        } else {
          if (!document.fullscreenElement) {
            void document.documentElement
              .requestFullscreen()
              .then(() => {
                window.dispatchEvent(
                  new CustomEvent("aura:fullscreen-change", { detail: true }),
                )
              })
              .catch(() => {})
          } else {
            void document
              .exitFullscreen()
              .then(() => {
                window.dispatchEvent(
                  new CustomEvent("aura:fullscreen-change", { detail: false }),
                )
              })
              .catch(() => {})
          }
        }
        return
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [handleNativeOpenFileDialog])

  // Native Tauri file drag-and-drop support across the entire application
  useEffect(() => {
    if (!isTauriContext()) return
    let unlisten: (() => void) | undefined
    import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent(async (event) => {
          const type = event.payload.type
          if (type === "enter" || type === "over") {
            setIsDraggingOver(true)
          } else if (type === "leave") {
            setIsDraggingOver(false)
          } else if (type === "drop") {
            setIsDraggingOver(false)
            const rawPaths = event.payload.paths || []
            if (rawPaths.length === 0) return
            const { valid, invalid } = await validateAndResolvePaths(rawPaths)
            if (invalid.length > 0) {
              const badName =
                invalid[0].path.split(/[\\/]/).pop() || invalid[0].path
              showNotice(`Cannot open "${badName}": ${invalid[0].error}`, true)
            }
            if (valid.length > 0) {
              await openPickedPdfsDirect(valid)
            }
          }
        }),
      )
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {})
    return () => {
      unlisten?.()
    }
  }, [openPickedPdfsDirect, showNotice])

  // HTML5 Drag & Drop fallback (for browser preview or when OS drag passes through DOM)
  async function handleHtmlDrop(e: React.DragEvent) {
    if (!e.dataTransfer?.types?.includes("Files")) return
    e.preventDefault()
    setIsDraggingOver(false)
    if (isTauriContext()) return // Handled by native webview onDragDropEvent

    const allFiles = Array.from(e.dataTransfer.files || [])
    if (allFiles.length === 0) return

    const pdfFiles = allFiles.filter((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    )
    const nonPdfCount = allFiles.length - pdfFiles.length
    if (nonPdfCount > 0) {
      showNotice(
        `Skipped ${nonPdfCount} unsupported non-PDF file${
          nonPdfCount > 1 ? "s" : ""
        }`,
        true,
      )
    }
    if (pdfFiles.length === 0) return

    const picked: PickedPdf[] = await Promise.all(
      pdfFiles.map(async (file) => ({
        path: URL.createObjectURL(file),
        size: file.size,
        data: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
      })),
    )
    await openPickedPdfsDirect(picked)
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function deleteDocument(id: string) {
    if (confirmBeforeDeleting) {
      const targetDoc = documents.find((d) => d.id === id)
      const label = targetDoc ? `"${targetDoc.name}"` : "this document"
      if (!window.confirm(`Remove ${label} from your library?`)) return
    }
    await deleteDocumentFromStore(id)
    const deletedTabIndexes = tabs
      .map((tab, index) => (tab.doc.id === id ? index : -1))
      .filter((index) => index >= 0)
    if (deletedTabIndexes.length === 0) return
    const nextTabs = tabs.filter((tab) => tab.doc.id !== id)
    const nextActive = Math.min(
      Math.max(
        0,
        activeTabIdx -
          deletedTabIndexes.filter((index) => index < activeTabIdx).length,
      ),
      Math.max(0, nextTabs.length - 1),
    )
    setTabs(nextTabs)
    setActiveTabIdx(nextActive)
    await NativePdfEngine.closeDocument(id).catch((e) =>
      console.warn("Failed to close deleted PDF", e),
    )
    await db.saveSession(
      nextTabs.length ? nextActive : 0,
      nextTabs.map((tab) => ({ doc_id: tab.doc.id })),
    )
    if (nextTabs.length === 0) setView("library")
  }

  async function createFolderFromDialog(name: string, assignSelected: boolean) {
    const id = crypto.randomUUID()
    await createFolder(id, name)
    if (assignSelected && selectedIds.size > 0) {
      await setDocumentsFolder([...selectedIds], id)
      clearSelection()
    }
    setFolderDialog(null)
  }

  // Save session when tabs change (after startup initialization completes)
  useEffect(() => {
    if (!startupReady) return
    const timer = setTimeout(() => {
      db.saveSession(
        activeTabIdx,
        tabs.map((t) => ({ doc_id: t.doc.id })),
      ).catch((e) => console.warn(e))
    }, 300)
    return () => clearTimeout(timer)
  }, [tabs, activeTabIdx, startupReady])

  function closeTab(idx: number) {
    const next = tabs.filter((_, i) => i !== idx)
    if (next.length === 0) {
      setView("dashboard")
      setTabs([])
      const closedDoc = tabs[idx]?.doc
      if (closedDoc) {
        NativePdfEngine.closeDocument(closedDoc.id).catch((e) =>
          console.warn("Failed to close PDF", e),
        )
      }
      db.saveSession(0, []).catch((e) =>
        console.warn("Failed to clear session", e),
      )
      return
    }
    const closedDoc = tabs[idx]?.doc
    if (closedDoc && !next.some((tab) => tab.doc.id === closedDoc.id)) {
      NativePdfEngine.closeDocument(closedDoc.id).catch((e) =>
        console.warn("Failed to close PDF", e),
      )
    }
    const newActive =
      idx <= activeTabIdx ? Math.max(0, activeTabIdx - 1) : activeTabIdx
    setTabs(next)
    setActiveTabIdx(newActive)
  }

  function updateTab(idx: number, update: Partial<TabState>) {
    setTabs((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t
        const next = { ...t, ...update }

        queueReaderStateSave(t.doc.id, {
          page: next.page,
          zoom: next.zoom,
          rotation: next.rotation,
          viewMode: next.viewMode,
          bookmarks: next.bookmarks,
        })

        return next
      }),
    )
  }

  const w = collapsed ? 48 : 208
  const libraryDocuments = documents.filter((d) => d.inLibrary !== false)

  // Branded workspace preparation splash screen
  if (!startupReady) {
    return (
      <div className="h-screen w-full bg-background text-foreground flex flex-col items-center justify-center select-none">
        <div className="flex flex-col items-center gap-4 fade-in">
          <div className="relative flex items-center justify-center">
            <AuraLogo size={52} />
            <div className="absolute -inset-2 rounded-3xl bg-primary/20 blur-md -z-10 animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="text-[15px] font-semibold tracking-tight text-foreground font-sans flex items-baseline gap-1">
              <span className="font-serif italic font-medium">Aura</span>
              <span>PDF</span>
            </div>
            <div className="text-[12px] text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>Preparing workspace...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-full bg-background text-foreground flex overflow-hidden selection:bg-primary/30"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault()
          if (!isTauriContext()) setIsDraggingOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingOver(false)
        }
      }}
      onDrop={handleHtmlDrop}
    >
      {/* Subtle global Drag & Drop overlay */}
      {isDraggingOver && (
        <div className="fixed inset-3 z-[100] rounded-2xl border-2 border-dashed border-primary/70 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none backdrop-fade">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary modal-pop">
            <FileTextIcon size={20} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Drop PDF to open immediately
          </p>
          <p className="text-xs text-muted-foreground">
            Opens directly in reader without importing to library
          </p>
        </div>
      )}

      {/* Global Toast Notice */}
      {appNotice && (
        <div
          className={`fixed bottom-5 right-5 z-[110] flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-md toast-slide-up ${
            appNotice.isError
              ? "border-red-500/40 bg-card/95 text-red-400"
              : "border-border bg-card/95 text-foreground"
          }`}
        >
          <span>{appNotice.message}</span>
          <button
            onClick={() => setAppNotice(null)}
            className="text-muted-foreground hover:text-foreground ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {view !== "reader" /* Sidebar — blends with background */ && (
        <aside
          style={{ width: w, minWidth: w }}
          className="relative flex flex-col h-full border-r border-border/40 bg-background transition-[width,min-width] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden z-30 shrink-0"
        >
          <div
            className={`flex items-center h-16 border-b border-border/30 shrink-0 transition-all duration-200 ${
              collapsed ? "justify-center px-0" : "px-3.5"
            }`}
          >
            {!collapsed && (
              <>
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <AuraLogo size={36} />
                </div>
                <span className="ml-2 text-[16px] tracking-tight whitespace-nowrap fade-in flex items-baseline gap-0.5">
                  <span className="font-serif italic text-foreground font-medium">
                    Aura
                  </span>
                  <span className="font-semibold text-foreground tracking-normal">
                    PDF
                  </span>
                </span>
                <button
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Collapse sidebar"
                >
                  <ChevronLeftIcon size={14} />
                </button>
              </>
            )}
            {collapsed && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Expand sidebar"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setCollapsed(false)
                }}
                className="w-10 h-10 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
              >
                <AuraLogo size={32} />
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2 flex flex-col gap-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground fade-in">
                Library
              </p>
            )}
            {NAV_PRIMARY.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={view === item.view && libraryFilter === "all"}
                collapsed={collapsed}
                onClick={() => {
                  setView(item.view)
                  setLibraryFilter("all")
                }}
              />
            ))}
            <div className="my-3 mx-1 border-t border-border/30" />
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground fade-in">
                Collections
              </p>
            )}
            {NAV_SECONDARY.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                active={
                  view === "library" &&
                  (item.id === "folders"
                    ? libraryFilter === ALL_FOLDERS
                    : libraryFilter === item.id)
                }
                collapsed={collapsed}
                onClick={() => {
                  setView(item.view)
                  setLibraryFilter(
                    item.id === "folders" ? ALL_FOLDERS : item.id,
                  )
                  clearSelection()
                }}
                secondary
              />
            ))}
            <div className="my-3 mx-1 border-t border-border/30" />
            <NavBtn
              item={{
                id: "search",
                label: "Search",
                icon: SearchIcon,
                view: "search",
              }}
              active={view === "search"}
              collapsed={collapsed}
              onClick={() => setView("search")}
            />
          </nav>

          <div className="shrink-0 border-t border-border/30 p-2 space-y-1">
            <NavBtn
              item={{
                id: "settings",
                label: "Settings",
                icon: SettingsIcon,
                view: "settings",
              }}
              active={view === "settings"}
              collapsed={collapsed}
              onClick={() => setView("settings")}
            />

            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex items-center justify-center w-full p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRightIcon size={13} />
              </button>
            )}
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0 h-full flex flex-col relative">
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {view === "dashboard" && (
            <div key="view-dashboard" className="h-full w-full view-enter">
              <Dashboard
                onOpenDoc={openDoc}
                onOpenFileDialog={handleNativeOpenFileDialog}
                onDeleteDocument={deleteDocument}
                onNavigate={(v) => {
                  setView(v)
                  setLibraryFilter("all")
                  clearSelection()
                }}
                onNotice={showNotice}
              />
            </div>
          )}
          {view === "library" && (
            <div
              key={`view-library-${libraryFilter}`}
              className="h-full w-full view-enter"
            >
              <Library
                onOpenDoc={openDoc}
                onDeleteDocument={deleteDocument}
                filter={libraryFilter}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onNewFolder={() => setFolderDialog({ assignSelected: false })}
                onOpenFolder={(id) => {
                  setLibraryFilter(id)
                }}
              />
            </div>
          )}
          {view === "search" && (
            <div key="view-search" className="h-full w-full view-enter">
              <SearchView
                docs={libraryDocuments}
                onOpenDoc={openDoc}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
              />
            </div>
          )}
          {view === "settings" && (
            <div key="view-settings" className="h-full w-full view-enter">
              <Settings
                themeMode={themeMode}
                setThemeMode={setThemeMode}
                colorTheme={colorTheme}
                setColorTheme={setColorTheme}
                amoled={amoled}
                setAmoled={setAmoled}
                reopenLastSession={reopenLastSession}
                setReopenLastSession={setReopenLastSession}
              />
            </div>
          )}
          {view !== "reader" && selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm toast-slide-up">
              <span className="text-xs font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <div className="relative">
                <button
                  onClick={() => setFolderMenuOpen((open) => !open)}
                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Add to Folder
                </button>
                {folderMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl modal-pop">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={async () => {
                          await setDocumentsFolder([...selectedIds], folder.id)
                          clearSelection()
                          setFolderMenuOpen(false)
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                      >
                        {folder.name}
                      </button>
                    ))}
                    <button
                      onClick={async () => {
                        await setDocumentsFolder([...selectedIds], null)
                        clearSelection()
                        setFolderMenuOpen(false)
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                    >
                      Unfiled
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => {
                        setFolderDialog({ assignSelected: true })
                        setFolderMenuOpen(false)
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-primary hover:bg-muted"
                    >
                      + Create Folder from Selection
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  await Promise.all(
                    [...selectedIds].map((id) => deleteDocument(id)),
                  )
                  clearSelection()
                }}
                className="rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10"
              >
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Esc
              </button>
            </div>
          )}
          {folderDialog && (
            <FolderDialog
              title="New folder"
              submitLabel="Create"
              onCancel={() => setFolderDialog(null)}
              onSubmit={async (name) => {
                await createFolderFromDialog(name, folderDialog.assignSelected)
              }}
            />
          )}
        </main>
      </div>

      {view === "reader" && tabs.length > 0 && (
        <div className="fixed inset-0 z-50 reader-enter">
          <PdfReader
            tabs={tabs}
            activeTabIdx={activeTabIdx}
            resumeToast={resumeToast}
            onResumeToastDismiss={() => setResumeToast(null)}
            onTabChange={(idx) => {
              setActiveTabIdx(idx)
              const tab = tabs[idx]
              if (tab) recordDocumentAccess(tab.doc)
            }}
            onTabClose={closeTab}
            onTabUpdate={updateTab}
            onBack={() => setView("dashboard")}
            onOpenDoc={openDoc}
            onOpenFileDialog={handleNativeOpenFileDialog}
            onNotice={showNotice}
          />
        </div>
      )}
    </div>
  )
}

function NavBtn({
  item,
  active,
  collapsed,
  onClick,
  secondary,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick: () => void
  secondary?: boolean
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`relative nav-item flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-primary/12 text-primary shadow-2xs"
          : secondary
            ? "text-muted-foreground hover:text-foreground/90 hover:bg-muted/40 hover:translate-x-0.5 font-normal"
            : "text-muted-foreground hover:text-foreground/90 hover:bg-muted/40 hover:translate-x-0.5"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary transition-all duration-200" />
      )}
      <Icon size={17} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}
