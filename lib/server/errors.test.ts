import { describe, expect, it } from 'vitest'
import { toUserSafeErrorMessage } from '@/lib/server/errors'

describe('toUserSafeErrorMessage', () => {
  it('maps Postgres unique_violation code 23505 to safe friendly message', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "properties_email_key"' }
    expect(toUserSafeErrorMessage(error)).toBe('Elemento già esistente con questi dati.')
  })

  it('maps Postgres foreign_key_violation code 23503 to safe friendly message', () => {
    const error = { code: '23503', message: 'insert or update on table "properties" violates foreign key constraint "properties_agency_id_fkey"' }
    expect(toUserSafeErrorMessage(error)).toBe('Elemento correlato non trovato o non valido.')
  })

  it('maps Postgres check_violation code 23514 to safe friendly message', () => {
    const error = { code: '23514', message: 'new row for relation "properties" violates check constraint "properties_base_price_check"' }
    expect(toUserSafeErrorMessage(error)).toBe('I dati inseriti non rispettano i vincoli del sistema.')
  })

  it('maps Postgres insufficient_privilege code 42501 / RLS failure to safe friendly message', () => {
    const error = { code: '42501', message: 'permission denied for table properties' }
    expect(toUserSafeErrorMessage(error)).toBe('Operazione non consentita.')
  })

  it('maps PostgREST PGRST116 single row not found to safe friendly message', () => {
    const error = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }
    expect(toUserSafeErrorMessage(error)).toBe('Risorsa non trovata o non accessibile.')
  })

  it('maps rate limit HTTP 429 to safe friendly message', () => {
    const error = { status: 429, message: 'Too many requests' }
    expect(toUserSafeErrorMessage(error)).toBe('Troppe richieste. Riprova più tardi.')
  })

  it('maps raw internal Postgres errors to generic fallback message without leaking table/column details', () => {
    const rawError = new Error('syntax error at or near "WHERE"')
    expect(toUserSafeErrorMessage(rawError)).toBe("Si è verificato un errore durante l'operazione.")
  })

  it('respects custom fallback message', () => {
    const rawError = new Error('unexpected socket closed')
    expect(toUserSafeErrorMessage(rawError, 'Errore personalizzato.')).toBe('Errore personalizzato.')
  })
})
