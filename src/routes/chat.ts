import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { extractContext, ExtractedContext } from "../services/contextExtractor.js";
import { searchGrants } from "../services/grantSearch.js";
import { generateResponse } from "../services/responseGenerator.js";

export const chatRouter = Router();

interface ChatRequest {
  message: string;
  sessionId?: string;
}

const sessions = new Map<string, ExtractedContext>();

chatRouter.post("/chat", async (req: Request, res: Response) => {
  const t0 = Date.now();

  try {
    const { message, sessionId } = req.body as ChatRequest;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing or invalid message" });
      return;
    }

    const sid = sessionId || randomUUID();

    const ctxNew = await extractContext(message);
    const ctxOld = sessions.get(sid) || {};
    const ctx: ExtractedContext = { ...ctxOld, ...ctxNew };
    sessions.set(sid, ctx);

    const grants = await searchGrants(ctx);

    const { reply, refinement_options } = await generateResponse(message, grants);

    res.json({
      reply,
      grants: grants.slice(0, 5),
      refinement_options,
      sessionId: sid,
      model: "llama3.2:3b + vector-search",
      ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[chat] error", e);
    res.status(500).json({ error: "Chat processing failed", details: e?.message || "unknown" });
  }
});
