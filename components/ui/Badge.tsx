import React from 'react';

type BadgeVariant = 'default' | 'urgent' | 'success' | 'warning' | 'info';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  urgent: 'bg-urgent-bg text-urgent border border-urgent/20',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-accent-light text-accent',
};

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  icon?: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ variant = 'default', label, icon, dot, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </span>
  );
}
