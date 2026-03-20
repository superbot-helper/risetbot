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
  - [Chat](#chat)
  - [Agent Pipeline](#agent-pipeline)
- [Real-Time Streaming (SSE)](#real-time-streaming-sse)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
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
| **Multi-Agent Pipeline** | Five specialized AI agents (Extractor → Compiler → Analyst → Reporter → ChatBot) with real-time SSE progress streaming |
| **Schema-Guided Extraction** | User-defined column schemas with name, data type, and AI guidance hints for precise extraction |
| **AI Schema Auto-Generate** | LLM suggests a starter schema from a project description in one click |
| **PDF Upload & Processing** | Base64 upload with async background processing; per-file status tracking |
| **Human-in-the-Loop** | Three explicit checkpoints where users confirm, edit, or reject AI output before it is committed |
| **CSV / XLSX Export** | Aggregate all confirmed extracted rows across files into a spreadsheet download |
| **AI Analysis Reports** | Narrative analysis reports with statistics, sentiment, and themes |
| **Conversational Chat** | Project-scoped chat with streaming token-by-token responses, citing source survey files |
| **Dark / Light Mode** | Persistent theme toggle with system preference detection |
| **Collapsible Sidebar** | Animated 2-level navigation (app-level + project-level) with icon-only collapse |
| **Activity Audit Log** | Every operation is logged to a persistent activity table |

---

## Architecture

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

All agents run on `gpt-5.2` via the Replit AI Integrations proxy (no user API key required). The pipeline streams `agent_start`, `agent_complete`, `agent_error`, and `done` events via Server-Sent Events.

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
| **Monorepo** | pnpm workspaces |
| **Runtime** | Node.js 24 |
| **Language** | TypeScript 5.9 (strict) |
| **API Server** | Express 5 |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI / LLM** | OpenAI `gpt-5.2` via Replit AI Integrations |
| **Frontend** | React 18 + Vite |
| **Styling** | Tailwind CSS v4 + CSS variables |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **Data Fetching** | TanStack Query (React Query) |
| **API Contract** | OpenAPI 3.1 → Orval codegen (typed hooks + Zod schemas) |
| **Validation** | Zod v4 + drizzle-zod |
| **Logging** | Pino + pino-http |

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/                  # Express 5 REST API + Agent orchestration
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── agents.ts        # 5 AI agents (Extractor, Compiler, Analyst, Reporter, ChatBot)
│   │       │   └── activity.ts      # Activity log helper
│   │       └── routes/
│   │           ├── projects.ts      # Project CRUD
│   │           ├── schemas.ts       # Schema CRUD + AI auto-generate
│   │           ├── knowledge.ts     # PDF upload + async processing pipeline
│   │           ├── reports.ts       # Report generation + download
│   │           ├── chat.ts          # SSE chat with survey data
│   │           ├── agents.ts        # Agent pipeline SSE stream endpoint
│   │           └── dashboard.ts     # Global stats + recent activity
│   │
│   └── risetbot/                    # React + Vite frontend SPA
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx    # Overview: stats, chart, activity feed
│           │   ├── Projects.tsx     # Project list + create new
│           │   └── project/
│           │       ├── Knowledge.tsx   # Upload PDFs, track processing status
│           │       ├── Schemas.tsx     # Define extraction columns
│           │       ├── Reports.tsx     # View + download AI reports
│           │       ├── Chat.tsx        # Streaming chat interface
│           │       └── Template.tsx    # DOCX report template management
│           ├── components/
│           │   └── layout/
│           │       ├── AppLayout.tsx      # App-level collapsible sidebar
│           │       └── ProjectLayout.tsx  # Project-level collapsible sidebar
│           └── hooks/
│               └── use-theme.tsx    # Dark/light mode context + localStorage
│
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml             # OpenAPI 3.1 source-of-truth contract
│   ├── api-client-react/            # Generated TanStack Query hooks (Orval)
│   ├── api-zod/                     # Generated Zod schemas (Orval)
│   ├── db/
│   │   └── src/schema/
│   │       ├── projects.ts
│   │       ├── schemas.ts
│   │       ├── knowledge.ts
│   │       ├── reports.ts
│   │       ├── chat_history.ts
│   │       └── activity_log.ts
│   └── integrations-openai-ai-server/  # OpenAI client + batch utilities
│
├── scripts/                         # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 24
- **pnpm** ≥ 9
- **PostgreSQL** ≥ 15 (or use the Replit built-in database)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd workspace

# Install all workspace dependencies
pnpm install
```

### Database Setup

```bash
# Push the Drizzle schema to your PostgreSQL database
pnpm --filter @workspace/db run push
```

Make sure `DATABASE_URL` is set in your environment before running this command (see [Environment Variables](#environment-variables)).

### Running in Development

Open two terminal tabs:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 18213)
pnpm --filter @workspace/risetbot run dev
```

The frontend proxies all `/api` requests to the API server automatically via the Vite dev config.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Auto | Injected automatically by Replit AI Integrations — not needed when running on Replit |
| `PORT` | Auto | Port for each artifact's server (assigned per workspace artifact) |
| `NODE_ENV` | No | Set to `production` in deployment |

> **Note:** When running on Replit, OpenAI API access is handled transparently through the AI Integrations proxy. No manual key setup is required.

---

## API Reference

Base URL: `/api`

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |
| `GET` | `/dashboard/stats` | Global project + file + report counts |
| `GET` | `/dashboard/activity` | Recent activity log (latest 20 entries) |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects` | List all projects |
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects/:id` | Get project details |
| `PATCH` | `/projects/:id` | Update project name/description |
| `DELETE` | `/projects/:id` | Delete project and all related data |
| `GET` | `/projects/:id/stats` | Per-project stats (files, reports, etc.) |

### Schemas

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects/:id/schemas` | List extraction column definitions |
| `POST` | `/projects/:id/schemas` | Create a new column definition |
| `PATCH` | `/projects/:id/schemas/:schemaId` | Update a column |
| `DELETE` | `/projects/:id/schemas/:schemaId` | Delete a column |
| `POST` | `/projects/:id/schemas/auto-generate` | AI-suggest a starter schema from project description |

### Knowledge (Survey Files)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects/:id/knowledge` | List all uploaded survey files |
| `POST` | `/projects/:id/knowledge` | Upload PDF file (base64); triggers async extraction pipeline |
| `GET` | `/projects/:id/knowledge/:fileId` | Get file details + extracted data |
| `POST` | `/projects/:id/knowledge/:fileId/confirm` | Checkpoint 1: confirm extracted data |
| `DELETE` | `/projects/:id/knowledge/:fileId` | Delete a survey file |
| `GET` | `/projects/:id/knowledge/export` | Download aggregated extracted data as CSV/XLSX |

### Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects/:id/reports` | List all AI-generated reports |
| `POST` | `/projects/:id/reports` | Generate a new analysis report |
| `GET` | `/projects/:id/reports/:reportId` | Get report details |
| `POST` | `/projects/:id/reports/:reportId/confirm` | Checkpoint 2: confirm and finalize report |
| `GET` | `/projects/:id/reports/:reportId/download` | Download report as DOCX |
| `DELETE` | `/projects/:id/reports/:reportId` | Delete a report |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects/:id/chat` | Get chat history |
| `POST` | `/projects/:id/chat` | Send a message; streams AI response via SSE |
| `DELETE` | `/projects/:id/chat` | Clear chat history for a project |

### Agent Pipeline

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/agents/process/stream` | Run the full multi-agent pipeline with SSE event streaming |

---

## Real-Time Streaming (SSE)

RisetBot uses **Server-Sent Events** (SSE) for two real-time features:

### Chat (`POST /api/projects/:id/chat`)

```
event: thinking
data: { "content": "" }

event: content
data: { "content": "Berdasarkan data survei..." }

event: done
data: { "messageId": "...", "sources": [...] }
```

### Agent Pipeline (`POST /api/agents/process/stream`)

```
event: agent_start
data: { "agent": "extractor", "message": "Starting extraction..." }

event: agent_complete
data: { "agent": "extractor", "result": { ... } }

event: agent_error
data: { "agent": "compiler", "error": "..." }

event: done
data: { "summary": { ... } }
```

---

## Database Schema

| Table | Description |
|---|---|
| `projects` | Top-level project workspaces (name, description, timestamps) |
| `schemas` | Extraction column definitions per project (name, type, AI guidance, JSONB options) |
| `knowledge` | Uploaded survey files with processing status and extracted data (JSONB) |
| `reports` | AI-generated analysis reports with content and confirmation status (JSONB) |
| `chat_history` | Per-project chat messages with role, content, and source citations |
| `activity_log` | Audit trail for all create, update, delete, process, and confirm operations |

Status values for `knowledge.status`: `pending` → `processing` → `extracted` → `confirmed` | `failed`

Status values for `reports.status`: `draft` → `confirmed`

---

## Development Workflow

### After modifying the OpenAPI spec

```bash
# Regenerate typed React Query hooks and Zod schemas
pnpm --filter @workspace/api-spec run codegen
```

### After modifying the Drizzle database schema

```bash
# Push schema changes to the database
pnpm --filter @workspace/db run push
```

### Linting & Type Checking

```bash
# Type-check all packages
pnpm -r tsc --noEmit
```

---

## Roadmap

- [ ] Role-based access control (admin / analyst / viewer)
- [ ] DOCX template upload and merge with report content
- [ ] Multi-language report output (English + Bahasa Indonesia)
- [ ] Scheduled / recurring survey processing jobs
- [ ] Batch re-processing with updated schema
- [ ] Dashboard export (PDF summary of analytics)
- [ ] Webhook notifications on pipeline completion

---

## License

This project is proprietary software developed for internal government survey automation workflows.  
© 2026 RisetBot. All rights reserved.
