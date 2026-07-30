import 'client-only'

import type { CleaningPhotoContentType } from '@/lib/types/service-order-photos'

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_SOURCE_IMAGE_PIXELS = 50_000_000
export const MAX_CLEANING_PHOTOS = 8
export const MAX_DISPLAY_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_THUMBNAIL_IMAGE_BYTES = 512 * 1024

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i
const HEIC_EXTENSIONS = /\.(heic|heif)$/i

export type ProcessedCleaningPhoto = {
  display: Blob
  thumbnail: Blob
  contentType: CleaningPhotoContentType
  width: number
  height: number
}

export type PhotoProcessingFailureCode =
  | 'decode_failed'
  | 'source_pixels_exceeded'
  | 'canvas_unavailable'
  | 'draw_failed'
  | 'encode_null'
  | 'encode_type_mismatch'
  | 'size_limit_unreachable'

export class PhotoProcessingError extends Error {
  constructor(
    message: string,
    readonly code: PhotoProcessingFailureCode,
    readonly details: Readonly<Record<string, string | number>> = {},
  ) {
    super(message)
    this.name = 'PhotoProcessingError'
  }
}

export function validateSourceImage(file: File): string | null {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return 'La foto supera il limite di 20 MB.'
  if (HEIC_EXTENSIONS.test(file.name) || /hei[cf]/i.test(file.type)) {
    return 'Il formato HEIC/HEIF non è supportato su questo dispositivo. Usa JPEG, PNG o WebP.'
  }
  if (!SUPPORTED_TYPES.has(file.type) && !SUPPORTED_EXTENSIONS.test(file.name)) {
    return 'Formato non supportato. Usa JPEG, PNG o WebP.'
  }
  return null
}

export function containedDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

type CanvasEncoder = Pick<HTMLCanvasElement, 'toBlob'>

export function probeCanvasContentType(
  canvas: CanvasEncoder,
  contentType: CleaningPhotoContentType,
): Promise<boolean> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => resolve(blob?.type === contentType), contentType, 0.8)
    } catch {
      resolve(false)
    }
  })
}

export function encodeCanvasBlob(
  canvas: CanvasEncoder,
  contentType: CleaningPhotoContentType,
  quality: number,
  variant: 'display' | 'thumbnail',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new PhotoProcessingError(
            'Il dispositivo non è riuscito a comprimere la foto. Riprova con una foto alla volta.',
            'encode_null',
            { contentType, variant },
          ))
          return
        }
        if (blob.type !== contentType) {
          reject(new PhotoProcessingError(
            'Il formato di compressione richiesto non è disponibile su questo dispositivo.',
            'encode_type_mismatch',
            { contentType, returnedContentType: blob.type || 'unknown', variant },
          ))
          return
        }
        resolve(blob)
      }, contentType, quality)
    } catch {
      reject(new PhotoProcessingError(
        'Il dispositivo non è riuscito a comprimere la foto.',
        'encode_null',
        { contentType, variant },
      ))
    }
  })
}

let webpEncodingSupport: Promise<boolean> | null = null

function supportsWebpEncoding() {
  if (webpEncodingSupport) return webpEncodingSupport
  webpEncodingSupport = (async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const supported = await probeCanvasContentType(canvas, 'image/webp')
    canvas.width = 1
    canvas.height = 1
    return supported
  })()
  return webpEncodingSupport
}

async function encodeVariant(
  source: ImageBitmap,
  maxDimension: number,
  maxBytes: number,
  qualities: number[],
  contentType: CleaningPhotoContentType,
  variant: 'display' | 'thumbnail',
) {
  let currentMax = maxDimension

  while (currentMax >= Math.min(480, maxDimension)) {
    const dimensions = containedDimensions(source.width, source.height, currentMax)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    try {
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) {
        throw new PhotoProcessingError(
          'Impossibile elaborare la foto su questo dispositivo.',
          'canvas_unavailable',
          { contentType, variant },
        )
      }
      try {
        context.drawImage(source, 0, 0, dimensions.width, dimensions.height)
      } catch {
        throw new PhotoProcessingError(
          'Il dispositivo non è riuscito a ridimensionare la foto.',
          'draw_failed',
          { contentType, variant },
        )
      }

      for (const quality of qualities) {
        const blob = await encodeCanvasBlob(canvas, contentType, quality, variant)
        if (blob.size <= maxBytes) return { blob, ...dimensions }
      }
    } finally {
      canvas.width = 1
      canvas.height = 1
    }
    currentMax = Math.floor(currentMax * 0.85)
  }

  throw new PhotoProcessingError(
    'Non è stato possibile ridurre la foto entro il limite consentito.',
    'size_limit_unreachable',
    { contentType, variant },
  )
}

async function encodePhotoVariants(
  image: ImageBitmap,
  contentType: CleaningPhotoContentType,
) {
  const display = await encodeVariant(
    image,
    1920,
    MAX_DISPLAY_IMAGE_BYTES,
    [0.82, 0.76, 0.7, 0.64, 0.58],
    contentType,
    'display',
  )
  const thumbnail = await encodeVariant(
    image,
    480,
    MAX_THUMBNAIL_IMAGE_BYTES,
    [0.72, 0.64, 0.56],
    contentType,
    'thumbnail',
  )
  return { display, thumbnail }
}

export async function processCleaningPhoto(file: File): Promise<ProcessedCleaningPhoto> {
  const validationError = validateSourceImage(file)
  if (validationError) throw new Error(validationError)

  let image: ImageBitmap
  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoProcessingError(
      'La foto non può essere letta. Prova a selezionarla nuovamente.',
      'decode_failed',
    )
  }

  try {
    const sourcePixels = image.width * image.height
    if (sourcePixels > MAX_SOURCE_IMAGE_PIXELS) {
      throw new PhotoProcessingError(
        'La risoluzione della foto è troppo elevata. Usa una foto fino a 50 megapixel.',
        'source_pixels_exceeded',
        { sourceWidth: image.width, sourceHeight: image.height, sourcePixels },
      )
    }

    let contentType: CleaningPhotoContentType = await supportsWebpEncoding()
      ? 'image/webp'
      : 'image/jpeg'
    let variants
    try {
      variants = await encodePhotoVariants(image, contentType)
    } catch (error) {
      if (
        contentType !== 'image/webp' ||
        !(error instanceof PhotoProcessingError) ||
        error.code !== 'encode_type_mismatch'
      ) {
        throw error
      }
      contentType = 'image/jpeg'
      variants = await encodePhotoVariants(image, contentType)
    }

    return {
      display: variants.display.blob,
      thumbnail: variants.thumbnail.blob,
      contentType,
      width: variants.display.width,
      height: variants.display.height,
    }
  } finally {
    image.close()
  }
}
