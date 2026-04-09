import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-6 rounded-xl border border-dashed border-border/80 bg-muted/20">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
        {icon ?? <Inbox size={24} className="text-muted-foreground/60" />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
