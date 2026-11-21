# AI Dev Tracker

Tracker roadmap 6 bulan menuju AI developer, dari Python sampai LLM, sambil kuliah.
Checklist per bulan, grafik jaringan progres, tiga proyek portofolio, log jam belajar,
dan prompt AI coach yang tinggal disalin.

HTML, CSS, dan JavaScript biasa (ES modules). Tanpa framework, tanpa build step, tanpa
library JS. Data disimpan di browser (localStorage), jadi tidak ada server atau akun.

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
css/tokens.css        warna, font, spacing, radius
css/base.css          reset, tipografi, utilitas, focus ring, reduced motion
css/components.css    tombol, chip, kartu, input, checkbox, marquee, badge bunga, toast
css/sections.css      layout navbar, hero, bulan ini, checklist, portofolio, log, data, footer
js/data.js            roadmap M, proyek P, status ST, target jam, MASCOT_SRC
js/store.js           state, localStorage, norm(), ekspor/impor, mode lihat
js/util.js            escape, tanggal, statistik turunan
js/render.js          render semua section
js/network.js         grafik jaringan SVG (klik, Enter/Spasi, panah)
js/prompts.js         prompt AI coach + deskripsi proyek, salin dengan textarea cadangan
js/main.js            inisialisasi dan event listener
assets/mascot.svg     maskot default (neuron)
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

Semua maskot di halaman (kapsul hero, "Bulan ini", kartu AI coach) memakai satu konstanta
itu. Maskot default `assets/mascot.svg` adalah gambar original.

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
- Semua animasi (huruf hero, count-up, marquee, badge, simpul) mati saat
  `prefers-reduced-motion: reduce`.
- Lighthouse (lokal): Accessibility 100, Best Practices 100, SEO 100, Performance 94–99.
