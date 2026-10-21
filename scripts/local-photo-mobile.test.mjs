import { describe, expect, it } from 'vitest'
import { createMobilePhotoReport } from './local-photo-mobile.mjs'

const android = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'

describe('separate manual mobile evidence', () => {
  it('keeps Safari evidence in a different file from the approved Android evidence', () => {
    const values = new URLSearchParams({ secure: 'true', camera: 'pass' })
    const androidReport = createMobilePhotoReport(android, values)
    const iphoneReport = createMobilePhotoReport(iphone, values)
    expect(androidReport.filename).toBe('android-manual.json')
    expect(iphoneReport.filename).toBe('iphone-safari-manual.json')
    expect(iphoneReport.report).toMatchObject({ browserName: 'Safari', browser: '18.5', ios: '18.5', secureContext: true })
    expect(androidReport.report).toMatchObject({ browserName: 'Chrome', android: '10' })
  })

  it('does not count Chrome on iPhone as Safari coverage', () => {
    const chromeIos = iphone.replace('Version/18.5', 'CriOS/155.0.0.0')
    const result = createMobilePhotoReport(chromeIos, new URLSearchParams())
    expect(result.filename).toBe('other-manual.json')
    expect(result.report.browserName).toBe('unknown')
  })

  it('does not overwrite a phone report with desktop browser evidence', () => {
    const result = createMobilePhotoReport('Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36', new URLSearchParams())
    expect(result.filename).toBe('other-manual.json')
  })

  it('preserves failures, missing checks and an insecure context without inventing a pass', () => {
    const result = createMobilePhotoReport(iphone, new URLSearchParams({ camera: 'fail', gallery: 'anything', secure: 'false' }))
    expect(result.report.secureContext).toBe(false)
    expect(result.report.results).toMatchObject({ camera: 'fail', gallery: 'not_verified', orientation: 'not_verified' })
  })
})
