# Todo App — Plan 4 of 4: API Keys + External Integrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the todos API to authenticated external consumers (an AI chat assistant; later, an e-ink display) via bearer tokens. Add a settings page where the user can mint, list, and revoke API keys, and ship lightweight docs for the two consumer types.

**Architecture:** Bearer auth path in `server/utils/auth.ts` (currently stubbed from Plan 1) is unstubbed. Keys are `alola_tk_<43 base64url chars>`; only `bcrypt(key)` + a 16-char prefix are stored. The prefix is the lookup index — a request's bearer token is parsed, prefix extracted, and `bcrypt.compare` runs against all non-revoked rows with that prefix (expected 1, tolerant of more). Cookie-only endpoints (`/api/keys/*`, `/api/auth/*`) gain an explicit guard so a leaked key cannot mint new keys or check session identity.

**Tech Stack:** Nuxt 4 server routes, `bcryptjs`, `@libsql/client` against the existing `api_keys` table (shipped in Plan 1 migration).

**Spec:** `docs/superpowers/specs/2026-04-18-todo-app-design.md`

**Predecessors:**
- Plan 1 (`2026-04-18-todo-backend-skeleton.md`) — shipped. `api_keys` table exists; bearer path in `server/utils/auth.ts` is a documented stub returning `null`.
- Plan 2 (`2026-04-18-todo-core-ux.md`) — shipped. Task/category/subtask endpoints already use `requireAuth()`, which accepts both cookie and bearer auth once the stub is lifted.
- Plan 3 (`2026-04-18-todo-offline-pwa.md`) — shipped. Unrelated to this plan but note that PWA + offline only apply to the cookie-authed browser app; external consumers talk to the API directly, bypassing the SW.

**No test framework.** Manual verification via curl + the live UI (Task 11).

---

## File Structure

**Create:**
- `server/utils/apiKeys.ts` — generate, hash, compare, extract-prefix helpers
- `server/utils/requireCookieAuth.ts` — guard helper that asserts `authMethod === 'cookie'`
- `server/api/keys/index.get.ts` — list keys (metadata only)
- `server/api/keys/index.post.ts` — create a new key (returns plaintext once)
- `server/api/keys/[id].delete.ts` — revoke (soft-delete via `revoked_at`)
- `app/pages/todos/settings/keys.vue` — manage keys from the UI
- `docs/todos-api.md` — external-consumer API documentation

**Modify:**
- `server/utils/auth.ts` — unstub the bearer path in `resolveAuth`
- `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/api/auth/me.get.ts` — add `requireCookieAuth` so bearer tokens can't poke at `/api/auth/*`
- `app/pages/todos/settings/index.vue` — link to the new keys page

**Not modified (intentional):** The tasks / categories / subtasks endpoints. They already use `requireAuth()` which accepts bearer auth once the stub is lifted. That's exactly what we want for external consumers.

---

## Prerequisites (one-time, before Task 1)

- [ ] **Create a fresh worktree**

```bash
cd /home/graemel/workspace/alola
git worktree add ~/.config/superpowers/worktrees/alola/todos-api-keys -b feat/todos-api-keys
cd ~/.config/superpowers/worktrees/alola/todos-api-keys
npm install
```

- [ ] **Copy the dev `.env` (same values used in Plans 1-3)**

```bash
cp .env.example .env
# paste dev DATABASE_URL, dev DATABASE_AUTH_TOKEN, and SEED_USER_PASSWORD
```

- [ ] **Verify baseline** — `npm run dev`, log in at `/todos/login`, see Plan 3's full UX. Ctrl+C once confirmed.

---

### Task 1: API key helpers

**Files:**
- Create: `server/utils/apiKeys.ts`

Small, focused module so the crypto/format concerns live in one place.

- [ ] **Step 1: Write `server/utils/apiKeys.ts`**

```ts
// server/utils/apiKeys.ts — generate, hash, compare, extract-prefix helpers for API keys.
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { BEARER_PREFIX } from './constants'

/**
 * Key layout:
 *   alola_tk_<43 base64url chars from 32 random bytes>
 * Example: alola_tk_9fQrq3Nf4J5Wz_Abc123Def456Ghi789Jkl012MnoPqr
 *
 * `key_prefix` stored in the DB is the FIRST 16 chars:
 *   "alola_tk_" (9)  +  7 random chars
 * That's enough to make DB lookup O(1) while leaving 36 random chars for the
 * secret portion compared via bcrypt.
 */
const PREFIX_LEN = 16

export function generateKey(): { plaintext: string; prefix: string; hash: string } {
  const body = randomBytes(32).toString('base64url')
  const plaintext = `${BEARER_PREFIX}${body}`
  const prefix = plaintext.slice(0, PREFIX_LEN)
  const hash = bcrypt.hashSync(plaintext, 12)
  return { plaintext, prefix, hash }
}

/** Extract the lookup prefix from a caller's bearer token. Returns null if malformed. */
export function extractPrefix(token: string): string | null {
  if (!token.startsWith(BEARER_PREFIX)) return null
  if (token.length <= PREFIX_LEN) return null  // not enough body
  return token.slice(0, PREFIX_LEN)
}

/** Constant-time-ish compare (bcrypt internally). */
export async function verifyKey(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/apiKeys.ts
git commit -m "feat(todos): api key helpers (generate, extract prefix, verify)"
```

---

### Task 2: `requireCookieAuth` guard

**Files:**
- Create: `server/utils/requireCookieAuth.ts`

Explicit guard that rejects bearer-authed requests. Used by `/api/keys/*` and `/api/auth/*`.

- [ ] **Step 1: Write `server/utils/requireCookieAuth.ts`**

```ts
// server/utils/requireCookieAuth.ts — rejects bearer tokens on endpoints that
// should only be reachable from the authenticated web UI (key management, auth).
import type { H3Event } from 'h3'
import { requireAuth, type AuthContext } from './auth'
import { throwApiError } from './errors'

export function requireCookieAuth(event: H3Event): AuthContext {
  const ctx = requireAuth(event)
  if (ctx.authMethod !== 'cookie') {
    throwApiError('forbidden', 'This endpoint requires cookie authentication')
  }
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/requireCookieAuth.ts
git commit -m "feat(todos): requireCookieAuth guard for key + auth endpoints"
```

---

### Task 3: Unstub the bearer auth path in `server/utils/auth.ts`

**Files:**
- Modify: `server/utils/auth.ts`

The Plan-1 stub returned `null` for any bearer token with the right prefix. Replace with the real lookup + bcrypt compare + `last_used_at` touch.

- [ ] **Step 1: Read the current `resolveAuth` function**

```bash
grep -n "Bearer API key" server/utils/auth.ts
```

Expect a comment like `// 2. Bearer API key — STUB. Plan 4 implements the full path.` followed by the stub block.

- [ ] **Step 2: Replace the bearer block**

Open `server/utils/auth.ts`. Find this block (the last section of `resolveAuth` before `return null`):

```ts
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

Replace it with:

```ts
  // 2. Bearer API key.
  const authz = getHeader(event, 'authorization')
  if (authz && authz.startsWith('Bearer ')) {
    const token = authz.slice(7).trim()
    const prefix = extractPrefix(token)
    if (prefix) {
      const { rows } = await db().execute({
        sql: `SELECT id, user_id, key_hash FROM api_keys
              WHERE key_prefix = ? AND revoked_at IS NULL`,
        args: [prefix],
      })
      for (const r of rows) {
        const match = await verifyKey(token, r.key_hash as string)
        if (match) {
          // Touch last_used_at (best-effort; don't block on failure).
          void db().execute({
            sql: 'UPDATE api_keys SET last_used_at = ? WHERE id = ?',
            args: [Math.floor(Date.now() / 1000), Number(r.id)],
          })
          return {
            userId: Number(r.user_id),
            authMethod: 'bearer',
          }
        }
      }
    }
  }

  return null
}
```

At the top of `server/utils/auth.ts`, add the two new imports alongside the existing ones:

```ts
import { extractPrefix, verifyKey } from './apiKeys'
```

- [ ] **Step 3: Verify**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-api-keys
npx nuxi prepare
```

Expected: `Types generated in .nuxt.`

- [ ] **Step 4: Commit**

```bash
git add server/utils/auth.ts
git commit -m "feat(todos): unstub bearer API key auth path"
```

---

### Task 4: Lock auth endpoints to cookie-only

**Files:**
- Modify: `server/api/auth/me.get.ts`
- Modify: `server/api/auth/logout.post.ts`

The `/api/auth/login` endpoint doesn't use `requireAuth` (it's the entry point), so it needs no change. But `me.get.ts` and `logout.post.ts` both currently call `requireAuth()` which would accept a bearer token — meaning a leaked key could identify the user or end arbitrary sessions. Fix.

- [ ] **Step 1: Update `server/api/auth/me.get.ts`**

Current top imports and first line of the handler:

```ts
import { requireAuth, endSession } from '../../utils/auth'
// ...
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
```

Change the import to add `requireCookieAuth`, and swap the call:

```ts
import { requireAuth, endSession } from '../../utils/auth'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
// ...
export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
```

Remove the now-unused `requireAuth` import (keep `endSession`):

```ts
import { endSession } from '../../utils/auth'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
```

- [ ] **Step 2: Update `server/api/auth/logout.post.ts`**

Find the line that reads `event.context.auth?.authMethod === 'cookie'`. Logout on a cookieless request is currently a no-op (clears nothing). A bearer-authed request would `end Session` on `getCookie(…session…)` which returns `undefined` — harmless but should still 403. Replace the handler body with the cookie-only guard explicitly:

```ts
import { defineEventHandler, setResponseStatus } from 'h3'
import { endSession } from '../../utils/auth'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'

export default defineEventHandler(async (event) => {
  // Cookie-only. A bearer key must not be able to revoke sessions.
  requireCookieAuth(event)
  verifyCsrf(event)
  await endSession(event)
  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 3: Verify**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-api-keys
npx nuxi prepare
```

- [ ] **Step 4: Commit**

```bash
git add server/api/auth/me.get.ts server/api/auth/logout.post.ts
git commit -m "feat(todos): lock /api/auth/me and /logout to cookie-only"
```

---

### Task 5: `GET /api/keys` — list metadata

**Files:**
- Create: `server/api/keys/index.get.ts`

Returns only the public metadata — never the plaintext, never the hash.

- [ ] **Step 1: Write `server/api/keys/index.get.ts`**

```ts
// server/api/keys/index.get.ts
import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  const { rows } = await db().execute({
    sql: `SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
          FROM api_keys WHERE user_id = ?
          ORDER BY revoked_at IS NULL DESC, created_at DESC`,
    args: [userId],
  })
  return {
    keys: rows.map(r => ({
      id: Number(r.id),
      name: r.name as string,
      key_prefix: r.key_prefix as string,
      created_at: Number(r.created_at),
      last_used_at: r.last_used_at === null ? null : Number(r.last_used_at),
      revoked_at: r.revoked_at === null ? null : Number(r.revoked_at),
    })),
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/keys/index.get.ts
git commit -m "feat(todos): GET /api/keys"
```

---

### Task 6: `POST /api/keys` — create

**Files:**
- Create: `server/api/keys/index.post.ts`

Mints a key, stores only the hash + prefix, returns the plaintext **once**. UI must make that clear.

- [ ] **Step 1: Write `server/api/keys/index.post.ts`**

```ts
// server/api/keys/index.post.ts — mint an API key. Plaintext returned once; never retrievable again.
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { requireString } from '../../utils/validation'
import { generateKey } from '../../utils/apiKeys'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const body = await readBody(event)
  const name = requireString(body?.name, 'name', { min: 1, max: 80 })

  const { plaintext, prefix, hash } = generateKey()
  const { lastInsertRowid } = await db().execute({
    sql: 'INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)',
    args: [userId, name, hash, prefix],
  })

  setResponseStatus(event, 201)
  return {
    key: {
      id: Number(lastInsertRowid),
      name,
      key_prefix: prefix,
      created_at: Math.floor(Date.now() / 1000),
      last_used_at: null,
      revoked_at: null,
    },
    // The plaintext is returned ONCE. Client must copy it immediately.
    plaintext,
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/keys/index.post.ts
git commit -m "feat(todos): POST /api/keys (returns plaintext once)"
```

---

### Task 7: `DELETE /api/keys/:id` — revoke

**Files:**
- Create: `server/api/keys/[id].delete.ts`

Soft-delete via `revoked_at`. The lookup in `resolveAuth` filters on `revoked_at IS NULL`, so revoked keys stop authenticating immediately.

- [ ] **Step 1: Write `server/api/keys/[id].delete.ts`**

```ts
// server/api/keys/[id].delete.ts — soft-revoke an API key.
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { db } from '../../utils/db'
import { requireCookieAuth } from '../../utils/requireCookieAuth'
import { verifyCsrf } from '../../utils/csrf'
import { rateLimit } from '../../utils/rateLimit'
import { RATE_LIMITS } from '../../utils/constants'
import { throwApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const { userId } = requireCookieAuth(event)
  verifyCsrf(event)
  rateLimit(`writes:${userId}`, RATE_LIMITS.writes)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throwApiError('validation_failed', 'id must be a number')

  const now = Math.floor(Date.now() / 1000)
  const res = await db().execute({
    sql: `UPDATE api_keys SET revoked_at = ?
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    args: [now, id, userId],
  })
  if (res.rowsAffected === 0) throwApiError('not_found', 'key not found or already revoked')

  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/keys/[id].delete.ts
git commit -m "feat(todos): DELETE /api/keys/:id (soft-revoke)"
```

---

### Task 8: Settings page — API keys

**Files:**
- Create: `app/pages/todos/settings/keys.vue`

Lists keys, offers a "New key" form, shows the plaintext once after creation with a copy button + warning, and a revoke button per row.

- [ ] **Step 1: Write `app/pages/todos/settings/keys.vue`**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta } from '#imports'
import { apiFetch } from '~/utils/apiFetch'

definePageMeta({ layout: 'app', middleware: ['auth'] })
useHead({ title: 'API keys' })

interface Key {
  id: number
  name: string
  key_prefix: string
  created_at: number
  last_used_at: number | null
  revoked_at: number | null
}

const keys = ref<Key[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const newName = ref('')
const creating = ref(false)
const freshPlaintext = ref<string | null>(null)
const freshName = ref<string | null>(null)
const copied = ref(false)

function when(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch<{ keys: Key[] }>('/api/keys')
    keys.value = res.keys
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Failed to load keys'
  } finally {
    loading.value = false
  }
}

async function createKey() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  error.value = null
  try {
    const res = await apiFetch<{ key: Key; plaintext: string }>(
      '/api/keys',
      { method: 'POST', body: { name } },
    )
    keys.value = [res.key, ...keys.value]
    freshPlaintext.value = res.plaintext
    freshName.value = res.key.name
    newName.value = ''
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Failed to create key'
  } finally {
    creating.value = false
  }
}

async function copyFresh() {
  if (!freshPlaintext.value) return
  try {
    await navigator.clipboard.writeText(freshPlaintext.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // fallback: select the input for the user to ⌘-C
  }
}

function dismissFresh() {
  freshPlaintext.value = null
  freshName.value = null
  copied.value = false
}

async function revokeKey(k: Key) {
  if (!confirm(`Revoke "${k.name}"? Any integration using it will stop working immediately.`)) return
  try {
    await apiFetch(`/api/keys/${k.id}`, { method: 'DELETE' })
    keys.value = keys.value.map(x => x.id === k.id ? { ...x, revoked_at: Math.floor(Date.now() / 1000) } : x)
  } catch (e: any) {
    error.value = e?.data?.error?.message ?? 'Revoke failed'
  }
}

const active = computed(() => keys.value.filter(k => k.revoked_at === null))
const revoked = computed(() => keys.value.filter(k => k.revoked_at !== null))

onMounted(refresh)
</script>

<template>
  <div class="space-y-6 py-4 max-w-2xl">
    <header>
      <NuxtLink to="/todos/settings" class="text-xs uppercase tracking-wider text-ink-muted">← Settings</NuxtLink>
      <h1 class="font-display text-2xl font-bold tracking-tight mt-2">API keys</h1>
      <p class="text-sm text-ink-muted mt-1">
        Create bearer tokens for external services to call the todos API on your behalf. API keys can create/read/update tasks, subtasks, and categories — they cannot manage keys themselves or sign you out.
      </p>
    </header>

    <!-- Fresh key display (shown only once, right after creation) -->
    <div v-if="freshPlaintext" class="rounded-xl border border-accent/40 bg-accent/10 p-4 space-y-3">
      <div class="text-sm font-semibold text-ink">Your new key — "{{ freshName }}"</div>
      <div class="text-xs text-ink-muted">
        Copy this now. It won't be shown again. If you lose it, revoke it and create a new one.
      </div>
      <div class="flex items-stretch gap-2">
        <input
          :value="freshPlaintext"
          readonly
          class="flex-1 bg-surface-raised text-xs font-mono px-3 py-2 rounded border border-ink-faint/20 outline-none"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button type="button" class="bg-accent text-surface font-semibold px-3 py-2 rounded text-sm min-w-[72px]" @click="copyFresh">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <button type="button" class="text-xs text-ink-muted underline" @click="dismissFresh">
        I've saved it — hide
      </button>
    </div>

    <!-- New key form -->
    <form class="flex items-center gap-2 rounded-xl border border-ink-faint/15 bg-surface-raised px-3 py-2" @submit.prevent="createKey">
      <input
        v-model="newName"
        placeholder="Name (e.g. AI assistant, e-ink display)"
        class="flex-1 bg-transparent outline-none py-2 text-sm"
        :disabled="creating"
      />
      <button
        type="submit"
        class="bg-accent text-surface px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-60"
        :disabled="creating || !newName.trim()"
      >
        {{ creating ? 'Creating…' : 'New key' }}
      </button>
    </form>

    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

    <!-- Active keys -->
    <section v-if="active.length > 0">
      <h2 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Active</h2>
      <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden">
        <li v-for="k in active" :key="k.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink">{{ k.name }}</div>
            <div class="text-xs text-ink-muted font-mono mt-0.5">{{ k.key_prefix }}…</div>
            <div class="text-xs text-ink-faint mt-0.5">
              Created {{ when(k.created_at) }} · Last used {{ when(k.last_used_at) }}
            </div>
          </div>
          <button type="button" class="text-xs text-ink-faint hover:text-[#c7513a]" @click="revokeKey(k)">Revoke</button>
        </li>
      </ul>
    </section>

    <p v-else-if="!loading" class="text-sm text-ink-muted">No active keys. Create one above to get started.</p>

    <!-- Revoked keys (for audit) -->
    <section v-if="revoked.length > 0" class="pt-4 border-t border-ink-faint/10">
      <h2 class="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">Revoked</h2>
      <ul class="flex flex-col divide-y divide-ink-faint/10 border border-ink-faint/10 rounded-xl overflow-hidden opacity-60">
        <li v-for="k in revoked" :key="k.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink line-through">{{ k.name }}</div>
            <div class="text-xs text-ink-muted font-mono mt-0.5">{{ k.key_prefix }}…</div>
            <div class="text-xs text-ink-faint mt-0.5">
              Revoked {{ when(k.revoked_at) }}
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/todos/settings/keys.vue
git commit -m "feat(todos): /todos/settings/keys — API keys CRUD UI"
```

---

### Task 9: Settings hub navigation

**Files:**
- Modify: `app/pages/todos/settings/index.vue`

Add the "API keys" link alongside the existing "Categories" and "Offline & sync" entries.

- [ ] **Step 1: Edit `app/pages/todos/settings/index.vue`**

Inside the `<nav>` block, after the existing "Offline & sync" NuxtLink, add:

```vue
      <NuxtLink to="/todos/settings/keys" class="flex items-center justify-between px-4 py-3 hover:bg-surface-raised">
        <span>API keys</span>
        <span class="text-ink-faint">›</span>
      </NuxtLink>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/todos/settings/index.vue
git commit -m "feat(todos): link API keys from settings hub"
```

---

### Task 10: External-consumer API docs

**Files:**
- Create: `docs/todos-api.md`

Lightweight docs so anyone (you, your AI assistant, your future e-ink display) can call the API without re-reading the source.

- [ ] **Step 1: Write `docs/todos-api.md`**

```markdown
# alola todos — External API

Two consumer types talk to this API: an AI chat assistant that creates and manages tasks on your behalf, and an e-ink display that periodically polls today's tasks. Both authenticate with a bearer token minted at `https://alola.org/todos/settings/keys`.

## Authentication

Every request must include:

```http
Authorization: Bearer alola_tk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are minted in the UI. The plaintext is shown **once** at creation time — copy it immediately; there is no recovery. Revoke a compromised key from the same settings page.

Bearer auth cannot:
- Mint or revoke other keys (`/api/keys/*` is cookie-only).
- Read user profile or manage sessions (`/api/auth/*` is cookie-only).

Bearer auth can read and mutate:
- `/api/tasks`, `/api/tasks/:id`, `/api/tasks/:id/complete`, `/api/tasks/:id/uncomplete`
- `/api/tasks/:id/subtasks`, `/api/subtasks/:id`, `/api/subtasks/:id/toggle`
- `/api/categories`, `/api/categories/:id`

## Base URL

```
https://alola.org
```

## Conventions

- All request and response bodies are JSON. Set `Content-Type: application/json` on requests with a body.
- Timestamps are unix seconds (integer).
- Errors return a consistent shape:

  ```json
  { "error": { "code": "validation_failed", "message": "…" } }
  ```
  HTTP status is set appropriately (401 / 403 / 404 / 422 / 429 / 500).
- Rate limit: 60 mutating requests / minute per key.
- Creates (`POST /api/tasks`, `POST /api/tasks/:taskId/subtasks`) require a client-generated `client_id` for idempotency — repeated calls with the same `client_id` return the existing row instead of duplicating. Use UUID v4.

## Common flows

### Create a task

```http
POST /api/tasks
Authorization: Bearer alola_tk_…
Content-Type: application/json

{
  "client_id": "b6f9e3c2-1234-4abc-8def-abc123def456",
  "title": "Order minibus for hike",
  "category_id": 4,
  "priority": 3,
  "due_at": 1776672000,
  "notes": "Booking code 99XFG",
  "subtasks": [
    { "client_id": "0ab1c2d3-…", "title": "Check passenger count" },
    { "client_id": "1bc2d3e4-…", "title": "Pay deposit" }
  ]
}
```

Response `201`:

```json
{
  "task": {
    "id": 42,
    "category_id": 4,
    "title": "Order minibus for hike",
    "notes": "Booking code 99XFG",
    "priority": 3,
    "due_at": 1776672000,
    "completed_at": null,
    "position": 0,
    "client_id": "b6f9e3c2-1234-4abc-8def-abc123def456",
    "created_at": 1776530000,
    "updated_at": 1776530000,
    "subtasks": [
      { "id": 97, "task_id": 42, "title": "Check passenger count", "completed_at": null, "position": 0, "client_id": "0ab1c2d3-…", "created_at": 1776530000, "updated_at": 1776530000 },
      { "id": 98, "task_id": 42, "title": "Pay deposit", "completed_at": null, "position": 1, "client_id": "1bc2d3e4-…", "created_at": 1776530000, "updated_at": 1776530000 }
    ]
  }
}
```

### Read today's tasks (e-ink poller)

```http
GET /api/tasks?view=today
Authorization: Bearer alola_tk_…
```

Response: `{ "tasks": [...], "deleted_ids": {...}, "now": 1776530000 }`. Each task includes its subtasks inline.

Views: `today`, `overdue`, `week`, `all`. Filter further by `&category_id=<id>`.

### Mark a task complete

```http
POST /api/tasks/42/complete
Authorization: Bearer alola_tk_…
```

Response `200`: `{ "id": 42, "completed_at": 1776530500, "updated_at": 1776530500 }`. Idempotent.

### Delta sync

Pass `?since=<unix_seconds>` on `GET /api/tasks` to get only tasks with `updated_at >= since`, plus a `deleted_ids.task` and `deleted_ids.subtask` array for tombstones.

## Field reference

- **Task priority**: `1` = low, `2` = medium (default), `3` = high.
- **Due date**: unix seconds at the **start** of the day (midnight, user's timezone stored in `users.tz`). Setting a time-of-day is accepted but ignored when grouping.
- **Category**: optional integer `category_id` referencing the user's categories.
- **Subtasks**: flat checklist (no nesting). Created inline with a task or added later via `POST /api/tasks/:taskId/subtasks`.

## Revoking keys

From `/todos/settings/keys` → "Revoke". Takes effect on the next request.

If the UI is unreachable, the same effect can be achieved by setting `revoked_at` directly in the Turso `api_keys` table.
```

- [ ] **Step 2: Commit**

```bash
git add docs/todos-api.md
git commit -m "docs(todos): external API consumer docs"
```

---

### Task 11: Local smoke test (dev)

No new files — verifies that bearer auth works end-to-end and that the cookie-only endpoints still reject bearer.

- [ ] **Step 1: Start dev server**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-api-keys
npm run dev
```

- [ ] **Step 2: In a browser, mint a key**

1. `http://localhost:3000/todos/login` → sign in.
2. Settings → API keys → create one called "smoke test".
3. Copy the plaintext key (e.g. `alola_tk_XYZ…`).

- [ ] **Step 3: Use the key from curl (new terminal)**

Set the key as an env var:

```bash
export ALOLA_KEY="alola_tk_XYZ…"
```

Listing tasks — expect `200` with the current list:

```bash
curl -s http://localhost:3000/api/tasks -H "Authorization: Bearer $ALOLA_KEY" | head -20
```

Creating a task — expect `201`:

```bash
UUID=$(uuidgen)
curl -i -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $ALOLA_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$UUID\",\"title\":\"Bearer smoke test\",\"priority\":2}"
```

Completing it — expect `200`:

```bash
# Replace 123 with the id you just created
curl -i -X POST http://localhost:3000/api/tasks/123/complete \
  -H "Authorization: Bearer $ALOLA_KEY"
```

- [ ] **Step 4: Confirm cookie-only endpoints reject bearer**

```bash
# Expect 403 forbidden
curl -i http://localhost:3000/api/keys -H "Authorization: Bearer $ALOLA_KEY"
curl -i http://localhost:3000/api/auth/me -H "Authorization: Bearer $ALOLA_KEY"
```

Both must return `403` with `{"error":{"code":"forbidden",…}}`.

- [ ] **Step 5: Confirm revocation is immediate**

Revoke the smoke-test key from the UI. Then:

```bash
curl -i http://localhost:3000/api/tasks -H "Authorization: Bearer $ALOLA_KEY"
# Expect 401 auth_required
```

- [ ] **Step 6: Verify `last_used_at` gets populated**

```bash
# Create another key named "last-used test" via the UI
# Make one request with it, then refresh the keys page
```

The "Last used" column should update within a second or two.

If all five pass, the bearer path is working. Ctrl+C the dev server.

---

### Task 12: Merge + prod deploy

- [ ] **Step 1: Check branch is clean and ahead of master**

```bash
cd ~/.config/superpowers/worktrees/alola/todos-api-keys
git status                                    # clean
git log --oneline master..HEAD | wc -l        # ~10 commits
```

- [ ] **Step 2: Merge + push from the main checkout**

```bash
cd /home/graemel/workspace/alola
git checkout master
git pull --ff-only
git merge --no-ff feat/todos-api-keys -m "Merge plan 4: API keys + external integrations"
git push origin master
```

Vercel auto-deploys.

- [ ] **Step 3: Verify prod**

```bash
sleep 90
curl -sI https://alola.org/todos/settings/keys | head -5   # expect 200 / 302 to login
```

- [ ] **Step 4: Smoke test prod**

On `https://alola.org/todos/settings/keys`, mint a prod key. From a terminal, `export PROD_KEY=alola_tk_…` and repeat Task 11's curl checks against `https://alola.org`.

Once prod keys work, **revoke the smoke-test key** — keep only the keys you actually use.

- [ ] **Step 5: Cleanup**

```bash
cd /home/graemel/workspace/alola
git worktree remove ~/.config/superpowers/worktrees/alola/todos-api-keys
git branch -d feat/todos-api-keys
```

Plan 4 shipped. All four plans of the alola-todos app are live.

---

## Self-review notes (author)

- **Spec coverage:**
  - `/api/keys` GET / POST / DELETE (Tasks 5, 6, 7) — ✅
  - Bearer auth path (Task 3) — ✅
  - Cookie-only on `/api/keys/*` and `/api/auth/*` (Tasks 2, 4, 5, 6, 7) — ✅
  - Key format `alola_tk_<base64url>` with 16-char prefix (Task 1) — ✅
  - `bcrypt` stored hash, plaintext returned **once** (Task 6) — ✅
  - Revoke = soft via `revoked_at` (Task 7) — ✅
  - UI: settings page listing keys with prefix + name + timestamps, create modal, revoke confirm (Task 8) — ✅
  - External consumer docs (Task 10) — ✅
- **No placeholders.** Every step has real code or real commands.
- **Type consistency:** The `Key` interface in `keys.vue` matches the DTO shape returned by the three server endpoints. `AuthContext` in `auth.ts` unchanged (already has `authMethod`).
- **Known trade-offs:**
  - Only one master scope (full CRUD). The spec considered scoped keys (read-only vs read-write) as option β but the user picked α (one key does everything). If the AI assistant's blast radius ever becomes a concern, re-scoping lives in a future plan — add a `scope` column, check in the handlers.
  - `bcrypt.compare` is O(n) across candidate rows with the same prefix. At 42 random bits of prefix entropy and <100 keys, collisions are vanishingly unlikely — this is fine.
  - The `last_used_at` update is fire-and-forget (`void db().execute(…)`); if the DB write fails, we don't block the request. Acceptable for a best-effort timestamp.
