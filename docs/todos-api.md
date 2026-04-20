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
