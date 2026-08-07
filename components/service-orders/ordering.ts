type ServiceOrderPriorityFields = {
  cleaning_date?: string | null
  checkin_at?: string | null
  checkout_at?: string | null
  order_number?: number | null
  cleaning_staff?: { full_name?: string | null }[] | null
}

function getFirstStaffName(order: ServiceOrderPriorityFields): string | null {
  if (!order.cleaning_staff || order.cleaning_staff.length === 0) return null
  const name = order.cleaning_staff[0]?.full_name?.trim()
  return name ? name : null
}

function cleaningWindowMs(order: ServiceOrderPriorityFields): number | null {
  if (!order.checkin_at || !order.checkout_at) return null

  const checkin = new Date(order.checkin_at).getTime()
  const checkout = new Date(order.checkout_at).getTime()
  if (!Number.isFinite(checkin) || !Number.isFinite(checkout)) return null

  return checkin - checkout
}

export function compareServiceOrderPriority(
  a: ServiceOrderPriorityFields,
  b: ServiceOrderPriorityFields,
): number {
  const staffA = getFirstStaffName(a)
  const staffB = getFirstStaffName(b)

  if (staffA && staffB) {
    const staffComparison = staffA.localeCompare(staffB, 'pt', { sensitivity: 'base' })
    if (staffComparison !== 0) return staffComparison
  } else if (staffA) {
    return -1
  } else if (staffB) {
    return 1
  }

  if (a.cleaning_date && b.cleaning_date) {
    const dateComparison = a.cleaning_date.localeCompare(b.cleaning_date)
    if (dateComparison !== 0) return dateComparison
  } else if (a.cleaning_date) {
    return -1
  } else if (b.cleaning_date) {
    return 1
  }

  const windowA = cleaningWindowMs(a)
  const windowB = cleaningWindowMs(b)

  if (windowA != null && windowB != null && windowA !== windowB) {
    return windowA - windowB
  }
  if (windowA != null) return -1
  if (windowB != null) return 1

  return (a.order_number ?? 0) - (b.order_number ?? 0)
}

