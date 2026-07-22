import 'server-only'

import { createPhotoDownloadUrls } from '@/lib/server/storage/service-order-photo-storage'
import type {
  CleaningPhotoGalleryCycle,
  CleaningPhotoGalleryItem,
  ServiceOrderPhotoRecord,
} from '@/lib/types/service-order-photos'
import type { SupabaseServerClient, Viewer } from './viewer'

export async function getCleaningPhotoGallery(
  supabase: SupabaseServerClient,
  viewer: Viewer,
  serviceOrderId: string,
): Promise<CleaningPhotoGalleryCycle[]> {
  const { data, error } = await supabase
    .from('service_order_photos')
    .select('id, service_order_id, cycle_no, phase, status, display_path, thumbnail_path, uploaded_by, sort_order, width, height, display_size_bytes, thumbnail_size_bytes, created_at, ready_at')
    .eq('service_order_id', serviceOrderId)
    .eq('status', 'ready')
    .order('cycle_no', { ascending: false })
    .order('sort_order')

  if (error) throw new Error('Não foi possível consultar as fotos da limpeza.')
  const records = (data ?? []) as ServiceOrderPhotoRecord[]
  if (records.length === 0) return []

  const paths = records.flatMap(record => [record.thumbnail_path, record.display_path])
  const signedUrls = await createPhotoDownloadUrls(paths, 900)
  const cycles = new Map<number, CleaningPhotoGalleryCycle>()

  for (const record of records) {
    const thumbnailUrl = signedUrls.get(record.thumbnail_path)
    const displayUrl = signedUrls.get(record.display_path)
    if (!thumbnailUrl || !displayUrl || !record.width || !record.height) continue

    const item: CleaningPhotoGalleryItem = {
      id: record.id,
      cycleNo: record.cycle_no,
      phase: record.phase,
      sortOrder: record.sort_order,
      width: record.width,
      height: record.height,
      thumbnailUrl,
      displayUrl,
      createdAt: record.created_at,
      canDelete: viewer.role === 'admin',
    }
    const cycle = cycles.get(record.cycle_no) ?? {
      cycleNo: record.cycle_no,
      before: [],
      after: [],
    }
    cycle[record.phase].push(item)
    cycles.set(record.cycle_no, cycle)
  }

  return [...cycles.values()].sort((a, b) => b.cycleNo - a.cycleNo)
}
