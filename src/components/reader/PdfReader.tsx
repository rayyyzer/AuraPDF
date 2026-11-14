import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react"

import type { Doc, TabState, ViewMode } from "../../types"

import {
  ArrowLeftIcon,
  SearchIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MoreHorizontalIcon,
  MaximizeIcon,
  MinimizeIcon,
  LayersIcon,
  HighlighterIcon,
  PenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  RefreshIcon,
  GridIcon,
  ListIcon,
  BookmarkIcon,
  FileTextIcon,
  MousePointerIcon,
  StickyNoteIcon,
  PlusIcon,
  CopyIcon,
  EraserIcon,
} from "../../icons"

import { ContinuousView } from "./ContinuousView"
import { ThumbnailSidebar } from "./ThumbnailSidebar"
import { PageThumbnail } from "./PageThumbnail"
import { useAppStore } from "../../stores/useAppStore"
import {
  useAnnotationStore,
  HIGHLIGHT_PALETTE,
  PEN_PALETTE,
} from "../../stores/useAnnotationStore"
import { useShallow } from "zustand/react/shallow"
import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"
import { isTauriContext, openLocalPdf } from "../../services/tauri"
import { toExportAnnotations } from "../../services/pdf/exportAnnotations"
import { printPages } from "../../services/print"
import { openPdfFilesDirect } from "../../services/pdf/import"
import { NativePdfEngine } from "../../services/pdf/engine"
import { useWindowFullscreen } from "../../hooks/useWindowFullscreen"
import { useAutoHideChrome } from "../../hooks/useAutoHideChrome"
import {
  normalizeTextSelectionRects,
  type TextSelection,
} from "../../services/pdf/text"
import { formatFileSize, formatLastOpened } from "../../utils/documentMetadata"
import AuraLogo from "../AuraLogo"
import PrintPreview from "./PrintPreview"
import { PageCard } from "./PageCard"

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 175, 200, 300, 400, 500]

/** Widened palette type: the two palettes are separate readonly tuples, and a ternary of
 *  them narrows to `never` inside `.map` without this. */
function paletteFor(
  tool: string,
): readonly { value: string; label?: string }[] {
  return tool === "highlight" ? HIGHLIGHT_PALETTE : PEN_PALETTE
}

const MOD_LABEL = "Ctrl"
const SHIFT_LABEL = "Shift"

interface Props {
  tabs: TabState[]
  activeTabIdx: number
  resumeToast: string | null
  onResumeToastDismiss: () => void
  onTabChange: (idx: number) => void
  onTabClose: (idx: number) => void
  onTabUpdate: (idx: number, update: Partial<TabState>) => void
  onBack: () => void
  onOpenDoc: (doc: Doc) => void
  onOpenFileDialog?: () => Promise<void>
  onNotice?: (message: string, isError?: boolean) => void
}

type AnnotateTool =
  | "select"
  | "highlight"
  | "pen"
  | "shape"
  | "text"
  | "note"
  | "eraser"

export default function PdfReader({
  tabs,
  activeTabIdx,
  resumeToast,
  onResumeToastDismiss,
  onTabChange,
  onTabClose,
  onTabUpdate,
  onBack,
  onOpenDoc,
  onOpenFileDialog,
  onNotice,
}: Props) {
  const tab = tabs[activeTabIdx] ?? tabs[0]
  const {
    page = 1,
    zoom = 100,
    rotation = 0,
    viewMode = "single",
    bookmarks = [],
  } = tab || {}
  const doc = tab?.doc

  const [pageInput, setPageInput] = useState(String(tab?.page ?? 1))
  const { isFullscreen, setFullscreen, toggleFullscreen } =
    useWindowFullscreen()
  const [isProReaderMode, setIsProReaderMode] = useState(false)
  const top = useAutoHideChrome("top", true, {
    inactiveHoldMs: 4000,
    leaveDelayMs: 800,
    zonePx: 75,
  })
  const bottom = useAutoHideChrome("bottom", true, {
    inactiveHoldMs: 4000,
    leaveDelayMs: 800,
    zonePx: 80,
  })

  // Reveal top toolbar and bottom navigation panel together on tab/document switch
  useEffect(() => {
    top.reveal()
    bottom.reveal()
  }, [activeTabIdx, doc?.id, top.reveal, bottom.reveal])

  const [closingTabId, setClosingTabId] = useState<string | null>(null)
  const [showThumbs, setShowThumbs] = useState(false)
  const [thumbsTab, setThumbsTab] = useState<"pages" | "bookmarks" | "outline">(
    "pages",
  )
  const [outlineItems, setOutlineItems] = useState<{
    title: string
    page: number
    level: number
  }[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [showZoomMenu, setShowZoomMenu] = useState(false)
  const [showDocInfo, setShowDocInfo] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  const [activeTool, setActiveTool] = useState<AnnotateTool>("select")
  const [fitMode, setFitMode] =
    useState<"page" | "width" | "manual" | "actual">("manual")
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null)

  const [showAnnotateMenu, setShowAnnotateMenu] = useState(false)

  const toggleAnnotateMenu = useCallback(() => {
    setShowAnnotateMenu((prev) => {
      const next = !prev
      if (next) {
        setShowMore(false)
        setShowViewMenu(false)
        setShowZoomMenu(false)
      }
      return next
    })
  }, [])

  const toggleViewMenu = useCallback(() => {
    setShowViewMenu((prev) => {
      const next = !prev
      if (next) {
        setShowAnnotateMenu(false)
        setShowMore(false)
        setShowZoomMenu(false)
      }
      return next
    })
  }, [])

  const toggleMoreMenu = useCallback(() => {
    setShowMore((prev) => {
      const next = !prev
      if (next) {
        setShowAnnotateMenu(false)
        setShowViewMenu(false)
        setShowZoomMenu(false)
      }
      return next
    })
  }, [])

  const toggleZoomMenu = useCallback(() => {
    setShowZoomMenu((prev) => !prev)
  }, [])

  const closeAllMenus = useCallback(() => {
    setShowMore(false)
    setShowViewMenu(false)
    setShowZoomMenu(false)
    setShowAnnotateMenu(false)
  }, [])
  const [showPalette, setShowPalette] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState("")
  const [paletteIdx, setPaletteIdx] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{
    current: number
    total: number
  }>({ current: 0, total: 0 })

  const [actualNumPages, setActualNumPages] = useState(doc?.pages ?? 1)
  const [docLoadError, setDocLoadError] = useState<string | null>(null)
  const [isDocReady, setIsDocReady] = useState(false)
  const initGenerationRef = useRef(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLInputElement>(null)
  const pageInputRef = useRef<HTMLInputElement>(null)
  const continuousViewRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const activeZoomAnimRef = useRef<Animation | null>(null)
  const pinchHudRef = useRef<HTMLDivElement>(null)
  const pinchHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingZoomAnchorRef = useRef<{
    scrollEl: HTMLElement
    previewEl: HTMLElement
    pageIndex: number | null
    u: number
    v: number
    focalClientX: number
    focalClientY: number
    beforeAnchorScreenX: number
    beforeAnchorScreenY: number
    prevZoom: number
    animateFlip: boolean
    clearPinchTransform: boolean
  } | null>(null)
  const targetZoomRef = useRef(zoom)
  const pinchStateRef = useRef<{
    active: boolean
    baseZoom: number
    currentScale: number
    startClientX: number
    startClientY: number
    curClientX: number
    curClientY: number
    basePreviewRect: DOMRect
    localOriginX: number
    localOriginY: number
    scrollEl: HTMLElement
    previewEl: HTMLElement
    wheelTimer: ReturnType<typeof setTimeout> | null
    rafId: number | null
    startDist: number
  } | null>(null)

  const searchTimeoutRef = useRef<any>(null)
  const [searchMatches, setSearchMatches] = useState<any[]>([])
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)

  const activeMatch = useMemo(() => {
    if (searchResults.total === 0 || searchMatches.length === 0) return null
    let count = 0
    for (const r of searchMatches) {
      if (
        currentMatchIdx >= count &&
        currentMatchIdx < count + r.bounds.length
      ) {
        return {
          page: r.page,
          boundIndex: currentMatchIdx - count,
        }
      }
      count += r.bounds.length
    }
    return null
  }, [currentMatchIdx, searchMatches, searchResults.total])

  const targetPageRef = useRef<number | null>(null)
  const navDebounceRef = useRef<any>(null)
  const handleScrollRef = useRef<(page: number, offset?: number) => void>(null)

  const saveDocument = useAppStore((state) => state.saveDocument)
  const addDocumentToLibrary = useAppStore(
    (state) => state.addDocumentToLibrary,
  )
  const {
    addAnnotation,
    undo: undoAnnotations,
    redo: redoAnnotations,
    toolSettings,
    setToolSettings,
  } = useAnnotationStore(
    useShallow((state) => ({
      addAnnotation: state.addAnnotation,
      undo: state.undo,
      redo: state.redo,
      toolSettings: state.toolSettings,
      setToolSettings: state.setToolSettings,
    })),
  )

  const set = useCallback(
    (update: Partial<TabState>) => {
      onTabUpdate(activeTabIdx, update)
    },
    [onTabUpdate, activeTabIdx],
  )

  const handleSetPage = useCallback((p: number) => set({ page: p }), [set])

  const handleNavigation = useCallback(
    (targetPage: number) => {
      const c = Math.max(1, Math.min(actualNumPages, targetPage))
      targetPageRef.current = c
      setPageInput(String(c))

      if (viewMode.includes("continuous")) {
        continuousViewRef.current?.scrollToPage(c)
      } else {
        set({ page: c })
      }

      clearTimeout(navDebounceRef.current)
      navDebounceRef.current = setTimeout(() => {
        targetPageRef.current = null
      }, 500)
    },
    [actualNumPages, viewMode, set],
  )

  const [selectionAnchor, setSelectionAnchor] = useState<{
    x: number
    y: number
    placement: "above" | "below"
    arrowOffset: number
  } | null>(null)

  const clearSelection = useCallback(() => {
    setTextSelection(null)
    setSelectionAnchor(null)
    window.getSelection()?.removeAllRanges()
  }, [])

  const createSelectionAnnotation = useCallback(
    (
      kind: "highlight" | "underline" | "strikethrough" | "note",
      colorOverride?: string,
    ) => {
      if (!textSelection || !doc?.id) return
      const rects = normalizeTextSelectionRects(
        textSelection.segments.map((s) => s.bounds),
      )
      if (rects.length === 0) return
      const newId = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10)
      if (kind === "highlight") {
        const chosenColor = colorOverride || toolSettings.highlightColor
        if (colorOverride) {
          setToolSettings({ highlightColor: colorOverride })
        }
        addAnnotation({
          id: newId,
          docId: doc.id,
          page: textSelection.page,
          type: "highlight",
          color: chosenColor,
          rects,
          opacity: 0.42,
          selectedText: textSelection.text,
        })
      } else if (kind === "note") {
        const noteX = rects[0].x
        const noteY = Math.max(8, rects[0].y - 6)
        const initialNote = textSelection.text
        addAnnotation({
          id: newId,
          docId: doc.id,
          page: textSelection.page,
          type: "note",
          color: toolSettings.noteColor,
          x: noteX,
          y: noteY,
          note: initialNote || "Note",
        })
        window.dispatchEvent(
          new CustomEvent("aura:open-note-editor", {
            detail: {
              annotationId: newId,
              docId: doc.id,
              page: textSelection.page,
              pdfX: noteX,
              pdfY: noteY,
              text: initialNote,
              color: toolSettings.noteColor || "#F6D860",
            },
          }),
        )
      } else {
        addAnnotation({
          id: newId,
          docId: doc.id,
          page: textSelection.page,
          type: kind,
          color: kind === "underline" ? "#3b82f6" : "#ef4444",
          rects,
          selectedText: textSelection.text,
        })
      }
      clearSelection()
    },
    [
      textSelection,
      doc?.id,
      addAnnotation,
      toolSettings.highlightColor,
      toolSettings.noteColor,
      setToolSettings,
      clearSelection,
    ],
  )

  useEffect(() => {
    clearSelection()
  }, [doc?.id, activeTool, zoom, rotation, clearSelection])

  // Dismiss selection & floating menu on outside pointerdown, collapsed native selection, or Escape
  useEffect(() => {
    if (!textSelection) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.("[data-selection-popover]")) return
      clearSelection()
    }

    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        clearSelection()
      } else {
        updateSelectionAnchor()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection()
      }
    }

    window.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("selectionchange", onSelectionChange)
    window.addEventListener("keydown", onKeyDown)
  
  return () => {
      window.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("selectionchange", onSelectionChange)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [textSelection, clearSelection])

  // Compute live anchor position directly above (or below) the selected text
  const updateSelectionAnchor = useCallback(() => {
    if (!textSelection) {
      setSelectionAnchor(null)
      return
    }
    const containerEl = containerRef.current
    if (!containerEl) return
    const containerRect = containerEl.getBoundingClientRect()

    // 1. Prioritize active native browser selection range
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const rangeRect = range.getBoundingClientRect()
      if (rangeRect.width > 0 && rangeRect.height > 0) {
        // Selection relative to container
        const rawX = (rangeRect.left + rangeRect.right) / 2 - containerRect.left
        const topY = rangeRect.top - containerRect.top
        const bottomY = rangeRect.bottom - containerRect.top

        // If selection scrolled completely out of visible container
        if (rangeRect.bottom < containerRect.top || rangeRect.top > containerRect.bottom) {
          setSelectionAnchor(null)
          return
        }

        const halfPopoverW = 185
        const clampedX = Math.max(
          halfPopoverW + 12,
          Math.min(containerRect.width - halfPopoverW - 12, rawX),
        )
        const arrowOffset = Math.max(-125, Math.min(125, rawX - clampedX))

        if (topY >= 62) {
          setSelectionAnchor({
            x: clampedX,
            y: topY - 12,
            placement: "above",
            arrowOffset,
          })
        } else {
          setSelectionAnchor({
            x: clampedX,
            y: bottomY + 12,
            placement: "below",
            arrowOffset,
          })
        }
        return
      }
    }

    // 2. Fallback: Spatial OCR or handwriting selection bounds
    if (!textSelection.segments.length) {
      setSelectionAnchor(null)
      return
    }

    const pageEl = containerEl.querySelector<HTMLElement>(
      `[data-page-index="${textSelection.page - 1}"]`,
    )
    if (!pageEl) {
      setSelectionAnchor(null)
      return
    }

    const viewportBoxes = textSelection.segments
      .map((s) => s.viewportBounds)
      .filter(
        (b): b is { x: number; y: number; width: number; height: number } =>
          Boolean(b && b.width > 0 && b.height > 0),
      )
    const merged = normalizeTextSelectionRects(viewportBoxes)
    if (!merged.length) {
      setSelectionAnchor(null)
      return
    }

    const topLine = merged[0]
    const bottomLine = merged[merged.length - 1]
    const minX = Math.min(...merged.map((r) => r.x))
    const maxX = Math.max(...merged.map((r) => r.x + r.width))
    const centerInPage =
      merged.length === 1
        ? topLine.x + topLine.width / 2
        : (minX + maxX) / 2

    const pageRect = pageEl.getBoundingClientRect()

    const rawX = pageRect.left - containerRect.left + centerInPage
    const topY = pageRect.top - containerRect.top + topLine.y
    const bottomY =
      pageRect.top - containerRect.top + (bottomLine.y + bottomLine.height)

    // Hide if scrolled completely out of visible container
    if (bottomY < 0 || topY > containerRect.height) {
      setSelectionAnchor(null)
      return
    }

    const halfPopoverW = 185
    const clampedX = Math.max(
      halfPopoverW + 12,
      Math.min(containerRect.width - halfPopoverW - 12, rawX),
    )
    const arrowOffset = Math.max(-125, Math.min(125, rawX - clampedX))

    if (topY >= 62) {
      setSelectionAnchor({
        x: clampedX,
        y: topY - 12,
        placement: "above",
        arrowOffset,
      })
    } else {
      setSelectionAnchor({
        x: clampedX,
        y: bottomY + 12,
        placement: "below",
        arrowOffset,
      })
    }
  }, [textSelection])

  useLayoutEffect(() => {
    updateSelectionAnchor()
  }, [updateSelectionAnchor, zoom, rotation, viewMode, showThumbs, page])

  useEffect(() => {
    if (!textSelection) return
    let rafId: number | null = null
    const handleScrollOrResize = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updateSelectionAnchor()
      })
    }
    window.addEventListener("scroll", handleScrollOrResize, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", handleScrollOrResize, { passive: true })
  
  return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", handleScrollOrResize, {
        capture: true,
      })
      window.removeEventListener("resize", handleScrollOrResize)
    }
  }, [textSelection, updateSelectionAnchor])

  useEffect(() => {
    const onCopy = (event: KeyboardEvent) => {
      if (
        !textSelection ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "c"
      )
        return
      event.preventDefault()
      void navigator.clipboard?.writeText(textSelection.text)
    }
    document.addEventListener("keydown", onCopy)
  
  return () => document.removeEventListener("keydown", onCopy)
  }, [textSelection])

  const handleTextSelection = useCallback((selection: TextSelection | null) => {
    setTextSelection(selection)
  }, [])

  // In-document search via NativePdfEngine
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      if (!searchQuery || !doc?.id) {
        setSearchMatches([])
        setSearchResults({ current: 0, total: 0 })
        setCurrentMatchIdx(0)
        return
      }

      try {
        const results = await NativePdfEngine.searchDocument(
          doc.id,
          searchQuery,
        )
        setSearchMatches(results)

        let total = 0
        for (const r of results) total += r.bounds.length

        setSearchResults({ current: total > 0 ? 1 : 0, total })
        setCurrentMatchIdx(0)

        if (results.length > 0) {
          handleScrollRef.current?.(results[0].page + 1)
        }
      } catch (e) {
        console.error(e)
      }
    }, 300)

  
  return () => clearTimeout(searchTimeoutRef.current)
  }, [searchQuery, doc?.id])

  // Dynamic sliding-window recognition: quietly pre-process [page - 2 ... page + 2] as user scrolls
  useEffect(() => {
    if (!doc?.id || actualNumPages <= 0) return
    let cancelled = false

    async function processSlidingWindow() {
      if (!doc?.id) return
      const docId = doc.id
      const cur = page - 1
      const windowPages: number[] = []

      // Sliding window: current page, immediate next/prev, then ±2 pages
      const candidates = [cur, cur + 1, cur - 1, cur + 2, cur - 2]
      for (const p of candidates) {
        if (p >= 0 && p < actualNumPages && !windowPages.includes(p)) {
          windowPages.push(p)
        }
      }

      for (const pIdx of windowPages) {
        if (cancelled) break
        try {
          await NativePdfEngine.getHybridTextLayer(docId, pIdx)
        } catch {}
        // Yield to browser rendering
        await new Promise((r) => setTimeout(r, 60))
      }
    }

    const timer = setTimeout(processSlidingWindow, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [doc?.id, page, actualNumPages])

  // Initialize PDF document and outline
  useEffect(() => {
    const docId = doc?.id
    if (!docId) return
    let active = true
    const generation = ++initGenerationRef.current

    async function initPdf() {
      if (!doc) return

      const loadOutline = async () => {
        try {
          const items = await NativePdfEngine.getOutline(doc.id)
          if (active && generation === initGenerationRef.current) {
            setOutlineItems(Array.isArray(items) ? items : [])
          }
        } catch {
          if (active && generation === initGenerationRef.current) {
            setOutlineItems([])
          }
        }
      }

      const cached = NativePdfEngine.getCachedDocument(doc.id)
      if (cached) {
        if (active && generation === initGenerationRef.current) {
          setIsDocReady(true)
          setActualNumPages(cached.num_pages)
          setDocLoadError(null)
          void loadOutline()
        }
        return
      }

      try {
        const nativePath = doc.path || doc.id
        if (!nativePath || nativePath.startsWith("blob:")) {
          throw new Error("PDF file path is unavailable")
        }

        const pdfDoc = await NativePdfEngine.openDocument(doc.id, nativePath)

        if (active && generation === initGenerationRef.current) {
          setIsDocReady(true)
          setActualNumPages(pdfDoc.num_pages)
          setDocLoadError(null)
          void loadOutline()
        }
      } catch (err: any) {
        if (active && generation === initGenerationRef.current) {
          console.error("[READER] init failed", {
            docId: doc.id,
            generation,
            error: err,
          })
          const message = String(err?.message ?? "")
          setDocLoadError(
            message.includes("PASSWORD_PROTECTED")
              ? "This PDF is password protected. Encrypted documents are not supported yet — remove the password in another app, then reopen it here."
              : message || "Failed to load PDF natively",
          )
        }
      }
    }

    setIsDocReady(false)
    setDocLoadError(null)
    setOutlineItems([])
    initPdf()

  
  return () => {
      active = false
    }
  }, [doc?.id, doc?.path])

  useEffect(() => {
    setPageInput(String(page))
  }, [activeTabIdx, page])

  useEffect(() => {
    if (!doc?.id) return
    void useAnnotationStore.getState().loadAnnotations(doc.id)
  }, [doc?.id])

  useEffect(() => {
    if (!resumeToast) return
    const t = setTimeout(onResumeToastDismiss, 3200)
  
  return () => clearTimeout(t)
  }, [resumeToast, onResumeToastDismiss])

  useEffect(() => {
    handleScrollRef.current = (p, o) => {
      handleNavigation(p)
      if (viewMode.includes("continuous") && o !== undefined) {
        setTimeout(() => {
          continuousViewRef.current?.scrollToPage(p, o)
        }, 50)
      }
    }
  })

  const anyMenuOpen =
    showMore ||
    showSearch ||
    showViewMenu ||
    showZoomMenu ||
    showPalette ||
    showAnnotateMenu ||
    showDocInfo

  useEffect(() => {
    if (anyMenuOpen) {
      top.hold("menu")
      bottom.hold("menu")
    } else {
      top.release("menu")
      bottom.release("menu")
    }
  }, [anyMenuOpen, top.hold, top.release, bottom.hold, bottom.release])

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const hasDropdown =
      showMore || showViewMenu || showZoomMenu || showAnnotateMenu
    if (!hasDropdown) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (
        target.closest("[data-menu-container]") ||
        target.closest("[data-menu-trigger]")
      ) {
        return
      }
      closeAllMenus()
    }

    window.addEventListener("pointerdown", onPointerDown)
  
  return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [showMore, showViewMenu, showZoomMenu, showAnnotateMenu, closeAllMenus])

  async function handleFit(
    mode: "page" | "width" | "actual",
    isResize = false,
    showHud = true,
  ): Promise<boolean> {
    if (!doc?.id) return false
    if (!isResize) setFitMode(mode)
    if (mode === "actual") {
      setZoom(100, false, showHud)
      return true
    }
    if (
      !containerRef.current ||
      containerRef.current.clientWidth <= 0 ||
      containerRef.current.clientHeight <= 0
    ) {
      return false
    }
    const meta = await NativePdfEngine.getPageMeta(doc.id, page - 1)
    const viewport = NativePdfEngine.getViewport(meta, 1, rotation)

    if (!containerRef.current) return false
    const availW = containerRef.current.clientWidth - 32
    const availH = containerRef.current.clientHeight - 16

    const pageW = viewport.width
    const pageH = viewport.height

    let nextZoom: number
    if (mode === "page") {
      const scaleW = availW / pageW
      const scaleH = availH / pageH
      nextZoom = Math.max(10, Math.floor(Math.min(scaleW, scaleH) * 100))
    } else {
      const scaleW = availW / pageW
      nextZoom = Math.max(10, Math.floor(scaleW * 100))
    }
    setZoom(nextZoom, true, showHud)
    return true
  }

  useEffect(() => {
    if (!isDocReady || !doc?.id || zoom > 0) return
    let active = true
    const generation = initGenerationRef.current
    const requestedMode = fitMode === "width" ? "width" : "page"
    let fitting = false

    async function fitAfterMount() {
      if (fitting || !doc?.id) return
      const container = containerRef.current
      if (
        !container ||
        container.clientWidth <= 0 ||
        container.clientHeight <= 0
      )
        return
      fitting = true
      try {
        const fitted = await handleFit(requestedMode, false, false)
        if (!fitted || !active || generation !== initGenerationRef.current)
          return
      } catch (error) {
        if (!active || generation !== initGenerationRef.current) return
        const message = error instanceof Error ? error.message : String(error)
        console.error("[READER] fit failed", {
          docId: doc.id,
          generation,
          error,
        })
        setDocLoadError(`Unable to prepare the first page: ${message}`)
      } finally {
        fitting = false
      }
    }

    void fitAfterMount()
    const container = containerRef.current
    const observer = container
      ? new ResizeObserver(() => void fitAfterMount())
      : null
    if (observer && container) observer.observe(container)
  
  return () => {
      active = false
      observer?.disconnect()
    }
  }, [isDocReady, doc?.id, zoom, fitMode, page, rotation])

  function nextMatch() {
    if (searchResults.total === 0) return
    let nextIdx = currentMatchIdx + 1
    if (nextIdx >= searchResults.total) nextIdx = 0
    setCurrentMatchIdx(nextIdx)

    let count = 0
    for (const r of searchMatches) {
      if (nextIdx >= count && nextIdx < count + r.bounds.length) {
        handleScrollRef.current?.(r.page + 1)
        break
      }
      count += r.bounds.length
    }
    setSearchResults({ current: nextIdx + 1, total: searchResults.total })
  }

  function prevMatch() {
    if (searchResults.total === 0) return
    let prevIdx = currentMatchIdx - 1
    if (prevIdx < 0) prevIdx = searchResults.total - 1
    setCurrentMatchIdx(prevIdx)

    let count = 0
    for (const r of searchMatches) {
      if (prevIdx >= count && prevIdx < count + r.bounds.length) {
        handleScrollRef.current?.(r.page + 1)
        break
      }
      count += r.bounds.length
    }
    setSearchResults({ current: prevIdx + 1, total: searchResults.total })
  }

  function handleReaderPointerMove(e: React.PointerEvent) {
    top.onPointerMove(e)
    bottom.onPointerMove(e)
  }

  function nextPage() {
    const currentBase = targetPageRef.current ?? page
    handleNavigation(currentBase + (viewMode === "two-page" ? 2 : 1))
  }

  function prevPage() {
    const currentBase = targetPageRef.current ?? page
    handleNavigation(currentBase - (viewMode === "two-page" ? 2 : 1))
  }

  function jumpPage(n: number) {
    handleNavigation(n)
  }

  const showZoomHud = useCallback((pct: number, persistMs = 650) => {
    const hud = pinchHudRef.current
    if (!hud) return
    hud.textContent = `${Math.round(pct)}%`
    hud.classList.remove("opacity-0", "scale-95")
    hud.classList.add("opacity-100", "scale-100")
    if (pinchHudTimerRef.current) clearTimeout(pinchHudTimerRef.current)
    pinchHudTimerRef.current = setTimeout(() => {
      pinchHudTimerRef.current = null
      const el = pinchHudRef.current
      if (!el) return
      el.classList.remove("opacity-100", "scale-100")
      el.classList.add("opacity-0", "scale-95")
    }, persistMs)
  }, [])

  const findAnchorTarget = useCallback(
    (
      scrollEl: HTMLElement,
      previewEl: HTMLElement,
      clientX: number,
      clientY: number,
    ): { el: HTMLElement; pageIndex: number | null } => {
      const candidates = Array.from(
        scrollEl.querySelectorAll<HTMLElement>("[data-page-index]"),
      )
      if (candidates.length === 0) return { el: previewEl, pageIndex: null }

      let bestEl = candidates[0]
      let bestDist = Infinity
      for (const candidate of candidates) {
        const r = candidate.getBoundingClientRect()
        const dx =
          clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0
        const dy =
          clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0
        const dist = dx * dx + dy * dy
        if (dist < bestDist) {
          bestDist = dist
          bestEl = candidate
          if (dist === 0) break
        }
      }
      const rawIdx = bestEl.getAttribute("data-page-index")
      const parsedIdx = rawIdx !== null ? Number(rawIdx) : NaN
      return {
        el: bestEl,
        pageIndex: Number.isFinite(parsedIdx) ? parsedIdx : null,
      }
    },
    [],
  )

  const getZoomElements = useCallback((): {
    scrollEl: HTMLElement | null
    previewEl: HTMLElement | null
  } => {
    if (viewMode.includes("continuous")) {
      return {
        scrollEl: continuousViewRef.current?.getScrollElement() ?? null,
        previewEl: continuousViewRef.current?.getPreviewElement() ?? null,
      }
    }
    return {
      scrollEl: canvasContainerRef.current,
      previewEl: previewWrapperRef.current,
    }
  }, [viewMode])

  const commitPinchZoom = useCallback(() => {
    const state = pinchStateRef.current
    if (!state || !state.active) return

    if (state.wheelTimer) {
      clearTimeout(state.wheelTimer)
      state.wheelTimer = null
    }
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }

    const finalZoom = Math.max(
      10,
      Math.min(500, Math.round(state.currentScale)),
    )
    const { previewEl, scrollEl, curClientX, curClientY, baseZoom } = state

    state.active = false
    pinchStateRef.current = null

    if (finalZoom === baseZoom) {
      previewEl.style.transform = ""
      previewEl.style.transformOrigin = ""
      previewEl.style.transition = ""
      showZoomHud(baseZoom, 350)
      return
    }

    // Measure anchor from the live scaled DOM BEFORE React re-renders so there is zero
    // 1-frame snap-back flash; transform stays until useLayoutEffect commits finalZoom.
    const anchor = findAnchorTarget(scrollEl, previewEl, curClientX, curClientY)
    const elRect = anchor.el.getBoundingClientRect()
    const u =
      elRect.width > 0 ? (curClientX - elRect.left) / elRect.width : 0.5
    const v =
      elRect.height > 0 ? (curClientY - elRect.top) / elRect.height : 0.5

    pendingZoomAnchorRef.current = {
      scrollEl,
      previewEl,
      pageIndex: anchor.pageIndex,
      u,
      v,
      focalClientX: curClientX,
      focalClientY: curClientY,
      beforeAnchorScreenX: curClientX,
      beforeAnchorScreenY: curClientY,
      prevZoom: baseZoom,
      animateFlip: false,
      clearPinchTransform: true,
    }

    setFitMode("manual")
    targetZoomRef.current = finalZoom
    showZoomHud(finalZoom, 550)
    set({ zoom: finalZoom })
  }, [set, findAnchorTarget, showZoomHud])

  const applyAnchoredZoom = useCallback(
    (
      targetZoom: number,
      focalPoint?: { clientX: number; clientY: number },
      preserveFitMode = false,
      showHud = true,
    ) => {
      const nextZoom = Math.max(10, Math.min(500, Math.round(targetZoom)))
      if (nextZoom === zoomRef.current) return

      // Clean up any in-flight pinch preview before applying discrete zoom
      if (pinchStateRef.current?.active) {
        const s = pinchStateRef.current
        if (s.wheelTimer) clearTimeout(s.wheelTimer)
        if (s.rafId !== null) cancelAnimationFrame(s.rafId)
        s.previewEl.style.transform = ""
        s.previewEl.style.transformOrigin = ""
        s.previewEl.style.transition = ""
        pinchStateRef.current = null
      }

      if (activeZoomAnimRef.current) {
        activeZoomAnimRef.current.cancel()
        activeZoomAnimRef.current = null
      }

      const { scrollEl, previewEl } = getZoomElements()
      if (scrollEl && previewEl) {
        const scrollRect = scrollEl.getBoundingClientRect()
        const focalX =
          focalPoint?.clientX ?? scrollRect.left + scrollRect.width / 2
        const focalY =
          focalPoint?.clientY ?? scrollRect.top + scrollRect.height / 2
        const anchor = findAnchorTarget(scrollEl, previewEl, focalX, focalY)
        const elRect = anchor.el.getBoundingClientRect()
        const u = elRect.width > 0 ? (focalX - elRect.left) / elRect.width : 0.5
        const v =
          elRect.height > 0 ? (focalY - elRect.top) / elRect.height : 0.5

        pendingZoomAnchorRef.current = {
          scrollEl,
          previewEl,
          pageIndex: anchor.pageIndex,
          u,
          v,
          focalClientX: focalX,
          focalClientY: focalY,
          beforeAnchorScreenX: focalX,
          beforeAnchorScreenY: focalY,
          prevZoom: zoomRef.current,
          animateFlip: true,
          clearPinchTransform: false,
        }
      }

      if (!preserveFitMode) setFitMode("manual")
      targetZoomRef.current = nextZoom
      if (showHud) showZoomHud(nextZoom, 550)
      set({ zoom: nextZoom })
    },
    [getZoomElements, findAnchorTarget, set, showZoomHud],
  )

  function zoomIn() {
    const cur = zoomRef.current
    const step = cur >= 200 ? 25 : 10
    applyAnchoredZoom(Math.min(500, cur + step))
  }

  function zoomOut() {
    const cur = zoomRef.current
    const step = cur > 200 ? 25 : 10
    applyAnchoredZoom(Math.max(10, cur - step))
  }

  function setZoom(z: number, preserveFitMode = false, showHud = true) {
    const next = Math.max(10, Math.min(500, Math.round(z)))
    if (next === zoomRef.current) {
      if (!preserveFitMode) setFitMode("manual")
      return
    }
    applyAnchoredZoom(next, undefined, preserveFitMode, showHud)
  }

  useLayoutEffect(() => {
    if (viewMode.includes("continuous")) {
      continuousViewRef.current?.measureNow()
    }

    const anchor = pendingZoomAnchorRef.current
    if (!anchor) return
    pendingZoomAnchorRef.current = null

    const { scrollEl, previewEl } = anchor
    if (anchor.clearPinchTransform) {
      previewEl.style.transform = ""
      previewEl.style.transformOrigin = ""
      previewEl.style.transition = ""
    }

    const applyAnchorScroll = () => {
      const targetEl =
        anchor.pageIndex !== null
          ? scrollEl.querySelector<HTMLElement>(
              `[data-page-index="${anchor.pageIndex}"]`,
            ) ?? previewEl
          : previewEl
      if (!targetEl) return null
      const elRect = targetEl.getBoundingClientRect()
      const desiredLeft = anchor.focalClientX - anchor.u * elRect.width
      const desiredTop = anchor.focalClientY - anchor.v * elRect.height
      const dx = elRect.left - desiredLeft
      const dy = elRect.top - desiredTop
      if (Math.abs(dx) > 0.5) {
        scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft + dx)
      }
      if (Math.abs(dy) > 0.5) {
        scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + dy)
      }
      return targetEl
    }

    const anchoredEl = applyAnchorScroll()

    if (
      anchor.animateFlip &&
      anchoredEl &&
      anchor.prevZoom > 0 &&
      zoom > 0 &&
      anchor.prevZoom !== zoom
    ) {
      const reducedMotion =
        useAppStore.getState().reduceMotion ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      if (!reducedMotion && typeof previewEl.animate === "function") {
        const afterElRect = anchoredEl.getBoundingClientRect()
        const pRect = previewEl.getBoundingClientRect()
        const invScale = Math.max(0.25, Math.min(4, anchor.prevZoom / zoom))
        const afterX = afterElRect.left + anchor.u * afterElRect.width
        const afterY = afterElRect.top + anchor.v * afterElRect.height
        const localX = afterX - pRect.left
        const localY = afterY - pRect.top
        const tx =
          anchor.beforeAnchorScreenX - afterX + (1 - invScale) * localX
        const ty =
          anchor.beforeAnchorScreenY - afterY + (1 - invScale) * localY

        activeZoomAnimRef.current?.cancel()
        const anim = previewEl.animate(
          [
            {
              transformOrigin: "0 0",
              transform: `translate3d(${tx}px, ${ty}px, 0) scale(${invScale})`,
            },
            {
              transformOrigin: "0 0",
              transform: "translate3d(0px, 0px, 0px) scale(1)",
            },
          ],
          {
            duration: 165,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        )
        activeZoomAnimRef.current = anim
        anim.onfinish = () => {
          if (activeZoomAnimRef.current === anim) {
            activeZoomAnimRef.current = null
          }
        }
      }
    }

    if (anchor.clearPinchTransform && viewMode.includes("continuous")) {
      const frame = requestAnimationFrame(() => {
        applyAnchorScroll()
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [zoom, viewMode])

  useEffect(() => {
    targetZoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    return () => {
      if (pinchHudTimerRef.current) {
        clearTimeout(pinchHudTimerRef.current)
        pinchHudTimerRef.current = null
      }
    }
  }, [])

  const commitPinchZoomRef = useRef(commitPinchZoom)
  commitPinchZoomRef.current = commitPinchZoom

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const schedulePinchFrame = () => {
      const state = pinchStateRef.current
      if (!state || !state.active) return
      showZoomHud(state.currentScale, 450)
      if (state.rafId !== null) return
      state.rafId = requestAnimationFrame(() => {
        const current = pinchStateRef.current
        if (!current || !current.active) return
        current.rafId = null
        const ratio = current.currentScale / current.baseZoom
        const tx =
          current.curClientX -
          current.basePreviewRect.left -
          ratio * current.localOriginX
        const ty =
          current.curClientY -
          current.basePreviewRect.top -
          ratio * current.localOriginY
        current.previewEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${ratio})`
      })
    }

    const startPinchSession = (
      clientX: number,
      clientY: number,
      startDist = 0,
    ) => {
      const { scrollEl, previewEl } = getZoomElements()
      if (!scrollEl || !previewEl) return null

      if (activeZoomAnimRef.current) {
        activeZoomAnimRef.current.cancel()
        activeZoomAnimRef.current = null
      }

      const basePreviewRect = previewEl.getBoundingClientRect()
      previewEl.style.transformOrigin = "0 0"
      previewEl.style.transition = "none"

      const state = {
        active: true,
        baseZoom: zoomRef.current > 0 ? zoomRef.current : 100,
        currentScale: zoomRef.current > 0 ? zoomRef.current : 100,
        startClientX: clientX,
        startClientY: clientY,
        curClientX: clientX,
        curClientY: clientY,
        basePreviewRect,
        localOriginX: clientX - basePreviewRect.left,
        localOriginY: clientY - basePreviewRect.top,
        scrollEl,
        previewEl,
        wheelTimer: null,
        rafId: null,
        startDist,
      }
      pinchStateRef.current = state
      return state
    }

    const isIgnoredPinchTarget = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null
      if (!el) return false
      return Boolean(
        el.closest("[role='dialog']") ||
          el.closest("[data-reader-sidebar]") ||
          el.closest("[data-menu-container]") ||
          el.closest("[data-selection-popover]"),
      )
    }

    const isContainerVisible = () => {
      const rect = container.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    const getPointerPair = (
      pointers: Map<number, { clientX: number; clientY: number }>,
    ) => {
      const iter = pointers.values()
      const first = iter.next().value
      const second = iter.next().value
      if (!first || !second) return null
      const dist = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      )
      if (dist <= 0) return null
      return {
        dist,
        midX: (first.clientX + second.clientX) / 2,
        midY: (first.clientY + second.clientY) / 2,
      }
    }

    const activeTouchPointers = new Map<
      number,
      { clientX: number; clientY: number }
    >()
    let touchEventActive = false

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (!isContainerVisible() || zoomRef.current <= 0) return
      e.preventDefault()

      if (isIgnoredPinchTarget(e.target)) {
        return
      }
      e.stopPropagation()

      const rawDelta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * 400
            : e.deltaY

      let state = pinchStateRef.current
      if (!state || !state.active) {
        if (rawDelta === 0) return
        window.getSelection()?.removeAllRanges()
        state = startPinchSession(e.clientX, e.clientY, 0)
        if (!state) return
      } else {
        state.curClientX = e.clientX
        state.curClientY = e.clientY
      }

      if (rawDelta !== 0) {
        const isDiscreteWheel = Math.abs(rawDelta) >= 40
        const clamped = isDiscreteWheel
          ? Math.sign(rawDelta) * Math.min(120, Math.abs(rawDelta))
          : Math.max(-36, Math.min(36, rawDelta))
        const sensitivity = isDiscreteWheel ? 0.0022 : 0.0115
        const factor = Math.exp(-clamped * sensitivity)

        state.currentScale = Math.max(
          10,
          Math.min(500, state.currentScale * factor),
        )
        schedulePinchFrame()
      }

      if (state.wheelTimer) clearTimeout(state.wheelTimer)
      state.wheelTimer = setTimeout(() => {
        commitPinchZoomRef.current()
      }, 180)
    }

    const beginOrReanchorTouchPinch = (
      midX: number,
      midY: number,
      dist: number,
    ) => {
      const existing = pinchStateRef.current
      if (existing?.active) {
        if (existing.wheelTimer) {
          clearTimeout(existing.wheelTimer)
          existing.wheelTimer = null
        }
        existing.startDist = dist
        existing.baseZoom = existing.currentScale
        existing.curClientX = midX
        existing.curClientY = midY
        return
      }
      startPinchSession(midX, midY, dist)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      if (!isContainerVisible() || zoomRef.current <= 0) return
      if (isIgnoredPinchTarget(e.target)) return

      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      )
      if (dist <= 0) return

      touchEventActive = true
      e.preventDefault()
      e.stopPropagation()
      window.getSelection()?.removeAllRanges()

      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2
      beginOrReanchorTouchPinch(midX, midY, dist)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchEventActive || e.touches.length < 2) return
      const state = pinchStateRef.current
      if (!state?.active || state.startDist <= 0) return

      e.preventDefault()
      e.stopPropagation()
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      )
      if (dist <= 0) return

      state.curClientX = (t1.clientX + t2.clientX) / 2
      state.curClientY = (t1.clientY + t2.clientY) / 2
      const nextScale = (dist / state.startDist) * state.baseZoom
      state.currentScale = Math.max(10, Math.min(500, nextScale))

      schedulePinchFrame()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchEventActive = false
        if (pinchStateRef.current?.active && pinchStateRef.current.startDist > 0) {
          commitPinchZoomRef.current()
        }
      }
    }

    // Fallback for Windows touch drivers that dispatch PointerEvents without TouchEvents
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      if (!isContainerVisible() || zoomRef.current <= 0) return
      if (isIgnoredPinchTarget(e.target)) return

      activeTouchPointers.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      })

      if (touchEventActive || activeTouchPointers.size < 2) return
      const pair = getPointerPair(activeTouchPointers)
      if (!pair) return

      if (e.cancelable) e.preventDefault()
      window.getSelection()?.removeAllRanges()
      beginOrReanchorTouchPinch(pair.midX, pair.midY, pair.dist)
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !activeTouchPointers.has(e.pointerId)) {
        return
      }
      activeTouchPointers.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      })

      if (touchEventActive || activeTouchPointers.size < 2) return
      const state = pinchStateRef.current
      if (!state?.active || state.startDist <= 0) return

      const pair = getPointerPair(activeTouchPointers)
      if (!pair) return

      if (e.cancelable) e.preventDefault()
      state.curClientX = pair.midX
      state.curClientY = pair.midY
      const nextScale = (pair.dist / state.startDist) * state.baseZoom
      state.currentScale = Math.max(10, Math.min(500, nextScale))
      schedulePinchFrame()
    }

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      activeTouchPointers.delete(e.pointerId)
      if (
        !touchEventActive &&
        activeTouchPointers.size < 2 &&
        pinchStateRef.current?.active &&
        pinchStateRef.current.startDist > 0
      ) {
        commitPinchZoomRef.current()
      }
    }

    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    })
    container.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: false,
    })
    container.addEventListener("touchmove", handleTouchMove, {
      capture: true,
      passive: false,
    })
    container.addEventListener("touchend", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    container.addEventListener("touchcancel", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    container.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
      passive: false,
    })
    container.addEventListener("pointermove", handlePointerMove, {
      capture: true,
      passive: false,
    })
    container.addEventListener("pointerup", handlePointerUpOrCancel, {
      capture: true,
      passive: true,
    })
    container.addEventListener("pointercancel", handlePointerUpOrCancel, {
      capture: true,
      passive: true,
    })

    return () => {
      activeTouchPointers.clear()
      touchEventActive = false
      window.removeEventListener("wheel", handleWheel, true)
      container.removeEventListener("touchstart", handleTouchStart, true)
      container.removeEventListener("touchmove", handleTouchMove, true)
      container.removeEventListener("touchend", handleTouchEnd, true)
      container.removeEventListener("touchcancel", handleTouchEnd, true)
      container.removeEventListener("pointerdown", handlePointerDown, true)
      container.removeEventListener("pointermove", handlePointerMove, true)
      container.removeEventListener("pointerup", handlePointerUpOrCancel, true)
      container.removeEventListener(
        "pointercancel",
        handlePointerUpOrCancel,
        true,
      )
      if (pinchStateRef.current) {
        if (pinchStateRef.current.wheelTimer)
          clearTimeout(pinchStateRef.current.wheelTimer)
        if (pinchStateRef.current.rafId !== null)
          cancelAnimationFrame(pinchStateRef.current.rafId)
        pinchStateRef.current.previewEl.style.transform = ""
        pinchStateRef.current.previewEl.style.transformOrigin = ""
        pinchStateRef.current.previewEl.style.transition = ""
        pinchStateRef.current = null
      }
    }
  }, [viewMode, getZoomElements, showZoomHud])

  function rotate() {
    set({ rotation: (rotation + 90) % 360 })
  }

  function setViewMode(m: ViewMode) {
    set({ viewMode: m })
  }

  const toggleProReaderMode = useCallback(() => {
    setIsProReaderMode((prev) => {
      const next = !prev
      if (!next) {
        top.reveal()
        bottom.reveal()
      }
      return next
    })
  }, [top.reveal, bottom.reveal])

  function handleBackToLibrary() {
    if (isProReaderMode) {
      setIsProReaderMode(false)
    }
    onBack()
  }

  function toggleBookmark() {
    const existing = bookmarks.findIndex((b) => b.page === page)
    if (existing >= 0) {
      set({ bookmarks: bookmarks.filter((_, i) => i !== existing) })
    } else {
      const label = `Page ${page}`
      set({ bookmarks: [...bookmarks, { page, label }] })
    }
  }

  const isBookmarked = bookmarks.some((b) => b.page === page)

  async function handleOpenAnotherPdf() {
    closeAllMenus()
    if (onOpenFileDialog) {
      await onOpenFileDialog()
      return
    }
    try {
      const selected = await openLocalPdf()
      if (!selected) return
      const existingDocs = useAppStore.getState().documents
      const result = await openPdfFilesDirect([selected], existingDocs)
      if (result.opened.length > 0) {
        await saveDocument(result.opened[0])
        onOpenDoc(result.opened[0])
      }
    } catch (e) {
      console.error("Failed to open another PDF:", e)
    }
  }

  async function handleAddCurrentToLibrary() {
    closeAllMenus()
    if (!doc) return
    await addDocumentToLibrary(doc.id)
    onNotice?.(`Added "${doc.name}" to Library`)
  }

  /** Writes the current annotations into a new PDF, leaving the original untouched. */
  async function handleExportAnnotated() {
    closeAllMenus()
    if (!doc) return
    if (!isTauriContext()) {
      onNotice?.("Exporting needs the desktop app", true)
      return
    }
    const sourcePath = doc.path || doc.id
    if (!sourcePath) {
      onNotice?.("This document has no file path", true)
      return
    }

    const annotations = useAnnotationStore.getState().annotations[doc.id] ?? []
    const payload = toExportAnnotations(annotations)
    if (payload.length === 0) {
      onNotice?.("There are no annotations to export")
      return
    }

    try {
      const destination = await save({
        title: "Export annotated copy",
        defaultPath: `${String(doc.name).replace(/\.pdf$/i, "")} (annotated).pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      })
      if (!destination) return

      const exported = await invoke<number>("pdf_export_annotated", {
        sourcePath,
        destination,
        annotations: payload,
      })
      onNotice?.(
        `Exported ${exported} annotation${exported === 1 ? "" : "s"} to ${destination}`,
      )
    } catch (error: any) {
      onNotice?.(`Export failed: ${String(error?.message || error)}`, true)
    }
  }

  /** Renders a single page to a data URL for the print preview thumbnail. */
  const renderPrintPreview = useCallback(
    async (pageIndex: number, scale: number): Promise<string | null> => {
      try {
        const bytes = await NativePdfEngine.renderPage(doc.id, pageIndex, scale, 0, 100)
        if (bytes.byteLength < 8) return null
        const header = new DataView(bytes.buffer, bytes.byteOffset, 8)
        const width = header.getUint32(0, true)
        const height = header.getUint32(4, true)
        if (!width || !height || bytes.byteLength < 8 + width * height * 4) {
          return null
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d", { alpha: false })
        if (!context) return null
        const pixels = new Uint8ClampedArray(
          bytes.buffer,
          bytes.byteOffset + 8,
          width * height * 4,
        )
        context.putImageData(new ImageData(pixels as any, width, height), 0, 0)
        return canvas.toDataURL("image/png")
      } catch {
        return null
      }
    },
    [doc.id],
  )

  /**
   * Emits the pages chosen in the print sheet through `services/print.ts`. Printing the live
   * DOM would only capture the pages the virtualiser happens to have mounted.
   */
  async function handlePrint(
    indexes: number[],
    includeAnnotations: boolean,
  ) {
    if (!doc) return
    try {
      const pageAnnotations = includeAnnotations
        ? (useAnnotationStore.getState().annotations[doc.id] ?? [])
        : []
      const printed = await printPages(doc.id, indexes, pageAnnotations)
      if (printed === 0) {
        onNotice?.("Nothing could be rendered for printing", true)
      }
    } catch (error: any) {
      onNotice?.(`Print failed: ${String(error?.message || error)}`, true)
    }
  }

  // ── Command palette ───────────────────────────────────────
  const paletteCommands = [
    {
      id: "prev",
      label: "Previous page",
      category: "Navigation",
      shortcut: "←",
      action: prevPage,
    },
    {
      id: "next",
      label: "Next page",
      category: "Navigation",
      shortcut: "→",
      action: nextPage,
    },
    {
      id: "pages",
      label: "Open Pages",
      category: "Navigation",
      shortcut: "P",
      action: () => {
        setShowThumbs(true)
        setThumbsTab("pages")
      },
    },
    {
      id: "outline",
      label: "Open Outline",
      category: "Navigation",
      shortcut: "O",
      action: () => {
        setShowThumbs(true)
        setThumbsTab("outline")
      },
    },
    {
      id: "single",
      label: "Single page",
      category: "View",
      shortcut: `${MOD_LABEL}+1`,
      action: () => setViewMode("single"),
    },
    {
      id: "two",
      label: "Two pages",
      category: "View",
      shortcut: `${MOD_LABEL}+2`,
      action: () => setViewMode("two-page"),
    },
    {
      id: "continuous",
      label: "Continuous",
      category: "View",
      shortcut: `${MOD_LABEL}+3`,
      action: () => setViewMode("continuous"),
    },
    {
      id: "two-continuous",
      label: "Two-page continuous",
      category: "View",
      shortcut: `${MOD_LABEL}+4`,
      action: () => setViewMode("two-page-continuous"),
    },
    {
      id: "fitpage",
      label: "Fit page",
      category: "View",
      shortcut: `${MOD_LABEL}+0`,
      action: () => handleFit("page"),
    },
    {
      id: "fitwidth",
      label: "Fit width",
      category: "View",
      shortcut: `${MOD_LABEL}+${SHIFT_LABEL}+0`,
      action: () => handleFit("width"),
    },
    {
      id: "actual",
      label: "Actual size",
      category: "View",
      action: () => handleFit("actual"),
    },
    {
      id: "pro-reader",
      label: isProReaderMode
        ? "Exit Pro Reader Mode"
        : "Pro Reader Mode (Full Canvas)",
      category: "View",
      shortcut: "F",
      action: toggleProReaderMode,
    },
    {
      id: "window-fullscreen",
      label: "Window Fullscreen (Hide Taskbar)",
      category: "View",
      shortcut: "F11",
      action: toggleFullscreen,
    },
    {
      id: "zoomin",
      label: "Zoom in",
      category: "View",
      shortcut: `${MOD_LABEL}++`,
      action: zoomIn,
    },
    {
      id: "zoomout",
      label: "Zoom out",
      category: "View",
      shortcut: `${MOD_LABEL}+−`,
      action: zoomOut,
    },
    {
      id: "bookmark",
      label: isBookmarked ? "Remove bookmark" : "Bookmark page",
      category: "Document",
      shortcut: "B",
      action: toggleBookmark,
    },
    {
      id: "search",
      label: "Search document",
      category: "Document",
      shortcut: `${MOD_LABEL}+F`,
      action: () => {
        setShowSearch(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      },
    },
    {
      id: "docinfo",
      label: "Document information",
      category: "Document",
      action: () => setShowDocInfo(true),
    },
    ...(doc?.inLibrary === false
      ? [
          {
            id: "addtolibrary",
            label: "Add to Library",
            category: "Document" as const,
            action: () => {
              void handleAddCurrentToLibrary()
            },
          },
        ]
      : []),
    {
      id: "print",
      label: "Print",
      category: "Document",
      action: () => setShowPrintPreview(true),
    },
    {
      id: "select",
      label: "Select / Cursor",
      category: "Annotation",
      shortcut: "V",
      action: () => setActiveTool("select"),
    },
    {
      id: "highlight",
      label: "Highlighter",
      category: "Annotation",
      shortcut: "H",
      action: () => setActiveTool("highlight"),
    },
    {
      id: "pen",
      label: "Pen (Draw)",
      category: "Annotation",
      shortcut: "D",
      action: () => setActiveTool("pen"),
    },
    {
      id: "note",
      label: "Sticky Note",
      category: "Annotation",
      shortcut: "N",
      action: () => setActiveTool("note"),
    },
    {
      id: "eraser",
      label: "Eraser",
      category: "Annotation",
      shortcut: "E",
      action: () => setActiveTool("eraser"),
    },
    {
      id: "undo",
      label: "Undo",
      category: "Edit",
      shortcut: `${MOD_LABEL}+Z`,
      action: () => {
        if (doc?.id) undoAnnotations(doc.id)
      },
    },
    {
      id: "redo",
      label: "Redo",
      category: "Edit",
      shortcut: `${MOD_LABEL}+${SHIFT_LABEL}+Z`,
      action: () => {
        if (doc?.id) redoAnnotations(doc.id)
      },
    },
    {
      id: "rotate",
      label: "Rotate clockwise",
      category: "Rotation",
      shortcut: "R",
      action: rotate,
    },
  ]

  const pageNum = paletteQuery.trim() ? parseInt(paletteQuery.trim()) : NaN

  const goToPageCmd =
    !isNaN(pageNum) && pageNum >= 1 && pageNum <= actualNumPages
      ? [
          {
            id: "goto",
            label: `Go to page ${pageNum}`,
            category: "Navigate",
            shortcut: undefined,
            action: () => jumpPage(pageNum),
          },
        ]
      : []

  const filteredCmds = paletteQuery.trim()
    ? [
        ...goToPageCmd,
        ...paletteCommands.filter((c) =>
          c.label.toLowerCase().includes(paletteQuery.toLowerCase()),
        ),
      ]
    : paletteCommands

  const groupedCmds = paletteQuery.trim()
    ? null
    : ([
        "Navigation",
        "View",
        "Document",
        "Annotation",
        "Edit",
        "Rotation",
      ] as const).map((cat) => ({
        cat,
        items: paletteCommands.filter((c) => c.category === cat),
      }))

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === "INPUT" || tag === "TEXTAREA"

      if ((e.metaKey || e.ctrlKey) && e.key === "Tab") {
        e.preventDefault()
        if (tabs.length > 1) {
          const nextIdx = e.shiftKey
            ? (activeTabIdx - 1 + tabs.length) % tabs.length
            : (activeTabIdx + 1) % tabs.length
          onTabChange(nextIdx)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        e.preventDefault()
        onTabClose(activeTabIdx)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShowPalette(true)
        setPaletteQuery("")
        setPaletteIdx(0)
        setTimeout(() => paletteRef.current?.focus(), 50)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault()
        bottom.reveal()
        if (pageInputRef.current) {
          pageInputRef.current.focus()
          pageInputRef.current.select()
        } else {
          setShowPalette(true)
          setPaletteQuery(String(page))
          setTimeout(() => paletteRef.current?.focus(), 50)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault()
        handleOpenAnotherPdf()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchRef.current?.focus(), 50)
        return
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault()
        zoomIn()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault()
        zoomOut()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault()
        void handleFit(e.shiftKey ? "width" : "page")
        return
      }

      if ((e.metaKey || e.ctrlKey) && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        const modes: Record<string, ViewMode> = {
          "1": "single",
          "2": "two-page",
          "3": "continuous",
          "4": "two-page-continuous",
        }
        setViewMode(modes[e.key])
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !inInput) {
        const nativeSelected = window.getSelection()?.toString().trim()
        if (!nativeSelected && textSelection?.text) {
          e.preventDefault()
          void navigator.clipboard?.writeText(textSelection.text)
          return
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (doc?.id) {
          if (e.shiftKey) redoAnnotations(doc.id)
          else undoAnnotations(doc.id)
        }
        return
      }

      if (showPalette) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setPaletteIdx((i) => Math.min(filteredCmds.length - 1, i + 1))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setPaletteIdx((i) => Math.max(0, i - 1))
        } else if (e.key === "Enter") {
          e.preventDefault()
          filteredCmds[paletteIdx]?.action()
          setShowPalette(false)
        } else if (e.key === "Escape") {
          setShowPalette(false)
        }
        return
      }

      if (inInput) return


      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextPage()
          break
        case "ArrowLeft":
        case "ArrowUp":
          prevPage()
          break
        case "Home":
          e.preventDefault()
          jumpPage(1)
          break
        case "End":
          e.preventDefault()
          jumpPage(actualNumPages)
          break
        case "r":
        case "R":
          rotate()
          break
        case "f":
        case "F":
          toggleProReaderMode()
          break
        case "b":
        case "B":
          toggleBookmark()
          break
        case "p":
        case "P":
          setShowThumbs((v) => !(v && thumbsTab === "pages"))
          setThumbsTab("pages")
          break
        case "o":
        case "O":
          setShowThumbs((v) => !(v && thumbsTab === "outline"))
          setThumbsTab("outline")
          break
        case "h":
        case "H":
          if (textSelection) createSelectionAnnotation("highlight")
          else
            setActiveTool((t) => (t === "highlight" ? "select" : "highlight"))
          break
        case "u":
        case "U":
          if (textSelection) createSelectionAnnotation("underline")
          break
        case "s":
        case "S":
          if (textSelection) createSelectionAnnotation("strikethrough")
          break
        case "v":
        case "V":
          setActiveTool("select")
          break
        case "d":
        case "D":
          setActiveTool((t) => (t === "pen" ? "select" : "pen"))
          break

        case "n":
        case "N":
          setActiveTool((t) => (t === "note" ? "select" : "note"))
          break
        case "e":
        case "E":
          setActiveTool((t) => (t === "eraser" ? "select" : "eraser"))
          break
        case "Tab":
          e.preventDefault()
          top.toggleManual()
          bottom.toggleManual()
          break
        case "F11":
          e.preventDefault()
          void toggleFullscreen()
          break
        case "Escape":
          e.preventDefault()
          if (showDocInfo) {
            setShowDocInfo(false)
          } else if (showPalette) {
            setShowPalette(false)
          } else if (
            showMore ||
            showViewMenu ||
            showZoomMenu ||
            showAnnotateMenu
          ) {
            closeAllMenus()
          } else if (showSearch) {
            setShowSearch(false)
            setSearchQuery("")
          } else if (textSelection) {
            clearSelection()
          } else if (activeTool !== "select") {
            setActiveTool("select")
          } else if (isProReaderMode) {
            setIsProReaderMode(false)
            top.reveal()
            bottom.reveal()
          }
          break
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    showPalette,
    showSearch,
    showThumbs,
    thumbsTab,
    showDocInfo,
    isFullscreen,
    setFullscreen,
    top.toggleManual,
    bottom.toggleManual,
    bottom.reveal,
    showAnnotateMenu,
    showMore,
    showViewMenu,
    showZoomMenu,
    closeAllMenus,
    filteredCmds,
    paletteIdx,
    page,
    actualNumPages,
    zoom,
    rotation,
    viewMode,
    bookmarks,
    activeTool,
    textSelection,
    textSelection,
    clearSelection,
    doc?.id,
    undoAnnotations,
    redoAnnotations,
    createSelectionAnnotation,
    tabs,
    activeTabIdx,
    onTabChange,
    onTabClose,
    onBack,
  ])

  const sortedBookmarks = useMemo(
    () => [...bookmarks].sort((a, b) => a.page - b.page),
    [bookmarks],
  )

  // Guard — all hooks are declared above this line, so early return is 100% safe
  if (!tab || !doc) return null

  const twoZoom = zoom
  const panelW = showThumbs ? 224 : 0

  const renderTabBar = (extraClassName = "") => (
    <div
      className={`shrink-0 flex items-center bg-background border-b border-border/80 overflow-x-auto h-9 min-h-9 px-2 gap-1 select-none ${extraClassName}`}
      onPointerEnter={() => top.hold("hover")}
      onPointerLeave={() => top.release("hover")}
    >
      {tabs.map((t, i) => {
        const isActive = i === activeTabIdx

      
  return (
          <div
            key={t.doc?.id}
            onClick={() => onTabChange(i)}
            className={`relative flex items-center gap-2 px-3 h-7 shrink-0 cursor-pointer rounded-md border transition-all duration-150 ease-out min-w-[130px] max-w-[280px] group ${
              closingTabId === t.doc?.id
                ? "opacity-0 scale-95 -translate-y-0.5"
                : ""
            } ${
              isActive
                ? "bg-card text-foreground font-medium border-border/80 shadow-xs"
                : "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent"
            }`}
          >
            <FileTextIcon
              size={12}
              className={`shrink-0 ${
                isActive ? "text-primary" : "text-muted-foreground/60"
              }`}
            />
            <span className="text-[11.5px] truncate flex-1 tracking-tight">
              {t.doc.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (closingTabId) return
                setClosingTabId(t.doc.id)
                window.setTimeout(() => {
                  onTabClose(i)
                  setClosingTabId(null)
                }, 160)
              }}
              className={`shrink-0 p-1 rounded-sm transition-colors ml-auto ${
                isActive
                  ? "text-muted-foreground/80 hover:text-foreground hover:bg-muted"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Close tab (Ctrl+W)"
            >
              <XIcon size={10} />
            </button>
          </div>
        )
      })}
      <button
        onClick={() => void handleOpenAnotherPdf()}
        className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 ml-0.5"
        title="Open another PDF (Ctrl+O)"
      >
        <PlusIcon size={13} />
      </button>
    </div>
  )

  if (!tab || !doc) {
  
  return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground p-6 select-none font-sans gap-3">
        <AuraLogo size={48} className="opacity-80 hover:opacity-100 transition-opacity" />
        <p className="text-sm text-muted-foreground">No document available to display</p>
        <button
          onClick={onBack}
          className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all active:scale-[0.98]"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }


  return (
    <div
      className="flex flex-col bg-muted/60 dark:bg-background h-full relative overflow-hidden select-none"
      onPointerMove={handleReaderPointerMove}
      style={{ touchAction: "pan-x pan-y" }}
    >
      {/* ── PINNED TAB BAR (Normal mode: tabs pinned at very top) ─── */}
      {!isProReaderMode && renderTabBar("relative z-40")}

      {/* ── HEADER (DOCUMENT TOOLBAR / "Unit 4 COA bar") ───────────── */}
      <header
        {...top.surfaceProps}
        className={`absolute inset-x-0 z-30 shadow-2xl transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          isProReaderMode ? "top-0" : "top-8"
        } ${
          top.visible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        {/* ── TOP TOOLBAR ("Unit 4 COA bar") ─────────────────── */}
        <div className="shrink-0 flex items-center h-10 px-3 gap-1.5 bg-card border-b border-border">
          {/* Left: back + title */}
          <button
            onClick={handleBackToLibrary}
            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Back to library (Esc)"
          >
            <ArrowLeftIcon size={13} />
            <span className="hidden sm:inline max-w-[200px] truncate text-foreground font-medium text-[12px]">
              {doc.name}
            </span>
          </button>

          {/* Pages/bookmarks/outline toggle */}
          <ToolBtn
            onClick={() => setShowThumbs((v) => !v)}
            title="Pages, Bookmarks & Outline (P / O)"
            active={showThumbs}
          >
            <LayersIcon size={13} />
          </ToolBtn>


          {/* Right: Search | Annotate Dropdown | View | Bookmark | Fullscreen | More */}
          <div className="flex items-center gap-0.5 ml-auto">
            {/* Search */}
            {showSearch ? (
              <div className="flex items-center gap-1.5 bg-muted rounded border border-border px-2 py-1 focus-within:border-foreground/25 transition-colors">
                <SearchIcon
                  size={12}
                  className="text-muted-foreground shrink-0"
                />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.shiftKey ? prevMatch() : nextMatch()
                    }
                  }}
                  placeholder="Search in document…"
                  className="w-36 text-[11px] bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none"
                />
                {searchQuery && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {searchResults.total > 0
                      ? `${searchResults.current} / ${searchResults.total}`
                      : "0"}
                  </span>
                )}
                {searchQuery && searchResults.total > 0 && (
                  <div className="flex items-center gap-0.5 border-l border-border pl-1.5 ml-1">
                    <button
                      onClick={prevMatch}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                    >
                      <ChevronLeftIcon size={12} />
                    </button>
                    <button
                      onClick={nextMatch}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                    >
                      <ChevronRightIcon size={12} />
                    </button>
                  </div>
                )}
                <div className="h-3.5 w-px bg-border mx-1 shrink-0" />
                <button
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery("")
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                >
                  <XIcon size={11} />
                </button>
              </div>
            ) : (
              <ToolBtn
                onClick={() => {
                  setShowSearch(true)
                  setTimeout(() => searchRef.current?.focus(), 50)
                }}
                title={`Search (${MOD_LABEL}+F)`}
              >
                <SearchIcon size={13} />
              </ToolBtn>
            )}

            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Annotate dropdown */}
            <div className="relative">
              <ToolBtn
                data-menu-trigger="annotate"
                onClick={toggleAnnotateMenu}
                title="Annotation tools (V, H, D, N, E)"
                active={showAnnotateMenu || activeTool !== "select"}
              >
                <div className="relative flex items-center justify-center">
                  {activeTool === "highlight" ? (
                    <HighlighterIcon size={13} />
                  ) : activeTool === "pen" ? (
                    <PenIcon size={13} />
                  ) : activeTool === "note" ? (
                    <StickyNoteIcon size={13} />
                  ) : activeTool === "eraser" ? (
                    <EraserIcon size={13} />
                  ) : (
                    <HighlighterIcon size={13} />
                  )}
                  {activeTool !== "select" && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-primary ring-1 ring-card" />
                  )}
                </div>
              </ToolBtn>

              {showAnnotateMenu && (
                <div
                  data-menu-container="annotate"
                  className="absolute top-full right-0 mt-1.5 bg-card/95 border border-border rounded-xl shadow-xl py-1 px-1 w-44 z-50 dropdown-in backdrop-blur-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-0.5">
                    {[
                      {
                        id: "select" as const,
                        label: "Select",
                        icon: MousePointerIcon,
                        sc: "V",
                      },
                      {
                        id: "highlight" as const,
                        label: "Highlighter",
                        icon: HighlighterIcon,
                        sc: "H",
                      },
                      {
                        id: "pen" as const,
                        label: "Pen",
                        icon: PenIcon,
                        sc: "D",
                      },
                      {
                        id: "note" as const,
                        label: "Sticky Note",
                        icon: StickyNoteIcon,
                        sc: "N",
                      },
                      {
                        id: "eraser" as const,
                        label: "Eraser",
                        icon: EraserIcon,
                        sc: "E",
                      },
                    ].map(({ id, label, icon: Icon, sc }) => {
                      const isActive = activeTool === id

                      return (
                        <div key={id}>
                          <button
                            onClick={() => {
                              // Selecting the tool reveals its options in place below;
                              // the menu no longer closes and re-opens elsewhere.
                              setActiveTool(id)
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon
                                size={12}
                                className={
                                  isActive
                                    ? "text-primary-foreground"
                                    : "text-muted-foreground"
                                }
                              />
                              <span>{label}</span>
                            </div>
                            <kbd
                              className={`text-[9px] font-mono ${
                                isActive
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {sc}
                            </kbd>
                          </button>

                          {/* Tool options live with the tool, not in a separate pill. */}
                          {isActive && id !== "select" && (
                            <div className="mx-1 mb-1 mt-1 rounded-lg border border-border/70 bg-secondary/60 p-2">
                              {(id === "highlight" || id === "pen") && (
                                <div
                                  className="mb-2 flex flex-wrap items-center gap-1.5"
                                  role="listbox"
                                  aria-label={
                                    id === "highlight"
                                      ? "Highlighter colour"
                                      : "Pen colour"
                                  }
                                >
                                  {paletteFor(id).map((swatch) => {
                                    const current =
                                      id === "highlight"
                                        ? toolSettings.highlightColor
                                        : toolSettings.penColor
                                    const selected =
                                      swatch.value.toLowerCase() ===
                                      current.toLowerCase()
                                    return (
                                      <button
                                        key={swatch.value}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        title={swatch.label ?? swatch.value}
                                        onClick={() =>
                                          setToolSettings(
                                            id === "highlight"
                                              ? { highlightColor: swatch.value }
                                              : { penColor: swatch.value },
                                          )
                                        }
                                        className="h-5 w-5 rounded-full transition-transform duration-150 hover:scale-110"
                                        style={{
                                          backgroundColor: swatch.value,
                                          boxShadow: selected
                                            ? "0 0 0 2px var(--card), 0 0 0 3.5px var(--primary)"
                                            : "inset 0 0 0 1px rgba(255,255,255,0.25)",
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              )}

                              <div className="flex items-center gap-1">
                                {(id === "eraser"
                                  ? [
                                      { label: "S", value: 14 },
                                      { label: "M", value: 24 },
                                      { label: "L", value: 40 },
                                    ]
                                  : id === "highlight"
                                    ? [
                                        { label: "Fine", value: 12 },
                                        { label: "Chisel", value: 16 },
                                        { label: "Broad", value: 24 },
                                      ]
                                    : [
                                        { label: "Fine", value: 1.5 },
                                        { label: "Med", value: 2.5 },
                                        { label: "Bold", value: 4 },
                                      ]
                                ).map((preset) => {
                                  const current =
                                    id === "eraser"
                                      ? (toolSettings.eraserRadius || 24)
                                      : id === "highlight"
                                        ? toolSettings.highlightWidth
                                        : toolSettings.penWidth
                                  const selected = current === preset.value
                                  return (
                                    <button
                                      key={preset.value}
                                      type="button"
                                      onClick={() =>
                                        setToolSettings(
                                          id === "eraser"
                                            ? { eraserRadius: preset.value }
                                            : id === "highlight"
                                              ? { highlightWidth: preset.value }
                                              : { penWidth: preset.value },
                                        )
                                      }
                                      className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors ${
                                        selected
                                          ? "bg-primary text-primary-foreground"
                                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* View — layout & fit options */}
            <div className="relative">
              <ToolBtn
                data-menu-trigger="view"
                onClick={toggleViewMenu}
                title="View layout"
                active={showViewMenu}
              >
                {viewMode === "two-page" ||
                viewMode === "two-page-continuous" ? (
                  <GridIcon size={13} />
                ) : viewMode === "continuous" ? (
                  <svg
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                ) : (
                  <ListIcon size={13} />
                )}
              </ToolBtn>

              {showViewMenu && (
                <div
                  data-menu-container="view"
                  className="absolute top-full right-0 mt-1.5 bg-card border border-border rounded-lg shadow-xl py-1.5 w-48 z-50 dropdown-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-1.5">
                    Layout
                  </p>
                  {([
                    ["single", "Single page", `${MOD_LABEL}+1`],
                    ["two-page", "Two pages", `${MOD_LABEL}+2`],
                    ["continuous", "Continuous", `${MOD_LABEL}+3`],
                    ["two-page-continuous", "Two-page continuous", `${MOD_LABEL}+4`],
                  ] as const).map(([id, label, sc]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setViewMode(id)
                        setShowViewMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between transition-colors ${
                        viewMode === id
                          ? "text-primary bg-primary/8 font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span>{label}</span>
                      <kbd className="text-[10px] text-muted-foreground font-mono">
                        {sc}
                      </kbd>
                    </button>
                  ))}
                  <div className="border-t border-border/60 my-1.5" />
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1.5">
                    Fit
                  </p>
                  {[
                    { label: "Fit page", v: "page" },
                    { label: "Fit width", v: "width" },
                    { label: "Actual size", v: "actual" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        void handleFit(p.v as any)
                        setShowViewMenu(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                        (p.v === "actual" && zoom === 100) || fitMode === p.v
                          ? "text-primary bg-primary/8 font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="border-t border-border/60 my-1.5" />
                  <div className="flex items-center gap-0.5 px-2 pb-1">
                    <button
                      onClick={zoomOut}
                      title={`Zoom out (${MOD_LABEL}+−)`}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ZoomOutIcon size={12} />
                    </button>
                    <button
                      onClick={toggleZoomMenu}
                      className="flex-1 text-center py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors relative"
                    >
                      {zoom}%
                      {showZoomMenu && (
                        <div
                          data-menu-container="zoom"
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-28 bg-card border border-border rounded shadow-lg py-1 z-50 dropdown-up"
                        >
                          {ZOOM_PRESETS.map((z) => (
                            <button
                              key={z}
                              onClick={(e) => {
                                e.stopPropagation()
                                setZoom(z)
                                setShowZoomMenu(false)
                                setShowViewMenu(false)
                              }}
                              className={`w-full text-left px-3 py-1 text-[11px] font-mono transition-colors ${
                                zoom === z
                                  ? "text-primary bg-primary/8"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              {z}%
                            </button>
                          ))}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={zoomIn}
                      title={`Zoom in (${MOD_LABEL}++)`}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ZoomInIcon size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bookmark */}
            <ToolBtn
              onClick={toggleBookmark}
              title={isBookmarked ? "Remove bookmark (B)" : "Bookmark page (B)"}
              active={isBookmarked}
            >
              <BookmarkIcon size={13} filled={isBookmarked} />
            </ToolBtn>

            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Pro Reader Mode (F) */}
            <ToolBtn
              onClick={toggleProReaderMode}
              title={
                isProReaderMode
                  ? "Exit Pro Reader Mode (F / Esc)"
                  : "Pro Reader Mode (F)"
              }
              active={isProReaderMode}
            >
              {isProReaderMode ? (
                <MinimizeIcon size={13} />
              ) : (
                <MaximizeIcon size={13} />
              )}
            </ToolBtn>

            {/* More */}
            <div className="relative">
              <ToolBtn
                data-menu-trigger="more"
                onClick={toggleMoreMenu}
                title="More options"
                active={showMore}
              >
                <MoreHorizontalIcon size={13} />
              </ToolBtn>
              {showMore && (
                <div
                  data-menu-container="more"
                  className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded shadow-lg py-1 z-50 dropdown-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    "Open PDF",
                    ...(doc.inLibrary === false ? ["Add to Library"] : []),
                    isProReaderMode
                      ? "Exit Pro Reader Mode (F)"
                      : "Pro Reader Mode (F)",
                    "—",
                    "Export annotated copy…",
                    "Print…",
                    "—",
                    "Document information",
                    "Keyboard shortcuts",
                  ].map((item, idx) =>
                    item === "—" ? (
                      <div
                        key={`sep-${idx}`}
                        className="h-px bg-border my-1 mx-2"
                      />
                    ) : (
                      <button
                        key={item}
                        onClick={() => {
                          setShowMore(false)
                          if (item === "Open PDF") {
                            void handleOpenAnotherPdf()
                          } else if (item === "Add to Library") {
                            void handleAddCurrentToLibrary()
                          } else if (
                            item.startsWith("Pro Reader Mode") ||
                            item.startsWith("Exit Pro Reader Mode")
                          ) {
                            toggleProReaderMode()
                          } else if (item === "Export annotated copy…") {
                            void handleExportAnnotated()
                          } else if (item === "Print…") {
                            setShowPrintPreview(true)
                          } else if (item === "Document information") {
                            setShowDocInfo(true)
                          } else if (item === "Keyboard shortcuts") {
                            setShowPalette(true)
                            setPaletteQuery("")
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors"
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 min-h-0 relative overflow-hidden flex"
        style={{ touchAction: "pan-x pan-y" }}
      >
        {docLoadError ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-red-500 mb-2 font-medium">
              Failed to load PDF
            </div>
            <div className="text-muted-foreground text-sm max-w-md text-center">
              {docLoadError}
            </div>
          </div>
        ) : !isDocReady || zoom === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
            <div className="text-muted-foreground text-sm">
              Loading document...
            </div>
          </div>
        ) : (
          <>
            {/* Left panel — Pages / Bookmarks / Outline */}
            <div
              className="absolute left-0 bottom-0 z-20 flex flex-col bg-card border-r border-border shadow-xl overflow-hidden transition-all duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                // The document toolbar is an overlay at top-8 with h-10. Without this
                // offset it covers the panel's own Pages/Bookmarks row, so the panel slid
                // up underneath the toolbar and its header disappeared.
                top: top.visible ? 40 : 0,
                width: showThumbs ? 224 : 0,
                minWidth: 0,
                opacity: showThumbs ? 1 : 0,
                transform: showThumbs ? "translateX(0)" : "translateX(-8px)",
                pointerEvents: showThumbs ? "auto" : "none",
              }}
            >
              {showThumbs && (
                <div className="w-56 h-full flex flex-col shrink-0">
                  <div className="flex items-center border-b border-border shrink-0 px-1">
                    <button
                      onClick={() => setThumbsTab("pages")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
                        thumbsTab === "pages"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayersIcon size={11} /> Pages
                    </button>
                    {(outlineItems.length > 0 || thumbsTab === "outline") && (
                      <button
                        onClick={() => setThumbsTab("outline")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
                          thumbsTab === "outline"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ListIcon size={11} /> Outline
                      </button>
                    )}
                    <button
                      onClick={() => setThumbsTab("bookmarks")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all duration-200 border-b-2 ${
                        thumbsTab === "bookmarks"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <BookmarkIcon size={11} /> Bookmarks
                    </button>
                    <button
                      onClick={() => setShowThumbs(false)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0 transition-colors"
                      title="Close sidebar"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                  <div
                    key={thumbsTab}
                    className="flex-1 overflow-hidden flex flex-col w-full fade-in"
                  >
                    {thumbsTab === "pages" ? (
                      <ThumbnailSidebar
                        docId={doc.id}
                        numPages={actualNumPages}
                        activePage={page}
                        rotation={rotation}
                        onNavigate={jumpPage}
                      />
                    ) : thumbsTab === "outline" ? (
                      <div className="flex-1 w-full overflow-y-auto custom-scrollbar p-2">
                        {outlineItems.length > 0 ? (
                          <div className="space-y-0.5">
                            {outlineItems.map((item, idx) => (
                              <button
                                key={`${item.page}-${idx}`}
                                onClick={() => jumpPage(item.page)}
                                style={{
                                  paddingLeft: `${8 + Math.min(item.level, 4) * 10}px`,
                                }}
                                className={`w-full flex items-center justify-between gap-2 pr-2 py-1.5 rounded-md text-left text-[11px] transition-all duration-150 ${
                                  page === item.page
                                    ? "bg-primary/12 text-primary font-medium"
                                    : "text-foreground hover:bg-muted/70"
                                }`}
                              >
                                <span className="truncate">
                                  {item.title || `Section ${idx + 1}`}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                  {item.page}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-[11px] text-muted-foreground">
                            No document outline available
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
                        {sortedBookmarks.length > 0 ? (
                          <div className="space-y-3">
                            {sortedBookmarks.map((b) => (
                              <div
                                key={b.page}
                                className="w-full flex flex-col items-center relative group"
                              >
                                <PageThumbnail
                                  docId={doc.id}
                                  index={b.page - 1}
                                  active={page === b.page}
                                  rotation={rotation}
                                  onClick={() => jumpPage(b.page)}
                                />
                                <div className="w-[140px] mx-auto flex items-center justify-between mt-0.5 px-0.5">
                                  <span className="text-[11px] font-medium text-foreground/90 truncate">
                                    {b.label}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      set({
                                        bookmarks: bookmarks.filter(
                                          (bm) => bm.page !== b.page,
                                        ),
                                      })
                                    }}
                                    className="text-[10px] text-red-500/80 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-[11px] text-muted-foreground">
                            No bookmarks saved yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── PDF CANVAS ──────────────────────────────────────── */}
            <div
              ref={canvasContainerRef}
              className={`flex-1 min-w-0 min-h-0 relative ${
                viewMode.includes("continuous")
                  ? "overflow-hidden px-0"
                  : `overflow-auto flex items-center justify-center px-4`
              } ${isFullscreen ? "no-scrollbar" : ""} py-0`}
              style={{
                marginLeft: panelW,
                transition: "margin-left 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                ...(viewMode.includes("continuous")
                  ? {}
                  : {
                      justifyContent: "safe center",
                      alignItems: "safe center",
                    }),
              }}
              onClick={() => {
                closeAllMenus()
              }}
            >
              {viewMode.includes("continuous") ? (
                <div className="absolute inset-0">
                  <ContinuousView
                    numPages={actualNumPages}
                    ref={continuousViewRef}
                    doc={doc}
                    zoom={viewMode === "two-page-continuous" ? twoZoom : zoom}
                    rotation={rotation}
                    page={page}
                    setPage={handleSetPage}
                    PageCardComponent={PageCard}
                    twoPage={viewMode === "two-page-continuous"}
                    activeTool={activeTool}
                    searchMatches={searchMatches}
                    activeMatch={activeMatch}
                    onTextSelection={handleTextSelection}
                    activeSelection={textSelection}
                    fitMode={fitMode}
                    isFullscreen={isProReaderMode || isFullscreen}
                  />
                </div>
              ) : viewMode === "two-page" ? (
                <div
                  ref={previewWrapperRef}
                  key={`two-${doc.id}-${page}`}
                  className="min-w-full min-h-full shrink-0 m-auto flex items-center justify-center p-4"
                >
                  <div className="flex gap-4 page-fade">
                    <PageCard
                      docId={doc.id}
                      index={page - 1}
                      zoom={twoZoom}
                      activeTool={activeTool}
                      rotation={rotation}
                      isCurrent={true}
                      onTextSelection={handleTextSelection}
                      activeSelection={
                        textSelection?.page === page ? textSelection : null
                      }
                      searchMatches={searchMatches}
                      activeMatch={activeMatch}
                    />
                    {page < actualNumPages ? (
                      <PageCard
                        docId={doc.id}
                        index={page}
                        zoom={twoZoom}
                        activeTool={activeTool}
                        rotation={rotation}
                        isCurrent={false}
                        onTextSelection={handleTextSelection}
                        activeSelection={
                          textSelection?.page === page + 1
                            ? textSelection
                            : null
                        }
                        searchMatches={searchMatches}
                        activeMatch={activeMatch}
                      />
                    ) : (
                      <div
                        style={{ width: (520 * twoZoom) / 100 }}
                        className="shrink-0"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  ref={previewWrapperRef}
                  key={`single-${doc.id}-${page}`}
                  className="min-w-full min-h-full shrink-0 m-auto flex items-center justify-center p-4"
                >
                  <div className="page-fade">
                    <PageCard
                      docId={doc.id}
                      index={page - 1}
                      zoom={zoom}
                      rotation={rotation}
                      isCurrent={true}
                      activeTool={activeTool}
                      onTextSelection={handleTextSelection}
                      activeSelection={
                        textSelection?.page === page ? textSelection : null
                      }
                      searchMatches={searchMatches}
                      activeMatch={activeMatch}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Anchored Editorial Text Selection Popover */}
            {textSelection && textSelection.text && selectionAnchor && (
              <div
                data-selection-popover="true"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  left: selectionAnchor.x,
                  top: selectionAnchor.y,
                }}
                className={`absolute z-30 flex items-center gap-1 rounded-2xl border border-white/10 dark:border-white/10 bg-card/95 px-2 py-1.5 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-xl select-none ${
                  selectionAnchor.placement === "above"
                    ? "selection-popover-above"
                    : "selection-popover-below"
                }`}
              >
                {/* Directional Pointer Caret */}
                <span
                  aria-hidden="true"
                  style={{
                    left: `calc(50% + ${selectionAnchor.arrowOffset}px)`,
                  }}
                  className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-border bg-card/95 ${
                    selectionAnchor.placement === "above"
                      ? "-bottom-[6px] border-b border-r"
                      : "-top-[6px] border-l border-t"
                  }`}
                />

                {textSelection.text.trim().length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(textSelection.text)
                        onNotice?.("Copied to clipboard")
                        clearSelection()
                      }}
                      title="Copy selected text (Ctrl+C)"
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/10 active:scale-95 transition-all"
                    >
                      <CopyIcon size={12} className="text-muted-foreground" />
                      <span>Copy</span>
                    </button>

                    <div className="mx-0.5 h-3.5 w-px bg-white/10 dark:bg-white/10" />
                  </>
                )}

                <div className="flex items-center gap-1 rounded-xl px-1.5 py-0.5 hover:bg-white/10 dark:hover:bg-white/10 transition-colors">
                  <button
                    onClick={() => createSelectionAnnotation("highlight")}
                    title="Highlight selection"
                    className="flex items-center gap-1.5 px-1 py-0.5 text-[11.5px] font-medium text-foreground/90 hover:text-foreground active:scale-95 transition-all"
                  >
                    <HighlighterIcon
                      size={12}
                      className="text-muted-foreground"
                    />
                    <span>Highlight</span>
                  </button>
                  <div className="flex items-center gap-1.5 pl-0.5 pr-1">
                    {HIGHLIGHT_PALETTE.map((swatch) => {
                      const isActive =
                        toolSettings.highlightColor.toLowerCase() ===
                        swatch.value.toLowerCase()
                      return (
                        <button
                          key={swatch.value}
                          onClick={() =>
                            createSelectionAnnotation("highlight", swatch.value)
                          }
                          title={`Highlight with ${swatch.label}`}
                          className={`h-3 w-3 rounded-full transition-transform hover:scale-125 ${
                            isActive
                              ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: swatch.value }}
                        />
                      )
                    })}
                  </div>
                </div>

                <div className="mx-0.5 h-3.5 w-px bg-white/10 dark:bg-white/10" />

                <button
                  onClick={() => createSelectionAnnotation("underline")}
                  title="Underline selection"
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/10 active:scale-95 transition-all"
                >
                  <span className="underline decoration-blue-400 decoration-2 underline-offset-2 font-semibold">
                    U
                  </span>
                  <span>Underline</span>
                </button>

                <button
                  onClick={() => createSelectionAnnotation("strikethrough")}
                  title="Strikethrough selection"
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/10 active:scale-95 transition-all"
                >
                  <span className="line-through decoration-rose-400 decoration-2 font-semibold">
                    S
                  </span>
                  <span>Strike</span>
                </button>

                <button
                  onClick={() => createSelectionAnnotation("note")}
                  title="Attach note to selection"
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 hover:text-foreground hover:bg-white/10 dark:hover:bg-white/10 active:scale-95 transition-all"
                >
                  <StickyNoteIcon size={12} className="text-muted-foreground" />
                  <span>Note</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── BOTTOM CONTROL BAR: Undo/Redo | Rotate | Page nav ─── */}
      <div
        className="absolute z-20 bottom-5 flex justify-center"
        style={{
          left: panelW,
          right: 0,
          pointerEvents: "none",
          transition: "left 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          {...bottom.surfaceProps}
          className={`flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border rounded-xl px-1.5 py-1.5 shadow-lg transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            bottom.visible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-3 scale-95"
          }`}
          style={{ pointerEvents: bottom.visible ? "auto" : "none" }}
        >
          {/* Undo */}
          <button
            onClick={() => {
              if (doc?.id) undoAnnotations(doc.id)
            }}
            title={`Undo (${MOD_LABEL}+Z)`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7v6h6" />
              <path d="M3 13A9 9 0 1 0 5.6 6" />
            </svg>
          </button>
          {/* Redo */}
          <button
            onClick={() => {
              if (doc?.id) redoAnnotations(doc.id)
            }}
            title={`Redo (${MOD_LABEL}+${SHIFT_LABEL}+Z)`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 7v6h-6" />
              <path d="M21 13A9 9 0 1 1 18.4 6" />
            </svg>
          </button>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Rotate */}
          <button
            onClick={rotate}
            title={`Rotate clockwise${
              rotation !== 0 ? ` (${rotation}°)` : ""
            } (R)`}
            className={`p-1.5 rounded transition-colors ${
              rotation !== 0
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <RefreshIcon size={13} />
          </button>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Page navigation */}
          <button
            onClick={prevPage}
            disabled={page <= 1}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-25"
          >
            <ChevronLeftIcon size={12} />
          </button>

          <div className="flex items-center gap-1 px-1">
            {viewMode === "two-page" && page < (actualNumPages || 1) ? (
              <span className="text-[12px] font-mono text-foreground tabular-nums">
                {page}–{page + 1}
              </span>
            ) : (
              <input
                ref={pageInputRef}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    jumpPage(parseInt(pageInput) || 1)
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => jumpPage(parseInt(pageInput) || page)}
                className="w-8 text-center text-[12px] font-mono bg-transparent border-b border-border/60 text-foreground outline-none focus:outline-none focus-visible:outline-none focus:border-primary transition-colors"
              />
            )}
            <span className="text-[12px] text-muted-foreground font-mono">
              / {actualNumPages}
            </span>
          </div>

          <button
            onClick={nextPage}
            disabled={page >= actualNumPages}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-25"
          >
            <ChevronRightIcon size={12} />
          </button>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            title={`Zoom out (${MOD_LABEL}+−)`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ZoomOutIcon size={12} />
          </button>

          <span className="w-10 text-center py-1 text-[11px] font-mono text-muted-foreground">
            {zoom}%
          </span>

          <button
            onClick={zoomIn}
            title={`Zoom in (${MOD_LABEL}++)`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ZoomInIcon size={12} />
          </button>
        </div>
      </div>

      {/* ── PRO READER FLOATING TOOL CAPSULE (Docked at bottom out of the way) ── */}

      {/* ── DOCUMENT INFO MODAL ──────────────────────────────── */}
      {showPrintPreview && (
        <PrintPreview
          docId={doc.id}
          docName={doc.name}
          pageCount={Math.max(1, actualNumPages)}
          currentPage={page}
          renderPreview={renderPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          onPrint={handlePrint}
        />
      )}

      {showDocInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[3px] px-4 backdrop-fade"
          onClick={() => setShowDocInfo(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Document Information
              </h2>
              <button
                onClick={() => setShowDocInfo(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <XIcon size={13} />
              </button>
            </div>
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">File name</dt>
                <dd className="font-medium text-foreground truncate max-w-[240px]">
                  {doc.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="font-mono text-foreground">{actualNumPages}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-mono text-foreground">
                  {formatFileSize(doc.size)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Collection</dt>
                <dd className="text-foreground">{doc.folder || "Unfiled"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Last opened</dt>
                <dd className="text-foreground">
                  {formatLastOpened(doc.lastOpened)}
                </dd>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <dt className="text-muted-foreground">Path</dt>
                <dd className="font-mono text-[11px] text-muted-foreground break-all bg-muted/60 rounded px-2 py-1.5">
                  {doc.path || doc.id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ── COMMAND PALETTE ──────────────────────────────────── */}
      {showPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/40 backdrop-blur-[3px] backdrop-fade"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="w-[500px] max-w-[92vw] bg-card border border-border rounded-xl shadow-2xl overflow-hidden modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <SearchIcon
                size={14}
                className="text-muted-foreground shrink-0"
              />
              <input
                ref={paletteRef}
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value)
                  setPaletteIdx(0)
                }}
                placeholder="Search commands or enter a page number…"
                className="flex-1 text-[13px] bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                Esc
              </kbd>
            </div>
            <div className="max-h-[360px] overflow-y-auto py-1.5">
              {paletteQuery.trim() ? (
                filteredCmds.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-6">
                    No results for "{paletteQuery}"
                  </p>
                ) : (
                  filteredCmds.map((cmd, i) => (
                    <PaletteRow
                      key={cmd.id}
                      cmd={cmd}
                      active={i === paletteIdx}
                      onHover={() => setPaletteIdx(i)}
                      onSelect={() => {
                        cmd.action()
                        setShowPalette(false)
                      }}
                    />
                  ))
                )
              ) : (
                groupedCmds &&
                groupedCmds.map(({ cat, items }) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 pt-3 pb-1.5">
                      {cat}
                    </p>
                    {items.map((cmd) => {
                      const globalIdx = paletteCommands.indexOf(cmd)
                    
  return (
                        <PaletteRow
                          key={cmd.id}
                          cmd={cmd}
                          active={globalIdx === paletteIdx}
                          onHover={() => setPaletteIdx(globalIdx)}
                          onSelect={() => {
                            cmd.action()
                            setShowPalette(false)
                          }}
                        />
                      )
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>
                <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">
                  ↑↓
                </kbd>{" "}
                navigate
              </span>
              <span>
                <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">
                  ↵
                </kbd>{" "}
                select
              </span>
              <span>
                <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">
                  Esc
                </kbd>{" "}
                close
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating live pinch/zoom HUD pill */}
      <div
        ref={pinchHudRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full border border-white/15 bg-card/90 px-3.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-xl backdrop-blur-md transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] opacity-0 scale-95"
      />

      {/* Resume toast */}
      {resumeToast && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-xl px-3.5 py-2 shadow-xl toast-slide-up">
          <span className="text-[11px] text-muted-foreground">
            {resumeToast}
          </span>
          <button
            onClick={onResumeToastDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <XIcon size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── PageCard ──────────────────────────────────────────────────

// ── PaletteRow ────────────────────────────────────────────────

function PaletteRow({
  cmd,
  active,
  onHover,
  onSelect,
}: {
  cmd: { label: string; shortcut?: string }
  active: boolean
  onHover: () => void
  onSelect: () => void
}) {

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex items-center justify-between w-full px-4 py-2 text-left transition-colors ${
        active ? "bg-primary/8 text-primary" : "text-foreground hover:bg-muted"
      }`}
    >
      <span className="text-[12px] font-medium">{cmd.label}</span>
      {cmd.shortcut && (
        <kbd
          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
            active
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-muted border-border text-muted-foreground"
          }`}
        >
          {cmd.shortcut}
        </kbd>
      )}
    </button>
  )
}

// ── ToolBtn ───────────────────────────────────────────────────

function ToolBtn({
  onClick,
  title,
  disabled,
  active,
  children,
  ...rest
}: {
  onClick: () => void
  title?: string
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      // Data attributes such as `data-menu-trigger` must reach the DOM: the reader's
      // click-outside handling looks for them, and so do the UI tests.
      {...rest}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}
