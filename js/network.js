// Neural-network progress graph: one layer per month, one node per task.
// Two stacked SVGs: the back one is role="img" (edges, labels, summary),
// the front one holds the node buttons (role="button", roving tabindex, arrows).
import { M } from './data.js';
import { monthTasks, esc } from './util.js';

let root = null;
let last = null;          // last render args, for resize
let current = null;       // task id holding tabindex=0
let onToggle = () => {};

export function initNetwork(el, handlers) {
  root = el;
  onToggle = handlers.onToggle;

  root.addEventListener('click', (e) => {
    const node = e.target.closest('.node[data-id]');
    if (!node || last?.readOnly) return;
    current = node.dataset.id;
    onToggle(node.dataset.id);
  });

  root.addEventListener('keydown', (e) => {
    const node = e.target.closest('.node[data-id]');
    if (!node || last?.readOnly) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      current = node.dataset.id;
      onToggle(node.dataset.id);
      return;
    }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], Home: ['first'], End: ['last'] };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const target = neighbour(node.dataset.id, moves[e.key]);
    if (target) focusNode(target);
  });

  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => last && renderNetwork(last.data, { ...last, pop: null }));
  }).observe(root);
}

function grid() {
  return [...root.querySelectorAll('.nn-layer')].map((g) => [...g.querySelectorAll('.node')].map((n) => n.dataset.id)).filter((l) => l.length);
}

function neighbour(id, move) {
  const g = grid();
  const li = g.findIndex((l) => l.includes(id));
  const ni = g[li].indexOf(id);
  if (move[0] === 'first') return g[0][0];
  if (move[0] === 'last') return g[g.length - 1][0];
  const [dx, dy] = move;
  if (dy) return g[li][Math.max(0, Math.min(g[li].length - 1, ni + dy))];
  const nl = g[li + dx];
  return nl ? nl[Math.min(ni, nl.length - 1)] : null;
}

function focusNode(id) {
  root.querySelectorAll('.node[tabindex="0"]').forEach((n) => n.setAttribute('tabindex', '-1'));
  const n = root.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  if (!n) return;
  current = id;
  n.setAttribute('tabindex', '0');
  n.focus({ preventScroll: false });
}

/**
 * @param {object} data tracker data
 * @param {{activeId:string, readOnly:boolean, pop?:string|null}} opts
 */
export function renderNetwork(data, opts) {
  if (!root) return;
  last = { data, ...opts };
  const focusedId = root.contains(document.activeElement) ? document.activeElement.dataset?.id : null;

  const w = Math.max(root.clientWidth, 280);
  const h = Math.max(root.clientHeight, 200);
  const padX = Math.max(26, w * 0.05);
  const top = 22;
  const bottom = 46;
  const span = h - top - bottom;
  const step = (w - 2 * padX) / (M.length - 1);

  const layers = M.map((m, i) => {
    const tasks = monthTasks(data, m);
    const gap = span / Math.max(tasks.length, 1);
    return {
      m,
      x: padX + i * step,
      gap,
      nodes: tasks.map((t, j) => ({ ...t, x: padX + i * step, y: top + gap * (j + 0.5), done: !!data.done[t.id] })),
    };
  });

  const minGap = Math.min(...layers.filter((l) => l.nodes.length).map((l) => l.gap));
  const r = Math.max(4.5, Math.min(11, minGap * 0.3, step * 0.16));
  const hit = Math.max(r + 4, Math.min(22, minGap / 2, step / 2));

  // Which node is tabbable: keep the current one, else first undone in the active month.
  const all = layers.flatMap((l) => l.nodes);
  if (!all.some((n) => n.id === current)) {
    const act = layers.find((l) => l.m.id === opts.activeId);
    current = (act?.nodes.find((n) => !n.done) ?? act?.nodes[0] ?? all[0])?.id ?? null;
  }

  // Edges: off first, then on, so done paths sit on top.
  let off = '', on = '';
  for (let i = 0; i < layers.length - 1; i++) {
    for (const a of layers[i].nodes) for (const b of layers[i + 1].nodes) {
      const line = `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
      if (a.done && b.done) on += line; else off += line;
    }
  }

  const doneCount = all.filter((n) => n.done).length;
  const activeLayer = layers.find((l) => l.m.id === opts.activeId);
  const summary = `Grafik jaringan progres: ${layers.length} lapisan bulan, ${doneCount} dari ${all.length} tugas selesai. Bulan aktif ${activeLayer?.m.name ?? ''}.`;

  const band = activeLayer
    ? `<rect class="nn-band" x="${(activeLayer.x - Math.max(r + 10, 16)).toFixed(1)}" y="${top - 14}" width="${(2 * Math.max(r + 10, 16)).toFixed(1)}" height="${(span + 28).toFixed(1)}" rx="${Math.max(r + 10, 16)}"/>`
    : '';

  const labels = layers.map((l) => `<text class="nn-label${l.m.id === opts.activeId ? ' is-active' : ''}" x="${l.x.toFixed(1)}" y="${h - 14}" text-anchor="middle">${l.m.short}</text>`).join('');

  const ro = opts.readOnly;
  const nodes = layers.map((l) => {
    const isActive = l.m.id === opts.activeId;
    const items = l.nodes.map((n) => {
      const cls = `node${n.done ? ' is-done' : ''}${isActive ? ' is-active' : ''}${opts.pop === n.id ? ' pop' : ''}`;
      const label = `${n.t} (${l.m.short})`;
      const a11y = ro
        ? ''
        : ` role="button" tabindex="${n.id === current ? 0 : -1}" aria-pressed="${n.done}" aria-label="${esc(label)}"`;
      return `<g class="${cls}" data-id="${esc(n.id)}"${a11y}>
        <title>${esc(label)}${n.done ? ' · selesai' : ''}</title>
        <circle class="hit" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${hit.toFixed(1)}"/>
        <circle class="ring" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(r + 5).toFixed(1)}"/>
        <circle class="dot" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(1)}"/>
      </g>`;
    }).join('');
    return `<g class="nn-layer" data-month="${l.m.id}">${items}</g>`;
  }).join('');

  root.innerHTML = `
    <svg class="nn-back" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(summary)}">
      ${band}
      <g class="nn-edges">${off}</g>
      <g class="nn-edges is-on">${on}</g>
      ${labels}
    </svg>
    <svg class="nn-front" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${ro ? 'aria-hidden="true"' : 'role="group" aria-label="Simpul tugas. Enter atau Spasi untuk mencentang, panah untuk pindah."'}>
      ${nodes}
    </svg>`;

  if (focusedId) {
    const n = root.querySelector(`.node[data-id="${CSS.escape(focusedId)}"]`);
    if (n) { root.querySelectorAll('.node[tabindex="0"]').forEach((x) => x.setAttribute('tabindex', '-1')); n.setAttribute('tabindex', '0'); n.focus({ preventScroll: true }); }
  }
}
