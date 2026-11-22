# AI Dev Tracker

**Live:** https://alfattaufik.github.io/ai-dev-tracker/

Tracker roadmap 6 bulan menuju AI developer, dari Python sampai LLM, sambil kuliah.
Checklist per bulan, grafik jaringan progres, habit tracker harian, timer pomodoro yang
langsung mencatat ke log, tiga proyek portofolio, log jam belajar, dan prompt AI coach yang
tinggal disalin.

HTML, CSS, dan JavaScript biasa (ES modules), tanpa build step. Data disimpan di browser
(localStorage). Login akun (Google atau email) opsional, supaya progres sama di semua perangkat.

Desainnya editorial gelap dengan satu aksen lime: jaringan saraf 3D yang bergerak di hero
(simpul menyala saat tugas dicentang), smooth scroll, roadmap 7 fase yang di-scroll ke samping,
daftar proyek dengan preview yang mengikuti kursor, dan footer yang terbuka seperti tirai.

Library (dari CDN, opsional): [GSAP 3.12.5](https://gsap.com) + ScrollTrigger untuk animasi
scroll, dan [Lenis 1.1.13](https://lenis.darkroom.engineering) untuk smooth scroll. Kalau CDN
gagal dimuat atau pengguna memilih *reduced motion*, situs tetap jalan normal tanpa animasi.
Font: Inter Tight, Instrument Serif, Geist Mono (Google Fonts).

## Pasang di HP (PWA)

Buka link live di HP, lalu:

- **Android (Chrome):** buka section **Data** dan ketuk **Pasang di perangkat ini**, atau
  menu ⋮ → **Tambahkan ke layar utama**.
- **iPhone/iPad:** buka di Safari, ketuk **Bagikan**, lalu **Tambah ke Layar Utama**.

Setelah dipasang, tracker terbuka seperti aplikasi dan tetap jalan tanpa internet
(`sw.js` menyimpan semua file). Kalau ada versi baru di GitHub, versi itu dipakai saat online.
Supaya progres sama di HP dan laptop, masuk ke akun (lihat di bawah).

## Akun dan sinkron antar perangkat

Masuk dengan akun yang sama (Google atau email + kata sandi) di HP, laptop, dan tablet, dan
progresnya sama di semua perangkat. Akunnya memakai **Firebase** (gratis, paket Spark, tanpa
kartu kredit): Firebase Auth untuk login, Firestore untuk menyimpan satu dokumen per pengguna.

### Menyalakan login akun (sekali saja, oleh pemilik situs)

Selama `js/firebase-config.js` berisi `null`, tombol login tidak muncul dan situs memakai
sinkron GitHub Gist (di bawah).

1. Buka https://console.firebase.google.com, klik **Create a project** (Google Analytics boleh dimatikan).
2. **Build → Authentication → Get started → Sign-in method**: aktifkan **Google** dan
   **Email/Password**.
3. **Authentication → Settings → Authorized domains**: tambahkan `alfattaufik.github.io`
   (`localhost` sudah ada untuk mencoba di komputer).
4. **Build → Firestore Database → Create database**: pilih lokasi (misalnya
   `asia-southeast2`, Jakarta), mode **production**.
5. **Firestore → Rules**: ganti isinya dengan isi file [`firestore.rules`](firestore.rules),
   lalu **Publish**. Aturan ini membuat setiap orang hanya bisa membaca dan menulis datanya sendiri.
6. **Project settings → General → Your apps → Web (`</>`)**: daftarkan aplikasi, salin
   objek `firebaseConfig`, tempel ke `js/firebase-config.js` (contohnya ada di file itu),
   lalu commit dan push.

Nilai di `firebaseConfig` memang publik. Yang melindungi data adalah `firestore.rules`.

### Cara kerjanya (`js/account.js`, `js/sync.js`, `js/merge.js`)

- Data tiap pengguna ada di dokumen `trackers/{uid}`: `{ json: "<data tracker>", updated }`.
- SDK Firebase (versi terkunci 10.14.1, dari `www.gstatic.com`) hanya diunduh kalau login
  diaktifkan dan kamu membuka kartu Akun atau sudah masuk. Pengunjung lain tidak memuatnya.
- Setiap perubahan dikirim sekitar 1,5 detik kemudian. Perubahan dari perangkat lain masuk
  langsung (listener Firestore), dan juga saat halaman kembali aktif atau kembali online.
- Penggabungan tiga arah terhadap versi sinkron terakhir: centang, hapus centang, log, dan
  kebiasaan dari dua perangkat tetap aman walaupun keduanya sempat offline. Penyimpanan
  memakai transaksi Firestore, jadi kalau dua perangkat menyimpan bersamaan, yang kedua
  mengulang penggabungan dengan versi terbaru dan tidak ada yang hilang.
- Saat pertama masuk di perangkat yang sudah punya progres, progres itu digabung dengan
  yang ada di akun.
- **Keluar dari akun** tidak menghapus data di perangkat itu. Di perangkat orang lain,
  keluar dulu lalu **Hapus semua data**.
- **Hapus semua data** saat masih masuk juga menghapus data di akun dan semua perangkat.
- Pengaturan sinkron disimpan di localStorage `aidev-sync-v1` (terpisah dari data).

### Tanpa akun: GitHub Gist

Masih tersedia di kartu Akun, bagian **Tanpa akun: sinkron lewat GitHub Gist**. Hanya satu
cara sinkron yang aktif dalam satu waktu.

1. Buat token di https://github.com/settings/tokens/new?scopes=gist&description=AI%20Dev%20Tracker
   (classic token). Centang **gist** saja, pilih masa berlaku, lalu **Generate token**.
2. Tempel token itu lalu klik **Hubungkan**. Perangkat pertama membuat gist `aidev-tracker.json`.
3. Di perangkat lain, tempel token yang sama. Gist yang sama ditemukan otomatis dan
   progresnya digabung. Gist dicek setiap menit saat halaman terbuka.

Gist rahasia tidak muncul di profilmu, tapi siapa pun yang tahu URL-nya bisa membacanya.
Token disimpan di localStorage perangkat itu saja, dan script dari CDN dikunci dengan hash SRI.
Kalau token kedaluwarsa, status berubah merah. Buat token baru dan tempel lagi.

## Fokus (pomodoro)

Section **Fokus** berisi timer berbentuk jam 60 menit:

- Putar kenop di lingkaran (seret, atau fokus ke kenop lalu tekan panah, Shift+panah = 5
  menit, Home/End) untuk mengatur durasi. Fokus 5–60 menit, istirahat 1–30, istirahat
  panjang 5–45. Bawaannya 25/5/15, dan istirahat panjang datang setelah 4 sesi fokus.
- **Mulai / Jeda / Ulang**, dan **Selesai sekarang** (menit yang sudah berjalan tetap dicatat)
  atau **Lewati istirahat**.
- Pilih tugas bulan ini di **Sedang dikerjakan**. Sesi fokus yang selesai masuk ke log
  belajar sebagai `Pomodoro · <tugas>`, lalu muncul tombol untuk menandai tugas itu selesai.
- Saat sesi selesai: bunyi pendek, getar di HP, notifikasi (kalau diizinkan di Pengaturan
  timer), dan judul tab menampilkan hitung mundur. Kalau kamu menggulir menjauh, pil kecil di
  kiri bawah tetap menunjukkan sisa waktu.
- Timer tetap berjalan kalau halaman ditutup atau HP dikunci. Sesi yang selesai saat itu
  dicatat ketika kamu membuka halaman lagi. Status timer disimpan per perangkat
  (localStorage `aidev-focus-v1`). Lognya ikut tersinkron.

## Menjalankan di komputer

```bash
python3 -m http.server 8000
```

Lalu buka http://localhost:8000. ES modules butuh server, jadi membuka `index.html`
langsung dengan dobel klik tidak akan jalan.

## Struktur file

```
index.html            markup semua section
progress.json         data untuk mode lihat (default kosong, lihat di bawah)
css/tokens.css        warna (tema gelap, terang, lime), font, spacing, radius
css/base.css          reset, tipografi, grain, focus ring, reduced motion
css/components.css    tombol, CTA lingkaran, tab, checkbox, input, pill status, ticker, cursor, toast
css/sections.css      nav, intro, hero, bulan ini, fase, checklist, kebiasaan, portofolio, log, data, footer
js/data.js            roadmap M, proyek P, status ST, target jam, kebiasaan bawaan, tanggal ujian, MASCOT_SRC
js/store.js           state, localStorage, norm(), ekspor/impor, mode lihat
js/util.js            escape, tanggal, statistik turunan
js/render.js          render semua section
js/hero.js            jaringan saraf 3D di hero (canvas 2D, tanpa library)
js/motion.js          Lenis + GSAP ScrollTrigger, intro, cursor, tombol magnetik, preview proyek
js/network.js         grafik jaringan SVG yang bisa diklik (Enter/Spasi, panah)
js/prompts.js         prompt AI coach + deskripsi proyek, salin dengan textarea cadangan
js/main.js            inisialisasi, event listener, tombol pasang PWA, UI akun dan sinkron
js/focus.js           timer pomodoro (dial, siklus, pencatatan ke log, notifikasi)
js/sync.js            mesin sinkron (tarik, gabung, kirim) untuk akun atau GitHub Gist
js/account.js         login Firebase dan dokumen Firestore per pengguna
js/firebase-config.js config Firebase (null = login mati)
js/merge.js           penggabungan tiga arah untuk sinkron
firestore.rules       aturan Firestore: tiap pengguna hanya bisa akses datanya sendiri
sw.js                 service worker (offline): file sendiri network first, CDN cache first
manifest.webmanifest  nama aplikasi, ikon, warna, pintasan ke Kebiasaan dan Log
assets/mascot.svg     maskot default (neuron), dipakai di kartu AI coach
assets/favicon.svg
assets/icon.svg       ikon aplikasi; icon-192.png, icon-512.png, apple-touch-icon.png dirender dari sini
```

## Data

- Kunci localStorage: `aidev-tracker-v1`
- Format:

  ```json
  {
    "done":     { "<taskId>": true },
    "custom":   [{ "id": "c...", "m": "<monthId>", "text": "..." }],
    "projects": { "p1": { "status": "", "github": "", "demo": "", "notes": "", "desc": "" } },
    "log":      [{ "d": "YYYY-MM-DD", "m": 90, "n": "catatan" }],
    "habits":   [{ "id": "h-ai", "name": "Belajar AI 30 menit", "goal": 5, "end": "", "days": ["YYYY-MM-DD"] }],
    "updated":  "ISO date"
  }
  ```

- Semua data yang dibaca (localStorage, file impor, `progress.json`) lewat `norm()` di
  `js/store.js`. Id yang tidak dikenal dibuang, tipe dicek, dan panjang teks dibatasi.
- `habits` ditambahkan belakangan. File lama tanpa `habits` tetap bisa diimpor dan mendapat
  kebiasaan bawaan. `goal` = target hari per minggu (1–7), `end` = hari terakhir (opsional).
- **Jangan ubah id bulan (`m0`…`m6`) atau id tugas (`m0-1`…) di `js/data.js`.** Progres
  disimpan berdasarkan id itu. Mengubah teks atau tanggal tugas aman.

## Kebiasaan (habit tracker)

Section **Kebiasaan** berisi grid 7 hari terakhir. Klik kotak untuk mencentang (hari yang
sudah lewat juga bisa diisi), dan panah untuk pindah dengan keyboard. Di bawahnya ada peta
"Enam bulan dalam kotak": satu kotak per hari dari November sampai Mei, makin terang makin
banyak kebiasaan yang beres.

- Kebiasaan bawaan: belajar materi ujian (berhenti otomatis setelah 5 Desember 2026),
  belajar AI 30 menit, olahraga, dan tidur sebelum jam 12. Bisa dihapus (klik × dua kali)
  atau ditambah sendiri, maksimal 12.
- Begitu total log belajar dalam sehari mencapai 30 menit (misalnya dua sesi pomodoro),
  "Belajar AI 30 menit" otomatis dicentang untuk tanggal itu.
- Ringkasan kebiasaan ikut masuk ke prompt AI coach.
- Tanggal akhir ujian ada di `EXAM_END` dan kebiasaan bawaan di `HABIT_DEFAULTS`
  (`js/data.js`).

## Ganti maskot

1. Simpan gambarmu sebagai `assets/mascot.png` (rasio 1:1, latar transparan, minimal 400×400).
2. Di `js/data.js`, ubah baris ini:

   ```js
   export const MASCOT_SRC = 'assets/mascot.png';
   ```

Maskot tampil sebagai avatar di kartu AI coach dan memakai konstanta itu. Maskot default
`assets/mascot.svg` adalah gambar original.

## Deploy ke GitHub Pages

1. Push folder ini ke repo GitHub.
2. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Tunggu sekitar satu menit, lalu buka `https://<username>.github.io/<repo>/`.

File `.nojekyll` sudah ada, jadi GitHub Pages menyajikan file apa adanya.

## Mode lihat (pamerkan progres)

Pengunjung yang belum punya data di browsernya akan melihat progresmu dalam mode baca,
selama `progress.json` di repo berisi progres:

1. Di bagian **Data**, klik **Ekspor progress.json**.
2. Ganti `progress.json` di root repo dengan file itu, lalu commit dan push.

Dalam mode lihat, form edit, checkbox, kotak kebiasaan, dan tombol hapus dikunci atau disembunyikan. Tombol
**Edit di browser ini** menyalin data itu ke localStorage supaya bisa dilanjutkan.
`progress.json` bawaan sengaja kosong, jadi mode lihat baru aktif setelah kamu menggantinya.

## Aksesibilitas dan gerak

- Satu `h1`, tiap section memakai `h2`. Focus ring 3px di semua kontrol.
- Grafik jaringan: SVG belakang `role="img"` dengan ringkasan, simpul `role="button"`
  dengan `aria-pressed`. Tab masuk ke satu simpul, panah untuk pindah, Enter/Spasi untuk mencentang.
- Tab bulan bisa dipindah dengan panah kiri/kanan, Home, dan End.
- Grid kebiasaan: satu titik Tab, panah untuk pindah, Enter/Spasi untuk mencentang. Tiap
  kotak adalah tombol dengan `aria-pressed` dan label nama kebiasaan + tanggal.
- Timer pomodoro: kenop dial adalah `role="slider"` (panah, Home/End), tombol mode memakai
  `aria-pressed`, dan pergantian sesi diumumkan lewat status `aria-live`.
- Jaringan 3D di hero hanya dekorasi (`aria-hidden`). Versi yang bisa dipakai ada di checklist.
- Saat `prefers-reduced-motion: reduce`: tanpa intro, smooth scroll, pin horizontal, cursor,
  atau animasi. Semua konten langsung terlihat.
- Custom cursor dan tombol magnetik hanya aktif di perangkat dengan mouse.
- Lighthouse (lokal): Accessibility 100, Best Practices 100, SEO 100. Performance desktop 97;
  mobile 82–94 tergantung beban mesin saat diukur.
