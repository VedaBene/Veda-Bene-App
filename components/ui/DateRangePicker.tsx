"use client";

import { useState, useEffect } from 'react';
import { Input } from './Input';
import { CalendarRange } from 'lucide-react';

interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  label?: string;
  onChange: (range: DateRange) => void;
  initialValue?: DateRange;
  className?: string;
}

export function DateRangePicker({ label, onChange, initialValue, className = '' }: DateRangePickerProps) {
  const [start, setStart] = useState(initialValue?.start || '');
  const [end, setEnd] = useState(initialValue?.end || '');

  useEffect(() => {
    onChange({ start, end });
  }, [start, end]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarRange size={14} className="text-muted-foreground" />
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full"
        />
        <span className="text-xs text-muted-foreground font-medium shrink-0">até</span>
        <Input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-full"
          min={start}
        />
      </div>
    </div>
  );
}
