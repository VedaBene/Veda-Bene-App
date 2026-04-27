import * as Sentry from '@sentry/nextjs'

type ActionResult = { success?: boolean; error?: unknown } | void | undefined | null | unknown

function isFailureResult(result: unknown): result is { success: false; error: unknown } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    (result as { success: unknown }).success === false
  )
}

export async function withLogging<T extends ActionResult>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  try {
    const result = await fn()
    const durationMs = Date.now() - startedAt

    if (isFailureResult(result)) {
      console.warn(
        `[action] ${name} failed request_id=${requestId} duration_ms=${durationMs} error=${String(result.error)}`,
      )
    } else {
      console.log(
        `[action] ${name} ok request_id=${requestId} duration_ms=${durationMs}`,
      )
    }

    return result
  } catch (err) {
    const durationMs = Date.now() - startedAt

    // next/navigation throws redirect()/notFound() — these are control-flow signals, not errors.
    // Re-throw without logging.
    if (isNextControlFlow(err)) {
      throw err
    }

    console.error(
      `[action] ${name} threw request_id=${requestId} duration_ms=${durationMs}`,
      err,
    )
    Sentry.captureException(err, {
      tags: { action: name, request_id: requestId },
    })
    throw err
  }
}

function isNextControlFlow(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const digest = (err as { digest?: unknown }).digest
  if (typeof digest !== 'string') return false
  return digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND'
}

export function captureQueryError(area: string, query: string, error: unknown) {
  console.error(`[query] ${area}/${query} failed`, error)
  Sentry.captureException(error, {
    tags: { area, query },
  })
}
