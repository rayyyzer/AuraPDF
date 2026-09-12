import { useState, useRef, useEffect } from 'react';
import type { Doc, TabState, ViewMode, Bookmark } from '../types';
import {
  ArrowLeftIcon, SearchIcon, ZoomInIcon, ZoomOutIcon, DownloadIcon,
  MoreHorizontalIcon, MaximizeIcon, MinimizeIcon, LayersIcon, AlignLeftIcon,
  HighlightIcon, PenIcon, TypeIcon, ChevronLeftIcon, ChevronRightIcon,
  XIcon, LoaderIcon, SendIcon, SparklesIcon, RefreshIcon,
  GridIcon, ListIcon, BookmarkIcon,
} from '../icons';

// ── Page data ─────────────────────────────────────────────────
const PDF_PAGES = [
  { title: 'Executive Summary', content: ['Q3 2024 Financial Report', '', 'Revenue grew 23% year-over-year to $142M, exceeding the consensus estimate of $138M by 2.9%. Enterprise segment performance was the primary driver, contributing 61% of total revenue at $86.6M — a 31% increase from the prior year period.', '', 'Operating margin expanded 340 basis points to 18.2%, driven by improved sales efficiency following the Q2 restructuring and a 12% reduction in hosting costs after completing the infrastructure migration.', '', 'Key financial highlights:', '  • Revenue: $142M (+23% YoY)', '  • Gross margin: 74.1% (+180bps)', '  • EBITDA: $31.2M (21.9% margin)', '  • Free cash flow: $8.4M (first positive quarter)', '  • Net retention rate: 118%'] },
  { title: 'Revenue Breakdown', content: ['Revenue by Segment (Q3 2024)', '', 'Enterprise: $86.6M (61% of total, +31% YoY)', 'Mid-market: $39.8M (28% of total, +18% YoY)', 'SMB: $15.6M (11% of total, +7% YoY)', '', 'The enterprise segment continued its outperformance, with average contract value increasing from $94K to $112K as customers expand usage across additional teams and workflows. Fourteen new enterprise logos were added.', '', 'Geographic distribution:', '  • North America: 68% ($96.6M)', '  • Europe: 22% ($31.2M)', '  • Rest of World: 10% ($14.2M)'] },
  { title: 'Operating Expenses', content: ['Operating expenses totaled $115.8M in Q3, compared to $98.2M in Q3 2023 — a 17.9% increase against 23% revenue growth, demonstrating operating leverage.', '', 'Research & Development: $42.1M (29.6% of revenue)', 'Sales & Marketing: $41.4M (29.2% of revenue)', 'General & Administrative: $19.8M (13.9% of revenue)', 'Cost of Revenue: $36.8M (25.9% of revenue)', '', 'R&D expense reflects continued investment in the core platform. Headcount in R&D increased by 34 during the quarter to 312 total engineers.'] },
  { title: 'Balance Sheet & Cash Flow', content: ['As of September 30, 2024:', '', 'Cash and equivalents: $284M', 'Total debt: $0', 'Working capital: $241M', '', "Free cash flow of $8.4M represents a $14.2M improvement from Q3 2023's outflow of ($5.8M). The Board approved a $50M share repurchase program to be executed over 18 months.", '', 'Capital expenditures were $12.3M in the quarter, related to data center buildout in Frankfurt and Sydney.'] },
];

const OUTLINE = [
  { title: 'Executive Summary', page: 1, level: 0 },
  { title: 'Revenue Breakdown', page: 2, level: 0 },
  { title: 'Enterprise Segment', page: 2, level: 1 },
  { title: 'Geographic Distribution', page: 2, level: 1 },
  { title: 'Operating Expenses', page: 3, level: 0 },
  { title: 'R&D Investment', page: 3, level: 1 },
  { title: 'Balance Sheet & Cash Flow', page: 4, level: 0 },
];

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 175, 200];
const TOTAL = PDF_PAGES.length;
const BASE_W = 520;
const BASE_H = 720;

interface Props {
  tabs: TabState[];
  activeTabIdx: number;
  resumeToast: string | null;
  onResumeToastDismiss: () => void;
  onTabChange: (idx: number) => void;
  onTabClose: (idx: number) => void;
  onTabUpdate: (idx: number, update: Partial<TabState>) => void;
  onBack: () => void;
  onOpenDoc: (doc: Doc) => void;
}

type AnnotateTool = 'select' | 'highlight' | 'underline' | 'strikethrough' | 'pen' | 'shape' | 'text' | 'note';

export default function PdfReader({
  tabs, activeTabIdx, resumeToast, onResumeToastDismiss,
  onTabChange, onTabClose, onTabUpdate, onBack,
}: Props) {
  const tab = tabs[activeTabIdx] ?? tabs[0];

  const [pageInput, setPageInput] = useState(String(tab?.page ?? 1));
  const [fullscreen, setFullscreen] = useState(false);
  const [topVisible, setTopVisible] = useState(true);
  const [bottomVisible, setBottomVisible] = useState(true);
  const [showThumbs, setShowThumbs] = useState(false);
  const [thumbsTab, setThumbsTab] = useState<'pages' | 'outline'>('pages');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotateTool>('select');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selPos, setSelPos] = useState({ x: 0, y: 0 });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [showAnnotateMenu, setShowAnnotateMenu] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [showSelectionMore, setShowSelectionMore] = useState(false);

  const topTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bottomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLInputElement>(null);

  // Guard — all hooks above this line, so early return is safe here
  if (!tab) return null;
  const { page, zoom, rotation, viewMode, bookmarks } = tab;
  const doc = tab.doc;

  useEffect(() => { setPageInput(String(page)); }, [activeTabIdx, page]);

  useEffect(() => {
    if (!resumeToast) return;
    const t = setTimeout(onResumeToastDismiss, 3200);
    return () => clearTimeout(t);
  }, [resumeToast]);

  function handleReaderMouseMove(e: React.MouseEvent) {
    const y = e.clientY;
    const h = window.innerHeight;
    if (y < 80) {
      setTopVisible(true);
      clearTimeout(topTimer.current);
      topTimer.current = setTimeout(() => setTopVisible(false), 2800);
    }
    if (y > h - 80) {
      setBottomVisible(true);
      clearTimeout(bottomTimer.current);
      bottomTimer.current = setTimeout(() => setBottomVisible(false), 2800);
    }
  }

  useEffect(() => {
    topTimer.current = setTimeout(() => setTopVisible(false), 1800);
    bottomTimer.current = setTimeout(() => setBottomVisible(false), 1800);
    return () => { clearTimeout(topTimer.current); clearTimeout(bottomTimer.current); };
  }, []);

  const anyMenuOpen = showMore || showSearch || aiOpen || showViewMenu || showZoomMenu || showPalette || showBookmarkPanel || showAnnotateMenu;
  useEffect(() => {
    if (anyMenuOpen) {
      setTopVisible(true);
      setBottomVisible(true);
      clearTimeout(topTimer.current);
      clearTimeout(bottomTimer.current);
    }
  }, [anyMenuOpen]);

  function set(update: Partial<TabState>) { onTabUpdate(activeTabIdx, update); }

  function nextPage() {
    const n = Math.min(TOTAL, page + (viewMode === 'two-page' ? 2 : 1));
    set({ page: n }); setPageInput(String(n));
  }
  function prevPage() {
    const n = Math.max(1, page - (viewMode === 'two-page' ? 2 : 1));
    set({ page: n }); setPageInput(String(n));
  }
  function jumpPage(n: number) {
    const c = Math.max(1, Math.min(TOTAL, n));
    set({ page: c }); setPageInput(String(c));
  }
  function zoomIn() { set({ zoom: Math.min(200, zoom + 10) }); }
  function zoomOut() { set({ zoom: Math.max(50, zoom - 10) }); }
  function setZoom(z: number) { set({ zoom: z }); }
  function rotate() { set({ rotation: (rotation + 90) % 360 }); }
  function setViewMode(m: ViewMode) { set({ viewMode: m }); }
  function toggleFullscreen() { setFullscreen((f) => !f); }

  function toggleBookmark() {
    const existing = bookmarks.findIndex((b) => b.page === page);
    if (existing >= 0) {
      set({ bookmarks: bookmarks.filter((_, i) => i !== existing) });
    } else {
      const label = PDF_PAGES[page - 1]?.title ?? `Page ${page}`;
      set({ bookmarks: [...bookmarks, { page, label }] });
    }
  }
  const isBookmarked = bookmarks.some((b) => b.page === page);

  function closeAllMenus() {
    setShowMore(false);
    setShowViewMenu(false);
    setShowZoomMenu(false);
    setShowAnnotateMenu(false);
    setShowSelectionMore(false);
  }

  // ── Command palette ───────────────────────────────────────
  const paletteCommands = [
    { id: 'prev', label: 'Previous page', category: 'Navigation', shortcut: '←', action: prevPage },
    { id: 'next', label: 'Next page', category: 'Navigation', shortcut: '→', action: nextPage },
    { id: 'pages', label: 'Open Pages', category: 'Navigation', action: () => { setShowThumbs(true); setThumbsTab('pages'); } },
    { id: 'outline', label: 'Open Outline', category: 'Navigation', action: () => { setShowThumbs(true); setThumbsTab('outline'); } },
    { id: 'single', label: 'Single page', category: 'View', shortcut: '⌘1', action: () => setViewMode('single') },
    { id: 'two', label: 'Two pages', category: 'View', shortcut: '⌘2', action: () => setViewMode('two-page') },
    { id: 'continuous', label: 'Continuous', category: 'View', shortcut: '⌘3', action: () => setViewMode('continuous') },
    { id: 'fitpage', label: 'Fit page', category: 'View', action: () => setZoom(90) },
    { id: 'fitwidth', label: 'Fit width', category: 'View', action: () => setZoom(110) },
    { id: 'actual', label: 'Actual size', category: 'View', action: () => setZoom(100) },
    { id: 'fullscreen', label: 'Fullscreen', category: 'View', shortcut: 'F', action: toggleFullscreen },
    { id: 'zoomin', label: 'Zoom in', category: 'View', shortcut: '⌘+', action: zoomIn },
    { id: 'zoomout', label: 'Zoom out', category: 'View', shortcut: '⌘−', action: zoomOut },
    { id: 'bookmark', label: isBookmarked ? 'Remove bookmark' : 'Bookmark page', category: 'Document', action: toggleBookmark },
    { id: 'search', label: 'Search document', category: 'Document', shortcut: '⌘F', action: () => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); } },
    { id: 'download', label: 'Download', category: 'Document', action: () => {} },
    { id: 'print', label: 'Print', category: 'Document', action: () => {} },
    { id: 'highlight', label: 'Highlight', category: 'Annotation', action: () => { setActiveTool('highlight'); } },
    { id: 'underline', label: 'Underline', category: 'Annotation', action: () => { setActiveTool('underline'); } },
    { id: 'strikethrough', label: 'Strikethrough', category: 'Annotation', action: () => { setActiveTool('strikethrough'); } },
    { id: 'pen', label: 'Pen', category: 'Annotation', action: () => { setActiveTool('pen'); } },
    { id: 'shape', label: 'Shape', category: 'Annotation', action: () => { setActiveTool('shape'); } },
    { id: 'text', label: 'Text', category: 'Annotation', action: () => { setActiveTool('text'); } },
    { id: 'note', label: 'Note', category: 'Annotation', action: () => { setActiveTool('note'); } },
    { id: 'undo', label: 'Undo', category: 'Edit', shortcut: '⌘Z', action: () => {} },
    { id: 'redo', label: 'Redo', category: 'Edit', shortcut: '⌘⇧Z', action: () => {} },
    { id: 'rotate', label: 'Rotate clockwise', category: 'Rotation', shortcut: 'R', action: rotate },
  ];

  const pageNum = paletteQuery.trim() ? parseInt(paletteQuery.trim()) : NaN;
  const goToPageCmd = !isNaN(pageNum) && pageNum >= 1 && pageNum <= TOTAL
    ? [{ id: 'goto', label: `Go to page ${pageNum}`, category: 'Navigate', shortcut: undefined, action: () => jumpPage(pageNum) }]
    : [];

  const filteredCmds = paletteQuery.trim()
    ? [...goToPageCmd, ...paletteCommands.filter((c) => c.label.toLowerCase().includes(paletteQuery.toLowerCase()))]
    : paletteCommands;

  // Group for unfiltered view
  const groupedCmds = paletteQuery.trim() ? null : (['Navigation', 'View', 'Document', 'Annotation', 'Edit', 'Rotation'] as const).map((cat) => ({
    cat,
    items: paletteCommands.filter((c) => c.category === cat),
  }));

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setShowPalette(true); setPaletteQuery(''); setPaletteIdx(0);
        setTimeout(() => paletteRef.current?.focus(), 50); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); zoomIn(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut(); return; }

      if (showPalette) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx((i) => Math.min(filteredCmds.length - 1, i + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx((i) => Math.max(0, i - 1)); }
        else if (e.key === 'Enter') { e.preventDefault(); filteredCmds[paletteIdx]?.action(); setShowPalette(false); }
        else if (e.key === 'Escape') { setShowPalette(false); }
        return;
      }

      if (inInput) return;

      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': nextPage(); break;
        case 'ArrowLeft': case 'ArrowUp': prevPage(); break;
        case 'r': case 'R': rotate(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'b': case 'B': setShowThumbs((v) => !v); break;
        case 'Escape':
          if (showAnnotateMenu) { setShowAnnotateMenu(false); }
          else if (showSearch) { setShowSearch(false); setSearchQuery(''); }
          else if (showThumbs) setShowThumbs(false);
          else if (showBookmarkPanel) setShowBookmarkPanel(false);
          else if (aiOpen) setAiOpen(false);
          else if (fullscreen) setFullscreen(false);
          else onBack();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPalette, showSearch, showThumbs, showBookmarkPanel, aiOpen, fullscreen, showAnnotateMenu, filteredCmds, paletteIdx, page, zoom, rotation, viewMode, bookmarks]);

  // ── AI ────────────────────────────────────────────────────
  async function triggerAi(q: string) {
    setAiQuery(q); setAiResponse(''); setAiLoading(true); setAiOpen(true); setSelectedText(null);
    await new Promise((r) => setTimeout(r, 1200));
    setAiResponse(
      q.toLowerCase().includes('summar')
        ? "This document covers Q3 2024 financial results. Revenue reached $142M (+23% YoY), operating margin expanded to 18.2%, and free cash flow turned positive at $8.4M — the first profitable quarter in company history."
        : "Based on the document context: the data indicates strong underlying business momentum with improving unit economics across all segments. Key drivers include enterprise growth, margin expansion, and operational efficiency improvements."
    );
    setAiLoading(false);
  }

  function handleTextSelect(e: React.MouseEvent) {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 8) {
      setSelectedText(sel.toString().trim().slice(0, 120));
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSelPos({ x: Math.min(e.clientX - rect.left, rect.width - 280), y: e.clientY - rect.top - 52 });
    } else {
      setSelectedText(null);
    }
  }

  const isLandscape = rotation === 90 || rotation === 270;
  const pageData = PDF_PAGES[page - 1] ?? PDF_PAGES[0];
  const pageDataB = viewMode === 'two-page' ? (PDF_PAGES[page] ?? null) : null;
  const twoZoom = Math.min(zoom, 85);

  const panelW = showThumbs ? 200 : 0;

  return (
    <div
      className="flex flex-col bg-[hsl(216_10%_86%)] dark:bg-[hsl(222_18%_5%)] h-full relative overflow-hidden select-none"
      onMouseMove={handleReaderMouseMove}
    >
      {/* ── TAB BAR ──────────────────────────────────────────── */}
      <div
        className={`shrink-0 flex items-end bg-background border-b border-border overflow-x-auto z-30 transition-all duration-300 ${fullscreen ? 'opacity-0 pointer-events-none !h-0 !min-h-0 overflow-hidden' : ''}`}
        style={{ minHeight: fullscreen ? 0 : 32 }}
      >
        {tabs.map((t, i) => {
          const isActive = i === activeTabIdx;
          return (
            <div
              key={t.doc.id}
              onClick={() => onTabChange(i)}
              className={`flex items-center gap-1.5 px-3 h-8 shrink-0 cursor-pointer border-r border-border transition-colors max-w-[180px] group ${
                isActive
                  ? 'bg-card text-foreground border-b-2 border-b-card -mb-px'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <span className="text-[11px] font-medium truncate">{t.doc.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onTabClose(i); }}
                className={`shrink-0 p-0.5 rounded transition-colors ml-auto ${isActive ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <XIcon size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── TOP TOOLBAR ──────────────────────────────────────── */}
      <div
        className={`shrink-0 flex items-center h-10 px-3 gap-1.5 bg-card border-b border-border z-30 transition-all duration-300 ease-out ${topVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}
      >
        {/* Left: back + title */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-1.5 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Back to library (Esc)"
        >
          <ArrowLeftIcon size={13} />
          <span className="hidden sm:inline max-w-[180px] truncate text-foreground font-medium text-[12px]">{doc.name}</span>
        </button>

        {/* Pages/Outline toggle */}
        <ToolBtn onClick={() => setShowThumbs((v) => !v)} title="Pages & outline (B)" active={showThumbs}>
          <LayersIcon size={13} />
        </ToolBtn>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Search | Pen | View | Bookmark | Fullscreen | More — icons only */}
        <div className="flex items-center gap-0.5">

          {/* Search */}
          {showSearch ? (
            <div className="flex items-center gap-1.5 bg-muted rounded border border-border px-2 py-1">
              <SearchIcon size={12} className="text-muted-foreground shrink-0" />
              <input ref={searchRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in document…"
                className="w-36 text-[11px] bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none" />
              {searchQuery && <span className="text-[10px] text-muted-foreground font-mono shrink-0">3</span>}
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-muted-foreground hover:text-foreground"><XIcon size={11} /></button>
            </div>
          ) : (
            <ToolBtn onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }} title="Search (⌘F)">
              <SearchIcon size={13} />
            </ToolBtn>
          )}

          <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

          {/* Pen — annotation tools only, no view controls */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAnnotateMenu((v) => !v); }}
              title={activeTool !== 'select' ? `Active: ${activeTool}` : 'Annotation tools'}
              className={`relative p-1.5 rounded transition-colors ${showAnnotateMenu || activeTool !== 'select' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {/* Pencil icon */}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              {activeTool !== 'select' && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>

            {/* Pen popover — annotation tools only */}
            {showAnnotateMenu && (
              <div
                className="absolute top-full right-0 mt-1.5 bg-card border border-border rounded-lg shadow-xl py-2.5 px-2.5 w-44 z-50 fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-2 gap-0.5">
                  {([
                    { id: 'highlight' as AnnotateTool, label: 'Highlight', icon: <HighlightIcon size={12} /> },
                    { id: 'underline' as AnnotateTool, label: 'Underline', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="4" y1="18" x2="20" y2="18"/><line x1="6" y1="11" x2="18" y2="11"/></svg> },
                    { id: 'strikethrough' as AnnotateTool, label: 'Strike', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6c0-1.5-1.5-3-4-3s-5 1-5 4c0 1 .3 1.8.8 2.5" strokeOpacity={0.4}/></svg> },
                    { id: 'pen' as AnnotateTool, label: 'Pen', icon: <PenIcon size={12} /> },
                    { id: 'shape' as AnnotateTool, label: 'Shape', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
                    { id: 'text' as AnnotateTool, label: 'Text', icon: <TypeIcon size={12} /> },
                    { id: 'note' as AnnotateTool, label: 'Note', icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                  ] as const).map((tool) => (
                    <button key={tool.id}
                      onClick={() => { setActiveTool(tool.id); setShowAnnotateMenu(false); }}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded text-[11px] font-medium transition-colors ${activeTool === tool.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                      {tool.icon}<span>{tool.label}</span>
                    </button>
                  ))}
                </div>
                {activeTool !== 'select' && (
                  <div className="border-t border-border/60 mt-2 pt-2">
                    <button
                      onClick={() => { setActiveTool('select'); setShowAnnotateMenu(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-7 1-4 7z" /></svg>
                      Exit annotation mode
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View — layout & fit options */}
          <div className="relative">
            <ToolBtn
              onClick={() => setShowViewMenu((v) => !v)}
              title="View layout"
              active={showViewMenu}
            >
              {viewMode === 'two-page'
                ? <GridIcon size={13} />
                : viewMode === 'continuous'
                  ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  : <ListIcon size={13} />
              }
            </ToolBtn>

            {showViewMenu && (
              <div className="absolute top-full right-0 mt-1.5 bg-card border border-border rounded-lg shadow-xl py-1.5 w-48 z-50 fade-in"
                onClick={(e) => e.stopPropagation()}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-1.5">Layout</p>
                {([
                  ['single', 'Single page', '⌘1'],
                  ['two-page', 'Two pages', '⌘2'],
                  ['continuous', 'Continuous', '⌘3'],
                ] as const).map(([id, label, sc]) => (
                  <button key={id} onClick={() => { setViewMode(id); setShowViewMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between transition-colors ${viewMode === id ? 'text-primary bg-primary/8 font-medium' : 'text-foreground hover:bg-muted'}`}>
                    <span>{label}</span>
                    <kbd className="text-[10px] text-muted-foreground font-mono">{sc}</kbd>
                  </button>
                ))}
                <div className="border-t border-border/60 my-1.5" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1.5">Fit</p>
                {[
                  { label: 'Fit page', v: 90 },
                  { label: 'Fit width', v: 110 },
                  { label: 'Actual size', v: 100 },
                ].map((p) => (
                  <button key={p.label} onClick={() => { setZoom(p.v); setShowViewMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${zoom === p.v ? 'text-primary bg-primary/8 font-medium' : 'text-foreground hover:bg-muted'}`}>
                    {p.label}
                  </button>
                ))}
                <div className="border-t border-border/60 my-1.5" />
                <div className="flex items-center gap-0.5 px-2 pb-1">
                  <button onClick={zoomOut} title="Zoom out (⌘−)" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ZoomOutIcon size={12} /></button>
                  <button onClick={() => setShowZoomMenu((v) => !v)}
                    className="flex-1 text-center py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors relative">
                    {zoom}%
                    {showZoomMenu && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-28 bg-card border border-border rounded shadow-lg py-1 z-50">
                        {ZOOM_PRESETS.map((z) => (
                          <button key={z} onClick={(e) => { e.stopPropagation(); setZoom(z); setShowZoomMenu(false); setShowViewMenu(false); }}
                            className={`w-full text-left px-3 py-1 text-[11px] font-mono transition-colors ${zoom === z ? 'text-primary bg-primary/8' : 'text-foreground hover:bg-muted'}`}>
                            {z}%
                          </button>
                        ))}
                      </div>
                    )}
                  </button>
                  <button onClick={zoomIn} title="Zoom in (⌘+)" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ZoomInIcon size={12} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Bookmark — pure toggle, no panel */}
          <ToolBtn
            onClick={toggleBookmark}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
            active={isBookmarked}
          >
            <BookmarkIcon size={13} filled={isBookmarked} />
          </ToolBtn>

          <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

          {/* Fullscreen */}
          <ToolBtn onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
            {fullscreen ? <MinimizeIcon size={13} /> : <MaximizeIcon size={13} />}
          </ToolBtn>

          {/* More */}
          <div className="relative">
            <ToolBtn onClick={() => setShowMore((v) => !v)} title="More options" active={showMore}>
              <MoreHorizontalIcon size={13} />
            </ToolBtn>
            {showMore && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded shadow-lg py-1 z-50 fade-in">
                {['Print', 'Download', 'Share', '—', 'Document information', 'Keyboard shortcuts'].map((item, i) =>
                  item === '—' ? <div key={i} className="border-t border-border my-1" /> : (
                    <button key={item} onClick={() => setShowMore(false)}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors">
                      {item}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex">

        {/* Left panel — Pages / Outline */}
        <div
          className="absolute left-0 top-0 bottom-0 z-20 flex flex-col bg-card border-r border-border shadow-xl overflow-hidden transition-all duration-150 ease-in-out"
          style={{ width: showThumbs ? 196 : 0, minWidth: 0 }}
        >
          {showThumbs && (
            <>
              <div className="flex items-center border-b border-border shrink-0">
                <button onClick={() => setThumbsTab('pages')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] transition-colors border-b-2 ${thumbsTab === 'pages' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <LayersIcon size={11} /> Pages
                </button>
                <button onClick={() => setThumbsTab('outline')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] transition-colors border-b-2 ${thumbsTab === 'outline' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <AlignLeftIcon size={11} /> Outline
                </button>
                <button onClick={() => setShowThumbs(false)} className="px-2.5 text-muted-foreground hover:text-foreground shrink-0">
                  <XIcon size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {thumbsTab === 'pages' ? (
                  <div className="space-y-2">
                    {PDF_PAGES.map((p, i) => (
                      <button key={i} onClick={() => jumpPage(i + 1)}
                        className={`w-full rounded overflow-hidden border transition-all ${page === i + 1 ? 'border-primary shadow-sm' : 'border-border hover:border-muted-foreground/40'}`}>
                        <div className="h-20 bg-white dark:bg-[hsl(220_14%_97%)] flex flex-col items-start justify-start p-2 gap-1">
                          {[0.9, 0.7, 1, 0.8, 0.6].map((w, j) => (
                            <div key={j} className="h-1 rounded bg-muted-foreground/20" style={{ width: `${w * 100}%` }} />
                          ))}
                        </div>
                        <div className="px-2 py-1 bg-card flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground truncate">{p.title}</span>
                          <span className={`text-[10px] font-mono ${page === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{i + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {OUTLINE.map((item, i) => (
                      <button key={i} onClick={() => jumpPage(item.page)}
                        className={`w-full text-left rounded py-1.5 text-[11px] transition-colors ${page === item.page ? 'text-primary bg-primary/8' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        style={{ paddingLeft: item.level === 1 ? 20 : 8 }}>
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── PDF CANVAS ──────────────────────────────────────── */}
        <div
          className={`flex-1 overflow-auto flex ${viewMode === 'continuous' ? 'flex-col items-center' : 'items-center justify-center'} py-8 px-6`}
          style={{ marginLeft: panelW, transition: 'margin-left 150ms ease' }}
          onMouseUp={handleTextSelect}
          onClick={() => { closeAllMenus(); }}
        >
          {viewMode === 'continuous' ? (
            <div className="flex flex-col items-center gap-6 py-4">
              {PDF_PAGES.map((p, i) => (
                <PageCard key={i} data={p} index={i} zoom={zoom} rotation={rotation} isCurrent={page === i + 1} />
              ))}
            </div>
          ) : viewMode === 'two-page' ? (
            <div className="flex items-start justify-center gap-4">
              <PageCard data={pageData} index={page - 1} zoom={twoZoom} rotation={rotation} isCurrent />
              {pageDataB
                ? <PageCard data={pageDataB} index={page} zoom={twoZoom} rotation={rotation} isCurrent={false} />
                : <div style={{ width: BASE_W * twoZoom / 100 }} className="flex items-center justify-center opacity-30"><span className="text-[11px] text-muted-foreground">End of document</span></div>
              }
            </div>
          ) : (
            <PageCard data={pageData} index={page - 1} zoom={zoom} rotation={rotation} isCurrent />
          )}

          {/* Text selection contextual toolbar */}
          {selectedText && (
            <div className="absolute z-30 fade-in" style={{ left: selPos.x, top: selPos.y }}>
              <div className="bg-card border border-border rounded-md shadow-xl px-1 py-1 flex items-center gap-0.5">
                {[
                  { label: 'Highlight', tool: 'highlight' as AnnotateTool, icon: <HighlightIcon size={11} /> },
                  { label: 'Underline', tool: 'underline' as AnnotateTool, icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="4" y1="18" x2="20" y2="18"/><line x1="6" y1="11" x2="18" y2="11"/></svg> },
                  { label: 'Strike', tool: 'strikethrough' as AnnotateTool, icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12"/></svg> },
                ].map((action) => (
                  <button key={action.label} title={action.label}
                    onClick={() => { setActiveTool(action.tool); setSelectedText(null); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
                <div className="h-3.5 w-px bg-border mx-0.5 shrink-0" />
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSelectionMore((v) => !v); }}
                    className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                    More
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  {showSelectionMore && (
                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1 w-32 z-40 fade-in">
                      {['Note', 'Ask', 'Explain', 'Summarize', 'Rewrite', 'Translate', 'Copy'].map((action) => (
                        <button key={action}
                          onClick={() => {
                            setShowSelectionMore(false);
                            if (action === 'Copy') { navigator.clipboard.writeText(selectedText); setSelectedText(null); return; }
                            if (action === 'Note') { setActiveTool('note'); setSelectedText(null); return; }
                            triggerAi(`${action}: "${selectedText.slice(0, 80)}"`);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors">
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelectedText(null); setShowSelectionMore(false); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded ml-0.5"><XIcon size={10} /></button>
              </div>
            </div>
          )}
        </div>

        {/* AI Panel */}
        {aiOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border z-20 flex flex-col shadow-xl slide-in-right">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <SparklesIcon size={13} className="text-primary shrink-0" />
              <span className="text-[12px] font-semibold text-foreground truncate flex-1">{aiQuery.split(': ')[0]}</span>
              <button onClick={() => setAiOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"><XIcon size={12} /></button>
            </div>
            {aiQuery.includes('"') && (
              <div className="px-4 py-2.5 border-b border-border bg-muted/40 shrink-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Selected</p>
                <p className="text-[11px] text-foreground leading-relaxed line-clamp-3 italic">{aiQuery.split('"')[1]}</p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoaderIcon size={13} className="spin-slow" />
                  <span className="text-[11px]">Analyzing…</span>
                </div>
              ) : aiResponse ? (
                <div>
                  <p className="text-[12px] text-foreground leading-relaxed">{aiResponse}</p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sources</p>
                    {[{ page: 1, note: 'Executive Summary' }, { page: 3, note: 'Operating Expenses' }].map((c) => (
                      <button key={c.page} onClick={() => jumpPage(c.page)}
                        className="flex items-center gap-2 w-full text-left p-2 rounded border border-border hover:border-primary/30 hover:bg-primary/4 transition-colors mb-1.5 group">
                        <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">{c.page}</span>
                        <div>
                          <p className="text-[11px] text-muted-foreground group-hover:text-foreground">{c.note}</p>
                          <p className="text-[10px] text-primary">Page {c.page} →</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex items-center gap-2 bg-muted rounded border border-border px-2.5 py-1.5">
                <input value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { triggerAi(aiInput); setAiInput(''); } }}
                  placeholder="Ask a follow-up…"
                  className="flex-1 text-[11px] bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button onClick={() => { triggerAi(aiInput); setAiInput(''); }} disabled={!aiInput.trim()}
                  className="text-primary disabled:opacity-30"><SendIcon size={12} /></button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── BOTTOM CONTROL BAR: Undo/Redo | Rotate | Page nav ─── */}
      <div
        className="absolute z-20 bottom-5 flex justify-center"
        style={{ left: panelW, right: aiOpen ? 320 : 0, pointerEvents: 'none', transition: 'left 150ms ease, right 150ms ease' }}
      >
        <div
          className={`flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-1.5 py-1.5 shadow-lg transition-all duration-300 ease-out ${bottomVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: bottomVisible ? 'auto' : 'none' }}
        >
          {/* Undo */}
          <button onClick={() => {}} title="Undo (⌘Z)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-40">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.6 6"/></svg>
          </button>
          {/* Redo */}
          <button onClick={() => {}} title="Redo (⌘⇧Z)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-40">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.4 6"/></svg>
          </button>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Rotate */}
          <button onClick={rotate} title={`Rotate clockwise${rotation !== 0 ? ` (${rotation}°)` : ''}`}
            className={`p-1.5 rounded transition-colors ${rotation !== 0 ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <RefreshIcon size={13} />
          </button>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Page navigation */}
          <button onClick={prevPage} disabled={page <= 1}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-25">
            <ChevronLeftIcon size={12} />
          </button>

          <div className="flex items-center gap-1 px-1">
            {viewMode === 'two-page' && pageDataB ? (
              <span className="text-[12px] font-mono text-foreground tabular-nums">{page}–{page + 1}</span>
            ) : (
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { jumpPage(parseInt(pageInput) || 1); (e.target as HTMLInputElement).blur(); } }}
                onFocus={(e) => e.target.select()}
                onBlur={() => jumpPage(parseInt(pageInput) || page)}
                className="w-8 text-center text-[12px] font-mono bg-transparent border-b border-border/60 text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            )}
            <span className="text-[12px] text-muted-foreground font-mono">/ {TOTAL}</span>
          </div>

          <button onClick={nextPage} disabled={page >= TOTAL}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-25">
            <ChevronRightIcon size={12} />
          </button>
        </div>
      </div>

      {/* ── COMMAND PALETTE ──────────────────────────────────── */}
      {showPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/35 backdrop-blur-[2px]"
          onClick={() => setShowPalette(false)}>
          <div className="w-[500px] max-w-[92vw] bg-card border border-border rounded-xl shadow-2xl overflow-hidden fade-in"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <SearchIcon size={14} className="text-muted-foreground shrink-0" />
              <input
                ref={paletteRef}
                value={paletteQuery}
                onChange={(e) => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                placeholder="Search commands…"
                className="flex-1 text-[13px] bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div className="max-h-[360px] overflow-y-auto py-1.5">
              {paletteQuery.trim() ? (
                filteredCmds.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-6">No results for "{paletteQuery}"</p>
                ) : filteredCmds.map((cmd, i) => (
                  <PaletteRow key={cmd.id} cmd={cmd} active={i === paletteIdx}
                    onHover={() => setPaletteIdx(i)}
                    onSelect={() => { cmd.action(); setShowPalette(false); }} />
                ))
              ) : groupedCmds && groupedCmds.map(({ cat, items }) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 pt-3 pb-1.5">{cat}</p>
                  {items.map((cmd, i) => {
                    const globalIdx = paletteCommands.indexOf(cmd);
                    return (
                      <PaletteRow key={cmd.id} cmd={cmd} active={globalIdx === paletteIdx}
                        onHover={() => setPaletteIdx(globalIdx)}
                        onSelect={() => { cmd.action(); setShowPalette(false); }} />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
              <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">↵</kbd> select</span>
              <span><kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}

      {/* Resume toast */}
      {resumeToast && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-lg fade-in">
          <span className="text-[11px] text-muted-foreground">{resumeToast}</span>
          <button onClick={onResumeToastDismiss} className="text-muted-foreground hover:text-foreground"><XIcon size={11} /></button>
        </div>
      )}
    </div>
  );
}

// ── PageCard ──────────────────────────────────────────────────
function PageCard({ data, index, zoom, rotation, isCurrent }: {
  data: { title: string; content: string[] };
  index: number;
  zoom: number;
  rotation: number;
  isCurrent: boolean;
}) {
  const isLandscape = rotation === 90 || rotation === 270;
  const outerW = (isLandscape ? BASE_H : BASE_W) * (zoom / 100);
  const outerH = (isLandscape ? BASE_W : BASE_H) * (zoom / 100);
  const innerW = BASE_W * (zoom / 100);
  const innerH = BASE_H * (zoom / 100);

  return (
    <div style={{ width: outerW, height: outerH, minWidth: outerW, minHeight: outerH }} className="relative flex items-center justify-center">
      <div
        style={{ width: innerW, height: innerH, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
        className={`bg-white shadow-lg overflow-hidden flex flex-col transition-shadow duration-150 ${isCurrent ? 'shadow-xl' : 'shadow-md'}`}
      >
        <div className="h-[3px] bg-gradient-to-r from-primary/60 to-primary/20 shrink-0" />
        <div className="flex-1 overflow-hidden p-10 flex flex-col" style={{ fontSize: `${zoom / 100 * 13}px`, color: 'hsl(220 16% 10%)' }}>
          {index === 0 && (
            <div className="mb-6 pb-5 border-b border-gray-200">
              <div className="text-[10px] font-mono text-gray-400 mb-2 tracking-widest uppercase">Confidential</div>
              <h1 style={{ fontFamily: "'Instrument Serif', serif" }} className="italic text-[1.4em] leading-snug text-gray-900">Q3 2024 Financial Report</h1>
              <p className="text-[0.85em] text-gray-500 mt-1.5">Quarter ended September 30, 2024</p>
            </div>
          )}
          <h2 className="text-[1em] font-semibold text-gray-800 mb-3">{data.title}</h2>
          <div className="space-y-1.5 flex-1">
            {data.content.map((line, i) => (
              <p key={i}
                className={`leading-relaxed select-text cursor-text ${line === '' ? 'h-2' : line.startsWith('  •') ? 'pl-4 text-gray-700' : line.match(/^[A-Z][^a-z]{1,}/) ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                style={{ fontSize: line === '' ? undefined : '0.92em' }}>
                {line || ' '}
              </p>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between text-[0.75em] text-gray-400 font-mono">
            <span>AuraCorp Inc.</span>
            <span>{index + 1} / {PDF_PAGES.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PaletteRow ────────────────────────────────────────────────
function PaletteRow({ cmd, active, onHover, onSelect }: {
  cmd: { label: string; shortcut?: string };
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex items-center justify-between w-full px-4 py-2 text-left transition-colors ${active ? 'bg-primary/8 text-primary' : 'text-foreground hover:bg-muted'}`}
    >
      <span className="text-[12px] font-medium">{cmd.label}</span>
      {cmd.shortcut && (
        <kbd className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
          {cmd.shortcut}
        </kbd>
      )}
    </button>
  );
}

// ── ToolBtn ───────────────────────────────────────────────────
function ToolBtn({ onClick, title, disabled, active, children }: {
  onClick: () => void; title?: string; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
      {children}
    </button>
  );
}
