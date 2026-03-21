# Changelog

## [2026-03-21] - Runtime Folder Consolidation and Docs Sync

### Fixed
- Removed duplicate runtime artifact folders at repository root (`logs`, `tree_indexes`) and consolidated runtime artifacts into `python-service/logs` and `python-service/tree_indexes`.
- Pinned PageIndex execution cwd to `python-service` so runtime logs are no longer created in repository root when called from different working directories.

### Changed
- Updated `README.md` repository structure and storage notes to reflect single runtime location under `python-service`.
- Updated `docs/specs.md` structure and storage policy to include `python-service/logs` and explicit root runtime-folder prohibition.
- Clarified Python command usage to `py -3.11` for dependency install and service startup.
- Added root-level `/tree_indexes` safeguard to `.gitignore`.

## [2026-03-21] - PageIndex Self-Hosted Tree Search Hardening

### Fixed
- Fixed FastAPI + PageIndex integration error `asyncio.run() cannot be called from a running event loop` by running `page_index_main(...)` in a worker thread.
- Fixed RAG query crash when loading PageIndex output format (`{'doc_name', 'structure'}`) by normalizing tree payloads before traversal.
- Fixed unstable index path resolution by making `TREE_INDEX_DIR` deterministic under `python-service/tree_indexes` regardless current working directory.

### Changed
- Hardened self-hosted PageIndex detection in `python-service/rag/pageindex_service.py` so service validates OSS API compatibility (`page_index_main` + `ConfigLoader`) instead of only checking module import.
- Added local repository bootstrap support for PageIndex via `python-service/.vendor/PageIndex` and optional `PAGEINDEX_REPO_PATH`.
- Added LLM key fallback chain (`LLM_API_KEY` -> `OPENAI_API_KEY` -> `CHATGPT_API_KEY`) and base URL fallback retry to OpenAI default when configured URL returns 404.
- Added helper script `python-service/scripts/setup-pageindex.bat` for cloning the OSS repo and installing its dependencies.
- Updated `python-service/requirements.txt` to remove invalid git-based `pageindex` pip line and document self-host setup flow.
- Added `python-service/.vendor/` to `.gitignore` to avoid committing vendored runtime source.

### Verified
- `/rag/build-index` now returns `status: completed` with PageIndex tree structure output.
- `/rag/query` succeeds after index build and returns answer + source citations from indexed content.

## [2026-03-21] - OCR Runtime Fix and Binary Hygiene

### Fixed
- Resolved Python OCR runtime issue where knowledge extraction fell back to placeholder text due to missing OCR dependencies in the active interpreter.
- Updated `python-service/start.bat` interpreter handling to correctly support `py -3.11` argument passing and preflight dependency checks.

### Changed
- Added recursive Python cache ignore rules (`**/__pycache__/`, `*.pyc`) in `.gitignore`.
- Removed tracked `.pyc` artifacts from version control index under `python-service/__pycache__` and `python-service/utils/__pycache__`.

## [2026-03-21] - Documentation Standardization and Storage Cleanup

### Changed
- Rewrote `README.md` to a production-grade structure with clear setup, workflow, configuration, troubleshooting, and contribution guidance.
- Updated `docs/specs.md` to explicitly document runtime storage centralization under `python-service/`.
- Updated `.gitignore` to cover runtime process artifacts (`**/.run/`, `**/*.pid`) and Python runtime cache/index folders.

## [2026-03-21] - Storage Path Cleanup for Knowledge Pipeline

### Fixed
- Fixed backend storage path resolver so relative file paths now resolve to `python-service/uploads` instead of repository-root `uploads`.
- Prevented ENOENT failures during knowledge processing caused by backend reading a non-existent root upload path.
- Aligned report path resolver with the same storage strategy used by Python service.

### Changed
- Updated `python-service/start.bat` to explicitly set `UPLOAD_DIR`, `REPORT_DIR`, and `TEMPLATE_DIR` to folders inside `python-service/`.
- Removed unused repository-root `uploads/` directory (storage now centralized in `python-service/uploads/`).
- Hardened Python file storage resolver in `python-service/utils/file_handler.py` so relative or missing storage env vars always resolve under `python-service/`.
- Removed unused repository-root `reports/` and `templates/` directories to avoid split storage locations.

## [2026-03-21] - Improve Dark Mode Contrast on Chat Page

### Fixed
- Refactored Chat page color classes from hardcoded gray palette to semantic theme tokens (`bg-card`, `bg-background`, `bg-secondary`, `text-foreground`, `text-muted-foreground`).
- Improved dark mode readability by removing washed gray surfaces and restoring higher contrast between chat container, message bubbles, and input area.

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
