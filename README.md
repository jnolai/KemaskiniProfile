# 🏛️ Portal Kemaskini Profil Pelanggan & Pengurusan Akaun Pintar

Aplikasi portal pengurusan data pelanggan serba moden, berskala tinggi dan responsif yang dibina menggunakan **React 19**, **TypeScript**, **Tailwind CSS**, **SheetJS (XLSX)**, serta sokongan pangkalan data langsung **Google Sheets** dan **Firebase Firestore**.

---

## ✨ Ciri-Ciri Utama Sistem

1. **Carian & Kemaskini Layan Diri (Public Portal)**:
   - Carian pantas berasaskan No. Akaun atau No. Kad Pengenalan.
   - Kebenaran kemas kini terhad & selamat bagi No. Telefon dan Emel pemilik/wakil.
   - Sistem ganjaran/hadiah 1-kali (*1-time customer reward validation & claim slip*).
   - Muat turun Slip Pengesahan Kemaskini PDF rasmi secara serta-merta.

2. **Pengimportan Data Excel / CSV Berskala Besar (100MB+ / 1,000,000+ Baris)**:
   - Enjin pembacaan binari pantas tanpa sekat (*streaming chunks*).
   - Pemetaan lajur pintar & automatik (*smart header auto-detection*).
   - Templat Excel piawai sedia untuk dimuat turun (`.xlsx` & `.csv`).

3. **Penyelarasan Langsung Google Sheets (Live Bi-directional Sync)**:
   - Sambungan langsung ke Google Sheets menggunakan API Key atau CSV Publish Link.
   - Kemas kini profil daripada portal diselaraskan secara automatik (*real-time auto-sync*).

4. **Direktori Akaun & Log Audit Menyeluruh**:
   - Penapisan data, status akaun, carian pintar, dan eksport ke Excel.
   - Log jejak audit lengkap (*timestamp*, punca kemas kini, data lama vs data baru).

5. **Keselamatan Bertingkat (RBAC)**:
   - Mod Portal Pelanggan (Awam).
   - Mod Pentadbir / Super Admin dengan kawalan kata laluan & pengurusan pangkalan data.

---

## 🚀 Panduan Pemasangan & Pembangunan Tempatan

### 1. Prasyarat
- [Node.js](https://nodejs.org/) (versi 18.0 atau lebih baru)
- Pengurus pakej `npm` atau `yarn` / `bun`

### 2. Klon Repositori & Pasang Dependensi
```bash
# Klon repositori ini dari GitHub
git clone https://github.com/username/portal-kemaskini-pelanggan.git

# Masuk ke folder projek
cd portal-kemaskini-pelanggan

# Pasang semua pakej dependensi
npm install
```

### 3. Jalankan Pelayan Pembangunan (Dev Server)
```bash
npm run dev
```
Buka penyemak imbas anda di `http://localhost:3000`.

### 4. Bina untuk Produksi (Production Build)
```bash
npm run build
```
Fail statik yang dioptimumkan sepenuhnya akan dihasilkan di dalam direktori `dist/`.

---

## 🌐 Panduan Deployment Percuma (Free Hosting)

### ⚡ Cara 1: Deploy ke Cloudflare Pages (Disyorkan — 100% Percuma & Pantas)
Cloudflare Pages menyediakan **unlimited bandwidth, unlimited requests, global CDN & SSL percuma**.

#### Langkah-langkah:
1. **Push Kod ke GitHub**:
   - Muat naik kod projek ini ke repositori GitHub anda.
2. **Buka Cloudflare Dashboard**:
   - Log masuk ke [dash.cloudflare.com](https://dash.cloudflare.com/) -> Pergi ke **Workers & Pages** -> Klik **Create application** -> Pilih tab **Pages** -> Klik **Connect to Git**.
3. **Pilih Repositori GitHub**:
   - Pilih repositori projek portal ini.
4. **Konfigurasi Build Settings**:
   - **Framework preset**: `Vite` (atau `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js Version**: (Di bawah *Environment variables*, tambah `NODE_VERSION` = `20`)
5. **Klik Save and Deploy**:
   - Dalam masa ~1 minit, portal anda akan live pada domain percuma seperti `portal-pelanggan.pages.dev`!
   - Fail `public/_redirects` sudah disertakan secara automatik untuk memastikan SPA routing berfungsi lancar tanpa ralat 404 apabila halaman di-refresh.

---

### Cara 2: Deploy ke Netlify / Vercel
Fail `netlify.toml` dan `public/_redirects` telah disertakan:
1. Hubungkan repositori GitHub ke akaun [Netlify](https://app.netlify.com/) atau [Vercel](https://vercel.com/).
2. Konfigurasi binaan automatik:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
3. Klik **Deploy Site**.

---

## 🔒 Konfigurasi Persekitaran (.env)

Salin `.env.example` ke `.env` jika memerlukan integrasi API tambahan:
```bash
cp .env.example .env
```

---

## 📄 Lesen
Hak Cipta Terpelihara (c) 2026. Dilesenkan di bawah [Apache-2.0 License](LICENSE).
