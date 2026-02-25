import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import type { ExtractedContext } from "./contextExtractor.js";

export interface GrantResult {
  id: string;
  title: string;
  deadline_at: string | null;
  total_allocation: number | null;
  provider: string | null;
  call_url: string;
  similarity: number;
}

function buildSearchQuery(context: ExtractedContext): string {
  const parts: string[] = [];
  if (context.typ_projektu) parts.push(context.typ_projektu);
  if (context.sektor) parts.push(context.sektor);
  if (context.region) parts.push(context.region);
  if (context.keywords?.length) parts.push(...context.keywords);
  return parts.join(" ") || "grant podpora financovanie";
}

export async function searchGrants(context: ExtractedContext): Promise<GrantResult[]> {
  const SUPABASE_URL = process.env.SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

  console.log("[grantSearch] Starting with context:", JSON.stringify(context));
  console.log("[grantSearch] SUPABASE_URL length:", SUPABASE_URL.length);
  console.log("[grantSearch] SUPABASE_KEY length:", SUPABASE_KEY.length);
  console.log("[grantSearch] OPENAI_API_KEY length:", OPENAI_API_KEY.length);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("[grantSearch] Missing Supabase credentials");
    return [];
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const query = buildSearchQuery(context);
    console.log("[grantSearch] Query:", query);

    console.log("[grantSearch] Calling OpenAI embeddings...");
    const embeddingRes = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: "text-embedding-3-small", input: query },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 15000 }
    );
    console.log("[grantSearch] OpenAI OK");

    const embedding = embeddingRes.data.data[0].embedding;

    console.log("[grantSearch] Calling Supabase RPC...");
    const { data: chunks, error } = await supabase.rpc("match_call_chunks", {
      query_embedding: embedding,
      match_threshold: 0.4,  // Znížené z 0.5
      match_count: 20,
    });

    if (error) {
      console.error("[grantSearch] RPC error:", error);
      return [];
    }
    console.log("[grantSearch] Found chunks:", chunks?.length || 0);

    const nowIso = new Date().toISOString();
    const seen = new Set<string>();
    const results: GrantResult[] = [];

    for (const chunk of chunks || []) {
      if (chunk.deadline_at && chunk.deadline_at < nowIso) continue;
      if (seen.has(chunk.call_id)) continue;
      seen.add(chunk.call_id);
      results.push({
        id: chunk.call_id,
        title: chunk.title,
        deadline_at: chunk.deadline_at,
        total_allocation: chunk.total_allocation,
        provider: chunk.provider,
        call_url: chunk.call_url,
        similarity: chunk.similarity,
      });
    }

    console.log("[grantSearch] Returning results:", results.length);
    return results.slice(0, 10);
  } catch (e: any) {
    console.error("[grantSearch] Error:", e.message);
    return [];
  }
}
