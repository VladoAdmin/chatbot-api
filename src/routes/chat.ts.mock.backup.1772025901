import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const chatRouter = Router();

interface ChatRequest {
  message: string;
  sessionId?: string;
}

chatRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body as ChatRequest;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing or invalid message" });
      return;
    }

    console.log(`[CHAT] session=${sessionId || "anon"} msg="${message.slice(0, 80)}"`);

    // Mock response - will be replaced with Ollama/OpenAI integration
    const reply = `Mock response to: "${message.slice(0, 50)}"`;

    res.json({
      reply,
      sessionId: sessionId || randomUUID(),
      model: "mock",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CHAT] Error:", error);
    res.status(500).json({ error: "Chat processing failed" });
  }
});
