// Roadmap, projects and statuses.
// ⚠️ Do NOT change month or task ids: progress in localStorage is keyed on them.
// Changing a task's text or date is fine.

export const KEY = 'aidev-tracker-v1';

// Mascot image used everywhere on the page. To use your own:
// save it as assets/mascot.png (1:1, transparent) and change this line to 'assets/mascot.png'.
export const MASCOT_SRC = 'assets/mascot.svg';
export const WEEK_TARGET = 8; // hours per week

/** @typedef {{id:string, t:string, d:string}} Task */
/** @type {{id:string, short:string, name:string, phase:string, stage:string, start:string, end:string, tasks:Task[]}[]} */
export const M = [
  {
    id: 'm0', short: 'NOV', name: 'November 2026', phase: 'FASE 0', stage: 'Ujian dulu',
    start: '2026-11-01', end: '2026-12-05', // ujian sampai 5 Desember
    tasks: [
      { id: 'm0-1', t: 'Selesaikan UAS dan tugas akhir semester', d: '2026-12-05' },
      { id: 'm0-2', t: 'Setup: Python 3.12, VS Code, Git, akun GitHub dan Kaggle', d: '2026-12-05' },
    ],
  },
  {
    id: 'm1', short: 'DES', name: 'Desember 2026', phase: 'FASE 1', stage: 'Python dasar',
    start: '2026-12-06', end: '2026-12-31',
    tasks: [
      { id: 'm1-1', t: 'Python dasar: tipe data, kondisi, perulangan, fungsi', d: '2026-12-10' },
      { id: 'm1-2', t: 'List, dict, set, dan comprehension', d: '2026-12-13' },
      { id: 'm1-3', t: 'OOP, modul, dan virtual environment', d: '2026-12-17' },
      { id: 'm1-4', t: 'NumPy: array, indexing, broadcasting', d: '2026-12-21' },
      { id: 'm1-5', t: 'Pandas: baca CSV, filter, groupby, merge', d: '2026-12-26' },
      { id: 'm1-6', t: 'Mini proyek: analisis dataset CSV + grafik Matplotlib', d: '2026-12-31' },
    ],
  },
  {
    id: 'm2', short: 'JAN', name: 'Januari 2027', phase: 'FASE 2', stage: 'ML dasar',
    start: '2027-01-01', end: '2027-01-31',
    tasks: [
      { id: 'm2-1', t: 'Aljabar linear untuk ML: vektor, matriks, dot product', d: '2027-01-06' },
      { id: 'm2-2', t: 'Statistik dan probabilitas dasar', d: '2027-01-10' },
      { id: 'm2-3', t: 'Regresi linear dan logistik dengan scikit-learn', d: '2027-01-15' },
      { id: 'm2-4', t: 'Train/test split, cross-validation, metrik evaluasi', d: '2027-01-20' },
      { id: 'm2-5', t: 'Decision tree dan random forest', d: '2027-01-25' },
      { id: 'm2-6', t: 'Kaggle pertama: submit Titanic', d: '2027-01-31' },
    ],
  },
  {
    id: 'm3', short: 'FEB', name: 'Februari 2027', phase: 'FASE 3', stage: 'ML lanjut',
    start: '2027-02-01', end: '2027-02-28',
    tasks: [
      { id: 'm3-1', t: 'Feature engineering dan Pipeline scikit-learn', d: '2027-02-05' },
      { id: 'm3-2', t: 'Gradient boosting: XGBoost atau LightGBM', d: '2027-02-11' },
      { id: 'm3-3', t: 'Clustering dan PCA', d: '2027-02-16' },
      { id: 'm3-4', t: 'Proyek 1: model prediksi data tabular end-to-end', d: '2027-02-23' },
      { id: 'm3-5', t: 'Deploy proyek 1 (Streamlit atau Hugging Face Spaces)', d: '2027-02-28' },
    ],
  },
  {
    id: 'm4', short: 'MAR', name: 'Maret 2027', phase: 'FASE 4', stage: 'PyTorch',
    start: '2027-03-01', end: '2027-03-31',
    tasks: [
      { id: 'm4-1', t: 'Tensor dan autograd PyTorch', d: '2027-03-05' },
      { id: 'm4-2', t: 'Neural network (MLP) dari nol di PyTorch', d: '2027-03-10' },
      { id: 'm4-3', t: 'Training loop, optimizer, mengatasi overfitting', d: '2027-03-15' },
      { id: 'm4-4', t: 'CNN untuk klasifikasi gambar', d: '2027-03-20' },
      { id: 'm4-5', t: 'Transfer learning dengan model pretrained', d: '2027-03-25' },
      { id: 'm4-6', t: 'Proyek 2: image classifier PyTorch, online', d: '2027-03-31' },
    ],
  },
  {
    id: 'm5', short: 'APR', name: 'April 2027', phase: 'FASE 5', stage: 'NLP & LLM',
    start: '2027-04-01', end: '2027-04-30',
    tasks: [
      { id: 'm5-1', t: 'Tokenisasi, embedding, dan konsep attention', d: '2027-04-06' },
      { id: 'm5-2', t: 'Transformer dengan Hugging Face: pipeline dan fine-tuning kecil', d: '2027-04-13' },
      { id: 'm5-3', t: 'Prompt engineering dan memakai API LLM', d: '2027-04-18' },
      { id: 'm5-4', t: 'RAG: embedding + vector store', d: '2027-04-24' },
      { id: 'm5-5', t: 'Ikut satu kompetisi Kaggle NLP atau LLM', d: '2027-04-30' },
    ],
  },
  {
    id: 'm6', short: 'MEI', name: 'Mei 2027', phase: 'FASE 6', stage: 'Portofolio',
    start: '2027-05-01', end: '2027-05-31',
    tasks: [
      { id: 'm6-1', t: 'Proyek 3: chatbot RAG untuk dokumen kuliah', d: '2027-05-10' },
      { id: 'm6-2', t: 'Deploy proyek 3 dan tulis README', d: '2027-05-15' },
      { id: 'm6-3', t: 'Deskripsi bahasa Inggris untuk ketiga proyek', d: '2027-05-20' },
      { id: 'm6-4', t: 'Perbarui CV, LinkedIn, dan profil GitHub', d: '2027-05-25' },
      { id: 'm6-5', t: 'Kirim 5 lamaran magang AI/ML', d: '2027-05-31' },
    ],
  },
];

export const P = [
  {
    id: 'p1', title: 'Tabular Prediction Model', phase: 'FASE 3',
    stack: 'Python · pandas · scikit-learn · LightGBM · Streamlit',
    idea: 'Model prediksi end-to-end untuk data tabular, dari EDA sampai aplikasi web.',
  },
  {
    id: 'p2', title: 'PyTorch Image Classifier', phase: 'FASE 4',
    stack: 'PyTorch · torchvision · transfer learning · Gradio',
    idea: 'Klasifikasi gambar dengan transfer learning, bisa dicoba langsung di browser.',
  },
  {
    id: 'p3', title: 'RAG Study Assistant', phase: 'FASE 6',
    stack: 'Python · embeddings · vector store · LLM API',
    idea: 'Chatbot yang menjawab pertanyaan dari materi kuliah dengan sumber yang dikutip.',
  },
];

// Project status values. Keys are what gets stored.
export const ST = {
  '': 'Belum mulai',
  wip: 'Dikerjakan',
  online: 'Online',
};

export const TICKER = ['Python', 'NumPy', 'Pandas', 'Machine learning', 'scikit-learn', 'PyTorch', 'Kaggle', 'Transformer', 'LLM', 'RAG', 'Portofolio'];

// Habit tracker. Default habits for a fresh tracker; ids are stable, so don't change them.
// end = last day the habit runs (optional). goal = target days per week (1-7).
export const EXAM_END = '2026-12-05';
export const HABIT_DEFAULTS = [
  { id: 'h-exam', name: 'Belajar materi ujian', goal: 6, end: EXAM_END },
  { id: 'h-ai', name: 'Belajar AI 30 menit', goal: 5, end: '' },
  { id: 'h-move', name: 'Olahraga atau jalan 20 menit', goal: 3, end: '' },
  { id: 'h-sleep', name: 'Tidur sebelum jam 12', goal: 7, end: '' },
];
export const HABIT_MAX = 12;
// Once a day's logged minutes reach this, the 'h-ai' habit is ticked for that day.
export const HABIT_AI_MIN = 30;
// Log notes of finished pomodoro sessions start with this word.
export const FOCUS_TAG = 'Pomodoro';

export const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const MONTHS_ID = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
export const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
