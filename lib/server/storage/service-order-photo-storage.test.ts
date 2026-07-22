import { describe, expect, it } from 'vitest'
import { parseWebpDimensions } from './service-order-photo-storage'

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index)
  }
}

function webpHeader(chunk: string) {
  const bytes = new Uint8Array(30)
  writeAscii(bytes, 0, 'RIFF')
  writeAscii(bytes, 8, 'WEBP')
  writeAscii(bytes, 12, chunk)
  return bytes
}

describe('parseWebpDimensions', () => {
  it('reads VP8X canvas dimensions', () => {
    const bytes = webpHeader('VP8X')
    const widthMinusOne = 1919
    const heightMinusOne = 1079
    bytes[24] = widthMinusOne & 0xff
    bytes[25] = (widthMinusOne >> 8) & 0xff
    bytes[26] = (widthMinusOne >> 16) & 0xff
    bytes[27] = heightMinusOne & 0xff
    bytes[28] = (heightMinusOne >> 8) & 0xff
    bytes[29] = (heightMinusOne >> 16) & 0xff

    expect(parseWebpDimensions(bytes)).toEqual({ width: 1920, height: 1080 })
  })

  it('reads VP8 lossy dimensions', () => {
    const bytes = webpHeader('VP8 ')
    bytes.set([0x9d, 0x01, 0x2a], 23)
    bytes[26] = 0x80
    bytes[27] = 0x02
    bytes[28] = 0xe0
    bytes[29] = 0x01

    expect(parseWebpDimensions(bytes)).toEqual({ width: 640, height: 480 })
  })

  it('rejects content that only claims the WebP MIME type', () => {
    expect(parseWebpDimensions(new Uint8Array(30))).toBeNull()
  })
})
