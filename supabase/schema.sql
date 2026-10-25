-- mybuddy — Supabase schema (Phase 1)
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- 1. pgvector for semantic recall
create extension if not exists vector;

-- 2. The brain: durable facts about the user
create table if not exists memories (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('fact','preference','goal','event','project')),
  content     text not null,
  confidence  real not null default 0.8,
  source      text default 'chatgpt',           -- 'chatgpt' | 'import' | 'manual'
  embedding   vector(384),                       -- Supabase gte-small (free, built-in)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- HNSW index for fast cosine similarity search (pgvector >= 0.5)
create index if not exists memories_embedding_idx
  on memories using hnsw (embedding vector_cosine_ops);

create index if not exists memories_type_idx on memories (type);

-- 3. Optional raw log (used mainly for backfilling old chat exports)
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  role        text,                              -- 'user' | 'assistant'
  content     text,
  source      text,
  created_at  timestamptz not null default now()
);

-- 4. Scheduler output (Phase 3)
create table if not exists weekly_plans (
  id          uuid primary key default gen_random_uuid(),
  week_start  date,
  plan        jsonb,                             -- days -> blocks
  status      text not null default 'draft',     -- draft | approved | synced
  created_at  timestamptz not null default now()
);

-- 5. Semantic recall function: returns the most relevant memories for a query embedding.
create or replace function match_memories(
  query_embedding vector(384),
  match_count     int  default 8,
  filter_type     text default null
)
returns table (
  id         uuid,
  type       text,
  content    text,
  confidence real,
  source     text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    m.id, m.type, m.content, m.confidence, m.source, m.created_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  where filter_type is null or m.type = filter_type
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. keep updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memories_touch on memories;
create trigger memories_touch
  before update on memories
  for each row execute function touch_updated_at();
