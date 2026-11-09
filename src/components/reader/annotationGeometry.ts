import { pdfToViewport, viewportToPdf, viewportRectToAnnotationRect } from "../../utils/coordinates"

/** The ring drawn under the pointer replaces the system cursor while erasing. */
export const ERASER_CURSOR_CSS = "none"

export function generateAnnotationId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)
}

/**
 * Converts a sequence of 2D viewport points into a smooth quadratic midpoint Bezier SVG path.
 */
export function pointsToSmoothSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2
    const midY = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return d
}

/**
 * Merges horizontally contiguous or overlapping highlight rects on the same line of text.
 */
export function mergeAdjacentLineRects(
  rects: { x: number; y: number; width: number; height: number }[],
): { x: number; y: number; width: number; height: number }[] {
  if (!rects || rects.length <= 1) return rects || []
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) return a.y - b.y
    return a.x - b.x
  })
  const merged: { x: number; y: number; width: number; height: number }[] = []
  for (const r of sorted) {
    if (merged.length === 0) {
      merged.push({ ...r })
      continue
    }
    const last = merged[merged.length - 1]
    const sameLine =
      Math.abs(last.y - r.y) <= Math.max(last.height, r.height) * 0.45
    const horizontalClose =
      r.x <= last.x + last.width + 8 && r.x + r.width >= last.x
    if (sameLine && horizontalClose) {
      const minX = Math.min(last.x, r.x)
      const maxX = Math.max(last.x + last.width, r.x + r.width)
      const minY = Math.min(last.y, r.y)
      const maxY = Math.max(last.y + last.height, r.y + r.height)
      last.x = minX
      last.y = minY
      last.width = maxX - minX
      last.height = maxY - minY
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

/**
 * Normalizes raw highlighter points in PDF space:
 * - If `straighten` is true and the user drags mostly horizontally across a line of text
 *   (or holds Shift), snaps the stroke into a crisp horizontal chisel-marker band.
 * - Otherwise, lightly moving-average filters hand jitter while preserving intentional curves.
 */
export function normalizeHighlighterPoints(
  rawPoints: { x: number; y: number }[],
  straighten: boolean,
  forceHorizontal: boolean,
): { x: number; y: number }[] {
  if (rawPoints.length < 2) return rawPoints

  const first = rawPoints[0]
  const last = rawPoints[rawPoints.length - 1]
  const dx = Math.abs(last.x - first.x)

  let minY = Infinity
  let maxY = -Infinity
  let sumY = 0
  for (const p of rawPoints) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
    sumY += p.y
  }
  const ySpan = maxY - minY
  const avgY = sumY / rawPoints.length

  if (
    forceHorizontal ||
    (straighten && dx > 18 && ySpan < Math.max(14, dx * 0.14))
  ) {
    return [
      { x: first.x, y: avgY },
      { x: last.x, y: avgY },
    ]
  }

  if (rawPoints.length <= 3) return rawPoints

  // Subtle 3-point smoothing filter to eliminate hand tremor on diagonal/curved highlights
  const smoothed: { x: number; y: number }[] = [rawPoints[0]]
  for (let i = 1; i < rawPoints.length - 1; i++) {
    smoothed.push({
      x: (rawPoints[i - 1].x + rawPoints[i].x * 2 + rawPoints[i + 1].x) / 4,
      y: (rawPoints[i - 1].y + rawPoints[i].y * 2 + rawPoints[i + 1].y) / 4,
    })
  }
  smoothed.push(rawPoints[rawPoints.length - 1])
  return smoothed
}

export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  const closestX = Math.max(minX, Math.min(cx, maxX))
  const closestY = Math.max(minY, Math.min(cy, maxY))

  const dx = cx - closestX
  const dy = cy - closestY
  return dx * dx + dy * dy <= r * r
}

export function distToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * (x2 - x1)
  const projY = y1 + t * (y2 - y1)
  const dx = px - projX
  const dy = py - projY
  return dx * dx + dy * dy
}

export function subdividePoints(
  vpPoints: Array<{ x: number; y: number }>,
  maxStep: number = 5,
): Array<{ x: number; y: number }> {
  if (vpPoints.length < 2) return vpPoints
  const res: Array<{ x: number; y: number }> = [vpPoints[0]]
  for (let i = 0; i < vpPoints.length - 1; i++) {
    const p1 = vpPoints[i]
    const p2 = vpPoints[i + 1]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const dist = Math.hypot(dx, dy)
    if (dist > maxStep) {
      const steps = Math.ceil(dist / maxStep)
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        res.push({ x: p1.x + t * dx, y: p1.y + t * dy })
      }
    }
    res.push(p2)
  }
  return res
}

/**
 * Subtracts the circular eraser region from an array of PDF bounding boxes (highlights, underlines, strikethroughs).
 */
export function subtractEraserFromRects(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  cx: number,
  cy: number,
  r: number,
  viewport: any,
): { survivingRects: Array<{ x: number; y: number; width: number; height: number }>; modified: boolean } {
  let modified = false
  const surviving: Array<{ x: number; y: number; width: number; height: number }> = []

  for (const rect of rects) {
    const [x1, y1] = pdfToViewport(viewport, rect.x, rect.y)
    const [x2, y2] = pdfToViewport(viewport, rect.x + rect.width, rect.y + rect.height)
    const rx = Math.min(x1, x2)
    const ry = Math.min(y1, y2)
    const rw = Math.abs(x2 - x1)
    const rh = Math.abs(y2 - y1)

    // Check intersection with the rect boundary
    if (!circleIntersectsRect(cx, cy, r, rx, ry, rx + rw, ry + rh)) {
      surviving.push(rect)
      continue
    }

    modified = true
    const cutLeft = cx - r
    const cutRight = cx + r

    // 1. Fully covered by eraser horizontally
    if (cutLeft <= rx + 2 && cutRight >= rx + rw - 2) {
      continue
    }

    // 2. Center split: cuts into middle of the rect (full vertical height rh excised)
    if (cutLeft > rx + 2 && cutRight < rx + rw - 2) {
      const leftPart = {
        x: rx,
        y: ry,
        width: cutLeft - rx,
        height: rh,
      }
      const rightPart = {
        x: cutRight,
        y: ry,
        width: rx + rw - cutRight,
        height: rh,
      }
      surviving.push(viewportRectToAnnotationRect(viewport, leftPart))
      surviving.push(viewportRectToAnnotationRect(viewport, rightPart))
      continue
    }

    // 3. Left edge trimmed (overbrush at start of phrase)
    if (cutLeft <= rx + 2 && cutRight < rx + rw - 2) {
      const remaining = {
        x: cutRight,
        y: ry,
        width: rx + rw - cutRight,
        height: rh,
      }
      surviving.push(viewportRectToAnnotationRect(viewport, remaining))
      continue
    }

    // 4. Right edge trimmed (overbrush at end of phrase)
    if (cutLeft > rx + 2 && cutRight >= rx + rw - 2) {
      const remaining = {
        x: rx,
        y: ry,
        width: cutLeft - rx,
        height: rh,
      }
      surviving.push(viewportRectToAnnotationRect(viewport, remaining))
      continue
    }

    surviving.push(rect)
  }

  return { survivingRects: surviving, modified }
}

/**
 * Subtracts the circular eraser region from a stroked point sequence (pen or freehand highlight).
 */
export function subtractEraserFromPoints(
  rawPoints: Array<{ x: number; y: number }>,
  cx: number,
  cy: number,
  r: number,
  viewport: any,
  strokeWidth: number = 3,
  isHighlighter: boolean = false,
): { survivingChains: Array<Array<{ x: number; y: number }>>; modified: boolean } {
  if (rawPoints.length < 2) return { survivingChains: [], modified: true }

  const vpPoints = rawPoints.map((p) => {
    const [x, y] = pdfToViewport(viewport, p.x, p.y)
    return { x, y }
  })

  // Subdivide segments so rapid straight strokes have dense points every 4-5px
  const densePoints = subdividePoints(vpPoints, Math.max(4, r / 3))

  const scale = viewport.scale || 1
  const effectiveR = r + (isHighlighter ? Math.max(8, (strokeWidth * scale) / 2) : Math.max(1, (strokeWidth * scale) / 2))
  const effRSq = effectiveR * effectiveR

  let modified = false
  const chains: Array<Array<{ x: number; y: number }>> = []
  let currentChain: Array<{ x: number; y: number }> = []

  for (let i = 0; i < densePoints.length; i++) {
    const p = densePoints[i]
    const distSq = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)
    const inside = distSq <= effRSq

    if (inside) {
      modified = true
      if (currentChain.length >= 2) {
        chains.push(currentChain)
      }
      currentChain = []
    } else {
      currentChain.push(p)
    }
  }

  if (currentChain.length >= 2) {
    chains.push(currentChain)
  }

  // Filter out redundant points from densely resampled surviving chains
  const pdfChains = chains.map((chain) => {
    const sampled = chain.filter((_, idx) => idx === 0 || idx === chain.length - 1 || idx % 2 === 0)
    return sampled.map((pt) => {
      const [x, y] = viewportToPdf(viewport, pt.x, pt.y)
      return { x, y }
    })
  })

  return { survivingChains: pdfChains, modified }
}
