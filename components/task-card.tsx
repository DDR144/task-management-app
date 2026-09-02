'use client'

import { useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, GripVertical, MoreVertical } from 'lucide-react'
import { deleteTask, updateTaskStatus } from '@/app/actions/tasks'
import type { Task, TaskPriority, TaskStatus } from '@/lib/db/schema'
import {
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/lib/task-meta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Module-level map for opaque drag token → taskId resolution.
 * Populated by TaskCard on drag start, consumed by KanbanBoard on drop.
 * Tokens are UUIDs generated client-side; raw DB IDs never leave the DOM.
 */
export const dragTokenMap = new Map<string, number>()

function formatDueDate(value: string | null): {
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

export function TaskCard({
  task,
  onEdit,
}: {
  task: Task
  onEdit: (task: Task) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const due = formatDueDate(task.dueDate)
  const isDone = task.status === 'completada'

  function handleMove(status: TaskStatus) {
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, status, task.updatedAt.toISOString())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Tarea eliminada')
      router.refresh()
    })
  }

  const dragTokenRef = useRef<string | null>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const token = crypto.randomUUID()
      dragTokenRef.current = token
      dragTokenMap.set(token, task.id)
      e.dataTransfer.setData('text/plain', token)
      e.dataTransfer.effectAllowed = 'move'
    },
    [task.id],
  )

  return (
    <article
      draggable={!isPending}
      onDragStart={handleDragStart}
      data-pending={isPending}
      className="group rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20 data-[pending=true]:opacity-60 data-[pending=true]:pointer-events-none"
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold leading-snug text-pretty ${
              isDone ? 'text-muted-foreground/70 line-through' : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                disabled={isPending}
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Opciones de la tarea</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Mover a
              </DropdownMenuLabel>
              {STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleMove(s)}>
                  {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex items-center gap-2 pl-5">
        <Badge
          variant="outline"
          className={`text-xs font-medium ${PRIORITY_BADGE[task.priority as TaskPriority]}`}
        >
          {PRIORITY_LABELS[task.priority as TaskPriority]}
        </Badge>
        {due && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              due.overdue && !isDone
                ? 'font-medium text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {due.label}
          </span>
        )}
      </div>
    </article>
  )
}
