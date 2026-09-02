'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function AppHeader({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut()
      router.push('/sign-in')
      router.refresh()
    })
  }

  const initial = (name || email || '?').charAt(0).toUpperCase()

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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

        <div className="flex items-center gap-3">
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
    </header>
  )
}
