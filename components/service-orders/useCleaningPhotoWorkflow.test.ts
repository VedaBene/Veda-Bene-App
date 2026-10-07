import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessedCleaningPhoto } from '@/lib/client/image-processing'

// Node-only harness for the hook's event handlers; queue/scheduler are real.
// React rendering is covered separately through the modal/uploader markup.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, cleanup: undefined as (() => void) | undefined,
}))
const mocks = vi.hoisted(() => ({
  process: vi.fn(), reserve: vi.fn(), finalize: vi.fn(), cancel: vi.fn(), abort: vi.fn(),
  upload: vi.fn(), capture: vi.fn(), breadcrumb: vi.fn(),
}))
vi.mock('react', () => ({
  useState(initial: unknown) {
    const slot = hooks.cursor++
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === 'function' ? initial() : initial
    return [hooks.slots[slot], (value: unknown) => { hooks.slots[slot] = value }]
  },
  useRef(initial: unknown) {
    const slot = hooks.cursor++
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial }
    return hooks.slots[slot]
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (effect: () => () => void) => { hooks.cleanup = effect() },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.capture, addBreadcrumb: mocks.breadcrumb }))
vi.mock('@/lib/client/image-processing', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/client/image-processing')>(),
  processCleaningPhoto: mocks.process,
}))
vi.mock('@/app/(app)/service-orders/photo-actions', () => ({
  reserveCleaningPhoto: mocks.reserve,
  finalizeCleaningPhoto: mocks.finalize,
  cancelCleaningPhoto: mocks.cancel,
  abortCleaningPhoto: mocks.abort,
}))
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } }),
}))

import { useCleaningPhotoWorkflow } from './useCleaningPhotoWorkflow'

const processed: ProcessedCleaningPhoto = {
  display: new Blob(['display'], { type: 'image/webp' }),
  thumbnail: new Blob(['thumbnail'], { type: 'image/webp' }),
  contentType: 'image/webp', width: 1920, height: 1080,
}
function render(enabled = true) {
  hooks.cursor = 0
  // React hooks are explicitly stubbed above for this Node event-handler harness.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCleaningPhotoWorkflow('order-id', 'before', enabled)
}
function select(...files: File[]) { return files as unknown as FileList }
const photo = () => new File(['original'], 'private-name.jpg', { type: 'image/jpeg' })
async function prepare() { await vi.runAllTimersAsync() }

beforeEach(() => {
  vi.clearAllMocks()
  hooks.slots = []
  hooks.cleanup = undefined
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout })
  let id = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumbnail')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  mocks.process.mockResolvedValue(processed)
  mocks.reserve.mockImplementation(async (_order, _phase, photoId, contentType) => ({
    success: true,
    upload: { photoId, contentType, display: { path: 'display', token: 'synthetic' }, thumbnail: { path: 'thumbnail', token: 'synthetic' } },
  }))
  mocks.upload.mockResolvedValue({ error: null })
  mocks.finalize.mockImplementation(async photoId => ({ success: true, photoId }))
  mocks.cancel.mockResolvedValue({ success: true })
  mocks.abort.mockImplementation(async photoId => ({ success: true, status: 'removed', photoId }))
})
afterEach(() => {
  hooks.cleanup?.()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('prepared photo workflow', () => {
  it('blocks upload until prepared, then sends cached variants once without decoding again', async () => {
    render().addFiles(select(photo(), photo()))
    expect(render().isPreparing).toBe(true)
    expect(render().canUpload).toBe(false)
    await expect(render().uploadAll()).rejects.toThrow('Attendi la preparazione')
    expect(mocks.reserve).not.toHaveBeenCalled()
    await prepare()
    expect(render().canUpload).toBe(true)
    expect(render().items.every(item => !('file' in item))).toBe(true)
    expect(URL.createObjectURL).toHaveBeenCalledWith(processed.thumbnail)
    expect(mocks.process).toHaveBeenCalledTimes(2)
    const ids = await render().uploadAll()
    expect(ids).toHaveLength(2)
    expect(mocks.upload).toHaveBeenCalledTimes(4)
    expect(mocks.upload).toHaveBeenNthCalledWith(1, 'display', 'synthetic', processed.display,
      { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    expect(mocks.upload).toHaveBeenNthCalledWith(2, 'thumbnail', 'synthetic', processed.thumbnail,
      { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    expect(await render().uploadAll()).toEqual(ids)
    expect(mocks.reserve).toHaveBeenCalledTimes(2)
    expect(mocks.process).toHaveBeenCalledTimes(2)
    render().reset()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(render().items).toEqual([])
  })

  it('preserves prepared variants on reservation failure and reuses them on manual resubmission', async () => {
    render().addFiles(select(photo()))
    await prepare()
    mocks.reserve.mockResolvedValueOnce({ success: false, code: 'reservation_failed', error: 'Riprova' })
    await expect(render().uploadAll()).rejects.toThrow('Riprova')
    expect(render().items[0]).toMatchObject({ status: 'error', processed })
    expect(render().canUpload).toBe(true)
    await render().uploadAll()
    expect(mocks.process).toHaveBeenCalledTimes(1)
  })

  it('recovers a missing variant with a new reservation without reprocessing or duplicating IDs', async () => {
    render().addFiles(select(photo(), photo()))
    await prepare()
    mocks.finalize.mockResolvedValueOnce({ success: false, code: 'photo_variant_missing', error: 'Variante assente' })
    const uploading = render().uploadAll()
    await vi.runAllTimersAsync()
    const ids = await uploading
    expect(new Set(ids).size).toBe(2)
    expect(mocks.reserve).toHaveBeenCalledTimes(3)
    const reservations = mocks.reserve.mock.calls.map(call => call[2])
    expect(new Set(reservations).size).toBe(3)
    expect(ids).toEqual(reservations.slice(1))
    expect(mocks.abort).toHaveBeenCalledExactlyOnceWith(reservations[0])
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.process).toHaveBeenCalledTimes(2)
    expect(render().items.every(item => item.status === 'ready')).toBe(true)
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('retains the cleanup ID and reconciles it before a manual retry', async () => {
    render().addFiles(select(photo()))
    await prepare()
    mocks.upload.mockResolvedValueOnce({ error: { status: 403 } })
    mocks.abort.mockRejectedValueOnce(new TypeError('offline'))
    await expect(render().uploadAll()).rejects.toThrow('Pulizia del caricamento non confermata')
    const retainedId = render().items[0].photoId
    expect(retainedId).toBeDefined()
    expect(render().items[0].status).toBe('error')
    const ids = await render().uploadAll()
    expect(mocks.abort).toHaveBeenLastCalledWith(retainedId)
    expect(ids[0]).not.toBe(retainedId)
    expect(mocks.process).toHaveBeenCalledTimes(1)
  })

  it('preserves ready after a lost finalization response', async () => {
    render().addFiles(select(photo()))
    await prepare()
    mocks.finalize.mockRejectedValueOnce(new TypeError('lost confirmation'))
    mocks.abort.mockImplementationOnce(async photoId => ({ success: true, status: 'ready', photoId }))
    const ids = await render().uploadAll()
    expect(ids).toHaveLength(1)
    expect(render().items[0]).toMatchObject({ status: 'ready', photoId: ids[0] })
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledTimes(2)
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('blocks sending again when cleanup explicitly requires assistance', async () => {
    render().addFiles(select(photo()))
    await prepare()
    mocks.upload.mockResolvedValueOnce({ error: { status: 403 } })
    mocks.abort.mockResolvedValueOnce({ success: false, code: 'photo_cleanup_manual_attention', error: 'Contatta assistenza' })
    await expect(render().uploadAll()).rejects.toThrow('Contatta assistenza')
    expect(render().canUpload).toBe(false)
    await expect(render().uploadAll()).rejects.toThrow('Contatta assistenza')
    expect(mocks.reserve).toHaveBeenCalledTimes(1)
  })

  it('keeps a processing error per item, continues the next and requires removing the failed item', async () => {
    mocks.process.mockRejectedValueOnce(new Error('Foto non leggibile'))
    render().addFiles(select(photo(), photo()))
    await prepare()
    expect(render().items.map(item => item.status)).toEqual(['error', 'idle'])
    expect(render().isPreparing).toBe(false)
    expect(render().canUpload).toBe(false)
    await expect(render().uploadAll()).rejects.toThrow('Foto non leggibile')
    expect(mocks.capture).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain('private-name')
    expect(mocks.reserve).not.toHaveBeenCalled()
    await render().removeItem(render().items[0].localId)
    expect(render().canUpload).toBe(true)
    await render().uploadAll()
    expect(mocks.process).toHaveBeenCalledTimes(2)
  })

  it.each(['reset', 'discardAll', 'unmount'] as const)('revokes previews on %s and never double revokes', async action => {
    render().addFiles(select(photo(), photo()))
    await prepare()
    if (action === 'unmount') hooks.cleanup?.()
    else await render()[action]()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(render().items).toEqual([])
    hooks.cleanup?.()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it.each(['discardAll', 'unmount'] as const)('drops late decode results when %s occurs during preparation', async action => {
    let finish!: (value: ProcessedCleaningPhoto) => void
    mocks.process.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render().addFiles(select(photo(), photo()))
    await prepare()
    expect(mocks.process).toHaveBeenCalledTimes(1)
    if (action === 'unmount') hooks.cleanup?.()
    else await render().discardAll()
    finish(processed)
    await prepare()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(render().items).toEqual([])
    expect(mocks.process).toHaveBeenCalledTimes(1)
  })

  it('removes one prepared preview and cancels its uploaded reservation without touching other items', async () => {
    render().addFiles(select(photo(), photo()))
    await prepare()
    const ids = await render().uploadAll()
    await render().removeItem(render().items[0].localId)
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith(ids[0])
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(render().items).toHaveLength(1)
    expect(render().items[0].photoId).toBe(ids[1])
  })

  it('discard/close revokes immediately and cancels only uploaded items', async () => {
    render().addFiles(select(photo()))
    await prepare()
    const ids = await render().uploadAll()
    const discarding = render().discardAll()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(render().items).toEqual([])
    await discarding
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith(ids[0])
  })

  it('validates inputs and limits eight across repeated selections before decoding', async () => {
    render(false).addFiles(select(photo()))
    expect(render().items).toEqual([])
    render().addFiles(select(new File(['bad'], 'file.heic', { type: 'image/heic' })))
    expect(render().selectionError).toContain('HEIC')
    render().addFiles(select(...Array.from({ length: 5 }, photo)))
    render().addFiles(select(...Array.from({ length: 4 }, photo)))
    expect(render().items).toHaveLength(8)
    expect(render().selectionError).toContain('massimo 8')
    await prepare()
    expect(mocks.process).toHaveBeenCalledTimes(8)
  })

  it('records a recovered complete retry as info breadcrumbs with decoder/cycle, without exceptions or paths', async () => {
    mocks.process.mockResolvedValue({ ...processed, decoder: 'html_image' })
    render().addFiles(select(photo()))
    await prepare()
    mocks.finalize.mockResolvedValueOnce({ success: false, code: 'photo_variant_missing', error: 'Variante assente' })
    const uploading = render().uploadAll()
    await vi.runAllTimersAsync()
    await uploading
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(mocks.breadcrumb).toHaveBeenLastCalledWith(expect.objectContaining({
      level: 'info', data: expect.objectContaining({ decoder: 'html_image', attempt: '2', retry_result: 'recovered', recovered: 'true' }),
    }))
    const payload = JSON.stringify(mocks.breadcrumb.mock.calls)
    expect(payload).not.toContain('private-name')
    expect(payload).not.toContain('synthetic')
    expect(payload).not.toContain('token')
    expect(mocks.reserve).toHaveBeenCalledTimes(2)
  })

  it('captures a final failure once with bounded tags after two failed cycles', async () => {
    mocks.process.mockResolvedValue({ ...processed, decoder: 'bitmap_default' })
    render().addFiles(select(photo()))
    await prepare()
    mocks.finalize.mockResolvedValue({ success: false, code: 'photo_variant_missing', error: 'Variante assente' })
    const failure = expect(render().uploadAll()).rejects.toThrow('Variante assente')
    await vi.runAllTimersAsync()
    await failure
    expect(mocks.capture).toHaveBeenCalledTimes(1)
    expect(mocks.capture.mock.calls[0][1].tags).toMatchObject({
      stage: 'finalization', attempt: '2', decoder: 'bitmap_default', retry_result: 'failed', recovered: 'false', failure_code: 'photo_variant_missing',
    })
  })

  it('recovers a transient PUT once and keeps telemetry failure from affecting the upload', async () => {
    render().addFiles(select(photo()))
    await prepare()
    mocks.upload.mockResolvedValueOnce({ error: { status: 503 } })
    mocks.breadcrumb.mockImplementationOnce(() => { throw new Error('telemetry unavailable') })
    const uploading = render().uploadAll()
    await vi.runAllTimersAsync()
    await uploading
    expect(mocks.upload).toHaveBeenCalledTimes(3)
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(mocks.breadcrumb).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempt: '1', recovered: 'true' }) }))
  })
})
