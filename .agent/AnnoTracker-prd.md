# PRD: AnnoTracker
**Versi:** 1.0
**Tanggal:** 28 Juli 2026
**Status:** Draft

---

## 1. Overview

- **Nama Aplikasi:** AnnoTracker
- **Problem Statement:** Saat ini pencatatan jam kerja, jenis task, dan payroll untuk tim anotasi data dilakukan manual lewat Excel oleh satu orang (owner). Formatnya berubah-ubah tiap periode, rawan human error, dan makin sulit dikelola karena jumlah karyawan mulai bertambah. Dibutuhkan sistem digital yang terpusat, konsisten, dan bisa diakses masing-masing karyawan secara mandiri.
- **Target User:**
  - **Owner/Admin** (1 orang) — mengatur master data, rate gaji, bonus, dan melihat semua laporan.
  - **Karyawan/Annotator** (maks. ±10 orang) — mencatat pekerjaan harian mereka sendiri secara mandiri.
- **Platform:** Web app yang bisa diinstall ke HP maupun digunakan di desktop (**PWA — Progressive Web App**), dengan dukungan offline-first.
- **Constraint / Deadline:** Tidak ada deadline ketat. Prioritas MVP: memindahkan proses pencatatan dari Excel ke aplikasi.

---

## 2. Requirements

### Must Have (MVP)
- Login individual untuk tiap karyawan (self-service input)
- Halaman kerja harian: input task satu per satu (akun & jenis task dipilih dari dropdown, durasi diinput manual dalam **detik**)
- Upload bukti pengerjaan (foto/screenshot) ATAU catatan teks di akhir sesi kerja
- Mode **offline-first**: data tersimpan lokal dulu, sync otomatis begitu online kembali, dengan indikator status sync yang jelas
- Owner dapat mengatur master data: daftar jenis task & daftar nama akun (dropdown)
- Owner dapat mengatur **tingkatan rate gaji** berdasarkan total jam kerja harian (contoh: 1–8 jam = Rp10.000/jam, 11–12 jam = Rp12.000/jam untuk seluruh jam hari itu — flat per tier, bukan progresif)
- Owner dapat mengatur **aturan bonus mingguan** (global, berlaku untuk semua karyawan) berdasarkan threshold total jam kerja per minggu
- Dashboard owner: total jam kerja harian per karyawan, jenis task yang dikerjakan, bukti pengerjaan
- Laporan gaji + bonus per karyawan per periode (untuk proses payroll)
- Rekap total jam kerja per akun/klien
- Export laporan ke Excel/PDF
- Karyawan bisa melihat rincian perhitungan gaji mereka sendiri (transparansi)

### Out of Scope (v1)
- Role/permission granular (RBAC) — cukup 2 peran sederhana: Owner & Karyawan
- Timer otomatis (start/stop) — v1 pakai input manual durasi
- Notifikasi real-time / chat antar user
- Integrasi payment gateway otomatis (pembayaran gaji tetap manual, sistem hanya menghitung dan mencatat)
- Aturan bonus per-individu (semua pakai 1 aturan global di v1)

### Constraints
- Infrastruktur harus menggunakan layanan **gratis (free tier)** di awal — target: Vercel (hosting) + Supabase atau Neon (database)
- Skala kecil: maksimal ±10 pengguna dalam waktu dekat — tidak butuh arsitektur enterprise
- Karyawan bekerja WFH dengan kualitas internet bervariasi → **offline capability wajib ada**, bukan nice-to-have
- Akurasi perhitungan gaji & bonus adalah prioritas kritis — tidak boleh salah hitung

---

## 3. Core Features

| Fitur | Deskripsi | Prioritas | Siapa yang Pakai |
|-------|-----------|-----------|-------------------|
| Login individual | Tiap karyawan & owner punya akun sendiri | Tinggi | Semua |
| Halaman kerja harian | Form aktif sepanjang sesi kerja untuk mencatat task satu per satu | Tinggi | Karyawan |
| Pilih akun & jenis task (dropdown) | Dropdown dari master data yang diatur owner | Tinggi | Karyawan |
| Input durasi per task (detik) | Input manual, otomatis terakumulasi ke total jam harian | Tinggi | Karyawan |
| Upload bukti / catatan | Foto/SS (direkomendasikan) atau catatan teks di akhir sesi | Tinggi | Karyawan |
| Mode offline & auto-sync | Data tersimpan lokal saat offline, sync otomatis + status jelas saat online | Tinggi | Karyawan |
| Master data: Jenis Task | CRUD daftar jenis task | Tinggi | Owner |
| Master data: Nama Akun | CRUD daftar nama akun klien | Tinggi | Owner |
| Pengaturan tier rate gaji | Atur rentang jam & rate per tier | Tinggi | Owner |
| Pengaturan aturan bonus mingguan | Atur threshold jam & nominal bonus (global) | Tinggi | Owner |
| Dashboard rekap harian | Jam kerja, jenis task, bukti per karyawan per hari | Tinggi | Owner |
| Laporan payroll per periode | Total gaji + bonus per karyawan, siap untuk pembayaran | Tinggi | Owner |
| Rekap per akun/klien | Total jam kerja semua karyawan per akun | Sedang | Owner |
| Rincian gaji personal | Karyawan bisa lihat breakdown gaji & bonus miliknya sendiri | Tinggi | Karyawan |
| Export Excel/PDF | Export laporan payroll & rekap | Sedang | Owner |

---

## 4. User Flow

### Flow Utama: Karyawan Mencatat Pekerjaan Harian
1. Karyawan login ke aplikasi (web/PWA di HP atau desktop)
2. Buka "Halaman Kerja" — sistem otomatis catat sesi kerja hari ini
3. Pilih **Nama Akun** dan **Jenis Task** dari dropdown (hanya perlu diganti kalau memang berpindah task/akun, biasanya 1–2 kali per hari)
4. Setelah selesai satu task, input **durasi pengerjaan dalam detik** → tersimpan sebagai satu entri task
5. Ulangi langkah 3–4 untuk task-task berikutnya sepanjang hari
6. Di akhir sesi kerja, karyawan upload bukti pengerjaan (foto/SS) atau isi catatan teks
7. Sistem otomatis menghitung total jam kerja hari itu dan menampilkan estimasi gaji hari itu (berdasarkan tier rate yang berlaku)
8. Data tersimpan (lokal jika offline, langsung ke server jika online)

### Flow Utama: Owner Melihat Laporan & Memproses Payroll
1. Owner login ke dashboard
2. Melihat rekap harian: siapa yang sudah input, total jam kerja, jenis task, bukti pengerjaan
3. Di akhir periode (mingguan/bulanan), owner buka halaman Payroll
4. Sistem menampilkan kalkulasi otomatis: total jam per karyawan → rate sesuai tier → total gaji + bonus (jika target mingguan tercapai)
5. Owner bisa export laporan ke Excel/PDF untuk dibagikan atau diarsipkan
6. Owner menandai status pembayaran (misal "Dibayar tanggal X")

### Kondisi Error / Edge Case
- **Internet putus saat input:** Data tersimpan otomatis di local storage (IndexedDB), muncul indikator "Belum tersinkron". Begitu koneksi kembali, sistem sync otomatis di background dan indikator berubah jadi "Tersinkron".
- **Sync gagal (misal konflik data):** Sistem tidak boleh menghapus data lokal secara diam-diam. Tampilkan notifikasi jelas + tombol "Coba sync ulang", dan data lokal tetap disimpan sampai berhasil sync.
- **Karyawan lupa isi bukti pengerjaan:** Sistem beri reminder/warning ringan sebelum sesi ditutup, tapi tidak memblokir (karena catatan teks juga valid sebagai bukti).
- **Durasi task diisi 0 atau kosong:** Validasi wajib, tidak bisa disimpan sebagai entri kosong.
- **Perubahan rate/tier gaji di tengah periode:** Sistem menggunakan rate yang berlaku pada tanggal task dikerjakan (historis), bukan rate terbaru — supaya laporan periode lama tidak berubah retroaktif.

---

## 5. Design Prompt (Google Stitch)

### Brief Visual
- **Mood/Feel:** Simpel, minimalis, fokus ke kecepatan input (bukan dashboard korporat yang berat)
- **Referensi Aplikasi:** Tidak ada referensi spesifik — bebas selama nyaman dipakai harian
- **Warna Utama:** Netral (direkomendasikan: base netral abu-abu/putih dengan satu warna aksen yang tenang seperti biru/teal, supaya nyaman dipakai lama tiap hari)
- **Target Device:** Mobile-first, tapi tetap rapi di desktop (karena dipakai di kedua device)

### Global Style Prompt
```
Design a clean, minimalist productivity app UI for AnnoTracker,
a daily work-time and task logging app for a small remote annotation team.
Target users: freelance data annotators logging work sessions on mobile and desktop.
Visual style: minimalist, uncluttered, fast to scan and use one-handed on mobile.
Primary color: calm neutral accent (soft blue/teal) on a white/light-gray base.
Font style: clean modern sans-serif, high readability at small sizes.
All screens should feel efficient and trustworthy, like a lightweight time-tracking tool.
```

### Per-Screen Prompts

**Login:**
```
Design a minimalist login screen for AnnoTracker.
Include: simple app logo/wordmark at top, email & password input,
primary CTA button "Masuk", clean layout with generous white space.
Style: minimalist. Color: neutral with soft blue accent. Platform: mobile & web responsive.
```

**Halaman Kerja (Work Session Screen) — this is the core screen:**
```
Design the daily work-logging screen for AnnoTracker.
Key elements: active session indicator, dropdown for "Nama Akun" and "Jenis Task"
(shown at top, only changes occasionally), a running list of logged task entries below
(each showing task number, duration in seconds, time added), a prominent "+ Tambah Task"
button, duration input field in seconds, and an end-of-session action to upload proof
photo/screenshot or add a text note.
Layout: card/list style, mobile-first, thumb-friendly buttons.
Show a small running total of hours worked today.
Mood: efficient, minimal distraction. Platform: mobile & web.
```

**Dashboard Owner:**
```
Design the admin dashboard for AnnoTracker.
Key elements: overview cards (total hours today across team, employees who haven't
logged in yet, pending sync issues), a table of employees with daily hours/tasks/proof
thumbnail, filter by date range and employee.
Layout: card + table hybrid, clean minimalist. Mood: professional but not heavy.
Platform: desktop-first, responsive down to mobile.
```

**Laporan Payroll:**
```
Design the payroll report screen for AnnoTracker.
Key elements: period selector, table listing each employee with total hours,
applicable rate tier, base pay, bonus earned, total payout, and payment status toggle.
Include an export button (Excel/PDF). Show realistic placeholder data.
Style consistent with previous screens. Platform: desktop & mobile.
```

**Rincian Gaji Personal (Employee View):**
```
Design a personal earnings breakdown screen for AnnoTracker, viewed by an employee.
Key elements: this period's total hours, which rate tier applied and why,
daily breakdown list, weekly bonus status (progress toward threshold),
final total in a clear summary card.
Style: simple and transparent-feeling, minimalist. Platform: mobile & web.
```

---

## 6. Architecture

**Rekomendasi Pola:** Offline-first single-page web app (PWA) dengan sinkronisasi ke backend serverless.

**Alasan:** Skala kecil (≤10 user), butuh biaya rendah/gratis di awal, dan requirement offline-first paling natural dicapai dengan arsitektur "local database sebagai source of truth sementara, sync ke cloud saat online" — bukan arsitektur client-server tradisional yang selalu butuh koneksi.

**Komponen Utama:**
- **Frontend:** Next.js (React) + PWA (service worker untuk installable & offline shell)
- **Local Storage (offline):** IndexedDB (via Dexie.js) — menyimpan entri task & antrian sync
- **Backend/API:** Next.js API Routes / Supabase langsung dari client (Supabase menyediakan REST & realtime API otomatis)
- **Database:** Supabase (PostgreSQL) — dipilih di atas Neon karena Supabase sekaligus menyediakan Auth & Storage (untuk upload bukti foto) dalam satu paket gratis
- **External Services:** Supabase Auth (login), Supabase Storage (foto bukti pengerjaan)
- **Hosting:** Vercel

**Gambaran Sistem:**
```
[Karyawan - HP/Desktop]
        │
        ▼
[Next.js PWA] ──(offline)──▶ [IndexedDB lokal + Sync Queue]
        │                              │
        │ (saat online)                │ auto-sync
        ▼                              ▼
[Vercel Edge/API] ─────────▶ [Supabase: Auth + Postgres + Storage]
        ▲
        │
[Owner Dashboard - Desktop/Mobile]
```

---

## 7. Sequence Diagram

### Alur: Input Task Saat Offline → Sync
```
Karyawan    → App        : buka Halaman Kerja
App         → App        : cek status koneksi (offline terdeteksi)
Karyawan    → App        : pilih akun & task, isi durasi (detik), simpan
App         → IndexedDB  : simpan entri task + tandai "pending sync"
App         → Karyawan   : tampilkan entri dengan badge "Belum tersinkron"
... (koneksi kembali online) ...
App         → App        : deteksi online, trigger background sync
App         → Supabase   : kirim semua entri "pending sync"
Supabase    → App        : konfirmasi tersimpan
App         → IndexedDB  : update status jadi "Tersinkron"
App         → Karyawan   : badge berubah jadi "Tersinkron" ✓
```

### Alur: Owner Generate Laporan Payroll
```
Owner       → App        : buka halaman Payroll, pilih periode
App         → Supabase   : query semua entri task + rate tier + bonus rule periode ini
Supabase    → App        : kirim data agregat per karyawan
App         → App        : hitung total jam → tier rate → base pay + bonus (jika threshold tercapai)
App         → Owner      : tampilkan tabel payroll siap export
Owner       → App        : klik Export
App         → Owner      : unduh file Excel/PDF
```

---

## 8. Database Schema

### Entitas: users
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | Auto-generated (dari Supabase Auth) |
| full_name | TEXT | NOT NULL | Nama karyawan |
| role | TEXT | NOT NULL, default 'employee' | 'owner' atau 'employee' |
| is_active | BOOLEAN | default true | Nonaktifkan tanpa hapus data historis |
| created_at | TIMESTAMP | default now() | |

### Entitas: client_accounts (master data "Nama Akun")
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| name | TEXT | NOT NULL, UNIQUE | contoh: "aatikah", "preecha" |
| is_active | BOOLEAN | default true | |

### Entitas: task_types (master data "Jenis Task")
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| name | TEXT | NOT NULL, UNIQUE | contoh: "PR", "AFM", "Arabic LineTask" |
| is_active | BOOLEAN | default true | |

### Entitas: work_sessions (sesi kerja harian per karyawan)
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| session_date | DATE | NOT NULL | |
| proof_type | TEXT | | 'photo' atau 'note' |
| proof_url | TEXT | nullable | link ke Supabase Storage jika foto |
| proof_note | TEXT | nullable | catatan teks jika bukan foto |
| sync_status | TEXT | default 'synced' | 'pending' / 'synced' / 'failed' |
| created_at | TIMESTAMP | default now() | |

### Entitas: task_entries (tiap task individual dalam satu sesi)
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| session_id | UUID | FK → work_sessions.id | |
| client_account_id | UUID | FK → client_accounts.id | |
| task_type_id | UUID | FK → task_types.id | |
| duration_seconds | INTEGER | NOT NULL | durasi pengerjaan dalam detik |
| entry_order | INTEGER | | urutan task ke-berapa hari itu |
| created_at | TIMESTAMP | default now() | |

### Entitas: salary_tiers (aturan rate gaji bertingkat)
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| min_hours | DECIMAL | NOT NULL | batas bawah jam kerja harian |
| max_hours | DECIMAL | nullable | batas atas (null = tidak terbatas) |
| rate_per_hour | INTEGER | NOT NULL | dalam rupiah |
| effective_from | DATE | NOT NULL | berlaku sejak tanggal ini (histori rate tidak berubah retroaktif) |

### Entitas: bonus_rules (aturan bonus mingguan, global)
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| min_weekly_hours | DECIMAL | NOT NULL | contoh: 40 |
| bonus_amount | INTEGER | NOT NULL | contoh: 100000 |
| effective_from | DATE | NOT NULL | |

### Entitas: payroll_records (hasil kalkulasi per periode, untuk histori & status bayar)
| Field | Tipe Data | Constraint | Keterangan |
|-------|-----------|------------|------------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| period_start | DATE | NOT NULL | |
| period_end | DATE | NOT NULL | |
| total_hours | DECIMAL | | |
| base_pay | INTEGER | | |
| bonus_pay | INTEGER | | |
| total_pay | INTEGER | | |
| payment_status | TEXT | default 'unpaid' | 'unpaid' / 'paid' |
| paid_at | TIMESTAMP | nullable | |

**Relasi:**
- `users` 1-to-many `work_sessions` via `user_id`
- `work_sessions` 1-to-many `task_entries` via `session_id`
- `client_accounts` 1-to-many `task_entries` via `client_account_id`
- `task_types` 1-to-many `task_entries` via `task_type_id`
- `users` 1-to-many `payroll_records` via `user_id`

---

## 9. Tech Stack

| Bagian | Teknologi | Alasan |
|--------|-----------|--------|
| Frontend Framework | Next.js (React) | Deploy native ke Vercel, dukungan PWA matang, banyak referensi/komunitas |
| Styling/UI | Tailwind CSS + shadcn/ui | Cepat membangun UI minimalis tanpa desain dari nol |
| Offline Storage | Dexie.js (wrapper IndexedDB) | Menyimpan entri task lokal saat offline, API lebih mudah dari IndexedDB native |
| PWA | next-pwa / Serwist (service worker) | Membuat app bisa diinstall & bekerja offline |
| Backend | Supabase (Postgres + Auto REST API) | Satu layanan mencakup DB, Auth, dan Storage sekaligus di tier gratis |
| Auth | Supabase Auth (email/password) | Sederhana, cukup untuk ≤10 user tanpa RBAC kompleks |
| File Storage | Supabase Storage | Untuk upload bukti foto/screenshot |
| Hosting | Vercel | Sesuai preferensi user, gratis untuk skala kecil, terintegrasi baik dengan Next.js |
| State Management | Zustand | Ringan, cukup untuk kompleksitas app ini (tidak perlu Redux) |
| Form & Validation | react-hook-form + zod | Validasi input durasi/form yang ketat, penting untuk akurasi data |
| Export | exceljs / jspdf | Export laporan payroll ke Excel/PDF |

### 9.1 Rekomendasi Repository Referensi (GitHub)

> Catatan: repo di bawah ini untuk **referensi struktur/logika**, bukan untuk di-clone mentah-mentah kecuali disebutkan lisensinya jelas MIT/permisif. Selalu cek ulang halaman lisensi repo sebelum reuse kode secara langsung.

1. **supabase/supabase** — repo resmi Supabase (Apache 2.0). Bukan starter app, tapi wajib jadi referensi utama untuk pola integrasi Auth, Postgres, dan Storage yang akan dipakai di AnnoTracker.
2. **jamtax/Payroll-Calculator** — kalkulator payroll sederhana, **MIT License**. Bisa diambil logika perhitungan gross/net pay dan strukturnya sebagai referensi untuk modul kalkulasi tier rate gaji.
3. **Timesheet (topic: timesheet, minimalist offline design)** — aplikasi timesheet minimalis dengan fitur offline. Cocok sebagai referensi UX untuk "Halaman Kerja" yang simpel — cek lisensi masing-masing repo di topic ini sebelum reuse kode.
4. **valasek/timesheet** — self-hosted app untuk project reporting & billing dengan alur "reporting → billing prep → export ke sistem akunting" yang mirip alur payroll AnnoTracker. **Perlu dicatat: lisensinya membatasi penggunaan komersial** (perlu izin/lisensi komersial terpisah) — jadi disarankan hanya ambil pola arsitektur/alurnya saja, bukan clone kodenya.
5. **Horilla (topik payroll/attendance open source HR)** — sistem HR/attendance/payroll open source berbasis Django. Terlalu besar untuk dipakai langsung, tapi berguna sebagai referensi skema database attendance→payroll yang lebih matang jika AnnoTracker berkembang ke fitur HR yang lebih lengkap nantinya.

---

## 10. QA — Test Case

### Fitur: Offline & Sinkronisasi Data (Prioritas Tertinggi)

| ID | Skenario | Kondisi Awal | Yang Diharapkan | Prioritas |
|----|----------|--------------|------------------|-----------|
| TC-001 | Happy path: input task saat online | Koneksi stabil | Data langsung tersimpan ke server, status "Tersinkron" | Tinggi |
| TC-002 | Input task saat offline | Koneksi mati | Data tersimpan lokal, badge "Belum tersinkron" muncul, tidak ada data hilang | Tinggi |
| TC-003 | Reconnect setelah offline | Ada data pending di lokal | Sync otomatis berjalan tanpa aksi user, semua data pending berhasil terkirim | Tinggi |
| TC-004 | Sync gagal (server error/timeout) | Ada data pending, server bermasalah | Data lokal TIDAK terhapus, notifikasi error jelas + opsi retry manual | Tinggi |
| TC-005 | Aplikasi ditutup/HP restart saat ada data pending | Data belum sync tersimpan di IndexedDB | Setelah dibuka lagi, data pending masih ada dan otomatis coba sync | Tinggi |

### Fitur: Perhitungan Gaji & Bonus (Prioritas Tertinggi)

| ID | Skenario | Kondisi Awal | Yang Diharapkan | Prioritas |
|----|----------|--------------|------------------|-----------|
| TC-006 | Happy path: total jam masuk 1 tier tertentu | Total kerja 6 jam, tier 1-8 jam = 10rb/jam | Total gaji hari itu = 6 × 10.000 = 60.000 | Tinggi |
| TC-007 | Total jam tepat di batas tier (misal 12 jam) | Tier 11-12 jam = 12rb/jam | Semua 12 jam dihitung 12rb/jam (flat, bukan progresif) | Tinggi |
| TC-008 | Bonus mingguan tercapai | Total jam minggu ini 42 jam, threshold 40 jam = bonus 100rb | Bonus 100rb otomatis ditambahkan ke total payroll minggu itu | Tinggi |
| TC-009 | Bonus mingguan tidak tercapai | Total jam minggu ini 25 jam | Tidak ada bonus ditambahkan | Tinggi |
| TC-010 | Perubahan rate tier di tengah periode | Rate diubah owner di tanggal X | Task sebelum tanggal X tetap pakai rate lama, sesudahnya pakai rate baru | Tinggi |
| TC-011 | Edge case: durasi task 0 detik | User coba submit tanpa isi durasi | Sistem tolak, tampilkan pesan validasi | Sedang |

### Fitur: Master Data & Dropdown

| ID | Skenario | Kondisi Awal | Yang Diharapkan | Prioritas |
|----|----------|--------------|------------------|-----------|
| TC-012 | Happy path: pilih akun/task dari dropdown | Master data sudah diisi owner | Karyawan bisa pilih dan entri tersimpan dengan referensi yang benar | Tinggi |
| TC-013 | Owner nonaktifkan akun/task yang sedang dipakai | Ada entri lama pakai akun yang dinonaktifkan | Entri lama tetap tampil normal di laporan, hanya hilang dari dropdown baru | Sedang |

---

## 11. Project Structure

```
annotracker/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/              # Halaman login
│   ├── (employee)/
│   │   ├── work-session/       # Halaman kerja harian (core screen)
│   │   └── my-earnings/        # Rincian gaji personal
│   ├── (owner)/
│   │   ├── dashboard/          # Rekap harian tim
│   │   ├── payroll/            # Laporan & kalkulasi payroll
│   │   ├── master-data/        # CRUD jenis task & nama akun
│   │   └── settings/           # Tier rate gaji & aturan bonus
│   └── layout.tsx
├── components/                 # Reusable UI components
│   ├── ui/                     # shadcn/ui primitives
│   └── shared/                 # Komponen custom (TaskEntryForm, SyncBadge, dll)
├── lib/
│   ├── supabase/                # Supabase client & query helpers
│   ├── offline/                 # Dexie.js setup, sync queue logic
│   ├── payroll/                 # Logika kalkulasi tier rate & bonus
│   └── utils/                   # Pure helper functions
├── hooks/                       # Custom React hooks (useOnlineStatus, useSyncQueue, dll)
├── store/                       # Zustand state management
├── types/                       # TypeScript type definitions
├── constants/                   # App-wide constants (default tier, dll)
└── public/
    └── manifest.json            # PWA manifest
```

**Keterangan:**
- `lib/offline/` → jantung dari fitur offline-first: definisi skema IndexedDB dan logika antrian sinkronisasi
- `lib/payroll/` → logika perhitungan gaji dipisah dari UI supaya mudah diuji (unit test) secara terisolasi, mengingat akurasi payroll adalah prioritas tertinggi

---

## 12. Naming Convention

| Konteks | Format | Contoh |
|---------|--------|--------|
| Komponen | PascalCase | `WorkSessionForm.tsx` |
| Fungsi/Variabel | camelCase | `calculateDailyPay()` |
| Konstanta | UPPER_SNAKE_CASE | `DEFAULT_BONUS_THRESHOLD` |
| Database tabel & kolom | snake_case | `task_entries`, `duration_seconds` |
| API endpoint (jika pakai Next.js API routes) | kebab-case, plural | `/api/work-sessions` |
| Branch Git | prefix + kebab | `feat/offline-sync`, `fix/payroll-calc` |

---

## 13. Coding Standard

- **Formatter:** Prettier — 2 spasi indentasi, semicolon wajib, trailing comma `all`
- **Linter:** ESLint dengan `eslint-config-next` + rules tambahan untuk React Hooks
- **Typing:** TypeScript strict mode aktif — terutama penting untuk tipe data payroll/kalkulasi supaya tidak salah tipe angka
- **Comment wajib untuk:** fungsi kalkulasi gaji/bonus (public function), logika sync offline yang kompleks
- **Function principle:** single responsibility, maksimal ±40 baris per fungsi — kalkulasi payroll dipecah per langkah (hitung jam → tentukan tier → hitung base pay → cek bonus)
- **Import order:** built-in (React/Next) → external (supabase, dexie, dll) → internal (`@/lib`, `@/components`) → types
- **No magic number:** semua angka seperti default tier/threshold WAJIB dikonstantakan di `constants/`, bukan hardcode di komponen

---

## 14. Error Handling

**Frontend:**
- Error ditampilkan via: toast notification untuk error transient (misal gagal upload foto), inline message untuk error validasi form
- Status sync ditampilkan sebagai badge visual permanen (bukan toast yang hilang) karena ini krusial dan harus selalu terlihat
- Raw error message dari Supabase tidak boleh ditampilkan langsung ke user — selalu di-translate ke pesan yang ramah

**Backend/API:**
- Format error response standar:
```json
{
  "status": "error",
  "code": "SYNC_FAILED",
  "message": "Gagal menyinkronkan data, akan dicoba lagi otomatis",
  "details": {}
}
```
- HTTP status code mapping: 400 (validasi gagal), 401 (belum login), 403 (bukan owner tapi akses fitur owner), 404 (data tidak ditemukan), 500 (server error)
- Semua operasi async (termasuk sync ke Supabase) **wajib** try-catch, tidak boleh silent fail
- **Logging:** catat semua kejadian sync gagal (level `warn`/`error`) untuk debugging, tapi JANGAN log isi foto bukti atau data pribadi karyawan
- **Graceful degradation:** kalau upload foto gagal, karyawan tetap bisa submit sesi dengan catatan teks sebagai fallback — jangan blokir seluruh alur kerja
- **Validation:** validasi durasi task (harus angka positif, tidak boleh 0/kosong) dilakukan di frontend (UX cepat) DAN backend (keamanan data, terutama karena berpengaruh langsung ke perhitungan gaji)

---

## 15. Library Stack

| Kategori | Library | Alasan Pemilihan |
|----------|---------|-------------------|
| HTTP/DB Client | `@supabase/supabase-js` | Client resmi Supabase, mendukung Auth, DB, Storage sekaligus |
| Offline Storage | `dexie` | Wrapper IndexedDB yang jauh lebih mudah dipakai daripada API native |
| PWA | `next-pwa` atau `@serwist/next` | Generate service worker untuk installable app & offline caching |
| State Management | `zustand` | Ringan, cukup untuk skala app ini tanpa boilerplate Redux |
| Form & Validation | `react-hook-form` + `zod` | Validasi ketat untuk input durasi & form payroll settings |
| UI Components | `shadcn/ui` + `tailwindcss` | Membangun UI minimalis dengan cepat dan konsisten |
| Date/Time | `dayjs` | Ringan, cukup untuk perhitungan periode mingguan/bulanan |
| Export | `exceljs`, `jspdf` | Export laporan payroll ke Excel dan PDF |
| Testing | `vitest` | Unit test untuk modul kalkulasi payroll (bagian paling kritis) |
| Notification | `sonner` | Toast notification untuk status sync & error |

---

## 16. Security Considerations

- **Autentikasi:** Supabase Auth (email/password), tidak perlu OAuth kompleks karena tim kecil dan tertutup
- **Autorisasi:** Sederhana — field `role` ('owner'/'employee') di tabel `users`, dicek di level Row Level Security (RLS) Supabase, bukan RBAC granular
- **Row Level Security (RLS):** WAJIB diaktifkan di Supabase — karyawan hanya bisa baca/tulis data miliknya sendiri, owner bisa baca semua
- **Input validation:** wajib di frontend (UX) dan backend/RLS (keamanan), terutama untuk data yang mempengaruhi perhitungan gaji
- **Data sensitif:** foto bukti pengerjaan disimpan di Supabase Storage dengan akses terbatas (bukan public bucket) — hanya owner dan pemilik data yang bisa akses
- **Rate limiting:** tidak prioritas tinggi mengingat skala ≤10 user, tapi tetap gunakan default rate limit Supabase/Vercel
- **Dependencies:** audit berkala dengan `npm audit`, terutama sebelum deploy ke production

---

## 17. Deployment Notes

- **Environment:** Development → Production (staging opsional mengingat skala kecil, bisa langsung dari branch preview Vercel)
- **Environment Variables:** Supabase URL & anon key disimpan di `.env.local`, tidak boleh di-hardcode atau di-commit ke repo
- **CI/CD:** Vercel otomatis deploy tiap push ke `main` (built-in, tidak perlu setup CI terpisah di awal)
- **Hosting Target:** Vercel (frontend + API routes), Supabase (backend/database/storage)
- **Branching Strategy:** `main` (production) + feature branches (`feat/...`, `fix/...`), merge via PR

---

## 18. Assumptions & Open Questions

### Asumsi yang Diambil
> Perlu divalidasi sebelum development dimulai.
- [ ] Karyawan mengerjakan task dari satu device pada satu waktu (belum ada skenario multi-device bersamaan yang perlu real-time sync antar device)
- [ ] Satu sesi kerja = satu hari kalender (belum ada kebutuhan sesi lintas hari/shift malam yang melewati tengah malam)
- [ ] Rate tier dan bonus rule cukup 1 set aturan aktif pada satu waktu (bukan multi-versi berlaku bersamaan)
- [ ] Owner adalah satu-satunya akun dengan hak penuh — tidak ada kebutuhan "co-admin" di v1

### Open Questions
> Perlu dijawab sebelum atau selama development.
- [ ] Berapa lama data historis (foto bukti, entri task) perlu disimpan? Apakah perlu kebijakan retensi/arsip data lama?
- [ ] Apakah karyawan yang resign/keluar datanya perlu tetap tersimpan untuk histori payroll, atau dihapus?
- [ ] Format export Excel/PDF — apakah perlu mengikuti template yang mirip dengan Excel lama (untuk memudahkan transisi), atau bebas format baru?

---

## Catatan untuk Vibe Coding

> Gunakan file PRD ini sebagai **konteks awal** di Antigravity.
>
> Cara pakainya:
> 1. Paste isi PRD ini di awal sesi sebagai system context.
> 2. Mulai dengan instruksi: *"Ini PRD aplikasi yang akan kita bangun. Ikuti semua standar di section 11–15. Mulai dari setup project Next.js + Supabase + PWA, lalu fitur Halaman Kerja (core feature)."*
> 3. Section **Assumptions & Open Questions** (18) — review dulu bareng tim sebelum lanjut ke fase development, terutama soal retensi data.
> 4. Prioritaskan implementasi **offline-sync (section 6-7)** dan **kalkulasi payroll (section 8, 10)** lebih dulu dan uji secara terpisah, karena keduanya adalah bagian paling kritis sesuai section QA.
