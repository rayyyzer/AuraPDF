import type { ColorTheme, ThemeMode } from "./types"

export type Palette = {
  background: string
  card: string
  secondary: string
  muted: string
  foreground: string
  mutedForeground: string
  border: string
  primary: string
  primaryForeground: string
  ring: string
}

export type ColorThemeDef = {
  label: string
  dark: Palette
  amoled: Palette
  light: Palette
  previewBg: string
  previewSurface: string
  previewAccent: string
}

// Default theme: Modern Vivid Violet / Indigo
const VIVID_VIOLET: ColorThemeDef = {
  label: "Vivid Violet",
  previewBg: "#07080E",
  previewSurface: "#131726",
  previewAccent: "#7C5CFC",
  dark: {
    background: "#07080E",
    card: "#0D0F1A",
    secondary: "#131726",
    muted: "#1B2137",
    foreground: "#F1F5F9",
    mutedForeground: "#8F9BB3",
    border: "#1F263E",
    primary: "#7C5CFC",
    primaryForeground: "#FFFFFF",
    ring: "#7C5CFC",
  },
  amoled: {
    background: "#000000",
    card: "#06070C",
    secondary: "#0C0E18",
    muted: "#141826",
    foreground: "#F1F5F9",
    mutedForeground: "#8F9BB3",
    border: "#1A2034",
    primary: "#7C5CFC",
    primaryForeground: "#FFFFFF",
    ring: "#7C5CFC",
  },
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    secondary: "#F1F5F9",
    muted: "#E2E8F0",
    foreground: "#0F172A",
    mutedForeground: "#64748B",
    border: "#E2E8F0",
    primary: "#6D28D9",
    primaryForeground: "#FFFFFF",
    ring: "#6D28D9",
  },
}

// Electric Cyan — Primary Signature Theme: Derived directly from AuraPDF's glass codex mark
const ELECTRIC_CYAN: ColorThemeDef = {
  label: "Electric Cyan",
  previewBg: "#070B14",
  previewSurface: "#121C30",
  previewAccent: "#00D2FF",
  dark: {
    background: "#070B14",
    card: "#0C1322",
    secondary: "#121C30",
    muted: "#1A2844",
    foreground: "#F0F9FF",
    mutedForeground: "#7DD3FC",
    border: "#1A2C4B",
    primary: "#00D2FF",
    primaryForeground: "#021526",
    ring: "#00D2FF",
  },
  amoled: {
    background: "#000000",
    card: "#050912",
    secondary: "#0A1324",
    muted: "#121E36",
    foreground: "#F0F9FF",
    mutedForeground: "#7DD3FC",
    border: "#15243F",
    primary: "#00D2FF",
    primaryForeground: "#021526",
    ring: "#00D2FF",
  },
  light: {
    background: "#F0F7FC",
    card: "#FFFFFF",
    secondary: "#E1F0FA",
    muted: "#CCE5F5",
    foreground: "#06233B",
    mutedForeground: "#0284C7",
    border: "#C3E0F4",
    primary: "#0284C7",
    primaryForeground: "#FFFFFF",
    ring: "#00D2FF",
  },
}

// Radiant Warm Amber — Mellow warm honey, soothing warm ivory paper text, obsidian dark
const RADIANT_AMBER: ColorThemeDef = {
  label: "Radiant Amber",
  previewBg: "#0C0A09",
  previewSurface: "#1B1714",
  previewAccent: "#D97706",
  dark: {
    background: "#0C0A09",
    card: "#141210",
    secondary: "#1B1714",
    muted: "#26211C",
    foreground: "#F7F5F0",
    mutedForeground: "#A39788",
    border: "#29231D",
    primary: "#D97706",
    primaryForeground: "#FFFFFF",
    ring: "#D97706",
  },
  amoled: {
    background: "#000000",
    card: "#0A0807",
    secondary: "#120F0D",
    muted: "#1D1814",
    foreground: "#F7F5F0",
    mutedForeground: "#A39788",
    border: "#221C16",
    primary: "#D97706",
    primaryForeground: "#FFFFFF",
    ring: "#D97706",
  },
  light: {
    background: "#FBF9F5",
    card: "#FFFFFF",
    secondary: "#F4EFEA",
    muted: "#EAE3DB",
    foreground: "#292524",
    mutedForeground: "#78716C",
    border: "#E7E0D8",
    primary: "#D97706",
    primaryForeground: "#FFFFFF",
    ring: "#D97706",
  },
}

// Vivid Emerald — Botanical sage & forest slate, eye-friendly soft linen white text
const VIVID_EMERALD: ColorThemeDef = {
  label: "Vivid Emerald",
  previewBg: "#070D0A",
  previewSurface: "#14221A",
  previewAccent: "#10B981",
  dark: {
    background: "#070D0A",
    card: "#0E1712",
    secondary: "#14221A",
    muted: "#1D2F25",
    foreground: "#F1F7F4",
    mutedForeground: "#8FA79A",
    border: "#1E3326",
    primary: "#10B981",
    primaryForeground: "#FFFFFF",
    ring: "#10B981",
  },
  amoled: {
    background: "#000000",
    card: "#080F0B",
    secondary: "#0F1A13",
    muted: "#16261D",
    foreground: "#F1F7F4",
    mutedForeground: "#8FA79A",
    border: "#182C20",
    primary: "#10B981",
    primaryForeground: "#FFFFFF",
    ring: "#10B981",
  },
  light: {
    background: "#F4F8F6",
    card: "#FFFFFF",
    secondary: "#E8F1EC",
    muted: "#D6E5DD",
    foreground: "#132B21",
    mutedForeground: "#4D7260",
    border: "#D2E3DA",
    primary: "#059669",
    primaryForeground: "#FFFFFF",
    ring: "#059669",
  },
}

// Sunset Rose — Dusty terracotta & cocoa mauve, soft neutral white text
const SUNSET_ROSE: ColorThemeDef = {
  label: "Sunset Rose",
  previewBg: "#0C080A",
  previewSurface: "#1E151A",
  previewAccent: "#D45D79",
  dark: {
    background: "#0C080A",
    card: "#150F12",
    secondary: "#1E151A",
    muted: "#2A1D24",
    foreground: "#F7F2F4",
    mutedForeground: "#A8929A",
    border: "#2D1E26",
    primary: "#D45D79",
    primaryForeground: "#FFFFFF",
    ring: "#D45D79",
  },
  amoled: {
    background: "#000000",
    card: "#0D080A",
    secondary: "#160E12",
    muted: "#21141B",
    foreground: "#F7F2F4",
    mutedForeground: "#A8929A",
    border: "#25171F",
    primary: "#D45D79",
    primaryForeground: "#FFFFFF",
    ring: "#D45D79",
  },
  light: {
    background: "#FAF5F6",
    card: "#FFFFFF",
    secondary: "#F5EAEF",
    muted: "#EAD9E2",
    foreground: "#2E141E",
    mutedForeground: "#7E5365",
    border: "#E5D3DE",
    primary: "#C03958",
    primaryForeground: "#FFFFFF",
    ring: "#C03958",
  },
}

export const COLOR_THEMES: Record<ColorTheme, ColorThemeDef> = {
  moon: ELECTRIC_CYAN,
  navy: VIVID_VIOLET,
  ember: RADIANT_AMBER,
  emerald: VIVID_EMERALD,
  burgundy: SUNSET_ROSE,
}

// Legacy compat: used by Settings accent swatch renderer
export const ACCENT_COLORS = COLOR_THEMES

export function getPalette(
  mode: ThemeMode,
  colorTheme: ColorTheme,
  amoled = false,
): Palette {
  const theme = COLOR_THEMES[colorTheme] ?? COLOR_THEMES.moon
  if (amoled && mode !== "light") return theme.amoled
  if (mode === "dark") return theme.dark
  if (mode === "light") return theme.light
  const sysDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  return sysDark ? theme.dark : theme.light
}

export function isDarkMode(mode: ThemeMode): boolean {
  if (mode === "dark") return true
  if (mode === "light") return false
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}
