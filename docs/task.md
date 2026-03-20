# 📋 RisetBot — Task List Pengembangan

> **Tanggal Audit:** 2026-03-20
> **Referensi:** [blueprint.md](./blueprint.md)
> **Status Codebase:** Arsitektur saat ini menggunakan **Replit workspace monorepo** (pnpm-workspace) yang **tidak sesuai** dengan blueprint. Perlu restrukturisasi ke arsitektur **3-service terpisah** (frontend + backend Node.js + python-service) dengan Docker.

---

## 🔴 Temuan Audit Utama

1. **Arsitektur Monorepo Replit** — Codebase menggunakan `pnpm-workspace.yaml` dengan struktur `artifacts/` dan `lib/`, bukan `frontend/`, `backend/`, `python-service/` sesuai blueprint.
2. **Tidak ada Docker** — Tidak ditemukan `Dockerfile`, `docker-compose.yml`, atau `.env` file.
3. **Tidak ada Python Service** — Seluruh AI processing dilakukan di Node.js (seharusnya Python: PaddleOCR, Pandas, python-docx-template, PageIndex).
4. **Tidak ada PraisonJS** — Agent orchestration hanya berupa fungsi-fungsi LLM call biasa, bukan multi-agent framework.
5. **Tidak ada OCR** — PDF parsing hanya dummy/mock data, bukan PaddleOCR.
6. **Tidak ada Template DOCX** — Tabel `templates` tidak ada di database, tidak ada upload/generate DOCX via Jinja2.
7. **Tidak ada Agent Memory** — Tabel `agent_memory` tidak ada di database.
8. **Observability (Langfuse) belum diintegrasikan.**
9. **File Replit** masih ada (`.replit`, `.replitignore`, `replit.md`, `@replit/*` plugins).
10. **Database menggunakan Drizzle ORM** — Blueprint menspesifikasikan raw PostgreSQL schema, perlu evaluasi konsistensi.

---

## 📊 Task List

### PHASE 1: Restrukturisasi Arsitektur & Infrastruktur

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 1 | Restrukturisasi folder project sesuai blueprint (`frontend/`, `backend/`, `python-service/`) | ❌ Belum | 🔴 Critical | Phase 1 |
| 2 | Hapus file-file Replit (`.replit`, `.replitignore`, `replit.md`, `pnpm-workspace.yaml`, `artifacts/mockup-sandbox/`) | ❌ Belum | 🔴 Critical | Phase 1 |
| 3 | Buat `docker-compose.yml` dengan 4 service (frontend, backend, python-service, postgres) | ❌ Belum | 🔴 Critical | Phase 1 |
| 4 | Buat `Dockerfile` untuk masing-masing service (frontend, backend, python-service) | ❌ Belum | 🔴 Critical | Phase 1 |
| 5 | Buat file `.env` dan `.env.example` sesuai blueprint section 13 | ❌ Belum | 🔴 Critical | Phase 1 |
| 6 | Migrasi frontend dari `artifacts/risetbot/` ke `frontend/` (React + Vite + Tailwind CSS) | ❌ Belum | 🔴 Critical | Phase 1 |
| 7 | Migrasi backend dari `artifacts/api-server/` ke `backend/` (Node.js + TypeScript) | ❌ Belum | 🔴 Critical | Phase 1 |
| 8 | Setup python-service dari scratch (FastAPI / Flask) | ❌ Belum | 🔴 Critical | Phase 1 |
| 9 | Setup PostgreSQL database schema sesuai blueprint section 6 (migrasi dari Drizzle ORM ke format yang sesuai) | ⚠️ Parsial | 🔴 Critical | Phase 1 |
| 10 | Buat direktori `uploads/`, `reports/`, `templates/` sebagai mounted volume | ❌ Belum | 🟡 High | Phase 1 |

### PHASE 2: Database — Tabel yang Hilang

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 11 | Buat tabel `templates` (FK → projects) untuk upload template DOCX | ❌ Belum | 🔴 Critical | Phase 2 |
| 12 | Buat tabel `agent_memory` (FK → projects) untuk long-term memory agent | ❌ Belum | 🟡 High | Phase 2 |
| 13 | Update tabel `reports` — tambahkan kolom `template_id` (FK → templates) | ❌ Belum | 🟡 High | Phase 2 |
| 14 | Evaluasi tabel ekstra (`conversations`, `messages`) yang ada di codebase tapi tidak di blueprint | ⚠️ Review | 🟡 High | Phase 2 |

### PHASE 3: Python Service — AI/Data Processing

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 15 | Implementasi PaddleOCR service (`ocr/paddle_ocr_service.py` + `pdf_parser.py`) | ❌ Belum | 🔴 Critical | Phase 3 |
| 16 | Implementasi Data Analyzer (`analysis/data_analyzer.py`, `statistics.py`, `sentiment.py`) dengan Pandas | ❌ Belum | 🔴 Critical | Phase 3 |
| 17 | Implementasi Report Generator (`report/docx_generator.py`) dengan python-docx-template + Jinja2 | ❌ Belum | 🔴 Critical | Phase 3 |
| 18 | Implementasi PageIndex RAG service (`rag/pageindex_service.py`) untuk vectorless reasoning-based RAG | ❌ Belum | 🔴 Critical | Phase 3 |
| 19 | Implementasi Data Compiler (`utils/data_compiler.py`) untuk export CSV/XLSX via openpyxl | ❌ Belum | 🟡 High | Phase 3 |
| 20 | Implementasi File Handler (`utils/file_handler.py`) untuk manajemen file upload | ❌ Belum | 🟡 High | Phase 3 |
| 21 | Buat `requirements.txt` dengan semua dependency Python (PaddleOCR, Pandas, python-docx-template, PageIndex, openpyxl, dll.) | ❌ Belum | 🟡 High | Phase 3 |

### PHASE 4: Backend — Multi-Agent dengan PraisonJS

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 22 | Integrasikan PraisonJS sebagai framework orkestrasi multi-agent | ❌ Belum | 🔴 Critical | Phase 4 |
| 23 | Implementasi Supervisor Agent (routing task, error handling antar agent) | ❌ Belum | 🔴 Critical | Phase 4 |
| 24 | Refactor Extractor Agent — koneksi ke python-service untuk PDF parsing + OCR | ⚠️ Parsial | 🔴 Critical | Phase 4 |
| 25 | Refactor Compiler Agent — koneksi ke python-service untuk data compilation | ⚠️ Parsial | 🟡 High | Phase 4 |
| 26 | Refactor Analyst Agent — koneksi ke python-service untuk analisis data (statistik, sentiment, tema) | ⚠️ Parsial | 🟡 High | Phase 4 |
| 27 | Refactor Reporter Agent — koneksi ke python-service untuk generate DOCX via Jinja2 template | ⚠️ Parsial | 🔴 Critical | Phase 4 |
| 28 | Refactor ChatBot Agent — koneksi ke python-service PageIndex untuk reasoning-based RAG | ⚠️ Parsial | 🔴 Critical | Phase 4 |
| 29 | Implementasi retry mechanism (exponential backoff, max 3x retry) per agent | ❌ Belum | 🟡 High | Phase 4 |
| 30 | Buat route API untuk templates (CRUD + upload DOCX) | ❌ Belum | 🟡 High | Phase 4 |

### PHASE 5: Frontend — Halaman & Fitur yang Hilang/Belum Lengkap

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 31 | Dashboard — Implementasi stat cards (Total Project, Total Survey Diproses, Total Laporan) | ⚠️ Parsial | 🟡 High | Phase 5 |
| 32 | Dashboard — Implementasi tabel Status Per Project | ⚠️ Parsial | 🟡 High | Phase 5 |
| 33 | Dashboard — Implementasi section Proses Berjalan (realtime progress) | ❌ Belum | 🟡 High | Phase 5 |
| 34 | Dashboard — Implementasi section Aktivitas Terbaru | ⚠️ Parsial | 🟡 High | Phase 5 |
| 35 | Projects — Implementasi sort, filter, dan pagination | ❌ Belum | 🟢 Medium | Phase 5 |
| 36 | Projects — Implementasi modal Buat Project Baru dengan setup awal (Schema + Template) | ⚠️ Parsial | 🟡 High | Phase 5 |
| 37 | Knowledge — Implementasi drag & drop file upload PDF (actual file upload, bukan base64) | ⚠️ Parsial | 🔴 Critical | Phase 5 |
| 38 | Knowledge — Implementasi batch upload (multiple files sekaligus) | ❌ Belum | 🟡 High | Phase 5 |
| 39 | Knowledge — Implementasi Checkpoint 1: Verifikasi Hasil Ekstraksi (edit, konfirmasi, tolak) | ⚠️ Parsial | 🔴 Critical | Phase 5 |
| 40 | Schema — Implementasi Auto-Generate Schema dari contoh PDF | ⚠️ Parsial | 🟡 High | Phase 5 |
| 41 | Schema — Implementasi Schema Editor (tambah/edit/hapus kolom) | ⚠️ Parsial | 🟡 High | Phase 5 |
| 42 | Analysis & Report — Implementasi Step 1: Pilih Data Survey (checkbox) | ⚠️ Parsial | 🟡 High | Phase 5 |
| 43 | Analysis & Report — Implementasi Step 2: Pilih Template Laporan | ❌ Belum | 🟡 High | Phase 5 |
| 44 | Analysis & Report — Implementasi multi-step processing pipeline progress | ⚠️ Parsial | 🟡 High | Phase 5 |
| 45 | Analysis & Report — Implementasi Checkpoint 2: Preview Laporan (konfirmasi/revisi) | ⚠️ Parsial | 🟡 High | Phase 5 |
| 46 | Template — Implementasi upload DOCX template (actual file upload) | ❌ Belum | 🔴 Critical | Phase 5 |
| 47 | Template — Implementasi CRUD template (create, read, set default, delete) | ❌ Belum | 🟡 High | Phase 5 |
| 48 | Chat — Implementasi pilih Knowledge Source (checkbox filter) | ❌ Belum | 🟡 High | Phase 5 |
| 49 | Chat — Implementasi typing indicator (●●● pulse animation) | ⚠️ Parsial | 🟢 Medium | Phase 5 |
| 50 | Chat — Implementasi citation/sumber referensi (file + halaman) | ⚠️ Parsial | 🟡 High | Phase 5 |

### PHASE 6: UI/UX — Navigasi & Layout

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 51 | Implementasi Sidebar Level 1 (Home: Dashboard + Projects) sesuai blueprint | ⚠️ Parsial | 🟡 High | Phase 6 |
| 52 | Implementasi Sidebar Level 2 (Project: Knowledge, Schema, Analysis, Template, Chat) dengan navigasi berubah total | ⚠️ Parsial | 🟡 High | Phase 6 |
| 53 | Implementasi Sidebar Collapsible (expand/collapse menjadi icon only) | ⚠️ Parsial | 🟢 Medium | Phase 6 |
| 54 | Implementasi Mobile Responsive — Sidebar menjadi overlay drawer | ⚠️ Parsial | 🟢 Medium | Phase 6 |
| 55 | Implementasi Header dengan breadcrumb navigasi (🤖 RisetBot › 📁 Project Name) | ⚠️ Parsial | 🟢 Medium | Phase 6 |
| 56 | Implementasi Modal Konfirmasi Hapus (Checkpoint 3: Human-in-the-Loop delete) | ❌ Belum | 🟡 High | Phase 6 |

### PHASE 7: Animasi & Feedback Visual

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 57 | Implementasi progress bar per file saat upload PDF | ⚠️ Parsial | 🟡 High | Phase 7 |
| 58 | Implementasi step indicator untuk OCR/Extraction ("Extracting... 75%") | ⚠️ Parsial | 🟡 High | Phase 7 |
| 59 | Implementasi multi-step pipeline progress untuk Analysis (step 1/4, 2/4...) | ⚠️ Parsial | 🟡 High | Phase 7 |
| 60 | Implementasi toast notification untuk sukses (✅ checkmark animation) dan error (❌) | ⚠️ Parsial | 🟢 Medium | Phase 7 |
| 61 | Implementasi "AI sedang menganalisis PDF..." spinner untuk Auto-Generate Schema | ❌ Belum | 🟢 Medium | Phase 7 |

### PHASE 8: Konfigurasi LLM & Gateway

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 62 | Konfigurasi LLM Gateway (Pabrik Token) — multi-model support via `.env` | ❌ Belum | 🔴 Critical | Phase 8 |
| 63 | Implementasi model switching (ganti model via konfigurasi, bukan hardcoded `gpt-5.2`) | ❌ Belum | 🟡 High | Phase 8 |
| 64 | Implementasi temperature & max_tokens dari `.env` (bukan hardcoded) | ❌ Belum | 🟡 High | Phase 8 |

### PHASE 9: Keamanan & Best Practice

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 65 | Implementasi file validation — hanya terima PDF (Knowledge) dan DOCX (Template) | ❌ Belum | 🟡 High | Phase 9 |
| 66 | Implementasi input sanitization untuk chat input dan form | ❌ Belum | 🟡 High | Phase 9 |
| 67 | Implementasi database backup script otomatis | ❌ Belum | 🟢 Medium | Phase 9 |
| 68 | Implementasi guardrails anti-hallucination (cross-check angka dengan Pandas) | ❌ Belum | 🟢 Medium | Phase 9 |
| 69 | Implementasi data versioning (version number + riwayat perubahan) | ⚠️ Parsial | 🟢 Medium | Phase 9 |

### PHASE 10: Observability & Logging

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 70 | Integrasikan Langfuse untuk observability (tracking setiap langkah agent) | ❌ Belum | 🟡 High | Phase 10 |
| 71 | Implementasi monitoring token usage per request | ❌ Belum | 🟢 Medium | Phase 10 |
| 72 | Implementasi logging latency per agent untuk optimasi performa | ❌ Belum | 🟢 Medium | Phase 10 |

### PHASE 11: Dokumentasi & Finalisasi

| No | Tugas | Status | Prioritas | Phase |
|----|-------|--------|-----------|-------|
| 73 | Update `README.md` sesuai arsitektur baru (3-service Docker) | ❌ Belum | 🟡 High | Phase 11 |
| 74 | Buat `docs/specs.md` untuk spesifikasi teknis | ❌ Belum | 🟡 High | Phase 11 |
| 75 | Buat design-system file untuk konsistensi UI (Apple Minimalis theme) | ❌ Belum | 🟢 Medium | Phase 11 |

---

## 📈 Ringkasan Status

| Kategori | Total | ❌ Belum | ⚠️ Parsial | ✅ Selesai |
|----------|-------|---------|-----------|-----------|
| Phase 1: Arsitektur & Infrastruktur | 10 | 9 | 1 | 0 |
| Phase 2: Database | 4 | 3 | 1 | 0 |
| Phase 3: Python Service | 7 | 7 | 0 | 0 |
| Phase 4: Backend Multi-Agent | 9 | 3 | 6 | 0 |
| Phase 5: Frontend Halaman & Fitur | 20 | 7 | 13 | 0 |
| Phase 6: UI/UX Navigasi & Layout | 6 | 1 | 5 | 0 |
| Phase 7: Animasi & Feedback | 5 | 1 | 4 | 0 |
| Phase 8: Konfigurasi LLM | 3 | 3 | 0 | 0 |
| Phase 9: Keamanan & Best Practice | 5 | 4 | 1 | 0 |
| Phase 10: Observability | 3 | 3 | 0 | 0 |
| Phase 11: Dokumentasi | 3 | 3 | 0 | 0 |
| **TOTAL** | **75** | **44** | **31** | **0** |

---

## 🔑 Legenda

- ❌ **Belum** — Belum ada implementasi sama sekali
- ⚠️ **Parsial** — Ada implementasi tapi belum lengkap/belum sesuai blueprint
- ✅ **Selesai** — Implementasi lengkap dan sesuai blueprint
- 🔴 **Critical** — Harus dikerjakan pertama, blocker untuk task lain
- 🟡 **High** — Penting untuk MVP, dikerjakan setelah critical
- 🟢 **Medium** — Nice to have untuk MVP, bisa ditunda
