import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export interface ExtractedContext {
  sektor?: string;
  region?: string;
  typ_projektu?: string;
  velkost_firmy?: string;
  keywords?: string[];
}

export async function extractContext(message: string): Promise<ExtractedContext> {
  const system =
    "Extract context from a Slovak grant-seeking message. Reply ONLY valid JSON with keys: sektor, region, typ_projektu, velkost_firmy, keywords (array). Use null for unknown.";

  try {
    const r = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: "llama3.2:3b",
        system,
        prompt: message,
        stream: false,
      },
      { timeout: 15000 }
    );

    const text: string = r.data?.response || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return {};
    try {
      return JSON.parse(m[0]);
    } catch {
      return {};
    }
  } catch (e) {
    console.error("[contextExtractor] error", e);
    return {};
  }
}
