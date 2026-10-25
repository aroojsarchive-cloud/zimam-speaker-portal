-- Per-room "running late", set by the producer on the day. Shifts the Live view and tells
-- speakers in that room roughly when they'll actually start. (events.running_late_minutes is unused.)
alter table tracks
  add column running_late_minutes int not null default 0 check (running_late_minutes between 0 and 180),
  add column running_late_updated_at timestamptz;
