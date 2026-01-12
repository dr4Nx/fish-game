# Fish Online

Fish Online is a real-time, browser-based multiplayer card game (Fish) with a FastAPI WebSocket backend and a React/Vite frontend.

Made with "help" from OpenAI Codex.

## Features
- Real-time WebSocket gameplay with lobby and room management
- Team-based play with bots (strategic-forgetful by default)
- Ask, claim, and disjoint mechanics
- Chat and history panels

## Tech Stack
- Backend: FastAPI + Uvicorn (WebSocket)
- Frontend: React + Vite + TypeScript

## Requirements
- Python 3.13
- Node.js (LTS recommended)

## Setup

### Backend
```bash
pip install -r server/requirements.txt
uvicorn server.app.main:app --reload --port 8000
```

### Frontend
```bash
cd client
npm install
npm run dev
```

The frontend expects `VITE_WS_URL` to be set (see `client/.env`):
```
VITE_WS_URL=ws://127.0.0.1:8000/ws
```

## Environment Variables
- `VITE_WS_URL` (frontend): WebSocket endpoint
- `BOT_DEFAULT` (backend): `strategic_forgetful|strategic_bot|memory_bot|random_bot` (default: `strategic_forgetful`)

## Rules
Rules can be found on the rules page on the website.
