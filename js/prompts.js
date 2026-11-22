// Prompt builders (no AI API calls from the site) + copy with textarea fallback.
import { M, P, ST, WEEK_TARGET, EXAM_END } from './data.js';
import {
  activeMonth, monthProgress, totals, thisWeekMinutes, weeks, overdue,
  fmtHours, fmtLong, todayStr, habitActive, habitWeekCount, habitStreak, habitConsistency, lastDays,
  focusStats, weekOf, weekSummary,
} from './util.js';

export function coachPrompt(data) {
  const today = todayStr();
  const month = activeMonth(today);
  const mp = monthProgress(data, month);
  const t = totals(data);
  const last4 = weeks(data, 4).reduce((s, w) => s + w.minutes, 0) / 4;
  const late = overdue(data, today).filter((x) => x.month.id !== month.id);
  const recent = [...data.log].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 5);
  const next = M[M.indexOf(month) + 1];

  const lines = [
    'Kamu adalah AI coach untuk mahasiswa yang menjalani roadmap 6 bulan menjadi AI developer sambil kuliah.',
    'Jawab dalam bahasa Indonesia, singkat, konkret, dan realistis untuk jadwal mahasiswa.',
    '',
    'KONTEKS',
    `- Hari ini: ${fmtLong(today)}`,
    `- Bulan aktif: ${month.name} (${month.phase}: ${month.stage})`,
    `- Progres total: ${t.done} dari ${t.total} tugas (${t.pct}%)`,
    `- Progres bulan ini: ${mp.done} dari ${mp.total} tugas`,
    `- Jam belajar minggu ini: ${fmtHours(thisWeekMinutes(data))} dari target ${WEEK_TARGET} jam`,
    `- Rata-rata 4 minggu terakhir: ${fmtHours(last4)} jam per minggu`,
    `- Proyek: ${P.map((p) => `${p.title} (${ST[data.projects[p.id]?.status ?? '']})`).join(', ')}`,
    ...focusLine(data),
    ...promiseLine(data, today),
    ...(today <= EXAM_END ? [`- Saya masih ujian sampai ${fmtLong(EXAM_END)}. Jangan bebani berlebihan sebelum tanggal itu.`] : []),
    '',
    'TUGAS BULAN INI',
    ...mp.tasks.map((x) => `[${data.done[x.id] ? 'x' : ' '}] ${x.t}${x.d ? ` (target ${fmtLong(x.d)})` : ''}`),
  ];
  const habits = data.habits.filter((h) => habitActive(h, today));
  if (habits.length) {
    const days = lastDays(7);
    lines.push('', `KEBIASAAN (7 hari terakhir, x = dikerjakan; target 4 minggu tercapai ${habitConsistency(data)}%)`);
    for (const h of habits) {
      const marks = days.map((d) => (h.days.includes(d) ? 'x' : '.')).join('');
      const st = habitStreak(h);
      lines.push(`- ${h.name}: ${marks} | ${habitWeekCount(h)}/${h.goal} minggu ini${st > 1 ? `, beruntun ${st} hari` : ''}${h.end ? `, sampai ${fmtLong(h.end)}` : ''}`);
    }
  }
  if (late.length) {
    lines.push('', 'TERTINGGAL DARI BULAN SEBELUMNYA', ...late.map((x) => `[ ] ${x.t} (${x.month.short})`));
  }
  if (next) {
    lines.push('', `BULAN DEPAN: ${next.name} (${next.stage})`, ...next.tasks.map((x) => `- ${x.t}`));
  }
  lines.push('', 'LOG BELAJAR TERBARU');
  if (recent.length) lines.push(...recent.map((e) => `- ${e.d}, ${e.m} menit${e.n ? `: ${e.n}` : ''}`));
  else lines.push('- (belum ada catatan)');
  lines.push(
    '',
    'YANG SAYA BUTUHKAN',
    '1. Evaluasi singkat: apakah saya on track? Sebut satu risiko terbesar.',
    `2. Rencana 7 hari ke depan, total maksimal ${WEEK_TARGET} jam, sesi 30 sampai 90 menit, sebut tugas mana dari daftar di atas.`,
    '3. Satu sumber belajar gratis terbaik untuk tugas berikutnya (dokumentasi resmi atau kursus gratis).',
    '4. Satu pertanyaan untuk mengecek pemahaman saya tentang materi terakhir di log.',
    '5. Kebiasaan mana yang paling sering bolong, dan satu trik kecil supaya lebih konsisten.',
  );
  return lines.join('\n');
}

function focusLine(data) {
  const f = focusStats(data, 7);
  if (!f.sessions) return [];
  return [`- Pomodoro 7 hari terakhir: ${f.sessions} sesi, ${fmtHours(f.total)} jam, rata-rata ${f.avg} menit per sesi${f.top ? `; paling banyak untuk "${f.top[0]}"` : ''}`];
}
/** What last week's review said this week should focus on. */
function promiseLine(data, today) {
  const p = weekSummary(data, weekOf(today), today).promise.trim();
  return p ? [`- Fokus yang saya tetapkan untuk minggu ini (dari review minggu lalu): ${p}`] : [];
}

/** Prompt for the weekly review of the week starting at `start` (Monday). */
export function reviewPrompt(data, start) {
  const w = weekSummary(data, start);
  const r = w.review;
  const lines = [
    'Kamu adalah AI coach untuk mahasiswa yang menjalani roadmap 6 bulan menjadi AI developer sambil kuliah.',
    'Ini review mingguan saya. Jawab dalam bahasa Indonesia, singkat, jujur, dan realistis untuk jadwal mahasiswa.',
    '',
    `MINGGU ${fmtLong(w.start)} – ${fmtLong(w.end)}`,
    `- Jam belajar: ${fmtHours(w.minutes)} dari target ${WEEK_TARGET} jam${w.hit ? ' (tercapai)' : ''}`,
    `- Hari aktif belajar: ${w.activeDays} dari 7`,
    `- Pomodoro: ${w.focusSessions} sesi, ${fmtHours(w.focusMin)} jam`,
    w.best ? `- Hari terbaik: ${w.best.name}, ${w.best.min} menit` : '- Belum ada sesi belajar tercatat minggu ini',
    `- Kebiasaan yang mencapai target: ${w.habitsMet} dari ${w.habits.length}`,
    ...w.habits.map((x) => `  - ${x.h.name}: ${x.done}/${x.want}`),
  ];
  if (w.due.length) lines.push('', 'TENGGAT MINGGU INI', ...w.due.map((t) => `[${t.done ? 'x' : ' '}] ${t.t}`));
  if (w.overdue.length) lines.push('', 'MASIH TERTINGGAL', ...w.overdue.map((t) => `[ ] ${t.t} (target ${fmtLong(t.d)})`));
  if (w.promise) lines.push('', `JANJI MINGGU LALU: ${w.promise.trim()}`);
  lines.push('', 'REFLEKSI SAYA',
    `- Yang berhasil: ${r.win?.trim() || '(belum diisi)'}`,
    `- Yang macet: ${r.stuck?.trim() || '(belum diisi)'}`,
    `- Fokus minggu depan: ${r.next?.trim() || '(belum diisi)'}`,
    '',
    'YANG SAYA BUTUHKAN',
    '1. Nilai minggu ini dalam satu kalimat, lalu satu hal yang perlu dipertahankan.',
    '2. Penyebab paling mungkin dari yang macet, dan satu perubahan kecil untuk minggu depan.',
    `3. Rencana 7 hari ke depan: maksimal ${WEEK_TARGET} jam, sesi 25 sampai 50 menit (pomodoro), sebut tugasnya. Dahulukan yang tertinggal.`,
    '4. Kalau "fokus minggu depan" saya terlalu besar atau kabur, bantu pecah jadi 2 sampai 3 target yang bisa dicek.',
  );
  return lines.join('\n');
}

export function descPrompt(data, projectId) {
  const p = P.find((x) => x.id === projectId);
  const s = data.projects[projectId];
  return [
    'You are helping a computer science student write a portfolio description for a machine learning project.',
    'Write in clear, simple English for recruiters. Do not invent results, numbers or features.',
    '',
    `Project: ${p.title}`,
    `Planned stack: ${p.stack}`,
    `Idea: ${p.idea}`,
    `Status: ${ST[s.status]}`,
    `GitHub: ${s.github || '-'}`,
    `Live demo: ${s.demo || '-'}`,
    `My notes (may be in Indonesian): ${s.notes.trim() || '(no notes yet)'}`,
    s.desc.trim() ? `Current description: ${s.desc.trim()}` : '',
    '',
    'Please write:',
    '1. A one-sentence summary, max 25 words.',
    '2. A 3 to 4 sentence description: the problem, the approach, the tools, and the result. Use only facts from my notes; write [TODO: metric] where a number is missing.',
    '3. Three short bullet points I can put on my CV.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

/**
 * Copy text. If the clipboard is blocked, show the text in a fallback textarea and select it.
 * @returns {Promise<boolean>} true when the clipboard write worked
 */
export async function copyText(text, { status, fallback }) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    if (fallback) fallback.hidden = true;
    setStatus(status, 'Prompt tersalin. Tempel ke ChatGPT, Claude, atau Gemini.');
    return true;
  } catch {
    if (fallback) {
      const ta = fallback.querySelector('textarea');
      fallback.hidden = false;
      ta.value = text;
      ta.focus();
      ta.select();
    }
    setStatus(status, 'Clipboard ditolak browser. Salin manual dari kotak di bawah (sudah terpilih).', true);
    return false;
  }
}

function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = '';
  el.classList.toggle('is-error', isError);
  // Re-set after a tick so screen readers announce repeated messages.
  setTimeout(() => { el.textContent = msg; }, 30);
}
