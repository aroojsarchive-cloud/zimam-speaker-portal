-- Key questions as one free-text box (moderators paste them in) instead of a structured list.
alter table concept_notes add column questions_text text;

create or replace function publish_brief(p_session uuid) returns int
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

  insert into concept_notes (event_id, session_id, kind, summary, objectives, key_questions, questions_text,
                             format_notes, run_of_show, file_path, file_name, version, updated_by, updated_at)
  values (ev, p_session, 'published', d.summary, d.objectives, d.key_questions, d.questions_text,
          d.format_notes, d.run_of_show, d.file_path, d.file_name, 1, auth.uid(), now())
  on conflict (session_id, kind) do update set
    summary = excluded.summary, objectives = excluded.objectives, key_questions = excluded.key_questions,
    questions_text = excluded.questions_text,
    format_notes = excluded.format_notes, run_of_show = excluded.run_of_show,
    file_path = excluded.file_path, file_name = excluded.file_name,
    version = concept_notes.version + 1, updated_by = auth.uid(), updated_at = now()
  returning version into v;
  return v;
end $$;
