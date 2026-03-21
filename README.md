# RisetBot

Platform pemrosesan survey PDF berbasis multi-agent AI untuk workflow sektor publik. RisetBot mengubah dokumen mentah menjadi data terstruktur, analisis statistik, dan laporan formal yang dapat direview sebelum disahkan.

## Contents

- Product Summary
- Core Features
- System Architecture
- Repository Structure
- Prerequisites
- Quick Start
- Development Workflow
- Configuration
- API Overview
- Observability and Security
- Troubleshooting
- Contributing
- License

## Product Summary

RisetBot dirancang untuk mengurangi proses manual yang lambat pada pengolahan survey. Alur utama:

1. Upload PDF survey ke project.
2. Ekstraksi berbasis schema melalui pipeline AI.
3. Review hasil ekstraksi dengan mekanisme human-in-the-loop.
4. Analisis dan generate laporan.
5. Tanya jawab data melalui chat project-scoped.

## Core Features

- Multi-agent pipeline: Extractor, Compiler, Analyst, Reporter, ChatBot.
- Schema-driven extraction: struktur output mengikuti schema project.
- Auto-run knowledge pipeline setelah upload file berhasil.
- Checkpoint verifikasi sebelum data dianggap final.
- Streaming progress dan response via SSE.
- Laporan dan template DOCX berbasis Python service.
- Logging aktivitas, metrik latency, dan token usage.

## System Architecture

RisetBot menggunakan arsitektur 3 service:

1. Frontend (React + Vite)
2. Backend API (Node.js + Express + TypeScript)
3. Python Service (FastAPI untuk OCR, analisis, report, dan file storage)

Pipeline knowledge:

1. Frontend upload PDF ke backend.
2. Backend simpan metadata knowledge dan trigger pipeline processing.
3. Backend membaca file dari storage Python service.
4. Python OCR ekstrak teks, backend LLM ekstrak data terstruktur.
5. Compiler menormalkan hasil.
6. Status menjadi awaiting_confirmation untuk review user.

## Repository Structure

```text
risetbot/
├── backend/
│   ├── db/
│   ├── scripts/
│   └── src/
├── frontend/
│   ├── public/
│   └── src/
├── python-service/
│   ├── analysis/
│   ├── logs/               # runtime logs (PageIndex, service internals)
│   ├── ocr/
│   ├── rag/
│   ├── report/
│   ├── tree_indexes/       # runtime cache index tree PageIndex
│   ├── utils/
│   ├── uploads/            # runtime storage (knowledge)
│   ├── reports/            # runtime storage (generated reports)
│   └── templates/          # runtime storage (uploaded templates)
└── docs/
```

Catatan storage:

- Storage runtime dipusatkan di python-service.
- Folder root uploads/reports/templates/tree_indexes/logs tidak digunakan.

## Prerequisites

- Node.js 20+
- Python 3.11.x (direkomendasikan 3.11 terbaru)
- PostgreSQL 15+
- npm dan pip

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../python-service && py -3.11 -m pip install -r requirements.txt
```

### 2. Setup database

```bash
psql -U postgres -d risetbot -f backend/db/schema.sql
```

### 3. Setup environment

```bash
cp .env.example .env
```

Lengkapi minimal:

- DATABASE_URL
- LLM_API_KEY
- PYTHON_SERVICE_URL

### 4. Run services (Windows helper)

```bat
backend\start.bat
frontend\start.bat
python-service\start.bat
```

Atau manual:

```bash
cd backend && npm run dev
cd frontend && npm run dev
cd python-service && py -3.11 -m uvicorn main:app --reload --port 9000
```

Perintah verifikasi interpreter aktif:

```bash
py -3.11 -c "import sys; print(sys.version); print(sys.executable)"
```

## Development Workflow

Backend:

- npm run dev
- npm run typecheck
- npm run build
- npm run db:backup

Frontend:

- npm run dev
- npm run typecheck
- npm run build

Python service:

- py -3.11 -m uvicorn main:app --reload --port 9000

## Configuration

Environment variables yang umum dipakai:

- DATABASE_URL: koneksi PostgreSQL.
- PORT: port backend API.
- PYTHON_SERVICE_PORT: port FastAPI.
- PYTHON_SERVICE_URL: base URL Python service untuk backend.
- LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TEMPERATURE.
- LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST.
- UPLOAD_DIR, REPORT_DIR, TEMPLATE_DIR: path storage Python service.

Best practice:

- Jangan commit .env.
- Gunakan .env.example untuk template konfigurasi.
- Rotasi API key jika pernah terpapar.

## API Overview

Base URL backend:

- /api

Endpoint penting:

- GET /api/healthz
- GET /api/projects
- POST /api/projects/:projectId/knowledge
- POST /api/agents/process/stream
- GET /api/projects/:projectId/reports
- POST /api/projects/:projectId/chat

SSE dipakai untuk:

- Progress pipeline knowledge
- Streaming response chat

## Observability and Security

- Input disanitasi sebelum diproses.
- Validasi file upload berdasarkan purpose (PDF untuk knowledge, DOCX untuk template).
- Aktivitas tercatat di activity_log.
- Request LLM dan metrik token tercatat di llm_request_log.
- Agent execution tercatat di agent_runs.

## Troubleshooting

Masalah: file upload sukses tapi pipeline error ENOENT.

- Pastikan python-service berjalan.
- Pastikan storage ada di python-service/uploads.
- Gunakan python-service/start.bat agar env storage ter-set konsisten.

Masalah: progress pipeline tidak bergerak.

- Cek endpoint /api/agents/process/stream.
- Cek status knowledge di tabel atau endpoint knowledge list.

## Contributing

Panduan kerja internal:

- Gunakan branch per fitur/perbaikan.
- Pastikan perubahan lolos typecheck/build.
- Update docs/CHANGELOG.md untuk perubahan perilaku sistem.
- Update docs/specs.md jika ada perubahan struktur atau alur fitur.

## License

Proprietary. Internal use only.
