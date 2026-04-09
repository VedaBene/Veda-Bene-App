import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function Section({ title, icon, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-muted/40 hover:bg-muted/70 text-left font-medium text-foreground transition-colors cursor-pointer"
      >
        {icon && <span className="text-accent shrink-0">{icon}</span>}
        <span className="flex-1 text-sm">{title}</span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 py-5 grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
