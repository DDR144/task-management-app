import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Auth proxy for protected routes.
 * Checks the session cookie (no DB access) on `/`.
 * Public routes (sign-in, sign-up, api/auth/*, _next/*) bypass the check.
 */
export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
