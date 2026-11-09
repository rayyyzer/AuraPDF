export type PageGeometry = {
  originalWidth: number
  originalHeight: number
  displayWidth: number
  displayHeight: number
  rotation: number
  aspectRatio: number
}

export type FitMode = "page" | "width" | "manual" | "actual"

export function getNormalizedRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360
}

/**
 * Returns the intrinsic display geometry of a page, accounting for rotation.
 * If rotation is 90 or 270, the display width and height are swapped.
 */
export function getBaseGeometry(
  originalWidth: number,
  originalHeight: number,
  rotation: number,
): PageGeometry {
  const normalizedRotation = getNormalizedRotation(rotation)
  const isLandscapeRotate =
    normalizedRotation === 90 || normalizedRotation === 270

  const displayWidth = isLandscapeRotate ? originalHeight : originalWidth
  const displayHeight = isLandscapeRotate ? originalWidth : originalHeight
  const aspectRatio = displayWidth / displayHeight

  return {
    originalWidth,
    originalHeight,
    displayWidth,
    displayHeight,
    rotation: normalizedRotation,
    aspectRatio,
  }
}

/**
 * Calculates the final display dimensions and the exact scalar needed
 * based on the chosen fit mode and available container dimensions.
 */
export function getFittedGeometry(
  baseGeometry: PageGeometry,
  fitMode: FitMode,
  zoomPercent: number,
  availableWidth: number,
  availableHeight: number,
  padding: number = 0,
): { width: number; height: number; scale: number } {
  let scale = zoomPercent / 100

  if (fitMode === "actual") {
    scale = 1.0
  } else if (fitMode === "width" && availableWidth > 0) {
    const targetW = availableWidth - padding
    scale = targetW / baseGeometry.displayWidth
  } else if (fitMode === "page" && availableWidth > 0 && availableHeight > 0) {
    const targetW = availableWidth - padding
    const targetH = availableHeight - padding
    scale = Math.min(
      targetW / baseGeometry.displayWidth,
      targetH / baseGeometry.displayHeight,
    )
  }

  if (scale <= 0 || !isFinite(scale)) scale = 1.0

  return {
    width: baseGeometry.displayWidth * scale,
    height: baseGeometry.displayHeight * scale,
    scale,
  }
}

export function getThumbnailGeometry(
  baseGeometry: PageGeometry,
  maxWidth: number,
  maxHeight?: number,
): { width: number; height: number; scale: number } {
  let scale = maxWidth / baseGeometry.displayWidth

  if (maxHeight !== undefined) {
    const heightScale = maxHeight / baseGeometry.displayHeight
    scale = Math.min(scale, heightScale)
  }

  return {
    width: baseGeometry.displayWidth * scale,
    height: baseGeometry.displayHeight * scale,
    scale,
  }
}
