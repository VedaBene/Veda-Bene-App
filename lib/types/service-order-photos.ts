export type CleaningPhotoPhase = 'before' | 'after'
export type CleaningPhotoStatus = 'pending' | 'ready'

export type ServiceOrderPhotoRecord = {
  id: string
  service_order_id: string
  cycle_no: number
  phase: CleaningPhotoPhase
  status: CleaningPhotoStatus
  display_path: string
  thumbnail_path: string
  uploaded_by: string | null
  sort_order: number
  width: number | null
  height: number | null
  display_size_bytes: number | null
  thumbnail_size_bytes: number | null
  created_at: string
  ready_at: string | null
}

export type ReservedCleaningPhotoUpload = {
  photoId: string
  display: { path: string; token: string }
  thumbnail: { path: string; token: string }
}

export type CleaningPhotoGalleryItem = {
  id: string
  cycleNo: number
  phase: CleaningPhotoPhase
  sortOrder: number
  width: number
  height: number
  thumbnailUrl: string
  displayUrl: string
  createdAt: string
  canDelete: boolean
}

export type CleaningPhotoGalleryCycle = {
  cycleNo: number
  before: CleaningPhotoGalleryItem[]
  after: CleaningPhotoGalleryItem[]
}
