import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTasks } from '@/app/actions/tasks'
import { AppHeader } from '@/components/app-header'
import { KanbanBoard } from '@/components/kanban-board'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const result = await getTasks()
  if (!result.ok) redirect('/sign-in')
  const tasks = result.tasks

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        name={session.user.name ?? ''}
        email={session.user.email ?? ''}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
            Mi tablero
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Organiza tus tareas por estado. Arrastra una tarjeta entre columnas
            o usa el menú para cambiar su estado.
          </p>
        </div>
        <KanbanBoard initialTasks={tasks} />
      </main>
    </div>
  )
}
