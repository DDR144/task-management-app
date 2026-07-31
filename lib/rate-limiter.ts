/**
 * In-memory sliding-window rate limiter for auth endpoints.
 *
 * Keys by IP+email for sign-in (POST), by IP for other auth routes.
 * Configurable via RATE_LIMIT_MAX (default 10) and RATE_LIMIT_WINDOW (default 60000ms).
 *
 * ## Design Notes
 *
 * - **Per-key serialization**: Each key has its own promise chain (mutex). Concurrent
 *   requests for the same key are serialized so read→filter→write is atomic per key.
 *   Different keys are fully independent and never contend.
 * - **Lazy cleanup**: Expired timestamps are pruned on each call for the specific key,
 *   not on a timer. This eliminates HMR timer leaks and avoids cross-key iteration races.
 * - **Memory bounded**: The store is capped at MAX_KEYS (default 10,000). When exceeded,
 *   the oldest insertion-order key is evicted. Keys are also capped at MAX_KEY_LENGTH
 *   characters to prevent abuse from extremely long strings.
 * - **In-memory only**: This is per-process state. In a multi-instance deployment, each
 *   instance has its own limits — this is acceptable for auth endpoint throttling where
 *   the goal is to slow brute-force, not provide a distributed counter.
 */

// ---------------------------------------------------------------------------
// Configuration — validated and clamped
// ---------------------------------------------------------------------------

const RAW_MAX = Number(process.env.RATE_LIMIT_MAX)
const RAW_WINDOW = Number(process.env.RATE_LIMIT_WINDOW)

/** Max requests per window per key. Clamped to [1, 1000]. */
export const MAX_REQUESTS = Number.isFinite(RAW_MAX)
  ? Math.max(1, Math.min(1000, Math.round(RAW_MAX)))
  : 10

/** Window duration in milliseconds. Clamped to [1_000, 3_600_000] (1s – 1h). */
export const WINDOW_MS = Number.isFinite(RAW_WINDOW)
  ? Math.max(1_000, Math.min(3_600_000, Math.round(RAW_WINDOW)))
  : 60_000

/** Maximum number of distinct keys in the store. */
const MAX_KEYS = 10_000

/** Maximum allowed key length in characters. Keys exceeding this are truncated. */
const MAX_KEY_LENGTH = 256

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Sliding window store: key → array of timestamps (ms). */
const store = new Map<string, number[]>()

/**
 * Insertion-order tracking for LRU-style eviction. When the store exceeds
 * MAX_KEYS the oldest entry (by insertion into this array) is evicted.
 * The array is kept in sync with `store` — entries are appended on first
 * insert and removed on eviction.
 */
const insertionOrder: string[] = []

/** Per-key mutex: each key maps to a promise that chains concurrent requests. */
const mutex = new Map<string, Promise<void>>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Evict the oldest key from the store (first entry in insertionOrder).
 * Called when store.size >= MAX_KEYS before inserting a new key.
 */
function evictOldest(): void {
  if (insertionOrder.length === 0) return
  const oldestKey = insertionOrder.shift()!
  store.delete(oldestKey)
  mutex.delete(oldestKey)
}

/**
 * Lazy cleanup for a specific key: prune timestamps outside the current window.
 * Returns the filtered array (may be empty).
 */
function pruneExpired(key: string): number[] {
  const now = Date.now()
  const timestamps = store.get(key)
  if (!timestamps) return []

  const valid = timestamps.filter((t) => now - t < WINDOW_MS)
  if (valid.length === 0) {
    // Key has no active timestamps — remove it entirely
    store.delete(key)
    const idx = insertionOrder.indexOf(key)
    if (idx !== -1) insertionOrder.splice(idx, 1)
    mutex.delete(key)
    return []
  }

  store.set(key, valid)
  return valid
}

/**
 * Sanitize a key: truncate to MAX_KEY_LENGTH chars.
 */
function sanitizeKey(key: string): string {
  return key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RateLimitResult = {
  allowed: boolean
  retryAfter?: number // seconds until next request is allowed
}

/**
 * Check rate limits for a key. Concurrent requests for the *same key* are
 * serialized via a per-key promise chain so the read→filter→write sequence
 * is atomic. Different keys never contend.
 *
 * @param key - The rate limit key (e.g., "ip" or "ip:email")
 * @returns { allowed, retryAfter? }
 */
export function rateLimiter(key: string): Promise<RateLimitResult> {
  const sanitized = sanitizeKey(key)

  // Chain onto existing mutex for this key (if any). Each request waits for
  // the previous one to finish, making read-filter-write atomic per key.
  const prev = mutex.get(sanitized) ?? Promise.resolve()

  const task = prev.then(() => {
    const now = Date.now()
    const validTimestamps = pruneExpired(sanitized)

    // Eviction: if store is at capacity, remove the oldest insertion-order key
    // before inserting this new key (if it's genuinely new).
    if (!store.has(sanitized) && store.size >= MAX_KEYS) {
      evictOldest()
    }

    if (validTimestamps.length >= MAX_REQUESTS) {
      // Calculate retry-after: time until the oldest request in the window expires.
      const oldestInWindow = validTimestamps[0]
      const retryAfterMs = oldestInWindow + WINDOW_MS - now

      // Clamp retryAfter to [1s, WINDOW_MS/1000] to handle clock skew
      const retryAfter = Math.max(
        1,
        Math.min(Math.ceil(retryAfterMs / 1000), Math.ceil(WINDOW_MS / 1000))
      )

      return { allowed: false, retryAfter } as RateLimitResult
    }

    // Record this request
    validTimestamps.push(now)

    if (!store.has(sanitized)) {
      // New key — track insertion order
      store.set(sanitized, validTimestamps)
      insertionOrder.push(sanitized)
    } else {
      store.set(sanitized, validTimestamps)
    }

    return { allowed: true } as RateLimitResult
  })

  // Update the mutex — next request for this key chains on this task.
  // The catch ensures a rejected promise doesn't block future requests.
  mutex.set(sanitized, task.then(() => {}, () => {}))

  return task
}

/**
 * Synchronous rate-limit check (for backward compatibility).
 * Internally delegates to the async version but blocks on the previous mutex
 * promise via `await` at the call site — callers must `await` the result.
 *
 * @deprecated Use the async `rateLimiter()` directly for new code.
 */
export function rateLimiterSync(key: string): Promise<RateLimitResult> {
  return rateLimiter(key)
}
