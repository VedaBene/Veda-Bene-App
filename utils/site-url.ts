type HeaderGetter = {
  get(name: string): string | null
}

function normalizeOrigin(url: string) {
  const withProtocol = url.startsWith('http') ? url : `https://${url}`
  return withProtocol.replace(/\/+$/, '')
}

export function getSiteOrigin(headersList?: HeaderGetter) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL

  if (configuredUrl) return normalizeOrigin(configuredUrl)

  const host = headersList?.get('x-forwarded-host') ?? headersList?.get('host') ?? 'localhost:3000'
  const proto = headersList?.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')

  return `${proto}://${host}`
}
