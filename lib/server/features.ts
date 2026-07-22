import 'server-only'

export function isCleaningPhotosEnabled(): boolean {
  return process.env.CLEANING_PHOTOS_ENABLED !== 'false'
}
