import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react"

import { useVirtualizer } from "@tanstack/react-virtual"
import type { Doc } from "../../types"

const dimensionCache = new Map<string, Record<number, {
  w: number
  h: number
}>>()

export interface ContinuousViewProps {
  doc: Doc
  numPages: number
  zoom: number
  rotation: number
  page: number
  setPage: (p: number) => void
  PageCardComponent: any
  twoPage?: boolean
  activeTool?: string
  searchMatches?: any[]
  activeMatch?: { page: number; boundIndex: number } | null
  onTextSelection?: (sel: any) => void
  activeSelection?: any
  fitMode?: string
  isFullscreen?: boolean
}

export interface ContinuousViewRef {
  scrollToPage: (pageNumber: number, offset?: number) => void
  measureNow: () => void
  getScrollElement: () => HTMLDivElement | null
  getPreviewElement: () => HTMLDivElement | null
}

export const ContinuousView = memo(
  forwardRef<ContinuousViewRef, ContinuousViewProps>(
    (
      {
        doc,
        numPages,
        zoom,
        rotation,
        page,
        setPage,
        PageCardComponent,
        twoPage,
        activeTool,
        searchMatches,
        activeMatch,
        onTextSelection,
        activeSelection,
        fitMode = "manual",
        isFullscreen = false,
      },
      ref,
    ) => {
      const parentRef = useRef<HTMLDivElement>(null)
      const stageRef = useRef<HTMLDivElement>(null)
      const contentRef = useRef<HTMLDivElement>(null)
      const [containerWidth, setContainerWidth] = useState(0)
      const [maxPageBaseWidth, setMaxPageBaseWidth] = useState(520)

      useEffect(() => {
        if (!parentRef.current) return
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setContainerWidth(entry.contentRect.width)
          }
        })
        observer.observe(parentRef.current)
        return () => observer.disconnect()
      }, [])

      const itemsCount = twoPage ? Math.ceil(numPages / 2) : numPages

      const throttleRef = useRef<number | null>(null)

      const docCache = useMemo(() => {
        if (!dimensionCache.has(doc.id)) {
          dimensionCache.set(doc.id, {})
        }

        return dimensionCache.get(doc.id)!
      }, [doc.id])

      useEffect(() => {
        const rotated = rotation === 90 || rotation === 270
        let maxW = 520
        for (const key of Object.keys(docCache)) {
          const entry = docCache[Number(key)]
          if (entry) maxW = Math.max(maxW, rotated ? entry.h : entry.w)
        }
        setMaxPageBaseWidth(maxW)
      }, [docCache, rotation])

      const getPageZoom = useCallback(
        (pageIdx: number) => {
          if (fitMode !== "width" || containerWidth <= 0) return zoom
          const meta = docCache[pageIdx] ?? { w: 520, h: 720 }
          const rotated = rotation === 90 || rotation === 270
          const baseW = rotated ? meta.h : meta.w

          const padding = twoPage ? 48 : 32 // 16px outer edges + 16px middle gap for two pages
          const availableW = twoPage
            ? (containerWidth - padding) / 2
            : containerWidth - padding
          const targetW = Math.max(100, availableW)

          return (targetW / baseW) * 100
        },
        [fitMode, containerWidth, zoom, rotation, docCache, twoPage],
      )

      const rowVirtualizer = useVirtualizer({
        count: itemsCount,

        getScrollElement: () => parentRef.current,

        estimateSize: (index) => {
          const pageIndexes = twoPage ? [index * 2, index * 2 + 1] : [index]
          const rowHeight = pageIndexes.reduce((maxHeight, pageIdx) => {
            const meta = docCache[pageIdx] ?? { w: 520, h: 720 }
            const rotated = rotation === 90 || rotation === 270
            const pZoom = getPageZoom(pageIdx)
            const height = (rotated ? meta.w : meta.h) * (pZoom / 100)
            return Math.max(maxHeight, height)
          }, 0)

          return rowHeight + (index === 0 ? 8 : 16)
        },

        overscan: 2,

        onChange: () => {
          // update page based on scroll
          if (!parentRef.current) return
          const virtualItems = rowVirtualizer.getVirtualItems()

          if (virtualItems.length > 0) {
            const center =
              parentRef.current.scrollTop + parentRef.current.clientHeight / 2
            let closest = virtualItems[0]
            let minDiff = Infinity
            for (const item of virtualItems) {
              const diff = Math.abs(item.start + item.size / 2 - center)
              if (diff < minDiff) {
                minDiff = diff
                closest = item
              }
            }
            const newPage = twoPage ? closest.index * 2 + 1 : closest.index + 1

            if (newPage !== page) {
              if (throttleRef.current) clearTimeout(throttleRef.current)
              throttleRef.current = window.setTimeout(
                () => setPage(newPage),
                100,
              )
            }
          }
        },
      })

      const syncMeasureAndStageHeight = useCallback(() => {
        rowVirtualizer.measure()
        const nextTotal = `${rowVirtualizer.getTotalSize()}px`
        if (stageRef.current) stageRef.current.style.height = nextTotal
        if (contentRef.current) contentRef.current.style.height = nextTotal
      }, [rowVirtualizer])

      // Measure synchronously before paint so parent zoom scroll-anchoring sees accurate
      // post-zoom row heights instead of clamping against stale scrollHeight.
      useLayoutEffect(() => {
        syncMeasureAndStageHeight()
      }, [zoom, rotation, fitMode, containerWidth, twoPage, syncMeasureAndStageHeight])

      const handleMeasure = useCallback(
        (index: number, baseW: number, baseH: number) => {
          const current = docCache[index]
          if (
            !current ||
            Math.abs(current.w - baseW) > 1 ||
            Math.abs(current.h - baseH) > 1
          ) {
            docCache[index] = { w: baseW, h: baseH }

            const rotated = rotation === 90 || rotation === 270
            const orientedW = rotated ? baseH : baseW
            setMaxPageBaseWidth((prev) => (orientedW > prev ? orientedW : prev))

            const rowPages = twoPage ? [index * 2, index * 2 + 1] : [index]
            const rowHeight = rowPages.reduce((maxHeight, pageIdx) => {
              const meta = docCache[pageIdx] ?? { w: 520, h: 720 }
              const pZoom = getPageZoom(pageIdx)
              return Math.max(
                maxHeight,
                (rotated ? meta.w : meta.h) * (pZoom / 100),
              )
            }, 0)
            const rowIdx = twoPage ? Math.floor(index / 2) : index
            rowVirtualizer.resizeItem(
              rowIdx,
              rowHeight + (rowIdx === 0 ? 8 : 16),
            )
          }
        },
        [docCache, rotation, twoPage, rowVirtualizer, getPageZoom],
      )

      const virtualItems = rowVirtualizer.getVirtualItems()

      // Page prop is now strictly for UI synchronization (current active page).
      // External navigation is handled imperatively via scrollToPage() via the ContinuousViewRef.

      useImperativeHandle(ref, () => ({
        scrollToPage: (pageNumber: number, offset?: number) => {
          const targetIdx = twoPage
            ? Math.floor((pageNumber - 1) / 2)
            : pageNumber - 1

          // Use smooth scrolling for short jumps (like Next/Prev), instant for large jumps
          const distance = Math.abs(pageNumber - page)
          const behavior = distance <= 3 ? "smooth" : "auto"

          rowVirtualizer.scrollToIndex(targetIdx, { align: "start", behavior })

          if (offset) {
            requestAnimationFrame(() => {
              const virtualItems = rowVirtualizer.getVirtualItems()
              const item = virtualItems.find((it) => it.index === targetIdx)
              if (item) {
                rowVirtualizer.scrollToOffset(
                  item.start + offset * (zoom / 100),
                  { align: "start", behavior: "auto" },
                )
              }
            })
          }
        },
        measureNow: syncMeasureAndStageHeight,
        getScrollElement: () => parentRef.current,
        getPreviewElement: () => contentRef.current,
      }))

      // Ensure horizontal scroll extents accommodate zoomed pages without clipping left edges.
      const pageColWidth =
        fitMode === "width" && containerWidth > 0
          ? Math.max(0, containerWidth - 32)
          : Math.ceil(
              (twoPage ? maxPageBaseWidth * 2 + 16 : maxPageBaseWidth) *
                (zoom / 100),
            )
      const scaledRowWidth = pageColWidth + 32
      const contentWidthStyle =
        containerWidth > 0 && scaledRowWidth > containerWidth
          ? `${scaledRowWidth}px`
          : "100%"

      return (
        <div
          ref={parentRef}
          className={`flex-1 overflow-auto w-full h-full relative ${
            isFullscreen ? "no-scrollbar" : ""
          }`}
        >
          <div
            ref={stageRef}
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: contentWidthStyle,
              minWidth: "100%",
              paddingInline: "16px",
              overflow: "clip",
              position: "relative",
            }}
          >
            <div
              ref={contentRef}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: `${pageColWidth}px`,
                margin: "0 auto",
                position: "relative",
              }}
            >
            {virtualItems.map((virtualRow) => {
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

                    display: "flex",

                    justifyContent: "center",

                    gap: "16px",

                    paddingTop: virtualRow.index === 0 ? "0px" : "8px",

                    paddingBottom: "8px",
                  }}
                >
                  {twoPage ? (
                    <>
                      <PageCardComponent
                        docId={doc.id}
                        index={virtualRow.index * 2}
                        zoom={getPageZoom(virtualRow.index * 2)}
                        rotation={rotation}
                        isCurrent={page === virtualRow.index * 2 + 1}
                        priority={page === virtualRow.index * 2 + 1 ? 100 : 80}
                        onMeasure={handleMeasure}
                        activeTool={activeTool}
                        searchMatches={searchMatches}
                        activeMatch={activeMatch}
                        onTextSelection={onTextSelection}
                        activeSelection={
                          activeSelection?.page === virtualRow.index * 2 + 1
                            ? activeSelection
                            : null
                        }
                      />
                      {virtualRow.index * 2 + 1 < numPages ? (
                        <PageCardComponent
                          docId={doc.id}
                          index={virtualRow.index * 2 + 1}
                          zoom={getPageZoom(virtualRow.index * 2 + 1)}
                          rotation={rotation}
                          isCurrent={page === virtualRow.index * 2 + 2}
                          priority={
                            page === virtualRow.index * 2 + 2 ? 100 : 80
                          }
                          onMeasure={handleMeasure}
                          activeTool={activeTool}
                          searchMatches={searchMatches}
                          activeMatch={activeMatch}
                          onTextSelection={onTextSelection}
                          activeSelection={
                            activeSelection?.page === virtualRow.index * 2 + 2
                              ? activeSelection
                              : null
                          }
                        />
                      ) : (
                        <div
                          style={{
                            width: docCache[virtualRow.index * 2]?.w
                              ? docCache[virtualRow.index * 2].w *
                                (getPageZoom(virtualRow.index * 2) / 100)
                              : 520 * (getPageZoom(virtualRow.index * 2) / 100),
                          }}
                          className="shrink-0"
                        />
                      )}
                    </>
                  ) : (
                    <PageCardComponent
                      docId={doc.id}
                      index={virtualRow.index}
                      zoom={getPageZoom(virtualRow.index)}
                      rotation={rotation}
                      isCurrent={page === virtualRow.index + 1}
                      priority={page === virtualRow.index + 1 ? 100 : 80}
                      onMeasure={handleMeasure}
                      activeTool={activeTool}
                      searchMatches={searchMatches}
                      activeMatch={activeMatch}
                      onTextSelection={onTextSelection}
                      activeSelection={
                        activeSelection?.page === virtualRow.index + 1
                          ? activeSelection
                          : null
                      }
                    />
                  )}
                </div>
              )
            })}
            </div>
          </div>
        </div>
      )
    },
  ),
)
