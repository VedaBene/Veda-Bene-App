import type { ProcessedCleaningPhoto } from './image-processing'

export type CleaningPhotoQueueItem = {
  localId: string
  source: Pick<File, 'type' | 'size'>
  processed?: ProcessedCleaningPhoto
  previewUrl?: string
  status: 'queued' | 'processing' | 'idle' | 'uploading' | 'ready' | 'error'
  error?: string
  photoId?: string
  cleanupRequiresSupport?: boolean
}

type PreparationDependencies = {
  process: (file: File) => Promise<ProcessedCleaningPhoto>
  createPreview: (thumbnail: Blob) => string
  revokePreview: (url: string) => void
  createId: () => string
  yieldToBrowser: () => Promise<void>
  runExclusive?: (task: () => Promise<void>) => Promise<void>
  onFailure: (error: unknown, source: CleaningPhotoQueueItem['source']) => void
}

// Share this scheduler across before/after queues: closing one modal cannot
// overlap its still-running native decoder with a selection in another modal.
export function createSequentialPhotoPreparation() {
  let previous: Promise<void> = Promise.resolve()
  return (task: () => Promise<void>) => {
    const current = previous.then(task)
    previous = current.catch(() => undefined)
    return current
  }
}

// Originals live only in pending jobs and the single active decoder, never in
// the rendered/upload queue. Dependencies keep scheduling and URL ownership testable.
export function createCleaningPhotoPreparationQueue(deps: PreparationDependencies) {
  let items: CleaningPhotoQueueItem[] = []
  let jobs: { localId: string; file: File }[] = []
  let running = false
  const listeners = new Set<() => void>()
  const publish = (next: CleaningPhotoQueueItem[]) => {
    items = next
    listeners.forEach(listener => listener())
  }
  const update = (localId: string, patch: Partial<CleaningPhotoQueueItem>) => {
    publish(items.map(item => item.localId === localId ? { ...item, ...patch } : item))
  }
  const release = (item: CleaningPhotoQueueItem) => {
    if (item.previewUrl) deps.revokePreview(item.previewUrl)
  }

  async function prepare(localId: string, file: File) {
    const item = items.find(candidate => candidate.localId === localId)
    if (!item) return
    update(localId, { status: 'processing' })
    let previewUrl: string | undefined
    try {
      const processed = await deps.process(file)
      // Removed/closed while decoding: drop the variants without creating a URL.
      if (!items.some(candidate => candidate.localId === localId)) return
      previewUrl = deps.createPreview(processed.thumbnail)
      update(localId, { processed, previewUrl, status: 'idle' })
      previewUrl = undefined // Ownership transferred to the queue.
    } catch (error) {
      if (!items.some(candidate => candidate.localId === localId)) return
      update(localId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Errore durante la preparazione della foto.',
      })
      try {
        deps.onFailure(error, item.source)
      } catch {
        // Reporting must not strand the remaining photos in the queue.
      }
    } finally {
      if (previewUrl) deps.revokePreview(previewUrl)
    }
  }

  async function drain() {
    if (running) return
    running = true
    try {
      while (jobs.length > 0) {
        // Let React paint progress and handle removal/close before each decode.
        await deps.yieldToBrowser()
        const job = jobs.shift()
        if (job) {
          const task = () => prepare(job.localId, job.file)
          await (deps.runExclusive ? deps.runExclusive(task) : task())
        }
      }
    } finally {
      running = false
    }
  }

  return {
    getSnapshot: () => items,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    add(files: readonly File[], limit: number) {
      const result = appendWithinLimit(items, files, limit, file => {
        const localId = deps.createId()
        jobs.push({ localId, file })
        return { localId, source: { type: file.type, size: file.size }, status: 'queued' as const }
      })
      publish(result.items)
      void drain()
      return result.rejectedCount
    },
    update,
    remove(localId: string) {
      const item = items.find(candidate => candidate.localId === localId)
      if (!item) return
      jobs = jobs.filter(job => job.localId !== localId)
      release(item)
      publish(items.filter(candidate => candidate.localId !== localId))
    },
    clear() {
      jobs = []
      items.forEach(release)
      publish([])
      // Do not reset running: an uncancellable decode may still be active.
    },
  }
}

export function appendWithinLimit<TItem, TCandidate>(
  current: readonly TItem[],
  candidates: readonly TCandidate[],
  limit: number,
  createItem: (candidate: TCandidate) => TItem,
) {
  const available = Math.max(0, limit - current.length)
  const acceptedCandidates = candidates.slice(0, available)
  const added = acceptedCandidates.map(createItem)

  return {
    items: [...current, ...added],
    rejectedCount: candidates.length - acceptedCandidates.length,
  }
}
