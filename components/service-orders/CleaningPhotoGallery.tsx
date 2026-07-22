'use client'

import { useState, useTransition } from 'react'
import { Camera, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteServiceOrderPhoto } from '@/app/(app)/service-orders/photo-actions'
import type {
  CleaningPhotoGalleryCycle,
  CleaningPhotoGalleryItem,
} from '@/lib/types/service-order-photos'

export function CleaningPhotoGallery({ cycles }: { cycles: CleaningPhotoGalleryCycle[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<CleaningPhotoGalleryItem | null>(null)
  const allPhotos = cycles.flatMap(cycle => [...cycle.before, ...cycle.after])

  async function handleDelete(photo: CleaningPhotoGalleryItem) {
    if (!window.confirm('Eliminare definitivamente questa foto?')) return
    const result = await deleteServiceOrderPhoto(photo.id)
    if (!result.success) return
    if (selected?.id === photo.id) setSelected(null)
    startTransition(() => router.refresh())
  }

  function moveSelected(direction: -1 | 1) {
    if (!selected || allPhotos.length < 2) return
    const index = allPhotos.findIndex(photo => photo.id === selected.id)
    const next = (index + direction + allPhotos.length) % allPhotos.length
    setSelected(allPhotos[next])
  }

  return (
    <section id="foto-pulizia" className="rounded-xl border border-border bg-card p-4 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Camera size={17} className="text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Foto della Pulizia</h2>
          <p className="text-xs text-muted-foreground">Confronto prima e dopo per ogni ciclo</p>
        </div>
      </div>

      {cycles.length === 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
          Nessuna foto registrata per questa O.L.
        </p>
      ) : (
        <div className="space-y-5">
          {cycles.map(cycle => (
            <div key={cycle.cycleNo} className="space-y-3">
              {cycles.length > 1 && (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ciclo {cycle.cycleNo}
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <PhotoPhase title="Prima" photos={cycle.before} onOpen={setSelected} onDelete={handleDelete} disabled={isPending} />
                <PhotoPhase title="Dopo" photos={cycle.after} onOpen={setSelected} onDelete={handleDelete} disabled={isPending} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Foto della pulizia">
          <button type="button" aria-label="Chiudi" onClick={() => setSelected(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X size={22} />
          </button>
          {allPhotos.length > 1 && (
            <>
              <button type="button" aria-label="Foto precedente" onClick={() => moveSelected(-1)} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronLeft size={24} />
              </button>
              <button type="button" aria-label="Foto successiva" onClick={() => moveSelected(1)} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {/* Signed private URLs are short lived and intentionally bypass image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.displayUrl} alt={`Pulizia ${selected.phase === 'before' ? 'prima' : 'dopo'}`} className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </section>
  )
}

function PhotoPhase({
  title,
  photos,
  onOpen,
  onDelete,
  disabled,
}: {
  title: string
  photos: CleaningPhotoGalleryItem[]
  onOpen: (photo: CleaningPhotoGalleryItem) => void
  onDelete: (photo: CleaningPhotoGalleryItem) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground">{photos.length} foto</span>
      </div>
      {photos.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Nessuna foto
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map(photo => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              <button type="button" onClick={() => onOpen(photo)} className="h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbnailUrl} alt={`Pulizia ${title.toLowerCase()}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </button>
              {photo.canDelete && (
                <button
                  type="button"
                  aria-label="Elimina foto"
                  disabled={disabled}
                  onClick={() => onDelete(photo)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white opacity-100 hover:bg-danger sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
