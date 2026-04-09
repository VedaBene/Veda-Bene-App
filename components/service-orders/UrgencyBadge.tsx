import { Zap } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export function UrgencyBadge({ isUrgent }: { isUrgent: boolean }) {
  if (!isUrgent) return null
  return (
    <Badge variant="urgent" label="Urgente" icon={<Zap size={12} />} />
  )
}
