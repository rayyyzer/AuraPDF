const { chromium } = require("playwright")
const path = require("path")

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const fs = require("fs")
  const base64 = fs.readFileSync(path.resolve("app-icon.png")).toString("base64")
  const dataUrl = `data:image/png;base64,${base64}`
  await page.setContent(`<img id="img" src="${dataUrl}" /><canvas id="c"></canvas>`)
  const bbox = await page.evaluate(async () => {
    const img = document.getElementById("img")
    await img.decode()
    const canvas = document.getElementById("c")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)
    const idata = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = idata.data
    let minX = canvas.width,
      maxX = 0,
      minY = canvas.height,
      maxY = 0
    let opaqueMinX = canvas.width,
      opaqueMaxX = 0,
      opaqueMinY = canvas.height,
      opaqueMaxY = 0

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3]
        if (alpha > 15) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
        if (alpha > 180) {
          if (x < opaqueMinX) opaqueMinX = x
          if (x > opaqueMaxX) opaqueMaxX = x
          if (y < opaqueMinY) opaqueMinY = y
          if (y > opaqueMaxY) opaqueMaxY = y
        }
      }
    }
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      visibleBounds: {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        fillRatio: ((maxX - minX + 1) / canvas.width).toFixed(3),
      },
      solidBounds: {
        opaqueMinX,
        opaqueMaxX,
        opaqueMinY,
        opaqueMaxY,
        width: opaqueMaxX - opaqueMinX + 1,
        height: opaqueMaxY - opaqueMinY + 1,
        fillRatio: ((opaqueMaxX - opaqueMinX + 1) / canvas.width).toFixed(3),
      },
    }
  })
  console.log("Icon Bounds Analysis:", JSON.stringify(bbox, null, 2))
  await browser.close()
})()
