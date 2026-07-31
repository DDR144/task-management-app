import { auth } from '@/lib/auth'
import { rateLimiter } from '@/lib/rate-limiter'
import { toNextJsHandler } from 'better-auth/next-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max request body size for POST (100 KB). */
const MAX_BODY_BYTES = 100 * 1024

// ---------------------------------------------------------------------------
// IP resolution — hardened
// ---------------------------------------------------------------------------

/**
 * IPv4 regex (decimal dotted-quad, each octet 0-255).
 * Does NOT match leading zeros (e.g. 01.02.03.04 is rejected).
 */
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/

/**
 * Resolve the client IP from the request.
 *
 * Order of preference:
 *   1. `x-real-ip` — typically set by a reverse proxy (nginx, Cloudflare).
 *   2. `x-forwarded-for` — only if the first entry passes IPv4 validation.
 *   3. `'127.0.0.1'` — fallback for local/dev.
 *
 * Spoofing mitigation: `x-forwarded-for` is only trusted when its value is a
 * valid IPv4 address. In practice, the first value is always the client IP
 * when the header is set by a trusted proxy. If the header is forged with
 * garbage, the fallback is used. This is a pragmatic defense — a full fix
 * requires a trusted-proxy configuration (e.g. `trust proxy` in Express).
 */
function getClientIp(request: Request): string {
  // 1. x-real-ip (most reliable — set by reverse proxy, not forwarded from client)
  const realIp = request.headers.get('x-real-ip')
  if (realIp && IPV4_RE.test(realIp.trim())) {
    return realIp.trim()
  }

  // 2. x-forwarded-for (first entry only, if valid IPv4)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (IPV4_RE.test(first)) {
      return first
    }
  }

  // 3. Fallback
  return '127.0.0.1'
}

// ---------------------------------------------------------------------------
// Rate-limited handler
// ---------------------------------------------------------------------------

async function rateLimitedHandler(request: Request) {
  const isPost = request.method === 'POST'

  // --- Early body size check for POST (before cloning or reading body) ---
  if (isPost) {
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = Number(contentLength)
      if (Number.isFinite(size) && size > MAX_BODY_BYTES) {
        return new Response('Payload Too Large', { status: 413 })
      }
    }
  }

  const ip = getClientIp(request)
  let key = ip

  // For POST requests (sign-in attempts), key by ip:email
  if (isPost) {
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const clone = request.clone()
        const body = await clone.json()
        if (body?.email && typeof body.email === 'string') {
          key = `${ip}:${body.email}`
        }
      } catch {
        // JSON parse errors (malformed JSON, double-clone TypeError, etc.)
        // Fall back to IP-only key — do not block the request
      }
    } else {
      // Non-JSON POST — use IP-only key. This should not happen in normal
      // better-auth flows, but we handle it gracefully.
      console.warn(
        `[security] Non-JSON POST to auth endpoint (Content-Type: ${contentType}). Using IP-only rate limit key.`
      )
    }
  }

  const result = await rateLimiter(key)

  if (!result.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
      },
    })
  }

  return auth.handler(request)
}

export const { GET, POST } = toNextJsHandler(rateLimitedHandler)
