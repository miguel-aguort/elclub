# Encuestas — Member Surveys Design

## Purpose

Let the club's admin build simple surveys/questionnaires (encuestas) and
send members a link to answer them, so responses are collected and kept
durably instead of being gathered ad hoc (WhatsApp, paper, etc.). A
member is identified only by the email they already gave when signing
up — no accounts or passwords for members. An evaluation of Klaviyo
found it has no native survey/quiz builder (it relies on third-party
tools like ConvertFlow feeding data back into profile properties) and
solves a different problem (email/SMS marketing segmentation), so this
is built ad hoc in the existing Next.js + SQLite stack instead of
adopting an external tool.

## Success Criteria

- An admin can create a survey (title + ordered questions, each
  single-choice-with-options or free text) through a password-protected
  panel, without touching code or redeploying.
- The admin can share one link per survey; anyone who opens it and
  enters a member's email can answer it.
- Only emails that already exist in `subscribers` can submit a
  response — unrecognized emails are rejected with a clear message.
- Submitting again with the same email overwrites that member's
  previous answer for that survey (no duplicate rows, no error).
- The admin can view a results page per survey: tallies for
  single-choice questions, a list of answers for free-text questions.
- Responses are durably stored in the same SQLite file as `subscribers`.

## Architecture

Extends the existing single Next.js app — no new services. Two new
areas: a password-gated admin section for building/reviewing surveys,
and a public survey-response page keyed by slug.

```
Admin ──POST /api/admin/login (password)────▶ sets session cookie
Admin ──CRUD /api/admin/surveys[/:id]────────▶ lib/surveys.ts ──▶ SQLite
Admin ──GET /api/admin/surveys/:id/responses─▶ lib/survey-responses.ts (tallies) ──▶ SQLite

Member ──GET /encuestas/:slug────────────────▶ GET /api/surveys/:slug ──▶ lib/surveys.ts ──▶ SQLite
Member ──POST /api/surveys/:slug/responses───▶ lib/survey-responses.ts ──▶ SQLite (upsert)
```

Admin routes (`/admin/*`, `/api/admin/*`) are protected by middleware
checking a session cookie set at login; the public survey routes need
no session, only a valid, subscribed email supplied in the request
body.

## Data Model

```sql
CREATE TABLE surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id),
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single_choice', 'text')),
  required INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL
);

CREATE TABLE survey_question_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES survey_questions(id),
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id),
  email TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (survey_id, email)
);
```

`answers_json` is a JSON object keyed by `question_id` (stable across
prompt edits), e.g. `{"3": "Sí", "4": "Prefiero sábados"}` — single-choice
answers store the selected option's label, text answers store the raw
string. Results are rendered by joining this against
`survey_questions`/`survey_question_options` in application code; no
SQL-level aggregation is needed at this data volume.

This deliberately borrows Klaviyo's question model (explicit `type`,
`required`, ordered position) but diverges on answer storage: Klaviyo
flattens each answer into a top-level profile property because its
segmentation/personalization engine can only read top-level keys. This
project has no such downstream consumer — the only reader is the
admin's own results view — so one JSON blob per response, keyed by a
stable ID, is simpler and avoids a schema migration every time a
question is added or reworded.

## Components

- `lib/admin-auth.ts` — checks the submitted password against
  `ADMIN_PASSWORD` (env var), issues/validates the session cookie.
- `lib/surveys.ts` — schema init, CRUD for surveys/questions/options
  (create survey with nested questions+options in one transaction,
  fetch by slug or id, update, delete).
- `lib/survey-responses.ts` — validation (email format + membership
  check + required-question check), upsert into `survey_responses`,
  tally computation for the results view.
- `middleware.ts` — redirects unauthenticated requests to `/admin/*`
  and rejects unauthenticated `/api/admin/*` requests.
- `/admin/login` — password form.
- `/admin/surveys`, `/admin/surveys/new`, `/admin/surveys/[id]` —
  list, builder, edit + results view.
- `/encuestas/[slug]` — public response form: email field + rendered
  questions (radio group for `single_choice`, textarea for `text`).
- API routes as laid out in Architecture above.

The `survey_questions.required` column exists for future flexibility,
but the v1 builder UI always creates questions as required (no
optional-question toggle) and the response form enforces that
uniformly — keeps the builder simpler until there's an actual need for
optional questions.

## Error Handling

- Admin login: wrong password → `401`, generic message, no lockout.
- Survey builder save: title required; each question needs a prompt;
  `single_choice` questions need ≥2 options — field-level `400`s,
  same shape as the existing `validateSubscribeInput` pattern.
- Public submit: malformed body / invalid email format → `400
  {field: 'email'}`; email not found in `subscribers` → `400 {field:
  'email', reason: 'not_member'}` (its own reason so the form can show
  "no encontramos ese email entre los socios"); a required question
  left unanswered → `400 {field: 'question', questionId}`; unknown
  survey slug → `404`.
- Admin API routes: missing/invalid session cookie → `401`.
- Anything else (unexpected DB errors) is allowed to throw → `500`,
  consistent with the existing `/api/subscribe` route.

## Out of Scope (v1, YAGNI)

- No multi-select (checkbox) questions, rating scales, or branching
  logic — single-choice and free text cover the stated need.
- No per-member authentication beyond the email-must-exist check —
  anyone with the survey link and a member's email can answer as them;
  acceptable since the club shares the link only with members and the
  data isn't sensitive.
- No CSV export or charting beyond simple tallies on the results page.
- No editing/deleting individual responses from the admin panel v1 —
  only viewing tallies and the raw list.

## Testing

- `lib/surveys.test.ts` — schema creation, CRUD, slug uniqueness.
- `lib/survey-responses.test.ts` — validation (bad email, non-member
  email, missing required answer), insert-then-overwrite upsert
  behavior, tally computation.
- `lib/admin-auth.test.ts` — correct/incorrect password, cookie
  issuance.
- `route.test.ts` per API endpoint (happy path + validation/auth
  failures), mirroring the existing `app/api/subscribe/route.test.ts`.
- Component test for the public survey response form (renders,
  submits, shows validation/not-member errors), mirroring
  `SignupForm.test.tsx`; a light smoke test for the admin builder form.
