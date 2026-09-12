import { useState } from 'react';
import type { Doc } from '../types';
import { DOCUMENTS, FOLDERS } from '../data';
import {
  SearchIcon, GridIcon, ListIcon, FilterIcon, SortIcon,
  FileTextIcon, StarIcon, MoreHorizontalIcon, FolderIcon, TrashIcon,
  BookmarkIcon, DownloadIcon, PlusIcon,
} from '../icons';

interface Props {
  onOpenDoc: (doc: Doc) => void;
}

export default function Library({ onOpenDoc }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [showSort, setShowSort] = useState(false);
  const [contextDoc, setContextDoc] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = DOCUMENTS
    .filter((d) => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
      const matchFolder = !activeFolder || d.folder === activeFolder;
      return matchSearch && matchFolder;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return parseFloat(b.size) - parseFloat(a.size);
      return 0;
    });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="h-full flex bg-background">
      {/* Folder sidebar */}
      <aside className="w-44 shrink-0 border-r border-border h-full overflow-y-auto py-4 px-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Folders</p>
        <button
          onClick={() => setActiveFolder(null)}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors ${!activeFolder ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          <FileTextIcon size={13} />
          All documents
        </button>
        {FOLDERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFolder(activeFolder === f ? null : f)}
            className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeFolder === f ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <FolderIcon size={13} />
            {f}
          </button>
        ))}
        <div className="mt-4 border-t border-border pt-4 px-2">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <PlusIcon size={12} />
            New folder
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 bg-card border-b border-border px-4 py-2 flex items-center gap-2.5">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter documents..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-md border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {selected.size > 0 && (
              <div className="flex items-center gap-2 mr-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selected.size} selected</span>
                <button className="hover:text-foreground transition-colors"><TrashIcon size={13} /></button>
                <button className="hover:text-foreground transition-colors"><DownloadIcon size={13} /></button>
              </div>
            )}

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-border transition-colors"
              >
                <SortIcon size={12} />
                Sort: {sortBy}
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-20 py-1 fade-in">
                  {(['name', 'date', 'size'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSortBy(s); setShowSort(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs capitalize transition-colors ${sortBy === s ? 'text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                    >
                      {s === 'date' ? 'Last opened' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-border transition-colors">
              <FilterIcon size={12} />
              Filter
            </button>

            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <GridIcon size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListIcon size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" onClick={() => setContextDoc(null)}>
          {filtered.length === 0 ? (
            <EmptyState search={search} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  selected={selected.has(doc.id)}
                  showContext={contextDoc === doc.id}
                  onOpen={() => onOpenDoc(doc)}
                  onSelect={() => toggleSelect(doc.id)}
                  onContext={(e) => { e.stopPropagation(); setContextDoc(doc.id); }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
                <span className="col-span-5">Name</span>
                <span className="col-span-2">Folder</span>
                <span className="col-span-2">Size</span>
                <span className="col-span-2">Opened</span>
                <span className="col-span-1" />
              </div>
              {filtered.map((doc) => (
                <DocListRow
                  key={doc.id}
                  doc={doc}
                  selected={selected.has(doc.id)}
                  onOpen={() => onOpenDoc(doc)}
                  onSelect={() => toggleSelect(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocCard({
  doc, selected, showContext, onOpen, onSelect, onContext,
}: {
  doc: Doc;
  selected: boolean;
  showContext: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onContext: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`relative group rounded-lg border transition-all cursor-pointer ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30 hover:shadow-sm'} bg-card`}
    >
      {/* Thumbnail */}
      <div
        className="h-36 rounded-t-lg flex items-center justify-center relative"
        style={{ backgroundColor: `${doc.color}12` }}
        onClick={onOpen}
      >
        <div
          className="w-16 h-20 rounded-sm border shadow-sm flex items-center justify-center"
          style={{ backgroundColor: `${doc.color}20`, borderColor: `${doc.color}40` }}
        >
          <FileTextIcon size={20} style={{ color: doc.color }} />
        </div>

        {/* Select checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`absolute top-2 left-2 w-5 h-5 rounded border transition-all ${selected ? 'bg-primary border-primary opacity-100' : 'bg-card border-border opacity-0 group-hover:opacity-100'}`}
        >
          {selected && <span className="text-primary-foreground text-[10px] flex items-center justify-center">✓</span>}
        </button>

        {/* Favorite */}
        {doc.favorite && (
          <div className="absolute top-2 right-2">
            <StarIcon size={12} className="text-amber-400" filled />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3" onClick={onOpen}>
        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{doc.pages} pages · {doc.size}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{doc.lastOpened}</p>
      </div>

      {/* Context menu trigger */}
      <button
        onClick={onContext}
        className="absolute bottom-3 right-3 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-opacity"
      >
        <MoreHorizontalIcon size={14} />
      </button>

      {/* Context menu */}
      {showContext && (
        <div className="absolute bottom-10 right-3 w-40 bg-card border border-border rounded-lg shadow-xl z-30 py-1 fade-in">
          {[
            { label: 'Open', icon: FileTextIcon },
            { label: 'Favorite', icon: BookmarkIcon },
            { label: 'Download', icon: DownloadIcon },
            { label: 'Delete', icon: TrashIcon },
          ].map((item) => (
            <button
              key={item.label}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors ${item.label === 'Delete' ? 'text-red-500' : 'text-foreground'}`}
            >
              <item.icon size={12} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocListRow({ doc, selected, onOpen, onSelect }: { doc: Doc; selected: boolean; onOpen: () => void; onSelect: () => void }) {
  return (
    <div
      className={`group grid grid-cols-12 items-center px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${selected ? 'bg-primary/5' : 'hover:bg-muted'}`}
      onClick={onOpen}
    >
      <div className="col-span-5 flex items-center gap-3 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`w-4 h-4 rounded border shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
        />
        <div
          className="w-7 h-9 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${doc.color}18` }}
        >
          <FileTextIcon size={13} style={{ color: doc.color }} />
        </div>
        <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
        {doc.favorite && <StarIcon size={11} className="text-amber-400 shrink-0" filled />}
      </div>
      <span className="col-span-2 text-xs text-muted-foreground">{doc.folder}</span>
      <span className="col-span-2 text-xs text-muted-foreground font-mono">{doc.size}</span>
      <span className="col-span-2 text-xs text-muted-foreground">{doc.lastOpened}</span>
      <div className="col-span-1 flex justify-end">
        <button className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100">
          <MoreHorizontalIcon size={13} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <FileTextIcon size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {search ? 'No documents found' : 'No documents yet'}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        {search ? `No results for "${search}"` : 'Upload a PDF to get started'}
      </p>
    </div>
  );
}
