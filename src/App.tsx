import { useState, useEffect } from 'react';
import type { View, Doc, TabState, ViewMode, ThemeMode, ColorTheme } from './types';
import { COLOR_THEMES, getPalette, isDarkMode } from './theme';
import { DOCUMENTS } from './data';
import {
  HomeIcon, FileTextIcon, ClockIcon, StarIcon, FolderIcon,
  SettingsIcon, ChevronLeftIcon, ChevronRightIcon,
  UserIcon, SearchIcon,
} from './icons';
import Dashboard from './views/Dashboard';
import Library from './views/Library';
import PdfReader from './views/PdfReader';
import SearchView from './views/SearchView';
import Settings from './views/Settings';

function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem('aura:themeMode');
    if (v === 'light' || v === 'dark' || v === 'system' || v === 'amoled') return v;
  } catch {}
  return 'system';
}

function loadColorTheme(): ColorTheme {
  try {
    const v = localStorage.getItem('aura:colorTheme');
    if (v && v in COLOR_THEMES) return v as ColorTheme;
  } catch {}
  return 'navy';
}

function applyTheme(mode: ThemeMode, colorTheme: ColorTheme) {
  const palette = getPalette(mode, colorTheme);
  const dark = isDarkMode(mode);
  const root = document.documentElement;

  root.setAttribute('data-theme-fade', '');
  root.classList.toggle('dark', dark);

  root.style.setProperty('--background', palette.background);
  root.style.setProperty('--foreground', palette.foreground);
  root.style.setProperty('--card', palette.card);
  root.style.setProperty('--card-foreground', palette.foreground);
  root.style.setProperty('--secondary', palette.secondary);
  root.style.setProperty('--secondary-foreground', palette.mutedForeground);
  root.style.setProperty('--muted', palette.muted);
  root.style.setProperty('--muted-foreground', palette.mutedForeground);
  root.style.setProperty('--border', palette.border);
  root.style.setProperty('--primary', palette.primary);
  root.style.setProperty('--primary-foreground', '#FFFFFF');
  root.style.setProperty('--accent', palette.primary);
  root.style.setProperty('--accent-foreground', '#FFFFFF');
  root.style.setProperty('--ring', palette.ring);

  setTimeout(() => root.removeAttribute('data-theme-fade'), 280);
}

// ── localStorage helpers ──────────────────────────────────────
type SavedState = { page: number; zoom: number; rotation: number; viewMode: ViewMode; bookmarks: { page: number; label: string }[] };

function saveDocState(docId: string, s: SavedState) {
  try { localStorage.setItem(`aura:${docId}`, JSON.stringify(s)); } catch {}
}

function loadDocState(docId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(`aura:${docId}`);
    return raw ? (JSON.parse(raw) as SavedState) : null;
  } catch { return null; }
}

// ── Nav ───────────────────────────────────────────────────────
type NavItem = { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; view: View };

const NAV_PRIMARY: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, view: 'dashboard' },
  { id: 'library', label: 'Documents', icon: FileTextIcon, view: 'library' },
];
const NAV_SECONDARY: NavItem[] = [
  { id: 'recent', label: 'Recent', icon: ClockIcon, view: 'library' },
  { id: 'favorites', label: 'Favorites', icon: StarIcon, view: 'library' },
  { id: 'folders', label: 'Folders', icon: FolderIcon, view: 'library' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(loadThemeMode);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(loadColorTheme);

  useEffect(() => {
    applyTheme(themeMode, colorTheme);
    try { localStorage.setItem('aura:themeMode', themeMode); } catch {}
    try { localStorage.setItem('aura:colorTheme', colorTheme); } catch {}
    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system', colorTheme);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themeMode, colorTheme]);

  function setThemeMode(m: ThemeMode) { setThemeModeState(m); }
  function setColorTheme(t: ColorTheme) { setColorThemeState(t); }

  // Tab state
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [resumeToast, setResumeToast] = useState<string | null>(null);

  function openDoc(doc: Doc) {
    const existing = tabs.findIndex((t) => t.doc.id === doc.id);
    if (existing >= 0) {
      setActiveTabIdx(existing);
      setView('reader');
      return;
    }
    const saved = loadDocState(doc.id);
    const page = saved?.page ?? 1;
    if (saved && page > 1) setResumeToast(`Resumed from page ${page}`);
    const newTab: TabState = {
      doc,
      page,
      zoom: saved?.zoom ?? 100,
      rotation: saved?.rotation ?? 0,
      viewMode: saved?.viewMode ?? 'single',
      bookmarks: saved?.bookmarks ?? [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabIdx(tabs.length);
    setView('reader');
  }

  function closeTab(idx: number) {
    const next = tabs.filter((_, i) => i !== idx);
    if (next.length === 0) { setView('library'); setTabs([]); return; }
    const newActive = idx <= activeTabIdx ? Math.max(0, activeTabIdx - 1) : activeTabIdx;
    setTabs(next);
    setActiveTabIdx(newActive);
  }

  function updateTab(idx: number, update: Partial<TabState>) {
    setTabs((prev) => prev.map((t, i) => {
      if (i !== idx) return t;
      const next = { ...t, ...update };
      saveDocState(t.doc.id, { page: next.page, zoom: next.zoom, rotation: next.rotation, viewMode: next.viewMode, bookmarks: next.bookmarks });
      return next;
    }));
  }

  const w = collapsed ? 44 : 188;

  return (
    <>
      <div className="flex h-full bg-background text-foreground">
        {/* Sidebar — blends with background */}
        <aside
          style={{ width: w, minWidth: w }}
          className="flex flex-col h-full border-r border-border/40 bg-background transition-all duration-150 ease-in-out overflow-hidden z-20 shrink-0"
        >
          <div className={`flex items-center h-11 border-b border-border/30 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            {!collapsed && (
              <>
                <div className="w-6 h-6 rounded-[5px] bg-primary/90 flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold font-serif italic">A</span>
                </div>
                <span className="ml-2 text-[13px] tracking-tight whitespace-nowrap">
                  <span className="font-serif italic text-foreground/90">Aura</span>
                  <span className="font-semibold text-foreground/90">PDF</span>
                </span>
                <button onClick={() => setCollapsed(true)} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <ChevronLeftIcon size={13} />
                </button>
              </>
            )}
            {collapsed && (
              <div className="w-6 h-6 rounded-[5px] bg-primary/90 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold font-serif italic">A</span>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-0.5">
            {NAV_PRIMARY.map((item) => (
              <NavBtn key={item.id} item={item}
                active={view === item.view && item.id !== 'recent' && item.id !== 'favorites' && item.id !== 'folders'}
                collapsed={collapsed} onClick={() => setView(item.view)} />
            ))}
            <div className="my-1.5 mx-1 border-t border-border/30" />
            {NAV_SECONDARY.map((item) => (
              <NavBtn key={item.id} item={item} active={false} collapsed={collapsed} onClick={() => setView(item.view)} secondary />
            ))}
            <div className="my-1.5 mx-1 border-t border-border/30" />
            <NavBtn item={{ id: 'search', label: 'Search', icon: SearchIcon, view: 'search' }} active={view === 'search'} collapsed={collapsed} onClick={() => setView('search')} />
          </nav>

          <div className="shrink-0 border-t border-border/30 p-1.5 space-y-0.5">
            <NavBtn item={{ id: 'settings', label: 'Settings', icon: SettingsIcon, view: 'settings' }} active={view === 'settings'} collapsed={collapsed} onClick={() => setView('settings')} />
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <UserIcon size={11} className="text-primary" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground/80 truncate leading-tight">Sarah Chen</p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">Pro</p>
                </div>
              )}
            </div>
            {collapsed && (
              <button onClick={() => setCollapsed(false)} className="flex items-center justify-center w-full p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <ChevronRightIcon size={13} />
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {view === 'dashboard' && <Dashboard onOpenDoc={openDoc} onNavigate={setView} />}
          {view === 'library' && <Library onOpenDoc={openDoc} />}
          {view === 'search' && <SearchView docs={DOCUMENTS} onOpenDoc={openDoc} />}
          {view === 'settings' && (
            <Settings
              themeMode={themeMode} setThemeMode={setThemeMode}
              colorTheme={colorTheme} setColorTheme={setColorTheme}
            />
          )}
        </main>
      </div>

      {view === 'reader' && tabs.length > 0 && (
        <div className="fixed inset-0 z-50">
          <PdfReader
            tabs={tabs}
            activeTabIdx={activeTabIdx}
            resumeToast={resumeToast}
            onResumeToastDismiss={() => setResumeToast(null)}
            onTabChange={setActiveTabIdx}
            onTabClose={closeTab}
            onTabUpdate={updateTab}
            onBack={() => setView('library')}
            onOpenDoc={openDoc}
          />
        </div>
      )}
    </>
  );
}

function NavBtn({ item, active, collapsed, onClick, secondary }: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void; secondary?: boolean }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick} title={collapsed ? item.label : undefined}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-100 ${collapsed ? 'justify-center' : ''} ${
        active
          ? 'bg-primary/12 text-primary'
          : secondary
            ? 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/40 font-normal'
            : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/40'
      }`}>
      <Icon size={13} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}
