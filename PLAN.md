# mybuddy — Plan & Ideas

> A personal AI that quietly learns who you are from your normal ChatGPT use, remembers it forever in your own database, and proactively helps plan your life (weekly schedule, study, workouts, calendar).

_Last updated: 2026-10-16 · Owner: Niku_

---

## 1. The vision

Most AI chat is amnesiac — every conversation starts from zero. **mybuddy** fixes that by giving you a persistent, private memory that *you own*, which:

1. **Learns you passively** — captures durable facts, goals, and preferences from your everyday ChatGPT conversations.
2. **Remembers forever** — stores them in your own Supabase database (not locked inside OpenAI).
3. **Makes ChatGPT personal** — ChatGPT recalls your memory before answering, so it actually "knows you."
4. **Acts proactively** — a weekly planner reads your memory and drafts your week (study, workouts, tasks) straight into Google Calendar.

**One-line pitch:** _A second brain that fills itself up while you chat, and a life-coach that uses it._

---

## 2. Core principle (the thing that makes it work)

> You keep using **ChatGPT** as your chat app. You do **not** switch to a new app.

Everything hangs off connectors that let ChatGPT reach your own stores (Supabase + Notion). ChatGPT becomes both the chat surface *and* the agent that reads/writes your memory — no separate chat UI to build.

---

## 3. Key decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| **Platform** | Keep ChatGPT as the chat app | Zero habit change; no UI to rebuild |
| **Chat capture** | Via ChatGPT connectors + a save action | Memory writes itself during normal use |
| **MVP focus** | **Memory that knows me** | The core magic; planner comes after |
| **Source of truth** | **Supabase** (Postgres + pgvector) | Structured + semantic recall + reliable writes |
| **Human dashboard** | **Notion** (mirror of Supabase) | Browsable, editable, nice to look at |
| **Memory API** | **Supabase Edge Functions** (TypeScript) | Lives next to the DB, free, gives the HTTPS URL a Custom GPT Action needs |

---

## 4. The one hard problem (and the fix)

**Reading memory is easy. *Auto-writing* memory is the hard part.**

- ChatGPT connectors (as currently enabled) can **read/search** Supabase + Notion. ✅
- They do **not** reliably **write**, and there's no background hook that silently logs every chat. ❌

**Fix:** a tiny **memory API** exposing two actions, wrapped as a **Custom GPT Action**:

- `SaveMemory(type, content, confidence, source)` → embed + insert into Supabase
- `RecallMemory(query, limit)` → embed query + vector-search + return top matches

Then a **Custom GPT** whose instructions *force* the behavior:

> _"Before answering anything personal, call `RecallMemory` first. After any exchange that reveals a durable fact, goal, or preference about the user, call `SaveMemory`."_

This turns "it remembers me" from a hope into a rule.

---

## 5. Architecture

```
        You  ──chat──►  Custom GPT "mybuddy" (inside ChatGPT)
                              │
             ┌────────────────┼─────────────────┐
             ▼                ▼                  ▼
       RecallMemory      SaveMemory       Google Calendar
        (read)            (write)           connector
             │                │
             ▼                ▼
      ┌──────────────────────────────┐
      │   Memory API                  │
      │   (Supabase Edge Functions,   │
      │    TypeScript + embeddings)   │
      └──────────────┬────────────────┘
                     ▼
     Supabase Postgres + pgvector   ◄── THE BRAIN (source of truth)
                     │
                     └──(nightly sync)──►  Notion  ◄── readable dashboard

   Sunday 9pm ─► ChatGPT Scheduled Task ─► read memory ─► draft week ─► write Calendar
```

---

## 6. The memory engine (4 layers)

1. **Raw log** — optional: full chat turns (mainly for backfilling old exports).
2. **Extracted memory** — durable facts pulled from conversations: `{type, content, confidence, source, date}`.
3. **Rolling profile** — a living "who is Niku" summary, injected into chats.
4. **Semantic recall** — pgvector embeddings so a question pulls relevant memories even when worded differently.

**Memory types:** `fact` · `preference` · `goal` · `event` · `project`

---

## 7. Supabase schema (draft)

```sql
-- requires: create extension if not exists vector;

create table memories (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('fact','preference','goal','event','project')),
  content     text not null,
  confidence  real default 0.8,
  source      text,                       -- e.g. 'chatgpt', 'import', 'manual'
  embedding   vector(1536),               -- OpenAI text-embedding-3-small
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on memories using ivfflat (embedding vector_cosine_ops);

create table messages (                    -- optional raw log / backfill
  id          uuid primary key default gen_random_uuid(),
  role        text,                        -- 'user' | 'assistant'
  content     text,
  source      text,
  created_at  timestamptz default now()
);

create table weekly_plans (                -- scheduler output
  id          uuid primary key default gen_random_uuid(),
  week_start  date,
  plan        jsonb,                       -- days → blocks
  status      text default 'draft',        -- draft | approved | synced
  created_at  timestamptz default now()
);
```

**Recall flow:** embed the question → `order by embedding <=> query_embedding limit K` → return matches → ChatGPT answers knowing you.

---

## 8. Build plan (phased)

### Phase 1 — Memory that knows me (MVP)
- [ ] Supabase project + schema (pgvector, 3 tables, indexes)
- [ ] `SaveMemory` Edge Function (embed + insert)
- [ ] `RecallMemory` Edge Function (embed query + vector search)
- [ ] OpenAPI spec for the two actions
- [ ] Custom GPT: paste the Action + the save/recall instructions
- [ ] **Milestone:** chat normally → ask "what are my goals?" → it answers from saved memory

### Phase 2 — Make it readable + seed it
- [ ] Notion mirror: nightly sync Supabase → a Notion "Memory" page
- [ ] Backfill: import ChatGPT/Claude data export (JSON) into `messages` + extract memories

### Phase 3 — Proactive layer (calendar sync) — IN PROGRESS
- [x] `calendar-sync/` Go app: reads `calendar_events` (status='pending') from Supabase →
      creates them in Google Calendar → marks them `synced`. One-shot, idempotent.
- **Auth:** Google **service account** (free, no billing) + share your calendar with the
  SA email ("Make changes to events"). Headless, never expires.
- **Contract:** ChatGPT inserts rows into `calendar_events` when it plans; the Go app pushes them.
- **Hosting now:** local cron on the Mac (runs only when the machine is on/awake).
- **Hosting later (planned — GitHub Actions):** free cloud cron, runs daily without a
  server, secrets stored in GitHub Actions. Move here once the code is in a GitHub repo.
  A `.github/workflows/sync.yml` on a `schedule:` cron that builds + runs `calendar-sync`.
- [ ] Weekly planner: ChatGPT drafts the week into `calendar_events` (add to its instructions)
- [ ] Email reminders
- [ ] Android app

### Phase 4 — Nice-to-haves
- [ ] Dedicated mini-dashboard (PWA) to browse/edit memory
- [ ] Multi-source capture (Claude, etc.)
- [ ] Habit tracking + streaks

---

## 9. Tech stack

- **Chat surface:** ChatGPT (Custom GPT "mybuddy")
- **Memory store:** Supabase — Postgres + pgvector
- **API:** Supabase Edge Functions (Deno/TypeScript)
- **Embeddings:** OpenAI `text-embedding-3-small` (1536-dim) _(open: could swap for a free local model)_
- **Dashboard:** Notion (mirror)
- **Scheduler:** ChatGPT Scheduled Tasks
- **Calendar:** Google Calendar connector

---

## 10. Open questions / to confirm

- [ ] Supabase project URL + keys available? (or scaffold with `.env` placeholders)
- [ ] OK to use OpenAI embeddings (needs OpenAI key), or prefer a free/local embedding model?
- [ ] Exact write path of current connectors (plain connector vs Custom GPT Action vs MCP) — likely need to build the Action for reliable writes.
- [ ] How much old history to backfill from exports?
- [ ] Privacy: everything stays in your own Supabase/Notion — confirm no third party beyond OpenAI (chat) + embeddings provider.

---

## 11. Risks & notes

- **Auto-save reliability** is the make-or-break; the Custom GPT instructions must be strict and tested.
- **Connector write limits** — if connectors can't write, the Edge Function Action is mandatory (planned anyway).
- **Duplicate/▵conflicting memories** — later: a dedupe/merge pass so memory doesn't bloat or contradict itself.
- **Cost** — embeddings + storage are tiny at personal scale; should stay within free tiers.

---

## 12. Next step

Scaffold **Phase 1** right here in `mybuddy/`:
`schema.sql` + the two Edge Functions + the OpenAPI spec + the Custom GPT instructions. Once deployed, you'll have a ChatGPT that genuinely remembers you.
