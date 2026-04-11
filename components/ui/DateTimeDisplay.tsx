'use client'

import { useEffect, useState } from 'react'

export function DateTimeDisplay() {
  const [date, setDate] = useState<Date | null>(null)

  useEffect(() => {
    // Definir data inicial
    setDate(new Date())
    
    // Atualizar cada segundo
    const timer = setInterval(() => setDate(new Date()), 1000)
    
    return () => clearInterval(timer)
  }, [])

  if (!date) {
    return (
      <div className="flex flex-col gap-1 w-32 items-end">
        <div className="h-4 bg-muted animate-pulse rounded w-16"></div>
        <div className="h-3 bg-muted animate-pulse rounded w-24"></div>
      </div>
    )
  }

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
