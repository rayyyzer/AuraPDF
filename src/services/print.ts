import { NativePdfEngine } from "./pdf/engine"
import { pointsToSmoothSvgPath } from "../components/reader/annotationGeometry"

const PRINT_ROOT_ID = "aurapdf-print-root"

/**
 * Prints PDF pages through a dedicated print root.
 *
 * The reader virtualises pages, so only the visible ones are in the DOM; calling
 * `window.print()` directly prints whatever chrome and one or two pages happen to be
 * mounted. Instead the requested pages are rendered to images first and handed to the
 * browser's print pipeline, which is also what makes the page-break CSS reliable.
 *
 * Annotations live in an SVG overlay that is not part of the rendered bitmap, so they are
 * composited onto each page here. Otherwise a printed page would silently lose every
 * highlight and every pen stroke.
 */
export interface PrintableAnnotation {
  type: string
  page: number
  color?: string
  opacity?: number
  points?: { x: number; y: number }[]
  rects?: { x: number; y: number; width: number; height: number }[]
  strokeWidth?: number
  x?: number
  y?: number
  note?: string
  text?: string
}

function drawAnnotations(
  context: CanvasRenderingContext2D,
  pageAnnotations: PrintableAnnotation[],
  pageWidth: number,
  pageHeight: number,
  pixelWidth: number,
) {
  const k = pixelWidth / pageWidth
  // PDF space is y-up; the canvas is y-down.
  const toCanvas = (x: number, y: number) => ({ x: x * k, y: (pageHeight - y) * k })

  for (const annotation of pageAnnotations) {
    const colour = annotation.color || "#F6D860"
    context.save()
    context.globalAlpha =
      typeof annotation.opacity === "number" ? annotation.opacity : 0.42

    if (annotation.type === "highlight") {
      const points = annotation.points
      if (points && points.length > 1) {
        const viewportPoints = points.map((point) => toCanvas(point.x, point.y))
        context.strokeStyle = colour
        context.lineCap = "butt"
        context.lineJoin = "round"
        context.lineWidth = (annotation.strokeWidth ?? 16) * k
        context.stroke(new Path2D(pointsToSmoothSvgPath(viewportPoints)))
      } else if (annotation.rects?.length) {
        context.fillStyle = colour
        for (const rect of annotation.rects) {
          const topLeft = toCanvas(rect.x, rect.y + rect.height)
          context.fillRect(
            topLeft.x,
            topLeft.y,
            rect.width * k,
            rect.height * k,
          )
        }
      }
    } else if (
      annotation.type === "underline" ||
      annotation.type === "strikethrough"
    ) {
      context.strokeStyle = colour
      context.lineWidth = Math.max(1, 1.8 * k)
      for (const rect of annotation.rects || []) {
        const y =
          annotation.type === "underline"
            ? rect.y
            : rect.y + rect.height * 0.48
        const from = toCanvas(rect.x, y)
        const to = toCanvas(rect.x + rect.width, y)
        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
      }
    } else if (annotation.type === "pen") {
      context.globalAlpha = 1
      context.strokeStyle = colour
      context.lineCap = "round"
      context.lineJoin = "round"
      context.lineWidth = Math.max(1, (annotation.strokeWidth ?? 2) * k)
      const points = annotation.points || []
      if (points.length > 1) {
        context.beginPath()
        const first = toCanvas(points[0].x, points[0].y)
        context.moveTo(first.x, first.y)
        for (const point of points.slice(1)) {
          const next = toCanvas(point.x, point.y)
          context.lineTo(next.x, next.y)
        }
        context.stroke()
      }
    } else if (annotation.type === "note") {
      if (typeof annotation.x === "number" && typeof annotation.y === "number") {
        context.globalAlpha = 1
        const topLeft = toCanvas(annotation.x - 12, annotation.y + 12)
        const size = 24 * k
        context.fillStyle = colour
        context.strokeStyle = "rgba(120,90,20,0.9)"
        context.lineWidth = Math.max(1, k)
        context.beginPath()
        context.roundRect(topLeft.x, topLeft.y, size, size, 5 * k)
        context.fill()
        context.stroke()
        if (annotation.note) {
          context.fillStyle = "rgba(0,0,0,0.55)"
          context.font = `${Math.round(7 * k)}px sans-serif`
          context.fillText(
            annotation.note.slice(0, 28),
            topLeft.x + size + 4 * k,
            topLeft.y + size * 0.6,
          )
        }
      }
    }

    context.restore()
  }
}

export async function printPages(
  docId: string,
  pageIndexes: number[],
  annotations: PrintableAnnotation[] = [],
  scale = 1.4,
): Promise<number> {
  const root =
    document.getElementById(PRINT_ROOT_ID) ??
    (() => {
      const element = document.createElement("div")
      element.id = PRINT_ROOT_ID
      document.body.appendChild(element)
      return element
    })()

  root.innerHTML = ""
  let rendered = 0

  for (const pageIndex of pageIndexes) {
    let bytes: Uint8Array
    try {
      bytes = await NativePdfEngine.renderPage(docId, pageIndex, scale, 0, 100)
    } catch (error) {
      console.warn(`[PRINT] Page ${pageIndex + 1} could not be rendered:`, error)
      continue
    }

    if (bytes.byteLength < 8) continue
    const header = new DataView(bytes.buffer, bytes.byteOffset, 8)
    const width = header.getUint32(0, true)
    const height = header.getUint32(4, true)
    if (!width || !height || bytes.byteLength < 8 + width * height * 4) continue

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { alpha: false })
    if (!context) continue
    const pixels = new Uint8ClampedArray(
      bytes.buffer,
      bytes.byteOffset + 8,
      width * height * 4,
    )
    // Same cast the page renderer uses: the buffer view is a plain ArrayBuffer at runtime.
    context.putImageData(new ImageData(pixels as any, width, height), 0, 0)

    const pageAnnotations = annotations.filter(
      (annotation) => annotation.page === pageIndex + 1,
    )
    if (pageAnnotations.length > 0) {
      try {
        const meta = await NativePdfEngine.getPageMeta(docId, pageIndex)
        drawAnnotations(context, pageAnnotations, meta.width, meta.height, width)
      } catch (error) {
        console.warn("[PRINT] Annotations could not be drawn:", error)
      }
    }

    const sheet = document.createElement("div")
    sheet.className = "aurapdf-print-page"
    const image = document.createElement("img")
    image.src = canvas.toDataURL("image/jpeg", 0.92)
    image.alt = `Page ${pageIndex + 1}`
    sheet.appendChild(image)
    root.appendChild(sheet)
    rendered += 1
  }

  if (rendered === 0) return 0

  // Let layout settle so the print dialog sees final image sizes.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

  const cleanup = () => {
    root.innerHTML = ""
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)

  window.print()
  return rendered
}
