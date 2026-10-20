-- ZIMAM Speaker Portal: core schema, row-level security and RPCs.
-- Hierarchy: event → day → track → session; people reach sessions via assignments.
-- All times are timestamptz (UTC); the app displays them in events.timezone.

create extension if not exists citext;

-- ───────────────────────────── Enums ─────────────────────────────

create type app_role as enum ('producer', 'viewer', 'participant');
create type session_format as enum (
  'keynote', 'panel', 'fireside', 'lecture', 'opening', 'closing',
  'break', 'contest', 'award', 'workshop', 'briefing', 'pitches', 'judging', 'other'
);
create type session_type as enum ('speaking', 'non_speaking');
create type publish_status as enum ('draft', 'published');
create type details_status as enum ('unconfirmed', 'confirmed', 'change_requested');
create type assignment_role as enum (
  'moderator', 'panelist', 'keynote', 'speaker', 'mc', 'jury', 'chair', 'co_chair', 'host'
);
create type assignment_status as enum ('confirmed', 'tentative', 'invited', 'tbc');
create type note_kind as enum ('draft', 'published');
create type notification_type as enum ('invite', 'change', 'reminder', 'coming_up', 'login');

-- ───────────────────────────── Tables ─────────────────────────────

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  start_date date not null,
  end_date date not null,
  venue text not null,
  timezone text not null default 'Asia/Dubai',
  brand jsonb not null default '{}',
  producer_name text,
  producer_phone text,
  producer_whatsapp text,
  running_late_minutes int not null default 0 check (running_late_minutes >= 0),
  running_late_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  date date not null,
  label text not null,
  unique (event_id, date)
);

create table tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  day_id uuid not null references days on delete cascade,
  name text not null,
  strapline text,
  room text,
  colour text,
  sort_order int not null default 0
);
create index on tracks (day_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  track_id uuid not null references tracks on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  sequence int not null default 0,
  block_label text,                -- e.g. "Morning session · From Exchange to Utility"
  label text,                      -- e.g. "Panel 1 · GCC & MENA Discussion Panel"
  title text not null,
  format session_format not null default 'other',
  session_type session_type not null default 'speaking',
  description text,
  status publish_status not null default 'draft',
  published_at timestamptz,
  published_by uuid,
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on sessions (track_id, sequence);
create index on sessions (event_id, start_time);

-- Producer-only notes live in their own table so row-level security can hide them.
create table session_internal_notes (
  session_id uuid primary key references sessions on delete cascade,
  event_id uuid not null references events on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

-- One draft row and at most one published row per session.
create table concept_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  session_id uuid not null references sessions on delete cascade,
  kind note_kind not null,
  summary text,
  objectives text,
  key_questions jsonb not null default '[]',  -- [{ "text": "...", "person_id": uuid|null }]
  format_notes text,
  run_of_show text,
  file_path text,                             -- storage path in the "briefs" bucket
  file_name text,
  version int not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (session_id, kind)
);

-- Public profile: name, title, organisation, photo. Visible to everyone at the event.
create table people (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  salutation text,                 -- Dr, Prof, Mr, Ms, HE
  full_name text not null,
  title text,
  organisation text,
  country text,
  photo_path text,                 -- storage path in the "photos" bucket
  short_bio text,
  details_status details_status not null default 'unconfirmed',
  details_confirmed_at timestamptz,
  is_placeholder boolean not null default false,   -- "Industry partner (TBC)": shows on agenda, cannot log in
  app_role app_role not null default 'participant',
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  unique (event_id, auth_user_id)
);
create index on people (auth_user_id);

-- Private contact details and admin fields: visible to the person and producers only.
create table people_private (
  person_id uuid primary key references people on delete cascade,
  event_id uuid not null references events on delete cascade,
  email citext,
  phone text,
  change_request_note text,
  internal_notes text,
  last_login_at timestamptz,
  last_seen_changes_at timestamptz,
  unique (event_id, email)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  person_id uuid not null references people on delete cascade,
  session_id uuid not null references sessions on delete cascade,
  role assignment_role not null,
  status assignment_status not null default 'tbc',
  sort_order int not null default 0,
  checked_in_at timestamptz,
  unique (person_id, session_id, role)
);
create index on assignments (session_id);
create index on assignments (person_id);

create table change_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references events on delete cascade,
  entity text not null,
  entity_id uuid not null,
  session_id uuid,                 -- the session affected, for "notify affected speakers"
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  notified boolean not null default false
);
create index on change_log (event_id, notified);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  person_id uuid references people on delete set null,
  type notification_type not null,
  subject text not null,
  provider_id text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  status text not null default 'sent'
);

-- Things the import found that a human must resolve (e.g. 11:00 vs 11:30).
create table import_flags (
  id bigint generated always as identity primary key,
  event_id uuid not null references events on delete cascade,
  message text not null,
  entity text,
  entity_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────── Denormalised event_id + timestamps ───────────────────

create function fill_event_id() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'tracks' then
    select event_id into new.event_id from days where id = new.day_id;
  elsif tg_table_name = 'sessions' then
    select event_id into new.event_id from tracks where id = new.track_id;
  elsif tg_table_name in ('concept_notes', 'session_internal_notes') then
    select event_id into new.event_id from sessions where id = new.session_id;
  elsif tg_table_name = 'assignments' then
    select event_id into new.event_id from sessions where id = new.session_id;
  elsif tg_table_name = 'people_private' then
    select event_id into new.event_id from people where id = new.person_id;
  end if;
  return new;
end $$;

create trigger tracks_event before insert or update of day_id on tracks
  for each row execute function fill_event_id();
create trigger sessions_event before insert or update of track_id on sessions
  for each row execute function fill_event_id();
create trigger concept_notes_event before insert on concept_notes
  for each row execute function fill_event_id();
create trigger internal_notes_event before insert on session_internal_notes
  for each row execute function fill_event_id();
create trigger assignments_event before insert or update of session_id on assignments
  for each row execute function fill_event_id();
create trigger people_private_event before insert on people_private
  for each row execute function fill_event_id();

-- ───────────────────────────── Permission helpers ─────────────────────────────
-- security definer so policies can consult people without recursing into people's own RLS.

create function my_person_id(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where event_id = p_event and auth_user_id = auth.uid()
$$;

create function is_member(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where event_id = p_event and auth_user_id = auth.uid())
$$;

create function is_producer(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people
                 where event_id = p_event and auth_user_id = auth.uid() and app_role = 'producer')
$$;

create function is_moderator(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join people p on p.id = a.person_id
    where a.session_id = p_session and a.role = 'moderator' and p.auth_user_id = auth.uid()
  )
$$;

create function session_published(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sessions where id = p_session and status = 'published')
$$;

-- ───────────────────────────── Row-level security ─────────────────────────────

alter table events enable row level security;
alter table days enable row level security;
alter table tracks enable row level security;
alter table sessions enable row level security;
alter table session_internal_notes enable row level security;
alter table concept_notes enable row level security;
alter table people enable row level security;
alter table people_private enable row level security;
alter table assignments enable row level security;
alter table change_log enable row level security;
alter table notifications enable row level security;
alter table import_flags enable row level security;

-- Everyone at the event sees the event shell; producers edit it.
create policy events_read on events for select using (is_member(id));
create policy events_write on events for update using (is_producer(id)) with check (is_producer(id));

create policy days_read on days for select using (is_member(event_id));
create policy days_write on days for all using (is_producer(event_id)) with check (is_producer(event_id));

create policy tracks_read on tracks for select using (is_member(event_id));
create policy tracks_write on tracks for all using (is_producer(event_id)) with check (is_producer(event_id));

-- Drafts are invisible to everyone but producers (and the moderators of that session).
create policy sessions_read on sessions for select using (
  is_producer(event_id) or (status = 'published' and is_member(event_id)) or is_moderator(id)
);
create policy sessions_write on sessions for all using (is_producer(event_id)) with check (is_producer(event_id));

create policy internal_notes_producer on session_internal_notes for all
  using (is_producer(event_id)) with check (is_producer(event_id));

-- Concept notes: speakers see only the published copy of a published session;
-- moderators read and edit the draft of sessions they moderate; publishing goes through publish_brief().
create policy notes_read on concept_notes for select using (
  is_producer(event_id)
  or is_moderator(session_id)
  or (kind = 'published' and is_member(event_id) and session_published(session_id))
);
create policy notes_draft_insert on concept_notes for insert with check (
  is_producer(event_id) or (kind = 'draft' and is_moderator(session_id))
);
create policy notes_draft_update on concept_notes for update
  using (is_producer(event_id) or (kind = 'draft' and is_moderator(session_id)))
  with check (is_producer(event_id) or (kind = 'draft' and is_moderator(session_id)));
create policy notes_delete on concept_notes for delete using (is_producer(event_id));

-- Public profiles: readable by anyone at the event. Only producers write directly;
-- speakers change their own record through confirm_details / request_details_change / set_my_photo.
create policy people_read on people for select using (is_member(event_id));
create policy people_write on people for all using (is_producer(event_id)) with check (is_producer(event_id));

create policy people_private_read on people_private for select using (
  is_producer(event_id) or person_id = my_person_id(event_id)
);
create policy people_private_write on people_private for all
  using (is_producer(event_id)) with check (is_producer(event_id));

create policy assignments_read on assignments for select using (
  is_producer(event_id) or (is_member(event_id) and session_published(session_id)) or is_moderator(session_id)
);
create policy assignments_write on assignments for all
  using (is_producer(event_id)) with check (is_producer(event_id));

create policy change_log_producer on change_log for all
  using (is_producer(event_id)) with check (is_producer(event_id));
create policy notifications_producer on notifications for all
  using (is_producer(event_id)) with check (is_producer(event_id));
create policy import_flags_producer on import_flags for all
  using (is_producer(event_id)) with check (is_producer(event_id));

-- ───────────────────────────── Change log triggers ─────────────────────────────

create function log_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  col text;
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  rec jsonb := coalesce(new_j, old_j);
  sess uuid;
  tracked text[];
begin
  -- Seeding and service-role scripts run without a user; don't flood the log.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'sessions' then
    sess := (rec->>'id')::uuid;
    tracked := array['start_time','end_time','sequence','title','format','session_type','description','status','track_id','label'];
  elsif tg_table_name = 'assignments' then
    sess := (rec->>'session_id')::uuid;
    tracked := array['role','status','session_id'];
  elsif tg_table_name = 'tracks' then
    tracked := array['name','room','day_id'];
  elsif tg_table_name = 'people' then
    tracked := array['salutation','full_name','title','organisation','photo_path','details_status'];
  elsif tg_table_name = 'concept_notes' then
    sess := (rec->>'session_id')::uuid;
    tracked := array['version'];
  end if;

  if tg_op = 'INSERT' then
    insert into change_log(event_id, entity, entity_id, session_id, field, new_value, changed_by)
    values ((rec->>'event_id')::uuid, tg_table_name, (rec->>'id')::uuid, sess, '*created', null, auth.uid());
  elsif tg_op = 'DELETE' then
    insert into change_log(event_id, entity, entity_id, session_id, field, old_value, changed_by)
    values ((rec->>'event_id')::uuid, tg_table_name, (rec->>'id')::uuid, sess, '*deleted', null, auth.uid());
  else
    foreach col in array tracked loop
      if old_j->col is distinct from new_j->col then
        insert into change_log(event_id, entity, entity_id, session_id, field, old_value, new_value, changed_by)
        values ((rec->>'event_id')::uuid, tg_table_name, (rec->>'id')::uuid, sess, col,
                old_j->>col, new_j->>col, auth.uid());
      end if;
    end loop;
  end if;
  return coalesce(new, old);
end $$;

create trigger sessions_log after insert or update or delete on sessions
  for each row execute function log_changes();
create trigger assignments_log after insert or update or delete on assignments
  for each row execute function log_changes();
create trigger tracks_log after update on tracks
  for each row execute function log_changes();
create trigger people_log after update on people
  for each row execute function log_changes();
create trigger concept_notes_log after update of version on concept_notes
  for each row when (new.kind = 'published') execute function log_changes();

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger sessions_touch before update on sessions for each row execute function touch_updated_at();

-- ───────────────────────────── RPCs (speaker / moderator actions) ─────────────────────────────

-- Called right after sign-in: link this auth user to their people rows by email.
create function claim_person() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  my_email text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null or my_email is null then
    return;
  end if;
  update people p set auth_user_id = auth.uid()
    from people_private pp
   where pp.person_id = p.id and lower(pp.email::text) = my_email
     and not p.is_placeholder and (p.auth_user_id is null or p.auth_user_id = auth.uid());
  update people_private pp set last_login_at = now()
    from people p where p.id = pp.person_id and p.auth_user_id = auth.uid();
  return query select id from people where auth_user_id = auth.uid();
end $$;

create function confirm_details(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update people set details_status = 'confirmed', details_confirmed_at = now()
   where id = p_person and auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
  update people_private set change_request_note = null where person_id = p_person;
end $$;

create function request_details_change(p_person uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'note required'; end if;
  update people set details_status = 'change_requested'
   where id = p_person and auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
  update people_private set change_request_note = left(p_note, 2000) where person_id = p_person;
end $$;

-- After the speaker uploads to photos/<person_id>/..., point their profile at it.
create function set_my_photo(p_person uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_path not like p_person::text || '/%' then raise exception 'bad path'; end if;
  update people set photo_path = p_path, details_status = 'unconfirmed'
   where id = p_person and auth_user_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;

-- "I'm in the room": only on the day of that session (event timezone), only for your own assignment.
create function check_in(p_assignment uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  ts timestamptz;
begin
  update assignments a set checked_in_at = coalesce(a.checked_in_at, now())
    from people p, sessions s, events e
   where a.id = p_assignment and p.id = a.person_id and p.auth_user_id = auth.uid()
     and s.id = a.session_id and e.id = a.event_id
     and (s.start_time at time zone e.timezone)::date = (now() at time zone e.timezone)::date
  returning a.checked_in_at into ts;
  if ts is null then raise exception 'check-in not available'; end if;
  return ts;
end $$;

-- Copy the draft brief over the published one and bump the version.
create function publish_brief(p_session uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  d concept_notes;
  ev uuid;
  v int;
begin
  select event_id into ev from sessions where id = p_session;
  if not (is_producer(ev) or is_moderator(p_session)) then raise exception 'not allowed'; end if;
  select * into d from concept_notes where session_id = p_session and kind = 'draft';
  if d.id is null then raise exception 'no draft'; end if;

  insert into concept_notes (event_id, session_id, kind, summary, objectives, key_questions,
                             format_notes, run_of_show, file_path, file_name, version, updated_by, updated_at)
  values (ev, p_session, 'published', d.summary, d.objectives, d.key_questions,
          d.format_notes, d.run_of_show, d.file_path, d.file_name, 1, auth.uid(), now())
  on conflict (session_id, kind) do update set
    summary = excluded.summary, objectives = excluded.objectives, key_questions = excluded.key_questions,
    format_notes = excluded.format_notes, run_of_show = excluded.run_of_show,
    file_path = excluded.file_path, file_name = excluded.file_name,
    version = concept_notes.version + 1, updated_by = auth.uid(), updated_at = now()
  returning version into v;
  return v;
end $$;

-- Lock down: RPCs callable by signed-in users only.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ───────────────────────────── Realtime ─────────────────────────────

alter publication supabase_realtime add table events, sessions, assignments, concept_notes, tracks, people;

-- ───────────────────────────── Storage ─────────────────────────────
-- Both buckets are private; the app hands out short-lived signed URLs.

insert into storage.buckets (id, name, public) values ('photos', 'photos', false), ('briefs', 'briefs', false)
on conflict (id) do nothing;

create function storage_person_event(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select event_id from people where id::text = split_part(p_name, '/', 1)
$$;
create function storage_session_event(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select event_id from sessions where id::text = split_part(p_name, '/', 1)
$$;
grant execute on function storage_person_event(text), storage_session_event(text) to authenticated;

-- photos/<person_id>/<file>: any event member can view; the person or a producer can upload.
create policy photos_read on storage.objects for select to authenticated using (
  bucket_id = 'photos' and is_member(storage_person_event(name))
);
create policy photos_write on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and (
    is_producer(storage_person_event(name))
    or split_part(name, '/', 1) = my_person_id(storage_person_event(name))::text
  )
);
create policy photos_update on storage.objects for update to authenticated using (
  bucket_id = 'photos' and (
    is_producer(storage_person_event(name))
    or split_part(name, '/', 1) = my_person_id(storage_person_event(name))::text
  )
);

-- briefs/<session_id>/<file>: producers and that session's moderators upload; members of a published session read.
create policy briefs_read on storage.objects for select to authenticated using (
  bucket_id = 'briefs' and (
    is_producer(storage_session_event(name))
    or is_moderator(split_part(name, '/', 1)::uuid)
    or (is_member(storage_session_event(name)) and session_published(split_part(name, '/', 1)::uuid))
  )
);
create policy briefs_write on storage.objects for insert to authenticated with check (
  bucket_id = 'briefs' and (
    is_producer(storage_session_event(name)) or is_moderator(split_part(name, '/', 1)::uuid)
  )
);
