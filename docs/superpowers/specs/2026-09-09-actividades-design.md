# Actividades — Scheduled Activity Posts Design

## Purpose

Let the club's admin publish one-off, dated activities (título, descripción,
ubicación, fecha y hora, enlace opcional) through the existing password-gated
admin panel, and show them on the public homepage under a "Próximas
actividades" section that automatically drops an activity once its date has
passed. This is distinct from the two things already on the site:

- `lib/activities.ts` — three static "what we do" category cards (Carrera,
  Escalada, Bici), no dates, unaffected by this feature.
- `lib/schedule.ts` — a static recurring weekly schedule (day of week +
  time + place), unaffected by this feature.

Encuestas (member surveys) and this feature are unrelated — they only share
the same admin panel and login.

## Success Criteria

- An admin can create an activity (title, description, location, date +
  time, optional link) through `/admin/activities`, without touching code.
- The admin can see, edit, and delete any activity — past or future — from
  the admin panel.
- The public homepage shows only activities whose date/time is still in the
  future, soonest first, and an activity disappears on its own once its
  time passes — no manual cleanup.
- Activities are durably stored in the same SQLite database as everything
  else.

## Architecture

Extends the existing single Next.js app — no new services, same pattern as
encuestas (password-gated admin CRUD + a public read path), reusing the
existing `lib/admin-auth.ts` session/middleware wiring as-is (`/admin/*` and
`/api/admin/*` are already covered by `middleware.ts`'s matcher, so no
middleware changes are needed).

```
Admin ──POST/PATCH/DELETE /api/admin/activities[/:id]──▶ lib/events.ts ──▶ SQLite
Home  ──GET /──────────────────────────────────────────▶ listUpcomingEvents(getDb()) ──▶ SQLite
```

The homepage (`app/page.tsx`) is marked `export const dynamic =
'force-dynamic'` so the upcoming-activities section is recomputed on every
request — this is a deliberate choice, not an oversight: the encuestas
feature shipped a Critical bug where a Server Component with no Dynamic API
use got silently prerendered once at build time and never updated in
production. The homepage currently has no Dynamic API use either, so
without this, "auto-hide past activities" would only re-evaluate at the
next `next build`. CloudFront already runs a `CachingDisabled` policy (see
README), so this costs no caching benefit that wasn't already unused.

There is deliberately **no public API route** for reading activities — the
homepage reads via `listUpcomingEvents` directly, the same way
`/encuestas/[slug]/page.tsx` reads surveys directly. (Encuestas' final
review flagged its symmetrical public GET route as dead code, since nothing
ever called it — not repeating that here.)

## Data Model

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  event_at TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`event_at` is a single ISO-8601 datetime string (e.g.
`2026-09-20T09:00`), combining the admin form's separate date and time
inputs at submit time. `listUpcomingEvents` filters and sorts this
comparison in **application code** (`new Date(event_at) >= new Date()`),
not in SQL — SQLite's `datetime('now')` produces a space-separated format
(`YYYY-MM-DD HH:MM:SS`) that does not lexicographically compare correctly
against the stored `T`-separated value, and at this data volume (a club's
activity list) there's no need for SQL-level filtering. This matches the
precedent already set by `tallyResponses` in the encuestas feature, which
aggregates in JS rather than SQL for the same reason.

## Components

- `lib/events.ts` — `validateEventInput`, `createEvent`, `getEventById`,
  `listEvents` (all, newest-first, for the admin list), `listUpcomingEvents`
  (future-only, soonest-first, for the homepage), `updateEvent`,
  `deleteEvent`. Framework-agnostic pure functions over a
  `better-sqlite3` `Database`, matching `lib/surveys.ts`'s style.
- `components/ActivityBuilderForm.tsx` — one client component reused for
  both create (`activity` prop absent, `POST`) and edit (`activity` prop
  present, `PATCH`), mirroring `SurveyBuilderForm.tsx`. Fields: title,
  description, location, a `date` input + a `time` input (combined into
  `event_at` at submit), and an optional link.
- `/admin/activities` — list page (all activities, past and future, newest
  event first, each linking to its edit page).
- `/admin/activities/new` — wraps `ActivityBuilderForm` with no `activity`.
- `/admin/activities/[id]` — wraps `ActivityBuilderForm` with the loaded
  `activity`, plus a delete button.
- `app/api/admin/activities/route.ts` — `GET` (list), `POST` (create).
- `app/api/admin/activities/[id]/route.ts` — `GET`, `PATCH`, `DELETE`.
- `app/page.tsx` — gains `export const dynamic = 'force-dynamic'` and a new
  "Próximas actividades" section rendered from `listUpcomingEvents`.

Every admin page checks `hasValidSession`/`isValidSessionCookie` itself
(via `cookies()`) before reading data, in addition to `middleware.ts` — the
same defense-in-depth the encuestas final review added, applied here from
the start rather than as a follow-up fix.

## Error Handling

- `validateEventInput`: `title`, `description`, `location` required
  non-blank; `event_at` required and must parse as a valid date (reject
  otherwise) — field-level `400`s, matching `validateSurveyInput`'s style.
  `link` is optional with no format validation (YAGNI — a bad link just
  renders as a bad link, non-destructive).
- Admin API routes: missing/invalid session → `401`, before any DB access
  (checked first in every handler, same as encuestas' admin routes).
- Unknown `id` → `404` for `GET`/`PATCH`; `DELETE` is unconditionally
  successful regardless of whether the id existed (matches
  `deleteSurvey`'s contract).
- Malformed/non-object JSON body → `400`, never a `500` (same
  `.catch(() => null)` + type-guard pattern used throughout the codebase).

## Out of Scope (v1, YAGNI)

- No image/photo on an activity.
- No link between an activity and a survey (confirmed: unrelated features).
- No recurring activities — each is a single dated occurrence.
- No capacity limits, RSVP counts, or attendance tracking.
- No notifications (email/push) when an activity is published.

## Testing

- `lib/events.test.ts` — validation, CRUD, `listUpcomingEvents` correctly
  excludes past events and orders soonest-first, against a real `:memory:`
  DB (matching `lib/surveys.test.ts`'s pattern).
- `route.test.ts` per admin API endpoint — happy path + validation/auth
  failures, mirroring the encuestas admin routes' tests.
- Component test for `ActivityBuilderForm` (create + edit modes), mirroring
  `SurveyBuilderForm.test.tsx`.
- Per the established project convention, the Server Component pages
  (`/admin/activities`, `/admin/activities/[id]`, and the updated
  `app/page.tsx`) get no dedicated automated test — but the implementation
  plan must include an explicit `npm run build` check confirming `/` is
  marked `ƒ (Dynamic)` in the route table, not `○ (Static)`, since that
  exact gap (build-output verification) is what let encuestas' Critical
  static-prerendering bug reach a "final review" instead of being caught
  immediately.
