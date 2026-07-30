import 'server-only'

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import type {
  CleaningPhotoContentType,
  CleaningPhotoPhase,
  ServiceOrderPhotoRecord,
} from '@/lib/types/service-order-photos'

export const CLEANING_PHOTO_BUCKET = 'service-order-photos'
export const MAX_DISPLAY_BYTES = 2 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 512 * 1024
const MAX_DECODE_PIXELS = 1920 * 1920

const CONTENT_TYPE_CONFIG: Record<CleaningPhotoContentType, { extension: string; sharpFormat: string }> = {
  'image/webp': { extension: 'webp', sharpFormat: 'webp' },
  'image/jpeg': { extension: 'jpg', sharpFormat: 'jpeg' },
}

type ReservePhotoInput = {
  id: string
  serviceOrderId: string
  cycleNo: number
  phase: CleaningPhotoPhase
  contentType: CleaningPhotoContentType
  uploadedBy: string
  sortOrder: number
}

type InspectedImage = {
  size: number
  width: number
  height: number
}

function createStorageAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Configuração do Supabase Storage ausente no servidor.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function buildPaths(input: ReservePhotoInput) {
  const base = `${input.serviceOrderId}/cycle-${input.cycleNo}/${input.phase}/${input.id}`
  const extension = CONTENT_TYPE_CONFIG[input.contentType].extension
  return {
    displayPath: `${base}/display.${extension}`,
    thumbnailPath: `${base}/thumb.${extension}`,
  }
}

export async function findPhotoById(id: string): Promise<ServiceOrderPhotoRecord | null> {
  const admin = createStorageAdminClient()
  const { data, error } = await admin
    .from('service_order_photos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('Não foi possível consultar a foto reservada.')
  return data as ServiceOrderPhotoRecord | null
}

export async function listPhotoRecords(
  serviceOrderId: string,
  cycleNo: number,
  phase: CleaningPhotoPhase,
): Promise<ServiceOrderPhotoRecord[]> {
  const admin = createStorageAdminClient()
  const { data, error } = await admin
    .from('service_order_photos')
    .select('*')
    .eq('service_order_id', serviceOrderId)
    .eq('cycle_no', cycleNo)
    .eq('phase', phase)
    .order('sort_order')

  if (error) throw new Error('Não foi possível consultar as fotos da O.S.')
  return (data ?? []) as ServiceOrderPhotoRecord[]
}

export async function listPhotoRecordsForOrder(serviceOrderId: string): Promise<ServiceOrderPhotoRecord[]> {
  const admin = createStorageAdminClient()
  const { data, error } = await admin
    .from('service_order_photos')
    .select('*')
    .eq('service_order_id', serviceOrderId)

  if (error) throw new Error('Não foi possível consultar os arquivos da O.S.')
  return (data ?? []) as ServiceOrderPhotoRecord[]
}

export async function findPhotosByIds(ids: string[]): Promise<ServiceOrderPhotoRecord[]> {
  if (ids.length === 0) return []
  const admin = createStorageAdminClient()
  const { data, error } = await admin
    .from('service_order_photos')
    .select('*')
    .in('id', ids)

  if (error) throw new Error('Não foi possível validar as fotos enviadas.')
  return (data ?? []) as ServiceOrderPhotoRecord[]
}

export async function reservePhotoRecord(input: ReservePhotoInput): Promise<ServiceOrderPhotoRecord> {
  const admin = createStorageAdminClient()
  const { displayPath, thumbnailPath } = buildPaths(input)
  const { data, error } = await admin
    .from('service_order_photos')
    .insert({
      id: input.id,
      service_order_id: input.serviceOrderId,
      cycle_no: input.cycleNo,
      phase: input.phase,
      status: 'pending',
      content_type: input.contentType,
      display_path: displayPath,
      thumbnail_path: thumbnailPath,
      uploaded_by: input.uploadedBy,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('Não foi possível reservar o envio da foto.')
  return data as ServiceOrderPhotoRecord
}

export async function createPhotoUploadTokens(record: ServiceOrderPhotoRecord) {
  const admin = createStorageAdminClient()
  const bucket = admin.storage.from(CLEANING_PHOTO_BUCKET)
  const [display, thumbnail] = await Promise.all([
    bucket.createSignedUploadUrl(record.display_path, { upsert: false }),
    bucket.createSignedUploadUrl(record.thumbnail_path, { upsert: false }),
  ])

  if (display.error || !display.data || thumbnail.error || !thumbnail.data) {
    throw new Error('Não foi possível autorizar o envio da foto.')
  }

  return {
    photoId: record.id,
    contentType: record.content_type,
    display: { path: record.display_path, token: display.data.token },
    thumbnail: { path: record.thumbnail_path, token: thumbnail.data.token },
  }
}

export async function inspectImageBytes(
  bytes: Uint8Array,
  expectedContentType: CleaningPhotoContentType,
): Promise<{ width: number; height: number }> {
  try {
    const image = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: MAX_DECODE_PIXELS,
      sequentialRead: true,
    })
    const metadata = await image.metadata()
    if (metadata.format !== CONTENT_TYPE_CONFIG[expectedContentType].sharpFormat) {
      throw new Error('Unexpected decoded format')
    }
    if ((metadata.pages ?? 1) !== 1) throw new Error('Animated images are not allowed')

    const { info } = await image.clone().raw().toBuffer({ resolveWithObject: true })
    if (!info.width || !info.height) throw new Error('Missing decoded dimensions')
    return { width: info.width, height: info.height }
  } catch {
    throw new Error('O conteúdo da imagem é inválido.')
  }
}

export async function inspectImageObject(
  path: string,
  expectedContentType: CleaningPhotoContentType,
  limits: { maxBytes: number; maxDimension: number },
): Promise<InspectedImage> {
  const admin = createStorageAdminClient()
  const bucket = admin.storage.from(CLEANING_PHOTO_BUCKET)
  const [{ data: info, error: infoError }, { data: blob, error: downloadError }] = await Promise.all([
    bucket.info(path),
    bucket.download(path),
  ])

  if (infoError || !info || downloadError || !blob) {
    throw new Error('O arquivo enviado não foi encontrado.')
  }

  const expectedExtension = `.${CONTENT_TYPE_CONFIG[expectedContentType].extension}`
  if (
    !path.endsWith(expectedExtension) ||
    info.contentType !== expectedContentType ||
    blob.type !== expectedContentType
  ) {
    throw new Error('Formato de imagem inválido.')
  }

  const size = info.size ?? blob.size
  if (size <= 0 || size > limits.maxBytes) {
    throw new Error('La foto supera il limite di dimensione consentito.')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const dimensions = await inspectImageBytes(bytes, expectedContentType)
  if (dimensions.width > limits.maxDimension || dimensions.height > limits.maxDimension) {
    throw new Error('La risoluzione della foto supera il limite consentito.')
  }

  return {
    size,
    ...dimensions,
  }
}

export async function markPhotoReady(
  id: string,
  metadata: {
    width: number
    height: number
    displaySizeBytes: number
    thumbnailSizeBytes: number
  },
) {
  const admin = createStorageAdminClient()
  const { data, error } = await admin
    .from('service_order_photos')
    .update({
      status: 'ready',
      width: metadata.width,
      height: metadata.height,
      display_size_bytes: metadata.displaySizeBytes,
      thumbnail_size_bytes: metadata.thumbnailSizeBytes,
      ready_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error || !data) throw new Error('Não foi possível concluir o envio da foto.')
}

export async function deletePhotoRecordAndObjects(record: ServiceOrderPhotoRecord) {
  const admin = createStorageAdminClient()
  const { error: storageError } = await admin.storage
    .from(CLEANING_PHOTO_BUCKET)
    .remove([record.display_path, record.thumbnail_path])
  if (storageError) throw new Error('Não foi possível excluir os arquivos da foto.')

  const { error: rowError } = await admin
    .from('service_order_photos')
    .delete()
    .eq('id', record.id)
  if (rowError) throw new Error('Não foi possível excluir o registro da foto.')
}

export async function deletePhotoObjects(records: ServiceOrderPhotoRecord[]) {
  if (records.length === 0) return
  const admin = createStorageAdminClient()
  const paths = records.flatMap(record => [record.display_path, record.thumbnail_path])
  const { error } = await admin.storage.from(CLEANING_PHOTO_BUCKET).remove(paths)
  if (error) throw new Error('Não foi possível excluir todos os arquivos da O.S.')
}

export async function createPhotoDownloadUrls(paths: string[], expiresInSeconds = 600) {
  if (paths.length === 0) return new Map<string, string>()
  const admin = createStorageAdminClient()
  const { data, error } = await admin.storage
    .from(CLEANING_PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInSeconds)

  if (error || !data) throw new Error('Não foi possível autorizar a visualização das fotos.')
  return new Map(data.filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]))
}
