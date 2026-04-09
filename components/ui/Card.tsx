import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = false }: CardProps) {
  return (
    <div className={`bg-card rounded-xl border border-border shadow-card overflow-hidden ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}
