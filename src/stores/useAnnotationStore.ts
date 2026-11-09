import { create } from "zustand"
import { db } from "../services/db"

export type AnnotationType = "highlight" | "underline" | "strikethrough" | "pen" | "shape" | "text" | "note"

export interface BaseAnnotation {
  id: string
  docId: string
  page: number
  color: string
  type: AnnotationType
}

export interface RectAnnotation extends BaseAnnotation {
  type: "underline" | "strikethrough"
  rects: { x: number; y: number; width: number; height: number }[]
  selectedText?: string
  opacity?: number
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight"
  points?: { x: number; y: number }[]
  rects?: { x: number; y: number; width: number; height: number }[]
  strokeWidth?: number
  opacity?: number
  selectedText?: string
}

export interface PenAnnotation extends BaseAnnotation {
  type: "pen"
  points: { x: number; y: number }[]
  strokeWidth: number
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: "shape"
  shapeType: "rectangle" | "circle" | "line"
  rect: { x: number; y: number; width: number; height: number }
  strokeWidth: number
  fillColor?: string
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text"
  x: number
  y: number
  text: string
  fontSize: number
  width?: number
  height?: number
}

export interface NoteAnnotation extends BaseAnnotation {
  type: "note"
  x: number
  y: number
  note: string
}

export type Annotation = RectAnnotation | HighlightAnnotation | PenAnnotation | ShapeAnnotation | TextAnnotation | NoteAnnotation

export interface AnnotationToolSettings {
  highlightColor: string
  highlightWidth: number
  highlightStraighten: boolean
  penColor: string
  penWidth: number
  shapeColor: string
  shapeWidth: number
  shapeType: "rectangle" | "circle" | "line"
  noteColor: string
  eraserRadius: number
  eraserMode: "partial" | "object"
}

export const HIGHLIGHT_PALETTE = [
  { label: "Amber Gold", value: "#F6D860" },
  { label: "Sage Mint", value: "#A3D9A5" },
  { label: "Dusty Rose", value: "#F4A6B8" },
  { label: "Slate Sky", value: "#94C9EB" },
  { label: "Warm Apricot", value: "#F7B980" },
] as const

export const PEN_PALETTE = [
  { label: "Charcoal Ink", value: "#272522" },
  { label: "Oxblood Red", value: "#C0392B" },
  { label: "Prussian Blue", value: "#29527A" },
  { label: "Forest Green", value: "#2E6F40" },
  { label: "Warm Ochre", value: "#B7791F" },
] as const

interface RectBox {
  x: number
  y: number
  width: number
  height: number
}

function getRectOverlapRatio(r1: RectBox, r2: RectBox): number {
  const xOverlap = Math.max(
    0,
    Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x),
  )
  const yOverlap = Math.max(
    0,
    Math.min(r1.y + r1.height, r2.y + r2.height) - Math.max(r1.y, r2.y),
  )
  const intersectionArea = xOverlap * yOverlap
  if (intersectionArea <= 0) return 0
  const minArea = Math.min(r1.width * r1.height, r2.width * r2.height)
  return minArea > 0 ? intersectionArea / minArea : 0
}

function getPointsBoundingBox(pts: { x: number; y: number }[]): RectBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

const persistenceQueues = new Map<string, Promise<void>>()

function enqueuePersistence(docId: string, operation: () => Promise<void>) {
  const previous = persistenceQueues.get(docId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(operation)
    .finally(() => {
      if (persistenceQueues.get(docId) === next) {
        persistenceQueues.delete(docId)
      }
    })
  persistenceQueues.set(docId, next)
  next.catch((error) => console.error("Failed to persist annotation", error))
}

interface AnnotationState {
  annotations: Record<string, Annotation[]>
  undoStack: Record<string, any[]>
  redoStack: Record<string, any[]>
  toolSettings: AnnotationToolSettings

  setToolSettings: (updates: Partial<AnnotationToolSettings>) => void
  loadAnnotations: (docId: string) => Promise<void>
  setAnnotations: (docId: string, annotations: Annotation[]) => void
  addAnnotation: (annotation: Annotation) => void
  deleteAnnotation: (docId: string, id: string) => void
  updateAnnotation: (
    docId: string,
    id: string,
    updates: Partial<Annotation>,
  ) => void
  undo: (docId: string) => void
  redo: (docId: string) => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  annotations: {},
  undoStack: {},
  redoStack: {},
  toolSettings: {
    highlightColor: "#F6D860",
    highlightWidth: 16,
    highlightStraighten: true,
    penColor: "#C0392B",
    penWidth: 2.5,
    shapeColor: "#29527A",
    shapeWidth: 2,
    shapeType: "rectangle",
    noteColor: "#F6D860",
    eraserRadius: 20,
    eraserMode: "partial",
  },

  setToolSettings: (updates) =>
    set((state) => ({
      toolSettings: { ...state.toolSettings, ...updates },
    })),

  loadAnnotations: async (docId) => {
    try {
      const annotations = await db.getAnnotations(docId)
      set((state) => ({
        annotations: {
          ...state.annotations,
          [docId]: annotations,
        },
      }))
    } catch (e) {
      console.error(e)
    }
  },

  setAnnotations: (docId, annotations) =>
    set((state) => ({
      annotations: {
        ...state.annotations,
        [docId]: annotations,
      },
    })),

  addAnnotation: (annotation) => {
    set((state) => {
      let docAnns = state.annotations[annotation.docId] || []
      const uStack = state.undoStack[annotation.docId] || []
      const replaced: {
        original: Annotation
        updated?: Annotation
        deleted?: boolean
      }[] = []

      // Highlight deduplication & color replacement
      if (annotation.type === "highlight") {
        const newHighlight = annotation as HighlightAnnotation
        const newRects = newHighlight.rects
        const newPoints = newHighlight.points

        if (newRects && newRects.length > 0) {
          const nextDocAnns: Annotation[] = []
          for (const ann of docAnns) {
            if (ann.page === annotation.page && ann.type === "highlight") {
              const hAnn = ann as HighlightAnnotation
              if (hAnn.rects && hAnn.rects.length > 0) {
                // Check which rects in previous highlight overlap with the newly added highlight rects
                const remainingRects = hAnn.rects.filter(
                  (r) => !newRects.some((nr) => getRectOverlapRatio(r, nr) > 0.35),
                )
                if (remainingRects.length === 0) {
                  // Fully superseded by new highlight color
                  replaced.push({ original: ann, deleted: true })
                  enqueuePersistence(annotation.docId, () =>
                    db.deleteAnnotation(annotation.docId, ann.id),
                  )
                  continue
                } else if (remainingRects.length < hAnn.rects.length) {
                  // Partially trimmed previous highlight
                  const updatedAnn: HighlightAnnotation = {
                    ...hAnn,
                    rects: remainingRects,
                  }
                  replaced.push({ original: ann, updated: updatedAnn })
                  enqueuePersistence(annotation.docId, () =>
                    db.upsertAnnotation(updatedAnn),
                  )
                  nextDocAnns.push(updatedAnn)
                  continue
                }
              }
            }
            nextDocAnns.push(ann)
          }
          docAnns = nextDocAnns
        } else if (newPoints && newPoints.length > 1) {
          const newBBox = getPointsBoundingBox(newPoints)
          const nextDocAnns: Annotation[] = []
          for (const ann of docAnns) {
            if (ann.page === annotation.page && ann.type === "highlight") {
              const hAnn = ann as HighlightAnnotation
              if (hAnn.points && hAnn.points.length > 1) {
                const b = getPointsBoundingBox(hAnn.points)
                if (getRectOverlapRatio(b, newBBox) > 0.65) {
                  replaced.push({ original: ann, deleted: true })
                  enqueuePersistence(annotation.docId, () =>
                    db.deleteAnnotation(annotation.docId, ann.id),
                  )
                  continue
                }
              }
            }
            nextDocAnns.push(ann)
          }
          docAnns = nextDocAnns
        }
      }

      enqueuePersistence(annotation.docId, () => db.upsertAnnotation(annotation))

      return {
        annotations: {
          ...state.annotations,
          [annotation.docId]: [...docAnns, annotation],
        },
        undoStack: {
          ...state.undoStack,
          [annotation.docId]: [
            ...uStack,
            {
              type: "add",
              annotation,
              replaced: replaced.length > 0 ? replaced : undefined,
            },
          ],
        },
        redoStack: {
          ...state.redoStack,
          [annotation.docId]: [],
        },
      }
    })
  },

  deleteAnnotation: (docId, id) => {
    enqueuePersistence(docId, () => db.deleteAnnotation(docId, id))
    set((state) => {
      const docAnns = state.annotations[docId] || []
      const ann = docAnns.find((a) => a.id === id)
      if (!ann) return state

      const uStack = state.undoStack[docId] || []
      return {
        annotations: {
          ...state.annotations,
          [docId]: docAnns.filter((a) => a.id !== id),
        },
        undoStack: {
          ...state.undoStack,
          [docId]: [...uStack, { type: "delete", annotation: ann }],
        },
        redoStack: {
          ...state.redoStack,
          [docId]: [],
        },
      }
    })
  },

  updateAnnotation: (docId, id, updates) => {
    set((state) => {
      const docAnns = state.annotations[docId] || []
      const oldAnn = docAnns.find((a) => a.id === id)
      if (!oldAnn) return state

      const newAnns = docAnns.map((a) =>
        a.id === id ? { ...a, ...updates } as Annotation : a,
      )
      const newAnn = newAnns.find((a) => a.id === id)!
      enqueuePersistence(docId, () => db.upsertAnnotation(newAnn))

      const uStack = state.undoStack[docId] || []
      return {
        annotations: {
          ...state.annotations,
          [docId]: newAnns,
        },
        undoStack: {
          ...state.undoStack,
          [docId]: [
            ...uStack,
            { type: "update", oldAnnotation: oldAnn, newAnnotation: newAnn },
          ],
        },
        redoStack: {
          ...state.redoStack,
          [docId]: [],
        },
      }
    })
  },

  undo: (docId) => {
    set((state) => {
      const uStack = state.undoStack[docId] || []
      if (uStack.length === 0) return state

      const rStack = state.redoStack[docId] || []
      const action = uStack[uStack.length - 1]
      const newUStack = uStack.slice(0, -1)
      const newRStack = [...rStack, action]

      let newAnns = state.annotations[docId] || []

      if (action.type === "add") {
        newAnns = newAnns.filter((a) => a.id !== action.annotation.id)
        enqueuePersistence(docId, () =>
          db.deleteAnnotation(docId, action.annotation.id),
        )
        // Restore any highlights that were superseded or trimmed by this addition
        if (action.replaced && action.replaced.length > 0) {
          for (const rep of action.replaced) {
            if (rep.updated) {
              newAnns = newAnns.filter((a) => a.id !== rep.updated!.id)
            }
            newAnns.push(rep.original)
            enqueuePersistence(docId, () => db.upsertAnnotation(rep.original))
          }
        }
      } else if (action.type === "delete") {
        newAnns = [...newAnns, action.annotation]
        enqueuePersistence(docId, () => db.upsertAnnotation(action.annotation))
      } else if (action.type === "update") {
        newAnns = newAnns.map((a) =>
          a.id === action.oldAnnotation.id ? action.oldAnnotation : a,
        )
        enqueuePersistence(docId, () =>
          db.upsertAnnotation(action.oldAnnotation),
        )
      }

      return {
        annotations: { ...state.annotations, [docId]: newAnns },
        undoStack: { ...state.undoStack, [docId]: newUStack },
        redoStack: { ...state.redoStack, [docId]: newRStack },
      }
    })
  },

  redo: (docId) => {
    set((state) => {
      const rStack = state.redoStack[docId] || []
      if (rStack.length === 0) return state

      const action = rStack[rStack.length - 1]
      const newRStack = rStack.slice(0, -1)
      const uStack = state.undoStack[docId] || []
      const newUStack = [...uStack, action]

      let newAnns = state.annotations[docId] || []

      if (action.type === "add") {
        if (action.replaced && action.replaced.length > 0) {
          for (const rep of action.replaced) {
            if (rep.deleted) {
              newAnns = newAnns.filter((a) => a.id !== rep.original.id)
              enqueuePersistence(docId, () =>
                db.deleteAnnotation(docId, rep.original.id),
              )
            } else if (rep.updated) {
              newAnns = newAnns.map((a) =>
                a.id === rep.original.id ? rep.updated! : a,
              )
              enqueuePersistence(docId, () =>
                db.upsertAnnotation(rep.updated!),
              )
            }
          }
        }
        newAnns = [...newAnns, action.annotation]
        enqueuePersistence(docId, () => db.upsertAnnotation(action.annotation))
      } else if (action.type === "delete") {
        newAnns = newAnns.filter((a) => a.id !== action.annotation.id)
        enqueuePersistence(docId, () =>
          db.deleteAnnotation(docId, action.annotation.id),
        )
      } else if (action.type === "update") {
        newAnns = newAnns.map((a) =>
          a.id === action.newAnnotation.id ? action.newAnnotation : a,
        )
        enqueuePersistence(docId, () =>
          db.upsertAnnotation(action.newAnnotation),
        )
      }

      return {
        annotations: { ...state.annotations, [docId]: newAnns },
        undoStack: { ...state.undoStack, [docId]: newUStack },
        redoStack: { ...state.redoStack, [docId]: newRStack },
      }
    })
  },
}))

export function selectAnnotationsForPage(docId: string, page: number) {
  return (state: AnnotationState) => {
    const docAnns = state.annotations[docId] || []
    return docAnns.filter((a) => a.page === page)
  }
}
