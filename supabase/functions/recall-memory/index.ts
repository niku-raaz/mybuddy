// POST /recall-memory — semantic search over stored memories.
import {
  corsHeaders,
  embed,
  errorResponse,
  getClient,
  HttpError,
  json,
  requireApiKey,
} from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    requireApiKey(req);
    if (req.method !== "POST") throw new HttpError(405, "Use POST");

    const { query, limit, type } = await req.json();

    if (!query || typeof query !== "string") {
      throw new HttpError(400, "`query` (string) is required");
    }

    const embedding = await embed(query);
    const supabase = getClient();

    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_count: Math.min(typeof limit === "number" ? limit : 8, 25),
      filter_type: type ?? null,
    });

    if (error) throw new HttpError(500, error.message);

    return json({ ok: true, memories: data });
  } catch (e) {
    return errorResponse(e);
  }
});
