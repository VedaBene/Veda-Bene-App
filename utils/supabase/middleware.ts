import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  SESSION_ACTIVITY_COOKIE,
  isSessionActivityExpired,
} from '@/lib/session-timeout'

const PUBLIC_SESSION_PATHS = [
  '/login',
  '/forgot-password',
  '/update-password',
  '/auth/callback',
  '/api/auth/login',
]

function shouldEnforceSessionTimeout(pathname: string) {
  return !PUBLIC_SESSION_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          if (!supabaseResponse.headers.has('location')) {
            supabaseResponse = NextResponse.next({ request })
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const lastActivity = request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value

  if (shouldEnforceSessionTimeout(pathname) && isSessionActivityExpired(lastActivity)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = '?auth_error=session_expired'

    supabaseResponse = NextResponse.redirect(loginUrl)
    await supabase.auth.signOut({ scope: 'local' })
    supabaseResponse.cookies.set(SESSION_ACTIVITY_COOKIE, '', {
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
    })

    return supabaseResponse
  }

  // Não remova: refresca o token de sessão se expirado
  // É importante chamar getUser() e não getSession() para validar com o servidor
  try {
    await supabase.auth.getUser()
  } catch (err) {
    console.error('[middleware] supabase.auth.getUser failed', err)
    Sentry.captureException(err, { tags: { area: 'middleware-auth' } })
  }

  return supabaseResponse
}
