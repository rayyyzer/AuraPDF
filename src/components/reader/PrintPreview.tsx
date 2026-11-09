import { useEffect, useMemo, useRef, useState } from "react"

/**
 * In-app print surface.
 *
 * Pressing Print used to drop the operating system's print preview straight onto the app
 * with no context, which read as a rendering bug. This sheet is the app's own page: choose
 * the range, see what will come out, then hand off to the system dialog only on confirm.
 */
export default function PrintPreview({
  docId,
  docName,
  pageCount,
  currentPage,
  renderPreview,
  onClose,
  onPrint,
}: {
  docId: string
  docName: string
  pageCount: number
  currentPage: number
  renderPreview: (pageIndex: number, scale: number) => Promise<string | null>
  onClose: () => void
  onPrint: (pages: number[], includeAnnotations: boolean) => Promise<void> | void
}) {
  const [scope, setScope] = useState<"all" | "current" | "range">("all")
  const [rangeFrom, setRangeFrom] = useState(String(currentPage))
  const [rangeTo, setRangeTo] = useState(String(pageCount))
  const [includeAnnotations, setIncludeAnnotations] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const requestRef = useRef(0)

  const pages = useMemo(() => {
    if (scope === "current") {
      return [Math.min(Math.max(1, currentPage), pageCount) - 1]
    }
    if (scope === "range") {
      const from = Math.max(1, Math.min(pageCount, Number(rangeFrom) || 1))
      const to = Math.max(1, Math.min(pageCount, Number(rangeTo) || pageCount))
      const start = Math.min(from, to)
      const end = Math.max(from, to)
      const list: number[] = []
      for (let page = start; page <= end; page += 1) list.push(page - 1)
      return list
    }
    return Array.from({ length: pageCount }, (_, index) => index)
  }, [scope, currentPage, pageCount, rangeFrom, rangeTo])

  const firstPage = pages[0] ?? 0

  useEffect(() => {
    const token = ++requestRef.current
    let cancelled = false
    setPreview(null)
    void renderPreview(firstPage, 1.2)
      .then((url) => {
        if (!cancelled && token === requestRef.current) setPreview(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [docId, firstPage, renderPreview])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [onClose])

  const handlePrint = async () => {
    if (pages.length === 0) return
    setBusy(true)
    try {
      await onPrint(pages, includeAnnotations)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Print"
    >
      <div
        className="flex h-[min(84vh,720px)] w-[min(1040px,94vw)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl modal-pop"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Options */}
        <div className="flex w-[300px] shrink-0 flex-col border-r border-border/70">
          <div className="border-b border-border/70 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-foreground">Print</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {docName}
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pages
              </p>
              <div className="space-y-1">
                {[
                  { id: "all" as const, label: `All pages (${pageCount})` },
                  { id: "current" as const, label: `Current page (${currentPage})` },
                  { id: "range" as const, label: "Custom range" },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors ${
                      scope === option.id
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="print-scope"
                      checked={scope === option.id}
                      onChange={() => setScope(option.id)}
                      className="accent-[var(--primary)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              {scope === "range" && (
                <div className="mt-2 flex items-center gap-2 pl-6">
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={rangeFrom}
                    onChange={(event) => setRangeFrom(event.target.value)}
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
                    aria-label="From page"
                  />
                  <span className="text-[11px] text-muted-foreground">to</span>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={rangeTo}
                    onChange={(event) => setRangeTo(event.target.value)}
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
                    aria-label="To page"
                  />
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted">
              <input
                type="checkbox"
                checked={includeAnnotations}
                onChange={(event) => setIncludeAnnotations(event.target.checked)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                Include annotations
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Highlights, ink and notes are printed onto the page.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-5 py-3">
            <span className="text-[11px] text-muted-foreground">
              {pages.length} page{pages.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void handlePrint()}
                disabled={busy || pages.length === 0}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Preparing…" : "Print"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-1 flex-col bg-background/60">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Preview
            </span>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
            {preview ? (
              <img
                src={preview}
                alt={`Preview of page ${firstPage + 1}`}
                className="max-h-full max-w-full rounded-sm shadow-2xl"
              />
            ) : (
              <div className="page-skeleton h-[70%] w-[52%] rounded-sm" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
