import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, required, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}{required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            required={required}
            className={`block w-full rounded-lg border bg-white text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-200 ${
              leftIcon ? 'pl-10' : 'px-3'
            } ${rightIcon ? 'pr-10' : 'px-3'} ${!leftIcon && !rightIcon ? 'px-3' : ''} py-2.5 ${
              error
                ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:border-danger'
                : 'border-input-border focus:ring-2 focus:ring-input-focus/20 focus:border-input-focus'
            } disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed outline-none`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
