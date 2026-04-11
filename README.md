# ✦ Omni Copilot

> Your intelligent AI agent for Gmail, Google Drive, and Google Calendar.

---

## Project Structure

```
omni-copilot/
├── backend/          ← FastAPI + MCP + Google APIs
│   ├── main.py
│   ├── credentials.json
│   ├── token.json
│   └── venv/
│
└── frontend/         ← React (Vite) UI
    ├── src/
    │   ├── App.jsx
    │   └── components/
    │       ├── Sidebar.jsx
    │       ├── MessageList.jsx
    │       ├── ActionRenderer.jsx
    │       ├── ActionCards.jsx
    │       ├── ChatInput.jsx
    │       └── StatusPill.jsx
    └── package.json
```

---

## Running Locally

### 1 — Backend (FastAPI)

```bash
cd backend
source venv/bin/activate          # activate the virtual environment
uvicorn main:app --reload --port 8000
```

API will be available at: `http://localhost:8000`

### 2 — Frontend (React / Vite)

```bash
cd frontend
npm install                       # first time only
npm run dev
```

UI will be available at: `http://localhost:5173`

---

## Tech Stack

| Layer    | Technology                                    |
|----------|-----------------------------------------------|
| Backend  | Python · FastAPI · FastMCP · Google APIs       |
| Frontend | React 19 · Vite · Framer Motion · Lucide Icons |
| Comms    | Axios · REST (`POST /chat`)                    |
