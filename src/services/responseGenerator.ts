import axios from "axios";
import type { GrantResult } from "./grantSearch.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export async function generateResponse(
  message: string,
  grants: GrantResult[]
): Promise<{ reply: string; refinement_options?: string[] }> {
  // Ak máme granty, vygenerujeme rýchlu odpoveď bez Ollama
  if (grants.length > 0) {
    const list = grants.slice(0, 3).map((g, i) => 
      `${i+1}. ${g.title} (${g.provider || "neznámy"}) - ${g.deadline_at ? "do " + g.deadline_at.slice(0,10) : "deadline neuvedený"}`
    ).join("\n");
    
    const reply = `Našiel som ${grants.length} vhodných výziev:\n\n${list}\n\nChcete viac detailov o niektorej z nich?`;
    
    const refinement_options = grants.length > 3 
      ? ["Zobraziť všetky výzvy", "Filtrovať podľa deadline", "Filtrovať podľa alokácie"]
      : undefined;
    
    return { reply, refinement_options };
  }
  
  // Ak nemáme granty, skúsime krátke Ollama pre otázky
  try {
    const r = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: "llama3.2:3b",
        system: "Si slovenský grantový asistent. Pýtaj sa na chýbajúce info (sektor, región, typ projektu). Max 2-3 otázky. Buď stručný.",
        prompt: message,
        stream: false,
      },
      { timeout: 20000 }  // 15s max
    );
    const reply = r.data?.response || "Prepáčte, nenašiel som žiadne výzvy. Skúste upresniť vaše kritériá.";
    return { reply };
  } catch (e) {
    return { 
      reply: "Momentálne mám problém s pripojením. Skúste prosím neskôr, alebo kontaktujte podporu."
    };
  }
}
