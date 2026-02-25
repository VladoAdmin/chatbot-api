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
  // Rýchla heuristika pre bežné sektory
  const lower = message.toLowerCase();
  const context: ExtractedContext = {};
  
  if (lower.includes("poľnohospodár") || lower.includes("agro") || lower.includes("farm")) {
    context.sektor = "poľnohospodárstvo";
    context.keywords = ["poľnohospodárstvo", "agro"];
  }
  if (lower.includes("it ") || lower.includes("digital") || lower.includes("technol")) {
    context.sektor = "IT";
    context.keywords = ["digitalizácia", "IT"];
  }
  if (lower.includes("bratislava")) context.region = "Bratislavský";
  if (lower.includes("košice")) context.region = "Košický";
  if (lower.includes("žiarna")) context.region = "Žilinský";
  
  // Ak máme už základ, vrátime okamžite (bez Ollama)
  if (context.sektor || context.region) {
    console.log("[contextExtractor] Fast heuristic match:", context);
    return context;
  }
  
  // Inak použijeme Ollama ale s krátkym timeoutom
  try {
    const system = "Extract JSON with keys: sektor, region, typ_projektu, keywords. Use Slovak. Be brief.";
    const r = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      { model: "llama3.2:3b", system, prompt: message, stream: false },
      { timeout: 12000 }  // 8s max
    );
    const text = r.data?.response || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (e) {
    console.log("[contextExtractor] Ollama timeout, using empty context");
  }
  return {};
}
