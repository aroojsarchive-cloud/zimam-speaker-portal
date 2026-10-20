-- Email-as-username sign-in for speakers, personal invite links, and a login rate limit.

-- A personal, long-lived link token per person: /i/<token> signs them straight in.
-- Lives in people_private, so only the person and producers can see it.
alter table people_private
  add column invite_token text unique default replace(gen_random_uuid()::text, '-', '');

-- Sign-in attempts, for rate limiting by IP. Service role only: RLS on, no policies.
create table login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  email text,
  ok boolean not null,
  at timestamptz not null default now()
);
create index on login_attempts (ip, at);
alter table login_attempts enable row level security;
