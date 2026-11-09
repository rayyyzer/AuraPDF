import { useRef, useEffect, useState, useCallback, memo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { NativePdfEngine } from "../../services/pdf/engine"

import { PageThumbnail } from "./PageThumbnail"
import {
  getBaseGeometry,
  getThumbnailGeometry,
} from "../../services/pdf/pageGeometry"

interface ThumbnailSidebarProps {
  docId: string
  numPages: number
  activePage: number
  rotation: number
  onNavigate: (page: number) => void
}

const THUMB_MAX_WIDTH = 140

export const ThumbnailSidebar = memo(function ThumbnailSidebar({
  docId,
  numPages,
  activePage,
  rotation,
  onNavigate,
}: ThumbnailSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Selection state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    new Set([activePage]),
  )
  const [lastSelected, setLastSelected] = useState<number>(activePage)

  // Sync active page selection
  useEffect(() => {
    setSelectedPages((prev) => {
      const next = new Set(prev)
      next.add(activePage)
      return next
    })
    setLastSelected(activePage)
  }, [activePage])

  // Get base aspect ratio for initial virtualizer estimation
  const [baseAspectRatio, setBaseAspectRatio] = useState<number>(520 / 720)
  const aspectCache = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    aspectCache.current.clear()
    NativePdfEngine.getPageMeta(docId, 0)
      .then((meta) => {
        if (meta.width > 0 && meta.height > 0) {
          const ar = meta.width / meta.height
          aspectCache.current.set(0, ar)
          setBaseAspectRatio(ar)
        }
      })
      .catch(() => {})
  }, [docId])

  const rowVirtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const ar = aspectCache.current.get(index) ?? baseAspectRatio
      const base = getBaseGeometry(1000, 1000 / ar, rotation)
      const { height } = getThumbnailGeometry(base, THUMB_MAX_WIDTH)
      return height + 46 // thumbnail height + vertical padding + page number label
    },
    overscan: 5,
  })

  // Re-measure virtual rows whenever base aspect ratio or rotation changes
  useEffect(() => {
    rowVirtualizer.measure()
  }, [baseAspectRatio, rotation, numPages, rowVirtualizer])

  // Auto-scroll to active page smoothly
  useEffect(() => {
    if (numPages > 0 && activePage >= 1 && activePage <= numPages) {
      rowVirtualizer.scrollToIndex(activePage - 1, { align: "auto" })
    }
  }, [activePage, numPages, rowVirtualizer])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        onNavigate(Math.min(numPages, activePage + 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        onNavigate(Math.max(1, activePage - 1))
      } else if (e.key === "Home") {
        e.preventDefault()
        onNavigate(1)
      } else if (e.key === "End") {
        e.preventDefault()
        onNavigate(numPages)
      } else if (e.key === " ") {
        e.preventDefault()
        setSelectedPages((prev) => {
          const next = new Set(prev)
          if (next.has(activePage)) next.delete(activePage)
          else next.add(activePage)
          return next
        })
      }
    },
    [activePage, numPages, onNavigate],
  )

  const handleShiftClick = useCallback(
    (index: number) => {
      if (lastSelected === null) {
        setSelectedPages(new Set([index + 1]))
        setLastSelected(index + 1)
        return
      }
      const start = Math.min(lastSelected, index + 1)
      const end = Math.max(lastSelected, index + 1)
      const newSelection = new Set<number>()
      for (let i = start; i <= end; i++) {
        newSelection.add(i)
      }
      setSelectedPages(newSelection)
    },
    [lastSelected],
  )

  const handleCtrlClick = useCallback((index: number) => {
    const pageNum = index + 1
    setSelectedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageNum)) {
        next.delete(pageNum)
      } else {
        next.add(pageNum)
      }
      return next
    })
    setLastSelected(pageNum)
  }, [])

  return (
    <div className="h-full w-full flex flex-col select-none overflow-hidden">
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar py-2 outline-none"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const pageNum = virtualRow.index + 1
            const ar =
              aspectCache.current.get(virtualRow.index) ?? baseAspectRatio
            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex justify-center"
              >
                <PageThumbnail
                  docId={docId}
                  index={virtualRow.index}
                  active={pageNum === activePage}
                  selected={selectedPages.has(pageNum)}
                  rotation={rotation}
                  aspectRatio={ar}
                  maxWidth={THUMB_MAX_WIDTH}
                  onClick={() => {
                    setSelectedPages(new Set([pageNum]))
                    setLastSelected(pageNum)
                    onNavigate(pageNum)
                  }}
                  onShiftClick={() => handleShiftClick(virtualRow.index)}
                  onCtrlClick={() => handleCtrlClick(virtualRow.index)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
