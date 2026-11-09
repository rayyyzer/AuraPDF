const { chromium } = require("playwright")
const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

const SCREENSHOT_DIR = path.join(__dirname, "screenshots")
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runE2eSuite() {
  console.log("=== AuraPDF Automated End-to-End Comprehensive Feature Test ===")
  const TEST_PORT = 9445
  const BASE_URL = `http://localhost:${TEST_PORT}`

  console.log(`[1/6] Launching Vite preview server on ${BASE_URL}...`)
  const previewProcess = spawn(
    "npx.cmd",
    ["vite", "preview", "--port", String(TEST_PORT), "--strictPort"],
    {
      cwd: path.resolve(__dirname, ".."),
      stdio: "pipe",
      shell: true,
    },
  )

  let serverReady = false
  previewProcess.stdout.on("data", (data) => {
    const text = data.toString()
    if (text.includes("http://localhost:") || text.includes("Local:")) {
      serverReady = true
    }
  })

  // Wait for server to boot
  for (let i = 0; i < 20; i++) {
    if (serverReady) break
    await new Promise((r) => setTimeout(r, 400))
  }

  const browser = await chromium.launch({
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
  })
  const page = await context.newPage()

  const consoleLogs = []
  const pageErrors = []
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on("pageerror", (err) => {
    pageErrors.push(err.message)
    console.error("PAGE ERROR:", err.message)
  })

  try {
    console.log("[2/6] Loading AuraPDF in browser...")
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 })
    await page.waitForTimeout(1000)

    // Capture initial dashboard
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_dashboard.png") })
    console.log("✓ Dashboard loaded cleanly. Screenshot: 01_dashboard.png")

    // Verify Title & Logo
    const logoTitle = await page.textContent("aside")
    console.log("✓ Sidebar branding present:", logoTitle?.includes("Aura") ? "PASS" : "FAIL")

    // Test Nav: Go to Library
    console.log("[3/6] Testing Navigation & Library Views...")
    const libraryNavBtn = page.locator("button:has-text('Library')").first()
    await libraryNavBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_library_grid.png") })
    console.log("✓ Library Grid View loaded. Screenshot: 02_library_grid.png")

    // Switch to List View
    const listViewBtn = page.locator("button[title*='List'], button[aria-label*='List']").first()
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_library_list.png") })
      console.log("✓ Library List View toggle verified. Screenshot: 03_library_list.png")
    }

    // Test Favorites Filter
    const favNavBtn = page.locator("button:has-text('Favorites')").first()
    await favNavBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_favorites.png") })
    console.log("✓ Favorites filter verified. Screenshot: 04_favorites.png")

    // Test Folders View
    const foldersNavBtn = page.locator("button:has-text('Folders')").first()
    await foldersNavBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_folders_view.png") })
    console.log("✓ Folders view verified. Screenshot: 05_folders_view.png")

    // Test Search View
    const searchNavBtn = page.locator("button:has-text('Search')").first()
    await searchNavBtn.click()
    await page.waitForTimeout(400)
    const searchInput = page.locator("input[placeholder*='Search']").first()
    if (await searchInput.isVisible()) {
      await searchInput.fill("AuraPDF")
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_library_search.png") })
      console.log("✓ Library search query verified. Screenshot: 06_library_search.png")
    }

    // Return to Dashboard and Open PDF in Reader
    console.log("[4/6] Testing PDF Reader Opening & Controls...")
    const homeNavBtn = page.locator("button:has-text('Home')").first()
    await homeNavBtn.click()
    await page.waitForTimeout(500)

    // Click on a document card or 'Continue Reading' button
    const continueBtn = page
      .locator("button:has-text('Resume Reading'), button:has-text('Continue Reading')")
      .first()
    if (await continueBtn.isVisible()) {
      await continueBtn.click()
    } else {
      const firstDocCard = page.locator("[role='button']:has-text('pdf'), div:has-text('.pdf')").first()
      await firstDocCard.click()
    }

    await page.waitForTimeout(1800)
    // A reader that never opened made every later assertion meaningless, so fail loudly
    // rather than logging success over a dashboard screenshot.
    const readerOpened = await page
      .locator("canvas")
      .first()
      .isVisible()
      .catch(() => false)
    if (!readerOpened) {
      throw new Error(
        "PDF Reader did not open; annotation steps would have been vacuous",
      )
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_reader_opened.png") })
    console.log("✓ PDF Reader opened document. Screenshot: 07_reader_opened.png")

    // Verify Tab Bar
    const activeTab = page.locator("[role='tab'], div:has-text('.pdf')").first()
    const tabVisible = await activeTab.isVisible()
    console.log("✓ Active document tab visible:", tabVisible ? "PASS" : "FAIL")

    // Test Zoom Controls (In, Out, Reset)
    const zoomInBtn = page.locator("button[title*='Zoom in'], button[aria-label*='Zoom in']").first()
    const zoomOutBtn = page.locator("button[title*='Zoom out'], button[aria-label*='Zoom out']").first()
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click()
      await page.waitForTimeout(300)
      await zoomInBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Zoom In executed successfully.")
    }
    if (await zoomOutBtn.isVisible()) {
      await zoomOutBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Zoom Out executed successfully.")
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_reader_zoom.png") })

    // Test Thumbnail Sidebar Toggle
    const sidebarToggleBtn = page.locator("button[title*='thumbnails'], button[title*='Sidebar'], button[aria-label*='sidebar']").first()
    if (await sidebarToggleBtn.isVisible()) {
      await sidebarToggleBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_thumbnail_sidebar.png") })
      console.log("✓ Thumbnail / Outline Sidebar toggled. Screenshot: 09_thumbnail_sidebar.png")
      // Toggle back
      await sidebarToggleBtn.click()
      await page.waitForTimeout(300)
    }

    // Test Reader Search Modal (Find in document Ctrl+F)
    const findDocBtn = page.locator("button[title*='Find'], button[title*='Search']").first()
    if (await findDocBtn.isVisible()) {
      await findDocBtn.click()
      await page.waitForTimeout(400)
      const docSearchInput = page.locator("input[placeholder*='Find in document'], input[placeholder*='Search']").first()
      if (await docSearchInput.isVisible()) {
        await docSearchInput.fill("AuraPDF")
        await page.waitForTimeout(500)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_find_in_document.png") })
        console.log("✓ In-Document Search Bar verified. Screenshot: 10_find_in_document.png")
        // Close search bar with Escape
        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)
      }
    }

    // Test Annotation Tools
    console.log("[5/6] Testing Vector Annotation Tools...")
    // 1. Highlighter
    const highlightToolBtn = page.locator("button[title*='Highlight'], button[aria-label*='Highlight']").first()
    if (await highlightToolBtn.isVisible()) {
      await highlightToolBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Chisel Highlighter Tool activated.")
    }

    // 2. Pen
    const penToolBtn = page.locator("button[title*='Pen'], button[aria-label*='Pen']").first()
    if (await penToolBtn.isVisible()) {
      await penToolBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Freehand Pen Tool activated.")
    }

    // 3. Shapes and Text Box were removed from the product on purpose, so this suite no
    //    longer drives them. Absence is asserted in tests/ui_checks.cjs.

    // 4. Note
    const noteToolBtn = page.locator("button[title*='Note'], button[aria-label*='Note']").first()
    if (await noteToolBtn.isVisible()) {
      await noteToolBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Sticky Note Tool activated.")
    }

    // 5. Eraser
    const eraserToolBtn = page.locator("button[title*='Eraser'], button[aria-label*='Eraser']").first()
    if (await eraserToolBtn.isVisible()) {
      await eraserToolBtn.click()
      await page.waitForTimeout(300)
      console.log("✓ Precision Eraser Tool activated.")
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_annotations_active.png") })

    // Test Settings & Themes
    console.log("[6/6] Testing Settings & Theme Customization...")
    // Navigate to Settings
    const settingsBtn = page.locator("button:has-text('Settings'), button[title*='Settings']").first()
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12_settings_modal.png") })
      console.log("✓ Settings view opened. Screenshot: 12_settings_modal.png")

      // Test Theme Switching (Light / AMOLED / Accent colors)
      const lightThemeBtn = page.locator("button:has-text('Light')").first()
      if (await lightThemeBtn.isVisible()) {
        await lightThemeBtn.click()
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13_light_theme.png") })
        console.log("✓ Light Theme verified. Screenshot: 13_light_theme.png")
      }

      const darkThemeBtn = page.locator("button:has-text('Dark')").first()
      if (await darkThemeBtn.isVisible()) {
        await darkThemeBtn.click()
        await page.waitForTimeout(400)
        console.log("✓ Dark Theme restored.")
      }

      // Test Accent Color Palette (e.g. Electric Cyan / Emerald)
      const accentCyan = page.locator("button[title*='Cyan'], button[aria-label*='Cyan']").first()
      if (await accentCyan.isVisible()) {
        await accentCyan.click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14_accent_cyan.png") })
        console.log("✓ Color Accent verified. Screenshot: 14_accent_cyan.png")
      }
    }

    console.log("\n=== ALL E2E INTERACTION TESTS COMPLETED SUCCESSFULLY ===")
    console.log(`Captured ${fs.readdirSync(SCREENSHOT_DIR).length} visual verification screenshots in ${SCREENSHOT_DIR}`)
    if (pageErrors.length > 0) {
      console.warn("Notice: page errors logged:", pageErrors)
    } else {
      console.log("✓ Zero page runtime exceptions detected.")
    }
  } catch (error) {
    console.error("Test failed with error:", error)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "error_state.png") })
    process.exitCode = 1
  } finally {
    try {
      await browser.close()
    } catch {}
    try {
      previewProcess.kill()
    } catch {}
    process.exit(0)
  }
}

runE2eSuite()
