'use client'

import { useSyncExternalStore } from 'react'
import { formatInRomeTimezone } from '@/lib/utils/date-rome'

function subscribeToClock(onStoreChange: () => void) {
  const timer = window.setInterval(onStoreChange, 1000)
  return () => window.clearInterval(timer)
}

function getClockSnapshot() {
  return Math.floor(Date.now() / 1000)
}

function getServerClockSnapshot() {
  return null
}

export function DateTimeDisplay() {
  const epochSecond = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  )

  if (epochSecond === null) {
    return <div className="h-9 w-24 flex items-center justify-end text-right" />
  }

  const date = new Date(epochSecond * 1000)

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
