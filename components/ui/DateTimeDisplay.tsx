'use client'

import { useEffect, useState } from 'react'
import { formatInRomeTimezone } from '@/lib/utils/date-rome'

export function DateTimeDisplay() {
  const [mounted, setMounted] = useState(false)
  const [date, setDate] = useState(() => new Date())

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setDate(new Date()), 1000)

    return () => clearInterval(timer)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-24 flex items-center justify-end text-right" />
  }

  // Formato: 14:30 no fuso de Roma (pt-BR)
  const timeStr = formatInRomeTimezone(date, { hour: '2-digit', minute: '2-digit' }, 'pt-BR')
  
  // Formato: 12 de abr de 2026 no fuso de Roma (pt-BR)
  const dateStr = formatInRomeTimezone(date, { day: '2-digit', month: 'short', year: 'numeric' }, 'pt-BR')
  
  // Dia da semana: Segunda-feira -> Segunda
  const weekday = formatInRomeTimezone(date, { weekday: 'long' }, 'pt-BR').split('-')[0]
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  return (
    <div className="flex flex-col justify-center items-end text-right">
      <span className="text-[16px] font-semibold tracking-tight text-foreground leading-none mb-1">
        {timeStr}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider leading-none">
        {capitalizedWeekday}, {dateStr.replace('.', '')}
      </span>
    </div>
  )
}
