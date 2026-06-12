import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import {
  clearFailedLogin,
  getLoginLockoutIdentity,
  isLoginAttemptBlocked,
  recordFailedLogin,
} from '@/lib/server/auth/login-lockout'

const LOGIN_ERROR_MESSAGE = 'Email ou senha incorretos.'

const loginRequestSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host')
  const headerOrigin = host
    ? `${forwardedProto ?? request.nextUrl.protocol.replace(':', '')}://${host}`
    : null

  return origin === request.nextUrl.origin || origin === headerOrigin
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError('Origem inválida.', 403)
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return jsonError('Payload inválido.', 400)
  }

  const parsed = loginRequestSchema.safeParse(payload)

  if (!parsed.success) {
    return jsonError('Payload inválido.', 400)
  }

  let identity: ReturnType<typeof getLoginLockoutIdentity>

  try {
    identity = getLoginLockoutIdentity(parsed.data.email, request.headers)
  } catch (error) {
    Sentry.captureException(error, { tags: { area: 'auth-login-lockout' } })
    return jsonError('Não foi possível concluir o login.', 500)
  }

  try {
    if (await isLoginAttemptBlocked(identity.emailKey, identity.ipKey)) {
      return jsonError(LOGIN_ERROR_MESSAGE, 401)
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: identity.normalizedEmail,
      password: parsed.data.password,
    })

    if (error) {
      await recordFailedLogin(identity.emailKey, identity.ipKey)
      return jsonError(LOGIN_ERROR_MESSAGE, 401)
    }

    await clearFailedLogin(identity.emailKey, identity.ipKey)

    return NextResponse.json({ success: true })
  } catch (error) {
    Sentry.captureException(error, { tags: { area: 'auth-login' } })
    return jsonError('Não foi possível concluir o login.', 500)
  }
}
