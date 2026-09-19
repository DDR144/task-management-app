import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTasks } from '@/app/actions/tasks'
import { ensurePersonalProject, getProjects } from '@/app/actions/projects'
import { AppHeader } from '@/components/app-header'
import { KanbanBoard } from '@/components/kanban-board'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // Ensure at least one project exists (auto-creates "Personal" on first use).
  const personal = await ensurePersonalProject()
  if (!personal.ok) redirect('/sign-in')

  const projectsResult = await getProjects()
  if (!projectsResult.ok) redirect('/sign-in')
  const projects = projectsResult.projects

  // Resolve the selected project from the URL, falling back to the first one.
  const params = await searchParams
  const requestedId = Number(params.projectId)
  const selectedProject =
    projects.find((p) => p.id === requestedId) ?? projects[0]

  const tasksResult = await getTasks(selectedProject.id)
  if (!tasksResult.ok) redirect('/sign-in')
  const tasks = tasksResult.tasks

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        name={session.user.name ?? ''}
        email={session.user.email ?? ''}
        projects={projects}
        selectedProjectId={selectedProject.id}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground text-balance">
            {selectedProject.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Organiza las tareas de este proyecto por estado. Arrastra una
            tarjeta entre columnas o usa el menú para cambiar su estado.
          </p>
        </div>
        <KanbanBoard initialTasks={tasks} projectId={selectedProject.id} />
      </main>
    </div>
  )
}
