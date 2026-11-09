/**
 * Assembles selected words into text.
 *
 * The previous implementation compared every word against the *first* word of the current
 * line and used a fixed 8pt threshold, so long lines drifted, mixed font sizes sorted
 * wrongly, and words were glued together or split by stray spaces. Everything here is a
 * pure function of the word boxes, which is what makes it testable.
 */

export interface SelectionWord {
  text: string
  /** PDF space: x grows right, y grows up. */
  x: number
  y: number
  width: number
  height: number
}

const PUNCTUATION_WITHOUT_LEADING_SPACE = /^[,.;:!?%)\]}»”’]/
const OPENERS_WITHOUT_TRAILING_SPACE = /[(\[{«“‘]$/

function sameLine(word: SelectionWord, reference: SelectionWord): boolean {
  // Tolerance scales with the smaller glyph box: a footnote next to body text must not be
  // treated as the same line just because their baselines are within a fixed number of units.
  const tolerance = Math.max(1.5, Math.min(word.height, reference.height) * 0.5)
  return Math.abs(word.y - reference.y) <= tolerance
}

/** Groups words into visual lines, top to bottom, each line left to right. */
export function groupIntoLines(words: SelectionWord[]): SelectionWord[][] {
  const sorted = [...words].sort((left, right) => {
    if (Math.abs(left.y - right.y) > 0.5) return right.y - left.y
    return left.x - right.x
  })

  const lines: SelectionWord[][] = []
  for (const word of sorted) {
    const current = lines[lines.length - 1]
    if (current && sameLine(word, current[0])) {
      current.push(word)
    } else {
      lines.push([word])
    }
  }

  for (const line of lines) {
    line.sort((left, right) => left.x - right.x)
  }
  return lines
}

function joinLine(words: SelectionWord[]): string {
  let text = ""
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (index === 0) {
      text = word.text
      continue
    }
    const previous = words[index - 1]
    const gap = word.x - (previous.x + previous.width)
    const spaceWidth = Math.max(0.8, Math.min(previous.height, word.height) * 0.18)
    const needsSpace =
      gap > spaceWidth &&
      !PUNCTUATION_WITHOUT_LEADING_SPACE.test(word.text) &&
      !OPENERS_WITHOUT_TRAILING_SPACE.test(previous.text)
    text += (needsSpace ? " " : "") + word.text
  }
  return text
}

/**
 * Joins lines with newlines, re-joining words that were hyphenated across a line break.
 * `hyphenated` words lose their trailing hyphen only when the next line continues in
 * lowercase, which is the normal typographic signal for a split word.
 */
export function joinLines(lines: SelectionWord[][]): string {
  let result = ""
  for (const line of lines) {
    const text = joinLine(line)
    if (!text) continue
    if (result && /-\s*$/.test(result) && /^[a-z]/.test(text)) {
      result = `${result.replace(/-\s*$/, "")}${text}`
    } else {
      result = result ? `${result}\n${text}` : text
    }
  }
  return result
}

/** Convenience wrapper: words in, plain text out. */
export function selectionText(words: SelectionWord[]): string {
  return joinLines(groupIntoLines(words))
}
