# mybuddy

A personal AI with a memory you own. You keep chatting in **ChatGPT**; a Custom GPT
quietly **recalls** what it knows about you before answering and **saves** durable facts
after. Memory lives in **your** Supabase (Postgres + pgvector). See [PLAN.md](./PLAN.md)
for the full vision and roadmap.

This repo is **Phase 1 — "memory that knows me."**

## What's here

```
PLAN.md                         full plan, architecture, roadmap
supabase/
  schema.sql                    tables + pgvector + match_memories()
  functions/
    _shared/util.ts             auth, CORS, Supabase client, embeddings
    save-memory/index.ts        POST /save-memory  (embed + insert)
    recall-memory/index.ts      POST /recall-memory (semantic search)
openapi/mybuddy-actions.yaml    the Action spec to paste into the Custom GPT
gpt/instructions.md             the Custom GPT system prompt
.env.example                    the secrets you need
```

## Setup (one-time, ~20 min)

### 1. Supabase project
- Create a free project at supabase.com.
- SQL editor → paste `supabase/schema.sql` → run.
- Settings → API → copy the **Project URL**, **project ref**, and **service_role key**.

### 2. Secrets
```bash
cp .env.example .env     # then fill in the values
# generate the shared API key:
openssl rand -hex 24
```
You need just two: `SUPABASE_SERVICE_ROLE_KEY` (plus `SUPABASE_URL`) and `MYBUDDY_API_KEY`.

> **Embeddings:** uses Supabase's **built-in free `gte-small` model** — no API key,
> no OpenAI billing. To switch to OpenAI `text-embedding-3-small` instead (higher
> quality), swap the `embed()` function in `supabase/functions/_shared/util.ts` and
> change `vector(384)` → `vector(1536)` in `schema.sql`.

### 3. Deploy the functions
```bash
npm i -g supabase            # if not installed
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# set the one secret the functions read (URL + service key are auto-injected):
supabase secrets set MYBUDDY_API_KEY=your-random-key

# --no-verify-jwt: our own x-api-key guards the endpoints, not a Supabase login token
supabase functions deploy save-memory --no-verify-jwt
supabase functions deploy recall-memory --no-verify-jwt
```

### 4. Build the Custom GPT
- ChatGPT → **Explore GPTs → Create**.
- **Instructions:** paste `gpt/instructions.md`.
- **Actions → Create new action:**
  - Paste `openapi/mybuddy-actions.yaml`.
  - Set the server `url` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1`.
  - **Authentication → API Key →** Header name `x-api-key`, value = your `MYBUDDY_API_KEY`.

### 5. Try it
```bash
# save:
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/save-memory" \
  -H "x-api-key: $MYBUDDY_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"goal","content":"Wants to learn system design by December 2026"}'

# recall:
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/recall-memory" \
  -H "x-api-key: $MYBUDDY_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"what are my learning goals?"}'
```
Then in the Custom GPT: tell it a few things about yourself, start a new chat, and ask
"what do you know about my goals?" — it should recall them.

## Next phases
- **Phase 2:** Notion mirror + backfill from ChatGPT/Claude exports.
- **Phase 3:** weekly planner (ChatGPT Scheduled Task) → Google Calendar.

See [PLAN.md](./PLAN.md).
