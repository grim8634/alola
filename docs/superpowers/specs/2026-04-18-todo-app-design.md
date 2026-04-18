# Todo App — Design Spec

## Overview

A personal task manager at `/todos`, built into the existing alola.org Nuxt 4 site. Mobile-first, installable as a PWA on iOS and Android, with an authenticated REST API for external consumers (an AI chat assistant and a future e-ink display).

Single user (the site owner), cookie-based session auth for the web UI, API-key auth for integrations. Data lives in a Turso (SQLite) database. Reads and the app shell work offline; mutations queue in IndexedDB and flush when connectivity returns.

## Goals

- Always-visible quick-add at the top of the mobile view — capture in one tap + type + enter.
- Categories and priorities coloured at a glance; due dates legible without tapping in.
- Installable as a home-screen app on iPhone and Android.
- Works offline for reading and — with graceful queueing — for capturing.
- Externally callable so a separate chat assistant can add / complete tasks and a poller can render today's list on an e-ink display.
- Visually coherent with alola.org: same colour tokens, same Syne display font, but with app-appropriate chrome (sans body, wider container, dialled-back grain).

## Non-goals (v1)

- Multi-user / sharing.
- Recurring tasks (repeat daily / weekly / custom). Deferred; may never ship.
- Push notifications. Deferred.
- Natural-language quick-add parsing (`"email dave tomorrow high"`). Deferred.
- Background Sync API. Deferred to a later offline-polish pass.
- Self-service password reset.
- Markdown / rich text in notes.
- Attachments, images, voice input.
- Team features, comments, assignees.

## Scope — feature decisions

| Feature | v1 | Notes |
|--------|----|-------|
| Categories / projects (user CRUD, colour-coded) | ✅ | Seed Scouts / KMRT / Work / Personal on first boot |
| Priority (High / Medium / Low) | ✅ | Three levels |
| Due date (optional) | ✅ | No time-of-day in v1, just date |
| Subtasks | ✅ | Flat checklist: title + done only, no own due/priority |
| Notes / description per task | ✅ | Plain text textarea |
| Complete / uncomplete | ✅ | Tap circle · swipe right · detail-view button |
| Filter (view + category) and sort | ✅ | Today, Overdue, This week, All, per-category |
| Auto-hide completed tasks | ✅ | After next local midnight; rows stay in DB |
| PWA installable (iOS + Android) | ✅ | Dedicated `/todos/manifest.webmanifest` |
| Offline read | ✅ | SW caches app shell + last `GET /api/tasks` |
| Offline capture / queued mutations | ✅ | Main-thread queue in IndexedDB |
| REST API with API-key auth | ✅ | One master key, full CRUD on tasks/categories |
| Swipe-to-complete / swipe-to-delete | ✅ | With undo snackbar |
| Recurring tasks | ❌ | Later — maybe never |
| Push notifications | ❌ | Later |
| NLP quick-add | ❌ | Later |
| Self-service password reset | ❌ | CLI script instead |

## Architecture

- **Framework**: Nuxt 4 (existing), Vue 3, TypeScript, Tailwind CSS 3, SCSS.
- **Hosting**: Vercel. Switch Nitro preset from `cloudflare-pages-static` to `vercel`.
- **Database**: Turso (libSQL / SQLite) via `@libsql/client`. Uses Vercel's Node runtime, not Edge.
- **Password hashing**: `bcryptjs` (pure JS, no native dep; cost 12).
- **Service worker**: `@vite-pwa/nuxt` in `injectManifest` mode (Workbox under the hood for precache; custom SW code for our strategies).
- **Offline queue lib**: `idb` (small wrapper around IndexedDB).
- **No Pinia / no TanStack Query**. Plain composables (`useTasks`, `useCategories`, `useSession`).

### Deployment change

`nuxt.config.ts` currently has `nitro.preset: 'cloudflare-pages-static'`. Change to `'vercel'`. Remove the `pages-static` assumption from any future build scripts. DNS cuts over to Vercel; existing content routes (`/`, `/about`, `/projects`, `/ramblings/*`, `/scrabble-solver`, `/tic-tac-toe`) remain pre-rendered via `routeRules: { '/': { prerender: true }, ... }` so the marketing site stays static-feeling.

### High-level data flow

```
┌─────────────────────────────┐      ┌──────────────────────────┐
│  Browser / PWA (Vue)        │      │  External consumers      │
│  - UI composables           │      │  - AI chat (full CRUD)   │
│  - IndexedDB mutation queue │      │  - e-ink poller (GET)    │
│  - Service worker (cache)   │      └───────────┬──────────────┘
└──────────────┬──────────────┘                  │
               │ fetch (cookie + CSRF)           │ Authorization: Bearer alola_tk_…
               ▼                                 ▼
        ┌────────────────────────────────────────────────┐
        │  Nuxt server routes  /api/*  (Vercel Node)     │
        │  - auth middleware (cookie OR bearer)          │
        │  - CSRF check (cookie path only)               │
        │  - rate limiter                                │
        └──────────────────────┬─────────────────────────┘
                               │ @libsql/client
                               ▼
                       ┌───────────────┐
                       │  Turso (SQLite)│
                       └───────────────┘
```

## File & route layout

New / modified files:

```
nuxt.config.ts                      # nitro preset: vercel; add @vite-pwa/nuxt
app/layouts/app.vue                 # new — app-chrome layout for /todos
app/middleware/auth.ts              # route middleware, redirects to /todos/login
app/pages/todos/
  index.vue                         # list view (mobile home / desktop list)
  login.vue                         # login form
  settings/
    index.vue                       # settings hub
    categories.vue                  # CRUD categories
    keys.vue                        # API keys
app/components/Todo/
  QuickAdd.vue
  QuickAddSheet.vue                 # expanded "D hybrid" sheet
  TaskRow.vue
  TaskDetail.vue
  TaskList.vue
  Sidebar.vue                       # desktop sidebar
  FilterChips.vue
  SyncIndicator.vue
  InstallHint.vue                   # iOS + Android one-time prompts
  CategoryChip.vue
  PriorityPill.vue
app/composables/
  useSession.ts
  useTasks.ts
  useCategories.ts
  useSyncQueue.ts
  useCsrf.ts
app/utils/
  date.ts                           # today/overdue/week helpers in user TZ
  clientId.ts                       # UUID v4
server/api/
  auth/
    login.post.ts
    logout.post.ts
    me.get.ts
  tasks/
    index.get.ts                    # list with view/category/since
    index.post.ts
    [id].get.ts
    [id].patch.ts
    [id].delete.ts
    [id]/complete.post.ts
    [id]/uncomplete.post.ts
    [taskId]/subtasks.post.ts
  subtasks/
    [id].patch.ts
    [id].delete.ts
    [id]/toggle.post.ts
  categories/
    index.get.ts
    index.post.ts
    [id].patch.ts
    [id].delete.ts
  keys/
    index.get.ts
    index.post.ts
    [id].delete.ts
  todos/
    manifest.webmanifest.get.ts     # serves the scoped PWA manifest
server/utils/
  db.ts                             # libsql client singleton
  auth.ts                           # cookie + bearer resolution
  csrf.ts
  rateLimit.ts
  errors.ts
server/middleware/
  requestContext.ts
public/service-worker.ts            # injectManifest source (built by vite-pwa)
public/todos/
  icon-192.png
  icon-512.png
  icon-maskable-512.png
migrations/
  001_init.sql
scripts/
  seed-user.ts                      # one-time user seed / password reset
  migrate.ts                        # applies migrations against Turso
docs/superpowers/specs/2026-04-18-todo-app-design.md   # this file
```

## Database schema

Migrations live in `migrations/*.sql`, applied via `scripts/migrate.ts` against Turso.

```sql
-- 001_init.sql

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

-- Delta-sync tombstone log (covers deletes for `?since=` list calls)
CREATE TABLE deletions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  entity      TEXT NOT NULL CHECK (entity IN ('task', 'subtask', 'category')),
  entity_id   INTEGER NOT NULL,
  deleted_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_deletions_user_deleted_at ON deletions(user_id, deleted_at);
```

### Schema decisions

- **Timestamps = unix seconds INTEGER**, not ISO strings. Sortable, small, no TZ ambiguity.
- **`tasks.completed_at`** doubles as completion flag and auto-hide pivot. Visibility filter in the default list is roughly `completed_at IS NULL OR completed_at >= <midnight_today_in_user_tz>`.
- **`tasks.client_id`** / **`subtasks.client_id`** are UUIDs generated on the client before a mutation leaves the browser. Server uses `(user_id, client_id)` as an idempotency key so retried creates don't duplicate rows.
- **`category_id` ON DELETE SET NULL** on tasks — deleting a category shouldn't orphan tasks. Task UI renders "Uncategorised" with a muted dot.
- **`deletions`** log exists purely for delta sync — a client that hits `GET /api/tasks?since=<ts>` also needs to know what was deleted since `ts`. No soft-delete tombstones on the primary tables.
- **Subtasks are flat** (no `parent_subtask_id`). One level deep.
- **`users.tz`** stored per user — used server-side for "today" / "overdue" boundary calculations so midnight is consistent regardless of device clock drift.

## API endpoint design

All under `/api/*`, implemented as Nuxt server routes (Vercel Node functions).

### Authentication

Every data endpoint resolves `user_id` from **one of**:

1. **Cookie session** — `session` HttpOnly cookie + `X-CSRF-Token` header matching the `csrf` cookie on mutating methods.
2. **Bearer API key** — `Authorization: Bearer alola_tk_…`. Skips CSRF.

Key-management endpoints (`/api/keys/*`) and auth endpoints (`/api/auth/*`) are **cookie-only** — an API key cannot mint or revoke keys, or rotate the password. Limits blast radius of a leaked key.

### Error shape

```json
{ "error": { "code": "validation_failed", "message": "priority must be 1..3" } }
```

Codes: `auth_required`, `forbidden`, `not_found`, `validation_failed`, `client_id_conflict`, `rate_limited`, `internal`.

### Rate limits

Enforced per `user_id` (session or key):

- Mutating endpoints: 60 / minute.
- `POST /api/auth/login`: 5 / minute per IP (before `user_id` exists).

Implementation: simple in-memory token bucket per instance for v1 (Vercel serverless means instances are ephemeral — this is best-effort, not bulletproof; acceptable for a single-user app).

### Endpoints

#### Auth (cookie-only)

- `POST /api/auth/login` — body `{ email, password }` → `204` + `Set-Cookie: session`, `Set-Cookie: csrf`.
- `POST /api/auth/logout` — `204` + both cookies cleared; session row deleted.
- `GET /api/auth/me` — `{ id, email, tz }`.

#### Tasks (cookie or bearer)

- `GET /api/tasks?view=today|overdue|week|all&category_id=&since=<ts>` → `{ tasks: [...with subtasks inline...], deleted_ids: { task: [...], subtask: [...] } }`.
  - `since` makes the response a delta; omit for a full snapshot.
  - Subtasks returned inline on each task.
- `POST /api/tasks` — body `{ client_id, title, notes?, category_id?, priority?, due_at?, subtasks?: [{ client_id, title, position }] }` → `201 { task }`, where `task.subtasks` is populated with the server-assigned ids of any subtasks created in the same request (preserving each `client_id` so the client can reconcile). Idempotent on `(user_id, client_id)`: repeated call with the same `client_id` returns the existing task with `200`, not a duplicate.
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id` — partial update.
- `DELETE /api/tasks/:id` — hard delete; cascades subtasks; inserts `deletions` rows.
- `POST /api/tasks/:id/complete` — sets `completed_at = now()`. Idempotent: re-completing is a no-op.
- `POST /api/tasks/:id/uncomplete` — clears `completed_at`.

#### Subtasks

- `POST /api/tasks/:taskId/subtasks` — `{ client_id, title, position? }` → `201 { subtask }`. Idempotent on `(task_id, client_id)`.
- `PATCH /api/subtasks/:id` — `{ title?, position?, completed_at? }` → `{ subtask }`.
- `DELETE /api/subtasks/:id` — `204`; inserts a `deletions` row.
- `POST /api/subtasks/:id/toggle` — flips `completed_at` → `{ subtask }`.

#### Categories

- `GET /api/categories` — full list. No `?since=` param; the list is small and is refetched in full on each app boot.
- `POST /api/categories` — `{ name, color, position? }` → `201 { category }`.
- `PATCH /api/categories/:id` — `{ name?, color?, position? }` → `{ category }`.
- `DELETE /api/categories/:id` — child tasks have `category_id` set to `NULL`; the tasks' `updated_at` is bumped so the next delta sync reflects the change. `204`.

#### API keys (cookie-only)

- `GET /api/keys` — `[{ id, name, key_prefix, created_at, last_used_at }]`. Never returns plaintext.
- `POST /api/keys` — `{ name }` → `{ id, name, key_prefix, key }`. Plaintext `key` returned **once**.
- `DELETE /api/keys/:id` — sets `revoked_at = now()`.

### API decisions

- **Subtasks inline** on task reads. Saves a round trip. For < 500 tasks the payload is still small.
- **Dedicated `/complete` and `/uncomplete` verbs** rather than `PATCH { completed_at }`. Keeps the offline queue's replay logic trivial.
- **No batch `/api/sync`** endpoint in v1. Flush per-op. Add a batch endpoint later if latency on flaky connections becomes visible.
- **Delta sync** via `?since=` on tasks only. Categories are refetched in full on each boot (small list, simpler). `deletions` table makes task deletes correct.
- **API key auth locked out of `/api/keys/*` and `/api/auth/*`** — a leaked key can't mint keys, revoke keys, or rotate the password.

## Frontend state & offline sync

### Data layer

- `useSession()` — `{ user, login, logout, loading, isAuthenticated }`. Hits `/api/auth/me` on boot.
- `useCategories()` — list + CRUD helpers. Cached in memory + IndexedDB snapshot.
- `useTasks(filter)` — reactive list for a filter (view / category). Internally uses an in-memory map keyed by `id` and projects it per filter.
- `useSyncQueue()` — manages the IndexedDB queue, online/offline detection, flushing, retry/backoff, status surface.
- `useCsrf()` — reads the `csrf` cookie once, injects `X-CSRF-Token` on all `$fetch` calls via an interceptor.

### Optimistic mutation pattern

Every mutation follows the same shape:

1. Generate `client_id` (uuid v4) if creating.
2. Apply optimistic update to in-memory store (new task appears instantly).
3. Write queue entry to IndexedDB: `{ id, method, url, body, client_id, retries: 0, created_at }`.
4. If online, flush immediately: fire the request. On success, reconcile server row into the store (server id replaces optimistic id). On failure, leave in queue, retry with backoff.
5. If offline, leave in queue. Optimistic state stays.

On page load:
- Read cached `tasks` from IndexedDB → render immediately.
- Kick off `GET /api/tasks?since=<last_sync_ts>` in parallel → reconcile delta + `deleted_ids` into the store.
- Also kick off queue flush (any pending mutations from last session).

### IndexedDB schema

```
Database: alola_todos
Stores:
  - tasks            (keyPath: id)          — full snapshot
  - subtasks         (keyPath: id)
  - categories       (keyPath: id)
  - meta             (keyPath: key)         — last_sync_ts, user_id, csrf_echo
  - pending_mutations (keyPath: id, autoIncrement)
```

### Sync indicator states

- **Green** — queue empty, last sync < 60s ago.
- **Amber** — queue non-empty, trying to flush or waiting for online.
- **Red** — a mutation has exhausted its 5 retries; surfaced with a tap-to-retry prompt.

### PWA shortcut parameters

The web manifest declares shortcut URLs that open specific UI states. These are interpreted on mount by `app/pages/todos/index.vue`:

- `?new=1` — opens `QuickAddSheet.vue` immediately (rich-capture mode).
- `?view=overdue` — sets the initial filter to Overdue.
- `?view=today` (or no param) — default.

After reading, the URL params are stripped client-side with `history.replaceState` so a reload doesn't re-trigger the action.

## PWA — manifest & service worker

### Manifest

Served by `server/api/todos/manifest.webmanifest.get.ts` so headers and any dynamic fields are easy to control. Linked only from `app/layouts/app.vue`, not from the public marketing layout.

```json
{
  "name": "alola todos",
  "short_name": "todos",
  "scope": "/todos/",
  "start_url": "/todos/?utm_source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#141210",
  "background_color": "#141210",
  "icons": [
    { "src": "/todos/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/todos/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/todos/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "New task",   "url": "/todos/?new=1" },
    { "name": "Today",      "url": "/todos/" },
    { "name": "Overdue",    "url": "/todos/?view=overdue" }
  ]
}
```

Icons: reuse the alola glyph with a subtle checklist overlay for the todos variant. Generate a maskable 512×512 with safe-area padding so Android rounds it nicely.

### Service worker

`@vite-pwa/nuxt` in `injectManifest` mode. `public/service-worker.ts` contains the custom logic; Workbox's build step injects the precache manifest.

Strategies:

| Request | Strategy |
|---------|----------|
| App shell (JS / CSS / fonts / `/todos/*` HTML on first visit) | Precache (cache-first) |
| Navigation to `/todos/*` | Network-first, fallback to cached shell |
| `GET /api/tasks`, `GET /api/categories` | Stale-while-revalidate |
| Other `GET /api/*` | Network-first with 3s timeout |
| `POST` / `PATCH` / `DELETE` | **Pass through.** The SW does not intercept mutations; the main-thread queue owns them. |

### Install prompts

- **Android/Chrome**: intercept `beforeinstallprompt`, defer. After the user has completed ≥ 3 tasks in a session, show a dismissible `<InstallHint>` banner with the deferred prompt. One-time; dismissal persists.
- **iOS Safari**: no install event exists. Detect iOS Safari by UA; show a one-time share-icon "Add to Home Screen" hint. Dismissible, remembered in localStorage.

### Explicit non-goals (SW)

- No Background Sync API — mutations do not flush when the tab is closed. Documented behaviour: they flush on next visit.
- No periodic background sync, no push.

## Auth flow

### Seeding (one-time)

`scripts/seed-user.ts`:
- Reads `SEED_USER_EMAIL` + `SEED_USER_PASSWORD` from env.
- Hashes the password with bcrypt (cost 12).
- Inserts into `users`. Fails loudly if `users` already has a row.
- `--reset` flag updates the existing user's hash (personal password-reset path).
- Also seeds default categories (Scouts / KMRT / Work / Personal with preset colours).

No public `/setup` route. A "first-hit-wins" setup page is a hijack risk.

### Login

1. Any unauthenticated request to `/todos/*` → redirect to `/todos/login?next=<path>`.
2. Login form posts `{ email, password }` to `/api/auth/login`.
3. Server rate-limits (5/min/IP), `bcrypt.compare`, generates 32-byte random id → base64url, inserts `sessions` row with `expires_at = now + 30d`.
4. Two cookies set on response:
   - `session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
   - `csrf=<32b>; Secure; SameSite=Lax; Path=/` (not HttpOnly — JS reads this to echo back)
5. Client redirects to `?next=` (same-origin only) or `/todos`.

### Session middleware

Runs on every `/api/*` request:
- Read `session` cookie → `SELECT sessions WHERE id=? AND expires_at > now()`.
- If missing / expired → respond `401 { code: 'auth_required' }` (unless the request is bearer-authed).
- Touch `last_used_at`.
- If `expires_at - now < 7d`, slide `expires_at` forward by 30d. Active users never re-auth.
- Attach `{ user_id, session_id }` to request context.

### CSRF

- Enforced only when request is cookie-authed.
- Client reads `csrf` cookie on boot; a `$fetch` interceptor adds `X-CSRF-Token: <value>` to every mutating request.
- Server compares header to cookie; mismatch → `403 { code: 'forbidden' }`.
- Bearer-authed requests skip the check entirely.

### API keys

- UI at `/todos/settings/keys` (cookie-auth only).
- Creating: `POST /api/keys { name }` → server generates 32 random bytes, formats as `alola_tk_<base64url>` (e.g. `alola_tk_a1b2c3d4…`), stores `bcrypt(key)` in `key_hash` and the first 16 chars (`alola_tk_a1b2c3d4`) in `key_prefix`. Returns plaintext **once**. UI shows a copy box with a "won't be shown again" warning.
- On auth: extract prefix from bearer token → `SELECT api_keys WHERE key_prefix = ? AND revoked_at IS NULL` → `bcrypt.compare` each candidate (fine at < 10 keys) → on match, touch `last_used_at`, resolve `user_id`.
- Revoke: `DELETE /api/keys/:id` sets `revoked_at = now()`.

### Logout

`POST /api/auth/logout` → delete the session row, clear both cookies.

### Session cleanup

Expired sessions purged opportunistically on login attempts. Optional Vercel Cron daily job as belt-and-braces (deferred; not required for correctness).

## Security

### Headers (Nuxt `routeRules` on `/todos/**` + `/api/**`)

- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: `default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self';`

### Input validation

All endpoints use a validation helper (zod-style) at the top of each handler. No raw-string SQL; every query uses `@libsql/client` parameterised binds.

### Rate limiting

Per-user token bucket for mutations; per-IP bucket for login attempts. Documented as best-effort given Vercel's ephemeral instances.

### Secrets

- `DATABASE_URL` + `DATABASE_AUTH_TOKEN` — Turso, in Vercel env.
- `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` — local-only, used once.
- No other secrets needed in v1 (no push VAPID, no SMTP).

## Design tokens & visual direction

Reuses alola.org's existing tokens from `tailwind.config.js`:

- `surface` / `surface-raised` / `surface-subtle` backgrounds
- `ink` / `ink-muted` / `ink-faint` text
- `accent` / `accent-light` / `accent-dim` (orange) for interactive elements, priority-high, selection, sync-dot-synced

Differences from the public site (the "app chrome" variant):

- **Body font**: Inter (system-ui fallback), not Lora. Serif body doesn't scan well in dense lists.
- **Display font**: Syne, as on the public site. Used for the page title, detail-view task title, category labels.
- **Grain**: ~40% of the public site's grain opacity. Still present, doesn't fight a scanning UI.
- **Container**: wider than `max-w-2xl` on desktop (three-pane fills available width up to a max).
- **Public site header/footer**: omitted on `/todos/*` (app layout, not default layout).

### Category colour palette (seed defaults)

| Category  | Hex       | Note                               |
|-----------|-----------|------------------------------------|
| Scouts    | `#4a7c59` | Outdoor-green                      |
| KMRT      | `#3b82f6` | Search-and-rescue blue             |
| Work      | `#8b5cf6` | Neutral-to-alola purple            |
| Personal  | `#e879c8` | Warm rose, pops against the palette|

All editable from `/todos/settings/categories`.

### Priority treatment

- **High** — accent-orange pill (`rgba(217,119,6,0.2)` bg, `#f59e0b` text), accent-orange checkbox ring, semi-bold title.
- **Medium** — grey pill (`rgba(156,149,133,0.15)` / `#9c9585`).
- **Low** — ghost pill, muted.

### Task row anatomy (mobile)

`[ checkbox ] [ title \n category-dot · category · due · subtasks ] [ priority pill ]`

### Overdue treatment

- Own section at the top of the Today view.
- Section label in rust-red (`#c7513a`).
- Per-row: due-date text rust-red + bold.

### Completed-today

- Strike-through title, `ink-faint` colour.
- Stays in the list under a "Completed today" section until local midnight, then filtered out of default queries.

### Mockup references

Visual mockups produced during the brainstorming session and saved to `.superpowers/brainstorm/` (gitignored — not committed with this spec):

- `mobile-home.html` — mobile default "Today" view and grouped "All" view.
- `mobile-detail.html` — task detail, quick-add expanded sheet, swipe gestures.
- `desktop.html` — three-pane laptop layout.

## Deployment

### Infra switchover

1. Add Vercel project, point to the repo.
2. Set env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`.
3. Change `nuxt.config.ts` → `nitro.preset: 'vercel'`.
4. First deploy: run `scripts/migrate.ts` (applies `001_init.sql`), then `scripts/seed-user.ts` (creates the user + seeds default categories).
5. DNS cutover from Cloudflare Pages to Vercel.
6. Decommission Cloudflare Pages project once DNS has propagated and the site is verified working.

### Migration strategy

`scripts/migrate.ts` reads all files in `migrations/*.sql` in name order and applies any not in a `schema_migrations` tracking table. Safe to re-run.

## Testing

No test framework configured on the repo (per CLAUDE.md). Manual verification plan:

- Local: run `npm run dev`, log in, create/complete/delete a task, go offline in DevTools, make changes, come back online, verify sync.
- On a real phone (both iOS and Android): install to home screen, verify offline behaviour, verify quick-add + swipe gestures, verify install prompt UX.
- API key: create one, hit `/api/tasks` with `Authorization: Bearer …` from `curl`, verify CRUD.
- CSRF: attempt a cross-site `POST` with the session cookie — should 403.

Unit / integration tests are deferred. If they're added later, the natural boundaries are the server utilities (`server/utils/auth.ts`, `server/utils/csrf.ts`, date helpers) and the `useSyncQueue` composable — those have tight inputs and outputs.

## Explicitly deferred / future work

- Recurring tasks (may never ship).
- Push notifications (requires VAPID, push subscription, cron).
- Natural-language quick-add parser.
- Background Sync API (SW-owned mutation queue).
- Self-service password reset flow.
- Multi-user / sharing.
- Batch `POST /api/sync` endpoint for flaky-network optimisation.
- Full command palette on desktop.
- Stats / streaks / completion heatmap (schema already retains completed rows for this).

## Open questions

None.
