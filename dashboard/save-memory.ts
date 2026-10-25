// save-memory — STANDALONE (paste this whole file into the Supabase dashboard editor).
// Dashboard: Edge Functions -> Create function -> name it "save-memory" -> paste -> Deploy.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_TYPES = ["fact", "preference", "goal", "event", "project"];

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
    // Auth: the Custom GPT sends our shared secret as the x-api-key header.
    const expected = Deno.env.get("MYBUDDY_API_KEY");
    if (!expected || req.headers.get("x-api-key") !== expected) {
      return json({ ok: false, error: "Invalid or missing API key" }, 401);
    }
    if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

    const { type, content, confidence, source } = await req.json();
    if (!content || typeof content !== "string") {
      return json({ ok: false, error: "`content` (string) is required" }, 400);
    }
    if (!VALID_TYPES.includes(type)) {
      return json({ ok: false, error: `\`type\` must be one of: ${VALID_TYPES.join(", ")}` }, 400);
    }

    const embedding = await embedModel.run(content, { mean_pool: true, normalize: true });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("memories")
      .insert({
        type,
        content,
        confidence: typeof confidence === "number" ? confidence : 0.8,
        source: source ?? "chatgpt",
        embedding,
      })
      .select("id, type, content, confidence, source, created_at")
      .single();
    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, memory: data });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
