
export interface ExtractedContext {
  sektor?: string;
  region?: string;
  typ_projektu?: string;
  velkost_firmy?: string;
  applicant_type?: string; // "sukromna_firma", "statna_institucia", "obec", "neziskovka"
  zameranie?: string; // čo chcú financovať
  keywords?: string[];
  // Flags indicating which dimensions were explicitly specified
  has_applicant?: boolean;
  has_zameranie?: boolean;
  has_sektor?: boolean;
  has_region?: boolean;
}

export async function extractContext(message: string): Promise<ExtractedContext> {
  // Rýchla heuristika pre bežné sektory
  const lower = message.toLowerCase();
  const context: ExtractedContext = {};
  
  if (lower.includes("poľnohospodár") || lower.includes("agro") || lower.includes("farm")) {
    context.sektor = "poľnohospodárstvo";
    context.has_sektor = true;
    context.keywords = ["poľnohospodárstvo", "agro"];
  }
  if (lower.includes("it ") || lower.includes("it-bezpe") || lower.includes("kyber") || lower.includes("cyber") || lower.includes("digital") || lower.includes("technol")) {
    context.sektor = "IT";
    context.has_sektor = true;
    context.keywords = ["IT", "kybernetická bezpečnosť", "digitalizácia"];
  }
  if (lower.includes("zatepl") || lower.includes("energetick") || lower.includes("tepel") || lower.includes("obnov") || lower.includes("dom")) {
    context.typ_projektu = "energetická efektívnosť";
    context.has_sektor = true;
    context.keywords = [...(context.keywords || []), "zateplenie", "úspory energie"];
  }
  // Extrakcia regiónu
  if (lower.includes("bratislava")) { context.region = "Bratislavský"; context.has_region = true; }
  if (lower.includes("košice")) { context.region = "Košický"; context.has_region = true; }
  if (lower.includes("žilina") || lower.includes("žilinsk")) { context.region = "Žilinský"; context.has_region = true; }
  if (lower.includes("trnava") || lower.includes("trnavsk")) { context.region = "Trnavský"; context.has_region = true; }
  if (lower.includes("trenčín") || lower.includes("trenčiansk")) { context.region = "Trenčiansky"; context.has_region = true; }
  if (lower.includes("nitra") || lower.includes("nitriansk")) { context.region = "Nitriansky"; context.has_region = true; }
  if (lower.includes("banská bystrica") || lower.includes("banskobystrick")) { context.region = "Banskobystrický"; context.has_region = true; }
  if (lower.includes("prešov") || lower.includes("prešovsk")) { context.region = "Prešovský"; context.has_region = true; }
  
  // Extrakcia typu žiadateľa
  if (lower.includes("firma") || lower.includes("podnik") || lower.includes("spoločnosť") || lower.includes("s.r.o.") || lower.includes("sro") || lower.includes("business")) {
    context.applicant_type = "sukromna_firma";
    context.has_applicant = true;
  }
  if (lower.includes("obec") || lower.includes("mesto") || lower.includes("samospráva")) {
    context.applicant_type = "obec";
    context.has_applicant = true;
  }
  if (lower.includes("štát") || lower.includes("ministerstvo") || lower.includes("urad")) {
    context.applicant_type = "statna_institucia";
    context.has_applicant = true;
  }
  if (lower.includes("združenie") || lower.includes("neziskovka") || lower.includes("organizacia")) {
    context.applicant_type = "neziskovka";
    context.has_applicant = true;
  }

  // Extrakcia zamerania - čo chcú financovať
  if (lower.includes("rozšírenie výroby") || lower.includes("vyrobu")) {
    context.zameranie = "rozšírenie výroby";
    context.has_zameranie = true;
    context.keywords = [...(context.keywords || []), "rozšírenie výroby", "technológia"];
  }
  if (lower.includes("kyber") || lower.includes("bezpečnosť") || lower.includes("it")) {
    context.zameranie = "kybernetická bezpečnosť";
    context.has_zameranie = true;
    context.keywords = [...(context.keywords || []), "kybernetická bezpečnosť", "IT", "hardware", "software"];
  }
  if (lower.includes("poradenstvo") || lower.includes("vzdelanie") || lower.includes("školenie")) {
    context.zameranie = "poradenstvo/vzdelávanie";
    context.has_zameranie = true;
    context.keywords = [...(context.keywords || []), "poradenstvo", "vzdelávanie"];
  }
  if (lower.includes("výskum") || lower.includes("vývoj") || lower.includes("inovácie")) {
    context.zameranie = "výskum a vývoj";
    context.has_zameranie = true;
    context.keywords = [...(context.keywords || []), "výskum", "vývoj", "inovácie"];
  }
  // Generic zameranie detection from verbs/action words
  if (lower.includes("chceme") || lower.includes("potrebujeme") || lower.includes("hľadáme")) {
    // User mentioned what they want/need/are looking for - likely has zameranie
    context.has_zameranie = context.has_zameranie || context.zameranie !== undefined;
  }
  
  // Ak máme už základ (ktorýkoľvek z dimenzií), vrátime okamžite (bez Ollama)
  if (context.sektor || context.region || context.applicant_type || context.zameranie) {
    console.log("[contextExtractor] Fast heuristic match:", context);
    return context;
  }
  
  // Pre performance (ciel < 5s) nepouzivame LLM extrakciu v request path.
  // Ak heuristika nic nenasla, vratime prazdny kontext a vyhladavanie pouzije priamo user query.
  return {};
}
