import { describe, expect, it, vi } from 'vitest'
import { appendWithinLimit, createCleaningPhotoPreparationQueue, createSequentialPhotoPreparation } from './cleaning-photo-queue'
import type { ProcessedCleaningPhoto } from './image-processing'

describe('cleaning photo queue limit', () => {
  it('never exceeds the limit across consecutive additions', () => {
    const createItem = vi.fn((candidate: string) => `photo-${candidate}`)

    const first = appendWithinLimit([], ['1', '2', '3', '4', '5'], 8, createItem)
    const second = appendWithinLimit(first.items, ['6', '7', '8', '9'], 8, createItem)

    expect(second.items).toEqual([
      'photo-1',
      'photo-2',
      'photo-3',
      'photo-4',
      'photo-5',
      'photo-6',
      'photo-7',
      'photo-8',
    ])
    expect(second.rejectedCount).toBe(1)
    expect(createItem).not.toHaveBeenCalledWith('9')
  })

  it('rejects all new candidates when the queue is already full', () => {
    const createItem = vi.fn((candidate: string) => candidate)
    const current = Array.from({ length: 8 }, (_, index) => String(index))

    const result = appendWithinLimit(current, ['extra'], 8, createItem)

    expect(result.items).toEqual(current)
    expect(result.rejectedCount).toBe(1)
    expect(createItem).not.toHaveBeenCalled()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function variants(): ProcessedCleaningPhoto {
  return {
    display: new Blob(['display'], { type: 'image/webp' }),
    thumbnail: new Blob(['thumbnail'], { type: 'image/webp' }),
    contentType: 'image/webp', width: 1920, height: 1080,
  }
}

function setup() {
  const decodes: ReturnType<typeof deferred<ProcessedCleaningPhoto>>[] = []
  let active = 0
  let maximumActive = 0
  let id = 0
  let url = 0
  const process = vi.fn(async () => {
    active += 1
    maximumActive = Math.max(maximumActive, active)
    const decode = deferred<ProcessedCleaningPhoto>()
    decodes.push(decode)
    try { return await decode.promise } finally { active -= 1 }
  })
  const deps = {
    process,
    createPreview: vi.fn(() => `blob:thumbnail-${++url}`),
    revokePreview: vi.fn(),
    createId: () => `local-${++id}`,
    yieldToBrowser: vi.fn(async () => {}),
    runExclusive: createSequentialPhotoPreparation(),
    onFailure: vi.fn(),
  }
  const queue = createCleaningPhotoPreparationQueue(deps)
  const files = Array.from({ length: 9 }, (_, index) => new File(['original'], `${index}.jpg`, { type: 'image/jpeg' }))
  return { queue, deps, files, decodes, maximumActive: () => maximumActive }
}

const flush = async () => { for (let index = 0; index < 10; index += 1) await Promise.resolve() }

describe('sequential photo preparation and preview ownership', () => {
  it('shares concurrency 1 across before/after queues, including closing an active queue', async () => {
    const { queue, deps, files, decodes, maximumActive } = setup()
    const after = createCleaningPhotoPreparationQueue(deps)
    queue.add(files.slice(0, 2), 8)
    await flush()
    after.add(files.slice(2, 4), 8)
    await flush()
    expect(deps.process).toHaveBeenCalledTimes(1)
    queue.clear()
    decodes[0].resolve(variants())
    await flush()
    expect(deps.process).toHaveBeenNthCalledWith(2, files[2])
    decodes[1].resolve(variants())
    await flush()
    decodes[2].resolve(variants())
    await flush()
    expect(maximumActive()).toBe(1)
    expect(queue.getSnapshot()).toEqual([])
    expect(after.getSnapshot().map(item => item.status)).toEqual(['idle', 'idle'])
    after.clear()
  })

  it('never decodes a removed job waiting for another queue to release the scheduler', async () => {
    const { queue, deps, files, decodes } = setup()
    const after = createCleaningPhotoPreparationQueue(deps)
    queue.add(files.slice(0, 1), 8)
    await flush()
    after.add(files.slice(1, 2), 8)
    await flush()
    after.clear()
    decodes[0].resolve(variants())
    await flush()
    expect(deps.process).toHaveBeenCalledTimes(1)
    expect(after.getSnapshot()).toEqual([])
    queue.clear()
  })

  it('keeps selection order across additions, prepares once and never retains a File in snapshots', async () => {
    const { queue, deps, files, decodes, maximumActive } = setup()
    queue.add(files.slice(0, 2), 8)
    await flush()
    queue.add(files.slice(2, 4), 8)
    expect(deps.process).toHaveBeenCalledTimes(1)
    for (let index = 0; index < 4; index += 1) {
      expect(deps.process).toHaveBeenNthCalledWith(index + 1, files[index])
      decodes[index].resolve(variants())
      await flush()
    }
    expect(maximumActive()).toBe(1)
    expect(queue.getSnapshot().map(item => item.localId)).toEqual(['local-1', 'local-2', 'local-3', 'local-4'])
    expect(queue.getSnapshot().every(item => item.status === 'idle' && !!item.processed)).toBe(true)
    for (const item of queue.getSnapshot()) {
      expect(item).not.toHaveProperty('file')
      expect(item.source).toEqual({ type: 'image/jpeg', size: files[0].size })
    }
    expect(deps.yieldToBrowser).toHaveBeenCalledTimes(4)
  })

  it('creates previews only from compressed thumbnails, without original URLs', async () => {
    const { queue, deps, files, decodes } = setup()
    queue.add(files.slice(0, 1), 8)
    expect(deps.createPreview).not.toHaveBeenCalled()
    expect(queue.getSnapshot()[0].previewUrl).toBeUndefined()
    await flush()
    const processed = variants()
    decodes[0].resolve(processed)
    await flush()
    expect(deps.createPreview).toHaveBeenCalledExactlyOnceWith(processed.thumbnail)
    expect(queue.getSnapshot()[0].processed).toBe(processed)
    expect(queue.getSnapshot()[0].previewUrl).toBe('blob:thumbnail-1')
  })

  it('enforces eight before processing and recovers capacity after individual removal', async () => {
    const { queue, deps, files } = setup()
    expect(queue.add(files, 8)).toBe(1)
    expect(queue.add(files.slice(8), 8)).toBe(1)
    queue.remove('local-8')
    expect(queue.add(files.slice(8), 8)).toBe(0)
    expect(queue.getSnapshot()).toHaveLength(8)
    await flush()
    expect(deps.process).toHaveBeenCalledTimes(1)
    expect(deps.process).not.toHaveBeenCalledWith(files[8])
    queue.clear()
  })

  it('releases each prepared preview once on removal and reset', async () => {
    const { queue, deps, files, decodes } = setup()
    queue.add(files.slice(0, 2), 8)
    await flush()
    decodes[0].resolve(variants())
    await flush()
    decodes[1].resolve(variants())
    await flush()
    queue.remove('local-1')
    queue.remove('local-1')
    queue.clear()
    queue.clear()
    expect(deps.revokePreview.mock.calls).toEqual([['blob:thumbnail-1'], ['blob:thumbnail-2']])
    expect(queue.getSnapshot()).toEqual([])
  })

  it('removes a waiting file without decoding it or disturbing order', async () => {
    const { queue, deps, files, decodes } = setup()
    queue.add(files.slice(0, 3), 8)
    await flush()
    queue.remove('local-2')
    decodes[0].resolve(variants())
    await flush()
    expect(deps.process).toHaveBeenNthCalledWith(2, files[2])
    expect(queue.getSnapshot().map(item => item.localId)).toEqual(['local-1', 'local-3'])
    decodes[1].resolve(variants())
    await flush()
  })

  it.each(['resolve', 'reject'] as const)('ignores an active removed photo that later %ss', async outcome => {
    const { queue, deps, files, decodes } = setup()
    queue.add(files.slice(0, 2), 8)
    await flush()
    queue.remove('local-1')
    if (outcome === 'resolve') decodes[0].resolve(variants())
    else decodes[0].reject(new Error('decode failed'))
    await flush()
    expect(deps.createPreview).not.toHaveBeenCalled()
    expect(deps.onFailure).not.toHaveBeenCalled()
    expect(deps.process).toHaveBeenNthCalledWith(2, files[1])
    decodes[1].resolve(variants())
    await flush()
    expect(queue.getSnapshot()).toHaveLength(1)
  })

  it('close/reset clears waiting files and ignores a late decode; reopen remains serial', async () => {
    const { queue, deps, files, decodes, maximumActive } = setup()
    queue.add(files.slice(0, 3), 8)
    await flush()
    queue.clear()
    queue.add(files.slice(3, 4), 8)
    await flush()
    expect(deps.process).toHaveBeenCalledTimes(1)
    decodes[0].resolve(variants())
    await flush()
    expect(deps.createPreview).not.toHaveBeenCalled()
    expect(deps.process).toHaveBeenNthCalledWith(2, files[3])
    decodes[1].resolve(variants())
    await flush()
    expect(maximumActive()).toBe(1)
    expect(queue.getSnapshot().map(item => item.localId)).toEqual(['local-4'])
    queue.clear()
    expect(deps.revokePreview).toHaveBeenCalledExactlyOnceWith('blob:thumbnail-1')
  })

  it('isolates processing failure, reports only metadata and continues even if reporting fails', async () => {
    const { queue, deps, files, decodes } = setup()
    deps.onFailure.mockImplementation(() => { throw new Error('telemetry unavailable') })
    queue.add(files.slice(0, 2), 8)
    await flush()
    const error = new Error('Foto non leggibile')
    decodes[0].reject(error)
    await flush()
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'error', error: error.message })
    expect(queue.getSnapshot()[0].processed).toBeUndefined()
    expect(deps.createPreview).not.toHaveBeenCalled()
    expect(deps.onFailure).toHaveBeenCalledExactlyOnceWith(error, { type: files[0].type, size: files[0].size })
    decodes[1].resolve(variants())
    await flush()
    expect(queue.getSnapshot()[1].status).toBe('idle')
    queue.clear()
    expect(deps.revokePreview).toHaveBeenCalledTimes(1)
  })

  it('handles thumbnail URL creation failure without retaining the original or variants', async () => {
    const { queue, deps, files, decodes } = setup()
    deps.createPreview.mockImplementationOnce(() => { throw new Error('URL unavailable') })
    queue.add(files.slice(0, 2), 8)
    await flush()
    decodes[0].resolve(variants())
    await flush()
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'error', error: 'URL unavailable' })
    expect(queue.getSnapshot()[0].processed).toBeUndefined()
    expect(deps.revokePreview).not.toHaveBeenCalled()
    decodes[1].resolve(variants())
    await flush()
    queue.clear()
    expect(deps.revokePreview).toHaveBeenCalledTimes(1)
  })
})
