import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit does not load Next.js-style .env.local files, so DATABASE_URL
// would be undefined when running `drizzle-kit migrate` without shell env.
config({ path: '.env.local' })

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})