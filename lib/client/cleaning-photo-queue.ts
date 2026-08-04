export function appendWithinLimit<TItem, TCandidate>(
  current: readonly TItem[],
  candidates: readonly TCandidate[],
  limit: number,
  createItem: (candidate: TCandidate) => TItem,
) {
  const available = Math.max(0, limit - current.length)
  const acceptedCandidates = candidates.slice(0, available)
  const added = acceptedCandidates.map(createItem)

  return {
    items: [...current, ...added],
    rejectedCount: candidates.length - acceptedCandidates.length,
  }
}
