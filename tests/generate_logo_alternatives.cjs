const { chromium } = require("playwright")
const path = require("path")
const fs = require("fs")

const ARTIFACT_DIR = path.resolve("C:/Users/reach/.gemini/antigravity-cli/brain/9eb9f1f7-84b5-479e-945e-e5dce3b16f6b/logo_alternatives")
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
}

// 1. Current Icon SVG (for baseline comparison)
const svgCurrent = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cur-bg" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#060A12" />
    </linearGradient>
    <linearGradient id="cur-front" x1="30" y1="16" x2="74" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    <linearGradient id="cur-mid" x1="20" y1="20" x2="66" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF" />
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0.82" />
    </linearGradient>
    <linearGradient id="cur-back" x1="20" y1="20" x2="68" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1" />
      <stop offset="100%" stop-color="#075985" />
    </linearGradient>
    <filter id="cur-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="1.5" dy="3.5" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.55" />
    </filter>
  </defs>
  <!-- Squircle Base -->
  <rect x="4" y="4" width="92" height="92" rx="22" fill="url(#cur-bg)" stroke="#1E293B" stroke-width="1.8" />
  <!-- Core Glow -->
  <circle cx="50" cy="50" r="28" fill="#00D2FF" opacity="0.18" filter="blur(3.5px)" />
  <!-- Docs Deck (Current size: small) -->
  <g transform="rotate(-6 50 50) translate(50, 50) scale(1.03) translate(-50, -50)">
    <g transform="rotate(-13 50 53)">
      <rect x="25" y="19" width="45" height="59" rx="6.5" fill="url(#cur-back)" />
    </g>
    <g transform="rotate(-4 50 53)">
      <rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="url(#cur-mid)" />
      <line x1="33" y1="19" x2="67" y2="19" stroke="#BAE6FD" stroke-width="1" stroke-linecap="round" opacity="0.65" />
    </g>
    <g transform="rotate(3 52 52)" filter="url(#cur-shadow)">
      <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="url(#cur-front)" />
      <path d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z" fill="#00D2FF" />
      <rect x="37.5" y="40.5" width="28.5" height="4.8" rx="2.4" fill="#0F172A" />
      <rect x="37.5" y="50" width="22" height="4.8" rx="2.4" fill="#00D2FF" />
      <rect x="37.5" y="59.5" width="15" height="4.8" rx="2.4" fill="#94A3B8" />
    </g>
  </g>
</svg>
`

// 2. Alternative A: Maximized Obsidian Squircle with Luminous Rim & Enlarged Doc Stack (+38% scale)
const svgAltA = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="a-bg" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111C33" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>
    <linearGradient id="a-rim" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.95" />
      <stop offset="45%" stop-color="#0284C7" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0.4" />
    </linearGradient>
    <linearGradient id="a-front" x1="25" y1="10" x2="75" y2="85" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#EDF2F7" />
    </linearGradient>
    <linearGradient id="a-mid" x1="15" y1="15" x2="70" y2="85" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D2FF" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
    <linearGradient id="a-back" x1="15" y1="15" x2="70" y2="85" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1" />
      <stop offset="100%" stop-color="#075985" />
    </linearGradient>
    <radialGradient id="a-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#00D2FF" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#00D2FF" stop-opacity="0" />
    </radialGradient>
    <filter id="a-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.75" />
    </filter>
  </defs>
  <!-- Full-bleed 96% Squircle with Luminous Cyan/Slate Rim -->
  <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#a-bg)" stroke="url(#a-rim)" stroke-width="2.2" />
  <!-- Vibrant Ambient Core Glow -->
  <circle cx="50" cy="50" r="38" fill="url(#a-glow)" />
  <!-- Enlarged Doc Deck: Scale 1.36 (Fills Squircle Confidently) -->
  <g transform="rotate(-5 50 50) translate(50, 50) scale(1.36) translate(-50, -50)">
    <g transform="rotate(-11 50 52)">
      <rect x="25" y="19" width="45" height="59" rx="6.5" fill="url(#a-back)" />
    </g>
    <g transform="rotate(-3 50 52)">
      <rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="url(#a-mid)" />
      <line x1="33" y1="19" x2="67" y2="19" stroke="#BAE6FD" stroke-width="1.2" stroke-linecap="round" opacity="0.8" />
    </g>
    <g transform="rotate(3 51 51)" filter="url(#a-shadow)">
      <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="url(#a-front)" />
      <path d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z" fill="#00D2FF" />
      <rect x="37" y="39" width="30" height="5.2" rx="2.6" fill="#0F172A" />
      <rect x="37" y="49" width="23" height="5.2" rx="2.6" fill="#00D2FF" />
      <rect x="37" y="59" width="16" height="5.2" rx="2.6" fill="#94A3B8" />
    </g>
  </g>
</svg>
`

// 3. Alternative B: "Borderless Kinetic Aura" (Standalone Deck, Edge-to-Edge - VS Code / Acrobat Style)
const svgAltB = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="b-front" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="b-mid" x1="10" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00E5FF" />
      <stop offset="50%" stop-color="#00B4D8" />
      <stop offset="100%" stop-color="#0077B6" />
    </linearGradient>
    <linearGradient id="b-back" x1="10" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#023E8A" />
      <stop offset="100%" stop-color="#03045E" />
    </linearGradient>
    <radialGradient id="b-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#00D2FF" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#00D2FF" stop-opacity="0" />
    </radialGradient>
    <filter id="b-deep-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="3" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.65" />
    </filter>
    <filter id="b-sheet-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="2" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>
  <!-- Ambient Aura Glow wrapping the documents -->
  <ellipse cx="52" cy="50" rx="46" ry="46" fill="url(#b-halo)" />
  <!-- Full 94% Canvas Scale Deck -->
  <g transform="rotate(-6 50 50) translate(50, 50) scale(1.68) translate(-50, -50)">
    <!-- Back Deep Sheet -->
    <g transform="rotate(-12 50 52)">
      <rect x="25" y="18" width="46" height="60" rx="7" fill="url(#b-back)" stroke="#023E8A" stroke-width="0.6" filter="url(#b-sheet-shadow)" />
    </g>
    <!-- Middle Vibrant Cyan Sheet -->
    <g transform="rotate(-3 50 52)">
      <rect x="27.5" y="17" width="46" height="60" rx="7" fill="url(#b-mid)" filter="url(#b-sheet-shadow)" />
      <line x1="33" y1="18" x2="68" y2="18" stroke="#E0F2FE" stroke-width="1.4" stroke-linecap="round" opacity="0.9" />
    </g>
    <!-- Front Alabaster Sheet with Dog Ear -->
    <g transform="rotate(3 51 51)" filter="url(#b-deep-shadow)">
      <path d="M 35.5 16 L 62 16 L 77.5 31.5 L 77.5 70.5 C 77.5 74.5, 74, 77.5, 70 77.5 L 35.5 77.5 C 31.5 77.5, 28.5 74.5, 28.5 70.5 L 28.5 23 C 28.5 19, 31.5 16, 35.5 16 Z" fill="url(#b-front)" stroke="#CBD5E1" stroke-width="0.5" />
      <!-- Luminous Cyan Corner Fold -->
      <path d="M 62 16 L 77.5 31.5 L 67 31.5 C 64 31.5, 62 29.5, 62 26.5 Z" fill="#00D2FF" />
      <!-- Editorial Bars -->
      <rect x="37" y="38" width="31" height="5.5" rx="2.75" fill="#0F172A" />
      <rect x="37" y="48.5" width="24" height="5.5" rx="2.75" fill="#00D2FF" />
      <rect x="37" y="59" width="16" height="5.5" rx="2.75" fill="#64748B" />
    </g>
  </g>
</svg>
`

// 4. Alternative C: "Luminous Electric Cyan Gradient Squircle" (Discord/Slack/Spotify Style)
const svgAltC = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="c-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00F0FF" />
      <stop offset="40%" stop-color="#00A8E8" />
      <stop offset="100%" stop-color="#003459" />
    </linearGradient>
    <linearGradient id="c-front" x1="30" y1="16" x2="74" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>
    <filter id="c-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="2" dy="5" stdDeviation="5" flood-color="#00172E" flood-opacity="0.6" />
    </filter>
  </defs>
  <!-- Vibrant Electric Cyan Squircle -->
  <rect x="3" y="3" width="94" height="94" rx="24" fill="url(#c-bg)" stroke="#BAE6FD" stroke-width="1.5" stroke-opacity="0.5" />
  <!-- Luminous White Highlight Curve -->
  <path d="M 12 18 C 30 10, 70 10, 88 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.4" />
  <!-- High Contrast Document Stack (Scale 1.34) -->
  <g transform="rotate(-5 50 50) translate(50, 50) scale(1.34) translate(-50, -50)">
    <g transform="rotate(-11 50 52)">
      <rect x="25" y="19" width="45" height="59" rx="6.5" fill="#001E3D" opacity="0.4" />
    </g>
    <g transform="rotate(-3 50 52)">
      <rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="#002855" opacity="0.6" />
    </g>
    <g transform="rotate(3 51 51)" filter="url(#c-shadow)">
      <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="url(#c-front)" />
      <!-- Deep Blue Corner Fold -->
      <path d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z" fill="#0077B6" />
      <rect x="37" y="39" width="30" height="5.2" rx="2.6" fill="#0F172A" />
      <rect x="37" y="49" width="23" height="5.2" rx="2.6" fill="#00A8E8" />
      <rect x="37" y="59" width="16" height="5.2" rx="2.6" fill="#94A3B8" />
    </g>
  </g>
</svg>
`

// 5. Alternative D: "Deep Obsidian with Glowing Neon Aura Ring"
const svgAltD = `
<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="d-bg" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0B132B" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <linearGradient id="d-ring" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00F0FF" />
      <stop offset="100%" stop-color="#7928CA" />
    </linearGradient>
    <linearGradient id="d-front" x1="25" y1="10" x2="75" y2="85" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    <filter id="d-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="2" dy="5" stdDeviation="4.5" flood-color="#000000" flood-opacity="0.8" />
    </filter>
  </defs>
  <!-- Outer Neon Halo Ring -->
  <rect x="2" y="2" width="96" height="96" rx="25" stroke="url(#d-ring)" stroke-width="3" fill="#000000" />
  <rect x="4.5" y="4.5" width="91" height="91" rx="22.5" fill="url(#d-bg)" />
  <!-- Core Radial Glow -->
  <circle cx="50" cy="50" r="32" fill="#00D2FF" opacity="0.3" filter="blur(5px)" />
  <!-- Enlarged Doc Deck: Scale 1.40 -->
  <g transform="rotate(-5 50 50) translate(50, 50) scale(1.40) translate(-50, -50)">
    <g transform="rotate(-11 50 52)">
      <rect x="25" y="19" width="45" height="59" rx="6.5" fill="#0A3A60" />
    </g>
    <g transform="rotate(-3 50 52)">
      <rect x="27.5" y="18" width="45" height="59" rx="6.5" fill="#0284C7" />
      <line x1="33" y1="19" x2="67" y2="19" stroke="#BAE6FD" stroke-width="1.2" stroke-linecap="round" />
    </g>
    <g transform="rotate(3 51 51)" filter="url(#d-shadow)">
      <path d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z" fill="url(#d-front)" />
      <path d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z" fill="#00F0FF" />
      <rect x="37" y="39" width="30" height="5.2" rx="2.6" fill="#0F172A" />
      <rect x="37" y="49" width="23" height="5.2" rx="2.6" fill="#00F0FF" />
      <rect x="37" y="59" width="16" height="5.2" rx="2.6" fill="#94A3B8" />
    </g>
  </g>
</svg>
`

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  console.log("Generating high-resolution standalone PNGs...")
  const icons = [
    { name: "current", svg: svgCurrent },
    { name: "alt_a_maximized_obsidian", svg: svgAltA },
    { name: "alt_b_borderless_kinetic", svg: svgAltB },
    { name: "alt_c_luminous_cyan", svg: svgAltC },
    { name: "alt_d_neon_aura_ring", svg: svgAltD },
  ]

  for (const icon of icons) {
    await page.setViewportSize({ width: 512, height: 512 })
    await page.setContent(`
      <body style="margin:0; padding:0; background:transparent; display:flex; align-items:center; justify-content:center; width:512px; height:512px;">
        <div style="width:512px; height:512px;">${icon.svg}</div>
      </body>
    `)
    const filePath = path.join(ARTIFACT_DIR, `${icon.name}.png`)
    await page.screenshot({ path: filePath, omitBackground: true })
    console.log(`Saved: ${filePath}`)
  }

  // 6. Generate Realistic Windows 11 Taskbar Simulation Comparison
  console.log("Generating Windows 11 Taskbar comparison graphic...")
  await page.setViewportSize({ width: 1200, height: 600 })
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
        h2 { margin: 0 0 6px 0; font-size: 20px; font-weight: 600; }
        p { margin: 0 0 20px 0; font-size: 13px; color: #94A3B8; }
        .stage {
          background: #18202F;
          border: 1px solid #283548;
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .taskbar-strip {
          background: rgba(30, 30, 30, 0.96);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
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
        .app-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .competitor-svg {
          width: 30px;
          height: 30px;
        }
        .label {
          font-size: 11px;
          color: #94A3B8;
          font-weight: 500;
          text-align: center;
          margin-top: 6px;
        }
        .grid-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 16px;
        }
        .card {
          background: #101623;
          border: 1px solid #1E293B;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .card.featured {
          border-color: #00D2FF;
          box-shadow: 0 0 18px rgba(0, 210, 255, 0.2);
        }
        .card-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .badge-current { background: #334155; color: #CBD5E1; }
        .badge-recommended { background: #00D2FF; color: #000; }
        .badge-alt { background: #0284C7; color: #FFF; }
        .card-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #FFF; text-align: center; }
        .card-desc { font-size: 11px; color: #94A3B8; text-align: center; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <h2>AuraPDF — Windows 11 Taskbar Brand Scale Benchmark</h2>
      <p>Simulating 40px icon scaling against competitors (Chrome, Edge, Adobe Acrobat) on Dark Taskbar (#1E1E1E)</p>

      <div class="stage">
        <div style="font-size: 12px; font-weight: 600; color: #38BDF8; margin-bottom: 10px;">1. CURRENT TASKBAR VIEW — Notice how AuraPDF optically disappears vs. competitors:</div>
        <div class="taskbar-strip">
          <!-- Windows Start -->
          <div class="app-item"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="#00A4EF" d="M0 0h11v11H0zM13 0h11v11H13zM0 13h11v11H0zM13 13h11v11H13z"/></svg></div>
          <div style="width:1px; height:24px; background:rgba(255,255,255,0.1); margin:0 4px;"></div>
          <!-- Edge -->
          <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#0078D7"/><path d="M24 10 C 14 10 8 18 8 26 C 8 36 18 40 26 40 C 35 40 40 33 40 24 C 40 18 34 16 29 16 C 22 16 16 20 16 26 C 16 30 20 32 25 32 C 30 32 34 29 34 26" stroke="#00C7FF" stroke-width="4" fill="none"/></svg></div>
          <!-- Chrome -->
          <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#4285F4"/><path d="M24 6 A18 18 0 0 1 42 24 L24 24 Z" fill="#EA4335"/><path d="M42 24 A18 18 0 0 1 12 36 L24 24 Z" fill="#FBBC05"/><path d="M12 36 A18 18 0 0 1 24 6 L24 24 Z" fill="#34A853"/><circle cx="24" cy="24" r="8" fill="#FFF"/><circle cx="24" cy="24" r="6" fill="#4285F4"/></svg></div>
          <!-- Adobe Acrobat -->
          <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><rect width="44" height="44" x="2" y="2" rx="10" fill="#ED2224"/><path d="M10 36 C16 36 21 28 24 20 C27 28 32 36 38 36 C33 34 31 29 28 24 C33 18 36 12 36 12 C30 14 26 18 24 20 C22 18 18 14 12 12 C12 12 15 18 20 24 C17 29 15 34 10 36 Z" fill="#FFF"/></svg></div>
          <!-- CURRENT AuraPDF -->
          <div class="app-item active" style="background: rgba(255,255,255,0.08); border-radius: 8px;">
            <div style="width: 32px; height: 32px;">${svgCurrent}</div>
          </div>
          <div style="font-size: 11px; color: #EF4444; font-weight: 600; margin-left: 12px;">← Current: Black box melts into taskbar; inner document is only 15px wide!</div>
        </div>
      </div>

      <div class="stage">
        <div style="font-size: 12px; font-weight: 600; color: #00D2FF; margin-bottom: 10px;">2. PROPOSED ALTERNATIVES TESTED ON THE SAME TASKBAR:</div>
        <div class="taskbar-strip" style="height: 60px;">
          <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#4285F4"/><path d="M24 6 A18 18 0 0 1 42 24 L24 24 Z" fill="#EA4335"/><path d="M42 24 A18 18 0 0 1 12 36 L24 24 Z" fill="#FBBC05"/><circle cx="24" cy="24" r="8" fill="#FFF"/><circle cx="24" cy="24" r="6" fill="#4285F4"/></svg></div>
          <div class="app-item"><svg class="competitor-svg" viewBox="0 0 48 48"><rect width="44" height="44" x="2" y="2" rx="10" fill="#ED2224"/><path d="M10 36 C16 36 21 28 24 20 C27 28 32 36 38 36 C33 34 31 29 28 24 C33 18 36 12 36 12 C30 14 26 18 24 20 C22 18 18 14 12 12 C12 12 15 18 20 24 C17 29 15 34 10 36 Z" fill="#FFF"/></svg></div>
          <div style="width:1px; height:32px; background:rgba(255,255,255,0.15); margin:0 6px;"></div>

          <!-- Alt A -->
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="app-item active" style="width:44px; height:44px;"><div style="width:36px; height:36px;">${svgAltA}</div></div>
            <span class="label" style="color:#00D2FF;">Option A</span>
          </div>

          <!-- Alt B -->
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="app-item active" style="width:44px; height:44px;"><div style="width:38px; height:38px;">${svgAltB}</div></div>
            <span class="label" style="color:#38BDF8;">Option B ★</span>
          </div>

          <!-- Alt C -->
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="app-item active" style="width:44px; height:44px;"><div style="width:36px; height:36px;">${svgAltC}</div></div>
            <span class="label" style="color:#A7F3D0;">Option C</span>
          </div>

          <!-- Alt D -->
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="app-item active" style="width:44px; height:44px;"><div style="width:36px; height:36px;">${svgAltD}</div></div>
            <span class="label" style="color:#E9D5FF;">Option D</span>
          </div>
        </div>

        <div class="grid-cards">
          <div class="card">
            <span class="card-badge badge-alt">Option A</span>
            <div class="card-title">Maximized Obsidian + Cyan Rim</div>
            <div class="card-desc">Keeps dark squircle but expands doc to 138% and adds illuminated cyan rim so boundary never fades into dark taskbar.</div>
          </div>
          <div class="card featured">
            <span class="card-badge badge-recommended">Option B (Recommended)</span>
            <div class="card-title">Borderless Kinetic Aura</div>
            <div class="card-desc">Removes squircle box. Pure layered document deck fills 94% canvas with glowing aura. Matches VS Code & Acrobat style. +115% larger.</div>
          </div>
          <div class="card">
            <span class="card-badge badge-alt">Option C</span>
            <div class="card-title">Electric Cyan Squircle</div>
            <div class="card-desc">Vibrant full-color cyan/ocean gradient container. Instant high-saturation punch like Slack, Discord, and Spotify.</div>
          </div>
          <div class="card">
            <span class="card-badge badge-alt">Option D</span>
            <div class="card-title">Neon Pulse Ring Crest</div>
            <div class="card-desc">Midnight container encircled with a vibrant dual-tone neon perimeter ring and 140% scaled center stack.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)

  const taskbarComparisonPath = path.join(ARTIFACT_DIR, "taskbar_comparison.png")
  await page.screenshot({ path: taskbarComparisonPath })
  console.log(`Saved: ${taskbarComparisonPath}`)

  // 7. Generate File Explorer Simulation Comparison (Light Mode & Dark Mode)
  console.log("Generating File Explorer simulation graphic...")
  await page.setViewportSize({ width: 1200, height: 600 })
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
        h2 { margin: 0 0 6px 0; font-size: 20px; font-weight: 600; }
        p { margin: 0 0 20px 0; font-size: 13px; color: #94A3B8; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .explorer-window {
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .window-header {
          padding: 10px 16px;
          display: flex;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .window-body {
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          min-height: 200px;
        }
        .file-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 12px 6px;
          border-radius: 6px;
        }
        .file-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .file-name {
          font-size: 11px;
          line-height: 1.3;
          max-width: 90px;
          word-break: break-word;
        }
        /* Dark Explorer */
        .dark-win { background: #202020; border: 1px solid #333; color: #FFF; }
        .dark-win .window-header { background: #181818; color: #CCC; }
        .dark-win .file-item:hover { background: rgba(255,255,255,0.08); }
        /* Light Explorer */
        .light-win { background: #FFFFFF; border: 1px solid #E2E8F0; color: #0F172A; }
        .light-win .window-header { background: #F1F5F9; color: #334155; }
        .light-win .file-item:hover { background: rgba(0,0,0,0.05); }
      </style>
    </head>
    <body>
      <h2>AuraPDF — File Explorer & Desktop Scale Benchmark (48px Medium Icon)</h2>
      <p>Comparing how each alternative appears as an app shortcut or associated PDF in both Dark and Light Windows Explorer</p>

      <div class="row">
        <!-- Dark Explorer -->
        <div class="explorer-window dark-win">
          <div class="window-header">📁 File Explorer (Windows Dark Mode)</div>
          <div class="window-body">
            <div class="file-item">
              <div class="file-icon">${svgCurrent}</div>
              <div class="file-name" style="color:#EF4444;">Current (Tiny)</div>
            </div>
            <div class="file-item">
              <div class="file-icon">${svgAltA}</div>
              <div class="file-name">Option A</div>
            </div>
            <div class="file-item" style="background:rgba(0,210,255,0.12); border:1px solid #00D2FF; border-radius:6px;">
              <div class="file-icon">${svgAltB}</div>
              <div class="file-name" style="color:#00D2FF; font-weight:600;">Option B ★</div>
            </div>
            <div class="file-item">
              <div class="file-icon">${svgAltC}</div>
              <div class="file-name">Option C</div>
            </div>
          </div>
        </div>

        <!-- Light Explorer -->
        <div class="explorer-window light-win">
          <div class="window-header">📁 File Explorer (Windows Light Mode)</div>
          <div class="window-body">
            <div class="file-item">
              <div class="file-icon">${svgCurrent}</div>
              <div class="file-name" style="color:#EF4444;">Current</div>
            </div>
            <div class="file-item">
              <div class="file-icon">${svgAltA}</div>
              <div class="file-name">Option A</div>
            </div>
            <div class="file-item" style="background:rgba(0,180,216,0.1); border:1px solid #00B4D8; border-radius:6px;">
              <div class="file-icon">${svgAltB}</div>
              <div class="file-name" style="color:#0077B6; font-weight:600;">Option B ★</div>
            </div>
            <div class="file-item">
              <div class="file-icon">${svgAltC}</div>
              <div class="file-name">Option C</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)

  const explorerComparisonPath = path.join(ARTIFACT_DIR, "explorer_comparison.png")
  await page.screenshot({ path: explorerComparisonPath })
  console.log(`Saved: ${explorerComparisonPath}`)

  await browser.close()
  console.log("All comparison graphics generated successfully!")
}

main().catch(console.error)
