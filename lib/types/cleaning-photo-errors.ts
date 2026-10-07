import { CLEANING_PHOTO_LIMIT_CODE, CLEANING_PHOTO_LIMIT_MESSAGE } from './service-order-photos'

export class CleaningPhotoLimitError extends Error {
  readonly code = CLEANING_PHOTO_LIMIT_CODE

  constructor() {
    super(CLEANING_PHOTO_LIMIT_MESSAGE)
    this.name = 'CleaningPhotoLimitError'
  }
}

// Only an explicit domain code is expected. Message text is never a classifier;
// authorization, content, Storage, decode and unknown failures stay observable.
export function isExpectedCleaningPhotoFailure(error: unknown): error is { code: typeof CLEANING_PHOTO_LIMIT_CODE } {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === CLEANING_PHOTO_LIMIT_CODE
}
