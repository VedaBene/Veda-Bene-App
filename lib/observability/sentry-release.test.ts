import { describe, expect, it } from 'vitest'
import { resolveSentryRelease } from './sentry-release'

const sha = '1234567890abcdef1234567890abcdef12345678'
describe('immutable Sentry build release', () => {
  it.each(['SENTRY_RELEASE', 'SOURCE_COMMIT', 'GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA'])('accepts %s from build environment', key => {
    expect(resolveSentryRelease({ [key]: sha }, true)).toBe(sha)
  })
  it('allows development without inventing a release, but blocks unidentified production builds', () => {
    expect(resolveSentryRelease({})).toBeUndefined()
    expect(() => resolveSentryRelease({}, true)).toThrow('during the production build')
  })
  it.each(['latest', 'abcdef1', '2026-10-06', 'invalid credential'])('rejects non-SHA input without printing its value: %s', value => {
    expect(() => resolveSentryRelease({ SOURCE_COMMIT: value }, true)).toThrow('40 hexadecimal')
  })
  it('rejects conflicting SHAs and accepts identical case-insensitive inputs', () => {
    expect(() => resolveSentryRelease({ SOURCE_COMMIT: sha, SENTRY_RELEASE: 'a'.repeat(40) })).toThrow('Conflicting')
    expect(resolveSentryRelease({ SOURCE_COMMIT: sha, SENTRY_RELEASE: sha.toUpperCase() })).toBe(sha)
  })
})
