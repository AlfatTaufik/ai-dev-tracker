# AI Dev Tracker: rebuild plan

Status: **approved and built** (2026-11-21). Kept for reference.

The original `index.html` / `style.css` / `app.js` were not available, so this is a
rebuild from scratch that follows `PROMPT-redesign.md`. The data format, localStorage
key and features match the prompt exactly. The roadmap content below is new.

> ⚠️ Task ids become permanent once you start ticking tasks. Edit the roadmap
> **now** (text, dates, order) if anything is wrong. Changing a task's text later is fine,
> but changing its id is not.

---

## 1. File structure

```
index.html
css/tokens.css        colors, fonts, spacing, radius, type scale
css/base.css          reset, typography, utilities, focus ring, reduced-motion
css/components.css    buttons, chips, cards, marquee, flower badge, vertical text, checkbox
css/sections.css      navbar, hero, "Bulan ini", checklist, portfolio, log, data, footer
js/data.js            M (roadmap), P (projects), ST (statuses), WEEK_TARGET = 8
js/store.js           state, load/save (aidev-tracker-v1), norm(), export/import, progress.json view mode
js/render.js          stats, hero, chips, checklist, projects, log, week chart, escapeHtml()
js/network.js         neural-network SVG (one layer per month, one node per task)
js/prompts.js         AI coach prompt + English project description prompt, copy with textarea fallback
js/main.js            init, event delegation, navbar/menu, count-up, mascot fallback
assets/mascot.svg     default original mascot (round black "neuron", 4 dendrites, 2 eyes, highlight)
assets/mascot.png     optional: drop your own here, used automatically if present
assets/favicon.svg
README.md
.nojekyll             so GitHub Pages serves files as-is
```

No framework, no build step, no external JS. Google Fonts only: Anton, JetBrains Mono, Inter.

**Mascot slot:** every mascot is `<img class="mascot" src="assets/mascot.png">`. If that file
is missing, `main.js` switches all of them to `assets/mascot.svg` once. To use your own,
add `mascot.png` (1:1, transparent). No code change needed.

## 2. Data (unchanged format)

```json
{
  "done":     { "<taskId>": true },
  "custom":   [{ "id": "c...", "m": "<monthId>", "text": "..." }],
  "projects": { "p1": { "status": "", "github": "", "demo": "", "notes": "", "desc": "" } },
  "log":      [{ "d": "YYYY-MM-DD", "m": 90, "n": "catatan" }],
  "updated":  "ISO date"
}
```

- localStorage key `aidev-tracker-v1`.
- `norm(obj)` validates and cleans anything loaded or imported: drops unknown keys,
  keeps only known task ids in `done`, checks types, caps text length, and returns a clean
  object (or throws a readable error on import).
- Status `ST`: `""` = BELUM MULAI, `"wip"` = DIKERJAKAN, `"online"` = ONLINE.
- "Proyek online" counts projects whose status is `online`.
- The active month comes from today's date against each month's `start`/`end`. Before
  the roadmap starts it shows the first month; after it ends, the last one.

## 3. New roadmap `M` (7 layers, 35 tasks)

Month id = `m0`…`m6`, task id = `m<n>-<k>`. Each task has a target date.

**m0 · NOV 2026 · FASE 0 · "UJIAN DULU"** (2)
- m0-1 Selesaikan UAS dan tugas akhir semester · 2026-11-30
- m0-2 Setup: Python 3.12, VS Code, Git, akun GitHub dan Kaggle · 2026-11-30

**m1 · DES 2026 · FASE 1 · "PYTHON DASAR"** (6)
- m1-1 Python dasar: tipe data, kondisi, perulangan, fungsi · 12-07
- m1-2 List, dict, set, dan comprehension · 12-10
- m1-3 OOP, modul, dan virtual environment · 12-14
- m1-4 NumPy: array, indexing, broadcasting · 12-18
- m1-5 Pandas: baca CSV, filter, groupby, merge · 12-24
- m1-6 Mini proyek: analisis dataset CSV + grafik Matplotlib · 12-31

**m2 · JAN 2027 · FASE 2 · "ML DASAR"** (6)
- m2-1 Aljabar linear untuk ML: vektor, matriks, dot product · 01-06
- m2-2 Statistik dan probabilitas dasar · 01-10
- m2-3 Regresi linear dan logistik dengan scikit-learn · 01-15
- m2-4 Train/test split, cross-validation, metrik evaluasi · 01-20
- m2-5 Decision tree dan random forest · 01-25
- m2-6 Kaggle pertama: submit Titanic · 01-31

**m3 · FEB 2027 · FASE 3 · "ML LANJUT"** (5)
- m3-1 Feature engineering dan Pipeline scikit-learn · 02-05
- m3-2 Gradient boosting: XGBoost atau LightGBM · 02-11
- m3-3 Clustering dan PCA · 02-16
- m3-4 Proyek 1: model prediksi data tabular end-to-end · 02-23
- m3-5 Deploy proyek 1 (Streamlit atau Hugging Face Spaces) · 02-28

**m4 · MAR 2027 · FASE 4 · "PYTORCH"** (6)
- m4-1 Tensor dan autograd PyTorch · 03-05
- m4-2 Neural network (MLP) dari nol di PyTorch · 03-10
- m4-3 Training loop, optimizer, mengatasi overfitting · 03-15
- m4-4 CNN untuk klasifikasi gambar · 03-20
- m4-5 Transfer learning dengan model pretrained · 03-25
- m4-6 Proyek 2: image classifier PyTorch, online · 03-31

**m5 · APR 2027 · FASE 5 · "NLP & LLM"** (5)
- m5-1 Tokenisasi, embedding, dan konsep attention · 04-06
- m5-2 Transformer dengan Hugging Face: pipeline dan fine-tuning kecil · 04-13
- m5-3 Prompt engineering dan memakai API LLM · 04-18
- m5-4 RAG: embedding + vector store · 04-24
- m5-5 Ikut satu kompetisi Kaggle NLP atau LLM · 04-30

**m6 · MEI 2027 · FASE 6 · "PORTOFOLIO"** (5)
- m6-1 Proyek 3: chatbot RAG untuk dokumen kuliah · 05-10
- m6-2 Deploy proyek 3 dan tulis README · 05-15
- m6-3 Deskripsi bahasa Inggris untuk ketiga proyek · 05-20
- m6-4 Perbarui CV, LinkedIn, dan profil GitHub · 05-25
- m6-5 Kirim 5 lamaran magang AI/ML · 05-31

**Projects `P`**
- p1 Tabular Prediction Model (scikit-learn, Fase 3)
- p2 PyTorch Image Classifier (Fase 4)
- p3 RAG Study Assistant (Fase 6)

## 4. Sections (top to bottom)

1. **Navbar**: sticky, 56px. `AIDEV.TRACKER` · `( ROADMAP ) ( PORTOFOLIO ) ( LOG ) ( DATA )` ·
   `+ ( MENU )`. Below 768px a full-screen yellow menu with large Anton links, with Esc to close and focus trapped inside.
2. **Hero** (`h1` = ROADMAP, visually the giant word). Yellow panel overlaps its lower half.
   Progress capsule (9:16, 6px black border) sticks up out of the panel: labels, red month
   name, mascot, big %. Left: red-ink mono text + **Lanjutkan bulan ini**. Right: dynamic stats line.
   Vertical mono text on both panel edges (`aria-hidden`). On mobile: stacked, capsule 70% wide.
3. **Marquee** band, ~30s per loop, duplicated text, `aria-hidden`, stops on reduced motion.
4. **Bulan ini**: Anton stack (BULAN INI / stage name in red / `*( mascot )` + `1/2`), lines
   connecting to **Lihat checklist** and **AI coach** pills. Then the neural network in a
   `--paper` card (320px / 240px mobile), with nodes as `role="button"` that respond to Enter/Space and a pop animation.
5. **Checklist** `#roadmap` `( 01 )`: `--card` card with scrollable month chips, task rows
   (round custom checkbox, strikethrough when done, delete button on custom tasks), add-task
   form. Black **AI COACH** card beside it (below it on mobile) with copy button, status and fallback textarea.
6. **Portofolio** `#portofolio` `( 02 )`: 3 cards (01/02/03, status chip, title, description,
   links shown only for http(s) URLs, **Edit** opens a `<details>` panel with the form + copy prompt).
7. **Log belajar** `#log` `( 03 )`: form + 10 latest entries on the left. Flower badge
   (`1.5/8 J`) + 8-week horizontal bar chart on the right.
8. **Data** `#data`: export / import / delete-all with an inline confirm panel.
9. **Footer**: mono link list, mono tagline, giant `AIDEV` cut off at the bottom.

**View mode:** if localStorage is empty and `fetch('progress.json')` succeeds, render read-only
(no checkboxes, forms or Edit) with a banner and an **Edit di browser ini** button that copies
the data into localStorage.

## 5. Components

Buttons (primary black pill, secondary outlined, yellow on black), chip (mono, bracketed),
large/small card, marquee, flower badge (SVG of stacked circles), vertical text, connector
line, custom round checkbox, status chip, inline confirm, toast/status line (`aria-live`).

## 6. Work order (one git commit per step)

0. `git init` (the folder is not a repo yet).
1. tokens.css, base.css, components.css + a bare index.html.
2. JS modules: data, store (with norm), prompts, render, network, main. Wire them up and check for console errors.
3. Sections 1–9, one at a time.
4. Animations: per-letter hero rise (40ms stagger, <800ms), count-up, node pop, card hover,
   all off under `prefers-reduced-motion`.
5. `python3 -m http.server 8000` and check in the built-in browser at 1440 / 1024 / 768 / 390 / 360
   (Playwright isn't installed, so the in-app browser handles screenshots).
6. Run the section 10 checklist. Lighthouse a11y via `npx lighthouse` if it installs; otherwise
   a manual a11y pass (contrast, headings, labels, focus).
7. README: structure, how to swap the mascot, how to deploy on GitHub Pages, how view mode works.

Old-data check: since there is no old progress, I'll seed localStorage with a hand-written
object in the exact format above and confirm it loads.
