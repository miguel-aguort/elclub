# Apuntarse a Actividades — Signups Design

## Purpose

Let a community member sign up (with just their email) to a specific
scheduled activity, and give the admin a shareable public URL per
activity for that. Only emails already present in `subscribers` (the
community) may sign up — this is not an open sign-up form, it's an
RSVP restricted to existing community members. The admin can see who
signed up for each activity from the admin panel.

This is a companion to, not a replacement for, the general community
signup form (`SignupForm`/`subscribers`) and the `encuestas` (survey)
system — it borrows their shape (a public page + form collecting an
email, uniqueness enforced, admin-visible results) but is its own
table and its own route, scoped to one activity at a time.

## Success Criteria

- A public page exists per activity (`/actividades/[id]`) showing the
  activity's title, date/time, location, description, and a one-field
  email form.
- Submitting an email already in `subscribers` records a signup and
  shows a confirmation. Submitting the same email again for the same
  activity is idempotent — treated as success, not an error.
- Submitting an email NOT in `subscribers` shows an error telling the
  visitor to join the community first, with a link back to the home
  page's signup section.
- The admin can see, from `/admin/activities/[id]`, the list of emails
  signed up for that activity (read-only — no admin action needed here
  beyond viewing).
- The header navigation gains an "Agenda" link that jumps to the
  existing `#proximas-actividades` section on the home page.
- Each activity's title in the home page's "Próximas actividades"
  section links to its `/actividades/[id]` page (this is also the URL
  the admin shares — the same page both informs and collects the
  signup, no separate "share link" needed).

## Architecture

Extends the existing single Next.js app, following the same shape as
`encuestas`: a public dynamic page + form reading/writing through a new
lib module, no separate public API needed beyond the one signup POST
route.

```
Admin panel ──reads──────────────────────▶ lib/event-signups.ts ──▶ SQLite
Visitor ──GET /actividades/:id───────────▶ getEventById + (signups not
                                             needed for the page itself,
                                             only for the admin view)
Visitor ──POST /api/actividades/:id/apuntarse──▶ lib/event-signups.ts ──▶ SQLite
```

`/actividades/[id]` is a Server Component, `export const dynamic =
'force-dynamic'` (matching `/encuestas/[slug]` and the home page —
Next.js would otherwise be free to prerender it once at build time,
the exact class of bug the `encuestas` feature shipped and `actividades`
was built to avoid repeating).

## Data Model

```sql
CREATE TABLE event_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, email)
)
```

Email is stored exactly as submitted after `.trim()` — no
case-normalization, matching the existing `subscribers` table's own
convention (`lib/subscribers.ts` does a plain trimmed `WHERE email =
?` lookup, not a case-insensitive one). The community check reuses
`isSubscribedEmail(db, email)` from `lib/subscribers.ts` as-is — no
duplicated matching logic.

## Components

- `lib/event-signups.ts` — new module, mirrors `lib/subscribers.ts`'s
  style:
  - `function createEventSignup(db, eventId, email): CreateSignupResult`
    where `CreateSignupResult = { status: 'ok' } | { status: 'invalid' } | { status: 'not_community' }`.
    `'invalid'` covers empty/malformed email (reusing the same email
    regex `lib/subscribers.ts` already defines — exported from there
    rather than duplicated). `'not_community'` when
    `isSubscribedEmail` returns false. A duplicate `(event_id, email)`
    insert is caught (same `UNIQUE constraint failed` pattern as
    `addSubscriber`) and treated as `{ status: 'ok' }`, not an error —
    signing up twice is a no-op success.
  - `function listEventSignups(db, eventId): { email: string; createdAt: string }[]` —
    ordered oldest-first, for the admin view.
- `app/api/actividades/[id]/apuntarse/route.ts` — `POST` only, public
  (no auth — this is a community-facing endpoint, not an admin one).
  Validates `id` parses to a number and the event exists (404
  otherwise), delegates to `createEventSignup`, translates the result
  to a `NextResponse`.
- `components/EventSignupForm.tsx` — client component, one email
  input + submit button, reusing `.signup-form`/`.form-field`/
  `.form-error`/`.cta-button` (no new CSS classes). On
  `not_community`, renders the specific message with a link to `/#unete`
  (the home page's existing signup section id). On `invalid`, a
  generic "email inválido" message. On `ok`, replaces the form with a
  confirmation message ("¡Apuntado! Nos vemos el [fecha]").
- `app/actividades/[id]/page.tsx` — Server Component, `force-dynamic`,
  `notFound()` if the event doesn't exist, renders the activity's
  details (same fields/formatting as the home page's schedule row)
  followed by `EventSignupForm`.
- `app/admin/activities/[id]/page.tsx` — extended (not replaced) to
  also render the list from `listEventSignups`, below the existing
  `ActivityBuilderForm`/`DeleteActivityButton`. Simple `<ul>` of
  emails, no new CSS.
- `app/page.tsx` — each activity's `schedule-title` becomes a `<Link
  href={`/actividades/${event.id}`}>` wrapping the title (the
  existing conditional external `<a>` for `event.link`, added in the
  actividades feature, stays as-is and is a separate, optional
  external link — this new internal link is the title's primary
  destination now; if both exist, the internal detail-page link takes
  the title, and `event.link`, if present, renders as a small
  secondary "Más información" link alongside it, not doubly-nested
  anchors).
- `components/Header.tsx` — one new nav link, "Agenda", pointing to
  `/#proximas-actividades` (works both from the home page and from any
  other page, since it's an absolute path with a hash).

## Error Handling

- `POST /api/actividades/[id]/apuntarse`:
  - Non-numeric or unknown `id` → `404`.
  - Missing/malformed email → `400`, `{ status: 'invalid' }`.
  - Email not in `subscribers` → `403`, `{ status: 'not_community' }`
    (not `401`/`404` — there's no auth concept here, and the resource
    being "forbidden" reads more accurately than "not found").
  - Success (including idempotent re-signup) → `200`,
    `{ status: 'ok' }`.
  - Malformed/non-object JSON body → `400`, never `500` (same
    `.catch(() => null)` + type-guard pattern used throughout).

## Out of Scope (v1, YAGNI)

- No way to cancel/un-signup.
- No signup count shown publicly (e.g. "12 apuntados") — only the
  admin sees the list.
- No email confirmation/notification sent on signup.
- No CSV export of signups — the admin's `<ul>` is enough for a club
  this size.
- No rate limiting on the signup endpoint beyond what already exists
  (none) for `/api/subscribe` — consistent with the rest of the site.

## Testing

- `lib/event-signups.test.ts` — `createEventSignup` (valid, invalid
  email, not-community email, duplicate-is-ok) and `listEventSignups`,
  against a real `:memory:` DB, matching `lib/subscribers.test.ts`'s
  pattern.
- `app/api/actividades/[id]/apuntarse/route.test.ts` — happy path,
  unknown event → 404, invalid email → 400, non-community email → 403.
- `components/EventSignupForm.test.tsx` — submit success, `not_community`
  message + link rendering, invalid-email message, mirroring
  `SignupForm.test.tsx`'s style.
- Per established convention, `app/actividades/[id]/page.tsx` and the
  admin page's list addition get no dedicated test — but the
  implementation plan must include an explicit `npm run build` check
  confirming `/actividades/[id]` is marked `ƒ (Dynamic)`.
