import axios from "axios";
import type { GrantResult } from "./grantSearch.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export async function generateResponse(
  message: string,
  grants: GrantResult[]
): Promise<{ reply: string; refinement_options?: string[] }> {
  if (grants.length > 0) {
    const list = grants.slice(0, 5).map((g, i) => {
      const title = g.title || g.id.slice(0, 8) + "...";
      const provider = g.provider || "neznámy poskytovateľ";
      const deadline = g.deadline_at ? g.deadline_at.slice(0, 10) : "deadline neuvedený";
      return `${i+1}. ${title} (${provider}) - ${deadline}`;
    }).join("\n");
    
    const reply = `Našiel som ${grants.length} vhodných výziev pre vás:\n\n${list}\n\nChcete zobraziť detail niektorej z týchto výziev?`;
    
    const refinement_options = grants.length > 3 
      ? ["Zobraziť všetky výzvy", "Filtrovať podľa deadline", "Filtrovať podľa výšky podpory"]
      : undefined;
    
    return { reply, refinement_options };
  }
  
  try {
    const r = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: "llama3.2:3b",
        system: "Si slovenský grantový asistent. Pýtaj sa na sektor, región a typ projektu. Max 2-3 otázky.",
        prompt: message,
        stream: false,
      },
      { timeout: 20000 }
    );
    const reply = r.data?.response || "Nenašiel som žiadne výzvy. Skúste upresniť kritériá.";
    return { reply };
  } catch (e) {
    return { reply: "Prepáčte, momentálne mám problém s pripojením. Skúste neskôr." };
  }
}
