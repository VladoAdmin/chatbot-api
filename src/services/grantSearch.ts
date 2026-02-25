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
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://kapgabgnezcurmgcrvif.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

  if (!SUPABASE_KEY) {
    console.error("[grantSearch] Missing SUPABASE_KEY");
    return [];
  }
  if (!OPENAI_API_KEY) {
    console.error("[grantSearch] Missing OPENAI_API_KEY");
    return [];
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const query = buildSearchQuery(context);

    const embeddingRes = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: "text-embedding-3-small", input: query },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 20000 }
    );

    const embedding = embeddingRes.data.data[0].embedding;

    const { data: chunks, error } = await supabase.rpc("match_call_chunks", {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 20,
    });

    if (error) {
      console.error("[grantSearch] RPC error", error);
      return [];
    }

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

    return results.slice(0, 10);
  } catch (e) {
    console.error("[grantSearch] error", e);
    return [];
  }
}
