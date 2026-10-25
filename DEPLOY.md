# Deploying calendar-sync to GitHub Actions (free, unattended)

Moves the daily sync off your Mac into GitHub's cloud. The workflow is already in
`.github/workflows/calendar-sync.yml` (runs 07:00 IST daily + a manual button).

## Secrets it needs (added in the GitHub repo UI, never in code)
| Secret name | Value |
|---|---|
| `DATABASE_URL` | Your Supabase connection string (with password) — same as in `.env` |
| `SERVICE_ACCOUNT_JSON` | The **entire contents** of `calendar-sync/service-account.json` |
| `CALENDAR_ID` | `nikurajj22@gmail.com` |

## Steps (on your personal laptop + personal GitHub)

### 1. Get the code onto the personal laptop
Copy the whole `mybuddy` folder over (USB / Drive / AirDrop). The local `.env` and
`service-account.json` come along but are **gitignored**, so they won't be pushed — you'll
use their contents to create the GitHub secrets.

### 2. Create the repo and push
```bash
cd mybuddy
git init
git add .
git status      # ⚠️ CONFIRM .env, calendar-sync/.env, and service-account.json are NOT listed
git commit -m "mybuddy: memory + calendar sync"
# create a PRIVATE repo on your personal GitHub, then:
git remote add origin git@github.com:<your-username>/mybuddy.git
git branch -M main
git push -u origin main
```
If `git status` shows any secret file, stop and check `.gitignore` before committing.

### 3. Add the secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add the three from the table above. For `SERVICE_ACCOUNT_JSON`, open
`calendar-sync/service-account.json` and paste the whole file (multiline is fine).

### 4. Test it
Repo → **Actions** tab → enable workflows if prompted → pick **calendar-sync** →
**Run workflow**. Add a pending row in Supabase first so there's something to sync:
```sql
insert into calendar_events (title, start_time) values ('GH Actions test', now() + interval '2 days');
```
Open the run logs — you should see `SYNCED "GH Actions test" -> ...` and the event on your calendar.

### 5. Done
After that, it runs automatically every day at 07:00 IST. You can remove the local Mac
cron line (`crontab -e`) — it's no longer needed (double-running is harmless anyway, since
only `pending` rows ever sync).

## Notes / gotchas
- GitHub cron is **UTC**; the workflow uses `30 1 * * *` = 07:00 IST.
- Scheduled workflows get **auto-disabled after ~60 days of no repo activity** — a commit or
  a manual run re-arms them.
- Private repo free tier includes 2,000 Action minutes/month; this uses ~1 min/day.
- Never commit `service-account.json` or `.env` — the secrets live only in the GitHub UI.
