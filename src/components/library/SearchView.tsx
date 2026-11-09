import { useState } from "react"

import type { Doc } from "../../types"

import { SearchIcon, ClockIcon, XIcon, ChevronRightIcon } from "../../icons"
import { PageThumbnail } from "../reader/PageThumbnail"
import { formatFileSize, formatLastOpened } from "../../utils/documentMetadata"

interface Props {
  docs: Doc[]
  onOpenDoc: (doc: Doc) => void
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
}

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem("aura:recentSearches")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === "string")
      : []
  } catch {
    return []
  }
}

function saveRecentSearch(q: string): string[] {
  const trimmed = q.trim()
  if (!trimmed) return loadRecentSearches()
  const existing = loadRecentSearches().filter(
    (s) => s.toLowerCase() !== trimmed.toLowerCase(),
  )
  const next = [trimmed, ...existing].slice(0, 6)
  try {
    localStorage.setItem("aura:recentSearches", JSON.stringify(next))
  } catch {}
  return next
}

export default function SearchView({
  docs,
  onOpenDoc,
  selectedIds,
  onToggleSelected,
}: Props) {
  const [query, setQuery] = useState("")
  const [recentSearches, setRecentSearches] =
    useState<string[]>(loadRecentSearches)

  const results =
    query.trim().length > 1
      ? docs.filter(
          (d) =>
            d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.excerpt.toLowerCase().includes(query.toLowerCase()) ||
            d.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())),
        )
      : []

  function highlight(text: string, q: string): React.ReactNode {
    if (!q.trim()) return text

    const idx = text.toLowerCase().indexOf(q.toLowerCase())

    if (idx === -1) return text

    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-primary rounded-sm px-0.5">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  function handleOpenResult(doc: Doc) {
    if (query.trim().length > 1) {
      setRecentSearches(saveRecentSearch(query))
    }
    onOpenDoc(doc)
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-6">
        <div className="app-content-width">
          <h1 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Search
          </h1>
          <div className="relative">
            <SearchIcon
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim().length > 1) {
                  setRecentSearches(saveRecentSearch(query))
                }
              }}
              placeholder="Search documents, content, tags..."
              className="w-full pl-11 pr-10 py-3.5 text-base bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search input"
                title="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="app-content-width px-8 py-7">
        {!query.trim() ? (
          /* Empty / recent state */
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent searches
                </p>
                {recentSearches.length > 0 && (
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem("aura:recentSearches")
                      } catch {}
                      setRecentSearches([])
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-4">
                  No recent searches
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:bg-muted transition-colors"
                    >
                      <ClockIcon size={11} className="text-muted-foreground" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                All documents
              </h2>
              <div className="space-y-1">
                {docs.slice(0, 5).map((doc) => (
                  <DocResult
                    key={doc.id}
                    doc={doc}
                    query=""
                    onOpen={() => handleOpenResult(doc)}
                    selected={selectedIds.has(doc.id)}
                    onSelect={() => onToggleSelected(doc.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : results.length > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""} for
              &ldquo;
              <strong className="text-foreground">{query}</strong>&rdquo;
            </p>
            <div className="space-y-1">
              {results.map((doc) => (
                <DocResult
                  key={doc.id}
                  doc={doc}
                  query={query}
                  onOpen={() => handleOpenResult(doc)}
                  highlight={highlight}
                  selected={selectedIds.has(doc.id)}
                  onSelect={() => onToggleSelected(doc.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <SearchIcon size={20} className="text-muted-foreground" />
            </div>
            <p className="text-[16px] font-semibold text-foreground">
              No results
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Nothing matched &ldquo;{query}&rdquo; — try different keywords
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DocResult({
  doc,
  query,
  onOpen,
  highlight,
  selected,
  onSelect,
}: {
  doc: Doc
  query: string
  onOpen: () => void
  highlight?: (text: string, q: string) => React.ReactNode
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="premium-card flex items-start gap-4 w-full px-5 py-4 rounded-xl border border-transparent text-left group cursor-pointer"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${doc.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className={`mt-1 h-4 w-4 shrink-0 rounded border text-[9px] flex items-center justify-center ${
          selected
            ? "border-primary bg-primary text-primary-foreground font-bold"
            : "border-border hover:border-primary/60 bg-card"
        }`}
      >
        {selected ? "✓" : ""}
      </button>
      <div className="pointer-events-none w-9 h-11 shrink-0 mt-0.5 flex items-center justify-center">
        <PageThumbnail
          docId={doc.id}
          index={0}
          path={doc.path}
          maxWidth={36}
          maxHeight={44}
          hideLabel
          onClick={() => {}}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground">
          {highlight ? highlight(doc.name, query) : doc.name}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {highlight ? highlight(doc.excerpt, query) : doc.excerpt}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[13px] text-muted-foreground font-mono">
            {doc.pages} pages · {formatFileSize(doc.size)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {doc.folder}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {formatLastOpened(doc.lastOpened)}
          </span>
        </div>
      </div>
      <ChevronRightIcon
        size={13}
        className="text-muted-foreground mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  )
}
