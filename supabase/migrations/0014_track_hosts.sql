-- MCs and chairs host a whole programme (track) rather than one session, so they get a
-- run sheet for every session in it. Visible to everyone at the event, set by producers.
create table track_hosts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  track_id uuid not null references tracks on delete cascade,
  person_id uuid not null references people on delete cascade,
  role text not null default 'mc' check (role in ('mc', 'chair', 'co_chair')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (track_id, person_id)
);
create index on track_hosts (person_id);

create or replace function fill_event_id() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'tracks' then
    select event_id into new.event_id from days where id = new.day_id;
  elsif tg_table_name in ('sessions', 'track_hosts') then
    select event_id into new.event_id from tracks where id = new.track_id;
  elsif tg_table_name in ('concept_notes', 'session_internal_notes', 'assignments', 'slide_submissions') then
    select event_id into new.event_id from sessions where id = new.session_id;
  elsif tg_table_name = 'people_private' then
    select event_id into new.event_id from people where id = new.person_id;
  end if;
  return new;
end $$;

create trigger track_hosts_event before insert or update of track_id on track_hosts
  for each row execute function fill_event_id();

alter table track_hosts enable row level security;
create policy track_hosts_read on track_hosts for select using (is_member(event_id));
create policy track_hosts_write on track_hosts for all using (is_producer(event_id)) with check (is_producer(event_id));

alter publication supabase_realtime add table track_hosts;
