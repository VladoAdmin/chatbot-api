import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3100", 10);

// CORS
app.use(
  cors({
    origin: [
      "https://stormlevel.com",
      "https://www.stormlevel.com",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/api", chatRouter);
app.use("/api", healthRouter);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${new Date().toISOString()}`, err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[chatbot-api] Running on port ${PORT}`);
});

export default app;
