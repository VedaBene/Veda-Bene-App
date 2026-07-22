'use client'

import { Camera, Check, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import type { CleaningPhotoQueueItem } from './useCleaningPhotoWorkflow'

export function CleaningPhotoUploader({
  phase,
  items,
  error,
  disabled,
  onFiles,
  onRemove,
}: {
  phase: 'before' | 'after'
  items: CleaningPhotoQueueItem[]
  error: string | null
  disabled: boolean
  onFiles: (files: FileList | null) => void
  onRemove: (localId: string) => void | Promise<void>
}) {
  const label = phase === 'before' ? 'Foto prima della pulizia' : 'Foto dopo la pulizia'

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">Opzionale · massimo 8 foto</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{items.length}/8</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input-border bg-white px-2 py-2 text-xs font-medium text-foreground hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <Camera size={14} className="text-accent" />
          Scatta foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            multiple
            disabled={disabled || items.length >= 8}
            className="sr-only"
            onChange={event => { onFiles(event.target.files); event.target.value = '' }}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input-border bg-white px-2 py-2 text-xs font-medium text-foreground hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <ImagePlus size={14} className="text-accent" />
          Galleria
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.heic,.heif"
            multiple
            disabled={disabled || items.length >= 8}
            className="sr-only"
            onChange={event => { onFiles(event.target.files); event.target.value = '' }}
          />
        </label>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {items.map(item => (
            <div key={item.localId} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {/* blob URLs are local previews and do not benefit from next/image optimization. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="Anteprima foto pulizia" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1 py-0.5 text-white">
                {item.status === 'ready' ? <Check size={12} /> :
                  item.status === 'error' ? <RotateCcw size={12} /> :
                    item.status !== 'idle' ? <Loader2 size={12} className="animate-spin" /> : <span />}
                <button
                  type="button"
                  aria-label="Rimuovi foto"
                  disabled={disabled}
                  onClick={() => { void onRemove(item.localId) }}
                  className="rounded p-0.5 hover:bg-white/20 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(error || items.some(item => item.error)) && (
        <p className="text-[11px] text-danger">
          {error ?? items.find(item => item.error)?.error}
        </p>
      )}
    </div>
  )
}
