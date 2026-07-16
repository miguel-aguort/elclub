# El Club — Mountain Club Website Design

## Purpose

A marketing site for a mountain sports club whose primary goal is converting visitors into community sign-ups (email, name, phone optional), so the club can see how much interest exists and later reach out by email. Secondary goal: showcase the club's activities (trail running, climbing, biking, ...) and link out to Instagram.

## Success Criteria

- A visitor can submit name + email (phone optional) in under 10 seconds, with no page reload.
- Duplicate signups are rejected gracefully (friendly message, not an error page).
- Every activity (trail running, climbing, biking, ...) has its own visible section with a short description.
- Instagram is one click away from the header/footer.
- Signups are durably stored and the club can retrieve the full list at any time.
- The whole thing runs on GCP's Always Free e2-micro tier at $0/month.

## Architecture

Single Next.js (App Router, TypeScript) app serving both the marketing page and the signup API — one codebase, one deployable artifact, no separate frontend/backend to operate.

- **Frontend**: one landing page (`/`) composed of anchor-linked sections rendered server-side for fast first paint and good SEO (club discovery matters for a community site).
- **Backend**: a single API route, `POST /api/subscribe`, validates input and writes to SQLite.
- **Storage**: SQLite file (`data/subscribers.db`) via `better-sqlite3`, living on the VM's persistent disk. No separate DB server to run or pay for.
- **Hosting**: Docker container running on a single GCP Compute Engine `e2-micro` instance (Always Free tier: one instance in `us-west1`/`us-central1`/`us-east1`, 30GB standard persistent disk). The persistent disk is what makes SQLite viable here — this would NOT work on ephemeral serverless compute (Cloud Run, Lambda), where local disk is wiped between instances.

```
Browser ──POST /api/subscribe──▶ Next.js API route ──▶ better-sqlite3 ──▶ subscribers.db (persistent disk)
Browser ──GET /──────────────▶ Next.js page (SSR) ──▶ static sections + SignupForm component
```

## Components

- `Hero` — headline, sub-copy, primary CTA scrolling to the signup form.
- `SignupForm` — controlled form (name, email, phone-optional), client-side validation, POSTs JSON, shows inline success/duplicate/error states without navigation.
- `ActivitySection` — reusable presentational component, one instance per activity (Trail Running, Climbing, Biking, ...), so adding a new activity later is a one-line addition to a config array, not a new page.
- `InstagramLink` — icon/button in header and footer linking to the club's Instagram profile.
- `Footer` — Instagram link, basic club info.

Each component takes plain props and has no hidden dependency on the others — `ActivitySection` doesn't know about signup state, `SignupForm` doesn't know about activities.

## Data Flow & Validation

`subscribers` table: `id, name (required), email (required, unique), phone (optional), created_at`.

1. Client submits `{ name, email, phone? }` to `/api/subscribe`.
2. API validates: `name` non-empty, `email` matches a basic email pattern, `phone` untouched if absent.
3. On success → insert row → `200 { status: "ok" }`.
4. On duplicate email (unique constraint violation) → `200 { status: "duplicate" }` → form shows "You're already on the list!" (not treated as an error).
5. On validation failure → `400 { status: "invalid", field }` → form highlights the specific field.
6. On unexpected server error → `500` → form shows a generic "please try again" message.

## Out of Scope (v1, YAGNI)

- No admin dashboard — the club can read `subscribers.db` directly (e.g. `sqlite3` CLI) or a maintainer can run a one-off export script when needed.
- No authentication/user accounts — this is a public signup form, not a login system.
- No outbound email sending yet — the ask was to *know who's interested*, not to send campaigns. Can be layered on later (e.g. export emails into whatever mailing tool the club picks) once there's an actual list to email.
- No multi-page routing per activity — anchor sections on one page are enough until content volume demands separate pages.

## Testing

- Unit tests for `/api/subscribe`: valid signup, duplicate email, missing name, malformed email.
- Component test for `SignupForm`: renders, submits, shows each of the three response states.

## Deployment

Dockerfile builds the Next.js app; deployed manually (or via a simple script) to the GCP `e2-micro` free-tier VM; SQLite file lives on the VM's persistent disk so data survives restarts and redeploys.
