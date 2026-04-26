const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'O link de acesso foi recusado. Solicite um novo link e tente novamente.',
  callback_failed: 'Não foi possível validar o link de acesso. Solicite um novo link e tente novamente.',
  email_rate_limit_exceeded: 'O limite de envio de emails foi atingido. Aguarde alguns minutos antes de tentar novamente.',
  otp_expired: 'O link de acesso expirou ou já foi usado. Solicite um novo link e tente novamente.',
  over_email_send_rate_limit: 'O limite de envio de emails foi atingido. Aguarde alguns minutos antes de tentar novamente.',
  session_missing: 'Nenhuma sessão válida foi encontrada. Abra o link mais recente recebido por email.',
}

function normalizeDescription(description: string | null | undefined) {
  return description?.replace(/\+/g, ' ').trim() || null
}

export function getFriendlyAuthError(code: string | null, description?: string | null) {
  if (!code) return null

  return AUTH_ERROR_MESSAGES[code] ?? normalizeDescription(description) ?? 'Não foi possível concluir a autenticação.'
}

export function getAuthErrorFromUrl(search: string, hash: string) {
  const searchParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))

  const code =
    searchParams.get('auth_error') ??
    searchParams.get('error_code') ??
    hashParams.get('error_code') ??
    searchParams.get('error') ??
    hashParams.get('error')

  if (!code) return null

  const description = searchParams.get('error_description') ?? hashParams.get('error_description')

  return {
    code,
    message: getFriendlyAuthError(code, description) ?? 'Não foi possível concluir a autenticação.',
  }
}
