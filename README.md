# 🛍️ DigitalStore - Supabase Cloud Edition

Website jualan produk digital dengan UI/UX iOS Glassmorphism + Supabase Backend.

## 📁 Struktur Folder

```
digital-store/
├── index.html              # Halaman utama (HTML + UI)
├── css/
│   └── style.css           # Styling iOS Glassmorphism
├── js/
│   └── app.js              # JavaScript aplikasi + Supabase
├── assets/                 # Folder asset (foto produk, dll)
├── supabase-setup.sql      # SQL untuk setup database Supabase
└── README.md               # Dokumentasi
```

## 🚀 Setup Supabase (WAJIB)

### 1. Buat Project Supabase
1. Buka [supabase.com](https://supabase.com) → Sign Up/Login
2. Klik **"New Project"**
3. Isi nama project, password database, region (pilih yang terdekat)
4. Tunggu ~2 menit sampai project ready

### 2. Dapatkan API Keys
1. Di dashboard project, klik **Settings** (icon gear) → **API**
2. Catat:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public** key (starts with `eyJ...`)

### 3. Setup Database
1. Buka **SQL Editor** (di sidebar)
2. Copy paste isi file `supabase-setup.sql`
3. Klik **Run** atau **New Query** → paste → **Run**

### 4. Setup Google OAuth
1. Di Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. Buka [Google Cloud Console](https://console.cloud.google.com/)
3. Buat project baru atau pilih existing
4. Pergi ke **APIs & Services** → **OAuth consent screen**
5. Pilih **External** → **Create**
6. Isi:
   - App name: `DigitalStore`
   - User support email: (email Anda)
   - Developer contact: (email Anda)
7. Klik **Save and Continue** sampai selesai
8. Pergi ke **Credentials** → **Create Credentials** → **OAuth client ID**
9. Application type: **Web application**
10. **Authorized JavaScript origins**:
    - `https://username.github.io` (production)
    - `http://localhost:3000` (development)
11. **Authorized redirect URIs**:
    - Copy dari Supabase Dashboard (Google provider page)
    - Format: `https://xxxx.supabase.co/auth/v1/callback`
12. Klik **Create** → copy **Client ID** dan **Client Secret**
13. Paste ke Supabase Dashboard → Google provider → Save

### 5. Update Konfigurasi di Code
Buka `js/app.js`, ganti baris ini:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

Dengan data dari step 2.

## 🚀 Deploy ke GitHub Pages

### 1. Buat Repository
- [github.com/new](https://github.com/new)
- Nama: `digital-store`
- Public → Create

### 2. Upload File
```bash
cd digital-store
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/digital-store.git
git push -u origin main
```

### 3. Aktifkan GitHub Pages
- Settings → Pages
- Source: Deploy from a branch → `main` → `/(root)`
- Save

### 4. Update Redirect URI di Google Cloud
Setelah deploy, tambahkan domain GitHub Pages ke **Authorized JavaScript origins**:
- `https://username.github.io`

## ✨ Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 Google OAuth | Login dengan Google via Supabase Auth |
| ☁️ Cloud Database | Data produk tersimpan di Supabase PostgreSQL |
| 🔄 Realtime Sync | Update produk real-time antar device |
| 🔒 Row Level Security | User hanya akses data sendiri |
| 📱 iOS Glass UI | Glassmorphism design |
| 🛒 Cart System | Keranjang belanja |
| 📸 Image Upload | Base64 / drag & drop |
| 💾 Offline Fallback | Mode offline pakai LocalStorage |

## 🛠️ Tech Stack

- HTML5 + CSS3 (Glassmorphism)
- Vanilla JavaScript (ES6+ Module Pattern)
- Supabase (PostgreSQL + Auth + Realtime)
- Google OAuth 2.0
- GitHub Pages (Hosting)

## 📝 Catatan Penting

- **Client Secret** jangan dishare publicly (sudah di-embed di Supabase, bukan di frontend)
- **anon key** aman untuk client-side (RLS melindungi data)
- Untuk production, pastikan redirect URI di Google Cloud sudah benar
- Jika error OAuth, cek console browser untuk detail error

---
Made with ❤️ for digital creators
