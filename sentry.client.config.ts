import * as Sentry from '@sentry/nextjs'
import { privateSentryDataCollection, sanitizeSentryEvent } from '@/lib/observability/sentry-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
  normalizeDepth: 3,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
  dataCollection: privateSentryDataCollection,
  beforeSend: sanitizeSentryEvent,
})
