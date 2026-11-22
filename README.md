# AI Dev Tracker

Tracker roadmap 6 bulan menuju AI developer, dari Python sampai LLM, sambil kuliah.
Checklist per bulan, grafik jaringan progres, tiga proyek portofolio, log jam belajar,
dan prompt AI coach yang tinggal disalin.

HTML, CSS, dan JavaScript biasa (ES modules), tanpa build step. Data disimpan di browser
(localStorage), jadi tidak ada server atau akun.

Desainnya editorial gelap dengan satu aksen lime: jaringan saraf 3D yang bergerak di hero
(simpul menyala saat tugas dicentang), smooth scroll, roadmap 7 fase yang di-scroll ke samping,
daftar proyek dengan preview yang mengikuti kursor, dan footer yang terbuka seperti tirai.

Library (dari CDN, opsional): [GSAP 3.12.5](https://gsap.com) + ScrollTrigger untuk animasi
scroll, dan [Lenis 1.1.13](https://lenis.darkroom.engineering) untuk smooth scroll. Kalau CDN
gagal dimuat atau pengguna memilih *reduced motion*, situs tetap jalan normal tanpa animasi.
Font: Inter Tight, Instrument Serif, Geist Mono (Google Fonts).

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
css/sections.css      nav, intro, hero, bulan ini, fase, checklist, portofolio, log, data, footer
js/data.js            roadmap M, proyek P, status ST, target jam, MASCOT_SRC
js/store.js           state, localStorage, norm(), ekspor/impor, mode lihat
js/util.js            escape, tanggal, statistik turunan
js/render.js          render semua section
js/hero.js            jaringan saraf 3D di hero (canvas 2D, tanpa library)
js/motion.js          Lenis + GSAP ScrollTrigger, intro, cursor, tombol magnetik, preview proyek
js/network.js         grafik jaringan SVG yang bisa diklik (Enter/Spasi, panah)
js/prompts.js         prompt AI coach + deskripsi proyek, salin dengan textarea cadangan
js/main.js            inisialisasi dan event listener
assets/mascot.svg     maskot default (neuron), dipakai di kartu AI coach
assets/favicon.svg
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
    "updated":  "ISO date"
  }
  ```

- Semua data yang dibaca (localStorage, file impor, `progress.json`) lewat `norm()` di
  `js/store.js`. Id yang tidak dikenal dibuang, tipe dicek, dan panjang teks dibatasi.
- **Jangan ubah id bulan (`m0`…`m6`) atau id tugas (`m0-1`…) di `js/data.js`.** Progres
  disimpan berdasarkan id itu. Mengubah teks atau tanggal tugas aman.

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

Dalam mode lihat, form edit, checkbox, dan tombol hapus disembunyikan. Tombol
**Edit di browser ini** menyalin data itu ke localStorage supaya bisa dilanjutkan.
`progress.json` bawaan sengaja kosong, jadi mode lihat baru aktif setelah kamu menggantinya.

## Aksesibilitas dan gerak

- Satu `h1`, tiap section memakai `h2`. Focus ring 3px di semua kontrol.
- Grafik jaringan: SVG belakang `role="img"` dengan ringkasan, simpul `role="button"`
  dengan `aria-pressed`. Tab masuk ke satu simpul, panah untuk pindah, Enter/Spasi untuk mencentang.
- Tab bulan bisa dipindah dengan panah kiri/kanan, Home, dan End.
- Jaringan 3D di hero hanya dekorasi (`aria-hidden`). Versi yang bisa dipakai ada di checklist.
- Saat `prefers-reduced-motion: reduce`: tanpa intro, smooth scroll, pin horizontal, cursor,
  atau animasi. Semua konten langsung terlihat.
- Custom cursor dan tombol magnetik hanya aktif di perangkat dengan mouse.
- Lighthouse (lokal): Accessibility 100, Best Practices 100, SEO 100, Performance 94–98.
