# calendar-sync

A tiny Go app that reads pending events from Supabase (`calendar_events`) and creates them
in your Google Calendar, then marks them `synced`. Runs as a one-shot on a schedule.

```
ChatGPT → Supabase (calendar_events, status='pending') → calendar-sync → Google Calendar
```

## Setup (one-time)

### 1. Create the table
Run `../supabase/calendar_events.sql` in the Supabase SQL editor.

### 2. Google service account (free)
1. Go to **console.cloud.google.com** → create a project (or reuse one). Free, no billing needed.
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**. Name it, create.
4. Open the service account → **Keys → Add key → Create new key → JSON** → download it.
5. Save that file here as `calendar-sync/service-account.json` (it's gitignored).
6. Copy the service account's **email** (looks like `name@project.iam.gserviceaccount.com`).

### 3. Share your calendar with the service account
1. **Google Calendar** → hover your calendar (left) → ⋮ → **Settings and sharing**.
2. **Share with specific people or groups → Add people** → paste the service-account email.
3. Permission: **Make changes to events** → Send.
   (This is what lets the headless app write to your calendar — no login flow, never expires.)

### 4. Configure env
```bash
cp .env.example .env
```
Fill in:
- `DATABASE_URL` — Supabase → Settings → Database → Connection string (URI, Session pooler), with your DB password.
- `SERVICE_ACCOUNT_FILE=./service-account.json`
- `CALENDAR_ID` — your Google account email (the calendar you just shared).

### 5. Build & run
```bash
go mod tidy          # fetch dependencies
go run .             # one sync run
```
Add a test row first, then run:
```sql
insert into calendar_events (title, start_time)
values ('Study system design', now() + interval '1 day');
```
You should see `SYNCED "Study system design" -> https://...` and the event in Google Calendar.

## Schedule it (local cron, for now)
Build a binary and run it daily from cron:
```bash
go build -o calendar-sync .
crontab -e
```
Add (runs every day at 7:00 AM; `cd` so it finds `.env` + the key file):
```
0 7 * * * cd /Users/niku.raj/Desktop/mybuddy/calendar-sync && ./calendar-sync >> cron.log 2>&1
```
> Local cron only fires when your Mac is on and awake. See `../PLAN.md` for the planned
> free cloud option (GitHub Actions scheduled workflow) to make it run unattended.

## How ChatGPT fills it
When ChatGPT plans your week, it inserts rows into `calendar_events` (status defaults to
`pending`). Next cron run pushes them to your calendar. We'll add that to ChatGPT's
instructions when we wire up the weekly planner.
