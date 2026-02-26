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

function buildSearchQuery(context: ExtractedContext, rawMessage?: string): string {
  // Priority: use raw message as base (it contains user's actual intent)
  const cleaned = (rawMessage || "").trim().slice(0, 300);
  if (cleaned.length > 0 && !cleaned.match(/^\s*$/)) {
    return cleaned;
  }
  // fallback to extracted context
  const parts: string[] = [];
  if (context.typ_projektu) parts.push(context.typ_projektu);
  if (context.sektor) parts.push(context.sektor);
  if (context.region) parts.push(context.region);
  if (context.keywords?.length) parts.push(...context.keywords);
  if (parts.length) return parts.join(" ");
  return "grant podpora financovanie";
}

type CacheEntry<T> = { value: T; ts: number };

const EMBEDDING_CACHE = new Map<string, CacheEntry<number[]>>();
const RESULTS_CACHE = new Map<string, CacheEntry<GrantResult[]>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getFresh<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    m.delete(key);
    return null;
  }
  return e.value;
}

export async function searchGrants(context: ExtractedContext, rawMessage?: string): Promise<GrantResult[]> {
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
    const query = buildSearchQuery(context, rawMessage);
    console.log("[grantSearch] Query:", query);

    const cachedResults = getFresh(RESULTS_CACHE, query);
    if (cachedResults) {
      console.log("[grantSearch] Cache hit (results)");
      return cachedResults;
    }

    let embedding: number[] | null = getFresh(EMBEDDING_CACHE, query);
    if (!embedding) {
      console.log("[grantSearch] Calling OpenAI embeddings...");
      const embeddingRes = await axios.post(
        "https://api.openai.com/v1/embeddings",
        { model: "text-embedding-3-small", input: query },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 8000 }
      );
      console.log("[grantSearch] OpenAI OK");
      const emb: number[] = embeddingRes.data.data[0].embedding;
      embedding = emb;
      EMBEDDING_CACHE.set(query, { value: emb, ts: Date.now() });
    } else {
      console.log("[grantSearch] Cache hit (embedding)");
    }

    if (!embedding) {
      console.error("[grantSearch] Missing embedding (unexpected)");
      return [];
    }

    console.log("[grantSearch] Calling Supabase RPC...");
    const { data: chunks, error } = await supabase.rpc("match_call_chunks", {
      query_embedding: embedding as number[],
      match_threshold: 0.4,
      match_count: 12,
    });

    if (error) {
      console.error("[grantSearch] RPC error:", error);
      return [];
    }
    console.log("[grantSearch] Found chunks:", chunks?.length || 0);

    if (!chunks || chunks.length === 0) {
      return [];
    }

    // Get unique call_ids from chunks
    const callIds = [...new Set(chunks.map((c: any) => c.call_id))];
    console.log("[grantSearch] Unique call_ids:", callIds.length);

    // Fetch grant details from grant_calls_v2
    const { data: grants, error: grantsError } = await supabase
      .from("grant_calls_v2")
      .select("id, title, provider, deadline_at, total_allocation, call_url, status, eligible_applicants")
      .in("id", callIds)
      .in("status", ["otvorená", "Otvorená"]);

    if (grantsError) {
      console.error("[grantSearch] Error fetching grants:", grantsError);
      return [];
    }

    console.log("[grantSearch] Fetched grants:", grants?.length || 0);

    // Create lookup map
    const grantMap = new Map(grants?.map((g: any) => [g.id, g]) || []);

    const nowIso = new Date().toISOString();
    const seen = new Set<string>();
    let results: GrantResult[] = [];

    for (const chunk of chunks) {
      if (seen.has(chunk.call_id)) continue;
      seen.add(chunk.call_id);

      const grant = grantMap.get(chunk.call_id);
      if (!grant) {
        console.log("[grantSearch] Grant not found for call_id:", chunk.call_id);
        continue;
      }

      // Skip if deadline passed
      if (grant.deadline_at && grant.deadline_at < nowIso) continue;
      // Skip non-open calls (extra guard)
      if (grant.status && !["otvorená", "Otvorená"].includes(grant.status)) continue;

      results.push({
        id: chunk.call_id,
        title: grant.title || "Neznáma výzva",
        deadline_at: grant.deadline_at,
        total_allocation: grant.total_allocation,
        provider: grant.provider || "Neznámy poskytovateľ",
        call_url: grant.call_url || "#",
        similarity: chunk.similarity,
      });
    }

    // Fetch geographic attributes for region filtering
    let geoMap = new Map<string, string>();
    console.log("[grantSearch] Checking region filter:", context.region, "results:", results.length);
    if (context.region && results.length > 0) {
      const resultIds = results.map(r => r.id);
      const { data: geoAttrs, error: geoError } = await supabase
        .from("grant_call_attributes")
        .select("grant_call_id, value")
        .eq("key", "Miesto realizácie")
        .in("grant_call_id", resultIds);
      
      if (geoError) {
        console.error("[grantSearch] Error fetching geo attrs:", geoError);
      } else {
        geoAttrs?.forEach((g: any) => geoMap.set(g.grant_call_id, g.value));
        console.log("[grantSearch] Fetched geo attrs:", geoAttrs?.length || 0);
        console.log("[grantSearch] Geo values:", JSON.stringify(geoAttrs?.map((g: any) => ({ id: g.grant_call_id.slice(0, 8), val: g.value.slice(0, 50) }))));
      }
    }

    // Filter by region if specified
    if (context.region && results.length > 0) {
      const regionLower = context.region.toLowerCase();
      const regionResults = results.filter(r => {
        const geo = geoMap.get(r.id);
        if (!geo) return true; // No geo restriction = open to all
        const geoLower = geo.toLowerCase();
        
        // Explicit exclusion patterns
        if (geoLower.includes("okrem") && geoLower.includes(regionLower)) {
          return false; // Explicitly excluded
        }
        
        // Inclusion patterns
        if (geoLower.includes("celé sr") || geoLower.includes("územie sr")) {
          return true; // Whole Slovakia
        }
        if (geoLower.includes(regionLower)) {
          return true; // Region explicitly mentioned
        }
        
        return true; // Default include if unclear
      });
      
      // If region filter produces results, use them; otherwise warn but keep all
      if (regionResults.length > 0) {
        results = regionResults;
      } else {
        console.log("[grantSearch] Warning: Region filter excluded all results, showing all");
      }
    }

    // Filter by applicant type if specified
    if (context.applicant_type && results.length > 0) {
      const eligibleResults = results.filter(r => {
        const grant = grantMap.get(r.id);
        if (!grant?.eligible_applicants) return true; // null = open to all
        const eligible = grant.eligible_applicants.toLowerCase();
        
        switch (context.applicant_type) {
          case "sukromna_firma":
            return eligible.includes("spoločnosť") || eligible.includes("firma") || 
                   eligible.includes("podnik") || eligible.includes("s.r.o.");
          case "obec":
            return eligible.includes("obec") || eligible.includes("mesto") || 
                   eligible.includes("samospráva") || eligible.includes("kraj");
          case "statna_institucia":
            return eligible.includes("rozpočtová") || eligible.includes("príspevková") || 
                   eligible.includes("štát") || eligible.includes("ministerstvo");
          case "neziskovka":
            return eligible.includes("nezisková") || eligible.includes("združenie") || 
                   eligible.includes("nadácia") || eligible.includes("organizácia");
          default:
            return true;
        }
      });
      
      // If we have eligible results, use them; otherwise keep all (fallback)
      if (eligibleResults.length > 0) {
        results = eligibleResults;
      }
    }
    
    // Boost grants matching zameranie in title
    if (context.zameranie) {
      const zameranieLower = context.zameranie.toLowerCase();
      results.sort((a, b) => {
        const aMatch = a.title.toLowerCase().includes(zameranieLower) ? 1 : 0;
        const bMatch = b.title.toLowerCase().includes(zameranieLower) ? 1 : 0;
        // If both match or both don't, sort by similarity
        if (aMatch === bMatch) return b.similarity - a.similarity;
        // Boost title matches
        return bMatch - aMatch;
      });
    } else {
      // Sort by similarity only
      results.sort((a, b) => b.similarity - a.similarity);
    }

    // Fallback: title search for calls without chunks (covers fresh/partial ingests)
    if (rawMessage) {
      const tokens = rawMessage
        .toLowerCase()
        .replace(/[^\p{L}0-9\s]/gu, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .slice(0, 2);

      if (tokens.length > 0) {
        const orFilter = tokens.map((t) => `title.ilike.%${t}%`).join(",");
        const { data: titleHits, error: titleErr } = await supabase
          .from("grant_calls_v2")
          .select("id, title, provider, deadline_at, total_allocation, call_url, status, eligible_applicants")
          .in("status", ["otvorená", "Otvorená"])
          .or(orFilter)
          .limit(10);

        if (titleErr) {
          console.error("[grantSearch] Title search error:", titleErr);
        } else if (titleHits && titleHits.length > 0) {
          for (const g of titleHits) {
            if (seen.has(g.id)) continue;
            seen.add(g.id);
            results.push({
              id: g.id,
              title: g.title || "Neznáma výzva",
              deadline_at: g.deadline_at,
              total_allocation: g.total_allocation,
              provider: g.provider || "Neznámy poskytovateľ",
              call_url: g.call_url || "#",
              similarity: 0,
            });
          }
        }
      }
    }

    const finalResults = results.slice(0, 10);
    console.log("[grantSearch] Returning results:", finalResults.length);
    RESULTS_CACHE.set(query, { value: finalResults, ts: Date.now() });
    return finalResults;
  } catch (e: any) {
    console.error("[grantSearch] Error:", e.message);
    return [];
  }
}
