# Todo App — Plan 1 of 4: Backend Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the deployment target (Vercel), the database (Turso), authentication (cookie + CSRF), and the auth UI (login page, empty `/todos` placeholder). At the end you can log in on your phone at `alola.org/todos`, see a blank placeholder list, and log out.

**Architecture:** Nuxt 4 server routes run as Vercel serverless functions (Node runtime). Data in Turso via `@libsql/client`. Cookie sessions with 30-day sliding expiry, double-submit CSRF token. User seeded via one-time CLI script (no public signup). API-key bearer path is *stubbed* here so later plans slot straight in.

**Tech Stack:** Nuxt 4, Vue 3 (`<script setup>`), Tailwind, TypeScript, `@libsql/client`, `bcryptjs`, `@iconify/vue` (already-loaded Nuxt doesn't include icons — we use inline SVGs to avoid a new dep).

**Spec:** `docs/superpowers/specs/2026-04-18-todo-app-design.md`

**Dependent plans (future, not in scope here):**
- Plan 2: Core task UX (online-only)
- Plan 3: Offline + PWA
- Plan 4: API keys + external integrations

**No test framework** is configured on this repo (per `CLAUDE.md`). There are therefore no TDD steps — each task has manual verification. Commits are frequent, one per task.

---

## File Structure

**Create:**
- `migrations/001_init.sql` — full DDL (tables + indexes for the whole app, so later plans don't need new migrations for their domain)
- `scripts/migrate.ts` — applies pending migrations; tracked via `schema_migrations` table
- `scripts/seed-user.ts` — one-time user + default-categories seed; `--reset` flag updates the existing user's password hash
- `server/utils/db.ts` — libSQL client singleton
- `server/utils/errors.ts` — typed error codes + `throwApiError()` helper
- `server/utils/auth.ts` — resolves `user_id` from cookie OR bearer (bearer path stubbed); sliding-session logic
- `server/utils/csrf.ts` — generate + verify CSRF token (double-submit pattern)
- `server/utils/rateLimit.ts` — in-memory token bucket
- `server/utils/constants.ts` — cookie names, session TTL, rate-limit presets
- `server/middleware/requestContext.ts` — attaches `{ user_id?, session_id? }` to `event.context`
- `server/api/auth/login.post.ts`
- `server/api/auth/logout.post.ts`
- `server/api/auth/me.get.ts`
- `app/layouts/app.vue` — app-chrome layout variant (no public header/footer; reduced grain)
- `app/middleware/auth.ts` — route middleware redirecting unauthenticated users to `/todos/login`
- `app/composables/useSession.ts`
- `app/utils/apiFetch.ts` — `$fetch` wrapper that injects `X-CSRF-Token` on mutating requests
- `app/pages/todos/login.vue`
- `app/pages/todos/index.vue` — empty placeholder (Plan 2 populates it)
- `.env.example` — documents required env vars

**Modify:**
- `nuxt.config.ts` — change `nitro.preset` from `cloudflare-pages-static` to `vercel`, add `routeRules` for security headers
- `package.json` — add `@libsql/client`, `bcryptjs`, `@types/bcryptjs`; add `db:migrate` + `db:seed` scripts
- `.gitignore` — add `.env`, `local.db`, `local.db-journal`, `*.db-shm`, `*.db-wal`

---

## Prerequisites (one-time, before Task 1)

- [ ] **Install the Turso CLI** (if not already installed).

```bash
curl -sSfL https://get.tur.so/install.sh | bash
# follow the printed instruction to add ~/.turso to PATH, then:
turso --version
```

- [ ] **Log in to Turso + create two databases** (one for local dev, one for prod).

```bash
turso auth login
turso db create alola-todos-dev
turso db create alola-todos
turso db show alola-todos-dev --url
turso db show alola-todos --url
turso db tokens create alola-todos-dev
turso db tokens create alola-todos
```

Save the two URLs and two tokens — you'll put them in `.env` (dev) and Vercel env vars (prod) during the plan.

---

### Task 1: Add `.env.example`, update `.gitignore`, install npm deps

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Write `.env.example`**

Create `.env.example`:

```bash
# Turso database (dev uses a separate DB from prod)
DATABASE_URL=libsql://alola-todos-dev-<org>.turso.io
DATABASE_AUTH_TOKEN=

# One-time seed (used by scripts/seed-user.ts)
SEED_USER_EMAIL=graeme.lawton@cartridgesave.co.uk
SEED_USER_PASSWORD=
```

- [ ] **Step 2: Copy to `.env` and fill in dev values**

```bash
cp .env.example .env
# edit .env: paste the dev DATABASE_URL, dev DATABASE_AUTH_TOKEN, and a password of your choice
```

- [ ] **Step 3: Update `.gitignore`**

The repo's existing `.gitignore` already covers `.env` (explicit line) and `.env.local` (via `.env.*`). Only add the local-database patterns here.

Append to `.gitignore`:

```
# Local databases
local.db
local.db-journal
*.db-shm
*.db-wal
```

Verify `.env` is still ignored (should point at the pre-existing rule):

```bash
git check-ignore -v .env
# Expected: .gitignore:<N>:.env  .env   (N is the PRE-EXISTING line, not a new one)
```

- [ ] **Step 4: Install runtime dependencies**

```bash
npm install @libsql/client bcryptjs
npm install --save-dev @types/bcryptjs tsx
```

`tsx` is for running the migration + seed TypeScript scripts directly.

- [ ] **Step 5: Add npm scripts**

In `package.json`, add to the `scripts` block:

```json
"db:migrate": "tsx scripts/migrate.ts",
"db:seed": "tsx scripts/seed-user.ts",
"db:seed:reset": "tsx scripts/seed-user.ts --reset"
```

Final `package.json` `scripts` block should look like:

```json
"scripts": {
  "build": "nuxt build",
  "dev": "nuxt dev",
  "generate": "nuxt generate",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed": "tsx scripts/seed-user.ts",
  "db:seed:reset": "tsx scripts/seed-user.ts --reset"
}
```

- [ ] **Step 6: Commit**

```bash
git add .env.example .gitignore package.json package-lock.json
git commit -m "chore(todos): add deps and env scaffolding for todo backend"
```

---

### Task 2: Write the initial migration file

**Files:**
- Create: `migrations/001_init.sql`

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p migrations
```

- [ ] **Step 2: Write `migrations/001_init.sql`**

```sql
-- 001_init.sql — initial schema for alola todos

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  tz             TEXT NOT NULL DEFAULT 'Europe/London',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent    TEXT,
  ip            TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE api_keys (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at  INTEGER,
  revoked_at    INTEGER
);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE revoked_at IS NULL;

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, name)
);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  notes         TEXT,
  priority      INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_at        INTEGER,
  completed_at  INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  client_id     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tasks_user_completed ON tasks(user_id, completed_at);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_at);
CREATE INDEX idx_tasks_user_category ON tasks(user_id, category_id);
CREATE INDEX idx_tasks_user_updated ON tasks(user_id, updated_at);
CREATE UNIQUE INDEX idx_tasks_user_client_id ON tasks(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE subtasks (
  id            INTEGER PRIMARY KEY,
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  completed_at  INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  client_id     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id, position);
CREATE UNIQUE INDEX idx_subtasks_task_client_id ON subtasks(task_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE deletions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  entity      TEXT NOT NULL CHECK (entity IN ('task', 'subtask', 'category')),
  entity_id   INTEGER NOT NULL,
  deleted_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_deletions_user_deleted_at ON deletions(user_id, deleted_at);
```

- [ ] **Step 3: Commit**

```bash
git add migrations/001_init.sql
git commit -m "feat(todos): add initial database schema"
```

---

### Task 3: Write the migration runner and libSQL client

**Files:**
- Create: `scripts/migrate.ts`
- Create: `server/utils/db.ts`

- [ ] **Step 1: Write `server/utils/db.ts`**

```ts
// server/utils/db.ts — libSQL client singleton
import { createClient, type Client } from '@libsql/client'

let _client: Client | null = null

export function db(): Client {
  if (_client) return _client
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  _client = createClient({ url, authToken })
  return _client
}
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

```ts
// scripts/migrate.ts — applies any migrations not yet recorded in schema_migrations
import { createClient } from '@libsql/client'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import 'dotenv/config'

async function main() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const client = createClient({ url, authToken })

  // Ensure the tracking table exists (idempotent)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const migrationsDir = resolve(process.cwd(), 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  const { rows: appliedRows } = await client.execute('SELECT name FROM schema_migrations')
  const applied = new Set(appliedRows.map(r => r.name as string))

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· skip ${file} (already applied)`)
      continue
    }
    const sql = await readFile(resolve(migrationsDir, file), 'utf8')
    // Split on `;` at end-of-line so multiple statements apply in order.
    // libSQL doesn't accept multi-statement strings via .execute().
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    for (const stmt of statements) {
      try {
        await client.execute(stmt)
      } catch (e) {
        console.error(`✗ failed in ${file}:\n${stmt}\n`, e)
        process.exit(1)
      }
    }
    await client.execute({
      sql: 'INSERT INTO schema_migrations (name) VALUES (?)',
      args: [file],
    })
    console.log(`✓ applied ${file}`)
  }

  console.log('Migrations complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Add `dotenv` dependency (tsx needs it for CLI scripts)**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 4: Run the migration against the dev database**

```bash
npm run db:migrate
```

Expected output:
```
✓ applied 001_init.sql
Migrations complete.
```

Verify via Turso shell:

```bash
turso db shell alola-todos-dev ".schema"
```

Expected: you should see `users`, `sessions`, `api_keys`, `categories`, `tasks`, `subtasks`, `deletions`, `schema_migrations`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.ts server/utils/db.ts package.json package-lock.json
git commit -m "feat(todos): add libSQL client and migration runner"
```

---

### Task 4: Seed-user script with default categories

**Files:**
- Create: `scripts/seed-user.ts`

- [ ] **Step 1: Write `scripts/seed-user.ts`**

```ts
// scripts/seed-user.ts — creates the single user + default categories; or with --reset, rotates the password
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const DEFAULT_CATEGORIES = [
  { name: 'Scouts',   color: '#4a7c59', position: 0 },
  { name: 'KMRT',     color: '#3b82f6', position: 1 },
  { name: 'Work',     color: '#8b5cf6', position: 2 },
  { name: 'Personal', color: '#e879c8', position: 3 },
]

async function main() {
  const reset = process.argv.includes('--reset')
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  const email = process.env.SEED_USER_EMAIL
  const password = process.env.SEED_USER_PASSWORD

  if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }
  if (!email) { console.error('SEED_USER_EMAIL not set'); process.exit(1) }
  if (!password) { console.error('SEED_USER_PASSWORD not set'); process.exit(1) }

  const client = createClient({ url, authToken })
  const hash = await bcrypt.hash(password, 12)

  const { rows } = await client.execute('SELECT id FROM users LIMIT 1')

  if (rows.length > 0) {
    const userId = rows[0].id as number
    if (!reset) {
      console.error(`A user already exists (id ${userId}). Pass --reset to rotate their password.`)
      process.exit(1)
    }
    await client.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [hash, userId],
    })
    console.log(`✓ reset password for user ${userId}`)
    return
  }

  // Insert user
  const { lastInsertRowid } = await client.execute({
    sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    args: [email, hash],
  })
  const userId = Number(lastInsertRowid)
  console.log(`✓ created user ${userId} (${email})`)

  // Seed default categories
  for (const cat of DEFAULT_CATEGORIES) {
    await client.execute({
      sql: 'INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)',
      args: [userId, cat.name, cat.color, cat.position],
    })
  }
  console.log(`✓ seeded ${DEFAULT_CATEGORIES.length} categories`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the seed**

```bash
npm run db:seed
```

Expected:
```
✓ created user 1 (graeme.lawton@cartridgesave.co.uk)
✓ seeded 4 categories
```

Running it again should fail loudly:

```bash
npm run db:seed
# Expected: A user already exists (id 1). Pass --reset to rotate their password.
```

Running with `--reset` should succeed:

```bash
npm run db:seed:reset
# Expected: ✓ reset password for user 1
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-user.ts
git commit -m "feat(todos): add seed-user script with default categories"
```

---

### Task 5: Server utility modules — errors, rate limiter, CSRF

**Files:**
- Create: `server/utils/constants.ts`
- Create: `server/utils/errors.ts`
- Create: `server/utils/rateLimit.ts`
- Create: `server/utils/csrf.ts`

- [ ] **Step 1: Write `server/utils/constants.ts`**

```ts
// server/utils/constants.ts
export const SESSION_COOKIE = 'alola_session'
export const CSRF_COOKIE = 'alola_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  // 30 days
export const SESSION_SLIDE_THRESHOLD_SECONDS = 7 * 24 * 60 * 60  // slide forward when < 7d remain

export const RATE_LIMITS = {
  login:   { windowMs: 60_000, max: 5   },  // per IP
  writes:  { windowMs: 60_000, max: 60  },  // per user
} as const

export const BEARER_PREFIX = 'alola_tk_'
```

- [ ] **Step 2: Write `server/utils/errors.ts`**

```ts
// server/utils/errors.ts
import { createError, type H3Event } from 'h3'

export type ApiErrorCode =
  | 'auth_required'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'client_id_conflict'
  | 'rate_limited'
  | 'internal'

const STATUS: Record<ApiErrorCode, number> = {
  auth_required:       401,
  forbidden:           403,
  not_found:           404,
  validation_failed:   422,
  client_id_conflict:  409,
  rate_limited:        429,
  internal:            500,
}

export function apiError(code: ApiErrorCode, message: string) {
  return createError({
    statusCode: STATUS[code],
    statusMessage: code,
    data: { error: { code, message } },
  })
}

export function throwApiError(code: ApiErrorCode, message: string): never {
  throw apiError(code, message)
}

/** Handy for untrusted input at the top of a handler. */
export function requireField<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || value === '') {
    throwApiError('validation_failed', `${name} is required`)
  }
  return value as T
}
```

- [ ] **Step 3: Write `server/utils/rateLimit.ts`**

```ts
// server/utils/rateLimit.ts — in-memory token bucket. Best-effort on serverless
// (each function instance has its own bucket). Fine for a single-user app.
import { throwApiError } from './errors'

interface Bucket {
  tokens: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Call at the top of a handler; throws rate_limited if exceeded. */
export function rateLimit(key: string, opts: { windowMs: number; max: number }) {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { tokens: opts.max, resetAt: now + opts.windowMs }
    buckets.set(key, bucket)
  }
  if (bucket.tokens <= 0) {
    throwApiError('rate_limited', 'Too many requests — slow down.')
  }
  bucket.tokens -= 1
}

/** Periodically prune old buckets so the map doesn't grow unbounded. */
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
}, 5 * 60_000).unref?.()
```

- [ ] **Step 4: Write `server/utils/csrf.ts`**

```ts
// server/utils/csrf.ts — double-submit token.
// The token is a 32-byte random value. We put it in a *readable* cookie so the
// client JS can echo it back in an X-CSRF-Token header. A mutating request
// authenticated via cookie must carry both; server compares header === cookie.
import { randomBytes } from 'node:crypto'
import { getCookie, getHeader, type H3Event } from 'h3'
import { CSRF_COOKIE, CSRF_HEADER } from './constants'
import { throwApiError } from './errors'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Throws forbidden if the request lacks a matching CSRF cookie/header pair. */
export function verifyCsrf(event: H3Event) {
  const cookie = getCookie(event, CSRF_COOKIE)
  const header = getHeader(event, CSRF_HEADER)
  if (!cookie || !header || cookie !== header) {
    throwApiError('forbidden', 'CSRF token missing or invalid')
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add server/utils/constants.ts server/utils/errors.ts server/utils/rateLimit.ts server/utils/csrf.ts
git commit -m "feat(todos): add server utility modules (errors, rate-limit, CSRF, constants)"
```

---

### Task 6: Auth resolver and request-context middleware

**Files:**
- Create: `server/utils/auth.ts`
- Create: `server/middleware/requestContext.ts`

- [ ] **Step 1: Write `server/utils/auth.ts`**

```ts
// server/utils/auth.ts — resolves user_id from session cookie OR bearer API key.
// Bearer path is STUBBED in Plan 1 (returns null); Plan 4 finishes it.
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3'
import { db } from './db'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  SESSION_TTL_SECONDS,
  SESSION_SLIDE_THRESHOLD_SECONDS,
  BEARER_PREFIX,
} from './constants'
import { generateCsrfToken } from './csrf'
import { throwApiError } from './errors'

// `Secure` cookies are rejected on plain http in some browsers (including
// Safari on localhost, and some WSL2 + Windows-side browser combos). Gate the
// flag on production so local dev over http://localhost works without friction.
const IS_PROD = process.env.NODE_ENV === 'production'

export interface AuthContext {
  userId: number
  sessionId?: string  // set when auth came from a cookie, not a bearer
  authMethod: 'cookie' | 'bearer'
}

/** Generate a new session id. */
export function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

/** Create a session row and set both cookies on the response. */
export async function startSession(event: H3Event, userId: number): Promise<string> {
  const id = newSessionId()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + SESSION_TTL_SECONDS
  const ua = getHeader(event, 'user-agent') ?? null
  const ip =
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getHeader(event, 'x-real-ip') ??
    null

  await db().execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)',
    args: [id, userId, expiresAt, ua, ip],
  })

  setCookie(event, SESSION_COOKIE, id, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  setCookie(event, CSRF_COOKIE, generateCsrfToken(), {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  return id
}

/** Delete the session row and clear both cookies. No-op if not logged in. */
export async function endSession(event: H3Event) {
  const id = getCookie(event, SESSION_COOKIE)
  if (id) {
    await db().execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [id] })
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, CSRF_COOKIE, { path: '/' })
}

/** Purge expired sessions. Called opportunistically on login. */
export async function purgeExpiredSessions() {
  const now = Math.floor(Date.now() / 1000)
  await db().execute({ sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [now] })
}

/**
 * Resolve the authenticated user for this event.
 * Returns null if unauthenticated.
 * Slides session expiry forward when within the slide threshold.
 */
export async function resolveAuth(event: H3Event): Promise<AuthContext | null> {
  // 1. Cookie session
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) {
    const now = Math.floor(Date.now() / 1000)
    const { rows } = await db().execute({
      sql: 'SELECT user_id, expires_at FROM sessions WHERE id = ?',
      args: [sessionId],
    })
    if (rows.length > 0) {
      const row = rows[0]
      const expiresAt = Number(row.expires_at)
      if (expiresAt > now) {
        // Touch last_used_at
        await db().execute({
          sql: 'UPDATE sessions SET last_used_at = ? WHERE id = ?',
          args: [now, sessionId],
        })
        // Slide expiry if close to the edge
        if (expiresAt - now < SESSION_SLIDE_THRESHOLD_SECONDS) {
          const newExpires = now + SESSION_TTL_SECONDS
          await db().execute({
            sql: 'UPDATE sessions SET expires_at = ? WHERE id = ?',
            args: [newExpires, sessionId],
          })
          // Re-set both cookies so the browser picks up the new max-age.
          // Re-use the existing CSRF token so in-flight requests aren't broken.
          setCookie(event, SESSION_COOKIE, sessionId, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL_SECONDS,
          })
          const currentCsrf = getCookie(event, CSRF_COOKIE) ?? generateCsrfToken()
          setCookie(event, CSRF_COOKIE, currentCsrf, {
            httpOnly: false,
            secure: IS_PROD,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL_SECONDS,
          })
        }
        return {
          userId: Number(row.user_id),
          sessionId,
          authMethod: 'cookie',
        }
      }
    }
  }

  // 2. Bearer API key — STUB. Plan 4 implements the full path.
  const authz = getHeader(event, 'authorization')
  if (authz && authz.startsWith('Bearer ')) {
    const token = authz.slice(7)
    if (token.startsWith(BEARER_PREFIX)) {
      // Placeholder: real implementation in Plan 4.
      return null
    }
  }

  return null
}
```

- [ ] **Step 2: Write `server/middleware/requestContext.ts`**

```ts
// server/middleware/requestContext.ts
// Attaches resolved auth to event.context for all API routes. Handlers that
// need auth call requireAuth() (below); handlers that don't just ignore it.
import { defineEventHandler } from 'h3'
import { resolveAuth, type AuthContext } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}

export default defineEventHandler(async (event) => {
  // Only resolve auth for /api/* — pages don't need it, the client does its own check.
  if (!event.path?.startsWith('/api/')) return
  const ctx = await resolveAuth(event)
  if (ctx) event.context.auth = ctx
})
```

- [ ] **Step 3: Add a `requireAuth()` helper at the bottom of `server/utils/auth.ts`**

`throwApiError` is already imported at the top of `auth.ts` (from Step 1). Append at the end of the file:

```ts
/** Throws auth_required if the event has no resolved auth context. */
export function requireAuth(event: H3Event): AuthContext {
  const ctx = event.context.auth
  if (!ctx) throwApiError('auth_required', 'Authentication required')
  return ctx
}
```

- [ ] **Step 4: Commit**

```bash
git add server/utils/auth.ts server/middleware/requestContext.ts
git commit -m "feat(todos): add auth resolver, session helpers, request-context middleware"
```

---

### Task 7: Login endpoint

**Files:**
- Create: `server/api/auth/login.post.ts`

- [ ] **Step 1: Write `server/api/auth/login.post.ts`**

```ts
// server/api/auth/login.post.ts
import { defineEventHandler, readBody, getHeader, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import { db } from '../../utils/db'
import { startSession, purgeExpiredSessions } from '../../utils/auth'
import { throwApiError, requireField } from '../../utils/errors'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'

// Bogus but real-format bcrypt hash used when the email doesn't exist, so
// compare time matches the real-user path. Computed at module load once.
const UNREACHABLE_HASH = bcrypt.hashSync('\0', 12)

interface LoginBody {
  email?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  // Per-IP rate limit (5/min) — before we know who the user is.
  const ip =
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getHeader(event, 'x-real-ip') ??
    'unknown'
  rateLimit(`login:${ip}`, RATE_LIMITS.login)

  const body = await readBody<LoginBody>(event)
  const email = requireField(body?.email?.trim().toLowerCase(), 'email')
  const password = requireField(body?.password, 'password')

  const { rows } = await db().execute({
    sql: 'SELECT id, password_hash FROM users WHERE email = ?',
    args: [email],
  })

  // Compare against a real-format hash even if the user doesn't exist, so
  // timing doesn't leak whether an email is registered.
  const hash = (rows[0]?.password_hash as string) ?? UNREACHABLE_HASH
  const ok = await bcrypt.compare(password, hash)
  if (!ok || rows.length === 0) {
    throwApiError('auth_required', 'Invalid email or password')
  }

  const userId = Number(rows[0].id)
  await purgeExpiredSessions()
  await startSession(event, userId)

  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/auth/login.post.ts
git commit -m "feat(todos): add POST /api/auth/login"
```

---

### Task 8: Me + Logout endpoints

**Files:**
- Create: `server/api/auth/me.get.ts`
- Create: `server/api/auth/logout.post.ts`

- [ ] **Step 1: Write `server/api/auth/me.get.ts`**

```ts
// server/api/auth/me.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireAuth, endSession } from '../../utils/auth'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const { rows } = await db().execute({
    sql: 'SELECT id, email, tz FROM users WHERE id = ?',
    args: [userId],
  })
  if (rows.length === 0) {
    // Session points to a missing user — clear the cookies and 401.
    await endSession(event)
    throwApiError('auth_required', 'User not found')
  }
  return {
    id: Number(rows[0].id),
    email: rows[0].email as string,
    tz: rows[0].tz as string,
  }
})
```

- [ ] **Step 2: Write `server/api/auth/logout.post.ts`**

```ts
// server/api/auth/logout.post.ts
import { defineEventHandler, setResponseStatus } from 'h3'
import { endSession } from '../../utils/auth'
import { verifyCsrf } from '../../utils/csrf'

export default defineEventHandler(async (event) => {
  // Logout is cookie-auth only. If there is no session, it's still safe to
  // no-op. If there is, we require a valid CSRF token.
  if (event.context.auth?.authMethod === 'cookie') {
    verifyCsrf(event)
  }
  await endSession(event)
  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 3: Locally smoke-test the auth endpoints**

In one terminal:
```bash
npm run dev
```

In another:
```bash
# Bad password — expect 401
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"graeme.lawton@cartridgesave.co.uk","password":"wrong"}'

# Good password — expect 204 + Set-Cookie headers for alola_session and alola_csrf
curl -i -c /tmp/alola.cookies -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d "{\"email\":\"graeme.lawton@cartridgesave.co.uk\",\"password\":\"$SEED_USER_PASSWORD\"}"

# Me with cookie — expect 200 and {id, email, tz}
curl -i -b /tmp/alola.cookies http://localhost:3000/api/auth/me

# Me without cookie — expect 401 {error:{code:'auth_required'...}}
curl -i http://localhost:3000/api/auth/me
```

Expected: login sets two `Set-Cookie` headers (`alola_session` with `HttpOnly`, `alola_csrf` without). `me` returns JSON on valid cookie, 401 otherwise.

- [ ] **Step 4: Commit**

```bash
git add server/api/auth/me.get.ts server/api/auth/logout.post.ts
git commit -m "feat(todos): add GET /api/auth/me and POST /api/auth/logout"
```

---

### Task 9: Switch Nitro preset to Vercel + security headers

**Files:**
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Read current config**

```bash
cat nuxt.config.ts
```

- [ ] **Step 2: Replace `nuxt.config.ts` with the updated version**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
  css: ['~/assets/sass/main.scss'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      titleTemplate: '%s — alola.org',
      meta: [
        { name: 'description', content: 'Graeme Lawton — serial volunteer, technical nerd, hobby collector, outdoors lover.' },
        { property: 'og:site_name', content: 'alola.org' },
        { property: 'og:type', content: 'website' },
        { name: 'theme-color', content: '#141210' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    preset: 'vercel',
  },
  // Security headers. CSP is intentionally NOT set here — Nuxt's hydration
  // relies on inline scripts, so a strict CSP needs nonce-based integration
  // (e.g. @nuxtjs/security). Adding that correctly is tracked for Plan 3.
  routeRules: {
    '/**': {
      headers: {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    '/todos/**': {
      headers: {
        'X-Frame-Options': 'DENY',
      },
    },
    '/api/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
      },
    },
  },
  postcss: {
    plugins: {
      'tailwindcss': {},
      'autoprefixer': {},
    },
  },
})
```

Notes:
- Preset change: `cloudflare-pages-static` → `vercel`.
- Added Inter to the Google Fonts URL (app UI uses Inter; public site still uses Syne + Lora).
- `routeRules` sets universal HSTS + nosniff + Referrer-Policy, and X-Frame-Options on `/todos/**` and `/api/**`.
- **CSP is deliberately omitted.** A strict CSP breaks Nuxt SSR hydration (inline state scripts) and Vite HMR (blob workers). Proper nonce-based CSP integration is scheduled for Plan 3 via `@nuxtjs/security` or equivalent.

- [ ] **Step 3: Restart `npm run dev` and verify headers**

```bash
curl -i http://localhost:3000/ | head -20
# Expected: Strict-Transport-Security present

curl -i http://localhost:3000/todos | head -20
# Expected: X-Frame-Options: DENY present
# (Will 404 for the page itself until Task 14; headers still apply)
```

- [ ] **Step 4: Commit**

```bash
git add nuxt.config.ts
git commit -m "feat(todos): switch Nitro preset to Vercel and add security headers"
```

---

### Task 10: App-chrome layout variant

**Files:**
- Create: `app/layouts/app.vue`

- [ ] **Step 1: Write `app/layouts/app.vue`**

```vue
<template>
  <div class="min-h-screen bg-surface text-ink" style="font-family: 'Inter', system-ui, sans-serif;">
    <div class="grain-light" />
    <main class="relative z-10 mx-auto w-full max-w-2xl px-4 pt-4 pb-24 lg:max-w-6xl lg:px-6 lg:pt-6">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Grain at ~40% of the public site's opacity. */
.grain-light {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  opacity: 0.015;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/layouts/app.vue
git commit -m "feat(todos): add app-chrome layout variant"
```

---

### Task 11: `apiFetch` utility and session composable

**Files:**
- Create: `app/utils/apiFetch.ts`
- Create: `app/composables/useSession.ts`

Rather than monkey-patching Nuxt's global `$fetch`, we expose a small `apiFetch` wrapper that auto-injects `X-CSRF-Token` on mutating requests. Every call that goes to `/api/*` should use `apiFetch`, not raw `$fetch`.

- [ ] **Step 1: Write `app/utils/apiFetch.ts`**

```ts
// app/utils/apiFetch.ts — wraps $fetch to inject CSRF on mutating requests.
import type { FetchOptions } from 'ofetch'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length))
  }
  return null
}

export async function apiFetch<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const method = (opts.method ?? 'GET').toString().toUpperCase()
  if (MUTATING.has(method)) {
    const token = readCookie('alola_csrf')
    if (token) {
      const headers = new Headers(opts.headers as HeadersInit | undefined)
      headers.set('X-CSRF-Token', token)
      opts.headers = headers
    }
  }
  return await $fetch<T>(url, opts as any)
}
```

- [ ] **Step 2: Write `app/composables/useSession.ts`**

```ts
// app/composables/useSession.ts
import { ref, computed } from 'vue'
import { navigateTo } from '#app'
import { apiFetch } from '~/utils/apiFetch'

export interface SessionUser {
  id: number
  email: string
  tz: string
}

const user = ref<SessionUser | null>(null)
const loaded = ref(false)

export function useSession() {
  const isAuthenticated = computed(() => user.value !== null)

  async function refresh() {
    try {
      user.value = await apiFetch<SessionUser>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(email: string, password: string) {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    await refresh()
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* best-effort */
    }
    user.value = null
    await navigateTo('/todos/login')
  }

  return { user, loaded, isAuthenticated, refresh, login, logout }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/utils/apiFetch.ts app/composables/useSession.ts
git commit -m "feat(todos): add apiFetch utility and session composable"
```

---

### Task 12: Client route middleware (auth redirect)

**Files:**
- Create: `app/middleware/auth.ts`

- [ ] **Step 1: Write `app/middleware/auth.ts`**

```ts
// app/middleware/auth.ts — redirects unauthenticated users to the login page.
// Applied on /todos/* pages except /todos/login (which sets skipAuth in meta).
import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useSession } from '~/composables/useSession'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.skipAuth) return
  const { loaded, isAuthenticated, refresh } = useSession()
  if (!loaded.value) await refresh()
  if (!isAuthenticated.value) {
    return navigateTo({
      path: '/todos/login',
      query: { next: to.fullPath },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add app/middleware/auth.ts
git commit -m "feat(todos): add client route middleware for auth redirect"
```

---

### Task 13: Login page

**Files:**
- Create: `app/pages/todos/login.vue`

- [ ] **Step 1: Write `app/pages/todos/login.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, navigateTo, definePageMeta } from '#imports'
import { useSession } from '~/composables/useSession'

definePageMeta({
  layout: 'app',
  skipAuth: true,
})

useHead({ title: 'Sign in' })

const { login, refresh, isAuthenticated } = useSession()
const route = useRoute()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  // If we arrived here with an already-valid session, bounce forward.
  await refresh()
  if (isAuthenticated.value) await goNext()
})

async function goNext() {
  const next = typeof route.query.next === 'string' ? route.query.next : '/todos'
  // Only allow same-origin paths.
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/todos'
  await navigateTo(safe)
}

async function onSubmit() {
  errorMsg.value = null
  submitting.value = true
  try {
    await login(email.value.trim(), password.value)
    await goNext()
  } catch (e: any) {
    errorMsg.value = e?.data?.error?.message ?? 'Sign in failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <form class="w-full max-w-sm space-y-5" @submit.prevent="onSubmit">
      <div class="space-y-1">
        <div class="font-display text-2xl font-bold tracking-tight">alola <span class="text-ink-faint">/todos</span></div>
        <div class="text-sm text-ink-muted">Sign in to continue</div>
      </div>

      <label class="block space-y-1.5">
        <span class="text-xs uppercase tracking-wider text-ink-muted">Email</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="w-full rounded-lg border border-ink-faint/20 bg-surface-raised px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>

      <label class="block space-y-1.5">
        <span class="text-xs uppercase tracking-wider text-ink-muted">Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-lg border border-ink-faint/20 bg-surface-raised px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>

      <p v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface transition-opacity disabled:opacity-60"
      >
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/todos/login.vue
git commit -m "feat(todos): add login page"
```

---

### Task 14: Empty `/todos` placeholder with logout

**Files:**
- Create: `app/pages/todos/index.vue`

- [ ] **Step 1: Write `app/pages/todos/index.vue`**

```vue
<script setup lang="ts">
import { useSession } from '~/composables/useSession'
import { definePageMeta } from '#imports'

definePageMeta({
  layout: 'app',
  middleware: ['auth'],
})

useHead({ title: 'Todos' })

const { user, logout } = useSession()
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-baseline justify-between">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight">Today</h1>
        <p class="text-sm text-ink-muted">Signed in as {{ user?.email }}</p>
      </div>
      <button
        class="rounded-md border border-ink-faint/20 px-3 py-1.5 text-xs uppercase tracking-wider text-ink-muted hover:text-ink"
        @click="logout"
      >
        Sign out
      </button>
    </header>

    <div class="rounded-xl border border-ink-faint/10 bg-surface-raised/50 px-5 py-8 text-center">
      <p class="font-display text-lg text-ink">Nothing here yet.</p>
      <p class="mt-1 text-sm text-ink-muted">
        Plan 2 fills this view in. You can log in, log out, and hit the auth API.
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/todos/index.vue
git commit -m "feat(todos): add /todos placeholder page with sign-out"
```

---

### Task 15: Local end-to-end smoke test

No files — this is a verification task before we deploy. If anything fails, fix it and only *then* move on.

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: In a browser, hit `http://localhost:3000/todos`**

Expected: redirect to `/todos/login?next=/todos` (URL query param present).

- [ ] **Step 3: Sign in with your seeded credentials**

Expected: redirect to `/todos`. Header shows "Today" and your email. Placeholder card reads "Nothing here yet."

- [ ] **Step 4: Open DevTools → Application → Cookies for localhost**

Expected: two cookies for `/` — `alola_session` (HttpOnly) and `alola_csrf` (readable).

- [ ] **Step 5: In DevTools → Application → Service Workers, confirm NO service worker is registered**

(Plan 3 adds the SW. Plan 1 should not register anything.)

- [ ] **Step 6: Test sign-out**

Click "Sign out" → redirected to login page. Cookies cleared.

- [ ] **Step 7: Test wrong password**

Enter a bad password → red error "Invalid email or password". No redirect.

- [ ] **Step 8: Test CSRF enforcement on logout**

```bash
# Log in via curl to get cookies:
curl -s -c /tmp/alola.cookies -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d "{\"email\":\"graeme.lawton@cartridgesave.co.uk\",\"password\":\"$SEED_USER_PASSWORD\"}"

# Logout WITHOUT the CSRF header — expect 403 forbidden
curl -i -b /tmp/alola.cookies -X POST http://localhost:3000/api/auth/logout

# Logout WITH the CSRF header — expect 204
CSRF=$(grep alola_csrf /tmp/alola.cookies | awk '{print $NF}')
curl -i -b /tmp/alola.cookies -X POST http://localhost:3000/api/auth/logout \
  -H "X-CSRF-Token: $CSRF"
```

- [ ] **Step 9: Test rate limit**

```bash
for i in $(seq 1 7); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"x@x","password":"x"}'
done
# Expected: first 5 → 401, next → 429
```

- [ ] **Step 10: Test non-https security headers apply**

```bash
curl -sI http://localhost:3000/todos/login | grep -iE '(x-frame|strict-transport|x-content-type|referrer)'
# Expected: X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy all present
```

If all ten checks pass, Plan 1's local happy-path is green. Commit any fix-ups from this task as discovered.

---

### Task 16: Deploy to Vercel + cut over DNS

**Files:**
- Modify: none (operational steps)

- [ ] **Step 1: Create a Vercel project**

```bash
# From the repo root
npx vercel@latest login   # if not already logged in
npx vercel link           # link this folder to a new or existing Vercel project
```

Pick: Framework = **Nuxt.js**. Build command and output dir should auto-detect from `nuxt.config.ts`.

- [ ] **Step 2: Set production environment variables**

In the Vercel dashboard (Project → Settings → Environment Variables), or via CLI:

```bash
npx vercel env add DATABASE_URL production
# paste the PROD DATABASE_URL (alola-todos, not -dev)

npx vercel env add DATABASE_AUTH_TOKEN production
# paste the PROD token
```

**Important**: do NOT set `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` on Vercel — seeding is a local-only operation you run once against the prod DB.

- [ ] **Step 3: Run migrations + seed against the prod Turso DB**

```bash
# Temporarily point .env at PROD
cp .env .env.dev.bak
cat > .env <<EOF
DATABASE_URL=libsql://alola-todos-<org>.turso.io
DATABASE_AUTH_TOKEN=<prod token>
SEED_USER_EMAIL=graeme.lawton@cartridgesave.co.uk
SEED_USER_PASSWORD=<a strong password you want for prod>
EOF

npm run db:migrate
# Expected: ✓ applied 001_init.sql

npm run db:seed
# Expected: created user, seeded categories

# Restore dev env
mv .env.dev.bak .env
```

- [ ] **Step 4: Deploy to a preview**

```bash
npx vercel
# Answer: link to existing project
# Get the preview URL and open it
```

Test: `<preview>/todos/login` should load and sign-in should work.

- [ ] **Step 5: Promote to production**

```bash
npx vercel --prod
```

- [ ] **Step 6: Cut over DNS**

In your DNS host (Cloudflare):
- Remove the Cloudflare Pages production binding for alola.org.
- Add the Vercel-instructed `A` / `CNAME` record for alola.org.

Wait for propagation (usually < 5 min). Verify `dig alola.org` returns the Vercel edge IP.

- [ ] **Step 7: Verify prod end-to-end**

- `https://alola.org/` — public site still looks right (pre-rendered pages still serve).
- `https://alola.org/todos` — redirects to `/todos/login`.
- Sign in with prod credentials — lands on the placeholder.
- Sign out — back to login.

- [ ] **Step 8: Decommission the Cloudflare Pages deployment**

Once the site has been verified on Vercel for a full day, delete the Cloudflare Pages project for `alola.org` so you don't pay double attention.

- [ ] **Step 9: Commit any deployment config (e.g. `vercel.json` if Vercel created one)**

```bash
git add vercel.json 2>/dev/null || true
git status
git commit -m "chore(todos): Vercel deployment config" 2>/dev/null || echo "(nothing to commit — deployment is metadata in Vercel)"
```

---

## Rollout summary

After Task 16 is green:
- `alola.org` is on Vercel.
- `alola.org/todos` redirects to `/todos/login` for unauthenticated users.
- You can log in on your phone and see the placeholder.
- Cookies (`alola_session` HttpOnly, `alola_csrf` readable) flow; CSRF is enforced on mutating cookie-authed requests.
- Rate limiting works.
- Security headers apply on `/todos/**` and `/api/**`.
- Default categories (Scouts, KMRT, Work, Personal) exist in prod DB ready for Plan 2 to render.

Plan 2 starts from this baseline and builds the actual task UX.

---

## Self-review notes (verified by the author of this plan)

- **Spec coverage:** Plan 1 covers — deployment switch, DB schema, auth endpoints, session + CSRF, security headers, login UX, seeding, app-chrome layout. Out-of-scope-by-design: PWA (Plan 3), task/category/subtask endpoints + UI (Plan 2), API-key management (Plan 4).
- **Bearer API-key path** is a stub returning `null` — tested by the rest of the cookie flow still working, fully implemented in Plan 4. Documented as such in `server/utils/auth.ts`.
- **Type consistency:** cookie names, TTL constants, and rate-limit presets all come from `server/utils/constants.ts` — used from every consumer.
- **No placeholders** in code blocks. No "TODO: add error handling" or "similar to Task N". Each task ships real code + real commands.
- **Known sharp edge:** the in-memory rate limiter is per-function-instance on Vercel serverless. For a single-user app this is fine; flagged as deferred in the spec's security section.
