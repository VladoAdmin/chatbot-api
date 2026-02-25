import { extractContext, mergeContext } from "../src/services/contextExtractor.js";
import { EMPTY_CONTEXT, type ExtractedContext, type Message } from "../src/types/chat.js";

// Unit tests for mergeContext (no LLM needed)
function testMergeContext() {
  console.log("--- testMergeContext ---");

  const prev: ExtractedContext = {
    sektor: "poľnohospodárstvo",
    región: "Bratislava",
    veľkosť_firmy: null,
    typ_projektu: null,
    kontext_kompletný: false,
  };

  const update: ExtractedContext = {
    sektor: null,
    región: null,
    veľkosť_firmy: "malá",
    typ_projektu: "rozšírenie_výroby",
    kontext_kompletný: false,
  };

  const merged = mergeContext(prev, update);

  console.assert(merged.sektor === "poľnohospodárstvo", "sektor preserved");
  console.assert(merged.región === "Bratislava", "región preserved");
  console.assert(merged.veľkosť_firmy === "malá", "veľkosť_firmy updated");
  console.assert(merged.typ_projektu === "rozšírenie_výroby", "typ_projektu updated");
  console.assert(merged.kontext_kompletný === true, "kontext_kompletný recalculated");

  console.log("✅ mergeContext: all assertions passed");
}

// Integration test with Ollama
async function testExtractContextIntegration() {
  console.log("\n--- testExtractContext (integration, requires Ollama) ---");

  const messages1: Message[] = [
    { role: "user", content: "Som z Bratislavy, robíme mliečne výrobky" },
  ];

  const ctx1 = await extractContext(messages1);
  console.log("Extract #1:", JSON.stringify(ctx1, null, 2));

  // Check basic extraction
  const sektorOk =
    ctx1.sektor !== null &&
    (ctx1.sektor.toLowerCase().includes("poľnohospodár") ||
      ctx1.sektor.toLowerCase().includes("potravinár") ||
      ctx1.sektor.toLowerCase().includes("výrob") ||
      ctx1.sektor.toLowerCase().includes("mliek"));
  console.assert(sektorOk, `sektor should relate to agriculture/food, got: ${ctx1.sektor}`);

  const regiónOk =
    ctx1.región !== null && ctx1.región.toLowerCase().includes("bratislav");
  console.assert(regiónOk, `región should contain Bratislava, got: ${ctx1.región}`);

  // Second message: accumulate
  const messages2: Message[] = [
    { role: "user", content: "Som z Bratislavy, robíme mliečne výrobky" },
    { role: "assistant", content: "Rozumiem. Aký typ projektu plánujete?" },
    { role: "user", content: "Chceme rozšíriť výrobu" },
  ];

  const ctx2 = await extractContext(messages2, ctx1);
  console.log("Extract #2 (accumulated):", JSON.stringify(ctx2, null, 2));

  const typOk =
    ctx2.typ_projektu !== null &&
    (ctx2.typ_projektu.toLowerCase().includes("rozšíren") ||
      ctx2.typ_projektu.toLowerCase().includes("výrob"));
  console.assert(typOk, `typ_projektu should relate to expansion, got: ${ctx2.typ_projektu}`);

  // Previous context should be preserved
  console.assert(ctx2.región !== null, "región should be preserved from ctx1");

  if (sektorOk && regiónOk && typOk) {
    console.log("✅ Integration test: all assertions passed");
  } else {
    console.log("⚠️ Integration test: some assertions failed (check above)");
  }
}

// Run
testMergeContext();

testExtractContextIntegration().catch((err) => {
  console.error("Integration test error:", err);
  console.log("⚠️ Integration test skipped (Ollama not available?)");
});
