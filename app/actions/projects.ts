'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, tasks, type Project } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string }

async function getUserId(): Promise<AuthResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }
  return { ok: true, userId: session.user.id }
}

export type ProjectsResult =
  | { ok: true; projects: Project[] }
  | { ok: false; error: string }

export type ProjectResult =
  | { ok: true; project: Project }
  | { ok: false; error: string }

// --- Get user's projects ---

export async function getProjects(): Promise<ProjectsResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.createdAt), asc(projects.id))

  return { ok: true, projects: result }
}

// --- Ensure a "Personal" project exists on first use ---

export async function ensurePersonalProject(): Promise<ProjectResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult

  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.createdAt), asc(projects.id))
    .limit(1)

  if (existing[0]) return { ok: true, project: existing[0] }

  const [created] = await db
    .insert(projects)
    .values({ userId, name: 'Personal', color: 'default' })
    .returning()

  return { ok: true, project: created }
}

// --- Create project ---

export async function createProject(
  formData: FormData,
): Promise<ProjectResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: 'El nombre del proyecto es obligatorio.' }
  if (name.length > 100)
    return { ok: false, error: 'El nombre no puede superar 100 caracteres.' }

  const description = String(formData.get('description') ?? '').trim() || null
  const color = String(formData.get('color') ?? '').trim() || 'default'

  const [project] = await db
    .insert(projects)
    .values({ userId, name, description, color })
    .returning()

  revalidatePath('/')
  return { ok: true, project }
}

// --- Update project ---

export async function updateProject(
  formData: FormData,
): Promise<ProjectResult> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0)
    return { ok: false, error: 'ID de proyecto inválido.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: 'El nombre del proyecto es obligatorio.' }
  if (name.length > 100)
    return { ok: false, error: 'El nombre no puede superar 100 caracteres.' }

  const description = String(formData.get('description') ?? '').trim() || null
  const color = String(formData.get('color') ?? '').trim() || 'default'

  const [project] = await db
    .update(projects)
    .set({ name, description, color, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning()

  if (!project) return { ok: false, error: 'No se encontró el proyecto.' }

  revalidatePath('/')
  return { ok: true, project }
}

// --- Delete project ---

export async function deleteProject(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authResult = await getUserId()
  if (!authResult.ok) return { ok: false, error: authResult.error }
  const { userId } = authResult

  if (!Number.isInteger(id) || id <= 0)
    return { ok: false, error: 'ID de proyecto inválido.' }

  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1)

  if (owned.length === 0)
    return { ok: false, error: 'No se encontró el proyecto.' }

  const taskCount = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .limit(1)

  if (taskCount.length > 0)
    return {
      ok: false,
      error: 'No se puede eliminar un proyecto que tiene tareas. Mueve o elimina las tareas primero.',
    }

  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))

  revalidatePath('/')
  return { ok: true }
}
