import * as Sentry from '@sentry/nextjs'
import { privateSentryDataCollection, sanitizeSentryEvent } from '@/lib/observability/sentry-privacy'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
  dataCollection: privateSentryDataCollection,
  beforeSend: sanitizeSentryEvent,
})
