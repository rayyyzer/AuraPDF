import type Database from "@tauri-apps/plugin-sql"
import { Doc, Bookmark } from "../../types"
import { isTauriContext } from "../tauri"

export function normalizeDocumentPath(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (trimmed.startsWith("\\\\?\\UNC\\")) {
    return "\\\\" + trimmed.slice(8)
  }
  if (trimmed.startsWith("\\\\?\\")) {
    return trimmed.slice(4)
  }
  return trimmed
}

let dbOperationQueue: Promise<void> = Promise.resolve()

function enqueueDbOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = dbOperationQueue.then(operation)
  dbOperationQueue = next.then(() => undefined, () => undefined)
  return next
}

async function withTransaction<T>(db: Database, operation: () => Promise<T>): Promise<T> {
  await db.execute("BEGIN IMMEDIATE")
  try {
    const result = await operation()
    await db.execute("COMMIT")
    return result
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined)
    throw error
  }
}

function getDbPromise(): Promise<Database | null> | null {
  if (typeof window !== "undefined")
    return (window as any).__dbInstancePromise || null
  return null
}
function setDbPromise(p: Promise<Database | null> | null) {
  if (typeof window !== "undefined") (window as any).__dbInstancePromise = p
}

export function resetDbConnection(): void {
  setDbPromise(null)
}

export function getDb(): Promise<Database | null> {
  const existing = getDbPromise()
  if (existing) return existing
  if (!isTauriContext()) return Promise.resolve(null)

  const p = (async () => {
    try {
      const Database = (await import("@tauri-apps/plugin-sql")).default
      const db = await Database.load("sqlite:aurapdf.db")
      try {
        await db.execute("PRAGMA journal_mode = WAL;")
        await db.execute("PRAGMA synchronous = NORMAL;")
        await db.execute("PRAGMA busy_timeout = 5000;")
        await db.execute("PRAGMA foreign_keys = ON;")
      } catch (pragmaErr) {
        console.warn("[DB] Failed to configure SQLite pragmas:", pragmaErr)
      }
      await initSchema(db)
      return db
    } catch (error) {
      console.error("Failed to load db:", error)
      // Clear cached promise on failure so subsequent calls can retry
      setDbPromise(null)
      return null
    }
  })()
  setDbPromise(p)
  return p
}

async function initSchema(db: Database) {
  await withTransaction(db, async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      filename TEXT NOT NULL,
      pages INTEGER NOT NULL,
      size TEXT NOT NULL,
      last_accessed TEXT NOT NULL,
      created TEXT NOT NULL,
      favorite BOOLEAN NOT NULL DEFAULT 0,
      folder TEXT NOT NULL,
      color TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      in_library BOOLEAN NOT NULL DEFAULT 1
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created TEXT NOT NULL
    )
  `)

  const documentColumns = await db.select<{ name: string }[]>(
    "PRAGMA table_info(documents)",
  )
  if (!documentColumns.some((column) => column.name === "folder_id")) {
    await db.execute("ALTER TABLE documents ADD COLUMN folder_id TEXT")
  }
  if (!documentColumns.some((column) => column.name === "in_library")) {
    await db.execute(
      "ALTER TABLE documents ADD COLUMN in_library BOOLEAN NOT NULL DEFAULT 1",
    )
  }

  await db.execute(`
    UPDATE documents
    SET folder_id = (
      SELECT folders.id
      FROM folders
      WHERE folders.name = documents.folder
    )
    WHERE (folder_id IS NULL OR folder_id = '') AND folder <> ''
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reader_state (
      doc_id TEXT PRIMARY KEY,
      page INTEGER NOT NULL DEFAULT 1,
      zoom INTEGER NOT NULL DEFAULT 100,
      rotation INTEGER NOT NULL DEFAULT 0,
      view_mode TEXT NOT NULL DEFAULT 'single',
      FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      page INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      label TEXT NOT NULL,
      FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_tabs (
      idx INTEGER PRIMARY KEY,
      doc_id TEXT NOT NULL,
      FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_tab_idx INTEGER NOT NULL DEFAULT 0
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      page_number INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  // Non-destructive migration for annotations: add missing page_number column if legacy table exists
  const annColumns = await db.select<{ name: string }[]>(
    "PRAGMA table_info(annotations)",
  )
  if (annColumns.length > 0) {
    const hasPageNumber = annColumns.some((c) => c.name === "page_number")
    const hasPage = annColumns.some((c) => c.name === "page")
    if (!hasPageNumber) {
      await db.execute(
        "ALTER TABLE annotations ADD COLUMN page_number INTEGER NOT NULL DEFAULT 1",
      )
      if (hasPage) {
        await db.execute(
          "UPDATE annotations SET page_number = page WHERE page IS NOT NULL AND page_number = 1",
        )
      }
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS page_text_cache (
      doc_id TEXT NOT NULL,
      page_index INTEGER NOT NULL,
      source TEXT NOT NULL,
      file_version TEXT NOT NULL DEFAULT '',
      char_count INTEGER NOT NULL,
      segments_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (doc_id, page_index),
      FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  const cacheColumns = await db.select<{ name: string }[]>(
    "PRAGMA table_info(page_text_cache)",
  )
  if (!cacheColumns.some((column) => column.name === "file_version")) {
    await db.execute(
      "ALTER TABLE page_text_cache ADD COLUMN file_version TEXT NOT NULL DEFAULT ''",
    )
  }

  // Marks rows produced by an explicit user re-read of a region, so the automatic
  // page pass does not overwrite a result the user asked for.
  if (!cacheColumns.some((column) => column.name === "manual")) {
    await db.execute(
      "ALTER TABLE page_text_cache ADD COLUMN manual INTEGER NOT NULL DEFAULT 0",
    )
  }

  // Guarded one-time migration table to prevent repeated deletions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const migrationRows = await db.select<{ version: number }[]>(
    "SELECT version FROM schema_migrations WHERE version = 1",
  )
  if (migrationRows.length === 0) {
    // Only remove initial placeholder demo IDs on first migration, not on every app launch
    await db.execute(`
      DELETE FROM documents 
      WHERE id IN ('d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8')
        AND (path IS NULL OR path = '' OR path LIKE 'mock://%')
    `)
    await db.execute(
      "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
      [new Date().toISOString()],
    )
  }
  })
}

async function upsertDocRow(d: Database, doc: Doc & { path?: string }) {
  const cleanId = normalizeDocumentPath(doc.id)
  const cleanPath = normalizeDocumentPath(doc.path || doc.id)

  const existingRows = await d.select<{
    id: string
    in_library: number
    favorite: number
    folder: string
    folder_id: string | null
  }[]>(
    `SELECT id, in_library, favorite, folder, folder_id
     FROM documents
     WHERE lower(id) = lower(?1) OR lower(path) = lower(?2)
     LIMIT 1`,
    [cleanId, cleanPath],
  )

  const existing = existingRows[0]
  const canonicalId = existing ? existing.id : cleanId
  const nextInLibrary = existing
    ? existing.in_library || (doc.inLibrary !== false ? 1 : 0)
    : doc.inLibrary === false
      ? 0
      : 1

  await d.execute(
    `INSERT INTO documents (id, path, filename, pages, size, last_accessed, created, favorite, folder, folder_id, color, excerpt, in_library)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
     ON CONFLICT(id) DO UPDATE SET
       last_accessed=?6,
       size=?5,
       pages= CASE WHEN ?4 > 0 THEN ?4 ELSE documents.pages END,
       favorite=?8,
       folder= CASE WHEN ?9 <> '' THEN ?9 ELSE documents.folder END,
       folder_id=COALESCE(?10, documents.folder_id),
       in_library=MAX(documents.in_library, ?13)`,
    [
      canonicalId,
      cleanPath,
      doc.name,
      doc.pages,
      doc.size,
      doc.lastOpened,
      doc.created,
      doc.favorite ? 1 : 0,
      doc.folder || (nextInLibrary ? "Local" : ""),
      doc.folderId ?? null,
      doc.color,
      doc.excerpt,
      nextInLibrary ? 1 : 0,
    ],
  )
}

interface MockStorageState {
  docs: (Doc & { path: string })[]
  folders: { id: string; name: string; created: string }[]
  readerStates: Record<string, any>
  session: { activeTabIdx: number; tabs: string[] } | null
  annotations: Record<string, any[]>
}

function getMockState(): MockStorageState {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("aura:mock_storage") : null
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    docs: [
      {
        id: "mock-sample-1",
        name: "Welcome to AuraPDF.pdf",
        path: "mock://welcome-to-aurapdf.pdf",
        pages: 5,
        size: "245 KB",
        lastOpened: new Date().toISOString(),
        created: new Date().toISOString(),
        favorite: true,
        folder: "Guides",
        color: "#7C5CFC",
        excerpt: "Welcome to AuraPDF — High Performance Native PDF Reader & Library Manager.",
        tags: ["guide", "featured"],
        inLibrary: true,
      },
      {
        id: "mock-sample-2",
        name: "Research Paper on Typography.pdf",
        path: "mock://research-paper.pdf",
        pages: 12,
        size: "1.2 MB",
        lastOpened: new Date(Date.now() - 3600000).toISOString(),
        created: new Date(Date.now() - 86400000).toISOString(),
        favorite: false,
        folder: "Research",
        color: "#38BDF8",
        excerpt: "An exploration of fluid reading experiences and crisp vector annotations.",
        tags: ["research"],
        inLibrary: true,
      },
    ],
    folders: [
      { id: "f-1", name: "Guides", created: new Date().toISOString() },
      { id: "f-2", name: "Research", created: new Date().toISOString() },
    ],
    readerStates: {},
    session: null,
    annotations: {},
  }
}

function saveMockState(state: MockStorageState) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("aura:mock_storage", JSON.stringify(state))
    }
  } catch {}
}

// Data Access Layer
export const db = {
  async saveDoc(doc: Doc & { path?: string }) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        const existingIdx = mock.docs.findIndex((x) => x.id === doc.id || x.path === doc.path)
        const item: Doc & { path: string } = {
          ...doc,
          path: doc.path || doc.id,
          tags: doc.tags || [],
          inLibrary: doc.inLibrary !== false,
        }
        if (existingIdx >= 0) mock.docs[existingIdx] = item
        else mock.docs.push(item)
        saveMockState(mock)
        return
      }
      await upsertDocRow(d, doc)
    })
  },

  async saveDocs(docs: (Doc & { path?: string })[]) {
    if (docs.length === 0) return
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        for (const doc of docs) {
          const existingIdx = mock.docs.findIndex((x) => x.id === doc.id || x.path === doc.path)
          const item: Doc & { path: string } = {
            ...doc,
            path: doc.path || doc.id,
            tags: doc.tags || [],
            inLibrary: doc.inLibrary !== false,
          }
          if (existingIdx >= 0) mock.docs[existingIdx] = item
          else mock.docs.push(item)
        }
        saveMockState(mock)
        return
      }
      await withTransaction(d, async () => {
        for (const doc of docs) {
          await upsertDocRow(d, doc)
        }
      })
    })
  },

  async addToLibrary(
    docId: string,
    options?: { folderId?: string; folderName?: string },
  ) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      const cleanId = normalizeDocumentPath(docId)
      await d.execute(
        `UPDATE documents
         SET in_library = 1,
             folder = CASE WHEN ?2 IS NOT NULL AND ?2 <> '' THEN ?2 WHEN folder = '' THEN 'Local' ELSE folder END,
             folder_id = COALESCE(?3, folder_id)
         WHERE lower(id) = lower(?1) OR lower(path) = lower(?1)`,
        [cleanId, options?.folderName ?? null, options?.folderId ?? null],
      )
    })
  },

  async getDocs(): Promise<(Doc & { path: string })[]> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return getMockState().docs
      const rows = await d.select<any[]>(
        "SELECT * FROM documents ORDER BY last_accessed DESC",
      )
      return rows.map((r) => ({
        id: r.id,
        path: r.path,
        name: r.filename,
        pages: r.pages,
        size: r.size,
        lastOpened: r.last_accessed,
        created: r.created,
        favorite: Boolean(r.favorite),
        folder: r.folder,
        folderId: r.folder_id || undefined,
        color: r.color,
        excerpt: r.excerpt,
        tags: [],
        inLibrary:
          r.in_library === undefined || r.in_library === null
            ? true
            : Boolean(r.in_library),
      }))
    })
  },

  async saveReaderState(
    docId: string,
    state: {
      page: number
      zoom: number
      rotation: number
      viewMode: string
      bookmarks: Bookmark[]
    },
  ) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        mock.readerStates[docId] = state
        saveMockState(mock)
        return
      }
      await withTransaction(d, async () => {
        await d.execute(
          `INSERT INTO reader_state (doc_id, page, zoom, rotation, view_mode)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(doc_id) DO UPDATE SET page=?2, zoom=?3, rotation=?4, view_mode=?5`,
          [docId, state.page, state.zoom, state.rotation, state.viewMode],
        )

        await d.execute("DELETE FROM bookmarks WHERE doc_id = ?1", [docId])
        for (const b of state.bookmarks) {
          await d.execute(
            "INSERT INTO bookmarks (id, doc_id, page, timestamp, label) VALUES (?1, ?2, ?3, ?4, ?5)",
            [
              `${docId}_${b.page}`,
              docId,
              b.page,
              new Date().toISOString(),
              b.label,
            ],
          )
        }
      })
    })
  },

  async getContinueReadingDoc(): Promise<{
    docId: string
    page: number
  } | null> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        if (!mock.docs.length) return null
        return { docId: mock.docs[0].id, page: 1 }
      }
      const rows = await d.select<any[]>(
        `SELECT d.id, r.page 
       FROM documents d
       JOIN reader_state r ON d.id = r.doc_id
       ORDER BY d.last_accessed DESC
       LIMIT 1`,
      )
      if (!rows.length) return null
      return { docId: rows[0].id, page: rows[0].page }
    })
  },

  async getReaderState(docId: string): Promise<any | null> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return getMockState().readerStates[docId] || null
      const rows = await d.select<any[]>(
        "SELECT * FROM reader_state WHERE lower(doc_id) = lower(?1)",
        [docId],
      )
      if (!rows.length) return null
      const bRows = await d.select<any[]>(
        "SELECT * FROM bookmarks WHERE lower(doc_id) = lower(?1)",
        [docId],
      )
      return {
        page: rows[0].page,
        zoom: rows[0].zoom,
        rotation: rows[0].rotation,
        viewMode: rows[0].view_mode,
        bookmarks: bRows.map((r) => ({ page: r.page, label: r.label })),
      }
    })
  },

  async saveSession(activeTabIdx: number, tabs: { doc_id: string }[]) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        mock.session = { activeTabIdx, tabs: tabs.map((t) => t.doc_id) }
        saveMockState(mock)
        return
      }
      await withTransaction(d, async () => {
        await d.execute("DELETE FROM session_tabs")
        for (let i = 0; i < tabs.length; i++) {
          await d.execute(
            "INSERT OR REPLACE INTO session_tabs (idx, doc_id) VALUES (?1, ?2)",
            [i, tabs[i].doc_id],
          )
        }
        await d.execute(
          `INSERT INTO session_state (id, active_tab_idx) VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET active_tab_idx=?1`,
          [activeTabIdx],
        )
      })
    })
  },

  async getSession(): Promise<{ activeTabIdx: number; tabs: string[] } | null> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return getMockState().session
      const stateRows = await d.select<any[]>(
        "SELECT active_tab_idx FROM session_state WHERE id = 1",
      )
      const tabRows = await d.select<any[]>(
        "SELECT doc_id FROM session_tabs ORDER BY idx ASC",
      )
      if (!stateRows.length && !tabRows.length) return null
      return {
        activeTabIdx: stateRows[0]?.active_tab_idx ?? 0,
        tabs: tabRows.map((r) => r.doc_id),
      }
    })
  },

  async deleteDoc(id: string) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        mock.docs = mock.docs.filter((x) => x.id !== id && x.path !== id)
        saveMockState(mock)
        return
      }
      const cleanId = normalizeDocumentPath(id)
      await withTransaction(d, async () => {
        await d.execute(
          "DELETE FROM documents WHERE lower(id)=lower(?1) OR lower(path)=lower(?1) OR lower(id)=lower(?2) OR lower(path)=lower(?2)",
          [id, cleanId],
        )
      })
    })
  },

  // Folders
  async getFolders(): Promise<{ id: string; name: string; created: string }[]> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return getMockState().folders
      return await d.select("SELECT * FROM folders ORDER BY created ASC")
    })
  },
  async createFolder(id: string, name: string) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        if (mock.folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
          throw new Error("A folder with that name already exists.")
        }
        mock.folders.push({ id, name, created: new Date().toISOString() })
        saveMockState(mock)
        return
      }
      const existing = await d.select<{ id: string }[]>(
        "SELECT id FROM folders WHERE lower(name) = lower(?1)",
        [name],
      )
      if (existing.length > 0)
        throw new Error("A folder with that name already exists.")
      const created = new Date().toISOString()
      await d.execute(
        "INSERT INTO folders (id, name, created) VALUES (?1, ?2, ?3)",
        [id, name, created],
      )
    })
  },
  async renameFolder(id: string, newName: string, oldName: string) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      const existing = await d.select<{ id: string }[]>(
        "SELECT id FROM folders WHERE lower(name) = lower(?1) AND id <> ?2",
        [newName, id],
      )
      if (existing.length > 0)
        throw new Error("A folder with that name already exists.")
      await withTransaction(d, async () => {
        await d.execute("UPDATE folders SET name=?1 WHERE id=?2", [newName, id])
        await d.execute(
          "UPDATE documents SET folder=?1 WHERE folder_id=?2 OR folder=?3",
          [newName, id, oldName],
        )
      })
    })
  },
  async deleteFolder(id: string, name: string) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      await withTransaction(d, async () => {
        await d.execute("DELETE FROM folders WHERE id=?1", [id])
        await d.execute(
          "UPDATE documents SET folder='', folder_id=NULL WHERE folder_id=?1 OR folder=?2",
          [id, name],
        )
      })
    })
  },
  async setDocumentFolder(docId: string, folderId: string | null) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      if (folderId) {
        await d.execute(
          `UPDATE documents
         SET folder_id=?1,
             folder=(SELECT name FROM folders WHERE id=?1),
             in_library=1
         WHERE id=?2`,
          [folderId, docId],
        )
      } else {
        await d.execute(
          "UPDATE documents SET folder='', folder_id=NULL WHERE id=?1",
          [docId],
        )
      }
    })
  },
  async setDocumentsFolder(docIds: string[], folderId: string | null) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d || docIds.length === 0) return
      await withTransaction(d, async () => {
        for (const docId of docIds) {
          if (folderId) {
            await d.execute(
              `UPDATE documents SET folder_id=?1,
                 folder=(SELECT name FROM folders WHERE id=?1), in_library=1 WHERE id=?2`,
              [folderId, docId],
            )
          } else {
            await d.execute(
              "UPDATE documents SET folder='', folder_id=NULL WHERE id=?1",
              [docId],
            )
          }
        }
      })
    })
  },

  // Annotations
  async getAnnotations(docId: string): Promise<any[]> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return getMockState().annotations[docId] || []
      const rows = await d.select<any[]>(
        "SELECT * FROM annotations WHERE lower(doc_id) = lower(?1)",
        [docId],
      )
      return rows.map((r) => JSON.parse(r.data))
    })
  },

  async upsertAnnotation(annotation: any) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        const list = mock.annotations[annotation.docId] || []
        const idx = list.findIndex((a: any) => a.id === annotation.id)
        if (idx >= 0) list[idx] = annotation
        else list.push(annotation)
        mock.annotations[annotation.docId] = list
        saveMockState(mock)
        return
      }
      const now = new Date().toISOString()
      await d.execute(
        `INSERT INTO annotations (id, doc_id, page_number, type, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET data=?5, updated_at=?7`,
        [
          annotation.id,
          annotation.docId,
          annotation.page,
          annotation.type,
          JSON.stringify(annotation),
          now,
          now,
        ],
      )
    })
  },

  async deleteAnnotation(docId: string, id: string) {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) {
        const mock = getMockState()
        if (mock.annotations[docId]) {
          mock.annotations[docId] = mock.annotations[docId].filter((a: any) => a.id !== id)
          saveMockState(mock)
        }
        return
      }
      await d.execute(
        "DELETE FROM annotations WHERE lower(doc_id) = lower(?1) AND id = ?2",
        [docId, id],
      )
    })
  },

  // Page text & OCR caching
  async getCachedPageText(
    docId: string,
    pageIndex: number,
    fileVersion = "",
  ): Promise<{ segments: any[]; source: string; manual: boolean } | null> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return null
      const cleanId = normalizeDocumentPath(docId)
      const rows = await d.select<
        { segments_json: string; file_version: string; source: string; manual: number }[]
      >(
        "SELECT segments_json, file_version, source, manual FROM page_text_cache WHERE lower(doc_id) = lower(?1) AND page_index = ?2",
        [cleanId, pageIndex],
      )
      if (!rows.length || rows[0].file_version !== fileVersion) return null
      try {
        return {
          segments: JSON.parse(rows[0].segments_json),
          source: rows[0].source,
          manual: Boolean(rows[0].manual),
        }
      } catch {
        return null
      }
    })
  },

  async saveCachedPageText(
    docId: string,
    pageIndex: number,
    source: string,
    segments: any[],
    fileVersion = "",
    manual = false,
  ): Promise<void> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      const cleanId = normalizeDocumentPath(docId)
      const now = new Date().toISOString()
      const charCount = segments.reduce(
        (sum, s) => sum + (s.text?.length || 0),
        0,
      )
      const json = JSON.stringify(segments)
      await d.execute(
        `INSERT INTO page_text_cache (doc_id, page_index, source, file_version, char_count, segments_json, created_at, manual)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(doc_id, page_index) DO UPDATE SET
           source = ?3,
           file_version = ?4,
           char_count = ?5,
           segments_json = ?6,
           created_at = ?7,
           manual = ?8`,
        [cleanId, pageIndex, source, fileVersion, charCount, json, now, manual ? 1 : 0],
      )
    })
  },

  async clearCachedPageText(docId: string): Promise<void> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return
      const cleanId = normalizeDocumentPath(docId)
      await d.execute(
        "DELETE FROM page_text_cache WHERE lower(doc_id) = lower(?1)",
        [cleanId],
      )
    })
  },

  async getAllCachedTextForDoc(docId: string, fileVersion?: string): Promise<Array<{
    page_index: number
    source: string
    segments: any[]
  }>> {
    return enqueueDbOperation(async () => {
      const d = await getDb()
      if (!d) return []
      const cleanId = normalizeDocumentPath(docId)
      const rows = await d.select<{
        page_index: number
        source: string
        segments_json: string
      }[]>(
        "SELECT page_index, source, segments_json FROM page_text_cache WHERE lower(doc_id) = lower(?1) AND (?2 IS NULL OR file_version = ?2)",
        [cleanId, fileVersion ?? null],
      )
      return rows.map((r) => {
        let segments: any[] = []
        try {
          segments = JSON.parse(r.segments_json)
        } catch {}
        return {
          page_index: r.page_index,
          source: r.source,
          segments,
        }
      })
    })
  },
}
