/**
 * Converts the reader's stored annotations into the flat payload the Rust exporter
 * understands.
 *
 * Coordinates are PDF space (origin bottom-left, y up) and pages are 1-based, matching how
 * annotations are stored. Nothing here guesses: annotations whose geometry is missing are
 * dropped rather than exported at the wrong place.
 */

export interface ExportAnnotationPayload {
  page: number
  kind: string
  color?: string
  rects?: [number, number, number, number][]
  strokes?: [number, number][][]
  text?: string
  strokeWidth?: number
}

type RectTuple = [number, number, number, number]

function toRectTuple(rect: any): RectTuple | null {
  const x = Number(rect?.x)
  const y = Number(rect?.y)
  const width = Number(rect?.width)
  const height = Number(rect?.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null
  return [x, y, width, height]
}

/** Bounding box of a freehand path, padded by half the stroke so the ink is not clipped. */
function boundsOfPoints(points: any[], strokeWidth: number): RectTuple | null {
  const valid = points.filter(
    (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
  )
  if (valid.length < 2) return null
  const xs = valid.map((point) => Number(point.x))
  const ys = valid.map((point) => Number(point.y))
  const pad = Math.max(1, strokeWidth / 2)
  const left = Math.min(...xs) - pad
  const bottom = Math.min(...ys) - pad
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2
  if (width <= 0 || height <= 0) return null
  return [left, bottom, width, height]
}

function toStrokes(points: any[]): [number, number][][] {
  if (!Array.isArray(points) || points.length < 2) return []
  const stroke: [number, number][] = points
    .filter(
      (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
    )
    .map((point) => [Number(point.x), Number(point.y)] as [number, number])
  return stroke.length >= 2 ? [stroke] : []
}

export function toExportAnnotations(
  annotations: any[],
): ExportAnnotationPayload[] {
  const result: ExportAnnotationPayload[] = []

  for (const annotation of annotations || []) {
    if (!annotation) continue
    const page = Number(annotation.page)
    if (!Number.isFinite(page) || page < 1) continue

    const base = { page, color: annotation.color }

    switch (annotation.type) {
      case "highlight": {
        let rects = (annotation.rects || [])
          .map(toRectTuple)
          .filter((rect: RectTuple | null): rect is RectTuple => Boolean(rect))
        if (rects.length === 0 && annotation.points?.length > 1) {
          const bounds = boundsOfPoints(
            annotation.points,
            Number(annotation.strokeWidth) || 0,
          )
          if (bounds) rects = [bounds]
        }
        if (rects.length > 0) {
          result.push({ ...base, kind: "highlight", rects })
        }
        break
      }

      case "underline":
      case "strikethrough": {
        const rects = (annotation.rects || [])
          .map(toRectTuple)
          .filter((rect: RectTuple | null): rect is RectTuple => Boolean(rect))
        if (rects.length > 0) {
          result.push({ ...base, kind: annotation.type, rects })
        }
        break
      }

      case "pen": {
        const strokes = toStrokes(annotation.points)
        if (strokes.length > 0) {
          result.push({
            ...base,
            kind: "pen",
            strokes,
            strokeWidth: Number(annotation.strokeWidth) || 2,
          })
        }
        break
      }

      case "shape": {
        const rect = toRectTuple(annotation.rect)
        if (!rect) break
        const shapeType = String(
          annotation.shapeType || annotation.shape || "rectangle",
        )
        const kind = /ellipse|circle|oval/i.test(shapeType) ? "ellipse" : "rect"
        result.push({
          ...base,
          kind,
          rects: [rect],
          strokeWidth: Number(annotation.strokeWidth) || 2,
        })
        break
      }

      case "text": {
        const rect = toRectTuple({
          x: annotation.x,
          y: annotation.y,
          width: annotation.width ?? 240,
          height: annotation.height ?? 80,
        })
        const text = String(annotation.text ?? "").trim()
        if (rect && text) {
          result.push({ ...base, kind: "text", rects: [rect], text })
        }
        break
      }

      case "note": {
        const rect = toRectTuple({
          x: Number(annotation.x) - 12,
          y: Number(annotation.y) - 12,
          width: 24,
          height: 24,
        })
        if (!rect) break
        result.push({
          ...base,
          kind: "note",
          rects: [rect],
          text: String(annotation.note ?? annotation.text ?? ""),
        })
        break
      }

      default:
        break
    }
  }

  return result
}
