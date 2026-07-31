# Task Management App

A Kanban-style task management application built with Next.js, Better Auth, and Drizzle ORM.

## Prerequisites

- Node.js 24+
- pnpm 11.17+
- Docker (for local PostgreSQL)

## Setup

```bash
# Start the database
docker compose up -d

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Install dependencies
pnpm install

# Run database migrations
pnpm exec drizzle-kit migrate
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Base URL for Better Auth (e.g. `http://localhost:3000`) |
| `RATE_LIMIT_MAX` | Max requests per window |
| `RATE_LIMIT_WINDOW` | Rate limit window duration |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

## Architecture

- **Framework**: Next.js (App Router) with React Server Components
- **Auth**: Better Auth with proxy-based session validation
- **Database**: PostgreSQL via Drizzle ORM
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Server Actions**: Used for data mutations (task CRUD)
