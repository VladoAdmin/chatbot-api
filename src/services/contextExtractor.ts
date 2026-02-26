
export interface ExtractedContext {
  sektor?: string;
  region?: string;
  typ_projektu?: string;
  velkost_firmy?: string;
  applicant_type?: string; // "sukromna_firma", "statna_institucia", "obec", "neziskovka"
  zameranie?: string; // čo chcú financovať
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
  
  // Extrakcia typu žiadateľa
  if (lower.includes("firma") || lower.includes("podnik") || lower.includes("spoločnosť") || lower.includes("s.r.o.") || lower.includes("sro")) {
    context.applicant_type = "sukromna_firma";
  }
  if (lower.includes("obec") || lower.includes("mesto") || lower.includes("samospráva")) {
    context.applicant_type = "obec";
  }
  if (lower.includes("štát") || lower.includes("ministerstvo") || lower.includes("urad")) {
    context.applicant_type = "statna_institucia";
  }
  if (lower.includes("združenie") || lower.includes("neziskovka") || lower.includes("organizacia")) {
    context.applicant_type = "neziskovka";
  }
  
  // Extrakcia zamerania - čo chcú financovať
  if (lower.includes("rozšírenie výroby") || lower.includes("vyrobu")) {
    context.zameranie = "rozšírenie výroby";
    context.keywords = [...(context.keywords || []), "rozšírenie výroby", "technológia"];
  }
  if (lower.includes("kyber") || lower.includes("bezpečnosť") || lower.includes("it")) {
    context.zameranie = "kybernetická bezpečnosť";
    context.keywords = [...(context.keywords || []), "kybernetická bezpečnosť", "IT", "hardware", "software"];
  }
  if (lower.includes("poradenstvo") || lower.includes("vzdelanie") || lower.includes("školenie")) {
    context.zameranie = "poradenstvo/vzdelávanie";
    context.keywords = [...(context.keywords || []), "poradenstvo", "vzdelávanie"];
  }
  if (lower.includes("výskum") || lower.includes("vývoj") || lower.includes("inovácie")) {
    context.zameranie = "výskum a vývoj";
    context.keywords = [...(context.keywords || []), "výskum", "vývoj", "inovácie"];
  }
  
  // Ak máme už základ, vrátime okamžite (bez Ollama)
  if (context.sektor || context.region) {
    console.log("[contextExtractor] Fast heuristic match:", context);
    return context;
  }
  
  // Pre performance (ciel < 5s) nepouzivame LLM extrakciu v request path.
  // Ak heuristika nic nenasla, vratime prazdny kontext a vyhladavanie pouzije priamo user query.
  return {};
}
