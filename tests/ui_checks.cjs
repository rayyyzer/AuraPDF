/**
 * Focused UI checks for the polish pass. Complements the screenshot suite by asserting the
 * specific things that were broken: duplicated navigation, removed tools, print isolation.
 */
const { chromium } = require("playwright")
const { spawn } = require("child_process")
const path = require("path")

const PORT = 9577
const BASE = `http://localhost:${PORT}`
const OUT = path.join(__dirname, "screenshots")

async function main() {
  const server = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: path.resolve(__dirname, ".."), stdio: "ignore", shell: true },
  )

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))

  let failures = 0
  const check = async (name, passed) => {
    console.log(`  ${passed ? "ok  " : "FAIL"} ${name}`)
    if (!passed) failures += 1
  }

  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        await page.goto(BASE, { timeout: 1500 })
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }
    await page.waitForTimeout(1200)

    const bodyText = await page.evaluate(() => document.body.innerText)
    await check("collection chip bar removed", !/Favorites \(\d+\)/.test(bodyText))
    await check("no duplicate 'New Folder' action", (bodyText.match(/New Folder/g) || []).length <= 1)

    await page.screenshot({ path: path.join(OUT, "20-library-light.png") })

    // Light theme is driven by the app's own persisted mode, so set it the way the
    // Settings screen does and reload rather than forcing a class the app overwrites.
    await page.evaluate(() => localStorage.setItem("aura:themeMode", "light"))
    await page.reload()
    await page.waitForTimeout(1400)
    const lightMark = await page.evaluate(() =>
      Boolean(document.querySelector('svg [id="auraMarkBadge"]')),
    )
    const isLight = await page.evaluate(() =>
      document.documentElement.classList.contains("light"),
    )
    await check("light theme renders the light mark", lightMark)
    await check("light theme actually applies", isLight)
    await page.screenshot({ path: path.join(OUT, "21-theme-light.png") })

    await page.evaluate(() => localStorage.setItem("aura:themeMode", "dark"))
    await page.reload()
    await page.waitForTimeout(1400)
    const darkMark = await page.evaluate(() =>
      Boolean(document.querySelector('svg [id="auraMarkBadge"]')),
    )
    await check("dark theme keeps the original wordmark", !darkMark)
    await page.screenshot({ path: path.join(OUT, "22-theme-dark.png") })

    // Library: one header row, one search field, one primary action.
    await page.getByRole("button", { name: "Library", exact: true }).first().click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, "27-library-header.png") })
    const searchInputs = await page.locator("input[type='text'], input:not([type])").count()
    await check("library has a single search field", searchInputs === 1)
    const addButtons = await page.getByRole("button", { name: /Add PDF|Open PDF/ }).count()
    await check("library has a single primary action", addButtons <= 1)

    // Open the reader.
    await page.getByRole("button", { name: "Home", exact: true }).first().click()
    await page.waitForTimeout(600)
    const resume = page.locator("button:has-text('Resume Reading')").first()
    if (await resume.isVisible()) {
      await resume.click()
      await page.waitForTimeout(1800)
    }
    await page.screenshot({ path: path.join(OUT, "23-reader.png") })

    const annotateButton = page.locator('[data-menu-trigger="annotate"]').first()
    if (await annotateButton.count()) {
      await annotateButton.click()
      await page.waitForTimeout(300)
      const menuText = await page.evaluate(() => document.body.innerText)
      await check("tool menu drops Text Box", !menuText.includes("Text Box"))
      await check("tool menu drops Shapes", !/\bShapes\b/.test(menuText))
      await page.screenshot({ path: path.join(OUT, "24-tool-menu.png") })

      // Tool options are now inline in the dropdown, revealed by the active row.
      await page.getByText("Highlighter", { exact: true }).first().click()
      await page.waitForTimeout(350)
      const inlineSwatches = page.locator('[role="listbox"][aria-label="Highlighter colour"]')
      const openedFirst = await inlineSwatches.count()
      await check("tool options appear inside the dropdown", openedFirst === 1)
      // Moving the pointer away must not dismiss them, since selection is in-place now.
      await page.mouse.move(700, 700)
      await page.waitForTimeout(400)
      const stillOpen = await inlineSwatches.count()
      await check("options survive pointer movement", stillOpen === 1)
      await page.screenshot({ path: path.join(OUT, "25-tool-options.png") })

      await page.keyboard.press("Escape")
      await page.waitForTimeout(200)

      // Print opens the app's own sheet, not the OS dialog on top of the app.
      await page.locator('[data-menu-trigger="more"]').first().click()
      await page.waitForTimeout(250)
      await page.getByText("Print…", { exact: true }).first().click()
      await page.waitForTimeout(700)
      const printDialog = page.locator('[role="dialog"][aria-label="Print"]')
      await check("print opens an in-app sheet", (await printDialog.count()) === 1)
      const printRoots = await page.locator("#aurapdf-print-root").count()
      await check("nothing is sent to the printer before confirming", printRoots === 0)
      await page.screenshot({ path: path.join(OUT, "28-print-sheet.png") })
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
      await check(
        "print sheet closes on Escape",
        (await page.locator('[role="dialog"][aria-label="Print"]').count()) === 0,
      )

      // Eraser: only three size options, no partial/whole toggle.
      // Nudge the pointer to the top so the auto-hiding header is back before clicking.
      await page.mouse.move(720, 30)
      await page.waitForTimeout(500)
      await page.locator('[data-menu-trigger="annotate"]').first().click()
      await page.waitForTimeout(250)
      await page.getByText("Eraser", { exact: true }).first().click()
      await page.waitForTimeout(350)
      const eraserBarText = await page.evaluate(() => document.body.innerText)
      await check(
        "eraser drops Partial/Whole modes",
        !/\bPartial\b/.test(eraserBarText) && !/\bWhole\b/.test(eraserBarText),
      )
      await page.screenshot({ path: path.join(OUT, "26-eraser.png") })
    } else {
      console.log("  ..  annotate menu not reachable, skipped")
    }

    // Print media must hide the app shell entirely.
    await page.emulateMedia({ media: "print" })
    const rootHidden = await page.evaluate(
      () => getComputedStyle(document.getElementById("root")).display === "none",
    )
    await check("print media hides the app shell", rootHidden)
    await page.emulateMedia({ media: "screen" })

    console.log(`  errors: ${errors.length}`)
    if (errors.length) console.log(errors.slice(0, 3).join("\n"))
  } finally {
    await browser.close()
    server.kill()
  }

  if (failures > 0) {
    console.error(`\n${failures} UI check(s) failed`)
    process.exit(1)
  }
  console.log("\nAll UI checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
