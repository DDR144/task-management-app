import type { TaskPriority, TaskStatus } from '@/lib/db/schema'

export const STATUS_ORDER: TaskStatus[] = [
  'pendiente',
  'en_progreso',
  'completada',
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
}

// Tailwind classes for the accent bar / header of each column
export const STATUS_ACCENT: Record<TaskStatus, string> = {
  pendiente: 'bg-amber-400',
  en_progreso: 'bg-primary',
  completada: 'bg-emerald-400',
}

export const PRIORITY_ORDER: TaskPriority[] = ['alta', 'media', 'baja']

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

// Badge styling per priority (kept within the 3-5 color system via tokens)
export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  alta: 'border-destructive/30 bg-destructive/10 text-destructive',
  media: 'border-primary/30 bg-primary/10 text-primary',
  baja: 'border-border bg-muted text-muted-foreground',
}
