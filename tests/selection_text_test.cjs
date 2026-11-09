/**
 * Tests for src/services/pdf/selectionText.ts.
 *
 * The project has no TypeScript test runner, so this compiles the one module on its own
 * with tsc and requires the output. No new dependencies and no bundler involvement.
 */
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const root = path.resolve(__dirname, "..")
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurapdf-selection-"))

try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "tsc",
      path.join(root, "src/services/pdf/selectionText.ts"),
      "--outDir",
      outDir,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--skipLibCheck",
    ],
    { cwd: root, stdio: "pipe", shell: process.platform === "win32" },
  )

  const modulePath = path.join(
    outDir,
    fs.existsSync(path.join(outDir, "selectionText.js"))
      ? "selectionText.js"
      : "pdf/selectionText.js",
  )
  const { selectionText, groupIntoLines } = require(modulePath)

  let failures = 0
  const check = (name, actual, expected) => {
    if (actual === expected) {
      console.log(`  ok   ${name}`)
    } else {
      failures += 1
      console.error(`  FAIL ${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`)
    }
  }

  const word = (text, x, y, width = text.length * 6, height = 10) => ({
    text,
    x,
    y,
    width,
    height,
  })

  console.log("selection text assembly")

  check(
    "words on one line join with single spaces",
    selectionText([word("The", 10, 100), word("quick", 40, 100), word("fox", 80, 100)]),
    "The quick fox",
  )

  check(
    "lines are ordered top to bottom even when given in reverse",
    selectionText([word("second", 10, 80), word("first", 10, 100)]),
    "first\nsecond",
  )

  check(
    "a large horizontal gap still yields one space",
    selectionText([word("left", 10, 100), word("right", 200, 100)]),
    "left right",
  )

  check(
    "punctuation is not preceded by a space",
    selectionText([word("word", 10, 100), word(",", 40, 100), word("next", 50, 100)]),
    "word, next",
  )

  check(
    "an opener is not followed by a space",
    selectionText([word("("  , 10, 100), word("inner", 20, 100)]),
    "(inner",
  )

  check(
    "a split word is rejoined across the line break",
    selectionText([word("exam-", 10, 100), word("ple", 10, 80)]),
    "example",
  )

  check(
    "a hyphen followed by a capital stays separate",
    selectionText([word("well-", 10, 100), word("Known", 10, 80)]),
    "well-\nKnown",
  )

  check(
    "a footnote baseline does not join body text",
    selectionText([
      word("body", 10, 100, 30, 10),
      word("note", 12, 96, 24, 4),
    ]),
    "body\nnote",
  )

  check(
    "empty input produces empty text",
    selectionText([]),
    "",
  )

  check(
    "grouping keeps columns of the same line apart",
    groupIntoLines([word("a", 10, 100), word("b", 300, 100)]).length,
    1,
  )

  if (failures > 0) {
    console.error(`\n${failures} selection text check(s) failed`)
    process.exit(1)
  }
  console.log("\nAll selection text checks passed")
} finally {
  fs.rmSync(outDir, { recursive: true, force: true })
}
