import { useState } from "react"
import type { Doc } from "../../types"

import { useAppStore } from "../../stores/useAppStore"
import { useShallow } from "zustand/react/shallow"
import { openLocalPdfs } from "../../services/tauri"
import {
  formatPdfImportFailure,
  importPdfFiles,
} from "../../services/pdf/import"
import FolderDialog from "./FolderDialog"
import { formatFileSize, formatLastOpened } from "../../utils/documentMetadata"
import {
  SearchIcon,
  GridIcon,
  ListIcon,
  SortIcon,
  StarIcon,
  MoreHorizontalIcon,
  FolderIcon,
  FileTextIcon,
  PlusIcon,
  ClockIcon,
  ArrowLeftIcon,
  XIcon,
  TrashIcon,
  ChevronDownIcon,
} from "../../icons"
import { PageThumbnail } from "../reader/PageThumbnail"

interface Props {
  onOpenDoc: (doc: Doc) => void
  filter?: "all" | "recent" | "favorites" | string
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  onNewFolder: () => void
  onOpenFolder: (id: string) => void
  onDeleteDocument: (id: string) => Promise<void>
}

export default function Library({
  onOpenDoc,
  filter = "all",
  selectedIds,
  onToggleSelected,
  onNewFolder,
  onOpenFolder,
  onDeleteDocument,
}: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date")
  const [showSort, setShowSort] = useState(false)
  const [contextDoc, setContextDoc] = useState<string | null>(null)
  const [renameFolder, setRenameFolder] = useState<{
    id: string
    name: string
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [batchMoveFolderOpen, setBatchMoveFolderOpen] = useState(false)

  const {
    documents,
    folders,
    confirmBeforeDeleting,
    saveDocument,
    saveDocuments,
    setDocumentFolder,
    setDocumentsFolder,
    renameFolder: renameFolderAction,
    deleteFolder,
    setDocumentsFavorite,
  } = useAppStore(
    useShallow((state) => ({
      documents: state.documents,
      folders: state.folders,
      confirmBeforeDeleting: state.confirmBeforeDeleting,
      saveDocument: state.saveDocument,
      saveDocuments: state.saveDocuments,
      setDocumentFolder: state.setDocumentFolder,
      setDocumentsFolder: state.setDocumentsFolder,
      renameFolder: state.renameFolder,
      deleteFolder: state.deleteFolder,
      setDocumentsFavorite: state.setDocumentsFavorite,
    })),
  )

  const currentFolder = folders.find((folder) => folder.id === filter)

  async function handleImportPdf() {
    try {
      setImportMessage(null)
      setImporting(true)
      const selected = await openLocalPdfs()
      if (selected.length === 0) return

      if (currentFolder) {
        // Adding into a specific folder
        const result = await importPdfFiles(selected, documents, {
          folderId: currentFolder.id,
          folderName: currentFolder.name,
        })
        for (const file of result.skipped) {
          const existing = documents.find(
            (doc) => (doc.path || doc.id) === file.path,
          )
          if (existing && existing.folderId !== currentFolder.id) {
            await setDocumentFolder(existing.id, currentFolder.id)
          }
        }
        if (result.imported.length > 0) await saveDocuments(result.imported)
        const total = result.imported.length + result.skipped.length
        const failureDetails = result.failures[0]
          ? ` · ${formatPdfImportFailure(result.failures[0].error)}`
          : ""
        setImportMessage(
          `Added ${total} PDF${total === 1 ? "" : "s"} to ${currentFolder.name}${
            result.failures.length ? ` · ${result.failures.length} failed${failureDetails}` : ""
          }`,
        )
        return
      }

      if (filter === "favorites") {
        // Adding to Favorites directly
        const result = await importPdfFiles(selected, documents, {
          favorite: true,
        })
        for (const file of result.skipped) {
          const existing = documents.find(
            (doc) => (doc.path || doc.id) === file.path,
          )
          if (existing && !existing.favorite) {
            await saveDocument({ ...existing, favorite: true })
          }
        }
        if (result.imported.length > 0) await saveDocuments(result.imported)
        const total = result.imported.length + result.skipped.length
        const failureDetails = result.failures[0]
          ? ` · ${formatPdfImportFailure(result.failures[0].error)}`
          : ""
        setImportMessage(
          `Added ${total} PDF${total === 1 ? "" : "s"} to Favorites${
            result.failures.length ? ` · ${result.failures.length} failed${failureDetails}` : ""
          }`,
        )
        return
      }

      // Default: Add to Library
      const result = await importPdfFiles(selected, documents)
      if (result.imported.length > 0) await saveDocuments(result.imported)
      const failureDetails = result.failures[0]
        ? ` · ${formatPdfImportFailure(result.failures[0].error)}`
        : ""
      setImportMessage(
        `Added ${result.imported.length} PDF${
          result.imported.length === 1 ? "" : "s"
        } to Library${
          result.failures.length ? ` · ${result.failures.length} failed${failureDetails}` : ""
        }`,
      )
    } catch (e: any) {
      console.error("Failed to import PDF", e)
      const errorMsg = import.meta.env.DEV
        ? ` (Dev: ${e?.message || String(e)})`
        : ""
      setImportMessage(`PDF could not be imported.${errorMsg}`)
    } finally {
      setImporting(false)
    }
  }

  const query = search.trim().toLowerCase()

  // Multi-attribute search and category filtering
  const filtered = documents
    .filter((d) => {
      // Don't show direct opens that aren't in library unless search is active
      if (d.inLibrary === false && !query) return false

      const matchSearch =
        !query ||
        d.name.toLowerCase().includes(query) ||
        (d.path && d.path.toLowerCase().includes(query)) ||
        (d.excerpt && d.excerpt.toLowerCase().includes(query)) ||
        (d.tags && d.tags.some((t) => t.toLowerCase().includes(query))) ||
        (d.folder && d.folder.toLowerCase().includes(query)) ||
        (d.folderId &&
          folders.find((f) => f.id === d.folderId)?.name.toLowerCase().includes(query))

      if (!matchSearch) return false

      if (filter === "favorites") return d.favorite
      if (filter === "recent") return true
      if (filter === "__unfiled__") return !d.folderId
      if (filter !== "all" && filter !== "__folders__") {
        return d.folderId === filter
      }

      return true
    })
    .sort((a, b) => {
      if (filter === "recent" || sortBy === "date") {
        return (
          new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
        )
      }
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "size") return parseFloat(b.size) - parseFloat(a.size)
      return 0
    })

  return (
    <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden relative">
      {/* Contextual Header & Breadcrumb */}
      {/* One row, one search, one primary action. The previous two-row header repeated the
          search field and the primary button, and left half of the second row empty. */}
      <div className="shrink-0 bg-background/90 backdrop-blur-sm border-b border-border/40 px-6 py-3">
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentFolder && (
              <button
                onClick={() => onOpenFolder("__folders__")}
                title="Back to all folders"
                className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors group cursor-pointer shrink-0"
              >
                <ArrowLeftIcon size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              {filter === "favorites" ? (
                <StarIcon size={20} className="text-amber-400 shrink-0" filled />
              ) : currentFolder || filter === "__folders__" ? (
                <FolderIcon size={20} className="text-primary shrink-0" />
              ) : filter === "recent" ? (
                <ClockIcon size={20} className="text-primary shrink-0" />
              ) : (
                <FileTextIcon size={20} className="text-primary shrink-0" />
              )}
              <h1 className="text-[15px] font-semibold text-foreground tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {currentFolder
                  ? currentFolder.name
                  : filter === "favorites"
                    ? "Favorites"
                    : filter === "recent"
                      ? "Recent Documents"
                      : filter === "__folders__"
                        ? "Folders"
                        : "All Documents"}
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground tabular-nums whitespace-nowrap">
                {filter === "__folders__"
                  ? `${folders.length} folder${folders.length === 1 ? "" : "s"}`
                  : `${filtered.length} document${filtered.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

          {/* Primary action sits at the far right; flex order keeps the JSX readable. */}
          <div className="order-3 flex items-center gap-2">
            {importMessage && (
              <span className="text-[11px] text-primary font-medium">
                {importMessage}
              </span>
            )}
            {filter === "__folders__" && (
              <button
                onClick={onNewFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors border border-border/60 cursor-pointer"
              >
                <PlusIcon size={12} />
                New Folder
              </button>
            )}
            <button
              onClick={handleImportPdf}
              disabled={importing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              {filter === "favorites" ? (
                <StarIcon size={12} filled />
              ) : (
                <PlusIcon size={12} />
              )}
              {importing
                ? "Adding..."
                : currentFolder
                  ? `Add to ${currentFolder.name}`
                  : filter === "favorites"
                    ? "Add to Favorites"
                    : "Add PDF"}
            </button>
          </div>

          {/* Search, sort and view controls share the same row. Collection switching lives
              in the sidebar only. */}
          <div className="order-2 ml-auto flex items-center gap-2">
            {/* Multi-attribute search box */}
            <div className="relative w-52 sm:w-64">
              <SearchIcon
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  currentFolder
                    ? `Search in ${currentFolder.name}...`
                    : filter === "favorites"
                      ? "Search in Favorites..."
                      : "Search title, tags, or text..."
                }
                className="w-full pl-8 pr-7 py-1 text-xs bg-card rounded-lg border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <XIcon size={11} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted bg-card rounded-lg border border-border transition-colors cursor-pointer"
              >
                <SortIcon size={11} />
                {sortBy === "date" ? "Recent" : sortBy === "name" ? "Title" : "Size"}
                <ChevronDownIcon size={10} />
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-30 py-1 fade-in">
                  {(["date", "name", "size"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSortBy(s)
                        setShowSort(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs capitalize transition-colors cursor-pointer ${
                        sortBy === s
                          ? "text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {s === "date"
                        ? "Last opened"
                        : s === "name"
                          ? "Title (A–Z)"
                          : "File size"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-card rounded-lg border border-border overflow-hidden p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                title="Grid view"
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GridIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                title="List view"
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListIcon size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto p-6 sm:p-8"
        onClick={() => {
          setContextDoc(null)
          setShowSort(false)
          setBatchMoveFolderOpen(false)
        }}
      >
        {filter === "__folders__" ? (
          <FolderOverview
            folders={folders}
            documents={documents}
            searchQuery={search}
            onOpenFolder={onOpenFolder}
            onRename={setRenameFolder}
            onDelete={async (id, name) => {
              if (
                confirmBeforeDeleting &&
                !window.confirm(
                  `Delete folder "${name}"? Documents inside will become unfiled.`,
                )
              )
                return
              await deleteFolder(id, name)
            }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            search={search}
            filter={filter}
            currentFolder={currentFolder}
            onClearSearch={() => setSearch("")}
            onImport={handleImportPdf}
          />
        ) : viewMode === "grid" ? (
          <div
            key="library-grid"
            className="app-content-width grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 view-enter"
          >
            {filtered.map((doc, idx) => (
              <div
                key={doc.id}
                className="stagger-rise"
                style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
              >
                <DocCard
                  doc={doc}
                  selected={selectedIds.has(doc.id)}
                  showContext={contextDoc === doc.id}
                  onOpen={() => onOpenDoc(doc)}
                  onSelect={() => onToggleSelected(doc.id)}
                  onContext={(e) => {
                    e.stopPropagation()
                    setContextDoc(doc.id)
                  }}
                  onDeleteDocument={onDeleteDocument}
                  onToggleFavorite={() =>
                    saveDocument({ ...doc, favorite: !doc.favorite })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div key="library-list" className="space-y-1 view-enter">
            <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-2">
              <span className="w-4 shrink-0" />
              <span className="w-6 shrink-0 text-center">Fav</span>
              <span className="flex-1 min-w-0">Name</span>
              <span className="w-32 shrink-0 text-right">Size & Pages</span>
              <span className="w-28 shrink-0 text-right">Opened</span>
              <span className="w-8 shrink-0" />
            </div>
            {filtered.map((doc) => (
              <DocListRow
                key={doc.id}
                doc={doc}
                selected={selectedIds.has(doc.id)}
                showContext={contextDoc === doc.id}
                onOpen={() => onOpenDoc(doc)}
                onSelect={() => onToggleSelected(doc.id)}
                onContext={(e) => {
                  e.stopPropagation()
                  setContextDoc(doc.id)
                }}
                onDeleteDocument={onDeleteDocument}
                onToggleFavorite={() =>
                  saveDocument({ ...doc, favorite: !doc.favorite })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Batch Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-2xl px-5 py-2.5 flex items-center gap-3.5 z-50 fade-in text-sm text-foreground">
          <span className="font-semibold text-primary flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border/60" />

          {/* Star All */}
          <button
            onClick={async () => {
              await setDocumentsFavorite(Array.from(selectedIds), true)
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-400 transition-colors cursor-pointer"
          >
            <StarIcon size={12} filled />
            Star
          </button>

          {/* Unstar All */}
          <button
            onClick={async () => {
              await setDocumentsFavorite(Array.from(selectedIds), false)
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <StarIcon size={12} />
            Unstar
          </button>

          {/* Move to Folder */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setBatchMoveFolderOpen(!batchMoveFolderOpen)
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <FolderIcon size={12} />
              Move to...
              <ChevronDownIcon size={10} />
            </button>
            {batchMoveFolderOpen && (
              <div
                className="absolute bottom-full mb-2 left-0 w-44 bg-card border border-border shadow-xl rounded-lg py-1 z-50 fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={async () => {
                    await setDocumentsFolder(Array.from(selectedIds), null)
                    setBatchMoveFolderOpen(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  (Remove from folder)
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={async () => {
                      await setDocumentsFolder(Array.from(selectedIds), f.id)
                      setBatchMoveFolderOpen(false)
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-foreground cursor-pointer"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete All */}
          <button
            onClick={async () => {
              if (
                confirmBeforeDeleting &&
                !window.confirm(
                  `Delete ${selectedIds.size} document(s) from your library?`,
                )
              )
                return
              for (const id of selectedIds) {
                await onDeleteDocument(id)
              }
            }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            <TrashIcon size={12} />
            Delete
          </button>

          <div className="h-4 w-px bg-border/60" />

          {/* Deselect All */}
          <button
            onClick={() => {
              selectedIds.forEach((id) => onToggleSelected(id))
            }}
            className="text-xs text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            title="Clear selection"
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      {renameFolder && (
        <FolderDialog
          title="Rename folder"
          initialName={renameFolder.name}
          submitLabel="Rename"
          onCancel={() => setRenameFolder(null)}
          onSubmit={async (name) => {
            await renameFolderAction(renameFolder.id, name, renameFolder.name)
            setRenameFolder(null)
          }}
        />
      )}
    </div>
  )
}

function FolderOverview({
  folders,
  documents,
  searchQuery,
  onOpenFolder,
  onRename,
  onDelete,
}: {
  folders: { id: string; name: string }[]
  documents: Doc[]
  searchQuery?: string
  onOpenFolder: (id: string) => void
  onRename: (folder: { id: string; name: string }) => void
  onDelete: (id: string, name: string) => Promise<void>
}) {
  const query = (searchQuery || "").trim().toLowerCase()
  const visibleFolders = query
    ? folders.filter((f) => f.name.toLowerCase().includes(query))
    : folders

  return (
    <div>
      {/* The page header already carries the title, count and the single "New Folder" action. */}
      <div className="mb-4" />

      <div className="app-content-width grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleFolders.map((folder) => {
          const count = documents.filter(
            (doc) => doc.inLibrary !== false && doc.folderId === folder.id,
          ).length
          return (
            <div
              key={folder.id}
              onClick={() => onOpenFolder(folder.id)}
              className="premium-card interactive-lift cursor-pointer rounded-xl border border-border bg-card p-4 hover:border-primary/40 group"
            >
              <div className="flex items-start justify-between">
                <FolderIcon size={20} className="text-primary group-hover:scale-105 transition-transform" />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRename(folder)
                    }}
                    className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDelete(folder.id, folder.name)
                    }}
                    className="rounded px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-4 truncate text-[15px] font-medium text-foreground">
                {folder.name}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {count} document{count === 1 ? "" : "s"}
              </p>
            </div>
          )
        })}
      </div>

      {visibleFolders.length === 0 && (
        <div className="mt-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {query ? `No folders matching "${query}"` : "No folders created yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {query ? "Try a different search term" : "Click 'New Folder' to create your first collection"}
          </p>
        </div>
      )}
    </div>
  )
}

function DocCard({
  doc,
  selected,
  showContext,
  onOpen,
  onSelect,
  onContext,
  onDeleteDocument,
  onToggleFavorite,
}: {
  doc: Doc
  selected: boolean
  showContext: boolean
  onOpen: () => void
  onSelect: () => void
  onContext: (e: React.MouseEvent) => void
  onDeleteDocument: (id: string) => Promise<void>
  onToggleFavorite: () => void
}) {
  return (
    <div
      className={`premium-card relative group rounded-xl border cursor-pointer interactive-lift transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-primary/40 hover:shadow-md"
      } bg-card overflow-hidden`}
    >
      {/* Thumbnail */}
      <div
        className="h-44 flex items-center justify-center relative bg-secondary/60 border-b border-border/40"
        onClick={onOpen}
      >
        <div className="pointer-events-none p-1.5 shadow-sm bg-white rounded-md">
          <PageThumbnail
            docId={doc.id}
            index={0}
            path={doc.path}
            maxWidth={112}
            maxHeight={130}
            hideLabel
            onClick={() => {}}
          />
        </div>

        {/* Select checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${doc.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-md border transition-all cursor-pointer ${
            selected
              ? "bg-primary border-primary opacity-100"
              : "bg-card/90 backdrop-blur-xs border-border opacity-0 group-hover:opacity-100"
          }`}
        >
          {selected && (
            <span className="text-primary-foreground text-[10px] flex items-center justify-center font-bold">
              ✓
            </span>
          )}
        </button>

        {/* Favorite */}
        <button
          type="button"
          aria-label={
            doc.favorite ? `Remove ${doc.name} from favorites` : `Add ${doc.name} to favorites`
          }
          title={doc.favorite ? "Favorited" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={`absolute top-2.5 right-2.5 p-1 rounded-md transition-all cursor-pointer ${
            doc.favorite
              ? "opacity-100 text-amber-400"
              : "opacity-0 group-hover:opacity-100 bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-amber-400"
          }`}
        >
          <StarIcon size={13} filled={doc.favorite} />
        </button>

        <button
          type="button"
          aria-label={`Options for ${doc.name}`}
          onClick={onContext}
          className="absolute top-2.5 right-9 p-1 rounded-md opacity-0 group-hover:opacity-100 bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <MoreHorizontalIcon size={14} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3.5" onClick={onOpen}>
        <p className="text-sm font-medium text-foreground truncate" title={doc.name}>
          {doc.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono tabular-nums">
          {doc.pages} pages · {formatFileSize(doc.size)}
        </p>
        <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
          <span>{formatLastOpened(doc.lastOpened)}</span>
          {doc.folder && (
            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] truncate max-w-[100px]">
              {doc.folder}
            </span>
          )}
        </div>
      </div>

      {showContext && (
        <DocContextMenu doc={doc} onDeleteDocument={onDeleteDocument} />
      )}
    </div>
  )
}

function DocListRow({
  doc,
  selected,
  showContext,
  onOpen,
  onSelect,
  onContext,
  onDeleteDocument,
  onToggleFavorite,
}: {
  doc: Doc
  selected: boolean
  showContext: boolean
  onOpen: () => void
  onSelect: () => void
  onContext: (e: React.MouseEvent) => void
  onDeleteDocument: (id: string) => Promise<void>
  onToggleFavorite: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-transparent transition-all duration-150 cursor-pointer ${
        selected
          ? "bg-primary/8 border-primary/20"
          : "hover:bg-muted/60 hover:border-border/40"
      }`}
      onClick={onOpen}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${doc.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className={`w-4 h-4 rounded border shrink-0 transition-colors flex items-center justify-center text-[10px] cursor-pointer ${
          selected
            ? "bg-primary border-primary text-primary-foreground font-bold"
            : "border-border hover:border-primary/60 bg-card"
        }`}
      >
        {selected ? "✓" : ""}
      </button>

      {/* Favorite Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        aria-label={
          doc.favorite
            ? `Remove ${doc.name} from favorites`
            : `Add ${doc.name} to favorites`
        }
        title={doc.favorite ? "Favorited" : "Favorite"}
        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          doc.favorite
            ? "text-amber-400 opacity-100"
            : "text-muted-foreground/40 hover:text-amber-400 opacity-0 group-hover:opacity-100"
        }`}
      >
        <StarIcon size={13} filled={doc.favorite} />
      </button>

      {/* Micro-Thumbnail & Title */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="pointer-events-none shrink-0 w-6 h-8 rounded-sm bg-white shadow-xs border border-black/10 flex items-center justify-center overflow-hidden">
          <PageThumbnail
            docId={doc.id}
            index={0}
            path={doc.path}
            maxWidth={24}
            maxHeight={32}
            hideLabel
            onClick={() => {}}
          />
        </div>
        <div className="min-w-0">
          <span
            className="text-sm font-medium text-foreground truncate block"
            title={doc.name}
          >
            {doc.name}
          </span>
          {doc.folder && (
            <span className="text-[10px] text-muted-foreground font-medium">
              📁 {doc.folder}
            </span>
          )}
        </div>
      </div>

      {/* Size & Pages Tag */}
      <span className="w-32 shrink-0 text-right text-xs text-muted-foreground font-mono tabular-nums">
        {doc.pages}p · {formatFileSize(doc.size)}
      </span>

      {/* Date */}
      <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
        {formatLastOpened(doc.lastOpened)}
      </span>

      {/* Actions */}
      <div className="w-8 shrink-0 flex items-center justify-end relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onContext(e)
          }}
          aria-label={`Options for ${doc.name}`}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <MoreHorizontalIcon size={14} />
        </button>
        {showContext && (
          <DocContextMenu doc={doc} onDeleteDocument={onDeleteDocument} />
        )}
      </div>
    </div>
  )
}

function EmptyState({
  search,
  filter,
  currentFolder,
  onClearSearch,
  onImport,
}: {
  search: string
  filter: string
  currentFolder?: { id: string; name: string }
  onClearSearch: () => void
  onImport: () => void
}) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center fade-in">
        <div className="w-12 h-12 rounded-2xl bg-muted/80 flex items-center justify-center mb-3">
          <SearchIcon size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          No documents matching "{search}"
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Try searching with different keywords, check for typos, or reset the filter.
        </p>
        <button
          onClick={onClearSearch}
          className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors cursor-pointer border border-border"
        >
          Clear search filter
        </button>
      </div>
    )
  }

  if (filter === "favorites") {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center fade-in">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-3 text-amber-400">
          <StarIcon size={22} filled />
        </div>
        <p className="text-sm font-semibold text-foreground">No favorites yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Star any PDF in your library to pin it here, or import a document directly into favorites.
        </p>
        <button
          onClick={onImport}
          className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm cursor-pointer"
        >
          <StarIcon size={12} filled />
          Add to Favorites
        </button>
      </div>
    )
  }

  if (currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center fade-in">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 text-primary">
          <FolderIcon size={22} />
        </div>
        <p className="text-sm font-semibold text-foreground">
          "{currentFolder.name}" is empty
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Add PDFs directly to this folder, or select documents in your library and move them here.
        </p>
        <button
          onClick={onImport}
          className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm cursor-pointer"
        >
          <PlusIcon size={12} />
          Add PDF to Folder
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-72 text-center fade-in">
      <div className="w-12 h-12 rounded-2xl bg-muted/80 flex items-center justify-center mb-3">
        <FileTextIcon size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">Your library is empty</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Add PDFs to your library to read, annotate, search, and organize them into collections.
      </p>
      <button
        onClick={onImport}
        className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm cursor-pointer"
      >
        <PlusIcon size={12} />
        Add PDF
      </button>
    </div>
  )
}

function DocContextMenu({
  doc,
  onDeleteDocument,
}: {
  doc: Doc
  onDeleteDocument: (id: string) => Promise<void>
}) {
  const { folders, setDocumentFolder } = useAppStore(
    useShallow((state) => ({
      folders: state.folders,
      setDocumentFolder: state.setDocumentFolder,
    })),
  )

  return (
    <div
      className="absolute right-0 top-full mt-1 w-48 bg-card border border-border shadow-xl rounded-lg py-1 z-50 fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
        Move to folder
      </p>
      {folders.length === 0 && (
        <p className="px-3 py-1 text-xs text-muted-foreground">No folders</p>
      )}
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => setDocumentFolder(doc.id, f.id)}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center justify-between cursor-pointer"
        >
          <span>{f.name}</span>
          {doc.folderId === f.id && (
            <span className="text-primary text-[10px]">✓</span>
          )}
        </button>
      ))}
      {doc.folderId && (
        <button
          onClick={() => setDocumentFolder(doc.id, null)}
          className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted border-t border-border mt-1 cursor-pointer"
        >
          Remove from folder
        </button>
      )}
      <div className="border-t border-border mt-1 pt-1">
        <button
          onClick={async () => {
            await onDeleteDocument(doc.id)
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
        >
          Delete from Library
        </button>
      </div>
    </div>
  )
}
