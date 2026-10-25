// recall-memory — STANDALONE (paste this whole file into the Supabase dashboard editor).
// Dashboard: Edge Functions -> Create function -> name it "recall-memory" -> paste -> Deploy.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Supabase's built-in free embedding model (384-dim). No API key needed.
// deno-lint-ignore no-explicit-any
declare const Supabase: any;
const embedModel = new Supabase.ai.Session("gte-small");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const expected = Deno.env.get("MYBUDDY_API_KEY");
    if (!expected || req.headers.get("x-api-key") !== expected) {
      return json({ ok: false, error: "Invalid or missing API key" }, 401);
    }
    if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

    const { query, limit, type } = await req.json();
    if (!query || typeof query !== "string") {
      return json({ ok: false, error: "`query` (string) is required" }, 400);
    }

    const embedding = await embedModel.run(query, { mean_pool: true, normalize: true });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_count: Math.min(typeof limit === "number" ? limit : 8, 25),
      filter_type: type ?? null,
    });
    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, memories: data });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
