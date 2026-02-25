import axios from "axios";
import type { GrantResult } from "./grantSearch.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export async function generateResponse(message: string, grants: GrantResult[]): Promise<{ reply: string; refinement_options?: string[] }> {
  const grantsText = grants
    .map(
      (g, i) =>
        `${i + 1}. ${g.title}\nProvider: ${g.provider || "unknown"}\nDeadline: ${g.deadline_at || ""}\nURL: ${g.call_url}`
    )
    .join("\n\n");

  const system =
    "You are a Slovak grant assistant. Be concise. If grants are provided, summarize top matches and suggest refinements. If none, ask for missing info (sector, region, project type).";

  const prompt =
    grants.length > 0
      ? `User message: ${message}\n\nMatching grants:\n${grantsText}\n\nWrite a short Slovak answer, then list 2-3 refinement options.`
      : `User message: ${message}\n\nNo matches found. Ask 2-3 clarifying questions in Slovak.`;

  try {
    const r = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: "llama3.2:3b",
        system,
        prompt,
        stream: false,
      },
      { timeout: 45000 }
    );

    const reply: string = r.data?.response || "Prepacte, nepodarilo sa vygenerovat odpoved.";
    const refinement_options = grants.length > 3 ? ["Upresnit sektor", "Upresnit region", "Upresnit typ projektu"] : undefined;
    return { reply, refinement_options };
  } catch (e) {
    console.error("[responseGenerator] error", e);
    return { reply: "Prepacte, nastala chyba pri generovani odpovede." };
  }
}
