import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, required, full, hint, error, children }: FieldProps) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
