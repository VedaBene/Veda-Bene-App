import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
  normalizeDepth: 3,
  ignoreErrors: [
    /NotFoundError/i,
    /The object can not be found here/i,
    /Failed to execute 'removeChild'/i,
    /Failed to execute 'insertBefore'/i,
    /The node to be removed is not a child of this node/i,
    /Failed to fetch/i,
    /Load failed/i,
  ],
  beforeSend(event) {
    if (event.exception?.values?.some(v => v.type === 'RangeError' && v.value?.includes('stack size'))) {
      return null
    }
    return event
  },
})
