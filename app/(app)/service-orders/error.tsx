'use client'

import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

export default function ServiceOrdersError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Ordini di Lavoro" />
      <Card padding>
        <div role="alert" className="flex flex-col items-start gap-4 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-danger" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">Impossibile caricare gli ordini di lavoro</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Non è stato possibile verificare l’elenco. Riprova tra poco.
          </p>
          <Button type="button" variant="secondary" icon={<RotateCcw size={16} />} onClick={retry}>
            Riprova
          </Button>
        </div>
      </Card>
    </div>
  )
}
