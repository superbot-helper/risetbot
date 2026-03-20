# Blueprint Aplikasi Agentic AI — RisetBot

**Buatkan saya aplikasi Agentic AI dengan spesifikasi :**

---

## 1. Ringkasan Eksekutif

**RisetBot** adalah aplikasi Agentic AI berbasis multi-agent yang dirancang untuk mengotomasi proses pengolahan data hasil survey. Aplikasi ini mampu membaca file PDF survey (termasuk PDF scan/gambar via OCR), mengekstrak data sesuai schema yang didefinisikan pengguna, mengompilasi ke format CSV/XLSX, menganalisis data, dan menghasilkan laporan dalam format template standar instansi pemerintah.

<aside>
🎯

**Target Pengguna:** Tim riset internal instansi pemerintah yang rutin melakukan survey data.

**Pendekatan Development:** MVP (Minimum Viable Product) — tanpa login/autentikasi/multi-user di tahap awal.

</aside>

---

## 2. Tujuan & Masalah yang Diselesaikan

### Masalah

- Pengolahan data survey PDF secara manual memakan waktu sangat lama
- Format survey berbeda-beda (kepuasan pelanggan, kebutuhan pelatihan, dll.) sehingga sulit distandarisasi
- Proses ekstraksi data dari teks narasi/essay rawan human error
- Pembuatan laporan berulang dengan format yang sama sangat repetitif
- Tidak ada cara mudah untuk bertanya langsung ke data survey yang sudah dikumpulkan

### Solusi RisetBot

- AI Agent mengotomasi seluruh pipeline: PDF → Ekstraksi → Kompilasi → Analisis → Laporan
- Konsep **Project** memisahkan setiap jenis survey ke workspace terisolasi
- **Schema** mendefinisikan struktur kolom data per jenis survey agar ekstraksi presisi
- **Template DOCX** (Jinja2) memastikan laporan sesuai format standar instansi
- **Chat interaktif** memungkinkan tanya jawab langsung dengan data survey

---

## 3. Capabilities (Kemampuan Utama)

1. **PDF Parsing + OCR** — Membaca PDF teks native + OCR untuk PDF scan/gambar menggunakan PaddleOCR
2. **Data Extraction** — Mengekstrak jawaban survey dari teks narasi/essay/paragraf sesuai Schema
3. **Data Compilation** — Mengompilasi hasil ekstraksi ke format CSV/XLSX sesuai kolom Schema
4. **Data Analysis** — Menganalisis data (statistik deskriptif, kategorisasi tema, sentiment analysis)
5. **Report Generation** — Menghasilkan laporan DOCX sesuai template standar instansi via Jinja2
6. **Pencarian** — Mencari data spesifik di dalam data survey yang sudah diproses
7. **Batch Processing** — Upload dan proses banyak file PDF sekaligus
8. **Chat/Tanya Jawab** — Interaksi natural language dengan data survey (vectorless RAG via PageIndex)
9. **Auto-Generate Schema** — AI otomatis menyarankan kolom-kolom dari contoh PDF survey

---

## 4. Arsitektur Multi-Agent

### Framework: PraisonJS

Aplikasi menggunakan arsitektur **multi-agent** dengan orkestrasi via **PraisonJS** (JavaScript). Setiap agent memiliki tanggung jawab spesifik:

| Agent | Nama | Tanggung Jawab | Input | Output |
| --- | --- | --- | --- | --- |
| 🤖 Agent 1 | **Extractor** | Parsing PDF + OCR (PaddleOCR), mengekstrak data mentah sesuai Schema | File PDF + Schema | Data mentah terstruktur (JSON) |
| 🤖 Agent 2 | **Compiler** | Menyusun data mentah ke format tabular sesuai kolom Schema | Data mentah (JSON) | CSV/XLSX |
| 🤖 Agent 3 | **Analyst** | Menganalisis data (statistik, tema, sentiment) | Data tabular | Hasil analisis (JSON) |
| 🤖 Agent 4 | **Reporter** | Mengisi template DOCX dengan hasil analisis via Jinja2 | Analisis + Template DOCX | Laporan DOCX final |
| 🤖 Agent 5 | **ChatBot** | Menjawab pertanyaan pengguna tentang data survey | Pertanyaan user + Knowledge base | Jawaban natural language + sumber |
| 🧠 Orchestrator | **Supervisor** | Mengatur alur kerja, routing task, error handling antar agent | User request | Delegasi ke agent yang tepat |

### Alur Kerja Multi-Agent

```mermaid
graph TD
    A["📤 User Upload PDF"] --> B["🧠 Supervisor"]
    B --> C["🤖 Extractor\n(PDF Parsing + OCR)"]
    C --> D["✋ CHECKPOINT 1\nVerifikasi Hasil Ekstraksi"]
    D -->|Dikonfirmasi| E["🤖 Compiler\n(Strukturisasi → CSV/XLSX)"]
    D -->|Ditolak/Edit| C
    E --> F["💾 Simpan ke PostgreSQL"]
    F --> G{"User Request?"}
    G -->|Buat Laporan| H["🤖 Analyst\n(Analisis Data)"]
    H --> I["🤖 Reporter\n(Generate DOCX)"]
    I --> J["✋ CHECKPOINT 2\nPreview Laporan"]
    J -->|Dikonfirmasi| K["📥 Download Laporan"]
    J -->|Revisi| H
    G -->|Tanya Jawab| L["🤖 ChatBot\n(RAG via PageIndex)"]
    L --> M["💬 Jawaban + Sumber"]
    G -->|Hapus Data| N["✋ CHECKPOINT 3\nKonfirmasi Hapus"]
    N -->|Ya| O["🗑️ Data Dihapus"]
    N -->|Batal| G
```

---

## 5. Tech Stack

### LLM & Gateway

| Komponen | Teknologi | Keterangan |
| --- | --- | --- |
| LLM Utama | GPT-5 (atau model lain) | Bisa diganti via konfigurasi .env |
| LLM Gateway | **Pabrik Token** (Lokal) | Multi-model support, OpenAI endpoint style |

### Backend (Hybrid)

| Komponen | Teknologi | Keterangan |
| --- | --- | --- |
| API Server | **Node.js / TypeScript** | API utama + PraisonJS orchestration |
| AI/Data Processing | **Python** | PaddleOCR, Pandas, python-docx-template, PageIndex |
| Database | **PostgreSQL** | Data survey, projects, schemas, chat history, memory |
| Containerization | **Docker & Docker Compose** | Semua service dalam container sejak MVP |

### Frontend

| Komponen | Teknologi | Keterangan |
| --- | --- | --- |
| Framework | **React** | Component-based UI |
| Styling | **Tailwind CSS** | Utility-first CSS |
| Build Tool | **Vite** | Fast dev server + build |
| Design Style | **Apple Minimalis** | Clean, elegant, whitespace-driven |

### Key Libraries & Tools

| Library | Fungsi | Bahasa |
| --- | --- | --- |
| **PraisonJS** | Framework orkestrasi multi-agent | JavaScript |
| **PaddleOCR** | OCR engine (100+ bahasa, PDF + gambar) | Python |
| **python-docx-template** | Generate laporan DOCX dari template Jinja2 | Python |
| **PageIndex (VectifyAI)** | Vectorless reasoning-based RAG | Python |
| **Pandas** | Manipulasi & analisis data | Python |
| **openpyxl** | Export data ke XLSX/CSV | Python |
| **Langfuse** | Observability, logging, monitoring agent | Python/JS |

---

## 6. Konsep Project / Workspace

Setiap jenis survey memiliki **Project** sendiri yang terisolasi. Masing-masing project memiliki Schema, Template, Knowledge, Analysis, dan Chat sendiri.

```
🏠 RisetBot
│
├── 📁 Project: "Survey Kepuasan Pelanggan 2026"
│   ├── 🧩 Schema      → Kolom: Responden, Skor, Komentar, dll.
│   ├── 📄 Template    → Laporan_Kepuasan_v2.docx
│   ├── 📚 Knowledge   → 50 file PDF survey kepuasan
│   ├── 📈 Analysis    → Hasil analisis + laporan
│   └── 💬 Chat        → Tanya jawab khusus data kepuasan
│
├── 📁 Project: "Survey Kebutuhan Pelatihan 2026"
│   ├── 🧩 Schema      → Kolom: Pegawai, Unit Kerja, Pelatihan, dll.
│   ├── 📄 Template    → Laporan_Pelatihan_v1.docx
│   ├── 📚 Knowledge   → 30 file PDF survey pelatihan
│   ├── 📈 Analysis    → Hasil analisis + laporan
│   └── 💬 Chat        → Tanya jawab khusus data pelatihan
│
└── 📁 Project: "Evaluasi Kinerja Q1 2026"
    └── ...
```

### Struktur Database PostgreSQL

```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Schemas (FK → projects)
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    columns JSONB NOT NULL, -- [{name, type, ai_guidance}]
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Templates (FK → projects)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge / Survey Files (FK → projects, schemas)
CREATE TABLE knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    schema_id UUID REFERENCES schemas(id),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, done, error
    extracted_data JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reports (FK → projects, templates)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id),
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    analysis_data JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat History (FK → projects)
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    message TEXT NOT NULL,
    sources JSONB, -- [{file, page, section}]
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent Memory (Long-term, FK → projects)
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL, -- 'analysis', 'pattern', 'preference'
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Schema (Definisi Kolom Data)

Schema adalah "cetakan" struktur kolom untuk satu jenis survey. Dibuat sekali per project, dipakai berulang kali.

### Contoh Schema: Survey Kepuasan Pelanggan

| Nama Kolom | Tipe Data | Panduan untuk AI |
| --- | --- | --- |
| Responden | Teks | Nama lengkap responden yang mengisi survey |
| Tanggal | Tanggal | Tanggal pengisian survey |
| Aspek Layanan | Kategori | Aspek layanan yang dinilai (Administrasi, Pelayanan, Fasilitas, dll.) |
| Skor Kepuasan | Angka (1-5) | Skala kepuasan 1=Sangat Tidak Puas sampai 5=Sangat Puas |
| Komentar | Teks | Jawaban essay/narasi/umpan balik dari responden |

### Fitur Auto-Generate Schema

Pengguna dapat meng-upload **1 contoh PDF survey**, lalu AI akan:

1. Membaca dan menganalisis struktur dokumen
2. Otomatis menyarankan kolom-kolom yang sesuai
3. Pengguna tinggal review, edit jika perlu, lalu simpan

---

## 8. Template Laporan (python-docx-template + Jinja2)

### Konsep

- Tim membuat template laporan di **Microsoft Word** sesuai format standar instansi
- Sisipkan **tag Jinja2** di tempat yang perlu diisi data
- LLM generate konten → data dimasukkan ke template → laporan presisi dan rapi

### Contoh Tag Jinja2 dalam Template DOCX

```
LAPORAN HASIL SURVEY  nama_survey 
Periode:  periode 
Total Responden:  total_responden 

{% for item in hasil_analisis %}
 item.aspek :  item.skor_rata_rata /5
Kesimpulan:  item.kesimpulan 
{% endfor %}

Rekomendasi:
{% for rek in rekomendasi %}
-  rek 
{% endfor %}
```

---

## 9. Memory Strategy

### Long-Term Memory

Agent mengingat semua survey yang pernah diproses dan riwayat analisis lintas sesi.

| Tipe Memory | Storage | Fungsi |
| --- | --- | --- |
| Chat History | PostgreSQL | Riwayat percakapan per project |
| Analysis Memory | PostgreSQL | Hasil analisis sebelumnya untuk perbandingan tren |
| Document Index | PageIndex | Tree structure dokumen untuk reasoning-based retrieval |
| Pattern Memory | PostgreSQL | Pola dan preferensi yang dipelajari dari interaksi |

---

## 10. Human-in-the-Loop (3 Checkpoint)

<aside>
✋

**Checkpoint 1 — Setelah Ekstraksi Data**

Tampilkan hasil OCR/parsing untuk verifikasi sebelum disimpan ke database. User bisa edit, konfirmasi, atau tolak.

</aside>

<aside>
✋

**Checkpoint 2 — Sebelum Ekspor Laporan Final**

Preview laporan terlebih dahulu. User bisa konfirmasi dan download, atau minta revisi.

</aside>

<aside>
✋

**Checkpoint 3 — Sebelum Hapus Data Survey Lama**

Konfirmasi penghapusan dengan warning bahwa data yang sudah diekstrak juga akan dihapus permanen.

</aside>

---

## 11. UI/UX Design

### Design Principles

- **Apple Minimalis** — Clean, elegant, whitespace-driven
- **Navigasi 2 Level** — Home (Dashboard + Projects) → Project (Knowledge, Schema, dll.)
- **Sidebar Collapsible** — Bisa di-minimize jadi icon only
- **Mobile Friendly & Responsive** — Sidebar menjadi overlay drawer di mobile
- **Animasi Progress** — Feedback visual untuk setiap proses

### Struktur Navigasi

```
🏠 HOME (Level 1)
├── 📊 Dashboard        → Global overview semua project
└── 📁 Projects         → List/Grid semua project
        │
        ▼ klik salah satu project

📁 PROJECT (Level 2) — sidebar berubah total
├── ← Kembali ke Home
├── 📚 Knowledge        → Upload & kelola PDF
├── 🧩 Schema           → Define kolom data survey
├── 📈 Analysis & Report → Analisis + generate laporan
├── 📄 Template         → Upload template DOCX
└── 💬 Chat             → Tanya jawab dengan data
```

---

### 11.1 Layout Utama — Desktop (Sidebar Expanded)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 RisetBot                                            ☰  🔔  ⚙️  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  ◀ COLLAPSE  │              CONTENT AREA                            │
│              │                                                      │
│  ┌────────┐  │     (Berubah sesuai menu yang dipilih)               │
│  │📊      │  │                                                      │
│  │Dashboard│  │                                                      │
│  └────────┘  │                                                      │
│  ┌────────┐  │                                                      │
│  │📁      │  │                                                      │
│  │Projects │  │                                                      │
│  └────────┘  │                                                      │
│              │                                                      │
│              │                                                      │
│              │                                                      │
├──────────────┴──────────────────────────────────────────────────────┤
│  v1.0 MVP                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Layout Utama — Desktop (Sidebar Collapsed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 RisetBot                                            ☰  🔔  ⚙️  │
├────┬────────────────────────────────────────────────────────────────┤
│    │                                                                │
│ ▶  │              CONTENT AREA                                      │
│    │                                                                │
│ 📊 │        (Lebih luas karena sidebar collapsed)                   │
│    │                                                                │
│ 📁 │                                                                │
│    │                                                                │
├────┴────────────────────────────────────────────────────────────────┤
│  v1.0 MVP                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 Layout Mobile (Responsive)

```
┌───────────────────────────┐
│ ☰  🤖 RisetBot     🔔  ⚙️ │
├───────────────────────────┤
│                           │
│      CONTENT AREA         │
│                           │
│  (Full width, sidebar     │
│   muncul sebagai overlay  │
│   saat ☰ di-tap)          │
│                           │
└───────────────────────────┘

    ☰ di-tap:

┌───────────────────────────┐
│ ✕  🤖 RisetBot           │
├───────────────────────────┤
│  ┌─────────────────────┐  │
│  │ 📊 Dashboard        │  │
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │ 📁 Projects         │  │
│  └─────────────────────┘  │
│                           │
│      (Overlay Drawer)     │
└───────────────────────────┘
```

---

### 11.4 Halaman Dashboard (Global)

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Dashboard — Overview Semua Project                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ 📁 Total     │ │ 📄 Total     │ │ 📈 Total     │         │
│  │ Project      │ │ Survey       │ │ Laporan      │         │
│  │      5       │ │ Diproses     │ │ Dihasilkan   │         │
│  │              │ │     215      │ │      12      │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                              │
│  ── Status Per Project ─────────────────────────────────     │
│  │ 📁 Project              │ Files │ Proses│ Laporan│  │    │
│  │ ────────────────────────│───────│───────│────────│  │    │
│  │ Survey Kepuasan '26     │  50   │ ✅ 50 │   3    │  │    │
│  │ Survey Pelatihan '26    │  30   │ ✅ 28 │   1    │  │    │
│  │ Evaluasi Kinerja Q1     │  35   │ ⏳ 20 │   0    │  │    │
│  │ Survey Fasilitas        │  60   │ ⏳ 45 │   2    │  │    │
│  │ Survey Layanan Publik   │  40   │ ✅ 40 │   6    │  │    │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ── Proses Berjalan ────────────────────────────────────     │
│  │ ⏳ Evaluasi Kinerja Q1                              │    │
│  │   Survey_021.pdf  ████████░░  65%  Extracting...    │    │
│  │   Survey_022.pdf  ██████░░░░  50%  OCR Processing...│    │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ── Aktivitas Terbaru (Semua Project) ──────────────────     │
│  │ ✅ Survey Kepuasan — Laporan Q1 di-generate   10:30 │    │
│  │ 📤 Evaluasi Kinerja — 5 PDF baru upload       10:28 │    │
│  │ ✅ Survey Fasilitas — 15 PDF selesai diproses  09:45 │    │
│  │ 💬 Survey Pelatihan — Chat session             09:20 │    │
│  ────────────────────────────────────────────────────────    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.5 Halaman Projects (List/Grid)

```
┌──────────────────────────────────────────────────────────────┐
│  📁 Projects                   🔍 Cari...  [+ Project Baru]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sortir: [Terbaru ▼]    Filter: [Semua ▼]                   │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐              │
│  │ 📁                 │  │ 📁                 │              │
│  │ Survey Kepuasan    │  │ Survey Kebutuhan   │              │
│  │ Pelanggan 2026     │  │ Pelatihan 2026     │              │
│  │                    │  │                    │              │
│  │ 📚 50  📈 3        │  │ 📚 30  📈 1        │              │
│  │ Updated: 20 Mar    │  │ Updated: 18 Mar    │              │
│  └────────────────────┘  └────────────────────┘              │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐              │
│  │ 📁                 │  │ ➕                  │              │
│  │ Evaluasi Kinerja   │  │                    │              │
│  │ Q1 2026            │  │  Buat Project Baru │              │
│  │                    │  │                    │              │
│  │ 📚 35  📈 0        │  │                    │              │
│  │ Updated: 15 Mar    │  │                    │              │
│  └────────────────────┘  └────────────────────┘              │
│                                                              │
│        1  2  3  ▶  (pagination)                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.6 Buat Project Baru (Modal)

```
┌─────────────────────────────────────────┐
│                                         │
│  ➕ Buat Project Baru                    │
│                                         │
│  Nama Project:                          │
│  [Survey Kepuasan Pelanggan 2026    ]   │
│                                         │
│  Deskripsi (opsional):                  │
│  [Survey tahunan untuk mengukur     ]   │
│  [tingkat kepuasan masyarakat       ]   │
│                                         │
│  Setup Awal:                            │
│  ☑️ Buat Schema sekarang                 │
│  ☑️ Upload template laporan sekarang     │
│  ☐ Skip, setup nanti                    │
│                                         │
│  ┌───────────┐    ┌──────────────────┐  │
│  │  Batalkan  │    │ 🚀 Buat Project  │  │
│  └───────────┘    └──────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

### 11.7 Di Dalam Project — Sidebar Level 2

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 RisetBot  ›  📁 Survey Kepuasan 2026        ☰  🔔  ⚙️   │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│  ← Kembali   │         CONTENT AREA                          │
│              │    (Konteks: Survey Kepuasan 2026)            │
│  ┌────────┐  │                                               │
│  │📚      │  │                                               │
│  │Knowledge│  │                                               │
│  └────────┘  │                                               │
│  ┌────────┐  │                                               │
│  │🧩      │  │                                               │
│  │Schema  │  │                                               │
│  └────────┘  │                                               │
│  ┌────────┐  │                                               │
│  │📈      │  │                                               │
│  │Analysis │  │                                               │
│  │& Report │  │                                               │
│  └────────┘  │                                               │
│  ┌────────┐  │                                               │
│  │📄      │  │                                               │
│  │Template │  │                                               │
│  └────────┘  │                                               │
│  ┌────────┐  │                                               │
│  │💬      │  │                                               │
│  │Chat    │  │                                               │
│  └────────┘  │                                               │
│              │                                               │
├──────────────┴───────────────────────────────────────────────┤
│  📁 Survey Kepuasan Pelanggan 2026                           │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.8 Di Dalam Project — Mobile Level 2

```
┌───────────────────────────┐
│ ←  📁 Survey Kepuasan  ⚙️ │
├───────────────────────────┤
│                           │
│  📚 Knowledge             │
│  🧩 Schema                │
│  📈 Analysis & Report     │
│  📄 Template              │
│  💬 Chat                  │
│                           │
│  ── atau langsung ──      │
│  tampil content area      │
│  default (Knowledge)      │
│                           │
└───────────────────────────┘
```

---

### 11.9 Halaman Knowledge (Upload & Kelola Data)

```
┌──────────────────────────────────────────────────────────────┐
│  📚 Knowledge                           🔍 Cari survey...    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │       ┌───────────────────────────────┐             │     │
│  │       │    📤 Drag & Drop PDF          │             │     │
│  │       │    atau klik untuk browse      │             │     │
│  │       │    (Batch upload supported)    │             │     │
│  │       └───────────────────────────────┘             │     │
│  │  Pilih Schema: [🧩 Kepuasan Pelanggan        ▼]    │     │
│  │                [🚀 Upload & Proses]                 │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ── Upload Progress ─────────────────────────────────────    │
│  │ 📄 Survey_A.pdf   ████████████░░  75%  Extracting... │   │
│  │ 📄 Survey_B.pdf   █████████████░  90%  Compiling...  │   │
│  │ 📄 Survey_C.pdf   ██████████████  ✅  Done           │   │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  ── ✋ CHECKPOINT: Verifikasi Hasil Ekstraksi ────────────   │
│  │ ┌─────────────────────────────────────────────────┐  │   │
│  │ │ Survey_A.pdf — Hasil OCR & Ekstraksi:           │  │   │
│  │ │                                                 │  │   │
│  │ │ Responden: Ahmad Fauzi                          │  │   │
│  │ │ Pertanyaan 1: "Bagaimana kepuasan Anda..."      │  │   │
│  │ │ Jawaban: "Secara keseluruhan saya merasa..."    │  │   │
│  │ │                                                 │  │   │
│  │ │  [✏️ Edit]    [✅ Konfirmasi]    [❌ Tolak]      │  │   │
│  │ └─────────────────────────────────────────────────┘  │   │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  ── Data Survey Tersimpan ───────────────────────────────    │
│  │ 📋 Nama File          │ Status  │ Tanggal  │ Aksi   │    │
│  │─────────────────────── │─────────│──────────│────────│    │
│  │ Survey Kepuasan.pdf   │ ✅ Done │ 20/03/26 │ 👁️ 🗑️  │    │
│  │ Survey Layanan.pdf    │ ✅ Done │ 19/03/26 │ 👁️ 🗑️  │    │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.10 Halaman Schema

```
┌──────────────────────────────────────────────────────────────┐
│  🧩 Schema                                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [+ Buat Schema Baru]   [🤖 Auto-Generate]     🔍 Cari...    │
│                                                              │
│  ── Schema Tersedia ─────────────────────────────────────    │
│  │  ┌──────────────┐  ┌──────────────┐                   │  │
│  │  │ 🧩 Kepuasan  │  │ 🧩 Kebutuhan │                   │  │
│  │  │ Pelanggan    │  │ Pelatihan    │                   │  │
│  │  │ 5 kolom      │  │ 7 kolom      │                   │  │
│  │  │ ⭐ Default   │  │              │                   │  │
│  │  │ 👁️ ✏️ 🗑️     │  │ 👁️ ✏️ 🗑️     │                   │  │
│  │  └──────────────┘  └──────────────┘                   │  │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  ── ✏️ Edit Schema: Kepuasan Pelanggan ──────────────────    │
│  │  Nama Schema: [Kepuasan Pelanggan          ]          │  │
│  │  Deskripsi:   [Survey untuk mengukur tingkat...]      │  │
│  │                                                       │  │
│  │  ┌────────────┬──────────┬────────────────────────┐   │  │
│  │  │ Nama Kolom │ Tipe     │ Panduan untuk AI       │   │  │
│  │  ├────────────┼──────────┼────────────────────────┤   │  │
│  │  │ Responden  │ Teks   ▼ │ Nama lengkap responden │   │  │
│  │  │ Tanggal    │ Tanggal▼ │ Tanggal pengisian      │   │  │
│  │  │ Aspek      │ Kategori▼│ Aspek yang dinilai     │   │  │
│  │  │ Skor       │ Angka  ▼ │ Skala kepuasan 1-5     │   │  │
│  │  │ Komentar   │ Teks   ▼ │ Jawaban essay/narasi   │   │  │
│  │  └────────────┴──────────┴────────────────────────┘   │  │
│  │  [+ Tambah Kolom]              [💾 Simpan]            │  │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  💡 Tips: Gunakan "Auto-Generate" untuk membuat schema       │
│     otomatis dari contoh PDF survey.                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.11 Halaman Analysis & Report

```
┌──────────────────────────────────────────────────────────────┐
│  📈 Analysis & Report                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── Step 1: Pilih Data Survey ─────────────────────────────  │
│  │ ☑️ Survey Kepuasan 2026.pdf                            │  │
│  │ ☑️ Survey Layanan Publik.pdf                           │  │
│  │ ☐ Survey Internal Q1.pdf                              │  │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ── Step 2: Pilih Template Laporan ────────────────────────  │
│  │ 🔘 Laporan Standar Instansi v2.docx                   │  │
│  │ ○  Laporan Ringkas.docx                               │  │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  [🚀 Mulai Analisis & Generate Laporan]                      │
│                                                              │
│  ── Processing ────────────────────────────────────────────  │
│  │ ✅ Analyzing data...              Done                 │  │
│  │ ✅ Generating statistics...       Done                 │  │
│  │ ⏳ Creating report...             ████████░░ 80%      │  │
│  │ ○  Finalizing...                  Waiting              │  │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ── ✋ CHECKPOINT: Preview Laporan ─────────────────────────  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │  📄 PREVIEW LAPORAN                              │   │  │
│  │ │  Judul: Laporan Hasil Survey Kepuasan 2026       │   │  │
│  │ │  Total Responden: 150                            │   │  │
│  │ │  Tingkat Kepuasan: 78.5%                         │   │  │
│  │ │  Tema Utama: Pelayanan, Fasilitas, Waktu         │   │  │
│  │ │                                                  │   │  │
│  │ │  [✅ Konfirmasi & Download]  [✏️ Minta Revisi]    │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ── Riwayat Laporan ──────────────────────────────────────   │
│  │ 📄 Nama Laporan         │ Tanggal  │ Aksi            │   │
│  │ Laporan Survey Q1.docx  │ 20/03/26 │ 📥 👁️ 🗑️       │   │
│  │ Laporan Kepuasan.docx   │ 15/03/26 │ 📥 👁️ 🗑️       │   │
│  ──────────────────────────────────────────────────────────   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.12 Halaman Template

```
┌──────────────────────────────────────────────────────────────┐
│  📄 Template Laporan                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │       ┌───────────────────────────────┐             │     │
│  │       │    📤 Upload Template DOCX     │             │     │
│  │       │    (Format Jinja2 tags)        │             │     │
│  │       └───────────────────────────────┘             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ── Template Tersedia ───────────────────────────────────    │
│  │  ┌──────────────┐  ┌──────────────┐                   │  │
│  │  │ 📄 Laporan   │  │ 📄 Laporan   │                   │  │
│  │  │ Standar v2   │  │ Ringkas      │                   │  │
│  │  │ ⭐ Default   │  │              │                   │  │
│  │  │ 👁️ ✏️ 🗑️     │  │ 👁️ ✏️ 🗑️     │                   │  │
│  │  └──────────────┘  └──────────────┘                   │  │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  💡 Tips: Buat template di Microsoft Word, sisipkan tag      │
│     Jinja2 seperti  nama ,  total_responden ,        │
│     lalu simpan sebagai .docx dan upload di sini.            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.13 Halaman Chat

```
┌──────────────────────────────────────────────────────────────┐
│  💬 Chat dengan Data Survey                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── Pilih Knowledge Source ──────────────────────────────    │
│  │ ☑️ Survey Kepuasan 2026  ☑️ Survey Layanan  ☐ Semua  │   │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  🤖 RisetBot:                                       │     │
│  │  Halo! Saya siap menjawab pertanyaan tentang data   │     │
│  │  survey Anda. Silakan bertanya!                     │     │
│  │                                                     │     │
│  │  ─────────────────────────────────────              │     │
│  │                                                     │     │
│  │  👤 Anda:                                           │     │
│  │  Berapa persen responden yang puas dengan            │     │
│  │  pelayanan publik?                                  │     │
│  │                                                     │     │
│  │  ─────────────────────────────────────              │     │
│  │                                                     │     │
│  │  🤖 RisetBot:                                       │     │
│  │  ●●● (typing animation...)                          │     │
│  │                                                     │     │
│  │  Berdasarkan data Survey Kepuasan 2026:             │     │
│  │  • Sangat Puas: 35.2%                              │     │
│  │  • Puas: 43.3%                                     │     │
│  │  • Netral: 12.1%                                   │     │
│  │  • Tidak Puas: 9.4%                                │     │
│  │                                                     │     │
│  │  📎 Sumber: Survey_Kepuasan_2026.pdf (hal. 12-15)  │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 💬 Ketik pertanyaan...                    [📎] [➤]  │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 11.14 Modal Konfirmasi Hapus (Human-in-the-Loop)

```
┌─────────────────────────────────────┐
│                                     │
│   ⚠️ Konfirmasi Penghapusan          │
│                                     │
│   Anda yakin ingin menghapus:       │
│   📄 "Survey Layanan Publik.pdf"    │
│                                     │
│   Data yang sudah diekstrak dan     │
│   disimpan di database juga akan    │
│   dihapus secara permanen.          │
│                                     │
│   ┌─────────┐  ┌──────────────┐     │
│   │ Batalkan │  │ 🗑️ Ya, Hapus │     │
│   └─────────┘  └──────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

---

## 12. Deployment Strategy

### Fase MVP — Laptop Lokal

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Frontend
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

  # Backend Node.js (API + PraisonJS)
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://risetbot:password@postgres:5432/risetbot
      - PYTHON_SERVICE_URL=http://python-service:9000
    env_file:
      - .env
    depends_on:
      - postgres
      - python-service

  # Python Service (OCR, Analysis, Report Generation)
  python-service:
    build: ./python-service
    ports:
      - "9000:9000"
    volumes:
      - ./uploads:/app/uploads
      - ./reports:/app/reports
    env_file:
      - .env
    depends_on:
      - postgres

  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=risetbot
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=risetbot
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Fase Produksi — On-Premise

Migrasi ke server instansi dengan `docker-compose up -d` — tidak perlu setup ulang.

Tambahkan: login/autentikasi JWT, multi-user, role-based access, enkripsi, audit log.

---

## 13. Konfigurasi Environment (.env)

```bash
# === LLM Configuration ===
API_KEY=sk-your-api-key-here
API_BASE_URL=http://localhost:11434/v1  # Pabrik Token endpoint
MODEL_NAME=gpt-5
TEMPERATURE=0.3
MAX_TOKENS=4096

# === Database ===
DATABASE_URL=postgresql://risetbot:password@postgres:5432/risetbot

# === PageIndex ===
PAGEINDEX_API_KEY=your-pageindex-key

# === Langfuse (Observability) ===
LANGFUSE_SECRET_KEY=your-langfuse-secret
LANGFUSE_PUBLIC_KEY=your-langfuse-public
LANGFUSE_HOST=http://localhost:3001

# === File Storage ===
UPLOAD_DIR=./uploads
REPORT_DIR=./reports
TEMPLATE_DIR=./templates

# === App Settings ===
APP_PORT=8000
PYTHON_SERVICE_PORT=9000
FRONTEND_PORT=3000
```

---

## 14. Keamanan

### Fase MVP

- ✅ **Environment Variables** — Semua secrets dan config di `.env`
- ✅ **File Validation** — Hanya terima PDF (Knowledge) dan DOCX (Template)
- ✅ **Database Backup** — Script otomatis backup PostgreSQL
- ✅ **Input Sanitization** — Cegah injection di chat input dan form

### Fase Produksi (Nanti)

- 🔐 Autentikasi JWT + role-based access control
- 🔑 Enkripsi data at-rest dan in-transit (TLS/SSL)
- 📝 Audit log — tracking siapa mengakses/mengubah data apa
- ⚡ Rate limiting untuk API endpoint
- 🔒 Multi-user dengan permission per project

---

## 15. Rekomendasi Best Practice

### 15.1 Error Handling & Fallback

- Jika OCR gagal membaca PDF → Notifikasi error ke user dengan detail halaman yang gagal
- Jika LLM timeout → Retry otomatis hingga 3x, lalu notifikasi user
- Jika ekstraksi tidak sesuai schema → Tandai kolom yang bermasalah, minta user review
- Setiap agent memiliki fallback strategy independen

### 15.2 Observability & Logging (Langfuse)

- Tracking setiap langkah agent (Extractor → Compiler → Analyst → Reporter)
- Monitoring token usage per request
- Logging latency per agent untuk optimasi performa
- Dashboard monitoring kesehatan sistem

### 15.3 Guardrails (Anti-Hallucination)

- Validasi output LLM terhadap data asli sebelum masuk ke laporan
- Cross-check angka statistik dengan kalkulasi Pandas (bukan murni LLM)
- Setiap data di laporan harus memiliki sumber yang traceable
- Jika LLM tidak yakin, tandai dengan flag "perlu review manual"

### 15.4 Retry Mechanism

- Exponential backoff untuk API calls (1s → 2s → 4s → 8s)
- Maksimal 3x retry per request
- Timeout setting per agent yang bisa dikonfigurasi
- Queue system untuk batch processing agar tidak overload

### 15.5 Data Versioning

- Setiap data survey yang diekstrak memiliki version number
- Riwayat perubahan data tersimpan (siapa, kapan, apa yang berubah)
- Laporan yang di-generate memiliki version tracking
- Memungkinkan rollback ke versi sebelumnya jika ada kesalahan

---

## 16. Struktur Folder Project

```
risetbot/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
│
├── frontend/                    # React + Tailwind + Vite
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardView.tsx
│   │   │   ├── projects/
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   └── CreateProjectModal.tsx
│   │   │   ├── knowledge/
│   │   │   │   ├── KnowledgeView.tsx
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   ├── UploadProgress.tsx
│   │   │   │   └── VerificationCheckpoint.tsx
│   │   │   ├── schema/
│   │   │   │   ├── SchemaView.tsx
│   │   │   │   ├── SchemaEditor.tsx
│   │   │   │   └── AutoGenerateSchema.tsx
│   │   │   ├── analysis/
│   │   │   │   ├── AnalysisView.tsx
│   │   │   │   ├── ReportPreview.tsx
│   │   │   │   └── ProcessingPipeline.tsx
│   │   │   ├── template/
│   │   │   │   ├── TemplateView.tsx
│   │   │   │   └── TemplateCard.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatView.tsx
│   │   │   │   ├── ChatBubble.tsx
│   │   │   │   └── TypingIndicator.tsx
│   │   │   └── common/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── ConfirmDialog.tsx
│   │   │       └── ProgressBar.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── stores/
│   │   └── styles/
│   └── public/
│
├── backend/                     # Node.js + TypeScript + PraisonJS
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── schemas.ts
│   │   │   ├── templates.ts
│   │   │   ├── analysis.ts
│   │   │   └── chat.ts
│   │   ├── agents/
│   │   │   ├── supervisor.ts
│   │   │   ├── extractor.ts
│   │   │   ├── compiler.ts
│   │   │   ├── analyst.ts
│   │   │   ├── reporter.ts
│   │   │   └── chatbot.ts
│   │   ├── services/
│   │   │   ├── projectService.ts
│   │   │   ├── knowledgeService.ts
│   │   │   ├── schemaService.ts
│   │   │   ├── templateService.ts
│   │   │   ├── analysisService.ts
│   │   │   └── chatService.ts
│   │   ├── middleware/
│   │   │   ├── validation.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── sanitization.ts
│   │   ├── config/
│   │   │   └── env.ts
│   │   └── db/
│   │       ├── connection.ts
│   │       └── migrations/
│   └── tests/
│
├── python-service/              # Python (OCR, Analysis, Report)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── src/
│   │   ├── main.py
│   │   ├── ocr/
│   │   │   ├── paddle_ocr_service.py
│   │   │   └── pdf_parser.py
│   │   ├── analysis/
│   │   │   ├── data_analyzer.py
│   │   │   ├── statistics.py
│   │   │   └── sentiment.py
│   │   ├── report/
│   │   │   └── docx_generator.py
│   │   ├── rag/
│   │   │   └── pageindex_service.py
│   │   └── utils/
│   │       ├── data_compiler.py
│   │       └── file_handler.py
│   └── tests/
│
├── uploads/                     # PDF uploads (mounted volume)
├── reports/                     # Generated reports (mounted volume)
└── templates/                   # DOCX templates (mounted volume)
```

---

## 17. Animasi & Feedback UI

Pastikan semua proses memiliki feedback visual:

| Proses | Animasi / Feedback |
| --- | --- |
| Upload file PDF | Progress bar per file + persentase |
| OCR/Extraction | Step indicator: "Extracting... 75%" |
| Compiling data | Step indicator: "Compiling... 90%" |
| Analysis | Multi-step pipeline progress (step 1/4, 2/4...) |
| Report generation | Progress bar + step nama |
| ChatBot thinking | Typing indicator (●●● pulse animation) |
| Auto-Generate Schema | "AI sedang menganalisis PDF..." + spinner |
| Sukses | ✅ Checkmark animation + toast notification |
| Error | ❌ Error toast + detail pesan error |

---
