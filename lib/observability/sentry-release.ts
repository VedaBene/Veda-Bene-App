// Only the build environment supplies identity. Never guess from a clock or runtime Git.
export function resolveSentryRelease(env: Record<string, string | undefined>, required = false) {
  const supplied = [env.SENTRY_RELEASE, env.SOURCE_COMMIT, env.GITHUB_SHA, env.VERCEL_GIT_COMMIT_SHA]
    .filter((value): value is string => Boolean(value))
  if (supplied.some(value => !/^[a-f0-9]{40}$/i.test(value))) {
    throw new Error('Sentry release requires a full Git commit SHA (40 hexadecimal characters).')
  }
  const releases = new Set(supplied.map(value => value.toLowerCase()))
  if (releases.size > 1) throw new Error('Conflicting build commit SHAs for Sentry release.')
  const release = supplied[0]?.toLowerCase()
  if (required && !release) {
    throw new Error('Provide SOURCE_COMMIT or SENTRY_RELEASE as the full commit SHA during the production build.')
  }
  return release
}
