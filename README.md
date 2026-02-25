# Chatbot API

Express.js API server for StormLevel chatbot. Runs on VPS, stormlevel.com is thin GUI.

## Setup

```bash
cd /chatbot-api
npm install
cp .env.example .env  # fill in values
```

## Scripts

- `npm run dev` — development with hot reload (tsx watch)
- `npm run build` — compile TypeScript to dist/
- `npm start` — run compiled JS (production)

## Endpoints

- `POST /api/chat` — send message, get reply
  - Body: `{ "message": "string", "sessionId?": "string" }`
  - Response: `{ "reply": "string", "sessionId": "string", "model": "string", "timestamp": "string" }`

- `GET /api/health` — health check
  - Response: `{ "status": "ok", "ollama": true/false, "timestamp": "string" }`

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3100) |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_KEY | Supabase anon/service key |
| OPENAI_API_KEY | OpenAI API key (fallback) |
| OLLAMA_URL | Ollama base URL (default: http://localhost:11434) |

## CORS

Allowed origins: stormlevel.com, localhost:5174
