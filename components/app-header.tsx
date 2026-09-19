'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckSquare, LogOut, Plus } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { createProject } from '@/app/actions/projects'
import type { Project } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LAST_PROJECT_KEY = 'taskflow:lastProjectId'

export function AppHeader({
  name,
  email,
  projects,
  selectedProjectId,
}: {
  name: string
  email: string
  projects: Project[]
  selectedProjectId: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Restore the last selected project when the URL has no explicit project.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.search.includes('projectId=')) return

    const last = localStorage.getItem(LAST_PROJECT_KEY)
    if (!last) return
    const lastId = Number(last)
    if (!Number.isInteger(lastId) || lastId <= 0) return
    if (!projects.some((p) => p.id === lastId)) return
    if (lastId === selectedProjectId) return

    router.replace(`/?projectId=${lastId}`)
  }, [projects, selectedProjectId, router])

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut()
      router.push('/sign-in')
      router.refresh()
    })
  }

  function handleSelectProject(value: string | null) {
    if (!value) return
    localStorage.setItem(LAST_PROJECT_KEY, value)
    startTransition(() => {
      router.push(`/?projectId=${value}`)
    })
  }

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    setIsCreating(true)
    try {
      const result = await createProject(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Proyecto creado')
      setCreateOpen(false)
      localStorage.setItem(LAST_PROJECT_KEY, String(result.project.id))
      router.push(`/?projectId=${result.project.id}`)
      router.refresh()
    } finally {
      setIsCreating(false)
    }
  }

  const initial = (name || email || '?').charAt(0).toUpperCase()

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <CheckSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold tracking-tight leading-tight text-foreground">
              Tablero de Tareas
            </h1>
            <p className="text-xs text-muted-foreground">
              Hola, {name || email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(selectedProjectId)}
            onValueChange={handleSelectProject}
          >
            <SelectTrigger
              id="project-select"
              className="max-w-48 bg-card shadow-xs"
              aria-label="Seleccionar proyecto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setCreateOpen(true)}
            aria-label="Crear proyecto"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground"
            aria-hidden="true"
          >
            {initial}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isPending ? 'Saliendo...' : 'Cerrar sesión'}
            </span>
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Crea un proyecto para agrupar tus tareas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Nombre</Label>
              <Input
                id="project-name"
                name="name"
                placeholder="Ej. Trabajo, Personal, Freelance"
                required
                maxLength={100}
                autoFocus
              />
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creando...' : 'Crear proyecto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  )
}
