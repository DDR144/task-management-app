import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDueDate, parseDueDate } from '@/lib/task-dates'

describe('parseDueDate', () => {
  it('returns the same string for a valid yyyy-MM-dd value', () => {
    expect(parseDueDate('2026-07-31')).toBe('2026-07-31')
  })

  it('returns null for null', () => {
    expect(parseDueDate(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseDueDate('')).toBeNull()
  })

  it('trims whitespace and returns the trimmed value when valid', () => {
    expect(parseDueDate('  2026-07-31  ')).toBe('2026-07-31')
  })

  it('rejects malformed date strings', () => {
    expect(parseDueDate('07-31-2026')).toBeNull()
    expect(parseDueDate('2026/07/31')).toBeNull()
    expect(parseDueDate('2026-7-31')).toBeNull()
    expect(parseDueDate('2026-07-31T00:00:00Z')).toBeNull()
    expect(parseDueDate('not a date')).toBeNull()
  })

  it('accepts values that match the regex even if they are not real calendar dates', () => {
    // The implementation only validates format, not calendar correctness.
    expect(parseDueDate('2026-02-30')).toBe('2026-02-30')
  })

  it('preserves the previous behavior of accepting plain string values from callers', () => {
    // Callers previously passed formData.get('dueDate'), which yields a string
    // or null. The extracted helper continues to accept that shape.
    expect(parseDueDate('2025-01-15')).toBe('2025-01-15')
  })
})

describe('formatDueDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders day and month in es-ES with no one-day shift for a valid date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const result = formatDueDate('2026-07-31')
    expect(result).not.toBeNull()
    expect(result!.label).toMatch(/^31 jul\.?$/i)
    expect(result!.overdue).toBe(false)
  })

  it('returns null and is never overdue for a null value', () => {
    expect(formatDueDate(null)).toBeNull()
  })

  it('marks a past date as overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 31))

    const result = formatDueDate('2026-07-30')
    expect(result).not.toBeNull()
    expect(result!.overdue).toBe(true)
  })

  it('does not mark today as overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 31, 0, 0, 0, 0))

    const result = formatDueDate('2026-07-31')
    expect(result).not.toBeNull()
    expect(result!.overdue).toBe(false)
  })

  it('returns null for malformed or incomplete date strings', () => {
    expect(formatDueDate('2026-07')).toBeNull()
    expect(formatDueDate('not-a-date')).toBeNull()
    expect(formatDueDate('')).toBeNull()
  })
})
