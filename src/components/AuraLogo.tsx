import { useEffect, useState } from "react"
import type React from "react"
import AuraMark from "./AuraMark"

interface AuraLogoProps {
  size?: number
  className?: string
  withBackdrop?: boolean
  forceTheme?: "dark" | "light"
}

/**
 * The app toggles `.dark` / `.light` on <html>, so the mark follows the theme by observing
 * that class instead of requiring every call site to pass the current theme down.
 */
function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState(() => {
    if (typeof document === "undefined") return false
    return document.documentElement.classList.contains("light")
  })

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsLight(root.classList.contains("light"))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isLight
}

export default function AuraLogo({
  size = 36,
  className = "",
  withBackdrop = false,
  forceTheme,
}: AuraLogoProps) {
  const themeIsLight = useIsLightTheme()
  const isLight = forceTheme ? forceTheme === "light" : themeIsLight

  // Light theme uses the light-mode mark; the dark wordmark below is unchanged.
  if (isLight) {
    return <AuraMark size={size} className={className} />
  }

  const isForced = true

  const styleOverrides: React.CSSProperties = isForced
    ? ({
        "--logo-bg-start": isLight ? "#FFFFFF" : "#0F172A",
        "--logo-bg-end": isLight ? "#F8FAFC" : "#060A12",
        "--logo-border": isLight ? "#E2E8F0" : "#1E293B",
        "--logo-doc-bg-start": isLight ? "#1E293B" : "#FFFFFF",
        "--logo-doc-bg-end": isLight ? "#0F172A" : "#F1F5F9",
        "--logo-doc-border": isLight ? "#334155" : "transparent",
        "--logo-doc-line-1": isLight ? "#FFFFFF" : "#0F172A",
        "--logo-doc-line-2": isLight ? "#38BDF8" : "var(--primary, #00D2FF)",
        "--logo-doc-line-3": isLight ? "#94A3B8" : "#94A3B8",
        "--logo-back-start": isLight ? "#E2E8F0" : "#0369A1",
        "--logo-back-end": isLight ? "#CBD5E1" : "#075985",
        "--logo-back-border": isLight ? "#CBD5E1" : "transparent",
        "--logo-foil-color": isLight ? "#BAE6FD" : "#BAE6FD",
        "--logo-foil-opacity": isLight ? 0.75 : 0.65,
        "--logo-glow-opacity": isLight ? 0.08 : 0.18,
      } as React.CSSProperties)
    : {}

  const svg = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      shapeRendering="geometricPrecision"
      style={styleOverrides}
      className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${className}`}
      aria-label="AuraPDF Logo"
    >
      <defs>
        {/* Outer Squircle Gradient (Adaptive: Black in Dark / White in Light) */}
        <linearGradient
          id="aura-c2-bg"
          x1="0"
          y1="0"
          x2="0"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--logo-bg-start, #0F172A)" />
          <stop offset="100%" stopColor="var(--logo-bg-end, #060A12)" />
        </linearGradient>

        {/* Front Document Sheet (Interswitched: White in Dark / Black in Light) */}
        <linearGradient
          id="aura-c2-front-sheet"
          x1="30"
          y1="16"
          x2="74"
          y2="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--logo-doc-bg-start, #FFFFFF)" />
          <stop offset="100%" stopColor="var(--logo-doc-bg-end, #F1F5F9)" />
        </linearGradient>

        {/* Middle Sheet (Adaptive Primary) */}
        <linearGradient
          id="aura-c2-mid-sheet"
          x1="20"
          y1="20"
          x2="66"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.82" />
        </linearGradient>

        {/* Back Sheet (Deep Tonal Primary in Dark / Architectural Slate in Light) */}
        <linearGradient
          id="aura-c2-back-sheet"
          x1="20"
          y1="20"
          x2="68"
          y2="82"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--logo-back-start, #0369A1)" />
          <stop offset="100%" stopColor="var(--logo-back-end, #075985)" />
        </linearGradient>

        <filter id="aura-page-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.2" dy="2.4" stdDeviation="2.2" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <filter id="aura-deep-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1.5" dy="3.5" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <filter id="aura-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* Squircle Base (Adaptive Alabaster / Carbon) */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="22"
        fill="url(#aura-c2-bg)"
        stroke="var(--logo-border, #1E293B)"
        strokeWidth="1.8"
      />

      {/* Soft Ambient Core Glow */}
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="var(--primary, #00D2FF)"
        opacity="var(--logo-glow-opacity, 0.18)"
        filter="url(#aura-glow-blur)"
      />

      {/* Docs Deck: Kinetic Drift (-6 deg Overall Cant) */}
      <g transform="rotate(-6 50 50) translate(50, 50) scale(1.03) translate(-50, -50)">
        {/* Back Sheet (Tilted -13 deg relative to deck) */}
        <g transform="rotate(-13 50 53)">
          <rect
            x="25"
            y="19"
            width="45"
            height="59"
            rx="6.5"
            fill="url(#aura-c2-back-sheet)"
            stroke="var(--logo-back-border, transparent)"
            strokeWidth="0.8"
            filter="url(#aura-page-shadow)"
          />
        </g>

        {/* Middle Sheet (Tilted -4 deg relative to deck) */}
        <g transform="rotate(-4 50 53)">
          <rect
            x="27.5"
            y="18"
            width="45"
            height="59"
            rx="6.5"
            fill="url(#aura-c2-mid-sheet)"
            filter="url(#aura-page-shadow)"
          />
          {/* Top Foil Highlight Edge */}
          <line
            x1="33"
            y1="19"
            x2="67"
            y2="19"
            stroke="var(--logo-foil-color, #BAE6FD)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="var(--logo-foil-opacity, 0.65)"
          />
        </g>

        {/* Front Sheet (Tilted +3 deg relative to deck: Interswitched Document with Dog-Ear Fold) */}
        <g transform="rotate(3 52 52)" filter="url(#aura-deep-shadow)">
          <path
            d="M 35.5 17 L 62 17 L 76.5 31.5 L 76.5 70 C 76.5 73.5, 73.5 76.5, 70 76.5 L 35.5 76.5 C 32 76.5, 29 73.5, 29 70 L 29 23.5 C 29 20, 32 17, 35.5 17 Z"
            fill="url(#aura-c2-front-sheet)"
            stroke="var(--logo-doc-border, transparent)"
            strokeWidth="0.6"
          />
          {/* Crisp Dog-Ear Corner Fold */}
          <path
            d="M 62 17 L 76.5 31.5 L 66.5 31.5 C 64 31.5, 62 29.5, 62 27 Z"
            fill="var(--primary)"
          />
          {/* Interswitched Minimalist Editorial Bars inside Page */}
          <rect x="37.5" y="40.5" width="28.5" height="4.8" rx="2.4" fill="var(--logo-doc-line-1, #0F172A)" />
          <rect x="37.5" y="50" width="22" height="4.8" rx="2.4" fill="var(--logo-doc-line-2, var(--primary))" />
          <rect x="37.5" y="59.5" width="15" height="4.8" rx="2.4" fill="var(--logo-doc-line-3, #94A3B8)" />
        </g>
      </g>
    </svg>
  )

  if (withBackdrop) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-card p-1 shadow-sm group"
        style={{ width: size + 8, height: size + 8 }}
      >
        {svg}
      </div>
    )
  }

  return svg
}
