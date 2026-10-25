// Shared helpers for mybuddy Edge Functions (Deno runtime).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Simple shared-secret auth so the Custom GPT Action can call us.
// Set MYBUDDY_API_KEY as a function secret; the GPT sends it as the `x-api-key` header.
export function requireApiKey(req: Request): void {
  const expected = Deno.env.get("MYBUDDY_API_KEY");
  const got = req.headers.get("x-api-key") ?? "";
  if (!expected || got !== expected) {
    throw new HttpError(401, "Invalid or missing API key");
  }
}

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
export function getClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Embed text with Supabase's built-in gte-small model.
// Free, runs inside the Edge Function, no API key, 384-dim output.
//
// To use OpenAI instead (higher quality, needs OPENAI_API_KEY + billing): replace the
// body with a fetch to https://api.openai.com/v1/embeddings using
// model "text-embedding-3-small", and change vector(384) -> vector(1536) in schema.sql.
// deno-lint-ignore no-explicit-any
declare const Supabase: any;
const embedModel = new Supabase.ai.Session("gte-small");

export async function embed(text: string): Promise<number[]> {
  // mean_pool + normalize give a single unit vector suitable for cosine search.
  const embedding = await embedModel.run(text, { mean_pool: true, normalize: true });
  return embedding as number[];
}

export function errorResponse(e: unknown): Response {
  const status = e instanceof HttpError ? e.status : 500;
  return json({ ok: false, error: (e as Error).message }, status);
}
