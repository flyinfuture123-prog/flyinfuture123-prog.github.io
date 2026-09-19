/* 學測數A預測題庫 —— 核心意義動畫
 *
 * 每個動畫是一個 spec：{ w, h, defaults, steps(p) | steps:[{title, text, dur}], draw(c) }。
 * c.p 是該題的參數（來自 questions.js 的 q.params，缺的欄位用 spec.defaults 補），同一段動畫因此能演不同數字的題目。
 * draw() 每一影格都會被呼叫，並把整個畫面重畫一次；c.P(i) 給出第 i 步的進度（0～1，已套用緩動），
 * 前面的步驟回傳 1、後面的回傳 0，所以畫面永遠是「到目前為止所有步驟的疊加」。
 * 這個檔案在瀏覽器以外（Node 自我檢查）也會被載入，因此最上層不能碰 document。
 */
window.ANIM = (function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const registry = {};
  const C = {
    ink: "var(--ink)", ink2: "var(--ink-2)", ink3: "var(--ink-3)", grid: "var(--grid)", axis: "var(--axis)",
    c1: "var(--c1)", c2: "var(--c2)", c3: "var(--c3)", c4: "var(--c4)", c5: "var(--c5)",
    ok: "var(--ok)", bad: "var(--bad)", warn: "var(--warn)", accent: "var(--accent)", surface: "var(--surface)", surface2: "var(--surface-2)"
  };

  /* ---------- 基本工具 ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); };
  const sub = (p, a, b) => clamp01((p - a) / (b - a));
  const fmt = (n, d = 2) => { const s = Number(n).toFixed(d); return s.replace(/\.?0+$/, "") === "-0" ? "0" : s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""); };
  const PI = Math.PI;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) setAttrs(e, attrs);
    if (parent) parent.appendChild(e);
    return e;
  }
  function setAttrs(e, attrs) {
    let style = "";
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null) continue;
      if (k === "text") e.textContent = String(v);
      else if (k === "cls") e.setAttribute("class", v);
      else if (k === "style") style += v + ";";
      else if (k === "fill" || k === "stroke") style += k + ":" + v + ";";
      else e.setAttribute(k, String(v));
    }
    if (style) e.setAttribute("style", style);
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- 座標平面 ---------- */
  function plane(svg, o) {
    const pad = Object.assign({ l: 34, r: 16, t: 16, b: 30 }, o.pad || {});
    const iw = o.w - pad.l - pad.r, ih = o.h - pad.t - pad.b;
    let sx = iw / (o.x1 - o.x0), sy = ih / (o.y1 - o.y0);
    let ox = pad.l, oy = pad.t;
    if (o.square) { // 等比例：以較小的比例為準並置中
      const s = Math.min(sx, sy); ox += (iw - s * (o.x1 - o.x0)) / 2; oy += (ih - s * (o.y1 - o.y0)) / 2; sx = sy = s;
    }
    const X = (x) => ox + (x - o.x0) * sx;
    const Y = (y) => oy + (o.y1 - y) * sy;
    const g = el("g", null, svg);
    return { X, Y, g, sx, sy, o, svg };
  }
  function grid(pl, step = 1, attrs) {
    const { X, Y, o, g } = pl; const a = Object.assign({ stroke: C.grid, "stroke-width": 1 }, attrs || {});
    for (let x = Math.ceil(o.x0 / step) * step; x <= o.x1 + 1e-9; x += step) el("line", Object.assign({ x1: X(x), y1: Y(o.y0), x2: X(x), y2: Y(o.y1) }, a), g);
    for (let y = Math.ceil(o.y0 / step) * step; y <= o.y1 + 1e-9; y += step) el("line", Object.assign({ x1: X(o.x0), y1: Y(y), x2: X(o.x1), y2: Y(y) }, a), g);
  }
  function axes(pl, opt) {
    opt = opt || {};
    const { X, Y, o, g } = pl; const xs = opt.xStep || 1, ys = opt.yStep || 1;
    const ax = Object.assign({ stroke: C.axis, "stroke-width": 1.4 }, opt.attrs || {});
    const y0 = clamp(0, o.y0, o.y1), x0 = clamp(0, o.x0, o.x1);
    el("line", Object.assign({ x1: X(o.x0), y1: Y(y0), x2: X(o.x1), y2: Y(y0) }, ax), g);
    el("line", Object.assign({ x1: X(x0), y1: Y(o.y0), x2: X(x0), y2: Y(o.y1) }, ax), g);
    head(g, X(o.x1), Y(y0), 0, C.axis); head(g, X(x0), Y(o.y1), -PI / 2, C.axis);
    const lab = { "font-size": 11, fill: C.ink3, cls: "mono", "text-anchor": "middle" };
    if (opt.xTicks !== false) for (let x = Math.ceil(o.x0 / xs) * xs; x <= o.x1 - xs * 0.4; x += xs) {
      if (Math.abs(x) < 1e-9 && opt.zero === false) continue;
      if (Math.abs(x) < 1e-9 && !opt.zero) continue;
      el("line", { x1: X(x), y1: Y(y0) - 3, x2: X(x), y2: Y(y0) + 3, stroke: C.axis }, g);
      el("text", Object.assign({ x: X(x), y: Y(y0) + 15, text: opt.xFmt ? opt.xFmt(x) : fmt(x) }, lab), g);
    }
    if (opt.yTicks !== false) for (let y = Math.ceil(o.y0 / ys) * ys; y <= o.y1 - ys * 0.4; y += ys) {
      if (Math.abs(y) < 1e-9) continue;
      el("line", { x1: X(x0) - 3, y1: Y(y), x2: X(x0) + 3, y2: Y(y), stroke: C.axis }, g);
      el("text", Object.assign({ x: X(x0) - 7, y: Y(y) + 4, text: opt.yFmt ? opt.yFmt(y) : fmt(y) }, lab, { "text-anchor": "end" }), g);
    }
    if (opt.xLabel) el("text", { x: X(o.x1) - 4, y: Y(y0) - 6, text: opt.xLabel, "font-size": 12, fill: C.ink2, cls: "math", "text-anchor": "end" }, g);
    if (opt.yLabel) el("text", { x: X(x0) + 8, y: Y(o.y1) + 12, text: opt.yLabel, "font-size": 12, fill: C.ink2, cls: "math" }, g);
  }
  /* 箭頭頭部：在像素座標 (x,y)，朝向角 ang（弧度，螢幕座標系，順時針為正） */
  function head(g, x, y, ang, color, size = 7) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const p = (dx, dy) => (x + dx * c - dy * s) + "," + (y + dx * s + dy * c);
    el("polygon", { points: [p(0, 0), p(-size, -size * 0.55), p(-size, size * 0.55)].join(" "), fill: color }, g);
  }
  function seg(pl, x1, y1, x2, y2, p, attrs) {
    if (p <= 0) return null;
    const { X, Y, g } = pl; const ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
    return el("line", Object.assign({ x1: X(x1), y1: Y(y1), x2: X(ex), y2: Y(ey), stroke: C.ink, "stroke-width": 2, "stroke-linecap": "round" }, attrs || {}), g);
  }
  function arrow(pl, x1, y1, x2, y2, p, attrs) {
    if (p <= 0) return;
    const { X, Y, g } = pl; const a = Object.assign({ stroke: C.c1, "stroke-width": 2.2, "stroke-linecap": "round" }, attrs || {});
    const ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
    const dx = X(ex) - X(x1), dy = Y(ey) - Y(y1); const len = Math.hypot(dx, dy); if (len < 0.5) return;
    const ang = Math.atan2(dy, dx); const hs = a.head || 8;
    el("line", { x1: X(x1), y1: Y(y1), x2: X(ex) - Math.cos(ang) * hs * 0.6, y2: Y(ey) - Math.sin(ang) * hs * 0.6, stroke: a.stroke, "stroke-width": a["stroke-width"], "stroke-linecap": "round", "stroke-dasharray": a["stroke-dasharray"], opacity: a.opacity }, g);
    head(g, X(ex), Y(ey), ang, a.stroke, hs);
  }
  function dot(pl, x, y, attrs) {
    const { X, Y, g } = pl; return el("circle", Object.assign({ cx: X(x), cy: Y(y), r: 4, fill: C.c1, stroke: C.surface, "stroke-width": 1.5 }, attrs || {}), g);
  }
  function label(pl, x, y, str, attrs) {
    const { X, Y, g } = pl; const a = Object.assign({ "font-size": 12.5, fill: C.ink, dx: 0, dy: 0, "text-anchor": "middle" }, attrs || {});
    const t = el("text", { x: X(x) + a.dx, y: Y(y) + a.dy, text: str, "font-size": a["font-size"], fill: a.fill, "text-anchor": a["text-anchor"], cls: a.cls, "font-weight": a["font-weight"], opacity: a.opacity }, g);
    return t;
  }
  /* 有底色的文字標籤（像素座標） */
  function tag(svg, x, y, str, attrs) {
    const a = Object.assign({ "font-size": 12.5, fill: C.ink, bg: C.surface, anchor: "start", pad: 5, stroke: C.grid }, attrs || {});
    const g = el("g", { opacity: a.opacity }, svg);
    const w = textWidth(str, a["font-size"]) + a.pad * 2, h = a["font-size"] * 1.5;
    const x0 = a.anchor === "middle" ? x - w / 2 : a.anchor === "end" ? x - w : x;
    el("rect", { x: x0, y: y - h / 2, width: w, height: h, rx: 5, fill: a.bg, stroke: a.stroke, "stroke-width": 1 }, g);
    el("text", { x: x0 + a.pad, y: y + a["font-size"] * 0.36, text: str, "font-size": a["font-size"], fill: a.fill, cls: a.cls, "font-weight": a["font-weight"] }, g);
    return g;
  }
  function textWidth(str, size) { // 粗估：中文字全形，其他半形
    let w = 0; for (const ch of String(str)) w += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.58; return w * size;
  }
  /* 函數圖形：畫出 f 在 [a, a+(b-a)p] 的部分 */
  function curve(pl, f, a, b, p, attrs, n = 160) {
    if (p <= 0) return null;
    const { X, Y, g, o } = pl; const end = lerp(a, b, p); const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(a, end, i / n); let y = f(x);
      if (!isFinite(y)) { pts.push(null); continue; }
      y = clamp(y, o.y0 - 2, o.y1 + 2); pts.push([X(x), Y(y)]);
    }
    let d = "", pen = false;
    for (const q of pts) { if (!q) { pen = false; continue; } d += (pen ? "L" : "M") + fmt(q[0], 1) + " " + fmt(q[1], 1); pen = true; }
    return el("path", Object.assign({ d, fill: "none", stroke: C.c1, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }, attrs || {}), g);
  }
  function poly(pl, pts, attrs) {
    const { X, Y, g } = pl; return el("polygon", Object.assign({ points: pts.map(q => fmt(X(q[0]), 1) + "," + fmt(Y(q[1]), 1)).join(" "), fill: C.c1, opacity: 0.15, stroke: "none" }, attrs || {}), g);
  }
  function polyline(pl, pts, attrs) {
    const { X, Y, g } = pl; return el("polyline", Object.assign({ points: pts.map(q => fmt(X(q[0]), 1) + "," + fmt(Y(q[1]), 1)).join(" "), fill: "none", stroke: C.ink, "stroke-width": 2 }, attrs || {}), g);
  }
  function circle(pl, cx, cy, r, attrs) {
    const { X, Y, g, sx } = pl; return el("circle", Object.assign({ cx: X(cx), cy: Y(cy), r: r * sx, fill: "none", stroke: C.c1, "stroke-width": 2 }, attrs || {}), g);
  }
  /* 弧：平面座標，角度為數學角（弧度、逆時針） */
  function arc(pl, cx, cy, r, a0, a1, attrs) {
    const { X, Y, g, sx } = pl; if (Math.abs(a1 - a0) < 1e-6) return null;
    const R = r * sx, x0 = X(cx) + R * Math.cos(a0), y0 = Y(cy) - R * Math.sin(a0), x1 = X(cx) + R * Math.cos(a1), y1 = Y(cy) - R * Math.sin(a1);
    const large = Math.abs(a1 - a0) > PI ? 1 : 0, sweep = a1 > a0 ? 0 : 1;
    return el("path", Object.assign({ d: `M${fmt(x0, 1)} ${fmt(y0, 1)} A${fmt(R, 1)} ${fmt(R, 1)} 0 ${large} ${sweep} ${fmt(x1, 1)} ${fmt(y1, 1)}`, fill: "none", stroke: C.c2, "stroke-width": 2 }, attrs || {}), g);
  }
  function rightAngle(pl, px, py, ux, uy, vx, vy, size, attrs) {
    // 在點 (px,py) 畫直角記號，u、v 為兩個單位方向（平面座標）
    const s = size; const pts = [[px + ux * s, py + uy * s], [px + (ux + vx) * s, py + (uy + vy) * s], [px + vx * s, py + vy * s]];
    return polyline(pl, pts, Object.assign({ stroke: C.ink3, "stroke-width": 1.4 }, attrs || {}));
  }
  /** 純文字分數：ftxt(8,5) → "8/5" */
  function ftxt(n, d = 1) { const g = (a, b) => (b ? g(b, a % b) : Math.abs(a) || 1); if (d < 0) { n = -n; d = -d; } const k = g(n, d); n /= k; d /= k; return d === 1 ? String(n) : `${n}/${d}`; }
  /** 十進位小數轉分數字串（分母 ≤ 60） */
  function toFrac(x) { for (let d = 1; d <= 60; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return ftxt(n, d); } return fmt(x, 2); }
  /** 依一組平面座標點計算含邊界的座標範圍 */
  function bounds(pts, margin = 1, minSpan = 4) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
    if (y1 - y0 < minSpan) { const c = (y0 + y1) / 2; y0 = c - minSpan / 2; y1 = c + minSpan / 2; }
    return { x0: x0 - margin, x1: x1 + margin, y0: y0 - margin, y1: y1 + margin };
  }
  /* 3D 斜投影：(x,y,z) → 平面座標 */
  function proj3(x, y, z, k) { k = k || { ax: -0.55, ay: -0.35 }; return [k.ax * x + y, k.ay * x + z]; }

  /* ---------- 註冊 ---------- */
  function define(id, spec) { spec.id = id; registry[id] = spec; return spec; }
  function get(id) { return registry[id]; }

  /* ---------- 播放器 ---------- */
  class Player {
    constructor(host, spec, opts) {
      this.host = host; this.spec = spec; this.opts = opts || {};
      this.p = Object.assign({}, spec.defaults || {}, (this.opts.q && this.opts.q.params) || this.opts.params || {});
      this.steps = typeof spec.steps === "function" ? spec.steps(this.p) : spec.steps;
      this.k = 0; this.t = 0; this.playing = false; this.speed = 1; this.raf = 0; this.last = 0; this.hold = 0; this.dirty = true;
      this.reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      this.build();
      if (this.reduced) { this.t = 1; }
      this.render();
      if (!this.reduced && this.opts.autoplay !== false) this.play();
    }
    build() {
      const h = this.host; h.innerHTML = "";
      const stage = document.createElement("div"); stage.className = "stage";
      const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${this.spec.w} ${this.spec.h}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "核心意義動畫");
      stage.appendChild(svg); h.appendChild(stage); this.svg = svg;
      const cap = document.createElement("div"); cap.className = "caption"; cap.innerHTML = '<div class="ct"></div><div class="cx"></div>'; h.appendChild(cap); this.cap = cap;
      const ctl = document.createElement("div"); ctl.className = "controls";
      ctl.innerHTML = '<button class="btn sm icon" data-a="prev" aria-label="上一步" title="上一步">‹</button>' +
        '<button class="btn sm primary" data-a="play" style="min-width:74px">▶ 播放</button>' +
        '<button class="btn sm icon" data-a="next" aria-label="下一步" title="下一步">›</button>' +
        '<button class="btn sm ghost" data-a="replay" title="從頭播放">↺ 重播</button>' +
        '<span class="spacer"></span><label class="speed muted">速度 <select data-a="speed"><option value="0.6">慢</option><option value="1" selected>正常</option><option value="1.6">快</option></select></label>';
      h.appendChild(ctl); this.ctl = ctl;
      const scrub = document.createElement("input"); scrub.type = "range"; scrub.className = "scrub"; scrub.min = 0; scrub.max = this.steps.length - 0.001; scrub.step = 0.005; scrub.value = 0; scrub.setAttribute("aria-label", "動畫進度"); h.appendChild(scrub); this.scrub = scrub;
      const dots = document.createElement("div"); dots.className = "dots";
      this.steps.forEach((s, i) => { const b = document.createElement("button"); b.type = "button"; b.title = s.title; b.setAttribute("aria-label", `第 ${i + 1} 步：${s.title}`); b.addEventListener("click", () => this.goto(i, this.reduced ? 1 : 0, true)); dots.appendChild(b); });
      h.appendChild(dots); this.dots = dots;
      ctl.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a;
        if (a === "play") this.toggle(); else if (a === "next") this.next(); else if (a === "prev") this.prev(); else if (a === "replay") { this.goto(0, 0); this.play(); }
      });
      ctl.querySelector("[data-a=speed]").addEventListener("change", (e) => { this.speed = parseFloat(e.target.value) || 1; });
      scrub.addEventListener("input", () => { this.pause(); const v = parseFloat(scrub.value); this.k = clamp(Math.floor(v), 0, this.steps.length - 1); this.t = clamp01(v - this.k); this.dirty = true; this.render(); });
    }
    ctx() {
      const k = this.k, t = this.t, self = this;
      return {
        svg: this.svg, W: this.spec.w, H: this.spec.h, k, t, p: this.p, steps: this.steps,
        P: (i) => (k > i ? 1 : k === i ? ease(t) : 0),
        R: (i) => (k > i ? 1 : k === i ? t : 0),
        step: k
      };
    }
    render() {
      if (!this.dirty) return; this.dirty = false;
      clear(this.svg);
      try { this.spec.draw(this.ctx()); } catch (err) { console.error("anim draw error", this.spec.id, err); }
      const s = this.steps[this.k];
      this.cap.querySelector(".ct").textContent = `${this.k + 1} / ${this.steps.length} · ${s.title}`;
      this.cap.querySelector(".cx").textContent = s.text;
      this.scrub.value = this.k + this.t;
      Array.from(this.dots.children).forEach((b, i) => { b.className = i < this.k ? "done" : i === this.k ? "cur" : ""; });
      this.ctl.querySelector("[data-a=prev]").disabled = this.k === 0 && this.t === 0;
      this.ctl.querySelector("[data-a=play]").textContent = this.playing ? "❚❚ 暫停" : (this.atEnd() ? "▶ 重播" : "▶ 播放");
    }
    atEnd() { return this.k === this.steps.length - 1 && this.t >= 1; }
    goto(k, t, pause) { this.k = clamp(k, 0, this.steps.length - 1); this.t = clamp01(t == null ? 1 : t); this.hold = 0; this.dirty = true; if (pause) this.pause(); this.render(); }
    next() { if (this.t < 1) this.goto(this.k, 1, true); else this.goto(this.k + 1, this.reduced ? 1 : 1, true); }
    prev() { if (this.t > 0 && this.t < 1) this.goto(this.k, 0, true); else this.goto(Math.max(0, this.k - 1), this.reduced ? 1 : 0, true); if (!this.reduced && this.k >= 0) { this.goto(this.k, 1, true); } }
    toggle() { if (this.playing) this.pause(); else { if (this.atEnd()) this.goto(0, 0); this.play(); } }
    play() {
      if (this.playing) return; this.playing = true; this.last = 0; this.dirty = true; this.render();
      const loop = (ts) => {
        if (!this.playing) return;
        if (!this.last) this.last = ts; const dt = (ts - this.last) * this.speed; this.last = ts;
        const step = this.steps[this.k]; const dur = step.dur || 2400;
        if (this.t < 1) { this.t = clamp01(this.t + dt / dur); this.dirty = true; }
        else {
          this.hold += dt;
          if (this.hold >= (step.hold || 900)) {
            this.hold = 0;
            if (this.k < this.steps.length - 1) { this.k++; this.t = 0; this.dirty = true; }
            else { this.playing = false; this.dirty = true; this.render(); return; }
          }
        }
        this.render(); this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { if (!this.playing) return; this.playing = false; cancelAnimationFrame(this.raf); this.dirty = true; this.render(); }
    destroy() { this.playing = false; cancelAnimationFrame(this.raf); this.host.innerHTML = ""; }
  }

  return { define, get, registry, Player, C, el, clear, clamp, clamp01, lerp, ease, easeOut, sub, fmt, ftxt, toFrac, bounds, PI, plane, grid, axes, head, seg, arrow, dot, label, tag, textWidth, curve, poly, polyline, circle, arc, rightAngle, proj3 };
})();


/* ======================================================================
 * 各題動畫（第 1～6 題）
 * ==================================================================== */
(function (A) {
  "use strict";
  const { define, C, el, lerp, sub, fmt, ftxt, toFrac, bounds, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, clamp } = A;
  const absTxt = (v) => (v === 0 ? "|x|" : v < 0 ? `|x+${-v}|` : `|x−${v}|`);

  /* ---------- 第 1 題：絕對值＝距離 ---------- */
  define("q1", {
    w: 640, h: 300, defaults: { a: 1, b: 3, c: 4 },
    steps: (p) => {
      const gap = p.b - p.a, ext = (p.c - gap) / 2, lo = p.a - ext, hi = p.b + ext;
      return [
        { title: "絕對值就是距離", text: `${absTxt(p.a)} 是點 x 到 ${p.a} 的距離，${absTxt(p.b)} 是到 ${p.b} 的距離。題目問的是：兩段距離加起來不超過 ${p.c} 的 x 在哪裡。` },
        { title: `夾在兩點之間：距離和恆為 ${gap}`, text: `當 x 在 ${p.a} 與 ${p.b} 之間，兩段距離剛好拼成 ${p.a} 到 ${p.b} 的線段，總和永遠是 ${gap}，一定符合。` },
        { title: "往右走：每走 1，距離和多 2", text: `x 超過 ${p.b} 之後，兩段距離同時變長。從 ${gap} 增加到 ${p.c} 只能再走 ${fmt(ext)} 格，所以右邊界是 x = ${fmt(hi)}。` },
        { title: "往左也一樣", text: `對稱地，左邊界是 x = ${fmt(lo)}。整體解是 ${fmt(lo)} ≤ x ≤ ${fmt(hi)}。` },
        { title: "數整數點", text: `${fmt(lo)} 到 ${fmt(hi)} 共 ${Math.floor(hi) - Math.ceil(lo) + 1} 個整數。不必分段列式，看圖就知道。` }
      ];
    },
    draw(c) {
      const p = c.p; const gap = p.b - p.a, ext = (p.c - gap) / 2, lo = p.a - ext, hi = p.b + ext;
      const X0 = lo - 1.5, X1 = hi + 1.5;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: X0, x1: X1, y0: -1.2, y1: 1.6, pad: { l: 20, r: 20, t: 20, b: 20 } });
      const { X, Y, g } = pl;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      if (p3 > 0) el("rect", { x: X(lo), y: Y(0.35), width: (X(hi) - X(lo)), height: Y(-0.35) - Y(0.35), fill: C.ok, opacity: 0.18 * p3, rx: 6 }, g);
      el("line", { x1: X(X0), y1: Y(0), x2: X(X1), y2: Y(0), stroke: C.axis, "stroke-width": 1.6 }, g);
      A.head(g, X(X1), Y(0), 0, C.axis);
      for (let i = Math.ceil(X0); i <= Math.floor(X1); i++) { el("line", { x1: X(i), y1: Y(0) - 5, x2: X(i), y2: Y(0) + 5, stroke: C.axis }, g); label(pl, i, -0.28, String(i), { cls: "mono", fill: C.ink3, "font-size": 12 }); }
      dot(pl, p.a, 0, { r: 6, fill: C.c2 }); dot(pl, p.b, 0, { r: 6, fill: C.c2 });
      const mid = (p.a + p.b) / 2;
      let x = mid;
      if (c.k === 0) x = lerp(mid + 0.2, mid - 0.4, p0);
      else if (c.k === 1) x = lerp(p.a, p.b, p1);
      else if (c.k === 2) x = lerp(p.b, hi, p2);
      else if (c.k === 3) x = lerp(hi, lo, p3);
      const d1 = Math.abs(x - p.a), d2 = Math.abs(x - p.b), s = d1 + d2;
      const y1 = 0.42, y2 = 0.78;
      el("line", { x1: X(x), y1: Y(y1), x2: X(p.a), y2: Y(y1), stroke: C.c1, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85 }, g);
      el("line", { x1: X(x), y1: Y(y2), x2: X(p.b), y2: Y(y2), stroke: C.c4, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85 }, g);
      el("line", { x1: X(p.a), y1: Y(0), x2: X(p.a), y2: Y(y1), stroke: C.c1, "stroke-dasharray": "3 3", opacity: 0.5 }, g);
      el("line", { x1: X(p.b), y1: Y(0), x2: X(p.b), y2: Y(y2), stroke: C.c4, "stroke-dasharray": "3 3", opacity: 0.5 }, g);
      label(pl, (x + p.a) / 2, y1, absTxt(p.a) + " = " + fmt(d1, 1), { dy: -8, fill: C.c1, "font-size": 12, cls: "mono" });
      label(pl, (x + p.b) / 2, y2, absTxt(p.b) + " = " + fmt(d2, 1), { dy: -8, fill: C.c4, "font-size": 12, cls: "mono" });
      dot(pl, x, 0, { r: 7, fill: C.ink });
      label(pl, x, 0, "x", { dy: -13, cls: "math", "font-size": 14, "font-weight": 700 });
      const bx = X(X0 + 0.3), by = Y(-0.75), bw = X(X1 - 0.3) - X(X0 + 0.3), bh = 14, maxS = p.c + 2;
      el("rect", { x: bx, y: by, width: bw, height: bh, rx: 7, fill: C.surface, stroke: C.grid }, g);
      const over = s > p.c + 1e-9;
      el("rect", { x: bx, y: by, width: bw * Math.min(s, maxS) / maxS, height: bh, rx: 7, fill: over ? C.bad : C.ok, opacity: 0.8 }, g);
      el("line", { x1: bx + bw * p.c / maxS, y1: by - 5, x2: bx + bw * p.c / maxS, y2: by + bh + 5, stroke: C.ink, "stroke-width": 1.5 }, g);
      el("text", { x: bx + bw * p.c / maxS, y: by + bh + 18, text: String(p.c), cls: "mono", "font-size": 11, fill: C.ink2, "text-anchor": "middle" }, g);
      el("text", { x: bx, y: by - 8, text: `距離和 ${absTxt(p.a)}+${absTxt(p.b)} = ${fmt(s, 1)}${over ? `（超過 ${p.c}）` : `（≤ ${p.c} ✓）`}`, "font-size": 12.5, fill: over ? C.bad : C.ok, "font-weight": 600 }, g);
      if (p4 > 0) { const ints = []; for (let i = Math.ceil(lo); i <= Math.floor(hi); i++) ints.push(i); ints.forEach((i, j) => { const q = sub(p4, j / (ints.length + 1), (j + 2) / (ints.length + 1)); if (q > 0) { dot(pl, i, 0, { r: 5 + 3 * q, fill: C.ok, opacity: q }); label(pl, i, 0, "✓", { dy: -14, fill: C.ok, "font-size": 12, opacity: q, "font-weight": 700 }); } }); }
      if (p3 >= 1) label(pl, (lo + hi) / 2, 1.28, `解：${fmt(lo)} ≤ x ≤ ${fmt(hi)}`, { fill: C.ok, "font-size": 15, "font-weight": 700 });
    }
  });

  /* ---------- 第 2 題：餘式＝交會的直線 ---------- */
  define("q2", {
    w: 640, h: 380, defaults: { r1: 1, r2: 2, a: 1, m: 2, n: 1, x3: 3, x0: 0 },
    steps: (p) => {
      const line = `${p.m === 1 ? "" : p.m === -1 ? "−" : p.m}x${p.n > 0 ? "+" + p.n : p.n < 0 ? "−" + (-p.n) : ""}`;
      const fac = (r) => (r === 0 ? "x" : r > 0 ? `(x−${r})` : `(x+${-r})`);
      const D = fac(p.r1) + fac(p.r2);
      const f = (x) => (x - p.r1) * (x - p.r2) * (x - p.a) + p.m * x + p.n;
      return [
        { title: `餘式 ${line} 是一條直線`, text: `先畫 y = ${line}。「除以 ${D} 餘 ${line}」表示 f 在 x = ${p.r1} 和 x = ${p.r2} 的值，跟這條直線一樣。` },
        { title: `差 f(x) − (${line}) 有因式 ${D}`, text: `首項係數是 1 的三次式，所以 f(x) = ${D}(x−a) + (${line})。a 還沒定：改變 a，曲線會變，但永遠穿過那兩個交點。` },
        { title: `用 f(${p.x3}) = ${f(p.x3)} 釘住 a`, text: `曲線在 x = ${p.x3} 必須通過 (${p.x3}, ${f(p.x3)})。試著調整 a，只有 a = ${p.a} 時剛好穿過。` },
        { title: `讀出 f(${p.x0})`, text: `f(x) = ${D}${fac(p.a)} + (${line})，在 x = ${p.x0} 的值是 (${p.x0 - p.r1})(${p.x0 - p.r2})(${p.x0 - p.a}) + (${p.m * p.x0 + p.n}) = ${f(p.x0)}。` }
      ];
    },
    draw(c) {
      const p = c.p; const line = (x) => p.m * x + p.n;
      const fA = (x, a) => (x - p.r1) * (x - p.r2) * (x - a) + p.m * x + p.n;
      const xs = [p.r1, p.r2, p.x3, p.x0]; const xmin = Math.min(...xs) - 1.2, xmax = Math.max(...xs) + 1.2;
      const ys = []; for (let x = xmin; x <= xmax; x += 0.25) { ys.push(fA(x, p.a)); ys.push(line(x)); }
      let ymin = Math.min(...ys), ymax = Math.max(...ys); const pad = (ymax - ymin) * 0.12 + 1; ymin -= pad; ymax += pad;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: xmin, x1: xmax, y0: ymin, y1: ymax });
      const yStep = ymax - ymin > 40 ? 10 : ymax - ymin > 16 ? 4 : 2;
      grid(pl, 1, {}); axes(pl, { xStep: 1, yStep, xLabel: "x", yLabel: "y" });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      let a = p.a + 2;
      if (c.k === 1) a = lerp(p.a + 2, p.a - 1.5, Math.sin(p1 * PI / 2));
      else if (c.k === 2) a = lerp(p.a - 1.5, p.a, p2);
      else if (c.k >= 3) a = p.a;
      const f = (x) => fA(x, a);
      curve(pl, line, xmin, xmax, p0, { stroke: C.c2, "stroke-width": 2 });
      const lineTxt = `y = ${p.m === 1 ? "" : p.m === -1 ? "−" : p.m}x${p.n > 0 ? "+" + p.n : p.n < 0 ? "−" + (-p.n) : ""}`;
      label(pl, xmax - 0.6, line(xmax - 0.6), lineTxt, { dy: 16, fill: C.c2, cls: "math", "font-size": 13, opacity: p0 });
      if (p1 > 0) {
        curve(pl, f, xmin, xmax, p1, { stroke: C.c1 });
        const fac = (r) => (r === 0 ? "x" : r > 0 ? `(x−${r})` : `(x+${-r})`);
        tag(c.svg, 40, 30, `f(x) = ${fac(p.r1)}${fac(p.r2)}(x−${a < 0 ? "(" + fmt(a, 1) + ")" : fmt(a, 1)}) + (${lineTxt.slice(4)})`, { fill: C.c1, "font-size": 12.5, opacity: p1 });
      }
      dot(pl, p.r1, line(p.r1), { fill: C.c2, r: 5, opacity: p0 }); dot(pl, p.r2, line(p.r2), { fill: C.c2, r: 5, opacity: p0 });
      label(pl, p.r1, line(p.r1), `(${p.r1}, ${line(p.r1)})`, { dx: -28, dy: 4, "font-size": 12, cls: "mono", fill: C.c2, opacity: p0 });
      label(pl, p.r2, line(p.r2), `(${p.r2}, ${line(p.r2)})`, { dx: 30, dy: 4, "font-size": 12, cls: "mono", fill: C.c2, opacity: p0 });
      const y3 = fA(p.x3, p.a);
      if (c.k >= 2) {
        const hit = Math.abs(f(p.x3) - y3) < 0.05;
        dot(pl, p.x3, y3, { fill: "none", stroke: C.bad, r: 8, "stroke-width": 2, opacity: p2 });
        dot(pl, p.x3, f(p.x3), { fill: hit ? C.ok : C.c1, r: 5, opacity: p2 });
        label(pl, p.x3, y3, `必須通過 (${p.x3}, ${y3})`, { dx: 4, dy: -14, "font-size": 12.5, fill: C.bad, opacity: p2, "text-anchor": "start" });
        label(pl, p.x3, f(p.x3), `f(${p.x3}) = ${fmt(f(p.x3), 1)}`, { dx: 12, dy: 4, "font-size": 12, cls: "mono", fill: hit ? C.ok : C.c1, opacity: p2, "text-anchor": "start" });
        if (hit) tag(c.svg, 40, 54, `a = ${p.a}`, { fill: C.ok, "font-weight": 700, opacity: p2 });
      }
      if (p3 > 0) {
        const y0 = fA(p.x0, p.a);
        seg(pl, p.x0, 0, p.x0, y0, p3, { stroke: C.c4, "stroke-dasharray": "4 3" });
        dot(pl, p.x0, y0, { fill: C.c4, r: 6, opacity: p3 });
        label(pl, p.x0, y0, `f(${p.x0}) = ${y0}`, { dx: 50, dy: 4, "font-size": 14, fill: C.c4, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 3 題：弦長、距離、半徑的直角三角形 ---------- */
  define("q3", {
    w: 640, h: 400, defaults: { h: 2, k: -1, r: 3, p: 3, q: 4, K: 8, other: -12, d: 2 },
    steps: (p) => {
      const half2 = p.r * p.r - p.d * p.d; const halfTxt = A.fmt(Math.sqrt(half2), 2);
      const lineTxt = `${p.p}x${p.q > 0 ? "+" : "−"}${Math.abs(p.q)}y+k=0`;
      return [
        { title: "配方找出圓心與半徑", text: `把圓的方程式配方成 (x−${p.h})²+(y−${p.k})²=${p.r * p.r}：圓心 (${p.h}, ${p.k})、半徑 ${p.r}。` },
        { title: `直線 ${lineTxt} 是一族平行線`, text: "k 改變，直線就平行移動。它切出的弦長，只由「圓心到直線的距離 d」決定。" },
        { title: "半徑、d、半弦長構成直角三角形", text: `圓心到弦的垂線平分弦，所以 r² = d² + (弦/2)²。半弦長是 ${halfTxt}，代入得 d = ${p.d}。` },
        { title: "距離公式反推 k", text: `|${p.p}·${p.h} + ${p.q}·(${p.k}) + k| / 5 = ${p.d}，所以 k = ${p.K} 或 ${p.other}。兩個位置都畫給你看，選項裡只有 ${p.K}。` }
      ];
    },
    draw(c) {
      const p = c.p; const { h: cx, k: cy, r } = p; const norm = Math.hypot(p.p, p.q);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: cx - r - 2.5, x1: cx + r + 2.5, y0: cy - r - 1.6, y1: cy + r + 1.6, square: true, pad: { l: 30, r: 10, t: 10, b: 24 } });
      grid(pl, 1); axes(pl, { xStep: 2, yStep: 2 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      circle(pl, cx, cy, r * p0, { stroke: C.c1, "stroke-width": 2.5 });
      dot(pl, cx, cy, { fill: C.c1, r: 4.5 });
      label(pl, cx, cy, `(${cx}, ${cy})`, { dx: 0, dy: 18, "font-size": 12, cls: "mono", fill: C.c1 });
      if (p0 > 0.5) { seg(pl, cx, cy, cx + r * Math.cos(-0.5), cy + r * Math.sin(-0.5), sub(p0, 0.5, 1), { stroke: C.c1, "stroke-width": 1.5, "stroke-dasharray": "4 3" }); label(pl, cx + r * 0.55, cy - r * 0.1, `r = ${r}`, { fill: C.c1, "font-size": 12.5, cls: "math" }); }
      if (p1 <= 0) return;
      const base = p.p * cx + p.q * cy;
      let k = p.K;
      const kLo = -base - norm * (r + 2.5), kHi = -base + norm * (r + 2.5);
      if (c.k === 1) k = lerp(kLo, kHi, p1);
      else if (c.k === 2) k = lerp(kHi, p.K, p2);
      const drawLine = (kk, attrs) => {
        const f = (x) => (-p.p * x - kk) / p.q;
        curve(pl, f, pl.o.x0, pl.o.x1, 1, Object.assign({ stroke: C.c2, "stroke-width": 2 }, attrs || {}));
        const d = Math.abs(p.p * cx + p.q * cy + kk) / norm;
        const s = (p.p * cx + p.q * cy + kk) / (norm * norm); const fx = cx - p.p * s, fy = cy - p.q * s;
        return { d, fx, fy, f };
      };
      const L = drawLine(k);
      const lx = clamp(cx + r + 1.6, pl.o.x0 + 0.5, pl.o.x1 - 0.5);
      label(pl, lx, clamp(L.f(lx), pl.o.y0 + 0.4, pl.o.y1 - 0.4), `k = ${fmt(k, 0)}`, { dy: -9, fill: C.c2, cls: "mono", "font-size": 12.5 });
      const d = L.d; const half = d < r ? Math.sqrt(r * r - d * d) : 0;
      if (half > 0) {
        const ux = p.q / norm, uy = -p.p / norm;
        const ax = L.fx + ux * half, ay = L.fy + uy * half, bx = L.fx - ux * half, by = L.fy - uy * half;
        seg(pl, ax, ay, bx, by, 1, { stroke: C.c4, "stroke-width": 4 });
        dot(pl, ax, ay, { fill: C.c4 }); dot(pl, bx, by, { fill: C.c4 });
        if (p2 > 0) {
          seg(pl, cx, cy, L.fx, L.fy, p2, { stroke: C.c3, "stroke-width": 2 });
          seg(pl, cx, cy, ax, ay, p2, { stroke: C.c1, "stroke-width": 1.5, "stroke-dasharray": "4 3" });
          poly(pl, [[cx, cy], [L.fx, L.fy], [ax, ay]], { fill: C.c3, opacity: 0.18 * p2 });
          rightAngle(pl, L.fx, L.fy, ux, uy, (cx - L.fx) / (d || 1), (cy - L.fy) / (d || 1), 0.3, { opacity: p2 });
          label(pl, (cx + L.fx) / 2, (cy + L.fy) / 2, `d = ${fmt(d, 2)}`, { dx: -30, fill: C.c3, "font-size": 12.5, cls: "mono", opacity: p2 });
          label(pl, (L.fx + ax) / 2, (L.fy + ay) / 2, fmt(half, 2), { dy: 16, fill: C.c4, "font-size": 12.5, opacity: p2 });
        }
      }
      tag(c.svg, c.W - 12, 24, `弦長 = ${half > 0 ? fmt(2 * half, 2) : "無交點"}`, { anchor: "end", fill: C.c4, "font-size": 13, "font-weight": 600 });
      tag(c.svg, c.W - 12, 48, `d = |${base >= 0 ? base : "(" + base + ")"} + k| / ${fmt(norm, 0)} = ${fmt(d, 2)}`, { anchor: "end", fill: C.c3, "font-size": 12.5, cls: "mono" });
      if (p2 > 0) tag(c.svg, c.W - 12, 72, `r² = d² + (弦/2)²  ⇒  d = ${p.d}`, { anchor: "end", fill: C.ink, "font-size": 12.5, opacity: p2 });
      if (p3 > 0) {
        const L2 = drawLine(p.other, { opacity: p3, "stroke-dasharray": "6 4" });
        const lx2 = clamp(cx - r - 1.6, pl.o.x0 + 0.5, pl.o.x1 - 0.5);
        label(pl, lx2, clamp(L2.f(lx2), pl.o.y0 + 0.4, pl.o.y1 - 0.4), `k = ${p.other}`, { dy: -9, fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p3 });
        tag(c.svg, c.W - 12, 96, `|k ${base >= 0 ? "+ " + base : "− " + (-base)}| = ${fmt(norm * p.d, 0)}  ⇒  k = ${p.K} 或 ${p.other}`, { anchor: "end", fill: C.ok, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 4 題：三角函數圖形的四種變換 ---------- */
  define("q4", {
    w: 640, h: 380, defaults: { A: 3, b: 2, phi: [1, 3], d: 1, xm: [5, 12] },
    steps: (p) => {
      const [pn, pd] = p.phi; const phiT = piT(pn, pd), halfT = piT(pn, 2 * pd), xmT = piT(p.xm[0], p.xm[1]);
      return [
        { title: "從 y = sin x 出發", text: "最高點在 x = π/2。接下來一步一步變形，盯著最高點怎麼移動。" },
        { title: "橫向壓縮：sin 2x", text: "x 前面乘 2，圖形被壓成一半寬，週期從 2π 變成 π，最高點移到 π/4。" },
        { title: `右移 ${halfT}：sin(2x − ${phiT})`, text: `關鍵：2x − ${phiT} = 2(x − ${halfT})，所以是右移 ${halfT} 而不是 ${phiT}。最高點變成 π/4 + ${halfT} = ${xmT}。` },
        { title: `拉高 ${p.A} 倍、${p.d >= 0 ? "上移 " + p.d : "下移 " + (-p.d)}`, text: `振幅 ${p.A}、再${p.d >= 0 ? "往上 " + p.d : "往下 " + (-p.d)}，最大值是 ${p.A + p.d}。最高點的 x 不受影響，仍在 ${xmT}。` }
      ];
    },
    draw(c) {
      const p = c.p; const [pn, pd] = p.phi; const phi = PI * pn / pd;
      const ymax = Math.max(p.A + p.d, 1) + 0.8, ymin = Math.min(-p.A + p.d, -1) - 0.6;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -0.4, x1: PI + 0.3, y0: ymin, y1: ymax, pad: { l: 34, r: 12, t: 14, b: 30 } });
      grid(pl, PI / 12, { opacity: 0.6 });
      const { X, Y, g } = pl;
      el("line", { x1: X(-0.4), y1: Y(0), x2: X(PI + 0.3), y2: Y(0), stroke: C.axis, "stroke-width": 1.4 }, g);
      el("line", { x1: X(0), y1: Y(ymin), x2: X(0), y2: Y(ymax), stroke: C.axis, "stroke-width": 1.4 }, g);
      const ticks = [[1, 12], [1, 4], [5, 12], [7, 12], [11, 12], [1, 1], [1, 2], [1, 3], [2, 3]];
      ticks.forEach(([n, d]) => { const x = PI * n / d; el("line", { x1: X(x), y1: Y(0) - 3, x2: X(x), y2: Y(0) + 3, stroke: C.axis }, g); label(pl, x, 0, piT(n, d), { dy: 16, "font-size": 10.5, cls: "mono", fill: C.ink3 }); });
      for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) if (y !== 0) label(pl, 0, y, String(y), { dx: -10, dy: 4, "font-size": 10.5, cls: "mono", fill: C.ink3 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const b = lerp(1, 2, p1), h = lerp(0, phi / 2, p2), Aamp = lerp(1, p.A, p3), d = lerp(0, p.d, p3);
      const f = (x) => Aamp * Math.sin(b * (x - h)) + d;
      if (p1 > 0) curve(pl, Math.sin, -0.4, PI + 0.3, 1, { stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 4", opacity: 0.5 });
      curve(pl, f, -0.4, PI + 0.3, p0, { stroke: C.c1, "stroke-width": 2.6 });
      const xm = h + (PI / 2) / b, ym = Aamp + d;
      if (p0 >= 1) {
        seg(pl, xm, 0, xm, ym, 1, { stroke: C.c2, "stroke-dasharray": "4 3", "stroke-width": 1.5 });
        dot(pl, xm, ym, { fill: C.c2, r: 6 });
        const xmT = piT(p.xm[0], p.xm[1]);
        label(pl, xm, ym, "最高點 x = " + (c.k === 0 ? "π/2" : c.k === 1 ? (p1 >= 1 ? "π/4" : "…") : c.k === 2 ? (p2 >= 1 ? xmT : "…") : xmT), { dy: -12, fill: C.c2, "font-size": 13, "font-weight": 700 });
        if (c.k >= 3) label(pl, xm, ym, "最大值 " + fmt(ym, 1), { dx: 62, dy: 4, fill: C.c2, "font-size": 12.5, cls: "mono", "text-anchor": "start" });
      }
      if (c.k === 2 && p2 > 0 && p2 < 1) arrow(pl, PI / 4, 1.3, PI / 4 + phi / 2, 1.3, 1, { stroke: C.c4, "stroke-width": 2 });
      if (c.k === 2) label(pl, PI / 4 + phi / 4, 1.3, `右移 ${piT(pn, 2 * pd)}`, { dy: -8, fill: C.c4, "font-size": 12.5 });
      const phiT = piT(pn, pd);
      const eq = c.k === 0 ? "y = sin x" : c.k === 1 ? "y = sin 2x" : c.k === 2 ? `y = sin(2x − ${phiT}) = sin 2(x − ${piT(pn, 2 * pd)})` : `y = ${p.A} sin(2x − ${phiT}) ${p.d >= 0 ? "+ " + p.d : "− " + (-p.d)}`;
      tag(c.svg, 40, 26, eq, { fill: C.c1, "font-size": 13, "font-weight": 600 });
      tag(c.svg, 40, 50, "週期 = " + (c.k >= 1 ? "π" : "2π"), { fill: C.ink2, "font-size": 12 });
    }
  });
  function piT(n, d) { const g = (a, b) => (b ? g(b, a % b) : a); const k = g(Math.abs(n), d); n /= k; d /= k; if (n === 0) return "0"; if (d === 1) return n === 1 ? "π" : `${n}π`; return `${n === 1 ? "" : n}π/${d}`; }

  /* ---------- 第 5 題：貝氏定理＝縮小樣本空間 ---------- */
  define("q5", {
    w: 640, h: 400, defaults: { N: 2000, prev: 1, sens: 90, fp: 5, sick: 20, sickPos: 18, healthy: 1980, healthyPos: 99, labels: { A: "患病", B: "陽性", unitA: "患病者", unitB: "未患病者" } },
    steps: (p) => {
      const L = p.labels; const tot = p.sickPos + p.healthyPos; const pct = (p.sickPos / tot * 100).toFixed(1);
      return [
        { title: `想像 ${p.N} 個`, text: `機率題最怕抽象。把整體想成 ${p.N} 個，每個小方塊是一個。` },
        { title: `${p.prev}%：${p.sick} 個真的${L.A}`, text: `${p.prev}% 很少，只有 ${p.sick} 格（紅色）。剩下 ${p.healthy} 個是${L.unitB}。` },
        { title: `誰會${L.B}？`, text: `${L.unitA} ${p.sens}% ${L.B}：${p.sickPos} 個（深紅）。${L.unitB} ${p.fp}% 誤判：${p.healthy} × ${p.fp}% = ${p.healthyPos} 個（橘色）。${L.unitB}太多，${p.fp}% 也${p.healthyPos >= p.sickPos ? "比" : "接近"} ${p.sickPos} 個${p.healthyPos >= p.sickPos ? "多" : ""}。` },
        { title: `已知${L.B}，就只看${L.B}的`, text: `條件機率＝縮小樣本空間。把其他的全部淡掉，剩下 ${tot} 個${L.B}者，其中真正${L.A}的只有 ${p.sickPos} 個。` },
        { title: `${p.sickPos} / ${tot} ≈ ${pct}%`, text: `這就是貝氏定理算出來的 P(${L.A} | ${L.B}) = ${(p.prev / 100 * p.sens / 100).toFixed(4)} / (${(p.prev / 100 * p.sens / 100).toFixed(4)} + ${((1 - p.prev / 100) * p.fp / 100).toFixed(4)})。` }
      ];
    },
    draw(c) {
      const p = c.p; const cols = 80, rows = Math.ceil(p.N / cols), n = p.N; const s = 6.4, gap = 1; const ox = 24, oy = 20;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const g = el("g", null, c.svg);
      const { sick, sickPos, healthyPos } = p; const L = p.labels; const tot = sickPos + healthyPos;
      const paths = { base: "", sick: "", sickPos: "", healthyPos: "" };
      const shown = Math.floor(n * (c.k === 0 ? p0 : 1));
      for (let i = 0; i < shown; i++) {
        const r = Math.floor(i / cols), col = i % cols; const x = ox + col * (s + gap), y = oy + r * (s + gap);
        const sq = `M${x} ${y}h${s}v${s}h${-s}z`;
        let cls = "base";
        if (i < sick && p1 > (i / sick) * 0.999) cls = "sick";
        if (i < sickPos && p2 > 0 && p2 > (i / sickPos) * 0.7) cls = "sickPos";
        if (i >= sick && i < sick + healthyPos && p2 > 0 && p2 > ((i - sick) / healthyPos) * 0.99) cls = "healthyPos";
        paths[cls] += sq;
      }
      const fade = p3;
      el("path", { d: paths.base, fill: C.ink3, opacity: lerp(0.35, 0.06, fade) }, g);
      el("path", { d: paths.sick, fill: C.bad, opacity: lerp(0.55, 0.12, fade) }, g);
      el("path", { d: paths.sickPos, fill: C.bad, opacity: 1 }, g);
      el("path", { d: paths.healthyPos, fill: C.c2, opacity: 1 }, g);
      const gridBottom = oy + rows * (s + gap); const lx = ox, ly = gridBottom + 40;
      const leg = [[C.ink3, `${L.unitB}、非${L.B}`, String(p.healthy - healthyPos), p2], [C.bad, `${L.A}（${sick}）`, `${p.prev}%`, p1], [C.bad, `${L.A}且${L.B}`, String(sickPos), p2, true], [C.c2, `${L.unitB}但誤判`, String(healthyPos), p2]];
      leg.forEach(([col, name, num, op, strong], i) => {
        if (op <= 0) return; const x = lx + i * 150;
        el("rect", { x, y: ly - 9, width: 12, height: 12, rx: 2, fill: col, opacity: strong ? 1 : 0.55 * op + 0.1 }, g);
        el("text", { x: x + 18, y: ly + 1, text: name, "font-size": 12, fill: C.ink2, opacity: op }, g);
        el("text", { x: x + 18, y: ly + 17, text: num, "font-size": 13, cls: "mono", fill: C.ink, "font-weight": 600, opacity: op }, g);
      });
      el("text", { x: ox, y: gridBottom + 16, text: `每一格 = 1 個，共 ${n} 個`, "font-size": 11.5, fill: C.ink3 }, g);
      if (p3 > 0) tag(c.svg, lx, ly + 52, `已知${L.B} ⇒ 只看${L.B}者：${sickPos} + ${healthyPos} = ${tot}`, { fill: C.ink, "font-size": 12.5, opacity: p3 });
      if (p4 > 0) tag(c.svg, lx, ly + 80, `P(${L.A} | ${L.B}) = ${sickPos} / ${tot} ≈ ${(sickPos / tot * 100).toFixed(1)}%`, { fill: C.ok, "font-size": 13.5, "font-weight": 700, opacity: p4 });
      if (p4 > 0.3) { const q = sub(p4, 0.3, 1); el("text", { x: ox + cols * (s + gap) / 2, y: oy + rows * (s + gap) / 2 + 14, text: `≈ ${Math.round(sickPos / tot * 100 / 5) * 5}%`, "font-size": 40, "font-weight": 700, fill: C.ok, "text-anchor": "middle", opacity: q, cls: "mono" }, g); }
    }
  });

  /* ---------- 第 6 題：行列式＝面積倍率 ---------- */
  define("q6", {
    w: 640, h: 400, defaults: { a: 2, b: 1, c: 1, d: 3, S: 4, tri: [[0, 0], [2, 0], [1, 4]] },
    steps: (p) => {
      const det = p.a * p.d - p.b * p.c;
      return [
        { title: "先看單位正方形怎麼變", text: `線性變換完全由 e₁=(1,0)、e₂=(0,1) 的去向決定。它們分別被送到 (${p.a},${p.c}) 與 (${p.b},${p.d})，也就是矩陣的兩行。` },
        { title: "正方形變成平行四邊形", text: `看著網格一起變形：每個單位正方形都變成同樣的平行四邊形，面積是 |${p.a}·${p.d} − ${p.b}·${p.c}| = ${Math.abs(det)}，這就是行列式。` },
        { title: "任何圖形都被放大同樣的倍率", text: `△ABC（面積 ${p.S}）被同一組網格帶著走，變成面積 ${p.S} × ${Math.abs(det)} = ${p.S * Math.abs(det)} 的三角形。` }
      ];
    },
    draw(c) {
      const p = c.p; const T0 = (x, y) => [p.a * x + p.b * y, p.c * x + p.d * y];
      const tri = p.tri || [[0, 0], [2, 0], [1, p.S]];
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1], ...tri, ...tri.map(q => T0(q[0], q[1])), T0(1, 0), T0(0, 1), T0(1, 1)];
      const B = bounds(pts, 1.2, 6);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: B.x0, x1: B.x1, y0: B.y0, y1: B.y1, square: true, pad: { l: 26, r: 8, t: 8, b: 22 } });
      const { X, Y, g } = pl;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2);
      const m = p1;
      const M = [[lerp(1, p.a, m), lerp(0, p.b, m)], [lerp(0, p.c, m), lerp(1, p.d, m)]];
      const T = (x, y) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
      const span = Math.ceil(Math.max(B.x1 - B.x0, B.y1 - B.y0)) + 4;
      for (let i = -span; i <= span; i++) {
        const a = T(i, -span), b = T(i, span); const a2 = T(-span, i), b2 = T(span, i);
        el("line", { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), stroke: C.grid, "stroke-width": 1 }, g);
        el("line", { x1: X(a2[0]), y1: Y(a2[1]), x2: X(b2[0]), y2: Y(b2[1]), stroke: C.grid, "stroke-width": 1 }, g);
      }
      axes(pl, { xStep: 2, yStep: 2 });
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(q => T(q[0], q[1]));
      poly(pl, sq, { fill: C.c1, opacity: 0.28 }); polyline(pl, sq.concat([sq[0]]), { stroke: C.c1, "stroke-width": 2 });
      const e1 = T(1, 0), e2 = T(0, 1);
      arrow(pl, 0, 0, e1[0], e1[1], p0, { stroke: C.c2, "stroke-width": 2.5 });
      arrow(pl, 0, 0, e2[0], e2[1], p0, { stroke: C.c4, "stroke-width": 2.5 });
      label(pl, e1[0], e1[1], `(${fmt(e1[0], 1)}, ${fmt(e1[1], 1)})`, { dx: 22, dy: 14, fill: C.c2, "font-size": 12, cls: "mono", opacity: p0 });
      label(pl, e2[0], e2[1], `(${fmt(e2[0], 1)}, ${fmt(e2[1], 1)})`, { dx: -30, dy: -6, fill: C.c4, "font-size": 12, cls: "mono", opacity: p0 });
      if (p2 > 0) {
        const M2 = [[lerp(1, p.a, p2), lerp(0, p.b, p2)], [lerp(0, p.c, p2), lerp(1, p.d, p2)]];
        const T2 = (x, y) => [M2[0][0] * x + M2[0][1] * y, M2[1][0] * x + M2[1][1] * y];
        const img = tri.map(q => T2(q[0], q[1]));
        poly(pl, tri, { fill: C.c3, opacity: 0.12 }); polyline(pl, tri.concat([tri[0]]), { stroke: C.c3, "stroke-width": 1.2, "stroke-dasharray": "4 3" });
        poly(pl, img, { fill: C.c3, opacity: 0.35 }); polyline(pl, img.concat([img[0]]), { stroke: C.c3, "stroke-width": 2.2 });
        const det2 = Math.abs(M2[0][0] * M2[1][1] - M2[0][1] * M2[1][0]);
        const cxm = (img[0][0] + img[1][0] + img[2][0]) / 3, cym = (img[0][1] + img[1][1] + img[2][1]) / 3;
        label(pl, cxm, cym, "面積 " + fmt(p.S * det2, 1), { fill: C.c3, "font-size": 14, "font-weight": 700, dy: 5 });
        ["A", "B", "C"].forEach((nm, i) => label(pl, img[i][0], img[i][1], nm + "′", { dx: i === 0 ? -10 : 12, dy: i === 2 ? -6 : 14, fill: C.c3, cls: "math", "font-size": 13 }));
      }
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      tag(c.svg, c.W - 12, 24, `A = [ ${p.a} ${p.b} ; ${p.c} ${p.d} ]`, { anchor: "end", fill: C.ink, cls: "mono", "font-size": 12.5 });
      tag(c.svg, c.W - 12, 48, "單位正方形面積 → " + fmt(Math.abs(det), 2), { anchor: "end", fill: C.c1, "font-size": 13, "font-weight": 600 });
      if (p1 >= 1) tag(c.svg, c.W - 12, 72, `det A = ${p.a}·${p.d} − ${p.b}·${p.c} = ${p.a * p.d - p.b * p.c}`, { anchor: "end", fill: C.c1, "font-size": 12.5, cls: "mono" });
      if (p2 >= 1) tag(c.svg, c.W - 12, 96, `${p.S} × ${Math.abs(p.a * p.d - p.b * p.c)} = ${p.S * Math.abs(p.a * p.d - p.b * p.c)}`, { anchor: "end", fill: C.ok, "font-size": 14, "font-weight": 700 });
    }
  });
})(window.ANIM);

/* ======================================================================
 * 各題動畫（第 7～12 題）
 * ==================================================================== */
(function (A) {
  "use strict";
  const { define, C, el, lerp, sub, fmt, ftxt, toFrac, bounds, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, proj3, clamp } = A;
  const polyEval = (cs, x) => cs.reduce((s, k) => s * x + k, 0);
  const polyTxt = (cs) => { const deg = cs.length - 1; let s = ""; cs.forEach((c, i) => { if (!c) return; const p = deg - i; const ac = Math.abs(c); const term = p === 0 ? String(ac) : (ac === 1 ? "" : String(ac)) + "x" + (p === 1 ? "" : p === 2 ? "²" : "³"); s += (s ? (c < 0 ? " − " : " + ") : (c < 0 ? "−" : "")) + term; }); return s || "0"; };

  /* ---------- 第 7 題：三次函數與水平線的交點數 ---------- */
  define("q7", {
    w: 640, h: 400, defaults: { h: 0, q: 1, coefs: [1, 0, -3, 1], M: 3, m: -1 },
    steps: (p) => {
      const sh = (v) => (v === 0 ? "x" : v > 0 ? `(x−${v})` : `(x+${-v})`);
      return [
        { title: "三次函數一定有對稱中心", text: `f(x) = ${polyTxt(p.coefs)} 的圖形對稱於 (${p.h}, ${p.q})：因為 f(x) − ${p.q} = ${sh(p.h)}³ − 3${sh(p.h)} 對 x = ${p.h} 是奇對稱。任一點繞著 (${p.h},${p.q}) 轉 180° 仍在圖上。` },
        { title: "用水平線 y = k 掃描", text: "方程式 f(x) = k 的實根個數，就是水平線 y = k 與圖形的交點數。看 k 從低到高：1 個 → 2 個 → 3 個 → 2 個 → 1 個。" },
        { title: `k = ${p.M}：相切 + 相交＝兩個相異實根`, text: `f(x) − ${p.M} = ${sh(p.h - 1)}²${sh(p.h + 2)}：在 x = ${p.h - 1} 相切（重根），在 x = ${p.h + 2} 穿過。` },
        { title: `k = ${p.q}：三個交點`, text: `${p.q} 介於局部極小值 ${p.m} 與局部極大值 ${p.M} 之間，水平線穿過圖形三次；f(x) = 0 ${p.m < 0 && p.M > 0 ? "也一樣有三個實根" : p.m === 0 ? "則只有兩個相異實根（相切）" : "則只有一個實根"}。` },
        { title: `x > ${p.h + 1} 之後一路在 y = ${p.m} 上方`, text: `f(x) − (${p.m}) = ${sh(p.h + 1)}²${sh(p.h - 2)} 在 x > ${p.h + 1} 時為正；要到 x > ${p.h + 2} 之後 f(x) 才會超過 ${p.M}。` }
      ];
    },
    draw(c) {
      const p = c.p; const f = (x) => polyEval(p.coefs, x);
      const x0 = p.h - 3.2, x1 = p.h + 3.4, ylo = p.m - 3.5, yhi = p.M + 3.5;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0, x1, y0: ylo, y1: yhi, pad: { l: 30, r: 12, t: 12, b: 26 } });
      grid(pl, 1); axes(pl, { xStep: 1, yStep: 2, xLabel: "x", yLabel: "y" });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      if (p4 > 0) { el("rect", { x: pl.X(p.h + 1), y: pl.Y(yhi), width: pl.X(x1) - pl.X(p.h + 1), height: pl.Y(p.m) - pl.Y(yhi), fill: C.ok, opacity: 0.12 * p4 }, pl.g); }
      curve(pl, f, x0, x1, p0, { stroke: C.c1, "stroke-width": 2.6 });
      if (p0 >= 1) {
        dot(pl, p.h, p.q, { fill: C.c2, r: 6 }); label(pl, p.h, p.q, `(${p.h}, ${p.q})`, { dx: 34, dy: -6, fill: C.c2, cls: "mono", "font-size": 12 });
        const px = p.h + 1.7, py = f(px); dot(pl, px, py, { fill: C.c4 }); dot(pl, 2 * p.h - px, 2 * p.q - py, { fill: C.c4 }); seg(pl, px, py, 2 * p.h - px, 2 * p.q - py, 1, { stroke: C.c4, "stroke-dasharray": "4 3", "stroke-width": 1.4 });
      }
      let k = null;
      if (c.k === 1) k = lerp(p.m - 2.5, p.M + 2.5, p1); else if (c.k === 2) k = p.M; else if (c.k === 3) k = p.q; else if (c.k === 4) k = p.m;
      if (k !== null) {
        seg(pl, x0, k, x1, k, 1, { stroke: C.c2, "stroke-width": 2, "stroke-dasharray": "6 4" });
        label(pl, x0 + 0.3, k, "y = " + fmt(k, 1), { dy: -8, dx: 10, fill: C.c2, cls: "mono", "font-size": 12.5, "text-anchor": "start" });
        const roots = []; let prev = f(x0) - k;
        for (let i = 1; i <= 600; i++) { const x = x0 + ((x1 - x0) * i) / 600; const v = f(x) - k; if (prev === 0 || prev * v < 0) roots.push(x - (x1 - x0) / 1200); prev = v; }
        if (Math.abs(k - p.M) < 0.03 && !roots.some(r => Math.abs(r - (p.h - 1)) < 0.15)) roots.push(p.h - 1);
        if (Math.abs(k - p.m) < 0.03 && !roots.some(r => Math.abs(r - (p.h + 1)) < 0.15)) roots.push(p.h + 1);
        roots.forEach(r => dot(pl, r, k, { fill: C.c2, r: 5.5 }));
        tag(c.svg, c.W - 12, 24, `f(x) = ${fmt(k, 1)} 的實根：${roots.length} 個`, { anchor: "end", fill: C.c2, "font-size": 13, "font-weight": 600 });
      }
      if (c.k === 2) { label(pl, p.h - 1, p.M, `相切：重根 x = ${p.h - 1}`, { dy: -14, fill: C.c2, "font-size": 12.5 }); label(pl, p.h + 2, p.M, `x = ${p.h + 2}`, { dy: 18, fill: C.c2, "font-size": 12.5, cls: "mono" }); }
      if (c.k === 3) { [[p.h - 2, f(p.h - 2)], [p.h - 1, f(p.h - 1)], [p.h + 1, f(p.h + 1)], [p.h + 2, f(p.h + 2)]].forEach(([x, y], i) => { const q = sub(p3, i / 5, (i + 2) / 5); if (q <= 0) return; dot(pl, x, y, { fill: y > p.q ? C.ok : C.bad, r: 5, opacity: q }); label(pl, x, y, `f(${x}) = ${y}`, { dy: y > p.q ? -12 : 20, fill: y > p.q ? C.ok : C.bad, cls: "mono", "font-size": 11.5, opacity: q }); }); }
      if (c.k === 4) label(pl, p.h + 2.4, yhi - 0.8, `x > ${p.h + 1} 時 f(x) > ${p.m}`, { fill: C.ok, "font-size": 12.5, "font-weight": 600, opacity: p4 });
    }
  });

  /* ---------- 第 8 題：遞迴數列平移成等比 ---------- */
  define("q8", {
    w: 640, h: 380, defaults: { p: 2, r: 1, s: 1, a1: 1, seq: [1, 3, 7, 15, 31], first: 2 },
    steps: (p) => [
      { title: "照遞迴式一項一項長出來", text: `a₁ = ${p.a1}。每一項都是「前一項的 ${p.p} 倍，再加 ${p.r}」：${p.seq.join(" → ")}。加 ${p.r} 的那一塊用橘色標出來，它讓數列不是純粹的倍增。` },
      { title: `每一項都補上 ${p.s}`, text: `把每根柱子多加 ${p.s} 塊（綠色）。神奇的事發生了：${p.seq.map(v => v + p.s).join("、")}，每一項恰好是前一項的 ${p.p} 倍。⟨aₙ + ${p.s}⟩ 是首項 ${p.first}、公比 ${p.p} 的等比數列。` },
      { title: `所以 aₙ = ${p.first === 1 ? "" : p.first === p.p ? "" : p.first + "·"}${p.p}${p.first === p.p ? "ⁿ" : "ⁿ⁻¹"} − ${p.s}`, text: `aₙ + ${p.s} = ${p.first}·${p.p}ⁿ⁻¹。這也解釋了為什麼 ⟨aₙ⟩ 不是等差：相鄰差 ${p.seq.slice(1).map((v, i) => v - p.seq[i]).join("、")} 一直在變。` },
      { title: `求和：把「−${p.s}」拆出來`, text: `Σ aₖ = (等比數列前 10 項和) − 10 × ${p.s} = ${p.first}·(${p.p}¹⁰ − 1)/(${p.p} − 1) − ${10 * p.s}。` }
    ],
    draw(c) {
      const p = c.p; const vals = p.seq; const maxV = vals[vals.length - 1] + p.s; const unit = Math.min(8.2, 250 / maxV); const bw = 58; const gapx = 40; const ox = 70, base = 320;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const g = el("g", null, c.svg);
      el("line", { x1: 30, y1: base, x2: c.W - 20, y2: base, stroke: C.axis, "stroke-width": 1.4 }, g);
      vals.forEach((v, i) => {
        const q = c.k === 0 ? sub(p0, i / 5, (i + 1) / 5) : 1; if (q <= 0) return;
        const x = ox + i * (bw + gapx); const hprev = i === 0 ? 0 : vals[i - 1] * unit; const total = v * unit * q;
        if (i === 0) el("rect", { x, y: base - total, width: bw, height: total, fill: C.c2, rx: 3 }, g);
        else {
          let drawn = 0;
          for (let k = 0; k < p.p; k++) { const hk = clamp(total - drawn, 0, hprev); if (hk > 0) { el("rect", { x, y: base - drawn - hk, width: bw, height: hk, fill: C.c1, opacity: 1 - 0.25 * k, rx: 3 }, g); if (k > 0) el("line", { x1: x, y1: base - drawn, x2: x + bw, y2: base - drawn, stroke: C.surface, "stroke-width": 2 }, g); } drawn += hprev; }
          const hC = clamp(total - p.p * hprev, 0, p.r * unit); if (hC > 0) el("rect", { x, y: base - p.p * hprev - hC, width: bw, height: hC, fill: C.c2, rx: 2 }, g);
        }
        if (p1 > 0) { const hh = p.s * unit * p1; el("rect", { x, y: base - v * unit - hh, width: bw, height: hh, fill: C.c3, rx: 2, opacity: 0.95 }, g); }
        el("text", { x: x + bw / 2, y: base + 18, text: "a" + "₁₂₃₄₅"[i], "font-size": 14, cls: "math", fill: C.ink2, "text-anchor": "middle" }, g);
        if (q >= 1) el("text", { x: x + bw / 2, y: base - v * unit - p.s * unit * p1 - 8, text: p1 > 0.5 ? `${v} + ${p.s} = ${v + p.s}` : String(v), "font-size": 13, cls: "mono", fill: p1 > 0.5 ? C.c3 : C.ink, "font-weight": 600, "text-anchor": "middle" }, g);
        if (p1 >= 1 && i < 4) el("text", { x: x + bw + gapx / 2, y: base - (v + p.s) * unit - 30, text: `×${p.p}`, "font-size": 13, cls: "mono", fill: C.c3, "text-anchor": "middle", "font-weight": 700 }, g);
        if (c.k === 0 && i > 0 && q > 0 && q < 1) el("text", { x: x + bw / 2, y: base - total - 8, text: `×${p.p} 再 +${p.r}`, "font-size": 12, fill: C.c2, "text-anchor": "middle" }, g);
      });
      const lx = 30, ly = 26;
      el("rect", { x: lx, y: ly - 9, width: 12, height: 12, fill: C.c1, rx: 2 }, g); el("text", { x: lx + 18, y: ly + 1, text: `前一項的 ${p.p} 倍`, "font-size": 12, fill: C.ink2 }, g);
      el("rect", { x: lx + 120, y: ly - 9, width: 12, height: 12, fill: C.c2, rx: 2 }, g); el("text", { x: lx + 138, y: ly + 1, text: `+${p.r}`, "font-size": 12, fill: C.ink2 }, g);
      if (p1 > 0) { el("rect", { x: lx + 180, y: ly - 9, width: 12, height: 12, fill: C.c3, rx: 2, opacity: p1 }, g); el("text", { x: lx + 198, y: ly + 1, text: `補上的 ${p.s}（aₙ + ${p.s}）`, "font-size": 12, fill: C.ink2, opacity: p1 }, g); }
      if (p1 >= 1) tag(c.svg, 30, 62, `aₙ₊₁ + ${p.s} = ${p.p}(aₙ + ${p.s})`, { fill: C.c3, "font-weight": 700, "font-size": 13 });
      if (p2 > 0) tag(c.svg, 30, 88, `aₙ + ${p.s} = ${p.first}·${p.p}ⁿ⁻¹  ⇒  aₙ = ${p.first}·${p.p}ⁿ⁻¹ − ${p.s}`, { fill: C.ink, "font-size": 13, opacity: p2 });
      if (p3 > 0) tag(c.svg, 30, 114, `Σ aₖ = ${p.first}(${p.p}¹⁰ − 1)/(${p.p} − 1) − ${10 * p.s}`, { fill: C.ok, "font-size": 13, "font-weight": 700, opacity: p3 });
    }
  });

  /* ---------- 第 9 題：資料線性變換 ---------- */
  const Q9_DEV = [20, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 7, 6, 5, 4, 4, 3, 3, 1, 0];
  define("q9", {
    w: 640, h: 400, defaults: { mu: 60, sd: 10, a: 1.2, b: -2, n: 40 },
    steps: (p) => {
      const m1 = p.a * p.mu, s1 = p.a * p.sd, m2 = m1 + p.b; const top = p.mu + 2 * p.sd;
      return [
        { title: `原始成績：平均 ${p.mu}、標準差 ${p.sd}`, text: `${p.n} 個點，平均線在 ${p.mu}，色帶是「平均 ± 一個標準差」。` },
        { title: `先乘 ${p.a}：整體被${p.a > 1 ? "拉開" : "壓縮"}`, text: `每個分數變成 ${p.a} 倍，點與點之間的距離也變成 ${p.a} 倍。平均變 ${fmt(m1)}，標準差變 ${fmt(s1)}。` },
        { title: `再${p.b >= 0 ? "加" : "減"} ${Math.abs(p.b)}：整體平移`, text: `全部往${p.b >= 0 ? "右" : "左"}移 ${Math.abs(p.b)}，平均變 ${fmt(m2)}，但點之間的距離完全沒變，標準差仍是 ${fmt(s1)}。` },
        { title: "z 分數看的是「離平均幾個標準差」", text: `${top} 分的同學原本是 +2 個標準差；調整後 ${fmt(p.a * top + p.b)} 分，離平均 ${fmt(m2)} 剛好 ${fmt(p.a * top + p.b - m2)} = 2 × ${fmt(s1)}，仍是 +2。相對位置不變。` },
        { title: "相關係數只看相對位置", text: "數學對英文的散布圖，正倍率不改變形狀；若改用 100 − x，圖左右翻轉，相關係數變號。" }
      ];
    },
    draw(c) {
      const p = c.p; const data = Q9_DEV.flatMap(d => (d === 0 ? [p.mu, p.mu] : [p.mu - d * p.sd / 10, p.mu + d * p.sd / 10]));
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      if (c.k < 4) {
        const allX = data.concat(data.map(v => p.a * v + p.b)); const xmin = Math.min(...allX) - 6, xmax = Math.max(...allX) + 6;
        const pl = plane(c.svg, { w: c.W, h: c.H, x0: xmin, x1: xmax, y0: 0, y1: 10, pad: { l: 20, r: 20, t: 40, b: 40 } });
        const { X, Y, g } = pl;
        const a = lerp(1, p.a, p1), b = lerp(0, p.b, p2); const T = (x) => a * x + b; const mean = T(p.mu), sd = p.sd * a;
        el("rect", { x: X(mean - sd), y: Y(9.6), width: X(mean + sd) - X(mean - sd), height: Y(-0.2) - Y(9.6), fill: C.c1, opacity: 0.1, rx: 6 }, g);
        el("line", { x1: X(mean), y1: Y(9.8), x2: X(mean), y2: Y(-0.3), stroke: C.c1, "stroke-width": 2, "stroke-dasharray": "5 4" }, g);
        el("line", { x1: X(xmin), y1: Y(0), x2: X(xmax), y2: Y(0), stroke: C.axis, "stroke-width": 1.4 }, g);
        const step = xmax - xmin > 120 ? 20 : 10;
        for (let v = Math.ceil(xmin / step) * step; v <= xmax; v += step) { el("line", { x1: X(v), y1: Y(0) - 3, x2: X(v), y2: Y(0) + 3, stroke: C.axis }, g); label(pl, v, 0, String(v), { dy: 16, cls: "mono", "font-size": 11, fill: C.ink3 }); }
        const counts = {}; const sorted = data.slice().sort((u, v) => u - v); const binW = Math.max(1, Math.round(p.sd / 5));
        const top = p.mu + 2 * p.sd, bottom = p.mu - 2 * p.sd;
        sorted.forEach((v, i) => {
          const q = c.k === 0 ? sub(p0, i / 60, (i + 20) / 60) : 1; if (q <= 0) return;
          const bin = Math.round(v / binW) * binW; counts[bin] = (counts[bin] || 0); const lvl = counts[bin]++;
          const tv = T(v); const hl = c.k === 3 && (Math.abs(v - top) < 1e-9 || Math.abs(v - bottom) < 1e-9);
          dot(pl, tv, 0.5 + lvl * 0.72, { r: hl ? 7 : 5, fill: hl ? C.c2 : C.c1, opacity: q });
          if (hl) label(pl, tv, 0.5 + lvl * 0.72, `${fmt(tv, 1)} 分  z = ${fmt((tv - mean) / sd, 0)}`, { dy: -14, fill: C.c2, "font-size": 12.5, "font-weight": 700, cls: "mono" });
        });
        label(pl, mean, 9.8, "平均 " + fmt(mean, 1), { dy: -6, fill: C.c1, "font-size": 13, "font-weight": 700 });
        arrow(pl, mean, 9.0, mean + sd, 9.0, 1, { stroke: C.c4, "stroke-width": 1.8, head: 6 });
        label(pl, mean + sd / 2, 9.0, "σ = " + fmt(sd, 1), { dy: -6, fill: C.c4, "font-size": 12, cls: "mono" });
        tag(c.svg, 20, 22, c.k === 0 ? "y = x" : c.k === 1 ? `y = ${p.a}x` : `y = ${p.a}x ${p.b >= 0 ? "+ " + p.b : "− " + (-p.b)}`, { fill: C.ink, cls: "mono", "font-size": 13, "font-weight": 600 });
        tag(c.svg, c.W - 20, 22, `平均 ${fmt(mean, 1)}，標準差 ${fmt(sd, 1)}`, { anchor: "end", fill: C.c1, "font-size": 12.5 });
      } else {
        const flip = p4;
        const pl = plane(c.svg, { w: c.W, h: c.H, x0: 20, x1: 100, y0: 30, y1: 100, pad: { l: 40, r: 16, t: 34, b: 30 } });
        grid(pl, 10, { opacity: 0.6 }); axes(pl, { xStep: 20, yStep: 20, xLabel: flip > 0.5 ? "100 − x" : "數學 x", yLabel: "英文" });
        data.forEach((v, i) => { const noise = Math.sin(i * 12.9898) * 7; const eng = clamp(65 + 0.6 * (v - p.mu) * (10 / p.sd) + noise, 32, 98); const x = lerp(v, 100 - v, flip); dot(pl, clamp(x, 20, 100), eng, { r: 4.5, fill: C.c1, opacity: 0.85 }); });
        tag(c.svg, c.W - 16, 22, `相關係數 r ≈ ${fmt(0.87 * (flip < 0.5 ? 1 : -1), 2)}`, { anchor: "end", fill: flip < 0.5 ? C.c1 : C.bad, "font-size": 13, "font-weight": 700 });
        tag(c.svg, 44, 22, flip < 0.5 ? `y = ${p.a}x ${p.b >= 0 ? "+ " + p.b : "− " + (-p.b)}：形狀不變` : "y = 100 − x：左右翻轉", { fill: C.ink, "font-size": 12.5 });
      }
    }
  });

  /* ---------- 第 10 題：內積、正射影、面積 ---------- */
  define("q10", {
    w: 640, h: 400, defaults: { a: [4, 3], b: [1, 2], dot: 10, det: 5, proj: [1.6, 1.2], t0: -2, la: 5, lb2: 5 },
    steps: (p) => {
      const [a1, a2] = p.a, [b1, b2] = p.b; const sum2 = (a1 + b1) ** 2 + (a2 + b2) ** 2;
      return [
        { title: `畫出 a = (${a1},${a2})、b = (${b1},${b2})`, text: `|a| = ${fmt(p.la)}，|b| = √${p.lb2}，內積 a·b = ${a1}·${b1} + ${a2}·${b2} = ${p.dot}。` },
        { title: "正射影就是影子", text: `從上方垂直於 a 打光，b 在 a 上的影子就是正射影：長度 = a·b / |a| = ${fmt(p.dot / p.la, 2)}，向量 = (a·b/|a|²) a = (${toFrac(p.proj[0])}, ${toFrac(p.proj[1])})。` },
        { title: "行列式給的是平行四邊形", text: `|${a1}·${b2} − ${a2}·${b1}| = ${Math.abs(p.det)} 是以 a、b 為鄰邊的平行四邊形面積，三角形只有一半 ${ftxt(Math.abs(p.det), 2)}。` },
        { title: "轉動 a + t b 直到與 b 垂直", text: `(a + t b)·b = ${p.dot} + ${p.lb2}t，t = ${toFrac(p.t0)} 時為 0。` },
        { title: "三角不等式", text: `a 與 b 不同向，a + b 走的是三角形的第三邊，|a + b| = √${sum2} ≈ ${fmt(Math.sqrt(sum2), 2)} < |a| + |b| ≈ ${fmt(p.la + Math.sqrt(p.lb2), 2)}。` }
      ];
    },
    draw(c) {
      const p = c.p; const a = p.a, b = p.b; const s = [a[0] + b[0], a[1] + b[1]];
      const B = bounds([[0, 0], a, b, s, [a[0] + p.t0 * b[0], a[1] + p.t0 * b[1]]], 1.2, 5);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: B.x0, x1: B.x1, y0: B.y0, y1: B.y1, square: true, pad: { l: 20, r: 10, t: 10, b: 20 } });
      grid(pl, 1); axes(pl, { xStep: 1, yStep: 1 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const la = p.la, uh = [a[0] / la, a[1] / la], nh = [-uh[1], uh[0]];
      if (c.k === 2) {
        poly(pl, [[0, 0], a, s, b], { fill: C.c3, opacity: 0.18 * p2 }); poly(pl, [[0, 0], a, b], { fill: C.c3, opacity: 0.3 * p2 });
        polyline(pl, [a, s, b], { stroke: C.c3, "stroke-dasharray": "4 3", "stroke-width": 1.4, opacity: p2 });
        label(pl, s[0] / 2, s[1] / 2, `平行四邊形 ${Math.abs(p.det)}`, { dx: 10, dy: -4, fill: C.c3, "font-size": 12.5, opacity: p2 });
        label(pl, (a[0] + b[0]) / 3, (a[1] + b[1]) / 3, `三角形 ${ftxt(Math.abs(p.det), 2)}`, { dx: 6, dy: 12, fill: C.c3, "font-size": 12.5, opacity: p2 });
      }
      arrow(pl, 0, 0, a[0], a[1], p0, { stroke: C.c1, "stroke-width": 2.8 });
      arrow(pl, 0, 0, b[0], b[1], p0, { stroke: C.c4, "stroke-width": 2.8 });
      label(pl, a[0], a[1], `a = (${a[0]}, ${a[1]})`, { dx: 34, dy: 4, fill: C.c1, cls: "math", "font-size": 13, opacity: p0 });
      label(pl, b[0], b[1], `b = (${b[0]}, ${b[1]})`, { dx: -8, dy: -12, fill: C.c4, cls: "math", "font-size": 13, opacity: p0, "text-anchor": "end" });
      if (p0 >= 1 && c.k <= 1) { arc(pl, 0, 0, 0.8, Math.atan2(a[1], a[0]), Math.atan2(b[1], b[0]), { stroke: C.c2 }); label(pl, 0.95 * Math.cos((Math.atan2(a[1], a[0]) + Math.atan2(b[1], b[0])) / 2), 0.95 * Math.sin((Math.atan2(a[1], a[0]) + Math.atan2(b[1], b[0])) / 2), "θ", { fill: C.c2, cls: "math", "font-size": 13 }); }
      if (p1 > 0) {
        const proj = p.proj;
        for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.36; const px = b[0] * t, py = b[1] * t; const k = (px * a[0] + py * a[1]) / (la * la); const pr = [k * a[0], k * a[1]]; seg(pl, px + nh[0] * 1.4, py + nh[1] * 1.4, pr[0], pr[1], p1, { stroke: C.warn, "stroke-width": 1, opacity: 0.55, "stroke-dasharray": "3 3" }); }
        seg(pl, b[0], b[1], proj[0], proj[1], p1, { stroke: C.c4, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        arrow(pl, 0, 0, proj[0], proj[1], p1, { stroke: C.c3, "stroke-width": 5 });
        rightAngle(pl, proj[0], proj[1], uh[0], uh[1], nh[0], nh[1], 0.25);
        label(pl, proj[0], proj[1], `正射影 (${toFrac(proj[0])}, ${toFrac(proj[1])})，長 ${fmt(p.dot / la, 2)}`, { dx: 20, dy: 20, fill: C.c3, "font-size": 12.5, "font-weight": 600, opacity: p1 });
        if (c.k <= 1) label(pl, a[0] * 0.75, a[1] * 0.75 - 1, `a·b = |a| × 影長 = ${fmt(la, 0)} × ${fmt(p.dot / la, 2)} = ${p.dot}`, { fill: C.ink, "font-size": 12.5, opacity: p1, dy: 22 });
      }
      if (c.k === 3) {
        const t = lerp(0, p.t0, p3); const v = [a[0] + t * b[0], a[1] + t * b[1]];
        arrow(pl, 0, 0, v[0], v[1], 1, { stroke: C.c2, "stroke-width": 2.6 });
        label(pl, v[0], v[1], `a + (${fmt(t, 1)}) b`, { dx: 30, dy: 16, fill: C.c2, cls: "math", "font-size": 12.5 });
        const dp = v[0] * b[0] + v[1] * b[1];
        tag(c.svg, c.W - 12, 24, `(a + t b)·b = ${p.dot} + ${p.lb2}t = ${fmt(dp, 1)}`, { anchor: "end", fill: Math.abs(dp) < 0.05 ? C.ok : C.c2, cls: "mono", "font-size": 12.5 });
        if (Math.abs(dp) < 0.05) { const lv = Math.hypot(v[0], v[1]) || 1, lb = Math.sqrt(p.lb2); rightAngle(pl, 0, 0, v[0] / lv, v[1] / lv, b[0] / lb, b[1] / lb, 0.3, { stroke: C.ok, "stroke-width": 2 }); tag(c.svg, c.W - 12, 48, `t = ${toFrac(p.t0)}：a + t b = (${fmt(v[0], 1)}, ${fmt(v[1], 1)}) ⊥ b`, { anchor: "end", fill: C.ok, "font-weight": 700 }); }
      }
      if (c.k === 4) {
        arrow(pl, a[0], a[1], s[0], s[1], p4, { stroke: C.c4, "stroke-width": 2, "stroke-dasharray": "5 3" });
        arrow(pl, 0, 0, s[0], s[1], p4, { stroke: C.c2, "stroke-width": 2.6 });
        label(pl, s[0], s[1], `a + b，長 ${fmt(Math.hypot(s[0], s[1]), 2)}`, { dx: -10, dy: -10, fill: C.c2, "font-size": 12.5, opacity: p4, "text-anchor": "end" });
        tag(c.svg, c.W - 12, 24, `|a| + |b| ≈ ${fmt(la + Math.sqrt(p.lb2), 2)} > |a + b|`, { anchor: "end", fill: C.ink, "font-size": 12.5, opacity: p4 });
      }
      if (c.k === 0 || c.k === 1) tag(c.svg, c.W - 12, 24, `a·b = ${a[0]}·${b[0]} + ${a[1]}·${b[1]} = ${p.dot}`, { anchor: "end", fill: C.c1, cls: "mono", "font-size": 12.5, "font-weight": 600 });
      if (c.k === 2) tag(c.svg, c.W - 12, 24, `| ${a[0]}·${b[1]} − ${a[1]}·${b[0]} | = ${Math.abs(p.det)}`, { anchor: "end", fill: C.c3, cls: "mono", "font-size": 12.5, "font-weight": 600 });
    }
  });

  /* ---------- 第 11 題：平面、法向量、距離、平行線 ---------- */
  define("q11", {
    w: 640, h: 420, defaults: { n: [1, 2, 2], D: 6, F: [2, 1, 1], v: [2, -1, 0], Q: [1, 1, 0], P: [3, 3, 3], t: 1, dist: 3 },
    steps: (p) => {
      const nl = Math.hypot(...p.n); const ic = p.n.map(k => p.D / k); const nq = p.n[0] * p.Q[0] + p.n[1] * p.Q[1] + p.n[2] * p.Q[2];
      const eq = `${p.n[0] === 1 ? "" : p.n[0]}x + ${p.n[1] === 1 ? "" : p.n[1]}y + ${p.n[2] === 1 ? "" : p.n[2]}z = ${p.D}`;
      return [
        { title: `平面 E：${eq}`, text: `先把它和三個座標軸的交點畫出來：(${fmt(ic[0])},0,0)、(0,${fmt(ic[1])},0)、(0,0,${fmt(ic[2])})。這片三角形只是平面的一小塊，平面本身是無限延伸的。` },
        { title: "係數就是法向量", text: `n = (${p.n.join(", ")}) 垂直於平面上的每一條線。它的長度是 ${fmt(nl)}，這個數字等一下會用到。` },
        { title: "點到平面的距離：沿法向量走", text: `從 P(${p.P.join(",")}) 沿 −n 方向走，走到平面時剛好是 (${p.F.join(",")})，走了 ${p.t} 個 |n| = ${fmt(p.dist)} 的長度。公式 |n·P − ${p.D}| / |n| 說的就是這件事。` },
        { title: "直線 L 的方向與 n 垂直", text: `L 的方向 (${p.v.join(",")}) 與 n 內積為 0，所以 L 平行於平面「或」躺在平面上。檢查 L 上的點 (${p.Q.join(",")})：代入得 ${nq} ≠ ${p.D}，不在平面上，所以是平行且不相交。` }
      ];
    },
    draw(c) {
      const p = c.p; const P3 = (x, y, z) => proj3(x, y, z);
      const ic = p.n.map(k => p.D / k);
      const Lp = (t) => [p.Q[0] + p.v[0] * t, p.Q[1] + p.v[1] * t, p.Q[2] + p.v[2] * t];
      const nTip = [p.F[0] + 0.8 * p.n[0], p.F[1] + 0.8 * p.n[1], p.F[2] + 0.8 * p.n[2]];
      const pts3 = [[ic[0], 0, 0], [0, ic[1], 0], [0, 0, ic[2]], p.P, p.F, nTip, Lp(-1.3), Lp(1.9), [ic[0] * 1.1, 0, 0], [0, ic[1] * 1.3, 0], [0, 0, ic[2] * 1.3]];
      const B = bounds(pts3.map(q => P3(...q)), 0.8, 5);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: B.x0, x1: B.x1, y0: B.y0, y1: B.y1, square: true, pad: { l: 8, r: 8, t: 8, b: 8 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const A3 = (a, b, pr, attrs) => { const u = P3(...a), v = P3(...b); arrow(pl, u[0], u[1], v[0], v[1], pr, attrs); };
      const S3 = (a, b, pr, attrs) => { const u = P3(...a), v = P3(...b); seg(pl, u[0], u[1], v[0], v[1], pr, attrs); };
      const D3 = (a, attrs) => { const u = P3(...a); dot(pl, u[0], u[1], attrs); };
      const L3 = (a, str, attrs) => { const u = P3(...a); label(pl, u[0], u[1], str, attrs); };
      A3([0, 0, 0], [ic[0] * 1.15, 0, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, ic[1] * 1.35, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 0, ic[2] * 1.3], 1, { stroke: C.axis, "stroke-width": 1.3 });
      L3([ic[0] * 1.22, 0, 0], "x", { cls: "math", fill: C.ink3 }); L3([0, ic[1] * 1.42, 0], "y", { cls: "math", fill: C.ink3 }); L3([0, 0, ic[2] * 1.38], "z", { cls: "math", fill: C.ink3 });
      const tri = [[ic[0], 0, 0], [0, ic[1], 0], [0, 0, ic[2]]].map(q => P3(...q));
      if (p0 > 0) {
        poly(pl, [tri[0], [lerp(tri[0][0], tri[1][0], p0), lerp(tri[0][1], tri[1][1], p0)], [lerp(tri[0][0], tri[2][0], p0), lerp(tri[0][1], tri[2][1], p0)]], { fill: C.c1, opacity: 0.22 });
        polyline(pl, tri.concat([tri[0]]), { stroke: C.c1, "stroke-width": 1.8, opacity: p0 });
        L3([ic[0], 0, 0], `(${fmt(ic[0])},0,0)`, { dy: 16, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 }); L3([0, ic[1], 0], `(0,${fmt(ic[1])},0)`, { dx: 30, dy: 4, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 }); L3([0, 0, ic[2]], `(0,0,${fmt(ic[2])})`, { dx: -30, dy: -4, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 });
        tag(c.svg, 12, 22, `E：${p.n[0] === 1 ? "" : p.n[0]}x + ${p.n[1] === 1 ? "" : p.n[1]}y + ${p.n[2] === 1 ? "" : p.n[2]}z = ${p.D}`, { fill: C.c1, "font-weight": 700, "font-size": 13 });
      }
      const nl = Math.hypot(...p.n);
      if (p1 > 0) {
        A3(p.F, nTip, p1, { stroke: C.c2, "stroke-width": 2.6 });
        L3([(p.F[0] + nTip[0]) / 2, (p.F[1] + nTip[1]) / 2, (p.F[2] + nTip[2]) / 2], `n = (${p.n.join(", ")})`, { dx: -52, dy: 4, fill: C.c2, cls: "math", "font-size": 13, opacity: p1 });
        tag(c.svg, 12, 46, `|n| = √(${p.n.map(k => k * k).join("+")}) = ${fmt(nl)}`, { fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) {
        D3(p.P, { fill: C.c4, r: 5.5 }); L3(p.P, `P(${p.P.join(", ")})`, { dx: 44, dy: -4, fill: C.c4, cls: "mono", "font-size": 12 });
        const cur = [lerp(p.P[0], p.F[0], p2), lerp(p.P[1], p.F[1], p2), lerp(p.P[2], p.F[2], p2)];
        S3(p.P, cur, 1, { stroke: C.c4, "stroke-width": 2, "stroke-dasharray": "5 3" }); D3(cur, { fill: C.c4, r: 4 });
        if (p2 >= 1) { D3(p.F, { fill: C.ok, r: 5.5 }); L3(p.F, `垂足 (${p.F.join(", ")})`, { dx: 6, dy: 18, fill: C.ok, cls: "mono", "font-size": 12, "text-anchor": "start" }); }
        const num = Math.abs(p.n[0] * p.P[0] + p.n[1] * p.P[1] + p.n[2] * p.P[2] - p.D);
        tag(c.svg, 12, 70, `距離 = ${num} / ${fmt(nl)} = ${fmt(p.dist * p2, 1)}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
      }
      if (p3 > 0) {
        const a = Lp(-1.3), b = Lp(1.9);
        S3(a, [lerp(a[0], b[0], p3), lerp(a[1], b[1], p3), lerp(a[2], b[2], p3)], 1, { stroke: C.c3, "stroke-width": 2.6 });
        const nq = p.n[0] * p.Q[0] + p.n[1] * p.Q[1] + p.n[2] * p.Q[2];
        D3(p.Q, { fill: C.c3, r: 5 }); L3(p.Q, `(${p.Q.join(",")})：${nq} ≠ ${p.D}`, { dx: 10, dy: 18, fill: C.c3, "font-size": 11.5, cls: "mono", "text-anchor": "start", opacity: p3 });
        const vt = [p.Q[0] + 0.6 * p.v[0], p.Q[1] + 0.6 * p.v[1], p.Q[2] + 0.6 * p.v[2]];
        A3(p.Q, vt, p3, { stroke: C.c3, "stroke-width": 2 });
        L3(vt, `(${p.v.join(", ")})`, { dx: 0, dy: 16, fill: C.c3, cls: "mono", "font-size": 11.5, opacity: p3 });
        L3(b, "L", { dx: 8, dy: -6, fill: C.c3, cls: "math", "font-size": 14, opacity: p3 });
        tag(c.svg, 12, 94, `(${p.v.join(",")})·(${p.n.join(",")}) = 0，且 (${p.Q.join(",")}) ∉ E  ⇒  L ∥ E`, { fill: C.c3, "font-size": 12.5, opacity: p3 });
      }
    }
  });

  /* ---------- 第 12 題：二次曲線的定義與基本量 ---------- */
  define("q12", {
    w: 640, h: 400, defaults: { type: "hyperbola", a: 3, b: 4, c: 5, lr: 16 / 3 },
    steps: (p) => (p.type === "hyperbola" ? [
      { title: "先畫中心矩形", text: `a = ${p.a}、b = ${p.b}：以 x = ±${p.a}、y = ±${p.b} 圍出矩形，兩條對角線就是漸近線 y = ±(${p.b}/${p.a})x。` },
      { title: "雙曲線貼著漸近線長出來", text: `頂點在 (±${p.a}, 0)，貫軸長 2a = ${2 * p.a}。曲線離中心越遠，越貼近對角線。` },
      { title: "焦距 c 就是矩形的半對角線", text: `c² = a² + b² = ${p.c * p.c}。把半對角線（長 ${p.c}）轉到 x 軸上，就落在焦點 (±${p.c}, 0)。` },
      { title: "定義：到兩焦點的距離差固定", text: `P 在曲線上移動時，|PF₁ − PF₂| 永遠等於 2a = ${2 * p.a}，不是 2c = ${2 * p.c}。` },
      { title: `驗證 (${p.c}, ${toFrac(p.lr)})`, text: `x = ${p.c} 正好是焦點的 x 座標，代入得 y = ±${toFrac(p.lr)}，這兩點是正焦弦的端點（y = b²/a）。` }
    ] : [
      { title: "先看長短軸", text: `a = ${p.a}、b = ${p.b}：長軸在 x 軸上、長 2a = ${2 * p.a}；短軸長 2b = ${2 * p.b}。` },
      { title: "橢圓長出來", text: `頂點 (±${p.a}, 0)、(0, ±${p.b})。橢圓是被「壓扁的圓」，長短軸就是它的兩個半徑。` },
      { title: "焦距 c：短軸端點到焦點恰好是 a", text: `a² = b² + c²，c = ${p.c}。把長 a = ${p.a} 的線段從短軸端點 (0, ${p.b}) 轉下來碰到 x 軸，就落在焦點 (±${p.c}, 0)。` },
      { title: "定義：到兩焦點的距離和固定", text: `P 在橢圓上移動時，PF₁ + PF₂ 永遠等於 2a = ${2 * p.a}，不是 2c = ${2 * p.c}。` },
      { title: `驗證 (${p.c}, ${toFrac(p.lr)})`, text: `x = ${p.c} 是焦點的 x 座標，代入得 y = ±${toFrac(p.lr)}，這兩點是正焦弦的端點（y = b²/a）。` }
    ]),
    draw(c) {
      const p = c.p; const { a, b, c: cc } = p; const hyp = p.type === "hyperbola";
      const R = hyp ? Math.max(a, b) * 2.1 : Math.max(a, b) * 1.6;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -R * 1.05, x1: R * 1.05, y0: -R * 0.75, y1: R * 0.75, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      grid(pl, 1, { opacity: 0.6 }); axes(pl, { xStep: 2, yStep: 2 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      if (hyp) {
        if (p0 > 0) {
          polyline(pl, [[-a, -b], [a, -b], [a, b], [-a, b], [-a, -b]], { stroke: C.c2, "stroke-width": 1.4, "stroke-dasharray": "5 3", opacity: p0 });
          const q = sub(p0, 0.4, 1); const ex = R * 1.1;
          seg(pl, -ex * q, -ex * q * b / a, ex * q, ex * q * b / a, 1, { stroke: C.c2, "stroke-width": 1.4 });
          seg(pl, -ex * q, ex * q * b / a, ex * q, -ex * q * b / a, 1, { stroke: C.c2, "stroke-width": 1.4 });
          label(pl, R * 0.55, R * 0.55 * b / a + 0.6, `y = (${b}/${a})x`, { fill: C.c2, cls: "math", "font-size": 12, opacity: q });
          label(pl, R * 0.55, -R * 0.55 * b / a - 0.6, `y = −(${b}/${a})x`, { fill: C.c2, cls: "math", "font-size": 12, opacity: q });
        }
        const U = Math.acosh(R / a);
        if (p1 > 0) {
          [1, -1].forEach(sgn => { const pts1 = [], pts2 = []; for (let i = 0; i <= 80; i++) { const u = (i / 80) * U * p1; pts1.push([sgn * a * Math.cosh(u), b * Math.sinh(u)]); pts2.push([sgn * a * Math.cosh(u), -b * Math.sinh(u)]); } polyline(pl, pts1, { stroke: C.c1, "stroke-width": 2.6 }); polyline(pl, pts2, { stroke: C.c1, "stroke-width": 2.6 }); });
          dot(pl, a, 0, { fill: C.c1 }); dot(pl, -a, 0, { fill: C.c1 });
          if (c.k === 1) { seg(pl, -a, -0.6, a, -0.6, 1, { stroke: C.c1, "stroke-width": 1.5 }); label(pl, 0, -0.6, `貫軸長 2a = ${2 * a}`, { dy: 16, fill: C.c1, "font-size": 12.5 }); }
        }
        if (p2 > 0) {
          const ang = Math.atan2(b, a) * (1 - p2);
          seg(pl, 0, 0, cc * Math.cos(ang), cc * Math.sin(ang), 1, { stroke: C.c4, "stroke-width": 2.4 });
          arc(pl, 0, 0, 1.1, ang, Math.atan2(b, a), { stroke: C.c4, "stroke-width": 1.2, "stroke-dasharray": "3 3" });
          label(pl, cc * Math.cos(ang) / 2, cc * Math.sin(ang) / 2, `c = ${cc}`, { dx: 16, dy: -8, fill: C.c4, cls: "math", "font-size": 13 });
          tag(c.svg, 12, 22, `c² = a² + b² = ${a * a} + ${b * b} = ${cc * cc}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
        }
      } else {
        if (p0 > 0) {
          seg(pl, -a, 0, a, 0, p0, { stroke: C.c2, "stroke-width": 3 }); seg(pl, 0, -b, 0, b, p0, { stroke: C.c4, "stroke-width": 3 });
          label(pl, a / 2, 0, `長軸 2a = ${2 * a}`, { dy: 18, fill: C.c2, "font-size": 12, opacity: p0 }); label(pl, 0, b / 2, `短軸 2b = ${2 * b}`, { dx: 44, fill: C.c4, "font-size": 12, opacity: p0 });
        }
        if (p1 > 0) { const pts = []; for (let i = 0; i <= 120; i++) { const th = (i / 120) * 2 * PI * p1; pts.push([a * Math.cos(th), b * Math.sin(th)]); } polyline(pl, pts, { stroke: C.c1, "stroke-width": 2.6 }); [[a, 0], [-a, 0], [0, b], [0, -b]].forEach(q => dot(pl, q[0], q[1], { fill: C.c1 })); }
        if (p2 > 0) {
          const ang = PI / 2 - (PI / 2 - Math.asin(b / a)) * p2; // 從 (0,b) 方向轉到焦點方向（長度 a）
          const ex = a * Math.cos(ang), ey = a * Math.sin(ang);
          seg(pl, 0, 0, ex, ey, 1, { stroke: C.c4, "stroke-width": 2.4 });
          label(pl, ex / 2, ey / 2, `a = ${a}`, { dx: 16, dy: -8, fill: C.c4, cls: "math", "font-size": 13 });
          if (p2 >= 1) { seg(pl, 0, b, cc, 0, 1, { stroke: C.c4, "stroke-width": 1.6, "stroke-dasharray": "4 3" }); label(pl, cc / 2, b / 2, `a`, { dx: 10, dy: -6, fill: C.c4, cls: "math", "font-size": 13 }); }
          tag(c.svg, 12, 22, `c² = a² − b² = ${a * a} − ${b * b} = ${cc * cc}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
        }
      }
      if (p2 >= 1) { dot(pl, cc, 0, { fill: C.c4, r: 6 }); dot(pl, -cc, 0, { fill: C.c4, r: 6 }); label(pl, cc, 0, `F₁(${cc}, 0)`, { dy: -11, dx: 14, fill: C.c4, cls: "mono", "font-size": 12 }); label(pl, -cc, 0, `F₂(−${cc}, 0)`, { dy: -11, dx: -14, fill: C.c4, cls: "mono", "font-size": 12 }); }
      if (p3 > 0) {
        let Pt;
        if (hyp) { const u = lerp(-1.25, 1.25, p3) * (Math.acosh(R / a) / 1.55); Pt = [a * Math.cosh(u), b * Math.sinh(u)]; }
        else { const th = lerp(0.3, 2 * PI - 0.3, p3); Pt = [a * Math.cos(th), b * Math.sin(th)]; }
        seg(pl, Pt[0], Pt[1], cc, 0, 1, { stroke: C.c3, "stroke-width": 1.8 }); seg(pl, Pt[0], Pt[1], -cc, 0, 1, { stroke: C.c3, "stroke-width": 1.8 });
        dot(pl, Pt[0], Pt[1], { fill: C.c3, r: 6 }); label(pl, Pt[0], Pt[1], "P", { dx: 14, dy: 4, fill: C.c3, cls: "math", "font-size": 14 });
        const d1 = Math.hypot(Pt[0] - cc, Pt[1]), d2 = Math.hypot(Pt[0] + cc, Pt[1]);
        tag(c.svg, 12, 46, hyp ? `PF₂ − PF₁ = ${fmt(d2, 2)} − ${fmt(d1, 2)} = ${fmt(d2 - d1, 2)} = 2a` : `PF₁ + PF₂ = ${fmt(d1, 2)} + ${fmt(d2, 2)} = ${fmt(d1 + d2, 2)} = 2a`, { fill: C.c3, cls: "mono", "font-size": 12.5 });
      }
      if (p4 > 0) {
        seg(pl, cc, -p.lr, cc, p.lr, p4, { stroke: C.c5, "stroke-width": 2.2, "stroke-dasharray": "5 3" });
        dot(pl, cc, p.lr, { fill: C.c5, r: 6, opacity: p4 }); dot(pl, cc, -p.lr, { fill: C.c5, r: 6, opacity: p4 });
        label(pl, cc, p.lr, `(${cc}, ${toFrac(p.lr)})`, { dx: 40, dy: -4, fill: C.c5, cls: "mono", "font-size": 12.5, opacity: p4 });
        tag(c.svg, 12, 70, `代入成立 ✓（正焦弦端點 y = b²/a = ${toFrac(p.lr)}）`, { fill: C.c5, "font-size": 12.5, opacity: p4 });
      }
    }
  });
})(window.ANIM);

/* ======================================================================
 * 各題動畫（第 13～20 題）
 * ==================================================================== */
(function (A) {
  "use strict";
  const { define, C, el, lerp, sub, fmt, ftxt, toFrac, bounds, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, proj3, clamp } = A;

  /* ---------- 第 13 題：依餘數分堆 ---------- */
  define("q13", {
    w: 640, h: 380, defaults: { n: 9, classes: [[3, 6, 9], [1, 4, 7], [2, 5, 8]], same: 3, each: 27, total: 30 },
    steps: (p) => {
      const sizes = p.classes.map(c => c.length); const C3 = (k) => (k * (k - 1) * (k - 2)) / 6;
      return [
        { title: "只看除以 3 的餘數", text: `三個數的和是不是 3 的倍數，只跟它們的餘數有關。把 1～${p.n} 依餘數 0、1、2 分成三堆，各有 ${sizes.join("、")} 個。` },
        { title: "情形一：三個同一堆", text: `餘數 0+0+0、1+1+1、2+2+2 都是 3 的倍數。三堆各取三個的方法數 ${sizes.map(k => `C(${k},3)=${C3(k)}`).join("、")}，共 ${p.same} 種。` },
        { title: "情形二：三堆各取一個", text: `餘數 0+1+2 = 3。三堆的個數相乘：${sizes.join(" × ")} = ${p.each} 種。` },
        { title: "其他組合都不行", text: "例如兩個餘 0 加一個餘 1，餘數和是 1；兩個餘 1 加一個餘 2，餘數和是 4。都不是 3 的倍數。" },
        { title: `合計 ${p.same} + ${p.each} = ${p.total}`, text: `答案是 ${p.total}。分類討論的關鍵，是找到「真正影響結果的特徵」——這題是餘數。` }
      ];
    },
    draw(c) {
      const p = c.p; const cls = p.classes; const n = p.n;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const g = el("g", null, c.svg);
      const cols = [C.c1, C.c2, C.c3]; const names = cls.map((cl, r) => `餘 ${r}：{${cl.join(", ")}}`);
      const S = n > 9 ? 38 : 44; const rowGap = n > 9 ? 50 : 60;
      const posRow = (k) => [40 + (k - 1) * ((560) / Math.max(1, n - 1)), 56];
      const posGrp = (k) => { const r = k % 3, j = cls[r].indexOf(k); return [120 + r * 190, 150 + j * rowGap]; };
      for (let r = 0; r < 3; r++) el("text", { x: 120 + r * 190 + S / 2, y: 128, text: names[r], "font-size": 12.5, fill: cols[r], "text-anchor": "middle", "font-weight": 600, opacity: p0 }, g);
      let hi = -1; if (c.k === 1) hi = Math.min(2, Math.floor(p1 * 3));
      const ring = (k, color, dash) => { const q = posGrp(k); el("rect", { x: q[0] - 4, y: q[1] - 4, width: S + 8, height: S + 8, rx: 10, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-dasharray": dash || null }, g); };
      if (c.k === 2) {
        const total = cls[0].length * cls[1].length * cls[2].length; const pick = Math.min(total - 1, Math.floor(p2 * total));
        const i0 = pick % cls[0].length, i1 = Math.floor(pick / cls[0].length) % cls[1].length, i2 = Math.floor(pick / (cls[0].length * cls[1].length)) % cls[2].length;
        const chosen = [cls[0][i0], cls[1][i1], cls[2][i2]];
        const pts = chosen.map(k => posGrp(k));
        polyline({ X: (x) => x, Y: (y) => y, g }, pts.map(q => [q[0] + S / 2, q[1] + S / 2]), { stroke: C.c4, "stroke-width": 3, opacity: 0.8 });
        el("text", { x: 320, y: c.H - 22, text: `{${chosen.join(", ")}}：和 = ${chosen[0] + chosen[1] + chosen[2]}，第 ${pick + 1} / ${total} 種`, "font-size": 13, cls: "mono", fill: C.c4, "text-anchor": "middle", "font-weight": 600 }, g);
        chosen.forEach(k => ring(k, C.c4));
      }
      if (c.k === 3) {
        const bad = p3 < 0.5 ? [[cls[0][0], cls[0][1], cls[1][0]], "0 + 0 + 1 = 1"] : [[cls[1][0], cls[1][1], cls[2][0]], "1 + 1 + 2 = 4"];
        bad[0].forEach(k => ring(k, C.bad, "5 3"));
        el("text", { x: 320, y: c.H - 22, text: `餘數 ${bad[1]}，不是 3 的倍數 ✗`, "font-size": 13.5, cls: "mono", fill: C.bad, "text-anchor": "middle", "font-weight": 600 }, g);
      }
      for (let k = 1; k <= n; k++) {
        const r = k % 3; const a = posRow(k), b = posGrp(k); const x = lerp(a[0], b[0], p0), y = lerp(a[1], b[1], p0);
        const inHi = hi >= 0 && r === hi;
        el("rect", { x, y, width: S, height: S, rx: 9, fill: cols[r], opacity: p0 > 0.3 ? (inHi ? 1 : 0.85) : 0.5, stroke: inHi ? C.ink : "none", "stroke-width": 2.5 }, g);
        el("text", { x: x + S / 2, y: y + S / 2 + 7, text: String(k), "font-size": n > 9 ? 17 : 20, fill: "#fff", "text-anchor": "middle", "font-weight": 700, cls: "mono" }, g);
        if (p0 > 0.5) el("text", { x: x + S / 2, y: y + S + 12, text: "餘 " + r, "font-size": 10, fill: C.ink3, "text-anchor": "middle", opacity: sub(p0, 0.5, 1) }, g);
      }
      const C3 = (k) => (k * (k - 1) * (k - 2)) / 6;
      if (c.k === 1) el("text", { x: 320, y: c.H - 22, text: `${names[hi]}：同堆取三個，C(${cls[hi].length},3) = ${C3(cls[hi].length)} 種`, "font-size": 13.5, fill: C.ink, "text-anchor": "middle", cls: "mono", "font-weight": 600 }, g);
      if (c.k === 0) el("text", { x: 320, y: c.H - 22, text: `1～${n} 依餘數分成三堆`, "font-size": 13.5, fill: C.ink2, "text-anchor": "middle" }, g);
      if (p1 >= 1) tag(c.svg, 12, 22, `同堆取三個：${p.same} 種`, { fill: C.c1, "font-size": 12.5, "font-weight": 600 });
      if (p2 >= 1) tag(c.svg, 12, 46, `三堆各取一個：${cls.map(x => x.length).join(" × ")} = ${p.each} 種`, { fill: C.c4, "font-size": 12.5, "font-weight": 600 });
      if (p4 > 0) tag(c.svg, 12, 70, `合計 ${p.same} + ${p.each} = ${p.total} 種`, { fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p4 });
    }
  });

  /* ---------- 第 14 題：餘弦定理 → 正弦定理 → 外接圓 ---------- */
  define("q14", {
    w: 640, h: 400, defaults: { b: 5, c: 3, A: 120, a: 7 },
    steps: (p) => {
      const obt = p.A === 120; const h = `${p.b}√3/2`, dx = obt ? `${p.c} + ${p.b}/2 = ${fmt(p.c + p.b / 2, 1)}` : `${p.c} − ${p.b}/2 = ${fmt(Math.abs(p.c - p.b / 2), 1)}`;
      const cd2 = (p.b * p.b * 3) / 4, db2 = obt ? (p.c + p.b / 2) ** 2 : (p.c - p.b / 2) ** 2;
      return [
        { title: "已知兩邊夾角", text: `AB = ${p.c}、AC = ${p.b}、∠A = ${p.A}°。要求外接圓半徑，得先知道一條邊「和它所對的角」——所以先把 BC 算出來。` },
        { title: "餘弦定理＝有角度修正的畢氏定理", text: `從 C 向直線 AB 作垂線，垂足 D。∠CAD = 60°，CD = ${h}、DB = ${dx}。BC² = CD² + DB² = ${fmt(cd2, 2)} + ${fmt(db2, 2)} = ${p.a * p.a}，BC = ${p.a}。這正是 ${p.c}² + ${p.b}² ${obt ? "+" : "−"} ${p.b * p.c} = ${p.a * p.a}。` },
        { title: "畫出外接圓", text: "三邊的中垂線交於圓心 O，半徑 R 就是要求的量。" },
        { title: "正弦定理：邊 ÷ 對角的正弦 ＝ 直徑", text: `取 B 的對徑點 B′，∠BCB′ = 90°、∠BB′C = ${obt ? "60°（與 120° 互補）" : "60°（與 ∠A 同弧）"}，所以 BC = BB′·sin 60°，即 2R = ${p.a} / sin ${p.A}° = ${2 * p.a}/√3，R = ${p.a}√3/3 ≈ ${fmt(p.a / Math.sqrt(3), 2)}。` }
      ];
    },
    draw(c) {
      const p = c.p; const Arad = p.A * PI / 180;
      const Apt = [0, 0], B = [p.c, 0], Cc = [p.b * Math.cos(Arad), p.b * Math.sin(Arad)];
      // 外心
      const ox = p.c / 2; const oy = ((Cc[0] - ox) * (Cc[0] - ox) + Cc[1] * Cc[1] - ox * ox) / (2 * Cc[1]) ; // |O-A|²=|O-C|²，O=(ox, oy)
      const O = [ox, oy]; const R = Math.hypot(ox, oy);
      const Dp = [Cc[0], 0]; const Bp = [2 * O[0] - B[0], 2 * O[1] - B[1]];
      const Bd = bounds([Apt, B, Cc, Dp, Bp, [O[0] - R, O[1] - R], [O[0] + R, O[1] + R]], 0.6, 6);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: Bd.x0, x1: Bd.x1, y0: Bd.y0, y1: Bd.y1, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      if (p2 > 0) { circle(pl, O[0], O[1], R * p2, { stroke: C.c5, "stroke-width": 2 }); if (p2 >= 1) { dot(pl, O[0], O[1], { fill: C.c5 }); label(pl, O[0], O[1], "O", { dx: 12, dy: -4, fill: C.c5, cls: "math", "font-size": 14 }); } }
      poly(pl, [Apt, B, Cc], { fill: C.c1, opacity: 0.12 * p0 });
      seg(pl, Apt[0], Apt[1], B[0], B[1], p0, { stroke: C.c1, "stroke-width": 2.4 });
      seg(pl, Apt[0], Apt[1], Cc[0], Cc[1], p0, { stroke: C.c1, "stroke-width": 2.4 });
      seg(pl, B[0], B[1], Cc[0], Cc[1], p0, { stroke: C.c4, "stroke-width": 2.4 });
      label(pl, Apt[0], Apt[1], "A", { dx: -4, dy: 20, cls: "math", "font-size": 15 }); label(pl, B[0], B[1], "B", { dx: 10, dy: 20, cls: "math", "font-size": 15 }); label(pl, Cc[0], Cc[1], "C", { dx: Cc[0] < 0 ? -10 : 6, dy: -10, cls: "math", "font-size": 15 });
      label(pl, B[0] / 2, 0, String(p.c), { dy: 18, fill: C.c1, cls: "math", "font-size": 13 }); label(pl, Cc[0] / 2, Cc[1] / 2, String(p.b), { dx: Cc[0] < 0 ? 12 : -12, dy: 4, fill: C.c1, cls: "math", "font-size": 13 });
      label(pl, (B[0] + Cc[0]) / 2, (B[1] + Cc[1]) / 2, p1 >= 1 ? String(p.a) : "?", { dx: 12, dy: -4, fill: C.c4, cls: "math", "font-size": 14, "font-weight": 700 });
      arc(pl, 0, 0, Math.min(0.7, p.c / 4), 0, Arad, { stroke: C.c2 }); label(pl, Math.cos(Arad / 2) * 1.1, Math.sin(Arad / 2) * 1.1, `${p.A}°`, { fill: C.c2, "font-size": 12 });
      if (p1 > 0) {
        if (Dp[0] < 0 || Dp[0] > p.c) seg(pl, Dp[0] < 0 ? 0 : p.c, 0, Dp[0] * p1 + (Dp[0] < 0 ? 0 : (1 - p1) * p.c), 0, 1, { stroke: C.ink3, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        seg(pl, Cc[0], Cc[1], Cc[0], Cc[1] * (1 - p1), 1, { stroke: C.c3, "stroke-width": 2 });
        if (p1 >= 1) {
          rightAngle(pl, Dp[0], Dp[1], Dp[0] < B[0] ? 1 : -1, 0, 0, 1, 0.3); label(pl, Dp[0], Dp[1], "D", { dx: -10, dy: 18, cls: "math", "font-size": 14 });
          label(pl, Dp[0] / 2, 0, fmt(Math.abs(Dp[0]), 1), { dy: 18, fill: C.ink2, cls: "mono", "font-size": 12 }); label(pl, Cc[0], Cc[1] / 2, `${p.b}√3/2`, { dx: Cc[0] < 0 ? -28 : 28, fill: C.c3, cls: "mono", "font-size": 12 });
          if (p.A === 120) { arc(pl, 0, 0, 0.9, Arad, PI, { stroke: C.c3 }); label(pl, -1.1, 0.55, "60°", { fill: C.c3, "font-size": 11.5 }); }
          const cd2 = (p.b * p.b * 3) / 4, db2 = (p.c - Dp[0]) ** 2;
          tag(c.svg, 12, 22, `BC² = CD² + DB² = ${fmt(cd2, 2)} + ${fmt(db2, 2)} = ${p.a * p.a}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
          tag(c.svg, 12, 46, `＝ ${p.c}² + ${p.b}² − 2·${p.c}·${p.b}·cos${p.A}°  ⇒  BC = ${p.a}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
        }
      }
      if (p3 > 0) {
        seg(pl, B[0], B[1], Bp[0], Bp[1], p3, { stroke: C.c5, "stroke-width": 2, "stroke-dasharray": "6 4" });
        if (p3 >= 1) {
          dot(pl, Bp[0], Bp[1], { fill: C.c5 }); label(pl, Bp[0], Bp[1], "B′", { dx: -4, dy: -10, fill: C.c5, cls: "math", "font-size": 14 });
          seg(pl, Bp[0], Bp[1], Cc[0], Cc[1], 1, { stroke: C.c5, "stroke-width": 1.8 });
          const u = [(B[0] - Cc[0]), (B[1] - Cc[1])], lu = Math.hypot(u[0], u[1]); const v = [(Bp[0] - Cc[0]), (Bp[1] - Cc[1])], lv = Math.hypot(v[0], v[1]);
          rightAngle(pl, Cc[0], Cc[1], u[0] / lu, u[1] / lu, v[0] / lv, v[1] / lv, 0.35, { stroke: C.c5 });
          label(pl, (B[0] + Bp[0]) / 2, (B[1] + Bp[1]) / 2, "2R", { dx: 16, fill: C.c5, cls: "math", "font-size": 13 });
          tag(c.svg, 12, 70, `2R = BC / sin A = ${p.a} / (√3/2) = ${2 * p.a}/√3`, { fill: C.c5, cls: "mono", "font-size": 12.5 });
          tag(c.svg, 12, 94, `R = ${p.a}√3 / 3 ≈ ${fmt(p.a / Math.sqrt(3), 2)}`, { fill: C.ok, "font-size": 14, "font-weight": 700 });
        }
      }
    }
  });

  /* ---------- 第 15 題：外積＝面積＋法向量 ---------- */
  define("q15", {
    w: 640, h: 400, defaults: { a: 1, b: 2, c: 3, n: [6, 3, 2], S: 7 },
    steps: (p) => [
      { title: "三個點分別落在三條座標軸上", text: `A(${p.a},0,0)、B(0,${p.b},0)、C(0,0,${p.c})。先把它們連成三角形。` },
      { title: "用 A 當起點，寫出兩邊向量", text: `AB = (−${p.a}, ${p.b}, 0)、AC = (−${p.a}, 0, ${p.c})。三角形完全由這兩個向量決定。` },
      { title: "外積：長度是面積，方向是法向量", text: `AB × AC = (${p.b}·${p.c} − 0·0, 0·(−${p.a}) − (−${p.a})·${p.c}, (−${p.a})·0 − ${p.b}·(−${p.a})) = (${p.n.join(", ")})。它垂直於三角形所在的平面，所以 ${p.n[0]}x + ${p.n[1]}y + ${p.n[2]}z = ${p.a * p.b * p.c} 就是平面 ABC。` },
      { title: `|AB × AC| = ${p.S} 是平行四邊形面積`, text: `√(${p.n.map(k => k * k).join(" + ")}) = ${p.S}。三角形是平行四邊形的一半：${p.S}/2。` }
    ],
    draw(c) {
      const p = c.p; const K = { ax: -0.8, ay: -0.5 };
      const Ap = [p.a, 0, 0], Bp = [0, p.b, 0], Cp = [0, 0, p.c], Dp = [-p.a, p.b, p.c];
      const nl = Math.hypot(...p.n); const s = 1.6 / nl * Math.max(p.a, p.b, p.c) * 0.6; const tip = [Ap[0] + p.n[0] * s, Ap[1] + p.n[1] * s, Ap[2] + p.n[2] * s];
      const P3 = (x, y, z) => proj3(x, y, z, K);
      const Bd = bounds([Ap, Bp, Cp, Dp, tip, [0, 0, 0], [p.a * 1.3, 0, 0], [0, p.b * 1.3, 0], [0, 0, p.c * 1.25]].map(q => P3(...q)), 0.8, 5);
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: Bd.x0, x1: Bd.x1, y0: Bd.y0, y1: Bd.y1, square: true, pad: { l: 8, r: 8, t: 8, b: 8 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const A3 = (a, b, pr, attrs) => { const u = P3(...a), v = P3(...b); arrow(pl, u[0], u[1], v[0], v[1], pr, attrs); };
      const S3 = (a, b, pr, attrs) => { const u = P3(...a), v = P3(...b); seg(pl, u[0], u[1], v[0], v[1], pr, attrs); };
      const D3 = (a, attrs) => { const u = P3(...a); dot(pl, u[0], u[1], attrs); };
      const L3 = (a, str, attrs) => { const u = P3(...a); label(pl, u[0], u[1], str, attrs); };
      A3([0, 0, 0], [p.a * 1.3, 0, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, p.b * 1.3, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 0, p.c * 1.25], 1, { stroke: C.axis, "stroke-width": 1.3 });
      L3([p.a * 1.42, 0, 0], "x", { cls: "math", fill: C.ink3 }); L3([0, p.b * 1.4, 0], "y", { cls: "math", fill: C.ink3 }); L3([0, 0, p.c * 1.33], "z", { cls: "math", fill: C.ink3 });
      const tri = [Ap, Bp, Cp].map(q => P3(...q));
      if (p3 > 0) { const par = [Ap, Bp, Dp, Cp].map(q => P3(...q)); poly(pl, par, { fill: C.c3, opacity: 0.18 * p3 }); polyline(pl, par.concat([par[0]]), { stroke: C.c3, "stroke-width": 1.5, "stroke-dasharray": "5 3", opacity: p3 }); L3(Dp, "D", { dx: 10, dy: -6, cls: "math", "font-size": 13, fill: C.c3, opacity: p3 }); }
      poly(pl, tri, { fill: C.c1, opacity: 0.25 * p0 });
      S3(Ap, Bp, p0, { stroke: C.c1, "stroke-width": 2 }); S3(Bp, Cp, p0, { stroke: C.c1, "stroke-width": 2 }); S3(Cp, Ap, p0, { stroke: C.c1, "stroke-width": 2 });
      D3(Ap, { fill: C.c1 }); D3(Bp, { fill: C.c1 }); D3(Cp, { fill: C.c1 });
      L3(Ap, `A(${p.a},0,0)`, { dx: -8, dy: 20, cls: "mono", "font-size": 11.5 }); L3(Bp, `B(0,${p.b},0)`, { dx: 34, dy: 4, cls: "mono", "font-size": 11.5 }); L3(Cp, `C(0,0,${p.c})`, { dx: -34, dy: -4, cls: "mono", "font-size": 11.5 });
      if (p1 > 0) {
        A3(Ap, Bp, p1, { stroke: C.c2, "stroke-width": 3 }); A3(Ap, Cp, p1, { stroke: C.c4, "stroke-width": 3 });
        tag(c.svg, 12, 22, `AB = (−${p.a}, ${p.b}, 0)`, { fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p1 });
        tag(c.svg, 12, 46, `AC = (−${p.a}, 0, ${p.c})`, { fill: C.c4, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) {
        const cur = [Ap[0] + (tip[0] - Ap[0]) * p2, Ap[1] + (tip[1] - Ap[1]) * p2, Ap[2] + (tip[2] - Ap[2]) * p2];
        A3(Ap, cur, 1, { stroke: C.c3, "stroke-width": 3.2 });
        L3(tip, `AB × AC = (${p.n.join(", ")})`, { dx: 0, dy: 18, fill: C.c3, cls: "mono", "font-size": 12.5, "font-weight": 600, opacity: p2 });
        tag(c.svg, 12, 70, `(${p.b}·${p.c}−0·0, 0·(−${p.a})−(−${p.a})·${p.c}, (−${p.a})·0−${p.b}·(−${p.a}))`, { fill: C.c3, cls: "mono", "font-size": 11.5, opacity: p2 });
        tag(c.svg, 12, 94, `平面 ABC：${p.n[0]}x + ${p.n[1]}y + ${p.n[2]}z = ${p.a * p.b * p.c}`, { fill: C.c3, "font-size": 12.5, opacity: p2 });
      }
      if (p3 > 0) {
        tag(c.svg, c.W - 12, 22, `|(${p.n.join(",")})| = √${p.S * p.S} = ${p.S} ＝ 平行四邊形面積`, { anchor: "end", fill: C.c3, "font-size": 12.5, opacity: p3 });
        tag(c.svg, c.W - 12, 46, `△ABC = ${p.S} / 2`, { anchor: "end", fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 16 題：指數成長／衰變與對數尺 ---------- */
  define("q16", {
    w: 640, h: 400, defaults: { T: 3, R: 100, N0: 500, mode: "grow", tStar: 19.93, ans: 20, target: 50000 },
    steps: (p) => {
      const grow = p.mode === "grow"; const times = Math.log(p.R) / Math.log(2); const lo = Math.floor(times), hi = lo + 1;
      return [
        { title: `每 ${p.T} 小時${grow ? "翻一倍" : "減一半"}`, text: `${p.N0} → ${grow ? p.N0 * 2 : p.N0 / 2} → ${grow ? p.N0 * 4 : p.N0 / 4} …，每一步都是「${grow ? "乘" : "除以"} 2」。畫出來是一條${grow ? "越來越陡" : "越來越平"}的曲線 N = ${p.N0}·${grow ? "2" : "(1/2)"}^(t/${p.T})。` },
        { title: `目標是 ${grow ? p.R + " 倍" : "1/" + p.R}`, text: `${grow ? p.target.toLocaleString("en-US") + " ÷ " + p.N0 : p.N0 + " ÷ " + fmt(p.target, 2)} = ${p.R}。問題變成：2 要連乘幾次才會超過 ${p.R}？2^${lo} = ${Math.pow(2, lo)} 不夠，2^${hi} = ${Math.pow(2, hi)} 夠，答案介於 ${lo} 和 ${hi} 次之間。` },
        { title: "換成對數尺，曲線變直線", text: `把縱軸改成「每格乘 10」的對數尺，指數曲線就變成直線。乘法變加法，這就是對數的本事：${grow ? "翻倍" : "減半"}次數 = log ${p.R} / log 2 ≈ ${fmt(times, 2)}。` },
        { title: `${fmt(times, 2)} 次 × ${p.T} 小時 ≈ ${fmt(p.tStar, 2)} 小時`, text: `${p.ans - 1} 小時時還${grow ? "不到" : "沒低於"}目標，${p.ans} 小時時${grow ? "超過" : "低於"}了，所以第一次${grow ? "超過" : "低於"}是在 ${p.ans} 小時。` }
      ];
    },
    draw(c) {
      const p = c.p; const grow = p.mode === "grow";
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const W = c.W, H = c.H; const L = 62, Rr = 20, T = 18, Bm = 34;
      const tMax = Math.ceil((p.ans + 4) / p.T) * p.T;
      const X = (t) => L + (t / tMax) * (W - L - Rr);
      const f = (t) => (grow ? p.N0 * Math.pow(2, t / p.T) : p.N0 * Math.pow(0.5, t / p.T));
      const nMax = grow ? p.target * 1.4 : p.N0 * 1.1, nMin = grow ? 0 : 0;
      const logLo = Math.log10(grow ? p.N0 * 0.6 : p.target * 0.4), logHi = Math.log10(grow ? p.target * 1.8 : p.N0 * 1.6);
      const yLin = (n) => T + (1 - (n - nMin) / (nMax - nMin)) * (H - T - Bm);
      const yLog = (n) => T + (1 - (Math.log10(n) - logLo) / (logHi - logLo)) * (H - T - Bm);
      const m = p2; const Y = (n) => lerp(yLin(n), yLog(n), m);
      const g = el("g", null, c.svg);
      const kfmt = (v) => (v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + "k" : fmt(v, 2));
      const linStep = Math.pow(10, Math.floor(Math.log10(nMax))) / (nMax / Math.pow(10, Math.floor(Math.log10(nMax))) > 5 ? 1 : 2);
      for (let v = linStep; v < nMax; v += linStep) { el("line", { x1: L, y1: Y(v), x2: W - Rr, y2: Y(v), stroke: C.grid, opacity: 1 - m }, g); el("text", { x: L - 6, y: Y(v) + 4, text: kfmt(v), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: 1 - m }, g); }
      if (m > 0) { const lo = Math.ceil(logLo), hi = Math.floor(logHi); for (let e = lo - 1; e <= hi; e++) for (const k of [1, 2, 5]) { const v = k * Math.pow(10, e); if (Math.log10(v) < logLo || Math.log10(v) > logHi) continue; el("line", { x1: L, y1: Y(v), x2: W - Rr, y2: Y(v), stroke: C.grid, opacity: m * (k === 1 ? 1 : 0.5) }, g); if (k === 1 || k === 5) el("text", { x: L - 6, y: Y(v) + 4, text: kfmt(v), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: m }, g); } }
      el("line", { x1: L, y1: T, x2: L, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
      el("line", { x1: L, y1: H - Bm, x2: W - Rr, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
      for (let t = 0; t <= tMax; t += p.T) { el("line", { x1: X(t), y1: H - Bm - 3, x2: X(t), y2: H - Bm + 3, stroke: C.axis }, g); el("text", { x: X(t), y: H - Bm + 15, text: String(t), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "middle" }, g); }
      el("text", { x: W - Rr, y: H - Bm + 28, text: "t（小時）", "font-size": 11.5, fill: C.ink2, "text-anchor": "end" }, g);
      el("text", { x: L + 6, y: T - 6, text: m > 0.5 ? "數量（對數尺）" : "數量", "font-size": 11.5, fill: C.ink2 }, g);
      const inRange = (n) => (m > 0.5 ? Math.log10(n) >= logLo - 0.05 && Math.log10(n) <= logHi + 0.05 : n <= nMax * 1.02);
      const tEnd = tMax * p0; let d = ""; let pen = false;
      for (let i = 0; i <= 240; i++) { const t = (tEnd * i) / 240; const n = f(t); if (!inRange(n) || n <= 0) { pen = false; continue; } d += (pen ? "L" : "M") + fmt(X(t), 1) + " " + fmt(Y(n), 1); pen = true; }
      if (d) el("path", { d, fill: "none", stroke: C.c1, "stroke-width": 2.6 }, g);
      for (let k = 0; k * p.T <= tEnd; k++) { const t = k * p.T, n = f(t); if (!inRange(n)) continue; el("circle", { cx: X(t), cy: Y(n), r: 4.5, fill: C.c1, stroke: C.surface, "stroke-width": 1.5 }, g); if (k % 2 === 0 || m > 0.5) el("text", { x: X(t) + 6, y: Y(n) - 7, text: kfmt(n), "font-size": 10.5, cls: "mono", fill: C.c1 }, g); }
      if (p1 > 0) {
        el("line", { x1: L, y1: Y(p.target), x2: L + (W - L - Rr) * p1, y2: Y(p.target), stroke: C.bad, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
        el("text", { x: L + 8, y: Y(p.target) - 7, text: `目標 ${grow ? p.target.toLocaleString("en-US") : fmt(p.target, 2)} = ${grow ? p.R + " 倍" : "1/" + p.R}`, "font-size": 12.5, fill: C.bad, "font-weight": 600, opacity: p1 }, g);
        const lo = Math.floor(Math.log(p.R) / Math.log(2));
        tag(c.svg, L + 10, 40, `2^${lo} = ${Math.pow(2, lo)} < ${p.R} < ${Math.pow(2, lo + 1)} = 2^${lo + 1}`, { fill: C.ink, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) tag(c.svg, L + 10, 64, `${grow ? "翻倍" : "減半"}次數 = log ${p.R} / log 2 ≈ ${fmt(Math.log10(p.R), 3)} / 0.3010 ≈ ${fmt(Math.log(p.R) / Math.log(2), 2)}`, { fill: C.c1, cls: "mono", "font-size": 12.5, opacity: p2 });
      if (p3 > 0) {
        const t0 = p.tStar * p3;
        el("line", { x1: X(t0), y1: H - Bm, x2: X(t0), y2: Y(Math.max(f(t0), 1e-9)), stroke: C.ok, "stroke-width": 2 }, g);
        el("circle", { cx: X(t0), cy: Y(Math.max(f(t0), 1e-9)), r: 6, fill: C.ok }, g);
        if (p3 >= 1) {
          el("text", { x: X(p.tStar), y: H - Bm - 6, text: `t ≈ ${fmt(p.tStar, 2)}`, "font-size": 12, cls: "mono", fill: C.ok, "text-anchor": "middle", "font-weight": 700 }, g);
          el("circle", { cx: X(p.ans - 1), cy: Y(f(p.ans - 1)), r: 4, fill: C.bad }, g); el("text", { x: X(p.ans - 1) - 8, y: Y(f(p.ans - 1)) - 10, text: `${p.ans - 1}h：${kfmt(f(p.ans - 1))} ✗`, "font-size": 10.5, cls: "mono", fill: C.bad, "text-anchor": "end" }, g);
          el("circle", { cx: X(p.ans), cy: Y(f(p.ans)), r: 4, fill: C.ok }, g); el("text", { x: X(p.ans) + 10, y: Y(f(p.ans)) + 22, text: `${p.ans}h：${kfmt(f(p.ans))} ✓`, "font-size": 10.5, cls: "mono", fill: C.ok }, g);
          tag(c.svg, L + 10, 88, `t = ${p.T} × ${fmt(Math.log(p.R) / Math.log(2), 2)} ≈ ${fmt(p.tStar, 2)}  ⇒  至少 ${p.ans} 小時`, { fill: C.ok, "font-size": 13, "font-weight": 700 });
        }
      }
    }
  });

  /* ---------- 第 17 題：內積＝投影，圓上最長投影 ---------- */
  define("q17", {
    w: 640, h: 400, defaults: { r0: 2, p: 3, q: 4, lu: 5, want: "max", val: 10 },
    steps: (p) => {
      const mx = p.want === "max";
      return [
        { title: `把 ${p.p}x + ${p.q}y 看成內積`, text: `${p.p}x + ${p.q}y = (${p.p}, ${p.q})·(x, y)。點 (x, y) 在半徑 ${p.r0} 的圓上，(${p.p}, ${p.q}) 是一個固定向量，長度 ${p.lu}。` },
        { title: "內積 = |u| × 投影長", text: `讓 P 繞著圓走，看 OP 在 u = (${p.p},${p.q}) 方向上的影子。${p.p}x + ${p.q}y 永遠等於 ${p.lu} × 影長（影子反向時為負）。` },
        { title: mx ? "影子最長 = 半徑" : "影子反向最長 = −半徑", text: `OP 與 u ${mx ? "同向" : "反向"}時影長${mx ? "最大" : "最小"}，就是 ${mx ? "" : "−"}${p.r0}，所以${mx ? "最大" : "最小"}值 = ${p.lu} × ${mx ? "" : "(−"}${p.r0}${mx ? "" : ")"} = ${mx ? p.val : -p.val}，在 P = (${toFrac((mx ? 1 : -1) * p.r0 * p.p / p.lu)}, ${toFrac((mx ? 1 : -1) * p.r0 * p.q / p.lu)}) 達到。` },
        { title: "另一個角度：直線平移到相切", text: `${p.p}x + ${p.q}y = k 是一族平行線，k 越大越往 u 的方向。能碰到圓的${mx ? "最大" : "最小"} k，就是相切的那一條：|k| / ${p.lu} = ${p.r0}，k = ${mx ? p.val : -p.val}。` }
      ];
    },
    draw(c) {
      const p = c.p; const r0 = p.r0, u = [p.p, p.q], lu = p.lu, uh = [u[0] / lu, u[1] / lu]; const mx = p.want === "max";
      const R = r0 * 1.9;
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -R * 0.95, x1: R * 1.15, y0: -R * 0.75, y1: R * 1.1, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      grid(pl, r0 > 2 ? 2 : 1, { opacity: 0.6 }); axes(pl, { xStep: r0 > 2 ? 2 : 1, yStep: r0 > 2 ? 2 : 1 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      circle(pl, 0, 0, r0 * p0, { stroke: C.c1, "stroke-width": 2.4 });
      const us = r0 * 1.6 / lu; // 畫 u 的縮放
      arrow(pl, 0, 0, u[0] * us, u[1] * us, p0, { stroke: C.c2, "stroke-width": 2.8 });
      label(pl, u[0] * us, u[1] * us, `u = (${u[0]}, ${u[1]})，|u| = ${lu}`, { dx: 40, dy: 14, fill: C.c2, cls: "math", "font-size": 13, opacity: p0 });
      seg(pl, -uh[0] * R, -uh[1] * R, uh[0] * R * 1.2, uh[1] * R * 1.2, p0, { stroke: C.c2, "stroke-width": 1, "stroke-dasharray": "4 4", opacity: 0.6 });
      const thU = Math.atan2(u[1], u[0]); const thTarget = mx ? thU : thU + PI;
      if (p1 > 0 || p2 > 0) {
        let th;
        if (c.k === 1) th = lerp(thU - 2.7, thU - 2.7 + 2 * PI, p1);
        else if (c.k === 2) th = lerp(thU - 0.7, thTarget, p2);
        else th = thTarget;
        const P = [r0 * Math.cos(th), r0 * Math.sin(th)];
        const proj = P[0] * uh[0] + P[1] * uh[1]; const F = [uh[0] * proj, uh[1] * proj];
        seg(pl, P[0], P[1], F[0], F[1], 1, { stroke: C.c4, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        seg(pl, 0, 0, F[0], F[1], 1, { stroke: proj >= 0 ? C.c3 : C.bad, "stroke-width": 6, "stroke-linecap": "butt" });
        arrow(pl, 0, 0, P[0], P[1], 1, { stroke: C.c1, "stroke-width": 2.4 });
        dot(pl, P[0], P[1], { fill: C.c1, r: 6 }); label(pl, P[0], P[1], "P", { dx: 12, dy: -6, fill: C.c1, cls: "math", "font-size": 14 });
        const val = u[0] * P[0] + u[1] * P[1];
        tag(c.svg, 12, 22, `影長 = ${fmt(proj, 2)}`, { fill: proj >= 0 ? C.c3 : C.bad, cls: "mono", "font-size": 12.5 });
        const hit = Math.abs(val - (mx ? p.val : -p.val)) < 0.05;
        tag(c.svg, 12, 46, `${u[0]}x + ${u[1]}y = ${lu} × ${fmt(proj, 2)} = ${fmt(val, 2)}`, { fill: hit ? C.ok : C.ink, cls: "mono", "font-size": 13, "font-weight": hit ? 700 : 400 });
        if (c.k >= 2 && p2 >= 1) { label(pl, P[0], P[1], `(${toFrac(P[0])}, ${toFrac(P[1])})`, { dx: mx ? 44 : -44, dy: 12, fill: C.ok, cls: "mono", "font-size": 12 }); tag(c.svg, 12, 70, `${mx ? "最大" : "最小"}值 = ${lu} × ${mx ? "" : "(−"}${r0}${mx ? "" : ")"} = ${mx ? p.val : -p.val}`, { fill: C.ok, "font-size": 14, "font-weight": 700 }); }
      }
      if (p3 > 0) {
        const k = mx ? lerp(-p.val * 0.6, p.val, p3) : lerp(p.val * 0.6, -p.val, p3);
        curve(pl, (x) => (k - u[0] * x) / u[1], pl.o.x0, pl.o.x1, 1, { stroke: C.c5, "stroke-width": 2 });
        const lx = mx ? pl.o.x1 - 0.6 : pl.o.x0 + 0.6; const ly = clamp((k - u[0] * lx) / u[1], pl.o.y0 + 0.5, pl.o.y1 - 0.5);
        label(pl, lx, ly, `${u[0]}x + ${u[1]}y = ${fmt(k, 1)}`, { dy: -10, dx: mx ? -20 : 20, fill: C.c5, cls: "mono", "font-size": 12 });
        if (p3 >= 1) { const Pt = [(mx ? 1 : -1) * r0 * uh[0], (mx ? 1 : -1) * r0 * uh[1]]; dot(pl, Pt[0], Pt[1], { fill: C.ok, r: 6 }); tag(c.svg, c.W - 12, 22, `相切：|k| / ${lu} = ${r0}  ⇒  k = ${mx ? p.val : -p.val}`, { anchor: "end", fill: C.ok, "font-weight": 700, "font-size": 13 }); }
      }
    }
  });

  /* ---------- 第 18～20 題：等比成長取對數變直線 ---------- */
  const LF_DEFAULT = { xs: [0, 1, 2, 3, 4], ys: [8, 13, 20, 32, 50], Ys: [0.9, 1.11, 1.3, 1.51, 1.7], a0: 0.9, b: 0.2, xp: 6, Yp: 2.1, yp: 126, years: [2021, 2022, 2023, 2024, 2025], rate: 58, unit: "百萬元", label: "年營收" };
  const TEN = { 0: 1, 1: 1.26, 2: 1.58, 3: 2.0, 4: 2.51, 5: 3.16, 6: 3.98, 7: 5.01, 8: 6.31, 9: 7.94 };
  function lfSteps(p) {
    const ratio = TEN[Math.round(p.b * 10)] || Math.pow(10, p.b); const meanY = (p.a0 + 2 * p.b).toFixed(2);
    const fracDigit = Math.round((p.Yp - 2) * 10);
    return [
      { title: `${p.label}逐年往上彎`, text: `把 (x, y) 點出來：${p.ys.join("、")}。每年大約乘 ${ratio.toFixed(2)} 倍，所以不是直線，是往上彎的曲線——這是等比（指數）成長的長相。` },
      { title: "取對數：乘法變加法", text: `把縱軸換成 Y = log y。「每年乘固定倍率」變成「每年加固定的數」，五個點幾乎排成一直線。相關係數 0.9999 就是在說這件事。` },
      { title: "配迴歸直線", text: `斜率 b = Σ(x−x̄)(Y−Ȳ) / Σ(x−x̄)² = ${(10 * p.b).toFixed(2)} / 10 = ${p.b}；直線一定通過 (x̄, Ȳ) = (2, ${meanY})，所以截距 = ${meanY} − ${p.b}×2 = ${p.a0.toFixed(2)}。Y = ${p.b}x + ${p.a0.toFixed(2)}。` },
      { title: `外推到 ${p.years[0] + p.xp} 年再還原`, text: `x = ${p.xp} 時 Y = ${p.Yp.toFixed(1)}。這是對數值，要還原：y = 10^${p.Yp.toFixed(1)} = 100 × 10^0.${fracDigit} ≈ ${p.yp}（${p.unit}）。` },
      { title: `斜率 ${p.b} 的真正意思`, text: `Y 每年加 ${p.b}，等於 y 每年乘 10^${p.b} ≈ ${ratio.toFixed(2)}。所以「年成長率約 ${p.rate}%」——斜率不是「每年多 ${p.b}」，而是「每年乘 ${ratio.toFixed(2)}」。` }
    ];
  }
  function logfit(id, use) {
    define(id, {
      w: 640, h: 400, defaults: LF_DEFAULT,
      steps: (p) => { const all = lfSteps(p); return use.map(i => all[i]); },
      draw(c) {
        const p = c.p; const G = (gid) => { const j = use.indexOf(gid); return j < 0 ? 0 : c.P(j); };
        const p0 = G(0), p1 = G(1), p2 = G(2), p3 = G(3), p4 = G(4);
        const W = c.W, H = c.H, L = 52, Rr = 60, T = 22, Bm = 36;
        const xMaxAxis = Math.max(6, p.xp); const X = (x) => L + ((x + 0.5) / (xMaxAxis + 1.2)) * (W - L - Rr);
        const yTop = Math.max(...p.ys) * 1.2; const yLin = (y) => T + (1 - y / yTop) * (H - T - Bm);
        const YLo = Math.min(...p.Ys) - 0.3, YHi = Math.max(p.Yp, Math.max(...p.Ys)) + 0.2; const yLog = (Y) => T + (1 - (Y - YLo) / (YHi - YLo)) * (H - T - Bm);
        const m = p1; const Ypos = (y, Y) => lerp(yLin(y), yLog(Y), m);
        const g = el("g", null, c.svg);
        const linStep = yTop > 100 ? 50 : yTop > 40 ? 10 : 5;
        for (let v = linStep; v < yTop; v += linStep) { el("line", { x1: L, y1: Ypos(v, 0), x2: W - Rr, y2: Ypos(v, 0), stroke: C.grid, opacity: 1 - m }, g); el("text", { x: L - 6, y: yLin(v) + 4, text: String(v), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: 1 - m }, g); }
        if (m > 0) for (let v = Math.ceil(YLo * 5) / 5; v <= YHi; v += 0.2) { v = +v.toFixed(2); el("line", { x1: L, y1: yLog(v), x2: W - Rr, y2: yLog(v), stroke: C.grid, opacity: m }, g); el("text", { x: L - 6, y: yLog(v) + 4, text: fmt(v, 1), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: m }, g); el("text", { x: W - Rr + 6, y: yLog(v) + 4, text: "y≈" + fmt(Math.pow(10, v), 0), "font-size": 10, cls: "mono", fill: C.ink3, opacity: m * 0.9 }, g); }
        el("line", { x1: L, y1: T, x2: L, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
        el("line", { x1: L, y1: H - Bm, x2: W - Rr, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
        for (let x = 0; x <= xMaxAxis; x++) { el("line", { x1: X(x), y1: H - Bm - 3, x2: X(x), y2: H - Bm + 3, stroke: C.axis }, g); el("text", { x: X(x), y: H - Bm + 15, text: String(x), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "middle" }, g); el("text", { x: X(x), y: H - Bm + 28, text: String(p.years[0] + x), "font-size": 9.5, fill: C.ink3, "text-anchor": "middle" }, g); }
        el("text", { x: L + 6, y: T - 8, text: m > 0.5 ? "Y = log y" : `y（${p.unit}）`, "font-size": 12, fill: C.ink2, cls: "math" }, g);
        p.xs.forEach((x, i) => {
          const q = sub(p0, i / 6, (i + 2) / 6); if (q <= 0) return;
          el("circle", { cx: X(x), cy: Ypos(p.ys[i], p.Ys[i]), r: 6, fill: C.c1, stroke: C.surface, "stroke-width": 1.5, opacity: q }, g);
          el("text", { x: X(x), y: Ypos(p.ys[i], p.Ys[i]) - 11, text: m > 0.5 ? fmt(p.Ys[i], 2) : String(p.ys[i]), "font-size": 11, cls: "mono", fill: C.c1, "text-anchor": "middle", opacity: q }, g);
        });
        const ratio = TEN[Math.round(p.b * 10)] || Math.pow(10, p.b);
        if (p4 > 0) p.xs.slice(0, 4).forEach((x, i) => {
          const q = sub(p4, i / 5, (i + 2) / 5); if (q <= 0) return;
          const y1 = Ypos(p.ys[i], p.Ys[i]), y2 = Ypos(p.ys[i + 1], p.Ys[i + 1]);
          el("path", { d: `M${X(x) + 8} ${y1} L${X(x + 1) - 8} ${y2}`, stroke: C.c4, "stroke-width": 2, fill: "none", opacity: q }, g);
          el("text", { x: (X(x) + X(x + 1)) / 2 + 6, y: (y1 + y2) / 2 + 16, text: m > 0.5 ? `+${p.b}` : `×${ratio.toFixed(2)}`, "font-size": 11.5, cls: "mono", fill: C.c4, "text-anchor": "middle", opacity: q, "font-weight": 600 }, g);
        });
        if (p2 > 0) {
          const line = (x) => p.b * x + p.a0; const x0 = -0.3, x1 = lerp(-0.3, p3 > 0 ? p.xp + 0.4 : 4.6, p2);
          el("line", { x1: X(x0), y1: yLog(line(x0)), x2: X(x1), y2: yLog(line(x1)), stroke: C.c2, "stroke-width": 2.4, opacity: m }, g);
          const meanY = p.a0 + 2 * p.b;
          el("circle", { cx: X(2), cy: yLog(meanY), r: 5, fill: "none", stroke: C.c2, "stroke-width": 2, opacity: p2 }, g);
          el("text", { x: X(2) + 10, y: yLog(meanY) + 16, text: `(x̄, Ȳ) = (2, ${meanY.toFixed(2)})`, "font-size": 11.5, cls: "mono", fill: C.c2, opacity: p2 }, g);
          if (p2 >= 1) { el("path", { d: `M${X(3)} ${yLog(line(3))} L${X(4)} ${yLog(line(3))} L${X(4)} ${yLog(line(4))}`, fill: "none", stroke: C.c2, "stroke-width": 1.4, "stroke-dasharray": "3 3" }, g); el("text", { x: X(4) + 6, y: (yLog(line(3)) + yLog(line(4))) / 2 + 4, text: String(p.b), "font-size": 11, cls: "mono", fill: C.c2 }, g); el("text", { x: X(3.5), y: yLog(line(3)) + 13, text: "1", "font-size": 11, cls: "mono", fill: C.c2, "text-anchor": "middle" }, g); }
          tag(c.svg, L + 12, 44, `b = ${(10 * p.b).toFixed(2)} / 10 = ${p.b}，a = ${meanY.toFixed(2)} − ${p.b}×2 = ${p.a0.toFixed(2)}`, { fill: C.c2, cls: "mono", "font-size": 12, opacity: p2 });
          tag(c.svg, L + 12, 68, `Y = ${p.b}x + ${p.a0.toFixed(2)}`, { fill: C.c2, "font-size": 13.5, "font-weight": 700, opacity: p2 });
        }
        if (p3 > 0) {
          el("line", { x1: X(p.xp), y1: H - Bm, x2: X(p.xp), y2: lerp(H - Bm, yLog(p.Yp), p3), stroke: C.ok, "stroke-width": 2, "stroke-dasharray": "5 3" }, g);
          if (p3 >= 1) { el("circle", { cx: X(p.xp), cy: yLog(p.Yp), r: 6.5, fill: C.ok }, g); el("text", { x: X(p.xp) + 10, y: yLog(p.Yp) + 4, text: `Y = ${p.Yp.toFixed(1)}`, "font-size": 12, cls: "mono", fill: C.ok, "font-weight": 700 }, g); }
          tag(c.svg, L + 12, 92, `x = ${p.xp}：Y = ${p.b}×${p.xp} + ${p.a0.toFixed(2)} = ${p.Yp.toFixed(1)}`, { fill: C.ok, cls: "mono", "font-size": 12, opacity: p3 });
          tag(c.svg, L + 12, 116, `y = 10^${p.Yp.toFixed(1)} = 100 × ${(TEN[Math.round((p.Yp - 2) * 10)] || 1).toFixed(2)} ≈ ${p.yp}`, { fill: C.ok, "font-size": 13.5, "font-weight": 700, opacity: p3 });
        }
        if (p4 > 0) {
          tag(c.svg, L + 12, 92, `每年 Y 加 ${p.b}  ⇔  每年 y 乘 10^${p.b} ≈ ${ratio.toFixed(2)}`, { fill: C.c4, "font-size": 12.5, opacity: p4 });
          tag(c.svg, L + 12, 116, `年成長率 ≈ ${p.rate}%`, { fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p4 });
        }
      }
    });
  }
  logfit("q18", [0, 1, 2]);
  logfit("q19", [0, 1, 2, 3]);
  logfit("q20", [0, 1, 2, 4]);
})(window.ANIM);
