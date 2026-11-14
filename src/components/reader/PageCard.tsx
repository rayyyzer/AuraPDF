import { memo, useEffect, useMemo, useRef, useState } from "react"
import { SvgAnnotationLayer, ERASER_CURSOR_CSS } from "./SvgAnnotationLayer"
import { NativePdfEngine } from "../../services/pdf/engine"
import { selectionText } from "../../services/pdf/selectionText"
import {
  isUnreadable,
  type TextSelection,
  type TextSelectionSegment,
  type UnifiedTextSegment,
} from "../../services/pdf/text"
import {
  pdfBoxToViewport,
  viewportRectToAnnotationRect,
} from "../../utils/coordinates"

const BASE_W = 520
const BASE_H = 720

const MemoizedTextLayer = memo(function MemoizedTextLayer({
  textLayerData,
  viewport,
}: {
  textLayerData: any[] | null
  viewport: any
}) {
  if (!textLayerData || textLayerData.length === 0) return null

  return (
    <>
      {textLayerData.map((seg, i) => {
        const box = pdfBoxToViewport(viewport, seg)
        const fontSize = Math.max(6, box.height * 0.85)
        const charLen = Math.max(1, (seg.text || "").length)
        const estGlyphW = charLen * fontSize * 0.54
        const extraSpace =
          seg.source === "ocr" && box.width > estGlyphW
            ? (box.width - estGlyphW) / charLen
            : 0
        const isOcr = seg.source === "ocr"
        const pad = isOcr ? 2 : 0
        const displayText = seg.text + (isOcr ? " " : "")
      
  return (
          <span
            key={seg.id || i}
            style={{
              position: "absolute",
              left: box.left - pad,
              top: box.top - pad,
              width: box.width + pad * 2,
              height: box.height + pad * 2,
              fontSize,
              letterSpacing: extraSpace > 0 ? `${extraSpace}px` : undefined,
              color: "transparent",
              whiteSpace: "pre",
              cursor: "text",
              userSelect: "text",
              lineHeight: 1,
              fontFamily: "sans-serif",
            }}
            data-text-source={seg.source}
            data-text-segment-id={seg.id}
            data-segment-index={i}
          >
            {displayText}
          </span>
        )
      })}
    </>
  )
})

export const PageCard = memo(function PageCard({
  docId,
  index,
  zoom,
  rotation,
  isCurrent,
  priority = 10,
  onMeasure,
  searchMatches,
  activeMatch,
  activeTool,
  onTextSelection,
  activeSelection,
}: {
  docId: string
  index: number
  zoom: number
  rotation: number
  isCurrent: boolean
  priority?: number
  onMeasure?: (index: number, baseW: number, baseH: number) => void
  searchMatches?: any[]
  activeMatch?: { page: number; boundIndex: number } | null
  activeTool?: string
  onTextSelection?: (selection: TextSelection | null) => void
  activeSelection?: TextSelection | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<any>(null)
  const renderGenerationRef = useRef(0)
  const [textLayerData, setTextLayerData] =
    useState<UnifiedTextSegment[] | null>(null)
  const [pageLoadError, setPageLoadError] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [dragSelection, setDragSelection] = useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
    segments: UnifiedTextSegment[]
  } | null>(null)
  const selectingRef = useRef(false)
  const justFinishedDragRef = useRef(false)
  const selectionPointerIdRef = useRef<number | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragSelectionRef = useRef<typeof dragSelection>(null)

  const [meta, setMeta] = useState<any>(null)
  // Pages fade in instead of popping once the bitmap lands.
  const [canvasVisible, setCanvasVisible] = useState(false)

  const viewport = useMemo(() => {
    if (!meta) return null
    const scale = zoom / 100
    const isLandscape = rotation === 90 || rotation === 270
    return {
      width: isLandscape ? meta.height * scale : meta.width * scale,
      height: isLandscape ? meta.width * scale : meta.height * scale,
      scale,
      rotation,
    }
  }, [meta, zoom, rotation])

  useEffect(() => {
    let active = true
    const pageNum = index + 1

    async function loadMetaAndText() {
      if (!docId || !active) return

      try {
        setPageLoadError(null)
        const m = await NativePdfEngine.getPageMeta(docId, index)
        if (!active) return
        setMeta(m)

        if (onMeasure) {
          const baseViewport = NativePdfEngine.getViewport(m, 1, 0)
          onMeasure(index, baseViewport.width, baseViewport.height)
        }

        // Fetch text layer (native, or direct background OCR if scanned/handwritten, or cached SQLite)
        NativePdfEngine.getHybridTextLayer(docId, index)
          .then((textLayer) => {
            if (!active) return
            setTextLayerData(textLayer || [])
          })
          .catch((err) => {
            if (active) {
              console.warn(`Text layer unavailable for page ${pageNum}:`, err)
              setTextLayerData([])
            }
          })
      } catch (err: any) {
        if (active) {
          setPageLoadError(`Unable to load page ${pageNum}`)
          console.error(`Error loading page ${pageNum}:`, err)
        }
      }
    }

    loadMetaAndText()
  
  return () => {
      active = false
    }
  }, [docId, index])

  useEffect(() => {
    let active = true
    if (!viewport || !canvasRef.current) return
    setRenderError(null)

    const canvas = canvasRef.current
    const context = canvas.getContext("2d", {
      alpha: false,
    })
    if (!context) return

    const dpr = window.devicePixelRatio || 1
    const generation = ++renderGenerationRef.current

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {}
    }

    const abortController = new AbortController()
    renderTaskRef.current = { cancel: () => abortController.abort() }

    // Clamp raster scale inside PDFium's safe 15 MP / 9.75x pixel budget so 400-500% zoom
    // on HiDPI displays or oversized sheets never triggers backend dimension errors.
    const rawScale = (zoom / 100) * dpr
    const basePageW = Math.max(1, viewport.width / Math.max(0.1, zoom / 100))
    const basePageH = Math.max(1, viewport.height / Math.max(0.1, zoom / 100))
    const maxScaleByPixels = Math.sqrt(15_000_000 / (basePageW * basePageH))
    const maxScaleByDim = 15_360 / Math.max(basePageW, basePageH)
    const scale = Math.max(
      0.05,
      Math.min(rawScale, 9.75, maxScaleByPixels, maxScaleByDim),
    )

    void NativePdfEngine.renderPage(
      docId,
      index,
      scale,
      rotation,
      priority,
      abortController.signal,
    )
      .then((bytes) => {
        if (
          !active ||
          abortController.signal.aborted ||
          generation !== renderGenerationRef.current
        )
          return

        const dataView = new DataView(bytes.buffer, bytes.byteOffset, 8)
        const w = dataView.getUint32(0, true)
        const h = dataView.getUint32(4, true)
        if (!w || !h || bytes.byteLength < 8 + w * h * 4)
          throw new Error("Invalid PDF bitmap")

        const pixels = new Uint8ClampedArray(
          bytes.buffer,
          bytes.byteOffset + 8,
          w * h * 4,
        )
        const decoded = new ImageData(pixels as any, w, h)

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }

        context.putImageData(decoded, 0, 0)
        // Two frames: one to commit the bitmap, one to start the opacity transition.
        requestAnimationFrame(() => {
          if (generation === renderGenerationRef.current) setCanvasVisible(true)
        })
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        if (
          active &&
          !abortController.signal.aborted &&
          generation === renderGenerationRef.current
        ) {
          console.error(`Native render failed for docId ${docId}:`, String(err))
          setRenderError(`Unable to render page ${index + 1}`)
        }
      })

  
  return () => {
      active = false
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {}
      }
    }
  }, [viewport, docId, index, zoom, rotation, priority])

  const segmentViewportRect = (segment: UnifiedTextSegment) => {
    const box = pdfBoxToViewport(viewport, segment)
    return {
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
    }
  }

  // Only recognised text becomes selectable. `unreadable` segments keep their boxes so the
  // reader can point at them, but they never pretend to be words.
  const readableSegments = useMemo(
    () =>
      (textLayerData || []).filter(
        (segment) => !isUnreadable(segment) && (segment.text || "").trim().length > 0,
      ),
    [textLayerData],
  )

  const isOcrDominantPage = useMemo(() => {
    if (!textLayerData || textLayerData.length === 0) return false
    const ocrCount = textLayerData.filter((s) => s.source === "ocr").length
    return ocrCount >= textLayerData.length * 0.5
  }, [textLayerData])

  const hasSelectableWords = readableSegments.length > 0

  // Spatial drag is an invisible fallback for pages with no recognized text layer or when text tool is selected
  const canSpatialSelect =
    activeTool !== "eraser" &&
    (activeTool === "text" ||
      ((!activeTool || activeTool === "select") && !hasSelectableWords))

  const updateDragSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    const pageElement = event.currentTarget
    const rect = pageElement.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const start = selectionStartRef.current
    if (!start) return
    if (Math.hypot(point.x - start.x, point.y - start.y) < 4) {
      return
    }
    if (isOcrDominantPage) {
      window.getSelection()?.removeAllRanges()
    }
    if (readableSegments.length === 0) return

    // Group segments into lines sorted vertically
    interface LineGroup {
      yMid: number
      yTop: number
      yBottom: number
      items: Array<{
        segment: UnifiedTextSegment
        box: { x: number; y: number; width: number; height: number }
      }>
    }

    const lines: LineGroup[] = []
    for (const segment of readableSegments) {
      const box = segmentViewportRect(segment)
      if (box.width <= 0 || box.height <= 0) continue
      const yMid = box.y + box.height / 2
      const lineTol = Math.max(6, box.height * 0.45)

      let targetLine = lines.find((l) => Math.abs(l.yMid - yMid) <= lineTol)
      if (targetLine) {
        targetLine.items.push({ segment, box })
        targetLine.yTop = Math.min(targetLine.yTop, box.y)
        targetLine.yBottom = Math.max(targetLine.yBottom, box.y + box.height)
        targetLine.yMid = (targetLine.yTop + targetLine.yBottom) / 2
      } else {
        lines.push({
          yMid,
          yTop: box.y,
          yBottom: box.y + box.height,
          items: [{ segment, box }],
        })
      }
    }

    // Sort lines from top to bottom
    lines.sort((a, b) => a.yMid - b.yMid)

    // Sort items within each line from left to right
    for (const line of lines) {
      line.items.sort((a, b) => a.box.x - b.box.x)
    }

    // Determine dragging trajectory (forward vs backward)
    const isForward =
      point.y > start.y + 6 ||
      (Math.abs(point.y - start.y) <= 6 && point.x >= start.x)

    const fromPt = isForward ? start : point
    const toPt = isForward ? point : start

    const findClosestLineIdx = (y: number) => {
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (y >= l.yTop && y <= l.yBottom) return i
        const dist = Math.min(Math.abs(y - l.yTop), Math.abs(y - l.yBottom))
        if (dist < closestDist) {
          closestDist = dist
          closestIdx = i
        }
      }
      return closestIdx
    }

    const startLineIdx = findClosestLineIdx(fromPt.y)
    const endLineIdx = findClosestLineIdx(toPt.y)
    const firstLineIdx = Math.min(startLineIdx, endLineIdx)
    const lastLineIdx = Math.max(startLineIdx, endLineIdx)

    const matchedSegments: UnifiedTextSegment[] = []

    if (firstLineIdx === lastLineIdx) {
      // Single-line selection: segments between min(x) and max(x)
      const line = lines[firstLineIdx]
      const minX = Math.min(fromPt.x, toPt.x)
      const maxX = Math.max(fromPt.x, toPt.x)
      for (const item of line.items) {
        if (item.box.x + item.box.width >= minX && item.box.x <= maxX) {
          matchedSegments.push(item.segment)
        }
      }
    } else {
      // Multi-line selection: stream from start word through full intermediate lines to end word
      for (let i = firstLineIdx; i <= lastLineIdx; i++) {
        const line = lines[i]
        if (i === firstLineIdx) {
          for (const item of line.items) {
            if (item.box.x + item.box.width >= fromPt.x) {
              matchedSegments.push(item.segment)
            }
          }
        } else if (i === lastLineIdx) {
          for (const item of line.items) {
            if (item.box.x <= toPt.x) {
              matchedSegments.push(item.segment)
            }
          }
        } else {
          for (const item of line.items) {
            matchedSegments.push(item.segment)
          }
        }
      }
    }

    const nextSelection = { start, end: point, segments: matchedSegments }
    dragSelectionRef.current = nextSelection
    setDragSelection(nextSelection)
  }

  useEffect(() => {
    if (!activeSelection) {
      dragSelectionRef.current = null
      setDragSelection(null)
    }
  }, [activeSelection])

  const finishDragSelection = () => {
    selectingRef.current = false
    selectionPointerIdRef.current = null
    const selection = dragSelectionRef.current
    dragSelectionRef.current = null
    setDragSelection(null)
    if (!selection || selection.segments.length === 0) {
      onTextSelection?.(null)
      return
    }
    justFinishedDragRef.current = true
    window.setTimeout(() => {
      justFinishedDragRef.current = false
    }, 120)
    const ordered = selection.segments

    // No filler text: if nothing was recognised there is nothing to copy, and inventing a
    // label here would put words on the user's clipboard that are not in the document.
    const text = selectionText(
      ordered
        .map((segment) => {
          const box = segmentViewportRect(segment)
          const trimmed = (segment.text || "").trim()
          if (!trimmed) return null
          return {
            text: trimmed,
            // Viewport y grows downwards; the helper expects PDF orientation.
            x: box.x,
            y: -box.y,
            width: box.width,
            height: box.height,
          }
        })
        .filter(
          (item): item is { text: string; x: number; y: number; width: number; height: number } =>
            Boolean(item),
        ),
    )
    const segments: TextSelectionSegment[] = ordered.map((segment) => {
      const box = segmentViewportRect(segment)
      return {
        text: segment.text,
        source: segment.source,
        segmentId: segment.id,
        viewportBounds: box,
        bounds: viewport
          ? viewportRectToAnnotationRect(viewport, box)
          : {
              x: segment.x,
              y: segment.y,
              width: segment.width,
              height: segment.height,
            },
      }
    })
    onTextSelection?.({
      docId,
      page: index + 1,
      text,
      segments,
      sources: [...new Set(segments.map((segment) => segment.source))],
    })
  }

  const handleNativeTextSelection = () => {
    if (justFinishedDragRef.current) {
      justFinishedDragRef.current = false
      return
    }
    if (activeTool && activeTool !== "select" && activeTool !== "text") return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || readableSegments.length === 0) {
      onTextSelection?.(null)
      return
    }
    const selectedText = selection.toString().trim()
    if (!selectedText) {
      onTextSelection?.(null)
      return
    }

    const matchedSegments: UnifiedTextSegment[] = []
    const textLayerEl = textLayerRef.current
    let rangeClientRects: Array<{
      x: number
      y: number
      width: number
      height: number
    }> = []

    if (textLayerEl) {
      try {
        const range = selection.getRangeAt(0)
        const layerRect = textLayerEl.getBoundingClientRect()
        rangeClientRects = Array.from(range.getClientRects())
          .map((cr) => ({
            x: cr.left - layerRect.left,
            y: cr.top - layerRect.top,
            width: cr.width,
            height: cr.height,
          }))
          .filter((cr) => cr.width > 0.5 && cr.height > 0.5)
      } catch {}

      const spans = textLayerEl.querySelectorAll<HTMLElement>(
        "[data-segment-index]",
      )
      for (const spanEl of spans) {
        if (selection.containsNode(spanEl, true)) {
          const idx = Number(spanEl.dataset.segmentIndex)
          if (!Number.isNaN(idx) && readableSegments[idx]) {
            matchedSegments.push(readableSegments[idx])
          }
        }
      }
    }

    if (matchedSegments.length === 0 && textLayerEl && rangeClientRects.length) {
      for (const seg of readableSegments) {
        const box = segmentViewportRect(seg)
        const overlaps = rangeClientRects.some(
          (cr) =>
            box.x < cr.x + cr.width &&
            box.x + box.width > cr.x &&
            box.y < cr.y + cr.height &&
            box.y + box.height > cr.y,
        )
        if (overlaps) {
          matchedSegments.push(seg)
        }
      }
    }

    if (matchedSegments.length > 0) {
      const seenIds = new Set<string>()
      const uniqueMatched: UnifiedTextSegment[] = []
      for (const seg of matchedSegments) {
        const key = seg.id || `${seg.x}_${seg.y}`
        if (!seenIds.has(key)) {
          seenIds.add(key)
          uniqueMatched.push(seg)
        }
      }
      const segments: TextSelectionSegment[] = uniqueMatched.map(
        (segment) => {
          const rawBox = segmentViewportRect(segment)
          let clippedBox = rawBox

          if (rangeClientRects.length > 0 && viewport) {
            const lineRects = rangeClientRects.filter((cr) => {
              const vOverlap =
                Math.min(rawBox.y + rawBox.height, cr.y + cr.height) -
                Math.max(rawBox.y, cr.y)
              const hOverlap =
                Math.min(rawBox.x + rawBox.width, cr.x + cr.width) -
                Math.max(rawBox.x, cr.x)
            
  return (
                vOverlap > Math.min(rawBox.height, cr.height) * 0.25 &&
                hOverlap > 0
              )
            })
            if (lineRects.length > 0) {
              const minCrX = Math.min(...lineRects.map((cr) => cr.x))
              const maxCrX = Math.max(...lineRects.map((cr) => cr.x + cr.width))
              const left = Math.max(rawBox.x, minCrX)
              const right = Math.min(rawBox.x + rawBox.width, maxCrX)
              if (right - left >= 2) {
                clippedBox = {
                  x: left,
                  y: rawBox.y,
                  width: right - left,
                  height: rawBox.height,
                }
              }
            }
          }

          const pdfBounds = viewport
            ? viewportRectToAnnotationRect(viewport, clippedBox)
            : {
                x: segment.x,
                y: segment.y,
                width: segment.width,
                height: segment.height,
              }

          return {
            text: segment.text,
            source: segment.source,
            segmentId: segment.id,
            viewportBounds: clippedBox,
            bounds: pdfBounds,
          }
        },
      )
      onTextSelection?.({
        docId,
        page: index + 1,
        text: selectedText,
        segments,
        sources: [...new Set(segments.map((s) => s.source))],
      })
    } else {
      onTextSelection?.(null)
    }
  }


  /**
   * Overlay rectangles are only needed for the spatial-drag fallback used on pages with no
   * selectable text. Native selections already get painted by the browser, and drawing a
   * second set of boxes on top produced hard-edged slabs with visible seams.
   */
  const selectionOverlayRects = useMemo(() => {
    if (!viewport) return []
    if (dragSelection && dragSelection.segments.length > 0) {
      return dragSelection.segments.map((seg) => segmentViewportRect(seg))
    }
    return []
  }, [viewport, dragSelection])

  if (!viewport) {
    const isLandscape = rotation === 90 || rotation === 270
    const w = BASE_W * (zoom / 100)
    const h = BASE_H * (zoom / 100)
  
  return (
      <div
        style={{ width: isLandscape ? h : w, height: isLandscape ? w : h }}
        className="page-skeleton flex items-center justify-center shadow-md shrink-0"
      >
        <span className="text-muted-foreground text-xs">
          {pageLoadError ?? `Loading page ${index + 1}...`}
        </span>
      </div>
    )
  }


  return (
    <div
      style={{
        width: viewport.width,
        height: viewport.height,
        minWidth: viewport.width,
        minHeight: viewport.height,
        cursor:
          activeTool === "eraser"
            ? ERASER_CURSOR_CSS
            : canSpatialSelect
              ? "text"
              : undefined,
      }}
      className="relative flex items-center justify-center shrink-0"
      data-page-index={index}
      data-page-width={viewport.width}
      data-page-height={viewport.height}
      data-rotation={viewport.rotation}
      onPointerDown={(event) => {
        if (event.button !== 0 || !canSpatialSelect || readableSegments.length === 0)
          return
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
        selectingRef.current = true
        selectionPointerIdRef.current = event.pointerId
        const rect = event.currentTarget.getBoundingClientRect()
        selectionStartRef.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        dragSelectionRef.current = null
        setDragSelection(null)
        onTextSelection?.(null)
      }}
      onPointerMove={(event) => {
        if (canSpatialSelect && selectingRef.current)
          updateDragSelection(event)
      }}
      onPointerUp={(event) => {
        if (canSpatialSelect && selectingRef.current) {
          updateDragSelection(event)
          const hadDragSegments =
            (dragSelectionRef.current?.segments.length ?? 0) > 0
          if (activeTool === "text" || hadDragSegments) {
            finishDragSelection()
          } else {
            selectingRef.current = false
            selectionPointerIdRef.current = null
            dragSelectionRef.current = null
            setDragSelection(null)
          }
          if (
            selectionPointerIdRef.current !== null &&
            event.currentTarget.hasPointerCapture(selectionPointerIdRef.current)
          ) {
            event.currentTarget.releasePointerCapture(
              selectionPointerIdRef.current,
            )
          }
          selectionStartRef.current = null
        }
      }}
      onPointerCancel={() => {
        selectingRef.current = false
        selectionStartRef.current = null
        dragSelectionRef.current = null
        setDragSelection(null)
        onTextSelection?.(null)
      }}
    >
      <div
        style={{ width: viewport.width, height: viewport.height }}
        data-annotation-surface="true"
        data-active-tool={activeTool || "select"}
        className={`annotation-surface bg-white overflow-hidden relative flex flex-col rounded-[2px] transition-[box-shadow,ring-color] duration-200 ${
          isCurrent
            ? "shadow-[0_12px_44px_-10px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
            : "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
        }`}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: viewport.width,
            height: viewport.height,
            opacity: canvasVisible ? 1 : 0,
            transition: "opacity 180ms ease-out",
          }}
          className="block absolute inset-0 z-0 pointer-events-none"
        />
        {renderError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 px-4 text-center text-xs text-red-700">
            {renderError}
          </div>
        )}
        <div
          ref={textLayerRef}
          data-has-custom-selection={
            selectionOverlayRects.length > 0 ? "true" : undefined
          }
          className="textLayer absolute inset-0 z-10"
          style={{
            width: viewport.width,
            height: viewport.height,
            pointerEvents:
              activeTool === "eraser" ||
              (activeTool && activeTool !== "select" && activeTool !== "text")
                ? "none"
                : "auto",
          }}
          onMouseUp={handleNativeTextSelection}
        >
          {searchMatches
            ?.find((m) => m.page === index)
            ?.bounds?.map((seg: any, i: number) => {
              const box = pdfBoxToViewport(viewport, seg)
              const isActive =
                activeMatch &&
                activeMatch.page === index &&
                activeMatch.boundIndex === i
            
  return (
                <div
                  key={"match" + i}
                  style={{
                    position: "absolute",
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    background: isActive
                      ? "rgba(245, 158, 11, 0.65)"
                      : "rgba(246, 216, 96, 0.45)",
                    border: isActive
                      ? "1.5px solid rgba(217, 119, 6, 0.95)"
                      : "1px solid rgba(234, 179, 8, 0.4)",
                    boxShadow: isActive
                      ? "0 0 10px rgba(245, 158, 11, 0.7)"
                      : "none",
                    pointerEvents: "none",
                    borderRadius: 2,
                    zIndex: isActive ? 15 : 12,
                    transition: "all 150ms ease",
                  }}
                />
              )
            })}
          <MemoizedTextLayer
            textLayerData={readableSegments}
            viewport={viewport}
          />
        </div>
        {selectionOverlayRects.map((rect, rIdx) => (
          <div
            key={`selection-rect-${rIdx}`}
            className="pointer-events-none absolute z-[14] rounded-[2px] transition-opacity duration-100"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: "rgba(56, 189, 248, 0.22)",
            }}
          />
        ))}
        <SvgAnnotationLayer
          docId={docId}
          page={index + 1}
          viewport={viewport}
          activeTool={activeTool || "select"}
        />
      </div>
    </div>
  )
})
