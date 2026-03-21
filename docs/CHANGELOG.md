# Changelog

## [2026-03-21] - Improve Manual Schema Creation UX

### Fixed
- Updated manual schema flow on Schema page so `New Schema` now uses a real schema builder form instead of saving with hardcoded default fields.
- Added dynamic field builder in modal: users can add/remove fields, set type (`text`, `number`, `date`, `category`, `boolean`), toggle required, and write per-field AI guidance.
- Added frontend validation to prevent saving schema when schema name or field names are empty.
- Fixed schema card edit action so existing schemas can be edited again using the same schema builder modal (pre-filled values + update API call).

## [2026-03-21] - Fix Projects Date Rendering Crash

### Fixed
- Fixed frontend crash `Invalid time value` on Projects page by hardening date parsing in `frontend/src/pages/Projects.tsx`.
- Added safe date resolver to support both camelCase (`updatedAt`) and snake_case (`updated_at`) API fields, with fallback to `createdAt`/`created_at`.
- Added invalid-date guard before calling `date-fns/format`, so project cards no longer crash when date data is missing or malformed.

## [2026-03-21] - Fix Python Service Startup on Windows

### Fixed
- Updated `python-service/start.bat` to run FastAPI using `python -m uvicorn` (with interpreter fallback: `.venv`, `py`, then `python`) so startup no longer depends on global `uvicorn` in PATH.
- Fixed PID handling in `python-service/start.bat` by enabling delayed expansion and validating PID file format before querying running processes.
- Improved process spawn strategy in `python-service/start.bat` using direct `Start-Process` on Python, ensuring PID capture is stable.
- Updated `python-service/stop.bat` to validate PID file format before `tasklist` calls, preventing `ERROR: The search filter cannot be recognized.` when PID file is corrupt.

## [2026-03-21] - Windows Service Runner Scripts

### Added
- Added `start.bat`, `stop.bat`, and `restart.bat` for each service:
	- `backend/`
	- `frontend/`
	- `python-service/`
- Each `start.bat` opens the service in a dedicated terminal window (`cmd /k`) so logs remain visible for monitoring.
- Added PID-based process control (`.run/*.pid`) to make `stop.bat` and `restart.bat` reliable per service.

## [2026-03-21] - Phase 7, 9, 10, and 11 Alignment

### Diagnostics
- Cleaned `pyrightconfig.json` so `pyright` no longer reports unsupported configuration keys while checking `python-service`
- Removed unused interpreter-specific config that caused unnecessary environment lookup noise during Python diagnostics

### Documentation
- Updated `docs/task.md` to reflect completed work in Phase 7, 9, 10, and 11
- Updated `docs/specs.md` with security and observability coverage plus the new design-system document
- Added `docs/design-system.md` as the UI consistency reference for tokens, motion, and feedback patterns
- Updated `README.md` to reflect current multi-service status, streaming usage, security posture, and observability support

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
