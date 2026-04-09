import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, placeholder, required, className = '', id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}{required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            required={required}
            className={`block w-full rounded-lg border bg-white text-sm text-foreground transition-all duration-200 px-3 py-2.5 pr-10 appearance-none ${
              error
                ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:border-danger'
                : 'border-input-border focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus'
            } disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
            <ChevronDown size={16} />
          </div>
        </div>
        {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
