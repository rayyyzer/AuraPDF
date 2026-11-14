import { useRef, useEffect, useState, memo } from "react"
import { NativePdfEngine } from "../../services/pdf/engine"
import {
  getBaseGeometry,
  getThumbnailGeometry,
} from "../../services/pdf/pageGeometry"

export const PageThumbnail = memo(function PageThumbnail({
  docId,
  index,
  active,
  selected,
  rotation,
  aspectRatio: initialAspectRatio,
  maxWidth = 140,
  maxHeight,
  onClick,
  onShiftClick,
  onCtrlClick,
  hideLabel,
  path,
}: {
  docId: string
  index: number
  active?: boolean
  selected?: boolean
  rotation?: number
  aspectRatio?: number
  maxWidth?: number
  maxHeight?: number
  onClick: () => void
  onShiftClick?: () => void
  onCtrlClick?: () => void
  hideLabel?: boolean
  path?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [actualSize, setActualSize] = useState<{
    width: number
    height: number
  } | null>(null)

  const originalWidth = actualSize ? actualSize.width : 1000
  const originalHeight = actualSize
    ? actualSize.height
    : 1000 / (initialAspectRatio ?? 520 / 720)

  const baseGeometry = getBaseGeometry(
    originalWidth,
    originalHeight,
    rotation || 0,
  )
  const { width, height } = getThumbnailGeometry(
    baseGeometry,
    maxWidth,
    maxHeight,
  )

  useEffect(() => {
    let cancelled = false
    let observer: IntersectionObserver | undefined
    const host = hostRef.current
    if (!host) return

    const abortController = new AbortController()

    const load = async () => {
      try {
        if (path) {
          await NativePdfEngine.openDocument(docId, path)
        }

        const meta = await NativePdfEngine.getPageMeta(docId, index)
        if (!cancelled) {
          setActualSize({ width: meta.width, height: meta.height })
        }

        const actualBaseGeometry = getBaseGeometry(
          meta.width,
          meta.height,
          rotation || 0,
        )
        const { scale: actualThumbScale } = getThumbnailGeometry(
          actualBaseGeometry,
          maxWidth,
          maxHeight,
        )

        const renderScale = actualThumbScale * window.devicePixelRatio
        const bytes = await NativePdfEngine.renderPage(
          docId,
          index,
          renderScale,
          rotation || 0,
          active ? 35 : 5,
          abortController.signal,
        )

        if (cancelled || !canvasRef.current || abortController.signal.aborted) {
          return
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, 8)
        const w = view.getUint32(0, true)
        const h = view.getUint32(4, true)

        const expectedBytes = 8 + w * h * 4
        const actualBytes = bytes.byteLength
        const valid = actualBytes >= expectedBytes

        if (!w || !h || !valid) {
          return
        }

        const canvas = canvasRef.current
        canvas.width = w
        canvas.height = h

        const pixels = new Uint8ClampedArray(
          bytes.buffer,
          bytes.byteOffset + 8,
          w * h * 4,
        )
        const image = new ImageData(pixels as any, w, h)

        const ctx = canvas.getContext("2d", { alpha: false })

        ctx?.putImageData(image, 0, 0)

        if (!cancelled && !abortController.signal.aborted) {
          setReady(true)
        }
      } catch (err: any) {
        if (
          err?.name === "AbortError" ||
          (err?.message?.includes("timed out") && cancelled)
        ) {
          return
        }
        console.error(
          `[PageThumbnail] Render failed for ${docId} page ${index}:`,
          err,
        )
      }
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect()
          void load()
        }
      },
      { rootMargin: "300px" },
    )
    observer.observe(host)
    return () => {
      cancelled = true
      abortController.abort()
      observer?.disconnect()
    }
  }, [docId, index, active, rotation, maxWidth, maxHeight, path])

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onShiftClick) {
      e.preventDefault()
      onShiftClick()
    } else if ((e.ctrlKey || e.metaKey) && onCtrlClick) {
      e.preventDefault()
      onCtrlClick()
    } else {
      onClick()
    }
  }

  return (
    <div
      className={`flex-col items-center justify-center outline-none cursor-pointer group ${
        hideLabel ? "inline-flex" : "w-full flex py-2.5 px-4"
      }`}
      onClick={handleClick}
      title={`Page ${index + 1}`}
    >
      <div
        ref={hostRef}
        className={`relative mx-auto rounded-md overflow-hidden transition-all duration-200 ease-out flex items-center justify-center bg-white shadow-sm ring-1 ring-inset ${
          active
            ? "ring-primary ring-[2px] shadow-lg ring-offset-[2px] ring-offset-card scale-[1.02]"
            : "ring-border/60 group-hover:ring-primary/40 group-hover:shadow-md group-hover:-translate-y-[1.5px] group-active:scale-[0.98]"
        } ${
          selected && !active
            ? "ring-muted-foreground/60 ring-[1.5px] ring-offset-[1px] ring-offset-card"
            : ""
        }`}
        style={{ width, height }}
      >
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain transition-opacity duration-300 ease-out ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
        {!ready && (
          <div className="absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none bg-gradient-to-b from-stone-50 to-stone-100 dark:from-slate-900/90 dark:to-slate-950/90 border border-black/5 select-none">
            <div className="flex items-center justify-between">
              <div className="w-4 h-1 rounded-full bg-primary/40" />
              <span className="text-[8px] font-mono font-medium text-muted-foreground/60 tabular-nums">
                {index + 1}
              </span>
            </div>
            <div className="space-y-1 my-auto px-0.5">
              <div className="w-4/5 h-0.5 rounded-xs bg-muted-foreground/20" />
              <div className="w-full h-0.5 rounded-xs bg-muted-foreground/15" />
              <div className="w-3/4 h-0.5 rounded-xs bg-muted-foreground/15" />
              <div className="w-1/2 h-0.5 rounded-xs bg-muted-foreground/10" />
            </div>
            <div className="w-1/3 h-0.5 rounded-full bg-muted-foreground/20" />
          </div>
        )}
      </div>
      {!hideLabel && (
        <div
          className={`mt-2 text-[11px] leading-none font-mono tabular-nums text-center transition-all duration-200 ${
            active
              ? "text-primary font-bold scale-105"
              : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {index + 1}
        </div>
      )}
    </div>
  )
})
