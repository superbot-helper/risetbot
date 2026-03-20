# Changelog

## [2026-03-20] — Phase 3 & 4: Python Service & Multi-Agent Implementation

### Phase 3: Python Service — AI/Data Processing
- **OCR**: `paddle_ocr_service.py` — PaddleOCR wrapper (lazy init, confidence filtering)
- **OCR**: `pdf_parser.py` — PyMuPDF text extraction + OCR fallback at 300 DPI
- **Analysis**: `data_analyzer.py` — Orchestration combining stats + sentiment + themes
- **Analysis**: `statistics.py` — Pandas-based descriptive stats (numeric, category, date, boolean, text)
- **Analysis**: `sentiment.py` — Dual-mode sentiment (keyword-based + LLM), Indonesian keyword dictionaries
- **Report**: `docx_generator.py` — python-docx-template + Jinja2 rendering for government reports
- **RAG**: `pageindex_service.py` — Vectorless reasoning-based RAG with LLM context-window
- **Utils**: `data_compiler.py` — CSV/XLSX export via Pandas + openpyxl (multi-sheet support)
- **Utils**: `file_handler.py` — File validation, upload, cleanup, directory management
- **API**: `main.py` — Complete FastAPI endpoints for all Phase 3 services
- **Deps**: Updated `requirements.txt` with python-multipart

### Phase 4: Backend — Multi-Agent with PraisonAI
- **PraisonAI**: Installed `praisonai` npm package for multi-agent orchestration
- **Supervisor**: `agents/supervisor.ts` — Task routing + PraisonAI agent creation + retry delegation
- **Extractor**: `agents/extractor.ts` — PDF → Python OCR → LLM extraction pipeline
- **Compiler**: `agents/compiler.ts` — LLM cleaning + Python CSV export (with local fallback)
- **Analyst**: `agents/analyst.ts` — Python Pandas analysis → LLM fallback
- **Reporter**: `agents/reporter.ts` — Python DOCX template → LLM text fallback
- **ChatBot**: `agents/chatbot.ts` — Python RAG service → LLM context fallback
- **Retry**: `lib/retry.ts` — Exponential backoff (1s→2s→4s→8s, max 3 retries)
- **Client**: `lib/pythonService.ts` — Typed HTTP client for Python service endpoints
- **Routes**: Refactored `knowledge.ts`, `reports.ts`, `chat.ts` to use new agent modules
- **Env**: Added `PYTHON_SERVICE_URL` to `.env`

### Dokumentasi
- Updated `docs/task.md` — Phase 3 & 4 semua selesai (31/73 tasks done)
- Updated `docs/specs.md` — Folder structure, tech stack, PraisonAI integration

## [2026-03-20] — Audit Codebase & Task List

### Ditambahkan
- `docs/task.md` — Task list lengkap (75 tugas, 11 phase) berdasarkan audit perbandingan codebase vs blueprint.md

### Audit
- Audit menyeluruh terhadap seluruh codebase
- Identifikasi ketidaksesuaian arsitektur Replit workspace monorepo vs blueprint 3-service Docker
- Mapping seluruh fitur yang belum diimplementasi, parsial, dan lengkap
