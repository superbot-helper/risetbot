# RisetBot — Agentic AI Survey Processor

> **Automated government survey data processing powered by a multi-agent AI pipeline.**

RisetBot transforms raw PDF survey files into structured data, statistical analysis, and formal government-style reports — all with minimal human effort. Built for Indonesian public-sector survey workflows, it combines document intelligence, schema-guided extraction, and conversational AI into a single collaborative platform.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
  - [Multi-Agent Pipeline](#multi-agent-pipeline)
  - [Human-in-the-Loop Checkpoints](#human-in-the-loop-checkpoints)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Running in Development](#running-in-development)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Dashboard](#dashboard)
  - [Projects](#projects)
  - [Schemas](#schemas)
  - [Knowledge (Survey Files)](#knowledge-survey-files)
  - [Reports](#reports)
  - [Templates](#templates)
  - [Chat](#chat)
- [Real-Time Streaming (SSE)](#real-time-streaming-sse)
- [Database Schema](#database-schema)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Government agencies routinely process hundreds of survey forms (paper-based PDFs) manually — a slow, error-prone, and costly process. RisetBot automates this entire lifecycle:

1. **Upload** PDF survey files to a project workspace.
2. **Extract** structured data automatically using a user-defined schema and LLM-powered OCR agent.
3. **Compile & Analyze** — cleaning, normalization, descriptive statistics, sentiment detection, and thematic clustering.
4. **Report** — generate formal reports in Indonesian government style, ready for download.
5. **Chat** — ask natural-language questions against the processed survey data.

---

## Key Features

| Feature | Description |
|---|---|
| **Multi-Agent Pipeline** | Specialized AI agents (Extractor → Compiler → Analyst → Reporter → ChatBot) orchestrated seamlessly |
| **Schema-Guided Extraction** | User-defined column schemas with name, data type, and AI guidance hints for precise extraction |
| **AI Schema Auto-Generate** | LLM suggests a starter schema from a project description in one click |
| **PDF Upload & Processing** | Base64 upload with async background processing; per-file status tracking (OCR via PaddleOCR in Python Service) |
| **Human-in-the-Loop** | Explicit checkpoints where users confirm, edit, or reject AI output before it is committed |
| **CSV Export** | Aggregate all confirmed extracted rows across files into a spreadsheet download |
| **AI Analysis Reports** | Narrative analysis reports with statistics, sentiment, and themes |
| **Conversational Chat** | Project-scoped chat with streaming token-by-token responses, citing source survey files |
| **Dark / Light Mode** | Persistent theme toggle with system preference detection |
| **Activity Audit Log** | Every operation is logged to a persistent activity table |

---

## Architecture

RisetBot operates on a decoupled **3-Service Architecture**:

1. **Frontend**: React SPA handling the user interface and state.
2. **Backend**: Node.js API orchestrating database operations, routing, and OpenAI agent interactions.
3. **Python Service**: Dedicated FastAPI service processing heavy workloads like PaddleOCR, Pandas analysis, and Jinja2 DOCX generation (Phase 3).

### Multi-Agent Pipeline

```
PDF Upload
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Extractor   │───▶│  Compiler    │───▶│  Analyst     │───▶│  Reporter    │
│              │    │              │    │              │    │              │
│ Schema-guided│    │ Cleaning &   │    │ Statistics,  │    │ Govt-style   │
│ PDF → JSON   │    │ Normalization│    │ Sentiment,   │    │ Report       │
│ extraction   │    │ & Dedup      │    │ Themes       │    │ Generation   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
                                                            ┌──────────────┐
                                                            │   ChatBot    │
                                                            │              │
                                                            │ Natural lang │
                                                            │ Q&A on data  │
                                                            └──────────────┘
```

All agents utilize standard LLM models configured via `.env`.

### Human-in-the-Loop Checkpoints

| # | Trigger | User Action |
|---|---|---|
| **1** | After extraction completes | Inspect extracted rows, edit individual cells, then confirm or reject |
| **2** | Before report is finalized | Preview AI-generated report, then confirm or discard |
| **3** | Before any deletion | Confirmation dialog prevents accidental data loss |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS v4, Framer Motion, TanStack Query |
| **Backend API** | Node.js 24, Express 5, TypeScript 5.9 |
| **Database** | PostgreSQL (Raw Queries via `pg` pool) |
| **Security/Validation**| Zod |
| **AI / LLM** | OpenAI SDK (`gpt-4o-mini` default), PraisonAI/PraisonJS multi-agent orchestration |
| **Python Service** | Python 3.11+, FastAPI, PaddleOCR, Pandas, python-docx-template |
| **Logging** | Pino + pino-http + Langfuse-ready observability |

---

## Project Structure

```text
risetbot/
├── backend/                  # Node.js API Service + Agent logic
│   ├── db/
│   │   └── schema.sql        # Database table definitions
│   ├── src/
│   │   ├── lib/              # Core logic (db, agents, config)
│   │   ├── routes/           # REST endpoints
│   │   ├── app.ts            # Express setup
│   │   └── index.ts          # Server entry
│   └── package.json
│
├── frontend/                 # React SPA Service
│   ├── src/
│   │   ├── components/       # UI Widgets
│   │   ├── pages/            # Application Views
│   │   └── services/         # API fetch hooks (api.ts)
│   └── package.json
│
├── python-service/           # FastAPI Data & OCR Service
│   ├── analysis/             # Statistics & Pandas tools
│   ├── ocr/                  # PaddleOCR / PyMuPDF wrappers
│   ├── report/               # python-docx-template generator
│   └── main.py               # Uvicorn entry point
│
├── docs/                     # System Blueprints & Tasks
├── uploads/                  # Mounted PDFs (runtime)
├── reports/                  # Mounted DOCX outputs (runtime)
├── templates/                # Mounted DOCX templates (runtime)
└── .env                      # Global environment configurations
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 24
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 15

### Installation & Database Setup

```bash
# Clone the repository
git clone <repository-url>
cd risetbot

# 1. Start your local PostgreSQL server
# 2. Open PostgreSQL prompt / GUI and configure:
# CREATE DATABASE risetbot;
# 3. Import Schema
psql -U postgres -d risetbot -f backend/db/schema.sql

# 4. Install Backend Dependencies
cd backend
npm install

# 5. Install Frontend Dependencies
cd ../frontend
npm install

# 6. Install Python Dependencies
cd ../python-service
pip install -r requirements.txt
```

### Environment Variables

Copy the example file and modify the contents appropriately:

```bash
cp .env.example .env
```

Ensure `LLM_API_KEY` and `DATABASE_URL` accurately match your configured environment.

### Running in Development

You will need three separate terminal instances:

```bash
# Terminal 1 — Backend API (port 8000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev

# Terminal 3 — Python Service (port 9000)
cd python-service
uvicorn main:app --reload --port 9000
```

---

## API Reference

Base URL (Backend): `http://localhost:8000/api`

### Dashboard
- `GET /healthz` — Check database & backend status
- `GET /dashboard/stats` — Global project + file + report counts
- `GET /dashboard/activity` — Recent activity log (latest 20 entries)

### Projects
- `GET /projects` — List all projects
- `POST /projects` — Create a new project
- `GET /projects/:id` — Get project details
- `PATCH /projects/:id` — Update project name/description
- `DELETE /projects/:id` — Delete project and all related data
- `GET /projects/:id/stats` — Per-project stats (files, reports, etc.)

### Schemas
- `GET /projects/:id/schemas` — List extraction column definitions
- `POST /projects/:id/schemas` — Create a new column definition
- `PATCH /projects/:id/schemas/:schemaId` — Update a column
- `DELETE /projects/:id/schemas/:schemaId` — Delete a column
- `POST /projects/:id/schemas/auto-generate` — AI-suggest a starter schema from text

### Knowledge (Survey Files)
- `GET /projects/:id/knowledge` — List all uploaded survey files
- `POST /projects/:id/knowledge` — Upload PDF file; triggers async extraction pipeline
- `GET /projects/:id/knowledge/:fileId` — Get file details + extracted data
- `POST /projects/:id/knowledge/:fileId/confirm` — Checkpoint 1: confirm/edit/reject
- `DELETE /projects/:id/knowledge/:fileId` — Delete a survey file
- `GET /projects/:id/knowledge/export/download` — Download extracted data as CSV

### Reports
- `GET /projects/:id/reports` — List all AI-generated reports
- `POST /projects/:id/reports` — Generate a new analysis report
- `GET /projects/:id/reports/:reportId` — Get report details
- `GET /projects/:id/reports/:reportId/download` — Download report content
- `DELETE /projects/:id/reports/:reportId` — Delete a report

### Templates
- `GET /projects/:id/templates` — List available DOCX templates
- `POST /projects/:id/templates` — Register a new template
- `GET /projects/:id/templates/:templateId` — Get specific template
- `DELETE /projects/:id/templates/:templateId` — Delete a template

### Chat
- `GET /projects/:id/chat` — Get chat history
- `POST /projects/:id/chat` — Send a message; streams AI response via SSE
- `DELETE /projects/:id/chat` — Clear chat history

---

## Real-Time Streaming (SSE)

RisetBot uses streaming responses closely mapped to the UI for:

- live conversational updates in the ChatBot interface (`POST /api/projects/:id/chat`)
- knowledge processing progress (`POST /api/agents/process/stream`)
- step-based report generation status reflected from persisted pipeline metadata

```
event: thinking
data: { "content": "Sedang menganalisis data..." }

event: content
data: { "content": "Berdasarkan data" }

event: done
data: { "sources": [...] }
```

---

## Database Schema

| Table | Description |
|---|---|
| `projects` | Top-level workspaces (name, description, config) |
| `schemas` | Extraction column definitions per project |
| `templates` | DOCX template references for custom reporting |
| `knowledge` | Uploaded survey files with processing status and extracted JSON rows |
| `reports` | AI-generated analysis reports linked to optional custom templates |
| `chat_history` | Per-project chat messages with role, content, and source citations |
| `agent_memory` | Long-term persisted memory blocks designed for future active AI context |
| `activity_log` | Audit trail for all create, update, process, and confirm operations |
| `agent_runs` | Per-agent execution history with status and latency |
| `llm_request_log` | Token usage, latency, and request metadata for LLM calls |

---

## Security & Observability

- Knowledge uploads only accept PDF files, and template uploads only accept DOCX files.
- Backend route inputs are sanitized before storage and before being forwarded to LLM-backed workflows.
- Report generation preserves `verifiedFacts` derived from Pandas analysis to reduce numeric hallucination risk in final narratives.
- Langfuse tracing is supported when `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` are configured.
- Database backup automation is available through `backend/scripts/backup-db.mjs`.

---

## Roadmap

- [x] Complete connection between Backend and Python Service (Phase 3)
- [x] Migrate agent workloads into multi-agent backend orchestration (Phase 4)
- [x] Add progress-driven upload, extraction, and analysis feedback (Phase 7)
- [x] Add validation, sanitization, backup, and observability foundations (Phase 9-10)
- [ ] Expand advanced OCR handling for dense tabular survey layouts
- [ ] Add role-based access controls
- [ ] Add native webhooks per project pipeline state

---

## License

This project is proprietary software developed for internal government survey automation workflows.  
© 2026 RisetBot. All rights reserved.
