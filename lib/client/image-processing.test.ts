import { describe, expect, it } from 'vitest'
import {
  containedDimensions,
  encodeCanvasBlob,
  probeCanvasContentType,
  validateSourceImage,
} from './image-processing'

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
