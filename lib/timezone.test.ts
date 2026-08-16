import { describe, expect, it } from 'vitest'
import { toRomeIsoString, toRomeLocalInputValue } from './timezone'

describe('timezone helpers (Europe/Rome)', () => {
  it('converte corretamente do formulário local (CEST UTC+2 em julho) para ISO UTC', () => {
    // 27/07/2026 11:00 na Itália (CEST = UTC+2) deve virar 09:00:00.000Z
    const iso = toRomeIsoString('2026-07-27T11:00')
    expect(iso).toBe('2026-07-27T09:00:00.000Z')
  })

  it('converte corretamente do formulário local (CET UTC+1 em janeiro) para ISO UTC', () => {
    // 15/01/2026 11:00 na Itália (CET = UTC+1) deve virar 10:00:00.000Z
    const iso = toRomeIsoString('2026-01-15T11:00')
    expect(iso).toBe('2026-01-15T10:00:00.000Z')
  })

  it('converte do banco ISO UTC para o valor local do formulário (CEST em julho)', () => {
    // 09:00 UTC em julho -> 11:00 em Roma
    const inputVal = toRomeLocalInputValue('2026-07-27T09:00:00.000Z')
    expect(inputVal).toBe('2026-07-27T11:00')
  })

  it('converte do banco ISO UTC para o valor local do formulário (CET em janeiro)', () => {
    // 10:00 UTC em janeiro -> 11:00 em Roma
    const inputVal = toRomeLocalInputValue('2026-01-15T10:00:00.000Z')
    expect(inputVal).toBe('2026-01-15T11:00')
  })

  it('trata valores nulos, vazios ou inválidos de forma graciosa', () => {
    expect(toRomeIsoString('')).toBeNull()
    expect(toRomeIsoString(null)).toBeNull()
    expect(toRomeIsoString(undefined)).toBeNull()
    expect(toRomeIsoString('   ')).toBeNull()
    expect(toRomeIsoString('data-invalida')).toBeNull()
    expect(toRomeIsoString('2026-08-15')).toBe('2026-08-15T00:00:00.000Z')

    expect(toRomeLocalInputValue('')).toBe('')
    expect(toRomeLocalInputValue(null)).toBe('')
    expect(toRomeLocalInputValue(undefined)).toBe('')
    expect(toRomeLocalInputValue('invalido')).toBe('')
  })
})
