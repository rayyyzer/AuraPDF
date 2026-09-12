import { useState } from 'react';
import type { Doc } from '../types';
import { DOCUMENTS } from '../data';
import { SearchIcon, FileTextIcon, ClockIcon, XIcon, ChevronRightIcon } from '../icons';

interface Props {
  docs: Doc[];
  onOpenDoc: (doc: Doc) => void;
}

const RECENT_SEARCHES = ['financial report', 'GDPR compliance', 'roadmap 2025', 'free cash flow'];

export default function SearchView({ docs, onOpenDoc }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = query.trim().length > 1
    ? docs.filter((d) =>
        d.name.toLowerCase().includes(query.toLowerCase()) ||
        d.excerpt.toLowerCase().includes(query.toLowerCase()) ||
        d.tags.some((t) => t.includes(query.toLowerCase()))
      )
    : [];

  function highlight(text: string, q: string): React.ReactNode {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-primary rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Search</h1>
          <div className="relative">
            <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Search documents, content, tags..."
              className="w-full pl-11 pr-10 py-3.5 text-base bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors shadow-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-2xl mx-auto">
        {!query.trim() ? (
          /* Empty / recent state */
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <ClockIcon size={11} />
                Recent searches
              </h2>
              <div className="space-y-1">
                {RECENT_SEARCHES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <ClockIcon size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{s}</span>
                    <ChevronRightIcon size={13} className="text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All documents</h2>
              <div className="space-y-1">
                {DOCUMENTS.slice(0, 5).map((doc) => (
                  <DocResult key={doc.id} doc={doc} query="" onOpen={() => onOpenDoc(doc)} />
                ))}
              </div>
            </section>
          </div>
        ) : results.length > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;<strong className="text-foreground">{query}</strong>&rdquo;
            </p>
            <div className="space-y-1">
              {results.map((doc) => (
                <DocResult key={doc.id} doc={doc} query={query} onOpen={() => onOpenDoc(doc)} highlight={highlight} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <SearchIcon size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No results</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nothing matched &ldquo;{query}&rdquo; — try different keywords
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DocResult({
  doc,
  query,
  onOpen,
  highlight,
}: {
  doc: Doc;
  query: string;
  onOpen: () => void;
  highlight?: (text: string, q: string) => React.ReactNode;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex items-start gap-3 w-full px-4 py-3.5 rounded-xl border border-transparent hover:border-border hover:bg-card transition-all text-left group"
    >
      <div
        className="w-9 h-11 rounded-md flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${doc.color}18` }}
      >
        <FileTextIcon size={15} style={{ color: doc.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {highlight ? highlight(doc.name, query) : doc.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {highlight ? highlight(doc.excerpt, query) : doc.excerpt}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-muted-foreground font-mono">{doc.pages} pages</span>
          <span className="text-[10px] text-muted-foreground">{doc.folder}</span>
          <span className="text-[10px] text-muted-foreground">{doc.lastOpened}</span>
        </div>
      </div>
      <ChevronRightIcon size={13} className="text-muted-foreground mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
