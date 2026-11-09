export type TextSource = "native" | "ocr"

/**
 * How much the pipeline trusts a recognised word.
 *
 * `unreadable` segments are deliberately kept: their bounding box is the only evidence
 * that ink existed where no text could be recognised, which is what the reader shows
 * instead of inventing a word.
 */
export type SegmentQuality = "ok" | "uncertain" | "unreadable"

export interface UnifiedTextSegment {
  id: string

  text: string

  x: number

  y: number

  width: number

  height: number

  source: TextSource

  /** Which engine produced it: "tesseract" or "winocr". Absent for native text. */
  engine?: string

  /** Real per-word score in 0..100 when the engine reports one. Never synthesized. */
  confidence?: number

  quality?: SegmentQuality

  line?: number

  word?: number
}

/** True when the pipeline refused to commit to a reading for this segment. */
export function isUnreadable(segment: { quality?: SegmentQuality }): boolean {
  return segment.quality === "unreadable"
}

export interface TextSelectionSegment {
  text: string

  bounds: { x: number; y: number; width: number; height: number }

  viewportBounds?: { x: number; y: number; width: number; height: number }

  source: TextSource

  segmentId?: string
}

export interface TextSelection {
  docId: string

  page: number

  text: string

  segments: TextSelectionSegment[]

  sources: TextSource[]
}

export function normalizeTextSelectionRects(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const sorted = rects
    .filter((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y))
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .sort((a, b) => {
      const lineA = Math.round(a.y / 8)
      const lineB = Math.round(b.y / 8)
      if (lineA !== lineB) return lineA - lineB
      return a.x - b.x
    })

  return sorted.reduce<typeof sorted>((result, rect) => {
    const previous = result[result.length - 1]
    const minH = previous ? Math.min(previous.height, rect.height) : rect.height
    const sameLine =
      previous && Math.abs(previous.y - rect.y) <= Math.max(4, minH * 0.55)

    // Standard word spacing in documents ranges from 0.25 to 1.8x font height
    const maxGap = Math.max(18, minH * 1.8)
    const adjacent =
      previous &&
      rect.x >= previous.x - 4 &&
      rect.x <= previous.x + previous.width + maxGap

    if (sameLine && adjacent) {
      const right = Math.max(previous.x + previous.width, rect.x + rect.width)
      const top = Math.min(previous.y, rect.y)
      const bottom = Math.max(
        previous.y + previous.height,
        rect.y + rect.height,
      )

      previous.x = Math.min(previous.x, rect.x)
      previous.y = top
      previous.width = right - previous.x
      previous.height = bottom - top
    } else {
      result.push({ ...rect })
    }

    return result
  }, [])
}
