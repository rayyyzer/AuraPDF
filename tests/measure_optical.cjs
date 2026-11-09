const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const dir = "C:/Users/reach/.gemini/antigravity-cli/brain/9eb9f1f7-84b5-479e-945e-e5dce3b16f6b/logo_alternatives"
  const files = [
    "current.png",
    "alt_a_maximized_obsidian.png",
    "alt_b_borderless_kinetic.png",
    "alt_c_luminous_cyan.png",
    "alt_d_neon_aura_ring.png",
  ]

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const b64 = fs.readFileSync(fullPath).toString("base64")
    await page.setContent(`<img id="img" src="data:image/png;base64,${b64}" /><canvas id="c"></canvas>`)
    const stats = await page.evaluate(() => {
      const img = document.getElementById("img")
      const canvas = document.getElementById("c")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let nonTrans = 0
      let brightPixels = 0
      let minX = canvas.width,
        maxX = 0,
        minY = canvas.height,
        maxY = 0

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const a = data[idx + 3]
          if (a > 30) {
            nonTrans++
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y

            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const lum = 0.299 * r + 0.587 * g + 0.114 * b
            if (lum > 45) brightPixels++
          }
        }
      }
      return {
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        boundsRatio: ((maxX - minX + 1) / canvas.width).toFixed(3),
        totalPixelCoverage: ((nonTrans / (canvas.width * canvas.height)) * 100).toFixed(1) + "%",
        highContrastOpticalArea: ((brightPixels / (canvas.width * canvas.height)) * 100).toFixed(1) + "%",
      }
    })
    console.log(file, JSON.stringify(stats))
  }
  await browser.close()
})()
