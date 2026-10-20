# ZIMAM Speaker Portal

One live source of truth for speakers, moderators, the producer and the design team.
Spec: `~/Downloads/zimam-speaker-portal-spec.md`.

## Setup

1. Fill in `.env.local` (Supabase URL + keys, `DATABASE_URL` session-pooler URI, `PRODUCER_EMAILS`).
2. `npm run db:migrate`: creates tables, permissions (RLS), storage buckets.
3. `npm run import -- seed/zimam-2026.json`: loads the programme and prints things to resolve.
4. `npm run dev`: http://localhost:3010

Without `RESEND_API_KEY`, sign-in emails are printed in the dev-server terminal instead of sent.

## Checks

- `npm run test:rls`: runs the real migrations in an in-memory Postgres and checks every permission rule
  (speaker can't see drafts or other people's contact details, moderators edit only their own sessions, etc.).
  Run it after any schema change.

## Re-skinning for another event

Edit `src/config/event.ts` and replace the files in `public/brand/`. Nothing else.
