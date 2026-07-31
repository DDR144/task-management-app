'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { updateTaskStatus } from '@/app/actions/tasks'
import type { Task, TaskPriority, TaskStatus } from '@/lib/db/schema'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_ACCENT,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/lib/task-meta'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskCard, dragTokenMap } from '@/components/task-card'
import { TaskDialog } from '@/components/task-dialog'

type PriorityFilter = TaskPriority | 'all'

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogStatus, setDialogStatus] = useState<TaskStatus>('pendiente')
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)

  const filteredTasks = useMemo(() => {
    if (priorityFilter === 'all') return initialTasks
    return initialTasks.filter((t) => t.priority === priorityFilter)
  }, [initialTasks, priorityFilter])

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      pendiente: [],
      en_progreso: [],
      completada: [],
    }
    for (const task of filteredTasks) {
      const status = task.status as TaskStatus
      if (map[status]) map[status].push(task)
    }
    return map
  }, [filteredTasks])

  function openCreate(status: TaskStatus) {
    setEditingTask(null)
    setDialogStatus(status)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDialogOpen(true)
  }

  function handleDrop(status: TaskStatus, e: React.DragEvent) {
    e.preventDefault()
    setDragOverStatus(null)

    const token = e.dataTransfer.getData('text/plain')
    const id = dragTokenMap.get(token)
    if (!id) return

    // Clean up resolved token
    dragTokenMap.delete(token)

    const task = initialTasks.find((t) => t.id === id)
    if (!task || task.status === status) return

    startTransition(async () => {
      const result = await updateTaskStatus(id, status, task.updatedAt.toISOString())
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      router.refresh()
    })
  }

  const totalCount = initialTasks.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label
            htmlFor="priority-filter"
            className="text-sm font-medium text-muted-foreground"
          >
            Prioridad
          </label>
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
          >
            <SelectTrigger id="priority-filter" className="w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORITY_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => openCreate('pendiente')}>
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      </div>

      {totalCount === 0 ? (
        <EmptyState onCreate={() => openCreate('pendiente')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUS_ORDER.map((status) => {
            const items = columns[status]
            const isDragOver = dragOverStatus === status
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverStatus(status)
                }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(e) => handleDrop(status, e)}
                className={`flex flex-col rounded-xl border bg-secondary/40 transition-colors ${
                  isDragOver
                    ? 'border-primary bg-accent/60'
                    : 'border-border'
                }`}
              >
                <header className="flex items-center justify-between gap-2 px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${STATUS_ACCENT[status]}`}
                      aria-hidden="true"
                    />
                    <h2 className="font-heading text-sm font-semibold text-foreground">
                      {STATUS_LABELS[status]}
                    </h2>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => openCreate(status)}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">
                      {`Añadir tarea en ${STATUS_LABELS[status]}`}
                    </span>
                  </Button>
                </header>

                <div className="flex min-h-24 flex-1 flex-col gap-3 p-4">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      {priorityFilter === 'all'
                        ? 'Sin tareas'
                        : 'Sin tareas con este filtro'}
                    </p>
                  ) : (
                    items.map((task) => (
                      <TaskCard key={task.id} task={task} onEdit={openEdit} />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultStatus={dialogStatus}
      />
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
        <Plus className="h-6 w-6" />
      </div>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Aún no tienes tareas
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        Crea tu primera tarea para empezar a organizar tu trabajo en el tablero.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Crear tarea
      </Button>
    </div>
  )
}
