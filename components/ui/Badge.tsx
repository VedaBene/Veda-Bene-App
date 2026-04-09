import React from 'react';

type BadgeVariant = 'default' | 'urgent' | 'success' | 'warning';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  urgent: 'bg-red-100 text-red-800 border border-red-200',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
};

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  className?: string;
}

export function Badge({ variant = 'default', label, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
