export interface ViewportBox {
  left: number
  top: number
  width: number
  height: number
}

export interface PdfBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Converts a canonical PDF point (origin bottom-left, unrotated)
 * into viewport screen coordinates (origin top-left, scaled and rotated).
 */
export function pdfToViewport(
  viewport: any,
  x: number,
  y: number,
): [number, number] {
  const scale = viewport.scale || 1
  const isLandscape = viewport.rotation === 90 || viewport.rotation === 270
  const baseW = isLandscape ? viewport.height / scale : viewport.width / scale
  const baseH = isLandscape ? viewport.width / scale : viewport.height / scale

  // Convert canonical bottom-left PDF coordinates (0 <= y <= baseH) to unrotated top-left
  const tx = x
  const ty = baseH - y

  const sx = tx * scale
  const sy = ty * scale
  const sW = baseW * scale
  const sH = baseH * scale

  let vx = sx
  let vy = sy

  if (viewport.rotation === 90) {
    vx = sH - sy
    vy = sx
  } else if (viewport.rotation === 180) {
    vx = sW - sx
    vy = sH - sy
  } else if (viewport.rotation === 270) {
    vx = sy
    vy = sW - sx
  }

  return [vx, vy]
}

/**
 * Converts viewport screen coordinates (origin top-left, scaled and rotated)
 * back into canonical PDF coordinates (origin bottom-left, unrotated).
 */
export function viewportToPdf(
  viewport: any,
  vx: number,
  vy: number,
): [number, number] {
  const scale = viewport.scale || 1
  const isLandscape = viewport.rotation === 90 || viewport.rotation === 270
  const baseW = isLandscape ? viewport.height / scale : viewport.width / scale
  const baseH = isLandscape ? viewport.width / scale : viewport.height / scale

  const sW = baseW * scale
  const sH = baseH * scale

  let sx = vx
  let sy = vy

  if (viewport.rotation === 90) {
    sx = vy
    sy = sH - vx
  } else if (viewport.rotation === 180) {
    sx = sW - vx
    sy = sH - vy
  } else if (viewport.rotation === 270) {
    sx = sW - vy
    sy = vx
  }

  const tx = sx / scale
  const ty = sy / scale

  // Convert unrotated top-left to canonical bottom-left PDF coordinates
  const x = tx
  const y = baseH - ty

  return [x, y]
}

/**
 * Converts a canonical PDF bounding box (where origin (0,0) is bottom-left)
 * into viewport coordinates (where origin (0,0) is top-left) for any rotation and zoom scale.
 */
export function pdfBoxToViewport(viewport: any, box: PdfBox): ViewportBox {
  const [x1, y1] = pdfToViewport(viewport, box.x, box.y)
  const [x2, y2] = pdfToViewport(
    viewport,
    box.x + box.width,
    box.y + box.height,
  )
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.max(1, Math.abs(x2 - x1)),
    height: Math.max(1, Math.abs(y2 - y1)),
  }
}

/**
 * Converts a viewport bounding box (origin top-left) back into canonical PDF bounding box (origin bottom-left).
 */
export function viewportBoxToPdf(viewport: any, box: ViewportBox): PdfBox {
  const [x1, y1] = viewportToPdf(viewport, box.left, box.top)
  const [x2, y2] = viewportToPdf(
    viewport,
    box.left + box.width,
    box.top + box.height,
  )
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(0.5, Math.abs(x2 - x1)),
    height: Math.max(0.5, Math.abs(y2 - y1)),
  }
}

/**
 * Converts a viewport-space bounding rectangle `{ x, y, width, height }` (origin top-left)
 * into canonical PDF bounding box (origin bottom-left).
 */
export function viewportRectToAnnotationRect(
  viewport: any,
  box: { x: number; y: number; width: number; height: number },
): PdfBox {
  return viewportBoxToPdf(viewport, {
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
  })
}
