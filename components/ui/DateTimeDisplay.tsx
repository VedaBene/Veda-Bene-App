'use client'

import { useEffect, useState } from 'react'

export function DateTimeDisplay() {
  const [date, setDate] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000)

    return () => clearInterval(timer)
  }, [])

  // Formato: 14:30
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  
  // Formato: 12 de abr. de 2026
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  
  // Dia da semana: Segunda-feira -> Segunda
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0]
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
