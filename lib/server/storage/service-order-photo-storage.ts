import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type {
  CleaningPhotoPhase,
  ServiceOrderPhotoRecord,
} from '@/lib/types/service-order-photos'

export const CLEANING_PHOTO_BUCKET = 'service-order-photos'
export const MAX_DISPLAY_BYTES = 2 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 512 * 1024

type ReservePhotoInput = {
  id: string
  serviceOrderId: string
  cycleNo: number
  phase: CleaningPhotoPhase
  uploadedBy: string
  sortOrder: number
}

type InspectedWebp = {
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
  return {
    displayPath: `${base}/display.webp`,
    thumbnailPath: `${base}/thumb.webp`,
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
    display: { path: record.display_path, token: display.data.token },
    thumbnail: { path: record.thumbnail_path, token: thumbnail.data.token },
  }
}

export function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length))
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null

  const chunk = ascii(12, 4)
  if (chunk === 'VP8X') {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    return { width, height }
  }

  if (chunk === 'VP8 ' && bytes.length >= 30) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }

  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8)
    const height = 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    return { width, height }
  }

  return null
}

export async function inspectWebpObject(path: string): Promise<InspectedWebp> {
  const admin = createStorageAdminClient()
  const bucket = admin.storage.from(CLEANING_PHOTO_BUCKET)
  const [{ data: info, error: infoError }, { data: blob, error: downloadError }] = await Promise.all([
    bucket.info(path),
    bucket.download(path),
  ])

  if (infoError || !info || downloadError || !blob) {
    throw new Error('O arquivo enviado não foi encontrado.')
  }

  if (info.contentType !== 'image/webp' || blob.type !== 'image/webp') {
    throw new Error('Formato de imagem inválido.')
  }

  const bytes = new Uint8Array(await blob.arrayBuffer())
  const dimensions = parseWebpDimensions(bytes)
  if (!dimensions) throw new Error('O conteúdo da imagem é inválido.')

  return {
    size: info.size ?? blob.size,
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
