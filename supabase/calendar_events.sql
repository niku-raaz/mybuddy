-- mybuddy — calendar_events table (Phase 3)
-- The contract between ChatGPT (writes planned events) and the Go calendar-sync app (pushes them).
-- Run this in the Supabase SQL editor.

create table if not exists calendar_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  start_time      timestamptz not null,
  end_time        timestamptz,                       -- null => app defaults to start + 1h
  location        text,
  status          text not null default 'pending',   -- pending | synced | failed
  google_event_id text,                              -- set after it lands in Google Calendar
  synced_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists calendar_events_status_idx on calendar_events (status);
