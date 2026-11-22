// Hero: a slowly rotating 3D neural network drawn on a 2D canvas.
// One ring of nodes per month (layer), one node per task. Done tasks glow,
// signals travel along the edges, the active month pulses. Decorative only.
import { M } from './data.js';
import { monthTasks } from './util.js';

const LIME = [212, 255, 58];
const BONE = [237, 234, 227];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function initHero(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let nodes = [];          // {id, layer, x, y, z, done, active}
  let edges = [];          // [a, b] node indexes
  let layerInfo = [];      // {short, r, active}
  const dust = [];
  const pulses = [];
  const bursts = new Map(); // node id -> start time
  let rotY = -0.5, tiltX = 0.18, tiltY = 0, tX = 0.18, tY = 0;
  let running = false, visible = true, raf = 0, lastSpawn = 0, last = performance.now();

  // Glow sprite (drawn once, stamped for every glowing node)
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  const g = glow.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, rgba(LIME, .9));
  grad.addColorStop(.25, rgba(LIME, .35));
  grad.addColorStop(1, rgba(LIME, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 260; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = 1.6 + Math.random() * 2.6;
    dust.push({ x: rr * Math.sqrt(1 - u * u) * Math.cos(th), y: rr * u * .7, z: rr * Math.sqrt(1 - u * u) * Math.sin(th), a: .08 + Math.random() * .22 });
  }

  function build(data, activeId) {
    const L = M.length;
    const spacing = 0.62;
    nodes = []; edges = []; layerInfo = [];
    const byLayer = [];
    M.forEach((m, i) => {
      const tasks = monthTasks(data, m);
      const r = 0.42 + 0.5 * Math.sin(Math.PI * (i + 0.5) / L);
      const x = (i - (L - 1) / 2) * spacing;
      const ids = [];
      tasks.forEach((t, j) => {
        const th = (j / tasks.length) * Math.PI * 2 + i * 0.7;
        ids.push(nodes.length);
        nodes.push({ id: t.id, layer: i, x, y: r * Math.cos(th), z: r * Math.sin(th), done: !!data.done[t.id], active: m.id === activeId });
      });
      byLayer.push(ids);
      layerInfo.push({ short: m.short, r, x, active: m.id === activeId });
    });
    for (let i = 0; i < byLayer.length - 1; i++) for (const a of byLayer[i]) for (const b of byLayer[i + 1]) edges.push([a, b]);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(performance.now());
  }

  function project(p, cx, cy, F) {
    // rotate Y then X
    const cy1 = Math.cos(rotY + tiltY), sy1 = Math.sin(rotY + tiltY);
    let x = p.x * cy1 + p.z * sy1;
    let z = -p.x * sy1 + p.z * cy1;
    const cx1 = Math.cos(tiltX), sx1 = Math.sin(tiltX);
    const y = p.y * cx1 - z * sx1;
    z = p.y * sx1 + z * cx1;
    const D = 4.2;
    const s = F / (D + z);
    return { sx: cx + x * s, sy: cy - y * s, s, z };
  }

  function draw(now) {
    const dt = Math.min(50, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    if (!nodes.length) return;

    const mobile = W < 768;
    const cx = mobile ? W * 0.5 : W * 0.66;
    const cy = mobile ? H * 0.34 : H * 0.38;
    const F = mobile ? Math.min(W * 1.02, H * 0.9) : Math.min(W * 0.6, H * 1.05);

    if (!reduced) {
      rotY += dt * 0.00009;
      tiltX += (tX - tiltX) * 0.04;
      tiltY += (tY - tiltY) * 0.04;
    }

    // Dust
    for (const d of dust) {
      const p = project(d, cx, cy, F);
      if (p.s <= 0) continue;
      ctx.fillStyle = rgba(BONE, d.a * Math.min(1, p.s / (F / 4.2)));
      ctx.fillRect(p.sx, p.sy, 1.2, 1.2);
    }

    const P = nodes.map((n) => project(n, cx, cy, F));
    const base = F / 4.2;

    // Edges
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const pa = P[a], pb = P[b];
      const depth = Math.max(0, Math.min(1, ((pa.s + pb.s) / 2 / base - 0.75) * 2));
      const on = nodes[a].done && nodes[b].done;
      ctx.strokeStyle = on ? rgba(LIME, 0.3 + depth * 0.5) : rgba(BONE, 0.04 + depth * 0.1);
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }

    // Signals travelling along edges
    if (!reduced && now - lastSpawn > 90 && edges.length) {
      lastSpawn = now;
      const pick = edges[(Math.random() * edges.length) | 0];
      const lit = nodes[pick[0]].done;
      if (lit || Math.random() < 0.55) pulses.push({ e: pick, t: 0, v: 0.0006 + Math.random() * 0.0006, lit });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pu = pulses[i];
      pu.t += pu.v * dt;
      if (pu.t >= 1) { pulses.splice(i, 1); continue; }
      const pa = P[pu.e[0]], pb = P[pu.e[1]];
      const x = pa.sx + (pb.sx - pa.sx) * pu.t, y = pa.sy + (pb.sy - pa.sy) * pu.t;
      const fade = Math.sin(pu.t * Math.PI);
      if (pu.lit) {
        const sz = 22 * fade;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glow, x - sz / 2, y - sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = rgba(BONE, 0.55 * fade);
        ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Nodes, far to near
    const order = P.map((p, i) => i).sort((a, b) => P[b].z - P[a].z);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
    for (const i of order) {
      const n = nodes[i], p = P[i];
      const k = p.s / base;
      const r = Math.max(2, (mobile ? 4.4 : 6) * k);
      const b = bursts.get(n.id);
      if (b !== undefined) {
        const t = (now - b) / 900;
        if (t >= 1) bursts.delete(n.id);
        else {
          ctx.strokeStyle = rgba(LIME, (1 - t) * 0.8);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r + t * 46, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (n.done) {
        const sz = r * 9;
        ctx.drawImage(glow, p.sx - sz / 2, p.sy - sz / 2, sz, sz);
        ctx.fillStyle = rgba(LIME, 1);
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#0B0B0C';
        ctx.strokeStyle = n.active ? rgba(LIME, 0.6 + pulse * 0.4) : rgba(BONE, 0.35 + 0.45 * Math.max(0, Math.min(1, k - 0.6)));
        ctx.lineWidth = n.active ? 1.8 : 1.3;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (n.active && !reduced) {
          ctx.strokeStyle = rgba(LIME, 0.25 * (1 - pulse));
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 4 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // Month labels under each layer
    ctx.font = `${mobile ? 10 : 11}px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    for (const l of layerInfo) {
      const p = project({ x: l.x, y: -l.r - 0.2, z: 0 }, cx, cy, F);
      ctx.fillStyle = l.active ? rgba(LIME, 0.95) : rgba(BONE, 0.38);
      ctx.fillText(l.short, p.sx, p.sy);
    }
  }

  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduced || !visible || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      tY = (e.clientX / window.innerWidth - 0.5) * 0.5;
      tX = 0.18 + (e.clientY / window.innerHeight - 0.5) * 0.3;
    }, { passive: true });
  }

  return {
    update(data, activeId) { build(data, activeId); if (!W) resize(); if (!running) { draw(performance.now()); start(); } },
    burst(id) { bursts.set(id, performance.now()); },
  };
}
