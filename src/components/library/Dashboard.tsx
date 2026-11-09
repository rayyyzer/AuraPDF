import { useState, useEffect } from "react"

import type { Doc, View } from "../../types"

import {
  SearchIcon,
  FileTextIcon,
  StarIcon,
  FolderIcon,
  ClockIcon,
  MoreHorizontalIcon,
  ChevronRightIcon,
  BookmarkIcon,
  PlusIcon,
} from "../../icons"

import { openLocalPdf, resolvePdfPaths } from "../../services/tauri"
import { openPdfFilesDirect, type PickedPdf } from "../../services/pdf/import"
import { db } from "../../services/db"
import { PageThumbnail } from "../reader/PageThumbnail"
import AuraLogo from "../AuraLogo"

import { useAppStore } from "../../stores/useAppStore"
import { useShallow } from "zustand/react/shallow"
import { formatFileSize, formatLastOpened } from "../../utils/documentMetadata"

interface Props {
  onOpenDoc: (doc: Doc) => void
  onOpenFileDialog?: () => Promise<void>
  onDeleteDocument?: (id: string) => Promise<void>
  onNavigate: (view: View) => void
  onNotice?: (message: string, isError?: boolean) => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function Dashboard({
  onOpenDoc,
  onOpenFileDialog,
  onDeleteDocument,
  onNavigate,
  onNotice,
}: Props) {
  const [dragging, setDragging] = useState(false)
  const [menuDocId, setMenuDocId] = useState<string | null>(null)

  const {
    documents,
    folders,
    saveDocument,
    saveDocuments,
    addDocumentToLibrary,
  } = useAppStore(
    useShallow((state) => ({
      documents: state.documents,
      folders: state.folders,
      saveDocument: state.saveDocument,
      saveDocuments: state.saveDocuments,
      addDocumentToLibrary: state.addDocumentToLibrary,
    })),
  )

  const hasDocuments = documents.length > 0
  const recents = documents.slice(0, 4)
  const pinned = documents.filter((d) => d.favorite)
  const totalPages = documents.reduce((acc, doc) => acc + doc.pages, 0)

  const [continueInfo, setContinueInfo] = useState<{
    doc: Doc
    page: number
  } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const info = await db.getContinueReadingDoc()
        if (active && info) {
          const doc = documents.find((d) => d.id === info.docId)
          if (doc) setContinueInfo({ doc, page: info.page })
          else setContinueInfo(null)
        } else if (active) {
          setContinueInfo(null)
        }
      } catch (e) {
        console.error(e)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [documents])

  async function handleOpenPdfDirect() {
    if (onOpenFileDialog) {
      await onOpenFileDialog()
      return
    }
    try {
      const selected = await openLocalPdf()
      if (!selected) return
      const result = await openPdfFilesDirect([selected], documents)
      if (result.opened.length > 0) {
        await saveDocuments(result.opened)
        onOpenDoc(result.opened[0])
      }
    } catch (e) {
      console.error("[PDF OPEN] Home open failed", e)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    )
    if (droppedFiles.length === 0) return

    try {
      const nativePaths = droppedFiles
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => Boolean(p))

      let picked: PickedPdf[] = []
      if (nativePaths.length > 0) {
        picked = await resolvePdfPaths(nativePaths)
      } else {
        picked = await Promise.all(
          droppedFiles.map(async (file) => ({
            path: URL.createObjectURL(file),
            size: file.size,
            data: new Uint8Array(await file.arrayBuffer()),
            name: file.name,
          })),
        )
      }

      if (picked.length === 0) return
      const result = await openPdfFilesDirect(picked, documents)
      if (result.opened.length > 0) {
        await saveDocuments(result.opened)
        onOpenDoc(result.opened[0])
      }
    } catch (err) {
      console.error("[PDF OPEN] Drop open failed", err)
    }
  }

  return (
    <div
      className="h-full flex flex-col bg-background overflow-hidden"
      onClick={() => setMenuDocId(null)}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="fixed inset-0 z-30 flex items-center justify-center border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary backdrop-blur-sm pointer-events-none">
          Drop PDF to open immediately
        </div>
      )}

      {/* Top Bar */}
      <div className="shrink-0 flex items-center gap-3 h-12 px-6 border-b border-border/40 bg-card/60 backdrop-blur-md">
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight">
          Home
        </h1>

        <div className="relative ml-4 flex-1 max-w-72">
          <SearchIcon
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            onFocus={() => onNavigate("search")}
            placeholder="Search documents…"
            readOnly
            className="w-full pl-9 pr-14 py-1.5 text-[13px] bg-secondary/80 hover:bg-secondary rounded-lg border border-border/60 text-foreground placeholder:text-muted-foreground focus:outline-none cursor-pointer transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-background/80 border border-border/50 pointer-events-none">
            Ctrl+K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleOpenPdfDirect}
            title="Open PDF (Ctrl+O)"
            className="flex items-center gap-2 px-3.5 py-1.5 text-[13px] bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-sm transition-opacity font-medium"
          >
            <PlusIcon size={13} />
            Open PDF
          </button>
        </div>
      </div>

      {/* Main Content */}
      {!hasDocuments ? (
        <EmptyState onImport={() => handleOpenPdfDirect()} />
      ) : (
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-10">

            {/* Editorial Greeting Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground font-sans">
                  {getGreeting()}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Pick up right where you left off in your reading workspace.
                </p>
              </div>
            </div>

            {/* Continue Reading Section */}
            {continueInfo && (
              <section className="fade-in">
                <SectionLabel
                  icon={<BookmarkIcon size={12} />}
                  label="Continue reading"
                />
                <button
                  onClick={() => onOpenDoc(continueInfo.doc)}
                  className="group premium-card mt-3 flex w-full flex-col sm:flex-row items-center gap-6 rounded-2xl border border-border/70 bg-card p-5 text-left shadow-xs hover:border-primary/40 hover:shadow-md transition-all duration-200"
                >
                  {/* Framed Folio Document Preview */}
                  <div className="shrink-0 rounded-xl border border-border/70 bg-secondary/60 p-2.5">
                    <div className="relative flex items-center justify-center rounded-sm bg-white shadow-[0_4px_16px_rgba(0,0,0,0.22)] pointer-events-none overflow-hidden border border-black/10">
                      <PageThumbnail
                        docId={continueInfo.doc.id}
                        path={continueInfo.doc.path}
                        index={Math.max(0, continueInfo.page - 1)}
                        maxWidth={140}
                        maxHeight={188}
                        hideLabel
                        onClick={() => {}}
                      />
                    </div>
                  </div>

                  {/* Document Reading Details */}
                  <div className="min-w-0 flex-1 py-1 w-full sm:w-auto">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border/60 mb-2">
                      <ClockIcon size={10} />
                      Last read {formatLastOpened(continueInfo.doc.lastOpened).toLowerCase()}
                    </div>
                    <h3 className="truncate text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors" title={continueInfo.doc.name}>
                      {continueInfo.doc.name.replace(/\s+\.pdf$/i, ".pdf")}
                    </h3>
                    <p className="mt-1 text-[12px] text-muted-foreground font-mono tabular-nums">
                      Page {continueInfo.page} of {continueInfo.doc.pages}
                      <span className="opacity-30 px-2">·</span>
                      {formatFileSize(continueInfo.doc.size)}
                    </p>

                    {/* Progress Bar & Percentage Pill */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 max-w-xs overflow-hidden rounded-full bg-secondary border border-border/50">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                          style={{
                            width: `${Math.max(2, Math.min(100, Math.round((continueInfo.page / Math.max(1, continueInfo.doc.pages)) * 100)))}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
                        {Math.min(
                          100,
                          Math.round(
                            (continueInfo.page /
                              Math.max(1, continueInfo.doc.pages)) *
                              100,
                          ),
                        )}
                        % completed
                      </span>
                    </div>
                  </div>

                  <div className="sm:mr-2 flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-xs transition-all duration-200 group-hover:opacity-90">
                    Resume Reading
                    <ChevronRightIcon
                      size={13}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </div>
                </button>
              </section>
            )}

            {/* Recently Opened Grid */}
            <section className="fade-in">
              <SectionLabel
                icon={<ClockIcon size={12} />}
                label="Recently opened"
                action={{
                  label: "View all in Library",
                  onClick: () => onNavigate("library"),
                }}
              />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recents.map((doc, idx) => (
                  <div
                    key={doc.id}
                    className="stagger-rise"
                    style={{ animationDelay: `${Math.min(idx * 45, 180)}ms` }}
                  >
                    <HomeDocCard
                      doc={doc}
                      onOpen={() => onOpenDoc(doc)}
                      isActive={continueInfo?.doc.id === doc.id}
                      pageIndex={
                        continueInfo?.doc.id === doc.id
                          ? Math.max(0, continueInfo.page - 1)
                          : 0
                      }
                      menuOpen={menuDocId === `recent-${doc.id}`}
                      onToggleMenu={() =>
                        setMenuDocId((cur) =>
                          cur === `recent-${doc.id}`
                            ? null
                            : `recent-${doc.id}`,
                        )
                      }
                      onToggleFavorite={() =>
                        saveDocument({
                          ...doc,
                          favorite: !doc.favorite,
                          inLibrary: true,
                        })
                      }
                      onAddToLibrary={
                        doc.inLibrary === false
                          ? async () => {
                              await addDocumentToLibrary(doc.id)
                              onNotice?.(`Added "${doc.name}" to Library`)
                            }
                          : undefined
                      }
                      onDelete={
                        onDeleteDocument
                          ? () => onDeleteDocument(doc.id)
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Starred Favorites Section */}
            {pinned.length > 0 && (
              <section className="fade-in">
                <SectionLabel
                  icon={<StarIcon size={12} />}
                  label="Favorites"
                  action={{
                    label: "View all favorites",
                    onClick: () => onNavigate("library"),
                  }}
                />
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {pinned.slice(0, 4).map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="stagger-rise"
                      style={{ animationDelay: `${Math.min(idx * 45, 180)}ms` }}
                    >
                      <HomeDocCard
                        doc={doc}
                        onOpen={() => onOpenDoc(doc)}
                        isActive={continueInfo?.doc.id === doc.id}
                        pageIndex={
                          continueInfo?.doc.id === doc.id
                            ? Math.max(0, continueInfo.page - 1)
                            : 0
                        }
                        menuOpen={menuDocId === `fav-${doc.id}`}
                        onToggleMenu={() =>
                          setMenuDocId((cur) =>
                            cur === `fav-${doc.id}` ? null : `fav-${doc.id}`,
                          )
                        }
                        onToggleFavorite={() =>
                          saveDocument({ ...doc, favorite: !doc.favorite })
                        }
                        onDelete={
                          onDeleteDocument
                            ? () => onDeleteDocument(doc.id)
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reading Library Overview / Activity Cards */}
            <section className="pt-4 border-t border-border/50">
              <SectionLabel
                icon={<FileTextIcon size={12} />}
                label="Library at a glance"
              />
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <FileTextIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-foreground font-mono tabular-nums">
                      {documents.length}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      Documents
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <BookmarkIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-foreground font-mono tabular-nums">
                      {totalPages}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      Total Pages
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <StarIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-foreground font-mono tabular-nums">
                      {pinned.length}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      Favorites
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <FolderIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-foreground font-mono tabular-nums">
                      {folders.length}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      Folders
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground/80 px-1 font-mono">
                <span>Quick Tip: Press Ctrl+O to open any local PDF directly</span>
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({
  label,
  icon,
  action,
}: {
  label: string
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          className="ml-auto flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          {action.label}
          <ChevronRightIcon size={11} />
        </button>
      )}
    </div>
  )
}

function HomeDocCard({
  doc,
  onOpen,
  isActive,
  pageIndex = 0,
  menuOpen,
  onToggleMenu,
  onToggleFavorite,
  onAddToLibrary,
  onDelete,
}: {
  doc: Doc
  onOpen: () => void
  isActive?: boolean
  pageIndex?: number
  menuOpen?: boolean
  onToggleMenu: () => void
  onToggleFavorite: () => void
  onAddToLibrary?: () => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const cleanName = doc.name.replace(/\s+\.pdf$/i, ".pdf")

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleMenu()
      }}
      className={`group premium-card relative rounded-2xl border bg-card text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        isActive ? "border-primary/60 shadow-md ring-1 ring-primary/20" : "border-border/70 hover:border-primary/40"
      }`}
    >
      <button
        onClick={onOpen}
        className="w-full text-left outline-none rounded-2xl overflow-hidden block"
      >
        {/* Optimized Folio Thumbnail Stage */}
        <div className="relative flex h-56 w-full items-center justify-center border-b border-border/50 bg-secondary/30 overflow-hidden">
          <div className="flex items-center justify-center transition-all duration-300 group-hover:scale-[1.03] pointer-events-none p-3.5">
            <div className="relative rounded-sm bg-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] border border-black/10 overflow-hidden">
              <PageThumbnail
                docId={doc.id}
                path={doc.path}
                index={pageIndex}
                maxWidth={160}
                maxHeight={184}
                hideLabel
                onClick={() => {}}
              />
            </div>
          </div>
        </div>

        {/* Metadata Information Area */}
        <div className="relative p-4">
          <p className="truncate text-[14px] font-semibold text-foreground transition-colors group-hover:text-primary" title={cleanName}>
            {cleanName}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono tabular-nums">
            <span>{doc.pages} pages</span>
            <span className="opacity-30">·</span>
            <span>{formatFileSize(doc.size)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/75">
            {formatLastOpened(doc.lastOpened)}
          </p>
        </div>
      </button>

      {/* Options Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleMenu()
        }}
        className="absolute right-3 top-3 p-1.5 rounded-lg text-muted-foreground bg-background/80 backdrop-blur-md border border-border/60 transition-all hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100"
        title="Document options"
      >
        <MoreHorizontalIcon size={14} />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          className="absolute right-3 top-11 w-48 bg-card border border-border shadow-2xl rounded-xl py-1.5 z-50 fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {onAddToLibrary && (
            <button
              onClick={() => {
                onToggleMenu()
                void onAddToLibrary()
              }}
              className="w-full text-left px-3.5 py-2 text-xs hover:bg-muted transition-colors text-primary font-medium"
            >
              Add to Library
            </button>
          )}
          <button
            onClick={() => {
              onToggleFavorite()
              onToggleMenu()
            }}
            className="w-full text-left px-3.5 py-2 text-xs hover:bg-muted transition-colors text-foreground flex items-center justify-between"
          >
            <span>{doc.favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
            <StarIcon size={12} filled={doc.favorite} className={doc.favorite ? "text-amber-400" : ""} />
          </button>
          {onDelete && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  onToggleMenu()
                  void onDelete()
                }}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-red-500/10 text-red-500 transition-colors"
              >
                Remove from Library
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center select-none">
      <div className="w-16 h-16 flex items-center justify-center hover:scale-105 transition-transform duration-300">
        <AuraLogo size={56} />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          Welcome to AuraPDF
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Open any PDF file or drag and drop documents directly onto this window to start reading with zero friction.
        </p>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 shadow-md transition-all active:scale-[0.98]"
        >
          <FileTextIcon size={14} />
          Open PDF Document
        </button>
      </div>
    </div>
  )
}
