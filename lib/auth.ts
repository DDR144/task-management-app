import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

/**
 * Validates that a URL has a valid http/https scheme and non-empty hostname.
 * Throws a descriptive error if invalid — fails fast at module load.
 */
function validateUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(
      `Invalid BETTER_AUTH_URL: "${url}" is not a valid URL. Must start with http:// or https://`
    )
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid BETTER_AUTH_URL: "${url}" must start with http:// or https:// (got ${parsed.protocol})`
    )
  }

  if (!parsed.hostname) {
    throw new Error(
      `Invalid BETTER_AUTH_URL: "${url}" must have a non-empty hostname`
    )
  }

  return url
}

/**
 * Validates and filters an array of trusted origins.
 * Only includes well-formed URLs with http/https scheme and valid hostname.
 * Logs console.warn for each filtered entry.
 */
function filterTrustedOrigins(origins: (string | undefined)[]): string[] {
  const filtered: string[] = []
  
  for (const origin of origins) {
    if (!origin) continue
    
    try {
      const url = new URL(origin)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        console.warn(`[security] Filtered invalid trusted origin (bad scheme): "${origin}"`)
        continue
      }
      if (!url.hostname) {
        console.warn(`[security] Filtered invalid trusted origin (no hostname): "${origin}"`)
        continue
      }
      filtered.push(origin)
    } catch {
      console.warn(`[security] Filtered malformed trusted origin: "${origin}"`)
    }
  }
  
  return filtered
}

const resolvedBaseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.V0_RUNTIME_URL)

if (!resolvedBaseURL) {
  throw new Error(
    'BETTER_AUTH_URL must be set, or one of VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, V0_RUNTIME_URL. None found.'
  )
}

const baseURL = validateUrl(resolvedBaseURL)

// Determine cookie attributes based on environment and request scheme
const isDev = process.env.NODE_ENV === 'development'
const isHTTPS = baseURL.startsWith('https://')
const isLocalhost = baseURL.includes('localhost')

// Compute cookie attributes:
// - HTTP localhost in dev → sameSite: 'lax', secure: false (works in local HTTP)
// - HTTPS localhost or preview in dev → sameSite: 'none', secure: true (cross-site)
// - Production → httpOnly: true, secure: true, sameSite: 'lax'
let defaultCookieAttributes: {
  sameSite: 'lax' | 'none' | 'strict'
  secure: boolean
  httpOnly?: boolean
}

if (isDev && isLocalhost && !isHTTPS) {
  // HTTP localhost in development
  defaultCookieAttributes = {
    sameSite: 'lax',
    secure: false,
  }
} else if (isDev && (isHTTPS || !isLocalhost)) {
  // HTTPS localhost or preview in development (cross-site)
  defaultCookieAttributes = {
    sameSite: 'none',
    secure: true,
  }
} else {
  // Production
  defaultCookieAttributes = {
    sameSite: 'lax',
    secure: true,
    httpOnly: true,
  }
}

// Filter trusted origins and add dev-only localhost
const rawTrustedOrigins = [
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000']
    : []),
  process.env.V0_RUNTIME_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
]

const trustedOrigins = filterTrustedOrigins(rawTrustedOrigins)

export const auth = betterAuth({
  database: pool,
  baseURL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    defaultCookieAttributes,
  },
})
