import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  let ollamaUp = false;

  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const resp = await fetch(`${ollamaUrl}/api/tags`);
    ollamaUp = resp.ok;
  } catch {
    ollamaUp = false;
  }

  res.json({
    status: "ok",
    ollama: ollamaUp,
    timestamp: new Date().toISOString(),
  });
});
