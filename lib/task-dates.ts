export function parseDueDate(value: string | File | null): string | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export function formatDueDate(value: string | null): {
  label: string
  overdue: boolean
} | null {
  if (!value) return null
  const parts = value.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
  if (!y || !m || !d) return null
  const local = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = local < today
  return {
    label: local.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    }),
    overdue,
  }
}
