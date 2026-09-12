import { useState } from 'react';
import { ChevronRightIcon, UserIcon } from '../icons';
import type { ThemeMode, ColorTheme } from '../types';
import { COLOR_THEMES } from '../theme';

type Section = 'general' | 'shortcuts' | 'account' | 'about';

interface SettingsProps {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (t: ColorTheme) => void;
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'account', label: 'Account' },
  { id: 'about', label: 'About' },
];

export default function Settings({ themeMode, setThemeMode, colorTheme, setColorTheme }: SettingsProps) {
  const [section, setSection] = useState<Section>('general');
  const [reopenLastSession, setReopenLastSession] = useState(true);
  const [confirmBeforeDeleting, setConfirmBeforeDeleting] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  return (
    <div className="h-full flex" style={{ backgroundColor: 'var(--background)' }}>
      {/* Settings sidebar nav */}
      <aside className="w-44 shrink-0 h-full overflow-y-auto py-8 px-2.5" style={{ borderRight: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
        <p className="text-[9px] font-semibold uppercase tracking-widest px-2.5 mb-3" style={{ color: 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' }}>
          Settings
        </p>
        <nav className="space-y-px">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="flex items-center w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-colors duration-100"
                style={{
                  background: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                  fontWeight: active ? 500 : 400,
                }}>
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Centered content area */}
      <div className="flex-1 overflow-y-auto flex justify-center">
        <div className="w-full max-w-md px-10 py-10">
          {section === 'general' && (
            <GeneralSection
              themeMode={themeMode} setThemeMode={setThemeMode}
              colorTheme={colorTheme} setColorTheme={setColorTheme}
              reopenLastSession={reopenLastSession} setReopenLastSession={setReopenLastSession}
              confirmBeforeDeleting={confirmBeforeDeleting} setConfirmBeforeDeleting={setConfirmBeforeDeleting}
              reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}
            />
          )}
          {section === 'shortcuts' && <ShortcutsSection />}
          {section === 'account' && <AccountSection />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-widest mb-2 mt-7 first:mt-0"
      style={{ color: 'color-mix(in srgb, var(--muted-foreground) 65%, transparent)' }}>
      {label}
    </p>
  );
}

function SettingGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden divide-y"
      style={{
        background: 'var(--card)',
        border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
      }}>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3 transition-colors duration-100"
      style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 35%, transparent)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--muted) 50%, transparent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="min-w-0">
        <p className="text-[13px]" style={{ color: 'color-mix(in srgb, var(--foreground) 90%, transparent)' }}>{label}</p>
        {description && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      className="relative rounded-full transition-colors duration-150"
      style={{
        width: 36, height: 20,
        background: checked ? 'var(--primary)' : 'color-mix(in srgb, var(--border) 120%, transparent)',
      }}>
      <span
        className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ── General ───────────────────────────────────────────────────

function GeneralSection({
  themeMode, setThemeMode, colorTheme, setColorTheme,
  reopenLastSession, setReopenLastSession,
  confirmBeforeDeleting, setConfirmBeforeDeleting,
  reduceMotion, setReduceMotion,
}: {
  themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void;
  colorTheme: ColorTheme; setColorTheme: (t: ColorTheme) => void;
  reopenLastSession: boolean; setReopenLastSession: (v: boolean) => void;
  confirmBeforeDeleting: boolean; setConfirmBeforeDeleting: (v: boolean) => void;
  reduceMotion: boolean; setReduceMotion: (v: boolean) => void;
}) {
  const modes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'amoled', label: 'AMOLED' },
  ];

  return (
    <div>
      <SectionLabel label="Appearance" />
      <SettingGroup>
        {/* Theme Mode */}
        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 35%, transparent)' }}>
          <p className="text-[12px] font-medium mb-2.5" style={{ color: 'color-mix(in srgb, var(--muted-foreground) 80%, transparent)' }}>Mode</p>
          <div className="flex items-center gap-1 p-1 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--muted) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
            {modes.map((m) => (
              <button key={m.id} onClick={() => setThemeMode(m.id)}
                className="flex-1 px-2 py-1 rounded-md text-[11px] transition-all duration-100"
                style={{
                  background: themeMode === m.id ? 'var(--card)' : 'transparent',
                  color: themeMode === m.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: themeMode === m.id ? 500 : 400,
                  boxShadow: themeMode === m.id ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Theme */}
        <div className="px-4 py-3.5">
          <p className="text-[12px] font-medium mb-3" style={{ color: 'color-mix(in srgb, var(--muted-foreground) 80%, transparent)' }}>Color Theme</p>
          <div className="flex gap-2.5">
            {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(([key, def]) => {
              const selected = colorTheme === key;
              return (
                <button key={key} onClick={() => setColorTheme(key)}
                  className="flex-1 rounded-xl overflow-hidden transition-all duration-150 relative"
                  style={{
                    aspectRatio: '3/2',
                    background: def.previewBg,
                    border: selected
                      ? `1.5px solid ${def.previewAccent}`
                      : '1.5px solid transparent',
                    outline: selected ? `1px solid color-mix(in srgb, ${def.previewAccent} 30%, transparent)` : 'none',
                    outlineOffset: '2px',
                    boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${def.previewAccent} 15%, transparent)` : 'none',
                  }}>
                  {/* Layered preview */}
                  <div className="absolute inset-0 p-1.5 flex flex-col gap-1">
                    {/* Surface bar */}
                    <div className="w-full rounded-sm" style={{ height: '30%', background: def.previewSurface }} />
                    {/* Accent + text row */}
                    <div className="flex items-center gap-1">
                      <div className="rounded-sm" style={{ width: 10, height: 6, background: def.previewAccent }} />
                      <div className="flex-1 rounded-sm" style={{ height: 3, background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                    <div className="flex gap-0.5 mt-auto">
                      <div className="rounded-sm" style={{ height: 3, width: '40%', background: 'rgba(255,255,255,0.12)' }} />
                      <div className="rounded-sm" style={{ height: 3, width: '25%', background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                  </div>
                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
                    <p className="text-[9px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>{def.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingGroup>

      <SectionLabel label="Startup" />
      <SettingGroup>
        <SettingRow label="Reopen last session" description="Restore open documents on launch">
          <Toggle checked={reopenLastSession} onChange={setReopenLastSession} />
        </SettingRow>
      </SettingGroup>

      <SectionLabel label="Safety" />
      <SettingGroup>
        <SettingRow label="Confirm before deleting">
          <Toggle checked={confirmBeforeDeleting} onChange={setConfirmBeforeDeleting} />
        </SettingRow>
      </SettingGroup>

      <SectionLabel label="Accessibility" />
      <SettingGroup>
        <SettingRow label="Reduce motion">
          <Toggle checked={reduceMotion} onChange={setReduceMotion} />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// ── Keyboard Shortcuts ────────────────────────────────────────

function ShortcutsSection() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const mod = isMac ? '⌘' : 'Ctrl';
  const [searchQuery, setSearchQuery] = useState('');

  const groups: { cat: string; items: { action: string; keys: string[] }[] }[] = [
    { cat: 'Navigation', items: [
      { action: 'Next page', keys: ['→'] },
      { action: 'Previous page', keys: ['←'] },
      { action: 'Go to page', keys: [mod, 'G'] },
      { action: 'First page', keys: ['Home'] },
      { action: 'Last page', keys: ['End'] },
    ]},
    { cat: 'View', items: [
      { action: 'Single page', keys: [mod, '1'] },
      { action: 'Two pages', keys: [mod, '2'] },
      { action: 'Continuous', keys: [mod, '3'] },
      { action: 'Fit page', keys: [mod, '0'] },
      { action: 'Fit width', keys: ['⇧', mod, '0'] },
      { action: 'Fullscreen', keys: ['F'] },
    ]},
    { cat: 'Document', items: [
      { action: 'Search', keys: [mod, 'F'] },
      { action: 'Bookmark page', keys: ['B'] },
      { action: 'Pages panel', keys: ['P'] },
      { action: 'Outline', keys: ['O'] },
    ]},
    { cat: 'Annotation', items: [
      { action: 'Highlight', keys: ['H'] },
      { action: 'Underline', keys: ['U'] },
      { action: 'Strikethrough', keys: ['S'] },
      { action: 'Pen', keys: ['D'] },
      { action: 'Text', keys: ['T'] },
      { action: 'Note', keys: ['N'] },
    ]},
    { cat: 'Edit', items: [
      { action: 'Undo', keys: [mod, 'Z'] },
      { action: 'Redo', keys: ['⇧', mod, 'Z'] },
    ]},
    { cat: 'Interface', items: [
      { action: 'Rotate clockwise', keys: ['R'] },
      { action: 'Hide / show UI', keys: ['Tab'] },
      { action: 'Close panel', keys: ['Esc'] },
      { action: 'Command Palette', keys: [mod, 'K'] },
    ]},
  ];

  const allItems = groups.flatMap((g) => g.items);
  const filtered = searchQuery.trim()
    ? allItems.filter((item) => item.action.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div>
      <h2 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Keyboard Shortcuts</h2>

      <div className="relative mb-5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--muted-foreground)' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search shortcuts…"
          className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
          style={{
            background: 'var(--card)',
            border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
            color: 'var(--foreground)',
          }} />
      </div>

      {filtered ? (
        filtered.length === 0
          ? <p className="text-[12px] py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>No shortcuts matching &ldquo;{searchQuery}&rdquo;</p>
          : <SettingGroup>{filtered.map((item) => <ShortcutRow key={item.action} action={item.action} keys={item.keys} />)}</SettingGroup>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.cat}>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' }}>{g.cat}</p>
              <SettingGroup>{g.items.map((item) => <ShortcutRow key={item.action} action={item.action} keys={item.keys} />)}</SettingGroup>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ action, keys }: { action: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 transition-colors duration-100"
      style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 35%, transparent)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--muted) 50%, transparent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span className="text-[13px]" style={{ color: 'color-mix(in srgb, var(--foreground) 90%, transparent)' }}>{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="px-1.5 py-0.5 text-[10px] rounded font-mono min-w-[1.4rem] text-center"
            style={{
              background: 'color-mix(in srgb, var(--muted) 80%, transparent)',
              border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
              color: 'var(--muted-foreground)',
            }}>
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

// ── Account ───────────────────────────────────────────────────

function AccountSection() {
  return (
    <div>
      <h2 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Account</h2>
      <SettingGroup>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 35%, transparent)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
            <UserIcon size={13} className="text-primary" style={{ color: 'var(--primary)' } as React.CSSProperties} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--foreground)' }}>Sarah Chen</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>sarah@auracorp.io</p>
          </div>
        </div>
        <SettingRow label="Email">
          <button className="text-[11px] transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>Change</button>
        </SettingRow>
        <SettingRow label="Password">
          <button className="text-[11px] transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>Update</button>
        </SettingRow>
        <div className="px-4 py-3">
          <button className="text-[13px] transition-colors duration-100 hover:opacity-70" style={{ color: 'var(--muted-foreground)' }}>Sign out</button>
        </div>
      </SettingGroup>
    </div>
  );
}

// ── About ─────────────────────────────────────────────────────

function AboutSection() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--primary)' }}>
          <span className="text-white text-sm font-bold font-serif italic">A</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>
            <span className="font-serif italic">Aura</span>PDF
          </p>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Version 2.4.1</p>
        </div>
      </div>
      <SettingGroup>
        {['Help', 'Send feedback', 'Report a problem'].map((label) => (
          <button key={label}
            className="flex items-center justify-between w-full px-4 py-2.5 text-[13px] transition-colors duration-100"
            style={{ color: 'color-mix(in srgb, var(--foreground) 90%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--border) 35%, transparent)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--muted) 50%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {label}
            <ChevronRightIcon size={12} style={{ color: 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' } as React.CSSProperties} />
          </button>
        ))}
      </SettingGroup>
    </div>
  );
}
