'use client'

import type { ReactNode } from 'react'
import { CheckCircle, FileText, Flag, Play, Timer, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { OSStatus } from '@/lib/types/database'
import { getCleaningTrackingAction } from '@/lib/service-order-tracking'
import { LiveTimer, formatWorkedTime } from './LiveTimer'

export function TimeTrackingPanel({
  status,
  startedAt,
  workedMinutes,
  completionNotes,
  onOpenStart,
  onOpenFinish,
}: {
  status: OSStatus
  startedAt: string | null | undefined
  workedMinutes: number | null | undefined
  completionNotes: string | null | undefined
  onOpenStart: () => void
  onOpenFinish: () => void
}) {
  const availableAction = getCleaningTrackingAction({
    status,
    started_at: startedAt,
    completed_at: null,
  })

  return (
    <div className="p-4 bg-card rounded-xl border border-border shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <Timer size={16} className="text-accent" />
        <span className="text-sm font-semibold text-foreground">Controllo Tempo</span>
      </div>

      {availableAction === 'start' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1">
            Clicca sotto per avviare la pulizia e registrare l&apos;orario di inizio.
          </p>
          <Button type="button" variant="accent" icon={<Play size={15} />} onClick={onOpenStart}>
            Avvia Pulizia
          </Button>
        </div>
      )}

      {availableAction === 'finish' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-info flex-1">
            <span className="text-xs text-muted-foreground">In corso da</span>
            {startedAt ? <LiveTimer startedAt={startedAt} /> : <span className="text-sm font-medium">—</span>}
          </div>
          <Button type="button" variant="accent" icon={<Flag size={15} />} onClick={onOpenFinish}>
            Completa Pulizia
          </Button>
        </div>
      )}

      {status === 'done' && workedMinutes != null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle size={15} className="text-success shrink-0" />
          Tempo totale:{' '}
          <span className="font-semibold text-foreground">{formatWorkedTime(workedMinutes)}</span>
          {completionNotes && (
            <span className="ml-2 text-foreground/60 truncate max-w-xs" title={completionNotes}>
              · {completionNotes}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function TimeSummaryPanel({
  workedMinutes,
  completionNotes,
}: {
  workedMinutes: number | null | undefined
  completionNotes: string | null | undefined
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border shadow-card space-y-2">
      <div className="flex items-center gap-2">
        <Timer size={16} className="text-accent" />
        <span className="text-sm font-semibold text-foreground">Riepilogo Tempo</span>
      </div>
      {workedMinutes != null && (
        <p className="text-sm text-muted-foreground">
          Tempo Lavorato:{' '}
          <span className="font-semibold text-foreground">{formatWorkedTime(workedMinutes)}</span>
        </p>
      )}
      {completionNotes && (
        <p className="text-sm text-muted-foreground">
          Note: <span className="text-foreground">{completionNotes}</span>
        </p>
      )}
    </div>
  )
}

export function StartCleaningModal({
  propertyName,
  isLoading,
  onCancel,
  onConfirm,
  details,
  cleaningNotes,
}: {
  propertyName: string | null | undefined
  isLoading: boolean
  onCancel: () => void
  onConfirm: () => void
  details?: ReactNode
  cleaningNotes?: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Play size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-foreground">Avvia Pulizia</h2>
          </div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Immobile</p>
          <p className="text-sm font-semibold text-foreground">{propertyName ?? '—'}</p>
          {details}
        </div>
        {cleaningNotes && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 space-y-1 text-left">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wide font-semibold flex items-center gap-1.5">
              <FileText size={13} className="shrink-0" />
              Note sulla Pulizia
            </p>
            <div className="max-h-32 overflow-y-auto pr-1 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {cleaningNotes}
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Alla conferma, l&apos;orario di inizio verrà registrato e lo stato passerà a <strong>In corso</strong>.
        </p>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Annulla
          </Button>
          <Button type="button" variant="accent" isLoading={isLoading} onClick={onConfirm} className="flex-1">
            Conferma
          </Button>
        </div>
      </div>
    </div>
  )
}

export function FinishCleaningModal({
  propertyName,
  notes,
  isLoading,
  onNotesChange,
  onCancel,
  onConfirm,
  details,
  placeholder = "Problemi nell'immobile, eventi, note generali…",
  showOptionalLabel = true,
}: {
  propertyName: string | null | undefined
  notes: string
  isLoading: boolean
  onNotesChange: (notes: string) => void
  onCancel: () => void
  onConfirm: () => void
  details?: ReactNode
  placeholder?: string
  showOptionalLabel?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-foreground">Completa Pulizia</h2>
          </div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Immobile</p>
          <p className="text-sm font-semibold text-foreground">{propertyName ?? '—'}</p>
          {details}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Note {showOptionalLabel && <span className="normal-case font-normal">(opzionale)</span>}
          </label>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2.5 border border-input-border rounded-lg text-sm text-foreground bg-white resize-none transition-all focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          L&apos;orario di completamento verrà registrato e il tempo totale verrà calcolato automaticamente.
        </p>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Annulla
          </Button>
          <Button type="button" variant="accent" isLoading={isLoading} onClick={onConfirm} className="flex-1">
            Conferma
          </Button>
        </div>
      </div>
    </div>
  )
}
