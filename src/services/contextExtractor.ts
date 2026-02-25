import {
  type Message,
  type ExtractedContext,
  ExtractedContextSchema,
  EMPTY_CONTEXT,
} from "../types/chat.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

const SYSTEM_PROMPT = `Si asistent pre grantové poradenstvo. Analyzuj konverzáciu a extrahuj nasledovné údaje:
- sektor: odvetvie (IT, poľnohospodárstvo, výroba, služby, stavebníctvo, zdravotníctvo, vzdelávanie, ...)
- región: kraj alebo mesto na Slovensku
- veľkosť_firmy: mikro/malá/stredná/veľká
- typ_projektu: čo chce riešiť (digitalizácia, rozšírenie_výroby, vzdelávanie, inovácie, export, ...)

Vráť VÝHRADNE platný JSON objekt bez žiadneho iného textu:
{"sektor": "...", "región": "...", "veľkosť_firmy": "...", "typ_projektu": "...", "kontext_kompletný": true/false}

Pravidlá:
- Ak niečo nie je známe, použi null.
- kontext_kompletný je true len ak je známy aspoň sektor aj typ_projektu.
- Odpovedaj LEN JSON objektom, žiadny iný text.`;

/**
 * Calls Ollama API to extract context from conversation messages.
 */
async function callOllama(messages: Message[]): Promise<string> {
  const conversation = messages
    .map((m) => `${m.role === "user" ? "Používateľ" : "Asistent"}: ${m.content}`)
    .join("\n");

  const prompt = `Konverzácia:\n${conversation}\n\nExtrahuj kontext ako JSON:`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system: SYSTEM_PROMPT,
      stream: false,
      options: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response;
}

/**
 * Parses LLM response into ExtractedContext.
 * Returns null if parsing fails.
 */
function parseLLMResponse(raw: string): ExtractedContext | null {
  try {
    // Try to extract JSON from the response (LLM may wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const result = ExtractedContextSchema.safeParse(parsed);
    if (result.success) return result.data;

    // Try with relaxed parsing: coerce boolean
    const relaxed = {
      ...parsed,
      kontext_kompletný:
        parsed.kontext_kompletný === "true"
          ? true
          : parsed.kontext_kompletný === "false"
            ? false
            : Boolean(parsed.kontext_kompletný),
    };
    const retryResult = ExtractedContextSchema.safeParse(relaxed);
    return retryResult.success ? retryResult.data : null;
  } catch {
    return null;
  }
}

/**
 * Merges new context into previous context.
 * New non-null values overwrite, null values preserve previous.
 */
export function mergeContext(
  previous: ExtractedContext,
  update: ExtractedContext
): ExtractedContext {
  const merged: ExtractedContext = {
    sektor: update.sektor ?? previous.sektor,
    región: update.región ?? previous.región,
    veľkosť_firmy: update.veľkosť_firmy ?? previous.veľkosť_firmy,
    typ_projektu: update.typ_projektu ?? previous.typ_projektu,
    kontext_kompletný: false,
  };
  // Recalculate completeness
  merged.kontext_kompletný = merged.sektor !== null && merged.typ_projektu !== null;
  return merged;
}

/**
 * Main function: extracts context from conversation messages.
 * Accumulates with previous context (if provided).
 * Falls back to previous context on LLM/parsing errors.
 */
export async function extractContext(
  messages: Message[],
  previousContext: ExtractedContext = EMPTY_CONTEXT
): Promise<ExtractedContext> {
  try {
    const raw = await callOllama(messages);
    const extracted = parseLLMResponse(raw);

    if (!extracted) {
      console.warn("[contextExtractor] Failed to parse LLM response, keeping previous context");
      return previousContext;
    }

    return mergeContext(previousContext, extracted);
  } catch (error) {
    console.error("[contextExtractor] LLM call failed:", error);
    return previousContext;
  }
}
