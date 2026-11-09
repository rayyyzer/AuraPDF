import { invoke } from "@tauri-apps/api/core"
import { isUnreadable, type UnifiedTextSegment } from "./text"
import { db } from "../db"
import { getFileVersion, isTauriContext } from "../tauri"

/**
 * Must match `PIPELINE_VERSION` in `src-tauri/src/ocr.rs`. Cached OCR text stamped
 * with any other version is regenerated instead of being trusted.
 */
export const OCR_PIPELINE_VERSION = "v7"

export interface PageMeta {
  width: number
  height: number
}

export interface DocumentMeta {
  id: string
  num_pages: number
}

export interface Viewport {
  width: number
  height: number
  scale: number
  rotation: number
}

export class NativePdfEngine {
  private static readonly operationTimeoutMs = 30000
  private static docCache = new Map<string, DocumentMeta>()
  private static fileVersions = new Map<string, string>()
  private static documentGenerations = new Map<string, number>()
  private static openRequests = new Map<string, Promise<DocumentMeta>>()
  private static pageMetaCache = new Map<string, PageMeta>() // Keyed by `${id}-${pageIndex}`
  private static textLayerCache = new Map<string, UnifiedTextSegment[]>()
  private static readonly maxTextLayerEntries = 8

  private static setCachedTextLayer(
    key: string,
    value: UnifiedTextSegment[],
  ): void {
    this.textLayerCache.delete(key)
    this.textLayerCache.set(key, value)
    while (this.textLayerCache.size > this.maxTextLayerEntries) {
      const oldestKey = this.textLayerCache.keys().next().value
      if (oldestKey) {
        this.textLayerCache.delete(oldestKey)
      } else {
        break
      }
    }
  }

  public static async warmupDocumentPages(
    id: string,
    count = 2,
  ): Promise<void> {
    try {
      const meta = this.docCache.get(id)
      if (!meta) return // Skip if document is not yet registered/opened in engine
      const totalPages = meta.num_pages
      const pagesToWarm = Math.min(totalPages, count)
      for (let p = 0; p < pagesToWarm; p++) {
        void this.getHybridTextLayer(id, p).catch(() => {})
      }
    } catch {
      // Background warmup errors are silently swallowed
    }
  }
  private static renderCache = new Map<string, Uint8Array>()
  private static readonly maxRenderCacheEntries = 10
  private static readonly maxRenderCacheBytes = 96 * 1024 * 1024
  private static activeRenders = 0
  private static pendingRenders: Array<{
    key: string
    priority: number
    run: () => Promise<Uint8Array>
    resolve: (value: Uint8Array) => void
    reject: (reason?: unknown) => void
  }> = []
  private static queuedRenders = new Map<string, Promise<Uint8Array>>()
  private static readonly maxConcurrentRenders = 2

  private static withTimeout<T,>(
    operation: Promise<T>,
    label: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out`)),
        this.operationTimeoutMs,
      )
    })
    return Promise.race([operation, timeout]).finally(() => {
      if (timer) clearTimeout(timer)
    })
  }

  public static async openDocument(
    id: string,
    path: string,
  ): Promise<DocumentMeta> {
    if (!isTauriContext()) {
      const meta = { id, num_pages: 5 }
      this.docCache.set(id, meta)
      return meta
    }
    const fileVersion = await getFileVersion(path)
    if (fileVersion) {
      const versionKey = `${fileVersion.size}:${fileVersion.modifiedAt ?? "unknown"}`
      const previousVersion = this.fileVersions.get(id)
      if (previousVersion !== undefined && previousVersion !== versionKey) {
        await this.invalidateDocumentCache(id, true)
        await invoke("pdf_close", { id }).catch(() => undefined)
      }
      this.fileVersions.set(id, versionKey)
    } else if (!this.fileVersions.has(id)) {
      this.fileVersions.set(id, "")
    }
    if (this.docCache.has(id)) {
      return this.docCache.get(id)!
    }
    const existing = this.openRequests.get(id)
    if (existing) return existing
    const generation = this.documentGenerations.get(id) ?? 0
    const request = this.withTimeout(
      invoke<DocumentMeta>("pdf_open", { id, path }),
      "Opening PDF",
    )
      .then((meta) => {
        if ((this.documentGenerations.get(id) ?? 0) === generation) {
          this.docCache.set(id, meta)
        }
        return meta
      })
      .finally(() => {
        if (this.openRequests.get(id) === request) this.openRequests.delete(id)
      })
    this.openRequests.set(id, request)
    return request
  }

  public static getCachedDocument(id: string): DocumentMeta | undefined {
    return this.docCache.get(id)
  }

  public static async invalidateDocumentCache(
    id: string,
    clearPersistedText: boolean = false,
  ): Promise<void> {
    this.documentGenerations.set(
      id,
      (this.documentGenerations.get(id) ?? 0) + 1,
    )
    this.docCache.delete(id)
    this.openRequests.delete(id)
    for (const key of this.pageMetaCache.keys()) {
      if (key.startsWith(`${id}-`)) this.pageMetaCache.delete(key)
    }
    for (const key of this.textLayerCache.keys()) {
      if (key.startsWith(`${id}-`)) this.textLayerCache.delete(key)
    }
    for (const key of this.inFlightOcr.keys()) {
      if (key.startsWith(`${id}-`)) this.inFlightOcr.delete(key)
    }
    for (const task of [...this.pendingRenders]) {
      if (task.key.startsWith(`${id}|`)) {
        this.pendingRenders.splice(this.pendingRenders.indexOf(task), 1)
        task.reject(new DOMException("Document changed", "AbortError"))
      }
    }
    for (const key of this.queuedRenders.keys()) {
      if (key.startsWith(`${id}|`)) this.queuedRenders.delete(key)
    }
    for (const key of this.renderCache.keys()) {
      if (key.startsWith(`${id}|`)) this.renderCache.delete(key)
    }
    if (clearPersistedText) {
      try {
        await db.clearCachedPageText(id)
      } catch (e) {
        console.warn(`[PDF_ENGINE] Failed to clear SQLite text cache for ${id}:`, e)
      }
    }
  }

  public static async closeDocument(id: string): Promise<void> {
    await this.invalidateDocumentCache(id, false)
    try {
      await invoke("pdf_close", { id })
    } catch (e) {
      console.warn(`[PDF_ENGINE] Failed to close native handle for ${id}:`, e)
    }
  }

  public static async getOutline(id: string): Promise<any[]> {
    if (!isTauriContext()) {
      return [
        { title: "Section 1: Executive Summary", page_index: 0, level: 0 },
        { title: "Section 2: High Performance Architecture", page_index: 1, level: 0 },
        { title: "Section 3: Precision Annotations", page_index: 2, level: 0 },
      ]
    }
    return await invoke("pdf_get_outline", { id })
  }

  public static async getTextLayer(
    id: string,
    pageIndex: number,
  ): Promise<UnifiedTextSegment[]> {
    const key = `${id}-${pageIndex}-native`
    const cached = this.textLayerCache.get(key)
    if (cached) return cached
    const generation = this.documentGenerations.get(id) ?? 0
    if (!isTauriContext()) {
      const mockResult: UnifiedTextSegment[] = [
        {
          id: `${id}:native:${pageIndex}:0`,
          text: `AuraPDF Document Preview — Page ${pageIndex + 1}`,
          x: 54,
          y: 770,
          width: 320,
          height: 18,
          source: "native" as const,
        },
        {
          id: `${id}:native:${pageIndex}:1`,
          text: "High-performance vector rendering and precision annotations layer.",
          x: 54,
          y: 740,
          width: 440,
          height: 14,
          source: "native" as const,
        },
      ]
      this.setCachedTextLayer(key, mockResult)
      return mockResult
    }
    const segments = await invoke<any[]>("pdf_get_text_layer", {
      id,
      pageIndex,
    })
    const result = segments.map((segment, index) => ({
      ...segment,
      id: `${id}:native:${pageIndex}:${index}`,
      source: "native" as const,
    }))
    if ((this.documentGenerations.get(id) ?? 0) === generation) {
      this.setCachedTextLayer(key, result)
    }
    return result
  }

  private static inFlightOcr = new Map<string, Promise<UnifiedTextSegment[]>>()

  public static async ocrPageDirect(
    id: string,
    pageIndex: number,
  ): Promise<UnifiedTextSegment[]> {
    const key = `${id}-${pageIndex}-ocr`
    const cached = this.textLayerCache.get(key)
    if (cached) return cached

    const inFlight = this.inFlightOcr.get(key)
    if (inFlight) return inFlight

    let task!: Promise<UnifiedTextSegment[]>
    task = (async () => {
      const generation = this.documentGenerations.get(id) ?? 0
      try {
        const segments = await invoke<any[]>("pdf_ocr_page_direct", {
          id,
          pageIndex,
        })
        const result: UnifiedTextSegment[] = (segments || []).map(
          (seg, index) => ({
            ...seg,
            id: `${OCR_PIPELINE_VERSION}-${id}:ocr:${pageIndex}:${index}`,
            source: "ocr" as const,
          }),
        )
        if (
          result.length > 0 &&
          (this.documentGenerations.get(id) ?? 0) === generation
        ) {
          this.setCachedTextLayer(key, result)
        }
        return (this.documentGenerations.get(id) ?? 0) === generation
          ? result
          : []
      } finally {
        if (this.inFlightOcr.get(key) === task) this.inFlightOcr.delete(key)
      }
    })()

    this.inFlightOcr.set(key, task)
    return task
  }

  public static async getHybridTextLayer(
    id: string,
    pageIndex: number,
  ): Promise<UnifiedTextSegment[]> {
    const generation = this.documentGenerations.get(id) ?? 0
    const fileVersion = this.fileVersions.get(id) ?? ""
    const isCurrent = () =>
      (this.documentGenerations.get(id) ?? 0) === generation
    const hybridKey = `${id}-${pageIndex}-hybrid`
    const memCached = this.textLayerCache.get(hybridKey)
    if (memCached && memCached.length > 0) return memCached

    // 1. Check persistent SQLite cache. Cached OCR written by an older pipeline is
    //    discarded rather than patched around: the recognition and confidence logic
    //    changed, so old text cannot be trusted and must be regenerated.
    try {
      const cachedRow = await db.getCachedPageText(id, pageIndex, fileVersion)
      if (!isCurrent()) return []
      if (cachedRow && cachedRow.segments.length > 0) {
        const cached = cachedRow.segments as UnifiedTextSegment[]
        const ocrSegments = cached.filter((segment) => segment.source === "ocr")
        const matchesPipeline = ocrSegments.every((segment) =>
          String(segment.id || "").startsWith(OCR_PIPELINE_VERSION),
        )
        const cachedChars = cached.reduce(
          (sum, segment) => sum + (segment.text || "").replace(/\s+/g, "").length,
          0,
        )
        if (
          matchesPipeline &&
          (cachedRow.manual ||
            (ocrSegments.length > 0 ? cachedChars >= 15 : cachedChars >= 120))
        ) {
          this.setCachedTextLayer(hybridKey, cached)
          return cached
        }
      }
    } catch (e) {
      console.warn(
        `[PDF_ENGINE] Failed to check SQLite text cache for page ${pageIndex}:`,
        e,
      )
    }

    // 2. Fetch native text layer
    const nativeSegments = await this.getTextLayer(id, pageIndex)
    if (!isCurrent()) return []
    const charCount = nativeSegments.reduce(
      (sum, s) => sum + (s.text ? s.text.replace(/\s+/g, "").length : 0),
      0,
    )

    // A real text layer wins outright.
    //
    // This used to require 120 characters. A title slide or a chart page with 40 real
    // characters therefore fell through to OCR, which then replaced perfect vector text with
    // recognised characters — the source of "Scanned · OCR" appearing on born-digital
    // slides, and of the garbled words that came with it. 25 characters across 3 segments is
    // already enough to prove the page has a genuine text layer, not a scan watermark.
    if (charCount >= 25 && nativeSegments.length >= 3) {
      void db
        .saveCachedPageText(id, pageIndex, "native", nativeSegments, fileVersion)
        .catch(() => {})
      if (isCurrent()) this.setCachedTextLayer(hybridKey, nativeSegments)
      return nativeSegments
    }

    // Genuinely image-only page: nothing usable in the text layer.
    if (charCount < 15) {
      try {
        const ocrSegments = await this.ocrPageDirect(id, pageIndex)
        if (ocrSegments && ocrSegments.length > 0) {
          void db
            .saveCachedPageText(id, pageIndex, "ocr", ocrSegments, fileVersion)
            .catch(() => {})
          if (isCurrent()) this.setCachedTextLayer(hybridKey, ocrSegments)
          return ocrSegments
        }
      } catch (err) {
        console.warn(
          `[PDF_ENGINE] Direct OCR failed for page ${pageIndex}:`,
          err,
        )
      }
      return nativeSegments
    }

    // Sparse but real text (15..24 chars): keep the native words and only add OCR where it
    // does not collide with them.
    try {
      const ocrSegments = await this.ocrPageDirect(id, pageIndex)
      if (!ocrSegments || ocrSegments.length === 0) {
        if (nativeSegments.length > 0) {
          if (isCurrent()) this.setCachedTextLayer(hybridKey, nativeSegments)
        }
        return nativeSegments
      }

      // Filter out OCR words that collide with native text bounding boxes
      const isOverlapping = (a: UnifiedTextSegment, b: UnifiedTextSegment) => {
        const xOverlap = Math.max(
          0,
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
        )
        const yOverlap = Math.max(
          0,
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
        )
        const overlapArea = xOverlap * yOverlap
        const aArea = a.width * a.height
        return aArea > 0 && overlapArea / aArea > 0.35
      }

      const nonCollidingOcr = ocrSegments.filter(
        (ocr) => !nativeSegments.some((nat) => isOverlapping(ocr, nat)),
      )

      const merged = [...nativeSegments, ...nonCollidingOcr]
      // Sort reading order: top-to-bottom (PDF y descending), then left-to-right (x ascending)
      merged.sort((a, b) => {
        const lineA = Math.round(a.y / 8)
        const lineB = Math.round(b.y / 8)
        if (lineA !== lineB) return lineB - lineA
        return a.x - b.x
      })

      void db
        .saveCachedPageText(id, pageIndex, "hybrid", merged, fileVersion)
        .catch(() => {})
      if (isCurrent()) this.setCachedTextLayer(hybridKey, merged)
      return merged
    } catch (err) {
      console.warn(`[PDF_ENGINE] Hybrid OCR failed for page ${pageIndex}:`, err)
      return nativeSegments
    }
  }

  /**
   * Re-reads a user-selected region at high resolution and persists the result as a
   * manual page override, so the automatic OCR pass will not replace it.
   */
  public static async ocrRegion(
    id: string,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
    existing: UnifiedTextSegment[],
  ): Promise<UnifiedTextSegment[]> {
    if (!isTauriContext()) return []
    const generation = this.documentGenerations.get(id) ?? 0
    const segments = await invoke<any[]>("pdf_ocr_region", {
      id,
      pageIndex,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
    if ((this.documentGenerations.get(id) ?? 0) !== generation) return []

    const stamped: UnifiedTextSegment[] = (segments || []).map((segment, index) => ({
      ...segment,
      id: `${OCR_PIPELINE_VERSION}-${id}:region:${pageIndex}:${index}`,
      source: "ocr" as const,
    }))

    // Replace whatever the page pass found inside the re-read area; keep the rest.
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
      const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      return xOverlap > 0 && yOverlap > 0
    }
    const kept = existing.filter((segment) => !overlaps(segment, rect))
    const merged = [...kept, ...stamped]

    this.setCachedTextLayer(`${id}-${pageIndex}-hybrid`, merged)
    this.setCachedTextLayer(`${id}-${pageIndex}-ocr`, merged)
    void db
      .saveCachedPageText(
        id,
        pageIndex,
        "ocr",
        merged,
        this.fileVersions.get(id) ?? "",
        true,
      )
      .catch((error) => {
        console.warn("[PDF_ENGINE] Failed to persist manual region OCR:", error)
      })

    return merged
  }


  public static async searchDocument(
    id: string,
    query: string,
  ): Promise<any[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    if (!isTauriContext()) {
      if ("aurapdf".includes(q) || "document".includes(q) || "high".includes(q) || "preview".includes(q)) {
        return [{ page: 0, bounds: [{ x: 54, y: 770, width: 140, height: 18 }] }]
      }
      return []
    }

    // 1. Run native PDFium search
    let nativeMatches: Array<{ page: number; bounds: any[] }> = []
    try {
      nativeMatches = await invoke<any[]>("pdf_search_document", { id, query })
    } catch (e) {
      console.warn("[PDF_ENGINE] Native search failed:", e)
    }

    // 2. Fetch all cached OCR/hybrid text from SQLite and in-memory cache
    let dbCachedPages: Array<{
      page_index: number
      source: string
      segments: any[]
    }> = []
    try {
      dbCachedPages = await db.getAllCachedTextForDoc(id, this.fileVersions.get(id) ?? "")
    } catch (e) {
      console.warn("[PDF_ENGINE] Failed to get cached text for search:", e)
    }

    const ocrPagesMap = new Map<number, UnifiedTextSegment[]>()
    for (const p of dbCachedPages) {
      if (p.segments && p.segments.length > 0) {
        ocrPagesMap.set(p.page_index, p.segments)
      }
    }
    // Also merge any in-memory cached hybrid layers
    for (const [key, segments] of this.textLayerCache.entries()) {
      if (key.startsWith(`${id}-`) && key.endsWith("-hybrid")) {
        const match = key.match(/-(\d+)-hybrid$/)
        if (match) {
          const pIdx = parseInt(match[1], 10)
          if (!ocrPagesMap.has(pIdx)) {
            ocrPagesMap.set(pIdx, segments)
          }
        }
      }
    }

    // 3. Search OCR/hybrid pages for query
    const resultsMap = new Map<number, { page: number; bounds: any[] }>()

    // Initialize with native matches
    for (const nm of nativeMatches) {
      resultsMap.set(nm.page, { page: nm.page, bounds: [...nm.bounds] })
    }

    // Search OCR segments for each cached page
    for (const [pageIdx, segments] of ocrPagesMap.entries()) {
      const pageBounds: any[] = []

      // Unreadable segments are excluded from the index: matching them would return
      // confident-looking hits on text the pipeline could not actually read.
      const searchable = segments.filter((segment) => !isUnreadable(segment))

      // Single-segment matching (word or partial word)
      for (let i = 0; i < searchable.length; i++) {
        const seg = searchable[i]
        const segText = seg.text.toLowerCase()

        if (segText.includes(q)) {
          pageBounds.push({
            text: seg.text,
            x: seg.x,
            y: seg.y,
            width: seg.width,
            height: seg.height,
          })
          continue
        }

        // Multi-word phrase search across consecutive segments
        if (q.includes(" ") && i < searchable.length - 1) {
          let phrase = segText
          let endIdx = i
          for (let j = i + 1; j < Math.min(searchable.length, i + 8); j++) {
            phrase += " " + searchable[j].text.toLowerCase()
            if (phrase.includes(q)) {
              endIdx = j
              break
            }
          }
          if (endIdx > i) {
            // Found multi-word match spanning segments i..endIdx
            for (let k = i; k <= endIdx; k++) {
              pageBounds.push({
                text: searchable[k].text,
                x: searchable[k].x,
                y: searchable[k].y,
                width: searchable[k].width,
                height: searchable[k].height,
              })
            }
            i = endIdx // advance index
          }
        }
      }

      if (pageBounds.length > 0) {
        const existing = resultsMap.get(pageIdx)
        if (!existing || existing.bounds.length === 0) {
          resultsMap.set(pageIdx, { page: pageIdx, bounds: pageBounds })
        } else {
          // Merge avoiding duplicates
          const seen = new Set(
            existing.bounds.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`),
          )
          for (const pb of pageBounds) {
            const key = `${Math.round(pb.x)},${Math.round(pb.y)}`
            if (!seen.has(key)) {
              existing.bounds.push(pb)
              seen.add(key)
            }
          }
        }
      }
    }

    return Array.from(resultsMap.values()).sort((a, b) => a.page - b.page)
  }

  public static async getPageMeta(
    id: string,
    pageIndex: number,
  ): Promise<PageMeta> {
    const key = `${id}-${pageIndex}`
    if (this.pageMetaCache.has(key)) {
      return this.pageMetaCache.get(key)!
    }
    if (!isTauriContext()) {
      const meta = { width: 595, height: 842 }
      this.pageMetaCache.set(key, meta)
      return meta
    }
    const meta = await this.withTimeout(
      invoke<PageMeta>("pdf_get_page_meta", { id, pageIndex }),
      "Loading page metadata",
    )
    this.pageMetaCache.set(key, meta)
    return meta
  }

  public static getViewport(
    meta: PageMeta,
    scale: number,
    rotation: number,
  ): Viewport {
    const isLandscape = rotation === 90 || rotation === 270
    return {
      width: isLandscape ? meta.height * scale : meta.width * scale,
      height: isLandscape ? meta.width * scale : meta.height * scale,
      scale,
      rotation,
    }
  }

  public static async renderPage(
    id: string,
    pageIndex: number,
    scale: number,
    rotation: number,
    priority = 0,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    if (!isTauriContext()) {
      const meta = { width: 595, height: 842 }
      const vp = this.getViewport(meta, scale, rotation)
      const w = Math.max(1, Math.round(vp.width))
      const h = Math.max(1, Math.round(vp.height))
      // Must match the native contract exactly: an 8-byte little-endian width/height
      // header followed by BGRA pixels. Without the header every page failed to decode in
      // the browser preview with "Invalid PDF bitmap".
      const buf = new Uint8Array(8 + w * h * 4)
      const header = new DataView(buf.buffer)
      header.setUint32(0, w, true)
      header.setUint32(4, h, true)
      buf.fill(255, 8)
      return buf
    }
    const key = `${id}|${pageIndex}|${scale}|${rotation}`
    const cached = this.renderCache.get(key)
    if (cached) {
      this.renderCache.delete(key)
      this.renderCache.set(key, cached)
      return cached
    }
    const queued = this.queuedRenders.get(key)
    if (queued) return queued

    let cleanupAbort: (() => void) | undefined
    const promise = new Promise<Uint8Array>((resolve, reject) => {
      const generation = this.documentGenerations.get(id) ?? 0

      const task = {
        key,
        priority,
        run: async () => {
          const response = await this.withTimeout(
            invoke<ArrayBuffer | number[]>("pdf_render_page", {
              id,
              pageIndex,
              scale,
              rotation,
            }),
            "Rendering PDF page",
          )
          return response instanceof ArrayBuffer
            ? new Uint8Array(response)
            : new Uint8Array(response as number[])
        },
        resolve: (bytes: Uint8Array) => {
          if ((this.documentGenerations.get(id) ?? 0) === generation && bytes.byteLength <= this.maxRenderCacheBytes) {
            this.renderCache.set(key, bytes)
            const cachedBytes = () =>
              [...this.renderCache.values()].reduce((total, item) => total + item.byteLength, 0)
            while (this.renderCache.size > this.maxRenderCacheEntries || cachedBytes() > this.maxRenderCacheBytes) {
              const oldest = this.renderCache.keys().next().value
              if (oldest) this.renderCache.delete(oldest)
              else break
            }
          }
          resolve(bytes)
        },
        reject,
      }

      const onAbort = () => {
        const idx = this.pendingRenders.indexOf(task)
        if (idx !== -1) {
          this.pendingRenders.splice(idx, 1)
          reject(new DOMException("Aborted", "AbortError"))
        }
      }

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"))
          return
        }
        signal.addEventListener("abort", onAbort, { once: true })
        cleanupAbort = () => signal.removeEventListener("abort", onAbort)
      }

      this.pendingRenders.push(task)
      this.pendingRenders.sort((a, b) => b.priority - a.priority)
      this.pumpRenders()
    }).finally(() => {
      cleanupAbort?.()
      if (this.queuedRenders.get(key) === promise) this.queuedRenders.delete(key)
    })
    this.queuedRenders.set(key, promise)
    return promise
  }

  private static pumpRenders() {
    while (
      this.activeRenders < this.maxConcurrentRenders &&
      this.pendingRenders.length > 0
    ) {
      const request = this.pendingRenders.shift()!
      this.activeRenders += 1
      request
        .run()
        .then((bytes) => {
          request.resolve(bytes)
        })
        .catch(request.reject)
        .finally(() => {
          this.activeRenders -= 1
          this.pumpRenders()
        })
    }
  }
}
