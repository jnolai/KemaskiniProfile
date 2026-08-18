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

## 🌐 Panduan Deployment

### Cara 1: Deploy ke Netlify (Disyorkan)
Fail `netlify.toml` dan `public/_redirects` telah disertakan:
1. Hubungkan repositori GitHub ini ke akaun [Netlify](https://app.netlify.com/).
2. Konfigurasi binaan automatik:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
3. Klik **Deploy Site**.

### Cara 2: Deploy ke Vercel / Cloudflare Pages / GitHub Pages
- **Vercel:** Import projek dari GitHub, pilih kerangka **Vite**, dan tekan Deploy.
- **Cloudflare Pages:** Tetapkan *Build Output Directory* ke `dist`.

---

## 🔒 Konfigurasi Persekitaran (.env)

Salin `.env.example` ke `.env` jika memerlukan integrasi API tambahan:
```bash
cp .env.example .env
```

---

## 📄 Lesen
Hak Cipta Terpelihara (c) 2026. Dilesenkan di bawah [Apache-2.0 License](LICENSE).
