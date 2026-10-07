import type { ErrorEvent, EventHint, BrowserOptions } from '@sentry/nextjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function pseudonymousSentryUser(id?: string | number) {
  return typeof id === 'string' && UUID.test(id) ? { id } : null
}

export const privateSentryDataCollection: BrowserOptions['dataCollection'] = {
  userInfo: false, cookies: false, httpHeaders: { request: false, response: false },
  httpBodies: [], urlQueryParams: false, databaseQueryData: false,
  stackFrameVariables: false, frameContextLines: 0,
  graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
}

function scrubText(value: string) {
  return value
    .replace(/(?:https?:\/\/|blob:|data:)[^\s"'<>]+/gi, '[Filtered URL]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[Filtered email]')
    .replace(/\b(?:Bearer\s+\S+|(?:sb_secret_|ghp_|github_pat_)[\w-]+|eyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?)/gi, '[Filtered token]')
    .replace(/\b(?:token|password|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '[Filtered credential]')
    .replace(/(?:[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/)[^\\/\s]+/gi, '[Filtered home]')
    .replace(/(?:[\w.-]+[\\/])*[^\s"'<>\\/]+\.(?:jpe?g|png|webp|hei[cf])/gi, '[Filtered photo]')
    .slice(0, 2000)
}

const safeScalarKeys = new Set([
  'area', 'action', 'query', 'phase', 'stage', 'failure_code', 'source_content_type',
  'source_size_bucket', 'decoder', 'attempt', 'upload_attempt', 'retry_result', 'recovered',
  'variant', 'result', 'contentType', 'returnedContentType', 'decoderAttempts',
  'sourceWidth', 'sourceHeight', 'sourcePixels',
  'trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin',
])
function safeScalars(input?: Record<string, unknown>, keys = safeScalarKeys) {
  return Object.fromEntries(Object.entries(input ?? {}).flatMap<[string, string | number | boolean]>(([key, value]) => {
    if (!keys.has(key)) return []
    if (typeof value === 'number') return Number.isFinite(value) ? [[key, value]] : []
    if (typeof value === 'boolean') return [[key, value]]
    // No arbitrary free text, identifiers or signed paths in metadata.
    if (typeof value === 'string' && /^[a-z0-9_.:/-]{1,100}$/i.test(value) && !value.includes('://')) {
      return [[key, value]]
    }
    return []
  }))
}

// Keep technical exceptions and frames; remove payloads and identity-bearing surfaces.
// No global text filter drops an event, including network/stack/DOM failures.
export function sanitizeSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  if (hint) hint.attachments = []
  event.user = pseudonymousSentryUser(event.user?.id) ?? undefined
  event.request = event.request?.method ? { method: event.request.method } : undefined
  event.extra = safeScalars(event.extra, new Set(['contentType', 'returnedContentType', 'variant', 'decoder', 'decoderAttempts', 'sourceWidth', 'sourceHeight', 'sourcePixels']))
  event.tags = safeScalars(event.tags) as ErrorEvent['tags']
  const photoFailure = event.tags?.area === 'cleaning-photo'
    ? `Cleaning photo failure: ${String(event.tags.failure_code ?? 'photo_action_failed')}` : undefined
  event.contexts = Object.fromEntries(Object.entries(event.contexts ?? {})
    .filter(([key]) => ['runtime', 'os', 'browser', 'trace'].includes(key))
    .map(([key, value]) => [key, safeScalars(value, new Set(['name', 'version', 'type', 'trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin']))]))
  event.message = event.message ? photoFailure ?? scrubText(event.message) : undefined
  if (event.logentry) event.logentry = { message: photoFailure ?? scrubText(event.logentry.message ?? '') }
  event.transaction = event.transaction ? scrubText(event.transaction.split(/[?#]/)[0]) : undefined
  event.breadcrumbs = event.breadcrumbs?.map(crumb => ({
    timestamp: crumb.timestamp, level: crumb.level, type: crumb.type,
    category: crumb.category,
    // Console/DOM/navigation messages and arguments can contain names and form values.
    data: crumb.category?.startsWith('cleaning-photo.') ? safeScalars(crumb.data) : undefined,
  }))
  event.exception = event.exception ? {
    values: event.exception.values?.map(exception => ({
      type: exception.type ? scrubText(exception.type) : undefined,
      value: exception.value ? photoFailure ?? scrubText(exception.value) : undefined,
      mechanism: exception.mechanism ? {
        type: exception.mechanism.type, handled: exception.mechanism.handled,
      } : undefined,
      stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.map(frame => ({
        filename: frame.filename ? scrubFrameLocation(frame.filename) : undefined,
        function: frame.function, module: frame.module, lineno: frame.lineno,
        colno: frame.colno, in_app: frame.in_app,
      })) } : undefined,
    })),
  } : undefined
  return event
}

function scrubFrameLocation(location: string) {
  // Preserve bundle locations for source maps, but never private Storage paths/queries.
  if (/\/storage\/|blob:|data:/i.test(location)) return '[Filtered URL]'
  return location.replace(/[?#].*$/, '').replace(/(https?:\/\/)[^/]*@/i, '$1')
    .replace(/(?:[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/)[^\\/\s]+/gi, '[Filtered home]')
}
