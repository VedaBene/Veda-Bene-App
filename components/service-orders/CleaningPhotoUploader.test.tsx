import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CleaningPhotoQueueItem } from '@/lib/client/cleaning-photo-queue'
import { CleaningPhotoUploader } from './CleaningPhotoUploader'
import { FinishCleaningModal, StartCleaningModal } from './ServiceOrderTimeControls'

const item = (localId: string, patch: Partial<CleaningPhotoQueueItem> = {}): CleaningPhotoQueueItem => ({
  localId, source: { type: 'image/jpeg', size: 8_000_000 }, status: 'queued', ...patch,
})

describe('compressed photo preview UI', () => {
  it('renders placeholders during preparation and only thumbnail URLs after preparation', () => {
    const html = renderToStaticMarkup(<CleaningPhotoUploader
      phase="before" items={[item('1'), item('2', { status: 'idle', previewUrl: 'blob:thumbnail' })]}
      error={null} disabled={false} onFiles={vi.fn()} onRemove={vi.fn()}
    />)
    expect(html).toContain('Preparazione…')
    expect(html.match(/<img /g)).toHaveLength(1)
    expect(html).toContain('src="blob:thumbnail"')
    expect(html).not.toContain('src=""')
    expect(html.match(/aria-label="Rimuovi foto"/g)).toHaveLength(2)
  })

  it('shows each failed photo message instead of hiding subsequent failures', () => {
    const html = renderToStaticMarkup(<CleaningPhotoUploader
      phase="after" items={[item('1', { status: 'error', error: 'Prima illeggibile' }), item('2', { status: 'error', error: 'Seconda illeggibile' })]}
      error="Massimo 8 foto" disabled={false} onFiles={vi.fn()} onRemove={vi.fn()}
    />)
    expect(html).toContain('Foto 1: Prima illeggibile')
    expect(html).toContain('Foto 2: Seconda illeggibile')
    expect(html).toContain('Massimo 8 foto')
    expect(html).not.toContain('<img ')
  })

  it.each(['before', 'after'] as const)('blocks confirmation during %s preparation while keeping cancel available', phase => {
    const shared = { propertyName: 'Synthetic property', isLoading: false, confirmDisabled: true, onCancel: vi.fn(), onConfirm: vi.fn() }
    const html = renderToStaticMarkup(phase === 'before'
      ? <StartCleaningModal {...shared} />
      : <FinishCleaningModal {...shared} notes="" onNotesChange={vi.fn()} />)
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
    expect(buttons.find(button => button.includes('Conferma'))).toContain('disabled=""')
    expect(buttons.find(button => button.includes('Annulla'))).not.toContain('disabled=""')
    expect(buttons[0]).not.toContain('disabled=""')
  })
})
