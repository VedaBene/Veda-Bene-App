import { describe, expect, it } from 'vitest'
import { containedDimensions, validateSourceImage } from './image-processing'

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
})
