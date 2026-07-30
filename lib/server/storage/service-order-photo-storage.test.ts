import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { inspectImageBytes } from './service-order-photo-storage'

async function imageFixture(format: 'webp' | 'jpeg') {
  const image = sharp({
    create: {
      width: 16,
      height: 8,
      channels: 3,
      background: { r: 20, g: 120, b: 220 },
    },
  })
  return format === 'webp' ? image.webp().toBuffer() : image.jpeg().toBuffer()
}

describe('cleaning photo content inspection', () => {
  it('fully decodes valid WebP and JPEG images', async () => {
    const webp = await imageFixture('webp')
    const jpeg = await imageFixture('jpeg')

    await expect(inspectImageBytes(webp, 'image/webp')).resolves.toEqual({ width: 16, height: 8 })
    await expect(inspectImageBytes(jpeg, 'image/jpeg')).resolves.toEqual({ width: 16, height: 8 })
  })

  it('rejects a MIME mismatch even when the bytes form a valid image', async () => {
    const jpeg = await imageFixture('jpeg')
    await expect(inspectImageBytes(jpeg, 'image/webp')).rejects.toThrow('conteúdo da imagem')
  })

  it('rejects a fabricated or truncated WebP header', async () => {
    const bytes = new Uint8Array(30)
    bytes.set(Buffer.from('RIFF'), 0)
    bytes.set(Buffer.from('WEBP'), 8)
    bytes.set(Buffer.from('VP8X'), 12)
    await expect(inspectImageBytes(bytes, 'image/webp')).rejects.toThrow('conteúdo da imagem')
  })
})
