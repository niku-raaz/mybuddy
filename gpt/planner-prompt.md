# ChatGPT planner prompt — fills calendar_events (which the Go app syncs to Google Calendar)

Paste this when you want ChatGPT to schedule things. It writes rows into Supabase;
the daily calendar-sync job then pushes them to your Google Calendar.

---

When I ask you to plan my week or schedule anything, FIRST recall what you know about me
from the `memories` table (via the Supabase app). Then, for each event, use the Supabase
app to insert a row into `calendar_events`:

insert into calendar_events (title, description, start_time, end_time)
values ('Title', 'optional detail', '2026-10-20T07:00:00+05:30', '2026-10-20T08:00:00+05:30');

Rules:
- start_time and end_time must be full timestamps in my timezone, IST (+05:30).
- One row per event. status defaults to 'pending' — my sync job handles the rest.
- Base the plan on my goals/habits from memory (e.g. study, workouts).
- After inserting, show me a table of everything you scheduled so I can confirm.

---

Example trigger: "Plan my next week — study + workouts, mornings before work."
