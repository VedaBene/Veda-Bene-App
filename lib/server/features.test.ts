import { afterEach, describe, expect, it } from 'vitest'
import { isCleaningPhotosEnabled } from './features'

const originalValue = process.env.CLEANING_PHOTOS_ENABLED

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.CLEANING_PHOTOS_ENABLED
  } else {
    process.env.CLEANING_PHOTOS_ENABLED = originalValue
  }
})

describe('isCleaningPhotosEnabled', () => {
  it('enables cleaning photos by default after the production rollout', () => {
    delete process.env.CLEANING_PHOTOS_ENABLED
    expect(isCleaningPhotosEnabled()).toBe(true)
  })

  it('keeps an explicit emergency off switch', () => {
    process.env.CLEANING_PHOTOS_ENABLED = 'false'
    expect(isCleaningPhotosEnabled()).toBe(false)
  })

  it('enables the feature when explicitly configured', () => {
    process.env.CLEANING_PHOTOS_ENABLED = 'true'
    expect(isCleaningPhotosEnabled()).toBe(true)
  })
})
