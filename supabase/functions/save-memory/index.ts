// POST /save-memory — embed a durable fact and store it in Supabase.
import {
  corsHeaders,
  embed,
  errorResponse,
  getClient,
  HttpError,
  json,
  requireApiKey,
} from "../_shared/util.ts";

const VALID_TYPES = ["fact", "preference", "goal", "event", "project"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    requireApiKey(req);
    if (req.method !== "POST") throw new HttpError(405, "Use POST");

    const { type, content, confidence, source } = await req.json();

    if (!content || typeof content !== "string") {
      throw new HttpError(400, "`content` (string) is required");
    }
    if (!VALID_TYPES.includes(type)) {
      throw new HttpError(400, `\`type\` must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const embedding = await embed(content);
    const supabase = getClient();

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

    if (error) throw new HttpError(500, error.message);

    return json({ ok: true, memory: data });
  } catch (e) {
    return errorResponse(e);
  }
});
