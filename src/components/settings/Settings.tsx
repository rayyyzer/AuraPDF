import { useState } from "react"

import { ChevronRightIcon } from "../../icons"

import type { ThemeMode, ColorTheme } from "../../types"

import { COLOR_THEMES, isDarkMode } from "../../theme"
import { useAppStore } from "../../stores/useAppStore"
import { useShallow } from "zustand/react/shallow"
import AuraLogo from "../AuraLogo"
import {
  isTauriContext,
  openWindowsDefaultAppsSettings,
  registerWindowsFileAssociation,
} from "../../services/tauri"

type Section = "general" | "shortcuts" | "about"

interface SettingsProps {
  themeMode: ThemeMode

  setThemeMode: (m: ThemeMode) => void

  colorTheme: ColorTheme

  setColorTheme: (t: ColorTheme) => void
  amoled: boolean
  setAmoled: (v: boolean) => void
  reopenLastSession: boolean
  setReopenLastSession: (v: boolean) => void
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },

  { id: "shortcuts", label: "Help & Shortcuts" },

  { id: "about", label: "About" },
]

export default function Settings({
  themeMode,

  setThemeMode,

  colorTheme,
  setColorTheme,
  amoled,
  setAmoled,
  reopenLastSession,
  setReopenLastSession,
}: SettingsProps) {
  const [section, setSection] = useState<Section>("general")

  const {
    confirmBeforeDeleting,
    setConfirmBeforeDeleting,
    reduceMotion,
    setReduceMotion,
  } = useAppStore(
    useShallow((state) => ({
      confirmBeforeDeleting: state.confirmBeforeDeleting,
      setConfirmBeforeDeleting: state.setConfirmBeforeDeleting,
      reduceMotion: state.reduceMotion,
      setReduceMotion: state.setReduceMotion,
    })),
  )

  return (
    <div
      className="h-full flex"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Settings sidebar nav */}
      <aside
        className="w-52 shrink-0 h-full overflow-y-auto py-10 px-3"
        style={{
          borderRight:
            "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-widest px-3 mb-4"
          style={{
            color:
              "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
          }}
        >
          Settings
        </p>
        <nav className="space-y-px">
          {SECTIONS.map((s) => {
            const active = section === s.id

            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="flex items-center w-full px-3 py-2 rounded-lg text-[14px] transition-colors duration-100"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                    : "transparent",

                  color: active ? "var(--primary)" : "var(--muted-foreground)",

                  fontWeight: active ? 500 : 400,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Centered content area */}
      <div className="flex-1 overflow-y-auto flex justify-center">
        <div
          key={section}
          className="settings-content-width px-8 py-10 view-enter"
        >
          {section === "general" && (
            <GeneralSection
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              colorTheme={colorTheme}
              setColorTheme={setColorTheme}
              amoled={amoled}
              setAmoled={setAmoled}
              reopenLastSession={reopenLastSession}
              setReopenLastSession={setReopenLastSession}
              confirmBeforeDeleting={confirmBeforeDeleting}
              setConfirmBeforeDeleting={setConfirmBeforeDeleting}
              reduceMotion={reduceMotion}
              setReduceMotion={setReduceMotion}
            />
          )}
          {section === "shortcuts" && <ShortcutsSection />}

          {section === "about" && (
            <AboutSection
              onNavigateToShortcuts={() => setSection("shortcuts")}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-widest mb-3 mt-8 first:mt-0"
      style={{
        color: "color-mix(in srgb, var(--muted-foreground) 65%, transparent)",
      }}
    >
      {label}
    </p>
  )
}

function SettingGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{
        background: "var(--card)",

        border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      {children}
    </div>
  )
}

function SettingRow({
  label,

  description,

  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between gap-6 px-5 py-3.5 transition-colors duration-100"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--border) 35%, transparent)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          "color-mix(in srgb, var(--muted) 50%, transparent)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="min-w-0">
        <p
          className="text-[14px]"
          style={{
            color: "color-mix(in srgb, var(--foreground) 90%, transparent)",
          }}
        >
          {label}
        </p>
        {description && (
          <p
            className="text-[13px] mt-0.5 leading-snug"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,

  onChange,
}: {
  checked: boolean

  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      className="relative rounded-full transition-colors duration-150"
      style={{
        width: 40,

        height: 22,

        background: checked
          ? "var(--primary)"
          : "color-mix(in srgb, var(--border) 120%, transparent)",
      }}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-150"
        style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
      />
    </button>
  )
}

// ── General ───────────────────────────────────────────────────

function GeneralSection({
  themeMode,

  setThemeMode,

  colorTheme,

  setColorTheme,
  amoled,
  setAmoled,

  reopenLastSession,

  setReopenLastSession,

  confirmBeforeDeleting,

  setConfirmBeforeDeleting,

  reduceMotion,

  setReduceMotion,
}: {
  themeMode: ThemeMode

  setThemeMode: (m: ThemeMode) => void

  colorTheme: ColorTheme

  setColorTheme: (t: ColorTheme) => void
  amoled: boolean
  setAmoled: (v: boolean) => void

  reopenLastSession: boolean

  setReopenLastSession: (v: boolean) => void

  confirmBeforeDeleting: boolean

  setConfirmBeforeDeleting: (v: boolean) => void
  reduceMotion: boolean

  setReduceMotion: (v: boolean) => void
}) {
  const modes: { id: ThemeMode; label: string }[] = [
    { id: "system", label: "System" },

    { id: "light", label: "Light" },

    { id: "dark", label: "Dark" },
  ]

  return (
    <div>
      <SectionLabel label="Appearance" />
      <SettingGroup>
        {/* Theme Mode */}
        <div
          className="px-5 py-4"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--border) 35%, transparent)",
          }}
        >
          <p
            className="text-[14px] font-medium mb-3"
            style={{
              color:
                "color-mix(in srgb, var(--muted-foreground) 80%, transparent)",
            }}
          >
            Mode
          </p>
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--muted) 80%, transparent)",

              border:
                "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
            }}
          >
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setThemeMode(m.id)}
                className="flex-1 px-3 py-2 rounded-md text-[14px] transition-all duration-100"
                style={{
                  background:
                    themeMode === m.id ? "var(--card)" : "transparent",

                  color:
                    themeMode === m.id
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",

                  fontWeight: themeMode === m.id ? 500 : 400,

                  boxShadow:
                    themeMode === m.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <SettingRow
          label="AMOLED"
          description="Use a true near-black surface in dark mode."
        >
          <Toggle
            checked={amoled && themeMode !== "light"}
            onChange={setAmoled}
          />
        </SettingRow>

        {/* Color Theme */}
        <div className="px-5 py-4">
          <p
            className="text-[14px] font-medium mb-3"
            style={{
              color:
                "color-mix(in srgb, var(--muted-foreground) 80%, transparent)",
            }}
          >
            Color Theme
          </p>
          <div className="grid grid-cols-5 gap-2.5">
            {(() => {
              const isDark = isDarkMode(themeMode)
              return (Object.entries(
                COLOR_THEMES,
              ) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(
                ([key, def]) => {
                  const selected = colorTheme === key
                  const previewBg = isDark ? def.previewBg : def.light.background
                  const previewSurface = isDark ? def.previewSurface : def.light.card
                  const previewAccent = isDark ? def.previewAccent : def.light.primary
                  const previewTextLine1 = isDark
                    ? "rgba(255,255,255,0.08)"
                    : "color-mix(in srgb, var(--foreground) 12%, transparent)"
                  const previewTextLine2 = isDark
                    ? "rgba(255,255,255,0.12)"
                    : "color-mix(in srgb, var(--foreground) 16%, transparent)"
                  const previewTextLine3 = isDark
                    ? "rgba(255,255,255,0.06)"
                    : "color-mix(in srgb, var(--foreground) 8%, transparent)"
                  const labelColor = isDark
                    ? "rgba(255,255,255,0.75)"
                    : def.light.foreground

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      title={`Select ${def.label} color theme`}
                      onClick={() => setColorTheme(key)}
                      className="flex-1 rounded-xl overflow-hidden transition-all duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{
                        aspectRatio: "3/2",
                        background: previewBg,
                        border: selected
                          ? `1.5px solid ${previewAccent}`
                          : `1.5px solid ${isDark ? "transparent" : def.light.border}`,
                        outline: selected
                          ? `1px solid color-mix(in srgb, ${previewAccent} 30%, transparent)`
                          : "none",
                        outlineOffset: "2px",
                        boxShadow: selected
                          ? `0 0 0 3px color-mix(in srgb, ${previewAccent} 15%, transparent)`
                          : isDark
                          ? "none"
                          : "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      {/* Layered preview */}
                      <div className="absolute inset-0 p-2 flex flex-col gap-1.5">
                        {/* Surface bar */}
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: "30%",
                            background: previewSurface,
                            border: isDark ? "none" : `1px solid ${def.light.border}`,
                          }}
                        />
                        {/* Accent + text row */}
                        <div className="flex items-center gap-1">
                          <div
                            className="rounded-sm"
                            style={{
                              width: 10,
                              height: 6,
                              background: previewAccent,
                            }}
                          />
                          <div
                            className="flex-1 rounded-sm"
                            style={{
                              height: 3,
                              background: previewTextLine1,
                            }}
                          />
                        </div>
                        <div className="flex gap-0.5 mt-auto">
                          <div
                            className="rounded-sm"
                            style={{
                              height: 3,
                              width: "40%",
                              background: previewTextLine2,
                            }}
                          />
                          <div
                            className="rounded-sm"
                            style={{
                              height: 3,
                              width: "25%",
                              background: previewTextLine3,
                            }}
                          />
                        </div>
                      </div>
                      {/* Active Selected Check Badge */}
                      {selected && (
                        <div
                          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: previewAccent }}
                        >
                          ✓
                        </div>
                      )}
                      {/* Label */}
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
                        <p
                          className="text-[11px] font-medium text-center whitespace-nowrap"
                          style={{ color: labelColor }}
                        >
                          {def.label}
                        </p>
                      </div>
                    </button>
                  )
                },
              )
            })()}
          </div>
        </div>
      </SettingGroup>

      <SectionLabel label="Startup" />
      <SettingGroup>
        <SettingRow
          label="Reopen last session"
          description="Restore open documents on launch"
        >
          <Toggle checked={reopenLastSession} onChange={setReopenLastSession} />
        </SettingRow>
        {isTauriContext() && (
          <SettingRow
            label="Default PDF viewer"
            description="Select AuraPDF as your default PDF reader in Windows Settings"
          >
            <button
              onClick={async () => {
                try {
                  await registerWindowsFileAssociation()
                  await openWindowsDefaultAppsSettings()
                } catch (e) {
                  console.warn(e)
                }
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 15%, transparent)",
                color: "var(--primary)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              Windows Default Apps
            </button>
          </SettingRow>
        )}
      </SettingGroup>

      <SectionLabel label="Safety" />
      <SettingGroup>
        <SettingRow label="Confirm before deleting">
          <Toggle
            checked={confirmBeforeDeleting}
            onChange={setConfirmBeforeDeleting}
          />
        </SettingRow>
      </SettingGroup>

      <SectionLabel label="Accessibility" />
      <SettingGroup>
        <SettingRow label="Reduce motion">
          <Toggle checked={reduceMotion} onChange={setReduceMotion} />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}

// ── Keyboard Shortcuts ────────────────────────────────────────

function ShortcutsSection() {
  const mod = "Ctrl"
  const shiftKey = "Shift"

  const [searchQuery, setSearchQuery] = useState("")

  const groups: { cat: string; items: { action: string; keys: string[] }[] }[] = [
    {
      cat: "Navigation",

      items: [
        { action: "Next page", keys: ["→"] },

        { action: "Previous page", keys: ["←"] },

        { action: "Go to page", keys: [mod, "G"] },

        { action: "First page", keys: ["Home"] },

        { action: "Last page", keys: ["End"] },
      ],
    },

    {
      cat: "View",

      items: [
        { action: "Single page", keys: [mod, "1"] },

        { action: "Two pages", keys: [mod, "2"] },

        { action: "Continuous", keys: [mod, "3"] },

        { action: "Fit page", keys: [mod, "0"] },

        { action: "Fit width", keys: [mod, shiftKey, "0"] },

        { action: "Reader Immersion (Tabs / True)", keys: ["F"] },

        { action: "Window Fullscreen (Hide Taskbar)", keys: ["F11"] },
      ],
    },

    {
      cat: "Document",

      items: [
        { action: "Open PDF", keys: [mod, "O"] },

        { action: "Search", keys: [mod, "F"] },

        { action: "Bookmark page", keys: ["B"] },

        { action: "Pages panel", keys: ["P"] },

        { action: "Outline", keys: ["O"] },
      ],
    },

    {
      cat: "Annotation",

      items: [
        { action: "Highlight", keys: ["H"] },

        { action: "Underline", keys: ["U"] },

        { action: "Strikethrough", keys: ["S"] },

        { action: "Pen", keys: ["D"] },

        { action: "Text", keys: ["T"] },

        { action: "Note", keys: ["N"] },
      ],
    },

    {
      cat: "Edit",

      items: [
        { action: "Undo", keys: [mod, "Z"] },

        { action: "Redo", keys: [mod, shiftKey, "Z"] },
      ],
    },

    {
      cat: "Interface",

      items: [
        { action: "Rotate clockwise", keys: ["R"] },

        { action: "Hide / show UI", keys: ["Tab"] },

        { action: "Close panel", keys: ["Esc"] },

        { action: "Command Palette", keys: [mod, "K"] },
      ],
    },
  ]

  const allItems = groups.flatMap((g) => g.items)

  const filtered = searchQuery.trim()
    ? allItems.filter((item) =>
        item.action.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null

  return (
    <div>
      <h2
        className="text-[13px] font-semibold mb-4"
        style={{ color: "var(--foreground)" }}
      >
        Keyboard Shortcuts
      </h2>

      <div className="relative mb-5">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--muted-foreground)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search shortcuts…"
          className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
          style={{
            background: "var(--card)",

            border:
              "1px solid color-mix(in srgb, var(--border) 60%, transparent)",

            color: "var(--foreground)",
          }}
        />
      </div>

      {filtered ? (
        filtered.length === 0 ? (
          <p
            className="text-[12px] py-6 text-center"
            style={{ color: "var(--muted-foreground)" }}
          >
            No shortcuts matching &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <SettingGroup>
            {filtered.map((item) => (
              <ShortcutRow
                key={item.action}
                action={item.action}
                keys={item.keys}
              />
            ))}
          </SettingGroup>
        )
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.cat}>
              <p
                className="text-[9px] font-semibold uppercase tracking-widest mb-2"
                style={{
                  color:
                    "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
                }}
              >
                {g.cat}
              </p>
              <SettingGroup>
                {g.items.map((item) => (
                  <ShortcutRow
                    key={item.action}
                    action={item.action}
                    keys={item.keys}
                  />
                ))}
              </SettingGroup>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShortcutRow({ action, keys }: { action: string; keys: string[] }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 transition-colors duration-100"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--border) 35%, transparent)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          "color-mix(in srgb, var(--muted) 50%, transparent)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        className="text-[13px]"
        style={{
          color: "color-mix(in srgb, var(--foreground) 90%, transparent)",
        }}
      >
        {action}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 text-[10px] rounded font-mono min-w-[1.4rem] text-center"
            style={{
              background: "color-mix(in srgb, var(--muted) 80%, transparent)",

              border:
                "1px solid color-mix(in srgb, var(--border) 60%, transparent)",

              color: "var(--muted-foreground)",
            }}
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}

// ── About ─────────────────────────────────────────────────────

function AboutSection({
  onNavigateToShortcuts,
}: {
  onNavigateToShortcuts?: () => void
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <AuraLogo size={36} />
        </div>
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            <span className="font-serif italic">Aura</span>PDF
          </p>
          <p
            className="text-[11px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Version 0.1.0
          </p>
        </div>
      </div>
      <SettingGroup>
        {["Help", "Send feedback", "Report a problem"].map((label) => (
          <button
            key={label}
            onClick={() => {
              if (label === "Help") onNavigateToShortcuts?.()
            }}
            className="flex items-center justify-between w-full px-4 py-2.5 text-[13px] transition-colors duration-100"
            style={{
              color: "color-mix(in srgb, var(--foreground) 90%, transparent)",

              borderBottom:
                "1px solid color-mix(in srgb, var(--border) 35%, transparent)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "color-mix(in srgb, var(--muted) 50%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {label}
            <ChevronRightIcon
              size={12}
              style={
                {
                  color:
                    "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
                } as React.CSSProperties
              }
            />
          </button>
        ))}
      </SettingGroup>
    </div>
  )
}
