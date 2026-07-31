'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tasks, type Task, type TaskPriority, type TaskStatus } from '@/lib/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

const PRIORITIES: TaskPriority[] = ['alta', 'media', 'baja']
const STATUSES: TaskStatus[] = ['pendiente', 'en_progreso', 'completada']

async function getUserId(): Promise<AuthResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }
  return { ok: true, userId: session.user.id }
}

export type ActionResult =
  | { ok: true; task?: Task }
  | { ok: false; error: string }

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string }

type GetTasksResult =
  | { ok: true; tasks: Task[] }
  | { ok: false; error: string }

function parsePriority(value: FormDataEntryValue | null): TaskPriority {
  const v = String(value ?? '').trim()
  return PRIORITIES.includes(v as TaskPriority) ? (v as TaskPriority) : 'media'
}

function parseStatus(value: FormDataEntryValue | null): TaskStatus {
  const v = String(value ?? '').trim()
  return STATUSES.includes(v as TaskStatus) ? (v as TaskStatus) : 'pendiente'
}

function parseDueDate(value: FormDataEntryValue | null): Date | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function getTasks(): Promise<GetTasksResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.status), desc(tasks.createdAt))
  return { ok: true, tasks: result }
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const userId = authResult.userId

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, error: 'El título es obligatorio.' }
  if (title.length > 120)
    return { ok: false, error: 'El título no puede superar 120 caracteres.' }

  const descriptionRaw = String(formData.get('description') ?? '').trim()
  if (descriptionRaw.length > 1000)
    return { ok: false, error: 'La descripción no puede superar 1000 caracteres.' }

  const [task] = await db
    .insert(tasks)
    .values({
      userId,
      title,
      description: descriptionRaw || null,
      priority: parsePriority(formData.get('priority')),
      status: parseStatus(formData.get('status')),
      dueDate: parseDueDate(formData.get('dueDate')),
    })
    .returning()

  revalidatePath('/')
  return { ok: true, task }
}

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const userId = authResult.userId

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0)
    return { ok: false, error: 'Tarea inválida.' }

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, error: 'El título es obligatorio.' }
  if (title.length > 120)
    return { ok: false, error: 'El título no puede superar 120 caracteres.' }

  const descriptionRaw = String(formData.get('description') ?? '').trim()
  if (descriptionRaw.length > 1000)
    return { ok: false, error: 'La descripción no puede superar 1000 caracteres.' }

  const [task] = await db
    .update(tasks)
    .set({
      title,
      description: descriptionRaw || null,
      priority: parsePriority(formData.get('priority')),
      status: parseStatus(formData.get('status')),
      dueDate: parseDueDate(formData.get('dueDate')),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning()

  if (!task) return { ok: false, error: 'No se encontró la tarea.' }

  revalidatePath('/')
  return { ok: true, task }
}

export async function updateTaskStatus(
  id: number,
  status: TaskStatus,
  updatedAt: string,
): Promise<ActionResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const userId = authResult.userId

  if (!Number.isInteger(id) || id <= 0)
    return { ok: false, error: 'Tarea inválida.' }
  if (!STATUSES.includes(status))
    return { ok: false, error: 'Estado inválido.' }
  if (!updatedAt)
    return { ok: false, error: 'Falta el campo updatedAt para verificación de concurrencia.' }

  const [task] = await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.userId, userId),
        eq(tasks.updatedAt, new Date(updatedAt)),
      ),
    )
    .returning()

  if (!task) {
    return {
      ok: false,
      error: 'Conflicto: la tarea fue modificada. Recargá la página.',
    }
  }

  revalidatePath('/')
  return { ok: true, task }
}

// XSS-safe encoding note:
// React auto-escapes all text content rendered in JSX, preventing XSS injection
// from user-supplied task titles and descriptions. For user text placed in URL
// parameters, encodeURIComponent() should be used. No manual HTML entity encoding
// is required for standard React rendering.

export async function deleteTask(id: number): Promise<ActionResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const userId = authResult.userId
  if (!Number.isInteger(id) || id <= 0)
    return { ok: false, error: 'Tarea inválida.' }

  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
  revalidatePath('/')
  return { ok: true }
}
