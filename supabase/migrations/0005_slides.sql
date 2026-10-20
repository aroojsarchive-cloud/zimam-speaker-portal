-- Slide submissions: speakers upload their deck to a session they are on.
-- Files live in the private "slides" bucket at <session_id>/<person_id>/<file>.

create function is_assigned(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join people p on p.id = a.person_id
    where a.session_id = p_session and p.auth_user_id = auth.uid()
  )
$$;
grant execute on function is_assigned(uuid) to anon, authenticated;

create table slide_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  session_id uuid not null references sessions on delete cascade,
  person_id uuid not null references people on delete cascade,
  file_path text not null,
  file_name text not null,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);
create index on slide_submissions (session_id);
create trigger slide_submissions_event before insert on slide_submissions
  for each row execute function fill_event_id();

-- fill_event_id() needs to know about the new table.
create or replace function fill_event_id() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'tracks' then
    select event_id into new.event_id from days where id = new.day_id;
  elsif tg_table_name = 'sessions' then
    select event_id into new.event_id from tracks where id = new.track_id;
  elsif tg_table_name in ('concept_notes', 'session_internal_notes', 'assignments', 'slide_submissions') then
    select event_id into new.event_id from sessions where id = new.session_id;
  elsif tg_table_name = 'people_private' then
    select event_id into new.event_id from people where id = new.person_id;
  end if;
  return new;
end $$;

alter table slide_submissions enable row level security;

-- Producers see everything; speakers see their own; moderators see their session's decks.
create policy slides_read on slide_submissions for select using (
  is_producer(event_id) or person_id = my_person_id(event_id) or is_moderator(session_id)
);
-- You can only submit as yourself, to a session you are on.
create policy slides_insert on slide_submissions for insert with check (
  person_id = my_person_id(event_id) and is_assigned(session_id)
);
create policy slides_delete on slide_submissions for delete using (
  is_producer(event_id) or person_id = my_person_id(event_id)
);

insert into storage.buckets (id, name, public) values ('slides', 'slides', false)
on conflict (id) do nothing;

create policy slides_files_read on storage.objects for select to authenticated using (
  bucket_id = 'slides' and (
    is_producer(storage_session_event(name))
    or split_part(name, '/', 2) = my_person_id(storage_session_event(name))::text
    or is_moderator(split_part(name, '/', 1)::uuid)
  )
);
create policy slides_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'slides'
  and split_part(name, '/', 2) = my_person_id(storage_session_event(name))::text
  and is_assigned(split_part(name, '/', 1)::uuid)
);

alter publication supabase_realtime add table slide_submissions;
