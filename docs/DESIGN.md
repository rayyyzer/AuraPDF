# Design System — AuraPDF Editorial Studio

## Aesthetic Direction

AuraPDF follows a **Clean Editorial Studio** direction inspired by **Linear** and **Readwise Reader**:
- **Warm Obsidian Dark Mode:** Deep, paper-friendly warm carbon surfaces (`#0E0E0D` canvas, `#151513` elevated surface, `#1C1B18` secondary well, `#24231F` muted interactive state, `#282622` 1px hairline border) that eliminate blue-light fatigue during long study sessions.
- **Alabaster Paper Light Mode:** Warm archival paper tones (`#F7F5F0` canvas, `#FFFFFF` card sheet, `#EFECE6` secondary well, `#E6E2DA` muted control, `#E2DDD3` hairline border, `#191816` deep carbon ink).
- **Subtle Editorial Accents:** Restrained champagne gold (`#D4AF6A` dark / `#8C6728` light) and warm ivory (`#EAE5DC` dark / `#22201D` light) replace cold slate blue and neon purple.
- **Stationery Annotation Pigments:** Multiply-blended warm pastel highlighters (`#F6D860` Amber Gold, `#A3D9A5` Sage Mint, `#F4A6B8` Dusty Rose, `#94C9EB` Slate Sky, `#F7B980` Warm Apricot) and archival fountain-pen inks (`#272522` Charcoal Ink, `#C0392B` Oxblood Red, `#29527A` Prussian Blue, `#2E6F40` Forest Green, `#B7791F` Warm Ochre).

## Typography & Hierarchy

- **Sans (`--font-sans`):** `Inter` for all application controls, navigation, and metadata.
- **Editorial Serif (`--font-serif`):** `Instrument Serif` for brand identity and subtle editorial moments.
- **Monospace (`--font-mono`):** `JetBrains Mono` with `tabular-nums` for page counters, zoom percentages, file sizes, and keyboard shortcuts.

## Surface & Component Rules

1. **Neutral Document Stage:** Document thumbnail wells and PDF reader canvases sit on neutral warm charcoal (`var(--secondary)`) rather than accent-tinted backgrounds so white and cream PDF pages render with true color fidelity.
2. **Contrast-Safe Primary Controls:** Every theme defines an explicit `--primary-foreground` token (`#141311` on light gold/ivory dark-mode accents; `#FAF8F5` on deep light-mode accents) guaranteeing ≥ 7:1 contrast on primary action buttons.
3. **1px Hairline Architecture:** Depth is achieved through stepped surface luminance (`background` → `card` → `secondary` → `muted`) and crisp 1px borders rather than heavy neon drop shadows or blurred gradient blobs.
