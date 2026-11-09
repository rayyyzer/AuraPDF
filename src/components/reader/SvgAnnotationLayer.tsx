import { useEffect, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  useAnnotationStore,
  selectAnnotationsForPage,
  Annotation,
  HighlightAnnotation,
  HIGHLIGHT_PALETTE,
  PEN_PALETTE,
} from "../../stores/useAnnotationStore"
import { pdfToViewport, viewportToPdf } from "../../utils/coordinates"
import { TrashIcon, XIcon } from "../../icons"
export { ERASER_CURSOR_CSS } from "./annotationGeometry"
import {
  ERASER_CURSOR_CSS,
  generateAnnotationId as id,
  pointsToSmoothSvgPath,
  mergeAdjacentLineRects,
  normalizeHighlighterPoints,
  circleIntersectsRect,
  distToSegmentSquared,
  subtractEraserFromRects,
  subtractEraserFromPoints,
} from "./annotationGeometry"

interface Props {
  docId: string
  page: number
  viewport: any
  activeTool: string
}

export function SvgAnnotationLayer({
  docId,
  page,
  viewport,
  activeTool,
}: Props) {
  const selector = useMemo(
    () => selectAnnotationsForPage(docId, page),
    [docId, page],
  )
  const annotations = useAnnotationStore(useShallow(selector))
  const { addAnnotation, deleteAnnotation, updateAnnotation, toolSettings } =
    useAnnotationStore(
      useShallow((state) => ({
        addAnnotation: state.addAnnotation,
        deleteAnnotation: state.deleteAnnotation,
        updateAnnotation: state.updateAnnotation,
        toolSettings: state.toolSettings,
      })),
    )

  const svgRef = useRef<SVGSVGElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  // Sticky-note dragging: notes can be repositioned after they are placed.
  const noteDragRef = useRef<{
    id: string
    clientX: number
    clientY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const suppressNoteClickRef = useRef(false)
  const drawingRef = useRef(false)
  const shiftKeyRef = useRef(false)
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const previewPathRef = useRef<SVGPathElement>(null)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const [selectedAnnotationId, setSelectedAnnotationId] =
    useState<string | null>(null)
  const [shapePreview, setShapePreview] = useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
  } | null>(null)

  // Interactive Sticky Note creation / editing popover state
  const [noteDraft, setNoteDraft] = useState<{
    annotationId?: string
    pdfX: number
    pdfY: number
    text: string
    color: string
  } | null>(null)

  const [eraserVpPoint, setEraserVpPoint] = useState<{
    x: number
    y: number
  } | null>(null)
  const isErasingRef = useRef(false)
  const lastEraserPointRef = useRef<{ x: number; y: number } | null>(null)
  const deletedInStrokeRef = useRef<Set<string>>(new Set())

  const eraseAtViewportPoint = (cx: number, cy: number) => {
    const r = toolSettings.eraserRadius || 24
    // Only whole-mark erasing is offered now: it is predictable and cannot silently
    // shave half a stroke. The partial-erase path below is no longer reachable from the UI.
    const mode = "object"

    for (const ann of annotations) {
      if (mode === "object") {
        if (deletedInStrokeRef.current.has(ann.id)) continue

        let hit = false

        if (ann.type === "highlight") {
          if (ann.rects && ann.rects.length > 0) {
            for (const rect of ann.rects) {
              const [x1, y1] = pdfToViewport(viewportRef.current, rect.x, rect.y)
              const [x2, y2] = pdfToViewport(
                viewportRef.current,
                rect.x + rect.width,
                rect.y + rect.height,
              )
              if (circleIntersectsRect(cx, cy, r, x1, y1, x2, y2)) {
                hit = true
                break
              }
            }
          } else if (ann.points && ann.points.length > 1) {
            const vpPoints = ann.points.map((p) => {
              const [x, y] = pdfToViewport(viewportRef.current, p.x, p.y)
              return { x, y }
            })
            const strokeR = Math.max(
              r,
              ((ann.strokeWidth ?? 16) * (viewportRef.current.scale || 1)) / 2,
            )
            for (let i = 0; i < vpPoints.length - 1; i++) {
              if (
                distToSegmentSquared(
                  cx,
                  cy,
                  vpPoints[i].x,
                  vpPoints[i].y,
                  vpPoints[i + 1].x,
                  vpPoints[i + 1].y,
                ) <=
                (strokeR + 4) * (strokeR + 4)
              ) {
                hit = true
                break
              }
            }
          }
        } else if (ann.type === "underline" || ann.type === "strikethrough") {
          if (ann.rects && ann.rects.length > 0) {
            for (const rect of ann.rects) {
              const [x1, y1] = pdfToViewport(viewportRef.current, rect.x, rect.y)
              const [x2, y2] = pdfToViewport(
                viewportRef.current,
                rect.x + rect.width,
                rect.y + rect.height,
              )
              const x = Math.min(x1, x2)
              const y = Math.min(y1, y2)
              const width = Math.abs(x2 - x1)
              const height = Math.abs(y2 - y1)
              const underlineY = y + height
              const strikeY = y + height * 0.52
              const lineY = ann.type === "underline" ? underlineY : strikeY
              if (
                circleIntersectsRect(
                  cx,
                  cy,
                  r,
                  x - 6,
                  lineY - 10,
                  x + width + 6,
                  lineY + 10,
                )
              ) {
                hit = true
                break
              }
            }
          }
        } else if (ann.type === "pen") {
          const vpPoints = ann.points.map((p) => {
            const [x, y] = pdfToViewport(viewportRef.current, p.x, p.y)
            return { x, y }
          })
          const strokeR = Math.max(
            r,
            ((ann.strokeWidth ?? 2) * (viewportRef.current.scale || 1)) / 2,
          )
          for (let i = 0; i < vpPoints.length - 1; i++) {
            if (
              distToSegmentSquared(
                cx,
                cy,
                vpPoints[i].x,
                vpPoints[i].y,
                vpPoints[i + 1].x,
                vpPoints[i + 1].y,
              ) <=
              (strokeR + 4) * (strokeR + 4)
            ) {
              hit = true
              break
            }
          }
        } else if (ann.type === "shape") {
          const [x1, y1] = pdfToViewport(viewportRef.current, ann.rect.x, ann.rect.y)
          const [x2, y2] = pdfToViewport(
            viewportRef.current,
            ann.rect.x + ann.rect.width,
            ann.rect.y + ann.rect.height,
          )
          if (circleIntersectsRect(cx, cy, r, x1, y1, x2, y2)) hit = true
        } else if (ann.type === "text") {
          const [x, y] = pdfToViewport(viewportRef.current, ann.x, ann.y)
          const scale = viewportRef.current.scale || 1
          const width = (ann.width ?? 240) * scale
          const height = (ann.height ?? 80) * scale
          if (circleIntersectsRect(cx, cy, r, x, y, x + width, y + height)) hit = true
        } else if (ann.type === "note") {
          const [x, y] = pdfToViewport(viewportRef.current, ann.x, ann.y)
          if (circleIntersectsRect(cx, cy, r, x - 14, y - 14, x + 14, y + 14)) hit = true
        }

        if (hit) {
          deletedInStrokeRef.current.add(ann.id)
          deleteAnnotation(docId, ann.id)
          if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
          if (noteDraft?.annotationId === ann.id) setNoteDraft(null)
        }
        continue
      }

      // Precision Partial Erasure Mode (Default)
      if (ann.type === "highlight") {
        if (ann.rects && ann.rects.length > 0) {
          const { survivingRects, modified } = subtractEraserFromRects(
            ann.rects,
            cx,
            cy,
            r,
            viewportRef.current,
          )
          if (modified) {
            if (survivingRects.length === 0) {
              deletedInStrokeRef.current.add(ann.id)
              deleteAnnotation(docId, ann.id)
              if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
            } else {
              updateAnnotation(docId, ann.id, { rects: survivingRects })
            }
          }
        } else if (ann.points && ann.points.length > 1) {
          const { survivingChains, modified } = subtractEraserFromPoints(
            ann.points,
            cx,
            cy,
            r,
            viewportRef.current,
            ann.strokeWidth ?? 16,
            true, // isHighlighter
          )
          if (modified) {
            if (survivingChains.length === 0) {
              deletedInStrokeRef.current.add(ann.id)
              deleteAnnotation(docId, ann.id)
              if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
            } else {
              updateAnnotation(docId, ann.id, { points: survivingChains[0] })
              for (let i = 1; i < survivingChains.length; i++) {
                addAnnotation({
                  ...ann,
                  id: id(),
                  points: survivingChains[i],
                })
              }
            }
          }
        }
      } else if (ann.type === "underline" || ann.type === "strikethrough") {
        if (ann.rects && ann.rects.length > 0) {
          const { survivingRects, modified } = subtractEraserFromRects(
            ann.rects,
            cx,
            cy,
            r,
            viewportRef.current,
          )
          if (modified) {
            if (survivingRects.length === 0) {
              deletedInStrokeRef.current.add(ann.id)
              deleteAnnotation(docId, ann.id)
              if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
            } else {
              updateAnnotation(docId, ann.id, { rects: survivingRects })
            }
          }
        }
      } else if (ann.type === "pen") {
        const { survivingChains, modified } = subtractEraserFromPoints(
          ann.points,
          cx,
          cy,
          r,
          viewportRef.current,
          ann.strokeWidth ?? 2,
          false, // isHighlighter
        )
        if (modified) {
          if (survivingChains.length === 0) {
            deletedInStrokeRef.current.add(ann.id)
            deleteAnnotation(docId, ann.id)
            if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
          } else {
            updateAnnotation(docId, ann.id, { points: survivingChains[0] })
            for (let i = 1; i < survivingChains.length; i++) {
              addAnnotation({
                ...ann,
                id: id(),
                points: survivingChains[i],
              })
            }
          }
        }
      } else if (ann.type === "shape" || ann.type === "text" || ann.type === "note") {
        if (deletedInStrokeRef.current.has(ann.id)) continue
        let hit = false
        if (ann.type === "shape") {
          const [x1, y1] = pdfToViewport(viewportRef.current, ann.rect.x, ann.rect.y)
          const [x2, y2] = pdfToViewport(
            viewportRef.current,
            ann.rect.x + ann.rect.width,
            ann.rect.y + ann.rect.height,
          )
          if (circleIntersectsRect(cx, cy, r, x1, y1, x2, y2)) hit = true
        } else if (ann.type === "text") {
          const [x, y] = pdfToViewport(viewportRef.current, ann.x, ann.y)
          const scale = viewportRef.current.scale || 1
          const width = (ann.width ?? 240) * scale
          const height = (ann.height ?? 80) * scale
          if (circleIntersectsRect(cx, cy, r, x, y, x + width, y + height)) hit = true
        } else if (ann.type === "note") {
          const [x, y] = pdfToViewport(viewportRef.current, ann.x, ann.y)
          if (circleIntersectsRect(cx, cy, r, x - 14, y - 14, x + 14, y + 14)) hit = true
        }

        if (hit) {
          deletedInStrokeRef.current.add(ann.id)
          deleteAnnotation(docId, ann.id)
          if (selectedAnnotationId === ann.id) setSelectedAnnotationId(null)
          if (noteDraft?.annotationId === ann.id) setNoteDraft(null)
        }
      }
    }
  }

  useEffect(() => {
    const onOpenNote = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail || detail.docId !== docId || detail.page !== page) return
      setSelectedAnnotationId(detail.annotationId)
      setNoteDraft({
        annotationId: detail.annotationId,
        pdfX: detail.pdfX,
        pdfY: detail.pdfY,
        text: detail.text || "",
        color: detail.color || "#F6D860",
      })
    }
    window.addEventListener("aura:open-note-editor", onOpenNote)
    return () => window.removeEventListener("aura:open-note-editor", onOpenNote)
  }, [docId, page])

  const getPdfCoords = (event: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const [x, y] = viewportToPdf(
      viewportRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top,
    )
    return { x, y }
  }

  const updatePreview = () => {
    if (!previewPathRef.current) return
    const raw = pointsRef.current
    if (raw.length === 0) {
      previewPathRef.current.setAttribute("d", "")
      return
    }
    const pts =
      activeTool === "highlight"
        ? normalizeHighlighterPoints(
            raw,
            toolSettings.highlightStraighten,
            shiftKeyRef.current,
          )
        : raw

    const vpPts = pts.map((point) => {
      const [x, y] = pdfToViewport(viewportRef.current, point.x, point.y)
      return { x, y }
    })
    previewPathRef.current.setAttribute("d", pointsToSmoothSvgPath(vpPts))
  }

  const releasePointer = () => {
    const svg = svgRef.current
    const pointerId = pointerIdRef.current
    if (svg && pointerId !== null && svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId)
    }
    pointerIdRef.current = null
  }

  const resetDrawing = () => {
    releasePointer()
    drawingRef.current = false
    isErasingRef.current = false
    deletedInStrokeRef.current.clear()
    pointsRef.current = []
    setShapePreview(null)
    updatePreview()
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    if (activeTool === "eraser") {
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerIdRef.current = event.pointerId
      isErasingRef.current = true
      deletedInStrokeRef.current.clear()
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top
        lastEraserPointRef.current = { x: cx, y: cy }
        setEraserVpPoint({ x: cx, y: cy })
        eraseAtViewportPoint(cx, cy)
      }
      return
    }

    const target = event.target as Element
    if (target === svgRef.current) {
      setSelectedAnnotationId(null)
      if (activeTool !== "note") setNoteDraft(null)
    }

    if (activeTool === "note") {
      const coords = getPdfCoords(event)
      setNoteDraft({
        pdfX: coords.x,
        pdfY: coords.y,
        text: "",
        color: toolSettings.noteColor || "#FFEE58",
      })
      return
    }

    if (
      activeTool === "highlight" ||
      activeTool === "pen" ||
      activeTool === "shape"
    ) {
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerIdRef.current = event.pointerId
      drawingRef.current = true
      shiftKeyRef.current = event.shiftKey
      const startPt = getPdfCoords(event)
      pointsRef.current = [startPt]
      if (activeTool === "shape") {
        setShapePreview({ start: startPt, end: startPt })
      } else {
        updatePreview()
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (activeTool === "eraser") {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top
        setEraserVpPoint({ x: cx, y: cy })
        if (isErasingRef.current) {
          if (lastEraserPointRef.current) {
            const prev = lastEraserPointRef.current
            const dist = Math.hypot(cx - prev.x, cy - prev.y)
            const step = Math.max(5, (toolSettings.eraserRadius || 20) / 2)
            const steps = Math.max(1, Math.ceil(dist / step))
            for (let s = 1; s <= steps; s++) {
              const ix = prev.x + (s / steps) * (cx - prev.x)
              const iy = prev.y + (s / steps) * (cy - prev.y)
              eraseAtViewportPoint(ix, iy)
            }
          } else {
            eraseAtViewportPoint(cx, cy)
          }
          lastEraserPointRef.current = { x: cx, y: cy }
        }
      }
      return
    }

    if (!drawingRef.current) return
    shiftKeyRef.current = event.shiftKey
    const point = getPdfCoords(event)

    if (activeTool === "shape") {
      const start = pointsRef.current[0]
      if (start) {
        pointsRef.current[1] = point
        setShapePreview({ start, end: point })
      }
      return
    }

    const last = pointsRef.current[pointsRef.current.length - 1]
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 1.2) {
      pointsRef.current.push(point)
      updatePreview()
    }
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    if (activeTool === "eraser") {
      isErasingRef.current = false
      lastEraserPointRef.current = null
      deletedInStrokeRef.current.clear()
      releasePointer()
      return
    }

    if (!drawingRef.current) return
    shiftKeyRef.current = event.shiftKey
    const endPoint = getPdfCoords(event)
    const rawPoints = [...pointsRef.current, endPoint]
    const tool = activeTool
    resetDrawing()
    if (rawPoints.length < 2) return

    const first = rawPoints[0]
    const last = rawPoints[rawPoints.length - 1]
    if (
      Math.hypot(last.x - first.x, last.y - first.y) < 2 &&
      rawPoints.length <= 2
    ) {
      return
    }

    if (tool === "highlight") {
      const normalized = normalizeHighlighterPoints(
        rawPoints,
        toolSettings.highlightStraighten,
        shiftKeyRef.current,
      )
      addAnnotation({
        id: id(),
        docId,
        page,
        type: "highlight",
        color: toolSettings.highlightColor,
        points: normalized,
        strokeWidth: toolSettings.highlightWidth,
        opacity: 0.42,
      } as HighlightAnnotation)
    } else if (tool === "pen") {
      addAnnotation({
        id: id(),
        docId,
        page,
        type: "pen",
        color: toolSettings.penColor,
        points: rawPoints,
        strokeWidth: toolSettings.penWidth,
      })
    } else if (tool === "shape") {
      addAnnotation({
        id: id(),
        docId,
        page,
        type: "shape",
        shapeType: toolSettings.shapeType,
        color: toolSettings.shapeColor,
        rect: {
          x: Math.min(first.x, last.x),
          y: Math.min(first.y, last.y),
          width: Math.max(2, Math.abs(last.x - first.x)),
          height: Math.max(2, Math.abs(last.y - first.y)),
        },
        strokeWidth: toolSettings.shapeWidth,
      })
    }
  }

  const cancelInteraction = () => {
    resetDrawing()
  }

  useEffect(() => {
    cancelInteraction()
  }, [activeTool, page, docId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedAnnotationId || noteDraft) {
          event.stopPropagation()
        }
        cancelInteraction()
        setSelectedAnnotationId(null)
        setNoteDraft(null)
      }
      if (
        selectedAnnotationId &&
        (event.key === "Delete" || event.key === "Backspace") &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        deleteAnnotation(docId, selectedAnnotationId)
        setSelectedAnnotationId(null)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [selectedAnnotationId, docId, deleteAnnotation])

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedAnnotationId) || null,
    [annotations, selectedAnnotationId],
  )

  const getAnnotationAnchorViewport = (annotation: Annotation): {
    x: number
    y: number
  } => {
    if (annotation.type === "highlight") {
      if (annotation.points && annotation.points.length > 0) {
        const mid = annotation.points[Math.floor(annotation.points.length / 2)]
        const [x, y] = pdfToViewport(viewport, mid.x, mid.y)
        return { x, y: Math.max(28, y - 18) }
      }
      if (annotation.rects && annotation.rects.length > 0) {
        const r = annotation.rects[0]
        const [x, y] = pdfToViewport(
          viewport,
          r.x + r.width / 2,
          r.y + r.height,
        )
        return { x, y: Math.max(28, y - 12) }
      }
    }
    if (annotation.type === "pen" && annotation.points.length > 0) {
      const mid = annotation.points[Math.floor(annotation.points.length / 2)]
      const [x, y] = pdfToViewport(viewport, mid.x, mid.y)
      return { x, y: Math.max(28, y - 16) }
    }
    if (annotation.type === "shape") {
      const [x1, y1] = pdfToViewport(
        viewport,
        annotation.rect.x,
        annotation.rect.y,
      )
      const [x2, y2] = pdfToViewport(
        viewport,
        annotation.rect.x + annotation.rect.width,
        annotation.rect.y + annotation.rect.height,
      )
      return { x: (x1 + x2) / 2, y: Math.max(28, Math.min(y1, y2) - 12) }
    }
    if (
      annotation.type === "underline" ||
      annotation.type === "strikethrough"
    ) {
      const r = annotation.rects[0]
      if (r) {
        const [x, y] = pdfToViewport(
          viewport,
          r.x + r.width / 2,
          r.y + r.height,
        )
        return { x, y: Math.max(28, y - 12) }
      }
    }
    if (annotation.type === "note" || annotation.type === "text") {
      const [x, y] = pdfToViewport(viewport, annotation.x, annotation.y)
      return { x, y: Math.max(28, y - 12) }
    }
    return { x: viewport.width / 2, y: 36 }
  }

  const renderAnnotation = (annotation: Annotation) => {
    const isSelected = selectedAnnotationId === annotation.id
    const isEraser = activeTool === "eraser"
    const isReadingAnnotation =
      annotation.type === "highlight" ||
      annotation.type === "underline" ||
      annotation.type === "strikethrough"

    const clickHandler = (event: React.MouseEvent) => {
      event.stopPropagation()
      if (isEraser) {
        deleteAnnotation(docId, annotation.id)
        setSelectedAnnotationId(null)
        setNoteDraft(null)
        return
      }
      if (isReadingAnnotation) return
      if (annotation.type === "note" && suppressNoteClickRef.current) {
        suppressNoteClickRef.current = false
        return
      }
      setSelectedAnnotationId(annotation.id)
      if (annotation.type === "note") {
        setNoteDraft({
          annotationId: annotation.id,
          pdfX: annotation.x,
          pdfY: annotation.y,
          text: annotation.note,
          color: annotation.color || "#F6D860",
        })
      }
    }

    if (annotation.type === "highlight") {
      // Upgrade legacy yellow tones to warm editorial Amber Gold (#F6D860)
      const lowerColor = annotation.color?.toLowerCase()
      const markerColor =
        lowerColor === "#f4d35e" || lowerColor === "#ffee58"
          ? "#F6D860"
          : annotation.color

      if (annotation.points && annotation.points.length > 1) {
        const vpPoints = annotation.points.map((point) => {
          const [x, y] = pdfToViewport(viewport, point.x, point.y)
          return { x, y }
        })
        const pathData = pointsToSmoothSvgPath(vpPoints)
        const sw = (annotation.strokeWidth ?? 16) * (viewport.scale || 1)
        return (
          <g
            key={annotation.id}
            style={{
              pointerEvents: "none",
              cursor: isEraser ? ERASER_CURSOR_CSS : "default",
              mixBlendMode: "multiply",
            }}
          >
            <path
              d={pathData}
              fill="none"
              stroke={markerColor}
              opacity={0.42}
              strokeWidth={sw}
              strokeLinecap="butt"
              strokeLinejoin="round"
              style={{ pointerEvents: "none" }}
            />
          </g>
        )
      }
      const renderedRects = mergeAdjacentLineRects(annotation.rects || [])
      return (
        <g
          key={annotation.id}
          className="annotation-ink-in"
          style={{
            pointerEvents: "none",
            cursor: isEraser ? ERASER_CURSOR_CSS : "default",
            mixBlendMode: "multiply",
          }}
        >
          {renderedRects.map((rect, index) => {
            const [x1, y1] = pdfToViewport(viewport, rect.x, rect.y)
            const [x2, y2] = pdfToViewport(
              viewport,
              rect.x + rect.width,
              rect.y + rect.height,
            )
            const rx = Math.min(x1, x2) - 1.5
            const ry = Math.min(y1, y2) - 1
            const rw = Math.abs(x2 - x1) + 3
            const rh = Math.abs(y2 - y1) + 2
            return (
              <rect
                key={index}
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                rx={2.5}
                fill={markerColor}
                opacity={0.42}
                style={{ pointerEvents: "none" }}
              />
            )
          })}
        </g>
      )
    }

    if (annotation.type === "pen") {
      const vpPoints = annotation.points.map((point) => {
        const [x, y] = pdfToViewport(viewport, point.x, point.y)
        return { x, y }
      })
      const pathData = pointsToSmoothSvgPath(vpPoints)
      return (
        <path
          key={annotation.id}
          d={pathData}
          fill="none"
          stroke={annotation.color}
          strokeWidth={
            (annotation.strokeWidth + (isSelected ? 1.2 : 0)) *
            (viewport.scale || 1)
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          onClick={clickHandler}
          style={{
            pointerEvents: isEraser ? "none" : "auto",
            cursor: isEraser ? ERASER_CURSOR_CSS : "pointer",
          }}
        />
      )
    }

    if (annotation.type === "shape") {
      const [x1, y1] = pdfToViewport(
        viewport,
        annotation.rect.x,
        annotation.rect.y,
      )
      const [x2, y2] = pdfToViewport(
        viewport,
        annotation.rect.x + annotation.rect.width,
        annotation.rect.y + annotation.rect.height,
      )
      const x = Math.min(x1, x2)
      const y = Math.min(y1, y2)
      const width = Math.abs(x2 - x1)
      const height = Math.abs(y2 - y1)
      const sw = annotation.strokeWidth * (viewport.scale || 1)

      if (annotation.shapeType === "circle") {
        return (
          <ellipse
            key={annotation.id}
            cx={x + width / 2}
            cy={y + height / 2}
            rx={Math.max(2, width / 2)}
            ry={Math.max(2, height / 2)}
            fill={annotation.fillColor || "none"}
            stroke={annotation.color}
            strokeDasharray={isSelected ? "4 2" : undefined}
            strokeWidth={sw}
            onClick={clickHandler}
            style={{
              pointerEvents: isEraser ? "none" : "auto",
              cursor: isEraser ? ERASER_CURSOR_CSS : "pointer",
            }}
          />
        )
      }

      if (annotation.shapeType === "line") {
        return (
          <line
            key={annotation.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={annotation.color}
            strokeDasharray={isSelected ? "4 2" : undefined}
            strokeWidth={sw}
            strokeLinecap="round"
            onClick={clickHandler}
            style={{
              pointerEvents: isEraser ? "none" : "auto",
              cursor: isEraser ? ERASER_CURSOR_CSS : "pointer",
            }}
          />
        )
      }

      return (
        <rect
          key={annotation.id}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={2}
          fill={annotation.fillColor || "none"}
          stroke={annotation.color}
          strokeDasharray={isSelected ? "4 2" : undefined}
          strokeWidth={sw}
          onClick={clickHandler}
          style={{
            pointerEvents: isEraser ? "none" : "auto",
            cursor: isEraser ? ERASER_CURSOR_CSS : "pointer",
          }}
        />
      )
    }

    if (annotation.type === "text") {
      const [x, y] = pdfToViewport(viewport, annotation.x, annotation.y)
      const scale = viewport.scale || 1
      const width = (annotation.width ?? 240) * scale
      const height = (annotation.height ?? 80) * scale
      return (
        <g
          key={annotation.id}
          onClick={clickHandler}
          style={{
            pointerEvents: isEraser ? "none" : "auto",
            cursor: isEraser ? ERASER_CURSOR_CSS : "pointer",
          }}
        >
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="rgba(255,253,248,0.82)"
            stroke={isSelected ? "var(--primary)" : "rgba(40,38,34,0.35)"}
            strokeWidth={isSelected ? 2 : 1}
            rx={3}
          />
          {annotation.text.split("\n").map((line, index) => (
            <text
              key={index}
              x={x + 8 * scale}
              y={y + (20 + index * 18) * scale}
              fill={annotation.color}
              fontSize={annotation.fontSize * scale}
            >
              {line}
            </text>
          ))}
        </g>
      )
    }

    if (annotation.type === "note") {
      const [x, y] = pdfToViewport(viewport, annotation.x, annotation.y)
      const noteSize = 24
      const isDraggingThis = noteDragRef.current?.id === annotation.id

      return (
        <g
          key={annotation.id}
          transform={`translate(${x - 12}, ${y - 12})`}
          onClick={clickHandler}
          onPointerDown={(event) => {
            if (isEraser) return
            event.stopPropagation()
            try {
              ;(event.currentTarget as Element).setPointerCapture(
                event.pointerId,
              )
            } catch {}
            noteDragRef.current = {
              id: annotation.id,
              clientX: event.clientX,
              clientY: event.clientY,
              originX: annotation.x,
              originY: annotation.y,
              moved: false,
            }
          }}
          onPointerMove={(event) => {
            const drag = noteDragRef.current
            if (!drag || drag.id !== annotation.id) return
            const dx = event.clientX - drag.clientX
            const dy = event.clientY - drag.clientY
            if (!drag.moved && Math.hypot(dx, dy) < 3) return
            drag.moved = true
            const scale = viewport.scale || 1
            const nextX = Math.min(
              Math.max(drag.originX + dx / scale, 0),
              Math.max(0, viewport.width / scale - noteSize),
            )
            const nextY = Math.min(
              Math.max(drag.originY - dy / scale, 0),
              Math.max(0, viewport.height / scale - noteSize),
            )
            updateAnnotation(docId, annotation.id, { x: nextX, y: nextY })
          }}
          onPointerUp={(event) => {
            const drag = noteDragRef.current
            noteDragRef.current = null
            if (drag?.moved) {
              // A drag must not also open the editor.
              suppressNoteClickRef.current = true
              window.setTimeout(() => {
                suppressNoteClickRef.current = false
              }, 150)
            }
            try {
              ;(event.currentTarget as Element).releasePointerCapture(
                event.pointerId,
              )
            } catch {}
          }}
          onPointerCancel={() => {
            noteDragRef.current = null
          }}
          style={{
            pointerEvents: isEraser ? "none" : "auto",
            cursor: isEraser
              ? ERASER_CURSOR_CSS
              : isDraggingThis
                ? "grabbing"
                : "grab",
            filter: isDraggingThis
              ? "drop-shadow(0 4px 8px rgba(0,0,0,0.35))"
              : undefined,
            transition: isDraggingThis ? "none" : "filter 150ms ease",
          }}
        >
          <title>{annotation.note}</title>
          <rect
            width={24}
            height={24}
            fill={annotation.color || "#F6D860"}
            stroke={isSelected ? "var(--primary)" : "#A87C28"}
            strokeWidth={isSelected ? 2 : 1.2}
            rx={5}
          />
          <path
            d="M6.5 8h11M6.5 12h11M6.5 16h7"
            stroke="#3D2E10"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      )
    }

    if (
      annotation.type === "underline" ||
      annotation.type === "strikethrough"
    ) {
      return (
        <g
          key={annotation.id}
          className="annotation-ink-in"
          style={{
            pointerEvents: "none",
            cursor: isEraser ? ERASER_CURSOR_CSS : "default",
          }}
        >
          {annotation.rects.map((rect, index) => {
            const [x1, y1] = pdfToViewport(viewport, rect.x, rect.y)
            const [x2, y2] = pdfToViewport(
              viewport,
              rect.x + rect.width,
              rect.y + rect.height,
            )
            const x = Math.min(x1, x2)
            const y = Math.min(y1, y2)
            const width = Math.abs(x2 - x1)
            const height = Math.abs(y2 - y1)

            // High-precision typographic alignment:
            // Text glyph bounds in PDFium are tight character bounds where y is top and y + height is bottom.
            // An underline sits cleanly right beneath the glyph baseline at y + height.
            // A strikethrough sits centered at y + height * 0.52.
            const scale = viewport.scale || 1
            const strokeW = Math.max(1.6, 1.8 * scale)
            const underlineY = y + height
            const strikeY = y + height * 0.52
            const lineY =
              annotation.type === "underline" ? underlineY : strikeY

            return (
              <g key={index}>
                <line
                  x1={Math.round(x) + 0.5}
                  x2={Math.round(x + width) + 0.5}
                  y1={Math.round(lineY) + 0.5}
                  y2={Math.round(lineY) + 0.5}
                  stroke={annotation.color}
                  strokeLinecap="round"
                  strokeWidth={strokeW}
                  style={{ pointerEvents: "none" }}
                />
              </g>
            )
          })}
        </g>
      )
    }
    return null
  }

  const interceptsPointer = [
    "highlight",
    "pen",
    "shape",
    "note",
    "eraser",
  ].includes(activeTool)

  const renderShapePreview = () => {
    if (!shapePreview) return null
    const [x1, y1] = pdfToViewport(
      viewport,
      shapePreview.start.x,
      shapePreview.start.y,
    )
    const [x2, y2] = pdfToViewport(
      viewport,
      shapePreview.end.x,
      shapePreview.end.y,
    )
    const x = Math.min(x1, x2)
    const y = Math.min(y1, y2)
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)
    const sw = toolSettings.shapeWidth * (viewport.scale || 1)

    if (toolSettings.shapeType === "circle") {
      return (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={Math.max(1, width / 2)}
          ry={Math.max(1, height / 2)}
          fill="none"
          stroke={toolSettings.shapeColor}
          strokeWidth={sw}
          strokeDasharray="4 2"
          pointerEvents="none"
        />
      )
    }
    if (toolSettings.shapeType === "line") {
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={toolSettings.shapeColor}
          strokeWidth={sw}
          strokeDasharray="4 2"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )
    }
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill="none"
        stroke={toolSettings.shapeColor}
        strokeWidth={sw}
        strokeDasharray="4 2"
        pointerEvents="none"
      />
    )
  }

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          inset: 0,
          width: viewport.width,
          height: viewport.height,
          pointerEvents: interceptsPointer ? "auto" : "none",
          cursor: activeTool === "eraser" ? ERASER_CURSOR_CSS : undefined,
          zIndex: 20,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (!isErasingRef.current) {
            setEraserVpPoint(null)
          }
        }}
        onPointerCancel={cancelInteraction}
      >
        {annotations.map(renderAnnotation)}
        {activeTool === "eraser" && eraserVpPoint && (
          <g pointerEvents="none" className="select-none eraser-ring">
            {/* Soft halo so the ring reads on both white pages and busy scans. */}
            <circle
              cx={eraserVpPoint.x}
              cy={eraserVpPoint.y}
              r={(toolSettings.eraserRadius || 24) + 1.5}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={3}
            />
            <circle
              cx={eraserVpPoint.x}
              cy={eraserVpPoint.y}
              r={toolSettings.eraserRadius || 24}
              fill={
                isErasingRef.current
                  ? "rgba(56, 189, 248, 0.22)"
                  : "rgba(56, 189, 248, 0.06)"
              }
              stroke={
                isErasingRef.current
                  ? "rgba(2, 132, 199, 0.95)"
                  : "rgba(100, 116, 139, 0.8)"
              }
              strokeWidth={1.4}
              style={{
                transition:
                  "fill 120ms ease, stroke 120ms ease, r 120ms ease",
              }}
            />
            {/* Center precision dot */}
            <circle
              cx={eraserVpPoint.x}
              cy={eraserVpPoint.y}
              r={1.2}
              fill={
                isErasingRef.current
                  ? "rgba(225, 29, 72, 0.9)"
                  : "rgba(160, 160, 160, 0.85)"
              }
            />
          </g>
        )}
        <path
          ref={previewPathRef}
          fill="none"
          stroke={
            activeTool === "highlight"
              ? toolSettings.highlightColor
              : toolSettings.penColor
          }
          opacity={activeTool === "highlight" ? 0.42 : 1}
          strokeWidth={
            (activeTool === "highlight"
              ? toolSettings.highlightWidth
              : toolSettings.penWidth) * (viewport.scale || 1)
          }
          strokeLinecap={activeTool === "highlight" ? "butt" : "round"}
          strokeLinejoin="round"
          style={
            activeTool === "highlight"
              ? { mixBlendMode: "multiply" }
              : undefined
          }
          pointerEvents="none"
        />
        {renderShapePreview()}
      </svg>

      {/* Selected Annotation Quick Action Pill (Change Color / Delete for freehand pen / shape / text only) */}
      {selectedAnnotation &&
        selectedAnnotation.type !== "note" &&
        selectedAnnotation.type !== "highlight" &&
        selectedAnnotation.type !== "underline" &&
        selectedAnnotation.type !== "strikethrough" && (
        <div
          className="absolute z-30 -translate-x-1/2 -translate-y-full flex items-center gap-1.5 rounded-xl border border-border bg-card/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md modal-pop"
          style={{
            left: Math.min(
              Math.max(90, getAnnotationAnchorViewport(selectedAnnotation).x),
              viewport.width - 90,
            ),
            top: Math.max(
              36,
              getAnnotationAnchorViewport(selectedAnnotation).y,
            ),
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {PEN_PALETTE.map((swatch) => (
            <button
              key={swatch.value}
              title={swatch.label}
              onClick={() =>
                updateAnnotation(docId, selectedAnnotation.id, {
                  color: swatch.value,
                })
              }
              className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                selectedAnnotation.color.toLowerCase() ===
                swatch.value.toLowerCase()
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110"
                  : "border-black/20"
              }`}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
          <div className="h-3.5 w-px bg-border mx-0.5" />
          <button
            onClick={() => {
              deleteAnnotation(docId, selectedAnnotation.id)
              setSelectedAnnotationId(null)
            }}
            title="Delete annotation (Del)"
            className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <TrashIcon size={12} />
          </button>
        </div>
      )}

      {/* Interactive Sticky Note Popover Editor / Viewer */}
      {noteDraft &&
        (() => {
          const [vx, vy] = pdfToViewport(
            viewport,
            noteDraft.pdfX,
            noteDraft.pdfY,
          )
          const clampedX = Math.min(
            Math.max(16, vx - 110),
            Math.max(16, viewport.width - 236),
          )
          const clampedY = Math.min(
            Math.max(16, vy + 16),
            Math.max(16, viewport.height - 190),
          )
          return (
            <div
              className="absolute z-30 w-56 rounded-xl border border-border bg-card p-3 shadow-2xl modal-pop"
              style={{ left: clampedX, top: clampedY }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  {HIGHLIGHT_PALETTE.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() =>
                        setNoteDraft({ ...noteDraft, color: swatch.value })
                      }
                      className={`w-3.5 h-3.5 rounded-full border ${
                        noteDraft.color === swatch.value
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                          : "border-black/20"
                      }`}
                      style={{ backgroundColor: swatch.value }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(null)
                    setSelectedAnnotationId(null)
                  }}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <XIcon size={12} />
                </button>
              </div>
              <textarea
                autoFocus
                rows={3}
                value={noteDraft.text}
                onChange={(e) =>
                  setNoteDraft({ ...noteDraft, text: e.target.value })
                }
                placeholder="Write a note…"
                className="w-full rounded-lg border border-border bg-muted/60 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    const trimmed = noteDraft.text.trim()
                    if (!trimmed) return
                    if (noteDraft.annotationId) {
                      updateAnnotation(docId, noteDraft.annotationId, {
                        note: trimmed,
                        color: noteDraft.color,
                      })
                    } else {
                      addAnnotation({
                        id: id(),
                        docId,
                        page,
                        type: "note",
                        color: noteDraft.color,
                        x: noteDraft.pdfX,
                        y: noteDraft.pdfY,
                        note: trimmed,
                      })
                    }
                    setNoteDraft(null)
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                {noteDraft.annotationId ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteAnnotation(docId, noteDraft.annotationId!)
                      setNoteDraft(null)
                      setSelectedAnnotationId(null)
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-500/10"
                  >
                    <TrashIcon size={11} /> Delete
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Ctrl+Enter to save
                  </span>
                )}
                <button
                  type="button"
                  disabled={!noteDraft.text.trim()}
                  onClick={() => {
                    const trimmed = noteDraft.text.trim()
                    if (!trimmed) return
                    if (noteDraft.annotationId) {
                      updateAnnotation(docId, noteDraft.annotationId, {
                        note: trimmed,
                        color: noteDraft.color,
                      })
                    } else {
                      addAnnotation({
                        id: id(),
                        docId,
                        page,
                        type: "note",
                        color: noteDraft.color,
                        x: noteDraft.pdfX,
                        y: noteDraft.pdfY,
                        note: trimmed,
                      })
                    }
                    setNoteDraft(null)
                  }}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )
        })()}
    </>
  )
}
