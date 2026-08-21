import 'server-only'

import { captureQueryError } from '@/lib/server/logger'

export type DatabaseErrorLike = {
  code?: string | number
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
}

function isErrorObject(error: unknown): error is Record<string, unknown> {
  return typeof error === 'object' && error !== null
}

export function extractErrorCode(error: unknown): string | null {
  if (!isErrorObject(error)) return null
  if (typeof error.code === 'string') return error.code
  if (typeof error.code === 'number') return String(error.code)
  return null
}

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (isErrorObject(error) && typeof error.message === 'string') return error.message
  return String(error)
}

/**
 * Converte erros de banco de dados/infraestrutura em mensagens seguras e amigáveis para o usuário,
 * impedindo que nomes de tabelas, colunas, queries SQL ou segredos vazem para o cliente.
 */
export function toUserSafeErrorMessage(
  error: unknown,
  fallbackMessage = "Si è verificato un errore durante l'operazione.",
): string {
  if (!error) return fallbackMessage

  const code = extractErrorCode(error)
  const rawMsg = extractErrorMessage(error).toLowerCase()

  // Erros comuns de integridade relacional do Postgres
  if (code === '23505' || rawMsg.includes('unique constraint') || rawMsg.includes('duplicate key')) {
    return 'Elemento già esistente con questi dati.'
  }

  if (code === '23503' || rawMsg.includes('foreign key') || rawMsg.includes('violates foreign key constraint')) {
    return 'Elemento correlato non trovato o non valido.'
  }

  if (code === '23514' || rawMsg.includes('check constraint')) {
    return 'I dati inseriti non rispettano i vincoli del sistema.'
  }

  // Erros de permissão e RLS
  if (
    code === '42501' ||
    rawMsg.includes('permission denied') ||
    rawMsg.includes('insufficient privilege') ||
    rawMsg.includes('violates row-level security policy')
  ) {
    return 'Operazione non consentita.'
  }

  // PostgREST / Recursos não encontrados
  if (code === 'PGRST116' || rawMsg.includes('not found') || rawMsg.includes('row not found')) {
    return 'Risorsa non trovata o non accessibile.'
  }

  // Rate Limiting
  if (
    (isErrorObject(error) && error.status === 429) ||
    rawMsg.includes('rate limit') ||
    rawMsg.includes('too many requests')
  ) {
    return 'Troppe richieste. Riprova più tardi.'
  }

  // Sessão / Autenticação
  if (rawMsg.includes('jwt expired') || rawMsg.includes('session expired')) {
    return 'Sessione scaduta. Effettua nuovamente il login.'
  }

  return fallbackMessage
}

/**
 * Registra o erro de banco ou operação com contexto para auditoria e Sentry
 * e retorna a mensagem sanitizada segura para a UI.
 */
export function handleDatabaseError(
  area: string,
  operation: string,
  error: unknown,
  fallbackMessage?: string,
): string {
  captureQueryError(area, operation, error)
  return toUserSafeErrorMessage(error, fallbackMessage)
}
