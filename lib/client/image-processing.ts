import 'client-only'

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_CLEANING_PHOTOS = 8
export const MAX_DISPLAY_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_THUMBNAIL_IMAGE_BYTES = 512 * 1024

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i
const HEIC_EXTENSIONS = /\.(heic|heif)$/i

export type ProcessedCleaningPhoto = {
  display: Blob
  thumbnail: Blob
  width: number
  height: number
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

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('Il browser non supporta la conversione WebP.'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

async function encodeVariant(
  source: ImageBitmap,
  maxDimension: number,
  maxBytes: number,
  qualities: number[],
) {
  let currentMax = maxDimension

  while (currentMax >= Math.min(480, maxDimension)) {
    const dimensions = containedDimensions(source.width, source.height, currentMax)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Impossibile elaborare la foto su questo dispositivo.')
    context.drawImage(source, 0, 0, dimensions.width, dimensions.height)

    for (const quality of qualities) {
      const blob = await canvasToWebp(canvas, quality)
      if (blob.size <= maxBytes) return { blob, ...dimensions }
    }
    currentMax = Math.floor(currentMax * 0.85)
  }

  throw new Error('Non è stato possibile ridurre la foto entro il limite consentito.')
}

export async function processCleaningPhoto(file: File): Promise<ProcessedCleaningPhoto> {
  const validationError = validateSourceImage(file)
  if (validationError) throw new Error(validationError)

  let image: ImageBitmap
  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('La foto non può essere letta. Prova a selezionarla nuovamente.')
  }

  try {
    const [display, thumbnail] = await Promise.all([
      encodeVariant(image, 1920, MAX_DISPLAY_IMAGE_BYTES, [0.82, 0.76, 0.7, 0.64, 0.58]),
      encodeVariant(image, 480, MAX_THUMBNAIL_IMAGE_BYTES, [0.72, 0.64, 0.56]),
    ])
    return {
      display: display.blob,
      thumbnail: thumbnail.blob,
      width: display.width,
      height: display.height,
    }
  } finally {
    image.close()
  }
}
