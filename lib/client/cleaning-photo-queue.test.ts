import { describe, expect, it, vi } from 'vitest'
import { appendWithinLimit } from './cleaning-photo-queue'

describe('cleaning photo queue limit', () => {
  it('never exceeds the limit across consecutive additions', () => {
    const createItem = vi.fn((candidate: string) => `photo-${candidate}`)

    const first = appendWithinLimit([], ['1', '2', '3', '4', '5'], 8, createItem)
    const second = appendWithinLimit(first.items, ['6', '7', '8', '9'], 8, createItem)

    expect(second.items).toEqual([
      'photo-1',
      'photo-2',
      'photo-3',
      'photo-4',
      'photo-5',
      'photo-6',
      'photo-7',
      'photo-8',
    ])
    expect(second.rejectedCount).toBe(1)
    expect(createItem).not.toHaveBeenCalledWith('9')
  })

  it('rejects all new candidates when the queue is already full', () => {
    const createItem = vi.fn((candidate: string) => candidate)
    const current = Array.from({ length: 8 }, (_, index) => String(index))

    const result = appendWithinLimit(current, ['extra'], 8, createItem)

    expect(result.items).toEqual(current)
    expect(result.rejectedCount).toBe(1)
    expect(createItem).not.toHaveBeenCalled()
  })
})
