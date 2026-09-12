import { useState, useRef } from 'react';
import type { Doc, View } from '../types';
import { DOCUMENTS } from '../data';
import {
  PlusIcon, SearchIcon, FileTextIcon, StarIcon, FolderIcon,
  UploadIcon, ClockIcon, MoreHorizontalIcon, ChevronRightIcon,
} from '../icons';

interface Props {
  onOpenDoc: (doc: Doc) => void;
  onNavigate: (view: View) => void;
}

export default function Dashboard({ onOpenDoc, onNavigate }: Props) {
  const [dragging, setDragging] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasDocuments = DOCUMENTS.length > 0;
  const recents = DOCUMENTS.slice(0, 6);
  const pinned = DOCUMENTS.filter((d) => d.favorite);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    setShowUpload(false);
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Topbar */}
      <div className="shrink-0 flex items-center gap-3 h-11 px-5 border-b border-border bg-card">
        <h1 className="text-[13px] font-semibold text-foreground">Home</h1>

        <div className="relative ml-4 flex-1 max-w-64">
          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            onFocus={() => onNavigate('search')}
            placeholder="Search documents…"
            readOnly
            className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-muted rounded border border-border text-foreground placeholder:text-muted-foreground focus:outline-none cursor-pointer"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted rounded border border-border transition-colors"
          >
            <FolderIcon size={12} />
            New folder
          </button>
          <div className="relative">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity font-medium"
            >
              <PlusIcon size={12} />
              New
            </button>
            {showUpload && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded shadow-lg z-20 py-1 fade-in">
                <button onClick={() => { fileRef.current?.click(); setShowUpload(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors">
                  <UploadIcon size={12} className="text-muted-foreground" /> Import PDF
                </button>
                <button onClick={() => { setShowUpload(false); onNavigate('library'); }} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors">
                  <FolderIcon size={12} className="text-muted-foreground" /> New folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".pdf" className="hidden" />

      {/* Content */}
      {!hasDocuments ? (
        <EmptyState onImport={() => fileRef.current?.click()} />
      ) : (
        <div
          className="flex-1 overflow-hidden grid"
          style={{ gridTemplateColumns: '1fr 240px' }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {/* Left: Recent */}
          <div className="overflow-y-auto border-r border-border">
            {/* Drop overlay */}
            {dragging && (
              <div className="absolute inset-0 z-30 bg-primary/5 border-2 border-dashed border-primary flex items-center justify-center">
                <div className="text-sm font-medium text-primary">Drop PDF to import</div>
              </div>
            )}

            <div className="p-5">
              <SectionLabel icon={<ClockIcon size={11} />} label="Recent" action={{ label: 'All documents', onClick: () => onNavigate('library') }} />
              <div className="mt-2 space-y-0.5">
                {recents.map((doc) => (
                  <DocRow key={doc.id} doc={doc} onOpen={() => onOpenDoc(doc)} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Pinned + Quick actions */}
          <div className="overflow-y-auto bg-card">
            {/* Pinned */}
            <div className="p-4 border-b border-border">
              <SectionLabel icon={<StarIcon size={11} />} label="Pinned" />
              {pinned.length === 0 ? (
                <p className="mt-3 text-[11px] text-muted-foreground">No pinned documents.</p>
              ) : (
                <div className="mt-2 space-y-0.5">
                  {pinned.map((doc) => (
                    <PinnedRow key={doc.id} doc={doc} onOpen={() => onOpenDoc(doc)} />
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="p-4">
              <SectionLabel label="Quick actions" />
              <div className="mt-2 space-y-0.5">
                {[
                  { label: 'Open PDF', icon: FileTextIcon, action: () => fileRef.current?.click() },
                  { label: 'Import PDF', icon: UploadIcon, action: () => fileRef.current?.click() },
                  { label: 'New folder', icon: FolderIcon, action: () => onNavigate('library') },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <item.icon size={12} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  label,
  icon,
  action,
}: {
  label: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      {action && (
        <button onClick={action.onClick} className="ml-auto flex items-center gap-0.5 text-[11px] text-primary hover:underline">
          {action.label}
          <ChevronRightIcon size={10} />
        </button>
      )}
    </div>
  );
}

function DocRow({ doc, onOpen }: { doc: Doc; onOpen: () => void }) {
  return (
    <div
      className="flex items-center gap-3 w-full px-2.5 py-2 rounded hover:bg-muted transition-colors group cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
    >
      <div
        className="w-7 h-8 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${doc.color}15` }}
      >
        <FileTextIcon size={13} style={{ color: doc.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate leading-tight">{doc.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{doc.pages}p · {doc.size} · {doc.folder}</p>
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">{doc.lastOpened}</span>
      <button
        className="p-1 rounded hover:bg-secondary text-muted-foreground ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <MoreHorizontalIcon size={12} />
      </button>
    </div>
  );
}

function PinnedRow({ doc, onOpen }: { doc: Doc; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-muted transition-colors"
    >
      <div
        className="w-5 h-6 rounded-sm flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${doc.color}15` }}
      >
        <FileTextIcon size={10} style={{ color: doc.color }} />
      </div>
      <span className="text-[12px] text-foreground truncate flex-1">{doc.name}</span>
    </button>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
        <FileTextIcon size={18} className="text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-foreground">No documents</p>
        <p className="text-[12px] text-muted-foreground mt-1">Open or import a PDF to get started</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
        >
          <UploadIcon size={12} />
          Import PDF
        </button>
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 text-[12px] text-foreground border border-border rounded hover:bg-muted transition-colors"
        >
          <FileTextIcon size={12} />
          Open PDF
        </button>
      </div>
    </div>
  );
}
