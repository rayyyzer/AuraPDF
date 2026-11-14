export interface AxisBounds {
  min: number
  max: number
}

export interface AxisClampParams {
  scaledSize: number
  availStart: number
  availSpan: number
  desiredStart: number
  centerIfSmaller: boolean
}

/**
 * Computes valid visual placement bounds for a content axis inside its scroll viewport.
 * Keeps content aligned (centered or start-aligned) when smaller than the viewport and
 * prevents panning into empty canvas margin beyond valid scroll bounds when larger.
 */
export function getAxisBounds(
  scaledSize: number,
  availStart: number,
  availSpan: number,
  centerIfSmaller: boolean,
): AxisBounds {
  if (scaledSize <= availSpan) {
    const resting = centerIfSmaller
      ? availStart + (availSpan - scaledSize) / 2
      : availStart
    return { min: resting, max: resting }
  }
  return {
    min: availStart + availSpan - scaledSize,
    max: availStart,
  }
}

export function clampAxisPlacement({
  scaledSize,
  availStart,
  availSpan,
  desiredStart,
  centerIfSmaller,
}: AxisClampParams): number {
  const { min, max } = getAxisBounds(
    scaledSize,
    availStart,
    availSpan,
    centerIfSmaller,
  )
  return Math.min(max, Math.max(min, desiredStart))
}

export interface ClampedPinchInput {
  baseLeft: number
  baseTop: number
  baseWidth: number
  baseHeight: number
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  curClientX: number
  curClientY: number
  lastClientX: number
  lastClientY: number
  lastTx: number
  lastTy: number
  lastRatio: number
  nextRatio: number
  centerVertical: boolean
}

export interface ClampedPinchOutput {
  tx: number
  ty: number
}

/**
 * Computes frame-to-frame pointer-anchored translation offsets for CSS `scale(nextRatio)`
 * clamped to valid scroll/centered bounds on each axis so zooming slightly off-center
 * never drags content into blank margins or snaps back on commit.
 */
export function computeClampedPinchTransform({
  baseLeft,
  baseTop,
  baseWidth,
  baseHeight,
  availLeft,
  availTop,
  availWidth,
  availHeight,
  curClientX,
  curClientY,
  lastClientX,
  lastClientY,
  lastTx,
  lastTy,
  lastRatio,
  nextRatio,
  centerVertical,
}: ClampedPinchInput): ClampedPinchOutput {
  const safeLastRatio = lastRatio > 0 ? lastRatio : 1
  const localX = (lastClientX - (baseLeft + lastTx)) / safeLastRatio
  const localY = (lastClientY - (baseTop + lastTy)) / safeLastRatio

  const rawLeft = curClientX - nextRatio * localX
  const rawTop = curClientY - nextRatio * localY

  const clampedLeft = clampAxisPlacement({
    scaledSize: baseWidth * nextRatio,
    availStart: availLeft,
    availSpan: availWidth,
    desiredStart: rawLeft,
    centerIfSmaller: true,
  })
  const clampedTop = clampAxisPlacement({
    scaledSize: baseHeight * nextRatio,
    availStart: availTop,
    availSpan: availHeight,
    desiredStart: rawTop,
    centerIfSmaller: centerVertical,
  })

  return {
    tx: clampedLeft - baseLeft,
    ty: clampedTop - baseTop,
  }
}
