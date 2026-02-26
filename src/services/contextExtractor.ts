
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
  if (lower.includes("it ") || lower.includes("it-bezpe") || lower.includes("kyber") || lower.includes("cyber") || lower.includes("digital") || lower.includes("technol")) {
    context.sektor = "IT";
    context.keywords = ["IT", "kybernetická bezpečnosť", "digitalizácia"];
  }
  if (lower.includes("zatepl") || lower.includes("energetick") || lower.includes("tepel") || lower.includes("obnov") || lower.includes("dom")) {
    context.typ_projektu = "energetická efektívnosť";
    context.keywords = [...(context.keywords || []), "zateplenie", "úspory energie"];
  }
  if (lower.includes("bratislava")) context.region = "Bratislavský";
  if (lower.includes("košice")) context.region = "Košický";
  if (lower.includes("žilina") || lower.includes("žilinsk")) context.region = "Žilinský";
  
  // Ak máme už základ, vrátime okamžite (bez Ollama)
  if (context.sektor || context.region) {
    console.log("[contextExtractor] Fast heuristic match:", context);
    return context;
  }
  
  // Pre performance (ciel < 5s) nepouzivame LLM extrakciu v request path.
  // Ak heuristika nic nenasla, vratime prazdny kontext a vyhladavanie pouzije priamo user query.
  return {};
}
