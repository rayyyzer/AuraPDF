const { chromium } = require("playwright")
const path = require("path")
const fs = require("fs")

const enlargedSvg = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Outer Obsidian Squircle Gradient -->
    <linearGradient id="aura-c2-bg" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#060A12" />
    </linearGradient>

    <!-- Subtle Luminous Rim to define icon boundary on dark taskbars -->
    <linearGradient id="aura-rim" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.9" />
      <stop offset="42%" stop-color="#0284C7" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0.35" />
    </linearGradient>

    <!-- Front Document Sheet (Alabaster White) -->
    <linearGradient id="aura-c2-front-sheet" x1="30" y1="16" x2="74" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>

    <!-- Middle Sheet (Vibrant Electric Cyan) -->
    <linearGradient id="aura-c2-mid-sheet" x1="20" y1="20" x2="66" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="1" />
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0.85" />
    </linearGradient>

    <!-- Back Sheet (Deep Tonal Slate/Ocean) -->
    <linearGradient id="aura-c2-back-sheet" x1="20" y1="20" x2="68" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1" />
      <stop offset="100%" stop-color="#075985" />
    </linearGradient>

    <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#00D2FF" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#00D2FF" stop-opacity="0" />
    </radialGradient>

    <filter id="aura-deep-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.75" />
    </filter>
    <filter id="aura-page-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1.2" dy="2.4" stdDeviation="2.2" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Squircle Base: Full-bleed 97% to maximize canvas presence -->
  <rect
    x="1.5"
    y="1.5"
    width="97"
    height="97"
    rx="23.5"
    fill="url(#aura-c2-bg)"
    stroke="url(#aura-rim)"
    stroke-width="2.2"
  />

  <!-- Ambient Core Glow -->
  <circle cx="50" cy="50" r="38" fill="url(#aura-glow)" />

  <!-- Docs Deck: Exact same shapes, enlarged to 1.38x scale -->
  <g transform="rotate(-5.5 50 50) translate(50, 50) scale(1.38) translate(-50, -50)">
    <!-- Back Sheet (Tilted -12 deg) -->
    <g transform="rotate(-12 50 52.5)">
      <rect
        x="25"
        y="19"
        width="45"
        height="59"
        rx="6.5"
        fill="url(#aura-c2-back-sheet)"
        filter="url(#aura-page-shadow)"
      />
    </g>

    <!-- Middle Sheet (Tilted -3.5 deg) -->
    <g transform="rotate(-3.5 50 52.5)">
      <rect
        x="27.5"
        y="18"
        width="45"
        height="59"
        rx="6.5"
        fill="url(#aura-c2-mid-sheet)"
        filter="url(#aura-page-shadow)"
      />
      <!-- Top Foil Highlight Edge -->
      <line
        x1="33"
        y1="19"
        x2="67"
        y2="19"
        stroke="#BAE6FD"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.8"
      />
    </g>

    <!-- Front Sheet (Tilted +3 deg with Crisp Dog-Ear Fold) -->
    <g transform="rotate(3 51.5 51.5)" filter="url(#aura-deep-shadow)">
      <path
        d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z"
        fill="url(#aura-c2-front-sheet)"
      />
      <!-- Crisp Dog-Ear Corner Fold -->
      <path
        d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z"
        fill="#00D2FF"
      />
      <!-- Editorial Bars -->
      <rect x="37" y="39.5" width="29.5" height="5" rx="2.5" fill="#0F172A" />
      <rect x="37" y="49.5" width="22.5" height="5" rx="2.5" fill="#00D2FF" />
      <rect x="37" y="59.5" width="15.5" height="5" rx="2.5" fill="#94A3B8" />
    </g>
  </g>
</svg>
`

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // 1. Generate 1024x1024 master app-icon.png
  await page.setViewportSize({ width: 1024, height: 1024 })
  await page.setContent(`
    <body style="margin:0; padding:0; background:transparent; display:flex; align-items:center; justify-content:center; width:1024px; height:1024px;">
      <div style="width:1024px; height:1024px;">${enlargedSvg}</div>
    </body>
  `)
  const appIconPath = path.resolve("app-icon.png")
  await page.screenshot({ path: appIconPath, omitBackground: true })
  console.log("Saved master app-icon.png (1024x1024)")

  // 2. Generate 64x64 public/favicon.png and dist/favicon.png
  await page.setViewportSize({ width: 64, height: 64 })
  await page.setContent(`
    <body style="margin:0; padding:0; background:transparent; display:flex; align-items:center; justify-content:center; width:64px; height:64px;">
      <div style="width:64px; height:64px;">${enlargedSvg}</div>
    </body>
  `)
  await page.screenshot({ path: path.resolve("public/favicon.png"), omitBackground: true })
  if (fs.existsSync(path.resolve("dist"))) {
    await page.screenshot({ path: path.resolve("dist/favicon.png"), omitBackground: true })
  }
  console.log("Saved public/favicon.png (64x64)")

  // 3. Generate side-by-side comparison JPEG for user visual reference
  await page.setViewportSize({ width: 1200, height: 500 })
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 30px;
          background: #0B0F17;
          font-family: 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif;
          color: #F1F5F9;
        }
        h2 { margin: 0 0 6px 0; font-size: 22px; font-weight: 600; }
        p { margin: 0 0 24px 0; font-size: 13px; color: #94A3B8; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .card {
          background: #131A29;
          border: 1px solid #1E293B;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .taskbar-mock {
          background: rgba(30, 30, 30, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
          margin-top: 14px;
          width: calc(100% - 32px);
          justify-content: center;
        }
        .app-item {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          position: relative;
        }
        .app-item.active::after {
          content: '';
          position: absolute;
          bottom: 2px;
          width: 14px;
          height: 3px;
          background: #00D2FF;
          border-radius: 2px;
        }
        .competitor-svg { width: 30px; height: 30px; }
        .badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        .badge-old { background: #334155; color: #94A3B8; }
        .badge-new { background: #00D2FF; color: #000; box-shadow: 0 0 12px rgba(0,210,255,0.4); }
      </style>
    </head>
    <body>
      <h2>AuraPDF — Current Logo vs Enlarged Implementation</h2>
      <p>Windows 11 Dark Taskbar Simulation: Notice how the enlarged version matches Chrome and Acrobat's physical presence</p>

      <div class="row">
        <!-- Before -->
        <div class="card">
          <span class="badge badge-old">Previous (Too Small on Taskbar)</span>
          <div style="width: 120px; height: 120px; margin-bottom: 12px;">
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
              <rect x="4" y="4" width="92" height="92" rx="22" fill="#0F172A" stroke="#1E293B" stroke-width="1.8" />
              <circle cx="50" cy="50" r="28" fill="#00D2FF" opacity="0.18" />
              <g transform="rotate(-6 50 50) translate(50, 50) scale(1.03) translate(-50, -50)">
                <g transform="rotate(-13 50 53)"><rect x="25" y="19" width="45" height="59" rx="6.5" fill="#0369A1" /></g>
                <g transform="rotate(-4 50 53)"><rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="#00D2FF" /></g>
                <g transform="rotate(3 52 52)">
                  <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="#FFF" />
                  <path d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z" fill="#00D2FF" />
                  <rect x="37.5" y="40.5" width="28.5" height="4.8" rx="2.4" fill="#0F172A" />
                  <rect x="37.5" y="50" width="22" height="4.8" rx="2.4" fill="#00D2FF" />
                </g>
              </g>
            </svg>
          </div>
          <div style="font-size: 12px; color: #EF4444; font-weight: 500;">Squircle border invisible; document only 48px wide</div>
          <div class="taskbar-mock">
            <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#4285F4"/><path d="M24 6 A18 18 0 0 1 42 24 L24 24 Z" fill="#EA4335"/><path d="M42 24 A18 18 0 0 1 12 36 L24 24 Z" fill="#FBBC05"/><circle cx="24" cy="24" r="8" fill="#FFF"/><circle cx="24" cy="24" r="6" fill="#4285F4"/></svg></div>
            <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><rect width="44" height="44" x="2" y="2" rx="10" fill="#ED2224"/><path d="M10 36 C16 36 21 28 24 20 C27 28 32 36 38 36 C33 34 31 29 28 24 C33 18 36 12 36 12 C30 14 26 18 24 20 C22 18 18 14 12 12 C12 12 15 18 20 24 C17 29 15 34 10 36 Z" fill="#FFF"/></svg></div>
            <div class="app-item active" style="background: rgba(255,255,255,0.06);">
              <div style="width: 30px; height: 30px;">
                <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
                  <rect x="4" y="4" width="92" height="92" rx="22" fill="#0F172A" stroke="#1E293B" stroke-width="1.8" />
                  <g transform="rotate(-6 50 50) translate(50, 50) scale(1.03) translate(-50, -50)">
                    <rect x="25" y="19" width="45" height="59" rx="6.5" fill="#0369A1" />
                    <rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="#00D2FF" />
                    <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="#FFF" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- After -->
        <div class="card" style="border-color: #00D2FF; box-shadow: 0 0 20px rgba(0,210,255,0.15);">
          <span class="badge badge-new">New: Enlarged Current Logo (+80% Optical Scale)</span>
          <div style="width: 120px; height: 120px; margin-bottom: 12px;">
            ${enlargedSvg}
          </div>
          <div style="font-size: 12px; color: #00D2FF; font-weight: 500;">Exact same logo geometry, enlarged to 97% bleed + 1.38x deck</div>
          <div class="taskbar-mock">
            <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#4285F4"/><path d="M24 6 A18 18 0 0 1 42 24 L24 24 Z" fill="#EA4335"/><path d="M42 24 A18 18 0 0 1 12 36 L24 24 Z" fill="#FBBC05"/><circle cx="24" cy="24" r="8" fill="#FFF"/><circle cx="24" cy="24" r="6" fill="#4285F4"/></svg></div>
            <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><rect width="44" height="44" x="2" y="2" rx="10" fill="#ED2224"/><path d="M10 36 C16 36 21 28 24 20 C27 28 32 36 38 36 C33 34 31 29 28 24 C33 18 36 12 36 12 C30 14 26 18 24 20 C22 18 18 14 12 12 C12 12 15 18 20 24 C17 29 15 34 10 36 Z" fill="#FFF"/></svg></div>
            <div class="app-item active" style="background: rgba(0,210,255,0.12);">
              <div style="width: 36px; height: 36px;">
                ${enlargedSvg}
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)
  const artifactDir = path.resolve("artifacts")
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true })
  const comparisonJpg = path.join(artifactDir, "enlarged_logo_comparison.jpg")
  await page.screenshot({ path: comparisonJpg, type: "jpeg", quality: 90 })
  console.log(`Saved comparison JPEG: ${comparisonJpg}`)

  await browser.close()
}

run().catch(console.error)
