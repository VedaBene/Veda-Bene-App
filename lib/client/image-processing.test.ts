import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { addBreadcrumb } from '@sentry/nextjs'
import {
  containedDimensions,
  encodeCanvasBlob,
  probeCanvasContentType,
  validateSourceImage,
} from './image-processing'

vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn() }))

function canvasReturning(blob: Blob | null): Pick<HTMLCanvasElement, 'toBlob'> {
  return {
    toBlob(callback) {
      callback(blob)
    },
  }
}

describe('cleaning image processing rules', () => {
  it('preserves aspect ratio while bounding the long side', () => {
    expect(containedDimensions(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440 })
    expect(containedDimensions(800, 1200, 480)).toEqual({ width: 320, height: 480 })
  })

  it('rejects oversized and HEIC sources explicitly', () => {
    expect(validateSourceImage({
      size: 21 * 1024 * 1024,
      name: 'large.jpg',
      type: 'image/jpeg',
    } as File)).toContain('20 MB')
    expect(validateSourceImage({
      size: 1024,
      name: 'photo.heic',
      type: 'image/heic',
    } as File)).toContain('HEIC')
  })

  it('accepts JPEG, PNG and WebP sources', () => {
    for (const [name, type] of [
      ['photo.jpg', 'image/jpeg'],
      ['photo.png', 'image/png'],
      ['photo.webp', 'image/webp'],
    ]) {
      expect(validateSourceImage({ size: 1024, name, type } as File)).toBeNull()
    }
  })

  it('detects the content type actually produced by canvas', async () => {
    await expect(probeCanvasContentType(
      canvasReturning(new Blob(['webp'], { type: 'image/webp' })),
      'image/webp',
    )).resolves.toBe(true)
    await expect(probeCanvasContentType(
      canvasReturning(new Blob(['png'], { type: 'image/png' })),
      'image/webp',
    )).resolves.toBe(false)
    await expect(probeCanvasContentType(
      canvasReturning(null),
      'image/webp',
    )).resolves.toBe(false)
  })

  it('separates null canvas output from a MIME fallback', async () => {
    await expect(encodeCanvasBlob(
      canvasReturning(null),
      'image/webp',
      0.8,
      'display',
    )).rejects.toMatchObject({ code: 'encode_null' })
    await expect(encodeCanvasBlob(
      canvasReturning(new Blob(['png'], { type: 'image/png' })),
      'image/webp',
      0.8,
      'thumbnail',
    )).rejects.toMatchObject({ code: 'encode_type_mismatch' })
  })
})

describe('cleaning image decoder fallback', () => {
  const file = new File(['synthetic image'], 'private-name.jpg', { type: 'image/jpeg' })
  let processPhoto: typeof import('./image-processing').processCleaningPhoto
  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> }
  let image: {
    src: string
    width: number
    height: number
    naturalWidth: number
    naturalHeight: number
    decode: ReturnType<typeof vi.fn>
    removeAttribute: ReturnType<typeof vi.fn>
  }
  let createBitmap: ReturnType<typeof vi.fn>
  let createElement: ReturnType<typeof vi.fn>
  let createURL: Mock<typeof URL.createObjectURL>
  let revokeURL: Mock<typeof URL.revokeObjectURL>
  let drawImage: ReturnType<typeof vi.fn>
  let getContext: ReturnType<typeof vi.fn>
  let toBlob: ReturnType<typeof vi.fn>
  let canvases: Array<{ width: number; height: number }>

  beforeEach(async () => {
    vi.resetModules()
    vi.mocked(addBreadcrumb).mockReset()
    bitmap = { width: 4032, height: 3024, close: vi.fn() }
    image = {
      src: '', width: 1, height: 1, naturalWidth: 3024, naturalHeight: 4032,
      decode: vi.fn().mockResolvedValue(undefined),
      removeAttribute: vi.fn(() => { image.src = '' }),
    }
    createBitmap = vi.fn().mockResolvedValue(bitmap)
    createURL = vi.fn<typeof URL.createObjectURL>().mockReturnValue('blob:synthetic-private-url')
    revokeURL = vi.fn<typeof URL.revokeObjectURL>()
    drawImage = vi.fn()
    getContext = vi.fn(() => ({ drawImage }))
    toBlob = vi.fn((callback: BlobCallback, type: string) => {
      callback(new Blob(['encoded pixels'], { type }))
    })
    canvases = []
    createElement = vi.fn((tag: string) => {
      if (tag === 'img') return image
      if (tag !== 'canvas') throw new Error('Unexpected element')
      const canvas = { width: 0, height: 0, getContext, toBlob }
      canvases.push(canvas)
      return canvas
    })
    vi.stubGlobal('createImageBitmap', createBitmap)
    vi.stubGlobal('document', { createElement })
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeURL)
    processPhoto = (await import('./image-processing')).processCleaningPhoto
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function useImageElement() {
    createBitmap.mockRejectedValue(new Error('private decoder diagnostic'))
  }

  function expectImageReleased() {
    expect(createURL).toHaveBeenCalledExactlyOnceWith(file)
    expect(image.removeAttribute).toHaveBeenCalledExactlyOnceWith('src')
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-private-url')
    expect(image.src).toBe('')
  }

  it('encodes both variants with the primary decoder and closes its bitmap', async () => {
    const result = await processPhoto(file)
    expect(createBitmap).toHaveBeenCalledExactlyOnceWith(file, { imageOrientation: 'from-image' })
    expect(result).toMatchObject({ contentType: 'image/webp', width: 1920, height: 1440 })
    expect(result.display.type).toBe('image/webp')
    expect(result.thumbnail.type).toBe('image/webp')
    expect(drawImage.mock.calls).toEqual([
      [bitmap, 0, 0, 1920, 1440], [bitmap, 0, 0, 480, 360],
    ])
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(createURL).not.toHaveBeenCalled()
    expect(canvases.every(canvas => canvas.width === 1 && canvas.height === 1)).toBe(true)
  })

  it('retries without options when only the oriented bitmap call fails', async () => {
    createBitmap.mockRejectedValueOnce(new Error('unsupported options'))
    await expect(processPhoto(file)).resolves.toMatchObject({ width: 1920, height: 1440 })
    expect(createBitmap.mock.calls).toEqual([
      [file, { imageOrientation: 'from-image' }], [file],
    ])
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(createURL).not.toHaveBeenCalled()
  })

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'encodes a valid %s through the image element after both bitmap failures', async type => {
      useImageElement()
      const source = new File(['synthetic'], 'private-name', { type })
      await expect(processPhoto(source)).resolves.toMatchObject({ width: 1440, height: 1920 })
      expect(createBitmap).toHaveBeenCalledTimes(2)
      expect(image.decode).toHaveBeenCalledTimes(1)
      expect(drawImage.mock.calls).toEqual([
        [image, 0, 0, 1440, 1920], [image, 0, 0, 360, 480],
      ])
      expect(createURL).toHaveBeenCalledExactlyOnceWith(source)
      expect(revokeURL).toHaveBeenCalledTimes(1)
      expect(image.removeAttribute).toHaveBeenCalledExactlyOnceWith('src')
      expect(bitmap.close).not.toHaveBeenCalled()
    },
  )

  it('uses native portrait dimensions for either bitmap path without a second rotation', async () => {
    bitmap.width = 3024
    bitmap.height = 4032
    for (const fallback of [false, true]) {
      drawImage.mockClear()
      if (fallback) createBitmap.mockRejectedValueOnce(new Error('unsupported options'))
      await expect(processPhoto(file)).resolves.toMatchObject({ width: 1440, height: 1920 })
      expect(drawImage.mock.calls).toEqual([
        [bitmap, 0, 0, 1440, 1920], [bitmap, 0, 0, 360, 480],
      ])
    }
  })

  it('returns one sanitized decode_failed after all decoders fail and revokes the URL', async () => {
    useImageElement()
    image.decode.mockRejectedValue(new Error('private-name.jpg secret bytes'))
    const failures: unknown[] = []
    await processPhoto(file).catch(error => { failures.push(error) })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({ code: 'decode_failed', details: { decoderAttempts: 3 } })
    expect(String(failures[0])).not.toContain('private-name')
    expect(createBitmap).toHaveBeenCalledTimes(2)
    expect(drawImage).not.toHaveBeenCalled()
    expectImageReleased()
    expect(vi.mocked(addBreadcrumb).mock.calls.map(([event]) => event.data)).toEqual([
      { decoder: 'bitmap_oriented', attempt: 1, result: 'decode_failed' },
      { decoder: 'bitmap_default', attempt: 2, result: 'decode_failed' },
      { decoder: 'html_image', attempt: 3, result: 'decode_failed' },
    ])
  })

  it('works when createImageBitmap is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    await expect(processPhoto(file)).resolves.toMatchObject({ width: 1440, height: 1920 })
    expectImageReleased()
  })

  it('revokes the URL if setting the image source throws', async () => {
    useImageElement()
    Object.defineProperty(image, 'src', { set() { throw new Error('source unavailable') } })
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'decode_failed' })
    expect(revokeURL).toHaveBeenCalledTimes(1)
  })

  it('returns decode_failed if creating the local URL throws', async () => {
    useImageElement()
    createURL.mockImplementation(() => { throw new Error('local URL unavailable') })
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'decode_failed' })
    expect(revokeURL).not.toHaveBeenCalled()
    expect(image.decode).not.toHaveBeenCalled()
  })

  it('discards invalid bitmap dimensions before falling back', async () => {
    const invalid = { width: 0, height: 1, close: vi.fn() }
    createBitmap.mockResolvedValueOnce(invalid)
    await expect(processPhoto(file)).resolves.toMatchObject({ width: 1920 })
    expect(invalid.close).toHaveBeenCalledTimes(1)
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid image element dimensions and releases the source', async () => {
    useImageElement()
    image.naturalWidth = 0
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'decode_failed' })
    expect(drawImage).not.toHaveBeenCalled()
    expectImageReleased()
  })

  it.each(['primary', 'default', 'html'])('keeps the 50 MP limit on the %s path', async path => {
    bitmap.width = image.naturalWidth = 10_000
    bitmap.height = image.naturalHeight = 5001
    if (path === 'default') createBitmap.mockRejectedValueOnce(new Error('unsupported options'))
    if (path === 'html') useImageElement()
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'source_pixels_exceeded' })
    expect(toBlob).not.toHaveBeenCalled()
    if (path === 'html') expectImageReleased()
    else {
      expect(bitmap.close).toHaveBeenCalledTimes(1)
      expect(createURL).not.toHaveBeenCalled()
      expect(createBitmap).toHaveBeenCalledTimes(path === 'primary' ? 1 : 2)
    }
  })

  it('still accepts exactly 50 MP after fallback', async () => {
    useImageElement()
    image.naturalWidth = 10_000
    image.naturalHeight = 5000
    await expect(processPhoto(file)).resolves.toMatchObject({ width: 1920, height: 960 })
    expectImageReleased()
  })

  it.each(['bitmap', 'html'])('releases the %s source if canvas drawing fails', async path => {
    if (path === 'html') useImageElement()
    drawImage.mockImplementation(() => { throw new Error('drawing failed') })
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'draw_failed' })
    if (path === 'html') expectImageReleased()
    else expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(canvases.every(canvas => canvas.width === 1 && canvas.height === 1)).toBe(true)
  })

  it('releases the HTML source when the canvas context is unavailable', async () => {
    useImageElement()
    getContext.mockReturnValue(null)
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'canvas_unavailable' })
    expectImageReleased()
  })

  it('releases the HTML source if the thumbnail encoder returns null', async () => {
    useImageElement()
    toBlob.mockImplementationOnce((callback: BlobCallback) => {
      callback(new Blob(['probe'], { type: 'image/webp' }))
    }).mockImplementationOnce((callback: BlobCallback) => {
      callback(new Blob(['display'], { type: 'image/webp' }))
    }).mockImplementationOnce((callback: BlobCallback) => { callback(null) })
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'encode_null' })
    expectImageReleased()
  })

  it('preserves JPEG fallback when WebP encoding is unavailable', async () => {
    useImageElement()
    toBlob.mockImplementationOnce((callback: BlobCallback) => {
      callback(new Blob(['probe'], { type: 'image/png' }))
    })
    const result = await processPhoto(file)
    expect(result.contentType).toBe('image/jpeg')
    expect(result.display.type).toBe('image/jpeg')
    expect(result.thumbnail.type).toBe('image/jpeg')
    expectImageReleased()
  })

  it('re-encodes both variants as JPEG when WebP changes MIME mid-process', async () => {
    useImageElement()
    toBlob.mockImplementationOnce((callback: BlobCallback) => {
      callback(new Blob(['probe'], { type: 'image/webp' }))
    }).mockImplementationOnce((callback: BlobCallback) => {
      callback(new Blob(['fallback'], { type: 'image/png' }))
    })
    const result = await processPhoto(file)
    expect(result.contentType).toBe('image/jpeg')
    expect(result.display.type).toBe('image/jpeg')
    expect(result.thumbnail.type).toBe('image/jpeg')
    expectImageReleased()
  })

  it('does not return oversized encoded variants after fallback', async () => {
    useImageElement()
    toBlob.mockImplementation((callback: BlobCallback, type: string) => {
      callback(new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type }))
    })
    await expect(processPhoto(file)).rejects.toMatchObject({ code: 'size_limit_unreachable' })
    expectImageReleased()
  })

  it('validates unsupported types and source size before any decoder runs', async () => {
    for (const source of [
      new File(['synthetic'], 'photo.heic', { type: 'image/heic' }),
      new File(['synthetic'], 'photo.svg', { type: 'image/svg+xml' }),
      { size: 20 * 1024 * 1024 + 1, name: 'photo.jpg', type: 'image/jpeg' } as File,
    ]) await expect(processPhoto(source)).rejects.toBeInstanceOf(Error)
    expect(createBitmap).not.toHaveBeenCalled()
    expect(createURL).not.toHaveBeenCalled()
    expect(addBreadcrumb).not.toHaveBeenCalled()
  })

  it('records only decoder codes, attempt numbers and results', async () => {
    useImageElement()
    await processPhoto(file)
    expect(vi.mocked(addBreadcrumb).mock.calls.map(([event]) => event)).toEqual([
      { category: 'cleaning-photo.decoder', level: 'info', data: {
        decoder: 'bitmap_oriented', attempt: 1, result: 'decode_failed',
      } },
      { category: 'cleaning-photo.decoder', level: 'info', data: {
        decoder: 'bitmap_default', attempt: 2, result: 'decode_failed',
      } },
      { category: 'cleaning-photo.decoder', level: 'info', data: {
        decoder: 'html_image', attempt: 3, result: 'decoded',
      } },
    ])
  })

  it('keeps processing and disposal working when telemetry throws', async () => {
    useImageElement()
    vi.mocked(addBreadcrumb).mockImplementation(() => { throw new Error('telemetry unavailable') })
    await expect(processPhoto(file)).resolves.toMatchObject({ width: 1440, height: 1920 })
    expectImageReleased()
  })
})
