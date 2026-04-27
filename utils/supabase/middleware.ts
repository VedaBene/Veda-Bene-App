import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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
