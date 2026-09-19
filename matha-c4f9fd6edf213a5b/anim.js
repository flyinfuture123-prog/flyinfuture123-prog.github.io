/* 學測數A預測題庫 —— 核心意義動畫
 *
 * 每個動畫是一個 spec：{ w, h, steps:[{title, text, dur}], draw(c) }。
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
  /* 3D 斜投影：(x,y,z) → 平面座標 */
  function proj3(x, y, z, k) { k = k || { ax: -0.55, ay: -0.35 }; return [k.ax * x + y, k.ay * x + z]; }

  /* ---------- 註冊 ---------- */
  function define(id, spec) { spec.id = id; registry[id] = spec; return spec; }
  function get(id) { return registry[id]; }

  /* ---------- 播放器 ---------- */
  class Player {
    constructor(host, spec, opts) {
      this.host = host; this.spec = spec; this.opts = opts || {};
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
      const scrub = document.createElement("input"); scrub.type = "range"; scrub.className = "scrub"; scrub.min = 0; scrub.max = this.spec.steps.length - 0.001; scrub.step = 0.005; scrub.value = 0; scrub.setAttribute("aria-label", "動畫進度"); h.appendChild(scrub); this.scrub = scrub;
      const dots = document.createElement("div"); dots.className = "dots";
      this.spec.steps.forEach((s, i) => { const b = document.createElement("button"); b.type = "button"; b.title = s.title; b.setAttribute("aria-label", `第 ${i + 1} 步：${s.title}`); b.addEventListener("click", () => this.goto(i, this.reduced ? 1 : 0, true)); dots.appendChild(b); });
      h.appendChild(dots); this.dots = dots;
      ctl.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a;
        if (a === "play") this.toggle(); else if (a === "next") this.next(); else if (a === "prev") this.prev(); else if (a === "replay") { this.goto(0, 0); this.play(); }
      });
      ctl.querySelector("[data-a=speed]").addEventListener("change", (e) => { this.speed = parseFloat(e.target.value) || 1; });
      scrub.addEventListener("input", () => { this.pause(); const v = parseFloat(scrub.value); this.k = clamp(Math.floor(v), 0, this.spec.steps.length - 1); this.t = clamp01(v - this.k); this.dirty = true; this.render(); });
    }
    ctx() {
      const k = this.k, t = this.t, self = this;
      return {
        svg: this.svg, W: this.spec.w, H: this.spec.h, k, t,
        P: (i) => (k > i ? 1 : k === i ? ease(t) : 0),
        R: (i) => (k > i ? 1 : k === i ? t : 0),
        step: k
      };
    }
    render() {
      if (!this.dirty) return; this.dirty = false;
      clear(this.svg);
      try { this.spec.draw(this.ctx()); } catch (err) { console.error("anim draw error", this.spec.id, err); }
      const s = this.spec.steps[this.k];
      this.cap.querySelector(".ct").textContent = `${this.k + 1} / ${this.spec.steps.length} · ${s.title}`;
      this.cap.querySelector(".cx").textContent = s.text;
      this.scrub.value = this.k + this.t;
      Array.from(this.dots.children).forEach((b, i) => { b.className = i < this.k ? "done" : i === this.k ? "cur" : ""; });
      this.ctl.querySelector("[data-a=prev]").disabled = this.k === 0 && this.t === 0;
      this.ctl.querySelector("[data-a=play]").textContent = this.playing ? "❚❚ 暫停" : (this.atEnd() ? "▶ 重播" : "▶ 播放");
    }
    atEnd() { return this.k === this.spec.steps.length - 1 && this.t >= 1; }
    goto(k, t, pause) { this.k = clamp(k, 0, this.spec.steps.length - 1); this.t = clamp01(t == null ? 1 : t); this.hold = 0; this.dirty = true; if (pause) this.pause(); this.render(); }
    next() { if (this.t < 1) this.goto(this.k, 1, true); else this.goto(this.k + 1, this.reduced ? 1 : 1, true); }
    prev() { if (this.t > 0 && this.t < 1) this.goto(this.k, 0, true); else this.goto(Math.max(0, this.k - 1), this.reduced ? 1 : 0, true); if (!this.reduced && this.k >= 0) { this.goto(this.k, 1, true); } }
    toggle() { if (this.playing) this.pause(); else { if (this.atEnd()) this.goto(0, 0); this.play(); } }
    play() {
      if (this.playing) return; this.playing = true; this.last = 0; this.dirty = true; this.render();
      const loop = (ts) => {
        if (!this.playing) return;
        if (!this.last) this.last = ts; const dt = (ts - this.last) * this.speed; this.last = ts;
        const step = this.spec.steps[this.k]; const dur = step.dur || 2400;
        if (this.t < 1) { this.t = clamp01(this.t + dt / dur); this.dirty = true; }
        else {
          this.hold += dt;
          if (this.hold >= (step.hold || 900)) {
            this.hold = 0;
            if (this.k < this.spec.steps.length - 1) { this.k++; this.t = 0; this.dirty = true; }
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

  return { define, get, registry, Player, C, el, clear, clamp, clamp01, lerp, ease, easeOut, sub, fmt, PI, plane, grid, axes, head, seg, arrow, dot, label, tag, textWidth, curve, poly, polyline, circle, arc, rightAngle, proj3 };
})();

/* ======================================================================
 * 各題動畫
 * ==================================================================== */
(function (A) {
  "use strict";
  const { define, C, el, lerp, ease, sub, fmt, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, proj3, clamp } = A;

  /* ---------- 第 1 題：絕對值＝距離 ---------- */
  define("q1", {
    w: 640, h: 300,
    steps: [
      { title: "絕對值就是距離", text: "|x−1| 是點 x 到 1 的距離，|x−3| 是到 3 的距離。題目問的是：兩段距離加起來不超過 4 的 x 在哪裡。" },
      { title: "夾在兩點之間：距離和恆為 2", text: "當 x 在 1 與 3 之間，兩段距離剛好拼成 1 到 3 的線段，總和永遠是 2，一定符合。" },
      { title: "往右走：每走 1，距離和多 2", text: "x 超過 3 之後，兩段距離同時變長。從 2 增加到 4 只能再走 1 格，所以右邊界是 x = 4。" },
      { title: "往左也一樣", text: "對稱地，左邊界是 x = 0。整體解是 0 ≤ x ≤ 4。" },
      { title: "數整數點", text: "0、1、2、3、4 共 5 個整數，答案是 (3)。不必分段列式，看圖就知道。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -1.5, x1: 5.5, y0: -1.2, y1: 1.6, pad: { l: 20, r: 20, t: 20, b: 20 } });
      const { X, Y, g } = pl;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      // 解集合底色
      if (p3 > 0) {
        el("rect", { x: X(0), y: Y(0.35), width: (X(4) - X(0)), height: Y(-0.35) - Y(0.35), fill: C.ok, opacity: 0.18 * p3, rx: 6 }, g);
      }
      // 數線
      el("line", { x1: X(-1.5), y1: Y(0), x2: X(5.5), y2: Y(0), stroke: C.axis, "stroke-width": 1.6 }, g);
      A.head(g, X(5.5), Y(0), 0, C.axis);
      for (let i = -1; i <= 5; i++) {
        el("line", { x1: X(i), y1: Y(0) - 5, x2: X(i), y2: Y(0) + 5, stroke: C.axis }, g);
        label(pl, i, -0.28, String(i), { cls: "mono", fill: C.ink3, "font-size": 12 });
      }
      // 定點 1、3
      dot(pl, 1, 0, { r: 6, fill: C.c2 }); dot(pl, 3, 0, { r: 6, fill: C.c2 });
      // 動點 x 的位置
      let x = 2;
      if (c.k === 1) x = lerp(1, 3, p1);
      else if (c.k === 2) x = lerp(3, 4, p2);
      else if (c.k === 3) x = lerp(4, 0, p3);
      else if (c.k >= 4) x = 2 + Math.sin(p4 * PI) * 0; // 停在 2
      if (c.k === 0) x = lerp(2.2, 1.6, p0);
      const d1 = Math.abs(x - 1), d2 = Math.abs(x - 3), s = d1 + d2;
      // 兩段距離（畫在數線上下方，避免重疊）
      const y1 = 0.42, y2 = 0.78;
      el("line", { x1: X(x), y1: Y(y1), x2: X(1), y2: Y(y1), stroke: C.c1, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85 * p0 }, g);
      el("line", { x1: X(x), y1: Y(y2), x2: X(3), y2: Y(y2), stroke: C.c4, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85 * p0 }, g);
      el("line", { x1: X(1), y1: Y(0), x2: X(1), y2: Y(y1), stroke: C.c1, "stroke-dasharray": "3 3", opacity: 0.5 }, g);
      el("line", { x1: X(3), y1: Y(0), x2: X(3), y2: Y(y2), stroke: C.c4, "stroke-dasharray": "3 3", opacity: 0.5 }, g);
      label(pl, (x + 1) / 2, y1, "|x−1| = " + fmt(d1, 1), { dy: -8, fill: C.c1, "font-size": 12, cls: "mono", opacity: p0 });
      label(pl, (x + 3) / 2, y2, "|x−3| = " + fmt(d2, 1), { dy: -8, fill: C.c4, "font-size": 12, cls: "mono", opacity: p0 });
      // 動點
      dot(pl, x, 0, { r: 7, fill: C.ink });
      label(pl, x, 0, "x", { dy: -13, cls: "math", "font-size": 14, "font-weight": 700 });
      // 距離和量表
      const bx = X(-1.2), by = Y(-0.75), bw = X(5.2) - X(-1.2), bh = 14;
      el("rect", { x: bx, y: by, width: bw, height: bh, rx: 7, fill: C.surface, stroke: C.grid }, g);
      const over = s > 4;
      el("rect", { x: bx, y: by, width: bw * Math.min(s, 6) / 6, height: bh, rx: 7, fill: over ? C.bad : C.ok, opacity: 0.8 }, g);
      el("line", { x1: bx + bw * 4 / 6, y1: by - 5, x2: bx + bw * 4 / 6, y2: by + bh + 5, stroke: C.ink, "stroke-width": 1.5 }, g);
      el("text", { x: bx + bw * 4 / 6, y: by + bh + 18, text: "4", cls: "mono", "font-size": 11, fill: C.ink2, "text-anchor": "middle" }, g);
      el("text", { x: bx, y: by - 8, text: "距離和 |x−1|+|x−3| = " + fmt(s, 1) + (over ? "（超過 4）" : "（≤ 4 ✓）"), "font-size": 12.5, fill: over ? C.bad : C.ok, "font-weight": 600 }, g);
      // 整數點
      if (p4 > 0) for (let i = 0; i <= 4; i++) {
        const q = sub(p4, i / 6, (i + 2) / 6);
        if (q > 0) { dot(pl, i, 0, { r: 5 + 3 * q, fill: C.ok, opacity: q }); label(pl, i, 0, "✓", { dy: -14, fill: C.ok, "font-size": 12, opacity: q, "font-weight": 700 }); }
      }
      if (p3 >= 1) label(pl, 2, 1.28, "解：0 ≤ x ≤ 4", { fill: C.ok, "font-size": 15, "font-weight": 700 });
    }
  });

  /* ---------- 第 2 題：餘式＝交會的直線 ---------- */
  define("q2", {
    w: 640, h: 380,
    steps: [
      { title: "餘式 2x+1 是一條直線", text: "先畫 y = 2x + 1。「除以 (x−1)(x−2) 餘 2x+1」表示 f 在 x = 1 和 x = 2 的值，跟這條直線一樣。" },
      { title: "差 f(x) − (2x+1) 有因式 (x−1)(x−2)", text: "首項係數是 1 的三次式，所以 f(x) = (x−1)(x−2)(x−a) + 2x + 1。a 還沒定：改變 a，曲線會變，但永遠穿過那兩個交點。" },
      { title: "用 f(3) = 11 釘住 a", text: "曲線在 x = 3 必須通過 (3, 11)。試著調整 a，只有 a = 1 時剛好穿過，此時 x = 1 變成相切的重根。" },
      { title: "讀出 f(0)", text: "f(x) = (x−1)²(x−2) + 2x + 1，在 x = 0 的值是 (1)(−2) + 1 = −1。答案 (2)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -1.2, x1: 4.2, y0: -4, y1: 14 });
      grid(pl, 1); axes(pl, { xStep: 1, yStep: 2, xLabel: "x", yLabel: "y" });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const line = (x) => 2 * x + 1;
      // a 的變化：步驟 1 內從 3 擺到 -0.5，步驟 2 收斂到 1
      let a = 3;
      if (c.k === 1) a = lerp(3, -0.5, Math.sin(p1 * PI / 2));
      else if (c.k === 2) a = lerp(-0.5, 1, p2);
      else if (c.k >= 3) a = 1;
      const f = (x) => (x - 1) * (x - 2) * (x - a) + 2 * x + 1;
      curve(pl, line, -1.2, 4.2, p0, { stroke: C.c2, "stroke-width": 2 });
      label(pl, 3.6, line(3.6), "y = 2x+1", { dy: 16, fill: C.c2, cls: "math", "font-size": 13, opacity: p0 });
      if (p1 > 0) {
        curve(pl, f, -1.2, 4.2, p1, { stroke: C.c1 });
        tag(c.svg, 40, 30, "f(x) = (x−1)(x−2)(x−" + (a < 0 ? "(" + fmt(a, 1) + ")" : fmt(a, 1)) + ") + 2x + 1", { fill: C.c1, "font-size": 12.5, opacity: p1 });
      }
      // 兩個交點
      dot(pl, 1, 3, { fill: C.c2, r: 5, opacity: p0 }); dot(pl, 2, 5, { fill: C.c2, r: 5, opacity: p0 });
      label(pl, 1, 3, "(1, 3)", { dx: -26, dy: 4, "font-size": 12, cls: "mono", fill: C.c2, opacity: p0 });
      label(pl, 2, 5, "(2, 5)", { dx: 28, dy: 4, "font-size": 12, cls: "mono", fill: C.c2, opacity: p0 });
      // 目標點 (3, 11)
      if (c.k >= 2) {
        const hit = Math.abs(f(3) - 11) < 0.05;
        dot(pl, 3, 11, { fill: "none", stroke: C.bad, r: 8, "stroke-width": 2, opacity: p2 });
        dot(pl, 3, f(3), { fill: hit ? C.ok : C.c1, r: 5, opacity: p2 });
        label(pl, 3, 11, "必須通過 (3, 11)", { dx: 4, dy: -14, "font-size": 12.5, fill: C.bad, opacity: p2, "text-anchor": "start" });
        label(pl, 3.05, f(3), "f(3) = " + fmt(f(3), 1), { dx: 10, dy: 4, "font-size": 12, cls: "mono", fill: hit ? C.ok : C.c1, opacity: p2, "text-anchor": "start" });
        if (hit) tag(c.svg, 40, 54, "a = 1", { fill: C.ok, "font-weight": 700, opacity: p2 });
      }
      if (p3 > 0) {
        seg(pl, 0, 0, 0, -1, p3, { stroke: C.c4, "stroke-dasharray": "4 3" });
        dot(pl, 0, -1, { fill: C.c4, r: 6, opacity: p3 });
        label(pl, 0, -1, "f(0) = −1", { dx: 46, dy: 4, "font-size": 14, fill: C.c4, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 3 題：弦長、距離、半徑的直角三角形 ---------- */
  define("q3", {
    w: 640, h: 400,
    steps: [
      { title: "配方找出圓心與半徑", text: "x²+y²−4x+2y−4=0 配方成 (x−2)²+(y+1)²=9：圓心 (2,−1)、半徑 3。" },
      { title: "直線 3x+4y+k=0 是一族平行線", text: "k 改變，直線就平行移動。它切出的弦長，只由「圓心到直線的距離 d」決定。" },
      { title: "半徑、d、半弦長構成直角三角形", text: "圓心到弦的垂線平分弦，所以 r² = d² + (弦/2)²。弦長 2√5 就等於 d = 2。" },
      { title: "距離公式反推 k", text: "|3·2 + 4·(−1) + k| / 5 = 2，所以 |k+2| = 10，k = 8 或 −12。兩個位置都畫給你看，選項裡只有 8。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -3, x1: 7, y0: -5.5, y1: 3.5, square: true, pad: { l: 30, r: 10, t: 10, b: 24 } });
      grid(pl, 1); axes(pl, { xStep: 2, yStep: 2 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const cx = 2, cy = -1, r = 3;
      circle(pl, cx, cy, r * p0, { stroke: C.c1, "stroke-width": 2.5 });
      dot(pl, cx, cy, { fill: C.c1, r: 4.5 });
      label(pl, cx, cy, "(2, −1)", { dx: 0, dy: 18, "font-size": 12, cls: "mono", fill: C.c1 });
      if (p0 > 0.5) { seg(pl, cx, cy, cx + r * Math.cos(-0.5), cy + r * Math.sin(-0.5), sub(p0, 0.5, 1), { stroke: C.c1, "stroke-width": 1.5, "stroke-dasharray": "4 3" }); label(pl, cx + 1.7, cy - 0.35, "r = 3", { fill: C.c1, "font-size": 12.5, cls: "math" }); }
      if (p1 <= 0) return;
      // k 的動態：步驟 1 掃描 k 從 -20 到 12，之後停在 8；步驟 3 再顯示 -12
      let k = 8;
      if (c.k === 1) k = lerp(-22, 12, p1);
      else if (c.k === 2) k = lerp(12, 8, p2);
      const drawLine = (kk, attrs) => {
        // 3x+4y+kk=0 → y = (-3x-kk)/4
        const f = (x) => (-3 * x - kk) / 4;
        curve(pl, f, -3, 7, 1, Object.assign({ stroke: C.c2, "stroke-width": 2 }, attrs || {}));
        // 距離
        const d = Math.abs(3 * cx + 4 * cy + kk) / 5;
        // 垂足
        const s = (3 * cx + 4 * cy + kk) / 25; const fx = cx - 3 * s, fy = cy - 4 * s;
        return { d, fx, fy, f };
      };
      const L = drawLine(k);
      const lx = Math.min(6.4, Math.max(-2.6, (-4 * (-5.5 + 0.7) - k) / 3)); label(pl, lx, L.f(lx), "k = " + fmt(k, 0), { dy: -9, dx: 14, fill: C.c2, cls: "mono", "font-size": 12.5 });
      const d = L.d;
      const half = d < r ? Math.sqrt(r * r - d * d) : 0;
      // 弦端點
      if (half > 0) {
        const ux = 4 / 5, uy = -3 / 5; // 直線方向
        const ax = L.fx + ux * half, ay = L.fy + uy * half, bx = L.fx - ux * half, by = L.fy - uy * half;
        seg(pl, ax, ay, bx, by, 1, { stroke: C.c4, "stroke-width": 4 });
        dot(pl, ax, ay, { fill: C.c4 }); dot(pl, bx, by, { fill: C.c4 });
        if (p2 > 0) {
          seg(pl, cx, cy, L.fx, L.fy, p2, { stroke: C.c3, "stroke-width": 2 });
          seg(pl, cx, cy, ax, ay, p2, { stroke: C.c1, "stroke-width": 1.5, "stroke-dasharray": "4 3" });
          poly(pl, [[cx, cy], [L.fx, L.fy], [ax, ay]], { fill: C.c3, opacity: 0.18 * p2 });
          rightAngle(pl, L.fx, L.fy, ux, uy, -3 / 5, -4 / 5 * 1, 0.3, { opacity: p2 });
          label(pl, (cx + L.fx) / 2, (cy + L.fy) / 2, "d = " + fmt(d, 2), { dx: -30, fill: C.c3, "font-size": 12.5, cls: "mono", opacity: p2 });
          label(pl, (L.fx + ax) / 2, (L.fy + ay) / 2, "√5", { dy: 16, fill: C.c4, "font-size": 12.5, opacity: p2 });
        }
      }
      tag(c.svg, c.W - 12, 24, "弦長 = " + (half > 0 ? fmt(2 * half, 2) : "無交點"), { anchor: "end", fill: C.c4, "font-size": 13, "font-weight": 600 });
      tag(c.svg, c.W - 12, 48, "d = |6 − 4 + k| / 5 = " + fmt(d, 2), { anchor: "end", fill: C.c3, "font-size": 12.5, cls: "mono" });
      if (p2 > 0) tag(c.svg, c.W - 12, 72, "r² = d² + (√5)²  ⇒  d = 2", { anchor: "end", fill: C.ink, "font-size": 12.5, opacity: p2 });
      if (p3 > 0) {
        const L2 = drawLine(-12, { opacity: p3, "stroke-dasharray": "6 4" });
        label(pl, 6.2, L2.f(6.2), "k = −12", { dy: -9, dx: -16, fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p3 });
        tag(c.svg, c.W - 12, 96, "|k + 2| = 10  ⇒  k = 8 或 −12", { anchor: "end", fill: C.ok, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 4 題：三角函數圖形的四種變換 ---------- */
  define("q4", {
    w: 640, h: 380,
    steps: [
      { title: "從 y = sin x 出發", text: "最高點在 x = π/2。接下來一步一步變形，盯著最高點怎麼移動。" },
      { title: "橫向壓縮：sin 2x", text: "x 前面乘 2，圖形被壓成一半寬，週期從 2π 變成 π，最高點移到 π/4。" },
      { title: "右移 π/6：sin(2x − π/3)", text: "關鍵：2x − π/3 = 2(x − π/6)，所以是右移 π/6 而不是 π/3。最高點變成 π/4 + π/6 = 5π/12。" },
      { title: "拉高 3 倍、上移 1", text: "振幅 3、再往上 1，最大值是 4。最高點的 x 不受影響，仍在 5π/12，答案 (3)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -0.4, x1: PI + 0.3, y0: -3.6, y1: 4.8, pad: { l: 34, r: 12, t: 14, b: 30 } });
      grid(pl, PI / 12, { opacity: 0.6 });
      const { X, Y, g } = pl;
      // 座標軸
      el("line", { x1: X(-0.4), y1: Y(0), x2: X(PI + 0.3), y2: Y(0), stroke: C.axis, "stroke-width": 1.4 }, g);
      el("line", { x1: X(0), y1: Y(-3.6), x2: X(0), y2: Y(4.8), stroke: C.axis, "stroke-width": 1.4 }, g);
      const ticks = [[PI / 12, "π/12"], [PI / 4, "π/4"], [5 * PI / 12, "5π/12"], [7 * PI / 12, "7π/12"], [11 * PI / 12, "11π/12"], [PI, "π"], [PI / 2, "π/2"]];
      ticks.forEach(([x, s]) => { el("line", { x1: X(x), y1: Y(0) - 3, x2: X(x), y2: Y(0) + 3, stroke: C.axis }, g); label(pl, x, 0, s, { dy: 16, "font-size": 10.5, cls: "mono", fill: C.ink3 }); });
      [-3, -2, -1, 1, 2, 3, 4].forEach(y => label(pl, 0, y, String(y), { dx: -10, dy: 4, "font-size": 10.5, cls: "mono", fill: C.ink3 }));
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const b = lerp(1, 2, p1), h = lerp(0, PI / 6, p2), Aamp = lerp(1, 3, p3), d = lerp(0, 1, p3);
      const f = (x) => Aamp * Math.sin(b * (x - h)) + d;
      // 淡淡的原始 sin x
      if (p1 > 0) curve(pl, Math.sin, -0.4, PI + 0.3, 1, { stroke: C.ink3, "stroke-width": 1.2, "stroke-dasharray": "4 4", opacity: 0.5 });
      curve(pl, f, -0.4, PI + 0.3, p0, { stroke: C.c1, "stroke-width": 2.6 });
      // 最高點
      const xm = h + (PI / 2) / b, ym = Aamp + d;
      if (p0 >= 1) {
        seg(pl, xm, 0, xm, ym, 1, { stroke: C.c2, "stroke-dasharray": "4 3", "stroke-width": 1.5 });
        dot(pl, xm, ym, { fill: C.c2, r: 6 });
        label(pl, xm, ym, "最高點 x = " + (c.k === 0 ? "π/2" : c.k === 1 ? (p1 >= 1 ? "π/4" : "…") : c.k === 2 ? (p2 >= 1 ? "5π/12" : "…") : "5π/12"), { dy: -12, fill: C.c2, "font-size": 13, "font-weight": 700 });
        if (c.k >= 3) label(pl, xm, ym, "最大值 " + fmt(ym, 1), { dx: 62, dy: 4, fill: C.c2, "font-size": 12.5, cls: "mono", "text-anchor": "start" });
      }
      // 平移箭頭
      if (c.k === 2 && p2 > 0 && p2 < 1) arrow(pl, PI / 4, 1.3, PI / 4 + PI / 6, 1.3, 1, { stroke: C.c4, "stroke-width": 2 });
      if (c.k === 2) label(pl, PI / 4 + PI / 12, 1.3, "右移 π/6", { dy: -8, fill: C.c4, "font-size": 12.5 });
      const eq = c.k === 0 ? "y = sin x" : c.k === 1 ? "y = sin 2x" : c.k === 2 ? "y = sin(2x − π/3) = sin 2(x − π/6)" : "y = 3 sin(2x − π/3) + 1";
      tag(c.svg, 40, 26, eq, { fill: C.c1, "font-size": 13, "font-weight": 600 });
      tag(c.svg, 40, 50, "週期 = " + (c.k >= 1 ? "π" : "2π"), { fill: C.ink2, "font-size": 12 });
    }
  });

  /* ---------- 第 5 題：貝氏定理＝縮小樣本空間 ---------- */
  define("q5", {
    w: 640, h: 400,
    steps: [
      { title: "想像 2000 個人", text: "機率題最怕抽象。把整個地區想成 2000 個人，每個小方塊是一個人。" },
      { title: "盛行率 1%：20 個人真的有病", text: "1% 很少，只有 20 格（紅色）。剩下 1980 個人是健康的。" },
      { title: "誰會驗出陽性？", text: "患病者 90% 陽性：18 人（深紅）。健康者 5% 偽陽性：1980 × 5% = 99 人（橘色）。健康的人太多，5% 也比 18 人多。" },
      { title: "已知陽性，就只看陽性的人", text: "條件機率＝縮小樣本空間。把陰性的人全部淡掉，剩下 117 個陽性者，其中真正患病的只有 18 人。" },
      { title: "18 / 117 ≈ 15%", text: "這就是貝氏定理算出來的 P(病 | 陽) = 0.009 / (0.009 + 0.0495)。答案 (2)。" }
    ],
    draw(c) {
      const cols = 80, rows = 25, n = 2000; const s = 6.4, gap = 1; const ox = 24, oy = 20;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const g = el("g", null, c.svg);
      // 佈局：前 20 格為患病（左上角 2 列 10 格），其中前 18 陽性；健康者的 99 個陽性放在其後
      const sick = 20, sickPos = 18, healthyPos = 99;
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
      const fade = p3; // 陰性者淡出
      el("path", { d: paths.base, fill: C.ink3, opacity: lerp(0.35, 0.06, fade) }, g);
      el("path", { d: paths.sick, fill: C.bad, opacity: lerp(0.55, 0.12, fade) }, g);
      el("path", { d: paths.sickPos, fill: C.bad, opacity: 1 }, g);
      el("path", { d: paths.healthyPos, fill: C.c2, opacity: 1 }, g);
      // 圖例與數字
      const gridBottom = oy + rows * (s + gap); const lx = ox, ly = gridBottom + 40;
      const leg = [
        [C.ink3, "健康、陰性", "1881", p2],
        [C.bad, "患病（20 人）", "1%", p1],
        [C.bad, "患病且陽性", "18", p2, true],
        [C.c2, "健康但偽陽性", "99", p2]
      ];
      leg.forEach(([col, name, num, op, strong], i) => {
        if (op <= 0) return;
        const x = lx + i * 150;
        el("rect", { x, y: ly - 9, width: 12, height: 12, rx: 2, fill: col, opacity: strong ? 1 : 0.55 * op + 0.1 }, g);
        el("text", { x: x + 18, y: ly + 1, text: name, "font-size": 12, fill: C.ink2, opacity: op }, g);
        el("text", { x: x + 18, y: ly + 17, text: num + " 人", "font-size": 13, cls: "mono", fill: C.ink, "font-weight": 600, opacity: op }, g);
      });
      el("text", { x: ox, y: gridBottom + 16, text: "每一格 = 1 人，共 2000 人", "font-size": 11.5, fill: C.ink3 }, g);
      if (p3 > 0) tag(c.svg, lx, ly + 52, "已知陽性 ⇒ 只看陽性者：18 + 99 = 117 人", { fill: C.ink, "font-size": 12.5, opacity: p3 });
      if (p4 > 0) tag(c.svg, lx, ly + 80, "P(病 | 陽) = 18 / 117 ≈ 15.4%", { fill: C.ok, "font-size": 13.5, "font-weight": 700, opacity: p4 });
      // 中央大字強調
      if (p4 > 0.3) {
        const q = sub(p4, 0.3, 1);
        el("text", { x: ox + cols * (s + gap) / 2, y: oy + rows * (s + gap) / 2 + 14, text: "≈ 15%", "font-size": 40, "font-weight": 700, fill: C.ok, "text-anchor": "middle", opacity: q, cls: "mono" }, g);
      }
    }
  });

  /* ---------- 第 6 題：行列式＝面積倍率 ---------- */
  define("q6", {
    w: 640, h: 400,
    steps: [
      { title: "先看單位正方形怎麼變", text: "線性變換完全由 e₁=(1,0)、e₂=(0,1) 的去向決定。它們分別被送到 (2,1) 與 (1,3)，也就是矩陣的兩行。" },
      { title: "正方形變成平行四邊形", text: "看著網格一起變形：每個單位正方形都變成同樣的平行四邊形，面積是 |2·3 − 1·1| = 5，這就是行列式。" },
      { title: "任何圖形都被放大同樣的倍率", text: "△ABC（面積 4）被同一組網格帶著走，變成面積 4 × 5 = 20 的三角形。答案 (4)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -3.5, x1: 8, y0: -1.8, y1: 9.5, square: true, pad: { l: 26, r: 8, t: 8, b: 22 } });
      const { X, Y, g } = pl;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2);
      const m = p1; // 變換插值 I → A
      const M = [[lerp(1, 2, m), lerp(0, 1, m)], [lerp(0, 1, m), lerp(1, 3, m)]];
      const T = (x, y) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
      // 變形網格
      for (let i = -4; i <= 8; i++) {
        const a = T(i, -4), b = T(i, 9); const a2 = T(-4, i), b2 = T(9, i);
        el("line", { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), stroke: C.grid, "stroke-width": 1 }, g);
        el("line", { x1: X(a2[0]), y1: Y(a2[1]), x2: X(b2[0]), y2: Y(b2[1]), stroke: C.grid, "stroke-width": 1 }, g);
      }
      axes(pl, { xStep: 2, yStep: 2 });
      // 單位正方形 → 平行四邊形
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(q => T(q[0], q[1]));
      poly(pl, sq, { fill: C.c1, opacity: 0.28 });
      polyline(pl, sq.concat([sq[0]]), { stroke: C.c1, "stroke-width": 2 });
      const e1 = T(1, 0), e2 = T(0, 1);
      arrow(pl, 0, 0, e1[0], e1[1], p0, { stroke: C.c2, "stroke-width": 2.5 });
      arrow(pl, 0, 0, e2[0], e2[1], p0, { stroke: C.c4, "stroke-width": 2.5 });
      label(pl, e1[0], e1[1], `(${fmt(e1[0], 1)}, ${fmt(e1[1], 1)})`, { dx: 22, dy: 14, fill: C.c2, "font-size": 12, cls: "mono", opacity: p0 });
      label(pl, e2[0], e2[1], `(${fmt(e2[0], 1)}, ${fmt(e2[1], 1)})`, { dx: -30, dy: -6, fill: C.c4, "font-size": 12, cls: "mono", opacity: p0 });
      // 三角形 ABC
      if (p2 > 0) {
        const tri = [[0, 0], [2, 2], [-2, 2]];
        const tri2 = tri.map(q => { const t = T(q[0], q[1]); const mm = p2; return [lerp(q[0], t[0], 0) , 0]; });
        // 用 p2 由原三角形變到像
        const M2 = [[lerp(1, 2, p2), lerp(0, 1, p2)], [lerp(0, 1, p2), lerp(1, 3, p2)]];
        const T2 = (x, y) => [M2[0][0] * x + M2[0][1] * y, M2[1][0] * x + M2[1][1] * y];
        const img = tri.map(q => T2(q[0], q[1]));
        poly(pl, tri, { fill: C.c3, opacity: 0.12 }); polyline(pl, tri.concat([tri[0]]), { stroke: C.c3, "stroke-width": 1.2, "stroke-dasharray": "4 3" });
        poly(pl, img, { fill: C.c3, opacity: 0.35 }); polyline(pl, img.concat([img[0]]), { stroke: C.c3, "stroke-width": 2.2 });
        const det2 = M2[0][0] * M2[1][1] - M2[0][1] * M2[1][0];
        const cxm = (img[0][0] + img[1][0] + img[2][0]) / 3, cym = (img[0][1] + img[1][1] + img[2][1]) / 3;
        label(pl, cxm, cym, "面積 " + fmt(4 * det2, 1), { fill: C.c3, "font-size": 14, "font-weight": 700, dy: 5 });
        ["A", "B", "C"].forEach((nm, i) => label(pl, img[i][0], img[i][1], nm + "′", { dx: i === 2 ? -12 : 12, dy: i === 0 ? 14 : -6, fill: C.c3, cls: "math", "font-size": 13 }));
      }
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      tag(c.svg, c.W - 12, 24, "A = [ 2 1 ; 1 3 ]", { anchor: "end", fill: C.ink, cls: "mono", "font-size": 12.5 });
      tag(c.svg, c.W - 12, 48, "單位正方形面積 → " + fmt(det, 2), { anchor: "end", fill: C.c1, "font-size": 13, "font-weight": 600 });
      if (p1 >= 1) tag(c.svg, c.W - 12, 72, "det A = 2·3 − 1·1 = 5", { anchor: "end", fill: C.c1, "font-size": 12.5, cls: "mono" });
      if (p2 >= 1) tag(c.svg, c.W - 12, 96, "4 × 5 = 20", { anchor: "end", fill: C.ok, "font-size": 14, "font-weight": 700 });
    }
  });
})(window.ANIM);

(function (A) {
  "use strict";
  const { define, C, el, lerp, ease, sub, fmt, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, proj3, clamp } = A;

  /* ---------- 第 7 題：三次函數與水平線的交點數 ---------- */
  define("q7", {
    w: 640, h: 400,
    steps: [
      { title: "三次函數一定有對稱中心", text: "f(x) = x³ − 3x + 1 的圖形對稱於 (0, 1)：因為 f(x) − 1 = x³ − 3x 是奇函數。任一點繞著 (0,1) 轉 180° 仍在圖上。(1) 對；(2) 錯，f(0) = 1 ≠ 0。" },
      { title: "用水平線 y = k 掃描", text: "方程式 f(x) = k 的實根個數，就是水平線 y = k 與圖形的交點數。看 k 從低到高：1 個 → 2 個 → 3 個 → 2 個 → 1 個。" },
      { title: "k = 3：相切 + 相交＝兩個相異實根", text: "f(x) − 3 = (x+1)²(x−2)：在 x = −1 相切（重根），在 x = 2 穿過。所以 (3) 正確。" },
      { title: "k = 0：三個交點", text: "f(−2) < 0、f(−1) > 0、f(1) < 0、f(2) > 0，三次變號，三個相異實根，(4) 正確。" },
      { title: "x > 2 之後一路在 y = 3 上方", text: "(x+1)²(x−2) 在 x > 2 時為正，即 f(x) > 3，(5) 正確。答案 (1)(3)(4)(5)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -3.2, x1: 3.4, y0: -4.5, y1: 6.5, pad: { l: 30, r: 12, t: 12, b: 26 } });
      grid(pl, 1); axes(pl, { xStep: 1, yStep: 2, xLabel: "x", yLabel: "y" });
      const f = (x) => x * x * x - 3 * x + 1;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      // x>2 區域
      if (p4 > 0) { el("rect", { x: pl.X(2), y: pl.Y(6.5), width: pl.X(3.4) - pl.X(2), height: pl.Y(3) - pl.Y(6.5), fill: C.ok, opacity: 0.15 * p4 }, pl.g); }
      curve(pl, f, -3.2, 3.4, p0, { stroke: C.c1, "stroke-width": 2.6 });
      // 對稱中心與對稱點
      if (p0 >= 1) {
        dot(pl, 0, 1, { fill: C.c2, r: 6 }); label(pl, 0, 1, "(0, 1)", { dx: 30, dy: -6, fill: C.c2, cls: "mono", "font-size": 12 });
        const xs = c.k === 0 ? 1.7 : 1.7; const q = c.k === 0 ? 1 : 1;
        [xs].forEach(x0 => { const px = x0, py = f(x0); dot(pl, px, py, { fill: C.c4 }); dot(pl, -px, 2 - py, { fill: C.c4 }); seg(pl, px, py, -px, 2 - py, 1, { stroke: C.c4, "stroke-dasharray": "4 3", "stroke-width": 1.4 }); });
      }
      // 掃描線
      let k = null;
      if (c.k === 1) k = lerp(-3.5, 5.5, p1);
      else if (c.k === 2) k = 3; else if (c.k === 3) k = 0; else if (c.k === 4) k = 3;
      if (k !== null) {
        seg(pl, -3.2, k, 3.4, k, 1, { stroke: C.c2, "stroke-width": 2, "stroke-dasharray": "6 4" });
        label(pl, -2.9, k, "y = " + fmt(k, 1), { dy: -8, dx: 10, fill: C.c2, cls: "mono", "font-size": 12.5, "text-anchor": "start" });
        // 交點
        const roots = [];
        let prev = f(-3.2) - k;
        for (let i = 1; i <= 600; i++) { const x = -3.2 + (6.6 * i) / 600; const v = f(x) - k; if (prev === 0 || prev * v < 0) roots.push(x - 6.6 / 1200); prev = v; }
        if (Math.abs(k - 3) < 0.03 && !roots.some(r => Math.abs(r + 1) < 0.15)) roots.push(-1);
        if (Math.abs(k + 1) < 0.03 && !roots.some(r => Math.abs(r - 1) < 0.15)) roots.push(1);
        roots.forEach(r => { dot(pl, r, k, { fill: C.c2, r: 5.5 }); });
        tag(c.svg, c.W - 12, 24, "f(x) = " + fmt(k, 1) + " 的實根：" + roots.length + " 個", { anchor: "end", fill: C.c2, "font-size": 13, "font-weight": 600 });
      }
      if (c.k === 2) {
        label(pl, -1, 3, "相切：重根 x = −1", { dy: -14, fill: C.c2, "font-size": 12.5 });
        label(pl, 2, 3, "x = 2", { dy: 18, fill: C.c2, "font-size": 12.5, cls: "mono" });
        tag(c.svg, c.W - 12, 48, "f(x) − 3 = (x+1)²(x−2)", { anchor: "end", fill: C.ink, cls: "mono", "font-size": 12.5 });
      }
      if (c.k === 3) {
        [[-2, -1], [-1, 3], [1, -1], [2, 3]].forEach(([x, y], i) => { const q = sub(p3, i / 5, (i + 2) / 5); if (q <= 0) return; dot(pl, x, y, { fill: y > 0 ? C.ok : C.bad, r: 5, opacity: q }); label(pl, x, y, `f(${x}) = ${y}`, { dy: y > 0 ? -12 : 20, fill: y > 0 ? C.ok : C.bad, cls: "mono", "font-size": 11.5, opacity: q }); });
      }
      if (c.k === 4) { label(pl, 2.75, 5.5, "x > 2 時 f(x) > 3", { fill: C.ok, "font-size": 12.5, "font-weight": 600, opacity: p4 }); }
    }
  });

  /* ---------- 第 8 題：遞迴數列平移成等比 ---------- */
  define("q8", {
    w: 640, h: 380,
    steps: [
      { title: "照遞迴式一項一項長出來", text: "a₁ = 1。每一項都是「前一項的 2 倍，再加 1」：1 → 3 → 7 → 15 → 31。加 1 的那一塊用橘色標出來，它讓數列不是純粹的倍增。" },
      { title: "每一項都補上 1", text: "把每根柱子多加一塊（綠色）。神奇的事發生了：2、4、8、16、32，每一項恰好是前一項的 2 倍。⟨aₙ + 1⟩ 是首項 2、公比 2 的等比數列。" },
      { title: "所以 aₙ = 2ⁿ − 1", text: "aₙ + 1 = 2·2ⁿ⁻¹ = 2ⁿ。這也解釋了為什麼 ⟨aₙ⟩ 不是等差：相鄰差 2、4、8… 一直在變。" },
      { title: "求和：把「−1」拆出來", text: "Σ aₖ = (2 + 4 + … + 2¹⁰) − 10 = (2¹¹ − 2) − 10 = 2¹¹ − 12。答案 (1)(2)(3)(4)。" }
    ],
    draw(c) {
      const vals = [1, 3, 7, 15, 31]; const unit = 8.2; const bw = 58; const gapx = 40; const ox = 70, base = 320;
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const g = el("g", null, c.svg);
      el("line", { x1: 30, y1: base, x2: c.W - 20, y2: base, stroke: C.axis, "stroke-width": 1.4 }, g);
      vals.forEach((v, i) => {
        const q = c.k === 0 ? sub(p0, i / 5, (i + 1) / 5) : 1; if (q <= 0) return;
        const x = ox + i * (bw + gapx);
        const hprev = i === 0 ? 0 : vals[i - 1] * unit;
        // 2 倍前一項（兩塊）+ 1
        const total = v * unit * q;
        if (i === 0) { el("rect", { x, y: base - total, width: bw, height: total, fill: C.c2, rx: 3 }, g); }
        else {
          const hA = Math.min(total, hprev), hB = clamp(total - hprev, 0, hprev), hC = clamp(total - 2 * hprev, 0, unit);
          el("rect", { x, y: base - hA, width: bw, height: hA, fill: C.c1, rx: 3 }, g);
          if (hB > 0) el("rect", { x, y: base - hprev - hB, width: bw, height: hB, fill: C.c1, opacity: 0.7, rx: 3 }, g);
          if (hB > 0) el("line", { x1: x, y1: base - hprev, x2: x + bw, y2: base - hprev, stroke: C.surface, "stroke-width": 2 }, g);
          if (hC > 0) el("rect", { x, y: base - 2 * hprev - hC, width: bw, height: hC, fill: C.c2, rx: 2 }, g);
        }
        // +1 的綠色塊
        if (p1 > 0) { const hh = unit * p1; el("rect", { x, y: base - v * unit - hh, width: bw, height: hh, fill: C.c3, rx: 2, opacity: 0.95 }, g); }
        el("text", { x: x + bw / 2, y: base + 18, text: "a" + "₁₂₃₄₅"[i], "font-size": 14, cls: "math", fill: C.ink2, "text-anchor": "middle" }, g);
        if (q >= 1) el("text", { x: x + bw / 2, y: base - v * unit - unit * p1 - 8, text: p1 > 0.5 ? `${v} + 1 = ${v + 1}` : String(v), "font-size": 13, cls: "mono", fill: p1 > 0.5 ? C.c3 : C.ink, "font-weight": 600, "text-anchor": "middle" }, g);
        // ×2 箭頭
        if (p1 >= 1 && i < 4) { el("text", { x: x + bw + gapx / 2, y: base - (v + 1) * unit - 30, text: "×2", "font-size": 13, cls: "mono", fill: C.c3, "text-anchor": "middle", "font-weight": 700 }, g); }
        if (c.k === 0 && i > 0 && q > 0 && q < 1) { el("text", { x: x + bw / 2, y: base - total - 8, text: "×2 再 +1", "font-size": 12, fill: C.c2, "text-anchor": "middle" }, g); }
      });
      // 圖例
      const lx = 30, ly = 26;
      el("rect", { x: lx, y: ly - 9, width: 12, height: 12, fill: C.c1, rx: 2 }, g); el("text", { x: lx + 18, y: ly + 1, text: "前一項的 2 倍", "font-size": 12, fill: C.ink2 }, g);
      el("rect", { x: lx + 120, y: ly - 9, width: 12, height: 12, fill: C.c2, rx: 2 }, g); el("text", { x: lx + 138, y: ly + 1, text: "+1", "font-size": 12, fill: C.ink2 }, g);
      if (p1 > 0) { el("rect", { x: lx + 180, y: ly - 9, width: 12, height: 12, fill: C.c3, rx: 2, opacity: p1 }, g); el("text", { x: lx + 198, y: ly + 1, text: "補上的 1（aₙ + 1）", "font-size": 12, fill: C.ink2, opacity: p1 }, g); }
      if (p1 >= 1) tag(c.svg, 30, 62, "aₙ₊₁ + 1 = 2(aₙ + 1)", { fill: C.c3, "font-weight": 700, "font-size": 13 });
      if (p2 > 0) tag(c.svg, 30, 88, "aₙ + 1 = 2ⁿ  ⇒  aₙ = 2ⁿ − 1", { fill: C.ink, "font-size": 13, opacity: p2 });
      if (p3 > 0) tag(c.svg, 30, 114, "Σ aₖ = (2¹¹ − 2) − 10 = 2¹¹ − 12", { fill: C.ok, "font-size": 13, "font-weight": 700, opacity: p3 });
    }
  });

  /* ---------- 第 9 題：資料線性變換 ---------- */
  const Q9_DEV = [20, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 7, 6, 5, 4, 4, 3, 3, 1, 0];
  const Q9_DATA = Q9_DEV.flatMap(d => (d === 0 ? [60, 60] : [60 - d, 60 + d]));
  define("q9", {
    w: 640, h: 400,
    steps: [
      { title: "原始成績：平均 60、標準差 10", text: "40 個點，平均線在 60，色帶是「平均 ± 一個標準差」。" },
      { title: "先乘 1.2：整體被拉開", text: "每個分數變成 1.2 倍，點與點之間的距離也變成 1.2 倍。平均變 72，標準差變 12。" },
      { title: "再減 2：整體平移", text: "全部往左移 2，平均變 70，但點之間的距離完全沒變，標準差仍是 12。(1) 對、(2) 錯。" },
      { title: "z 分數看的是「離平均幾個標準差」", text: "80 分的同學原本是 +2 個標準差；調整後 94 分，離平均 70 剛好 24 = 2 × 12，仍是 +2。相對位置不變，(3) 對。" },
      { title: "相關係數只看相對位置", text: "數學對英文的散布圖，正倍率不改變形狀（(4) 對）；若改用 100 − x，圖左右翻轉，相關係數變號（(5) 對）。答案 (1)(3)(4)(5)。" }
    ],
    draw(c) {
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      if (c.k < 4) {
        const pl = plane(c.svg, { w: c.W, h: c.H, x0: 28, x1: 102, y0: 0, y1: 10, pad: { l: 20, r: 20, t: 40, b: 40 } });
        const { X, Y, g } = pl;
        const a = lerp(1, 1.2, p1), b = lerp(0, -2, p2);
        const T = (x) => a * x + b;
        const mean = T(60), sd = 10 * a;
        // 色帶與平均線
        el("rect", { x: X(mean - sd), y: Y(9.6), width: X(mean + sd) - X(mean - sd), height: Y(-0.2) - Y(9.6), fill: C.c1, opacity: 0.1, rx: 6 }, g);
        el("line", { x1: X(mean), y1: Y(9.8), x2: X(mean), y2: Y(-0.3), stroke: C.c1, "stroke-width": 2, "stroke-dasharray": "5 4" }, g);
        el("line", { x1: X(28), y1: Y(0), x2: X(102), y2: Y(0), stroke: C.axis, "stroke-width": 1.4 }, g);
        for (let v = 30; v <= 100; v += 10) { el("line", { x1: X(v), y1: Y(0) - 3, x2: X(v), y2: Y(0) + 3, stroke: C.axis }, g); label(pl, v, 0, String(v), { dy: 16, cls: "mono", "font-size": 11, fill: C.ink3 }); }
        // 點：依值堆疊
        const counts = {};
        const sorted = Q9_DATA.slice().sort((p, q) => p - q);
        sorted.forEach((v, i) => {
          const q = c.k === 0 ? sub(p0, i / 60, (i + 20) / 60) : 1; if (q <= 0) return;
          const bin = Math.round(v / 2) * 2; counts[bin] = (counts[bin] || 0); const lvl = counts[bin]++;
          const tv = T(v); const hl = c.k === 3 && (v === 80 || v === 40);
          dot(pl, tv, 0.5 + lvl * 0.72, { r: hl ? 7 : 5, fill: hl ? C.c2 : C.c1, opacity: q });
          if (hl) label(pl, tv, 0.5 + lvl * 0.72, `${fmt(tv, 0)} 分  z = ${fmt((tv - mean) / sd, 0)}`, { dy: -14, fill: C.c2, "font-size": 12.5, "font-weight": 700, cls: "mono" });
        });
        label(pl, mean, 9.8, "平均 " + fmt(mean, 0), { dy: -6, fill: C.c1, "font-size": 13, "font-weight": 700 });
        // 標準差標示
        arrow(pl, mean, 9.0, mean + sd, 9.0, 1, { stroke: C.c4, "stroke-width": 1.8, head: 6 });
        label(pl, mean + sd / 2, 9.0, "σ = " + fmt(sd, 0), { dy: -6, fill: C.c4, "font-size": 12, cls: "mono" });
        tag(c.svg, 20, 22, c.k === 0 ? "y = x" : c.k === 1 ? "y = 1.2x" : "y = 1.2x − 2", { fill: C.ink, cls: "mono", "font-size": 13, "font-weight": 600 });
        tag(c.svg, c.W - 20, 22, `平均 ${fmt(mean, 1)}，標準差 ${fmt(sd, 1)}`, { anchor: "end", fill: C.c1, "font-size": 12.5 });
      } else {
        // 散布圖與翻轉
        const flip = p4; // 0 → 原圖；1 → x 變成 100−x
        const pl = plane(c.svg, { w: c.W, h: c.H, x0: 20, x1: 100, y0: 30, y1: 100, pad: { l: 40, r: 16, t: 34, b: 30 } });
        grid(pl, 10, { opacity: 0.6 }); axes(pl, { xStep: 20, yStep: 20, xLabel: flip > 0.5 ? "100 − x" : "數學 x", yLabel: "英文" });
        Q9_DATA.forEach((v, i) => {
          const noise = Math.sin(i * 12.9898) * 7; const eng = clamp(65 + 0.6 * (v - 60) + noise, 32, 98);
          const x = lerp(v, 100 - v, flip);
          dot(pl, x, eng, { r: 4.5, fill: C.c1, opacity: 0.85 });
        });
        const r = 0.87 * (1 - 2 * flip);
        tag(c.svg, c.W - 16, 22, `相關係數 r ≈ ${fmt(0.87 * (flip < 0.5 ? 1 : -1), 2)}`, { anchor: "end", fill: flip < 0.5 ? C.c1 : C.bad, "font-size": 13, "font-weight": 700 });
        tag(c.svg, 44, 22, flip < 0.5 ? "y = 1.2x − 2：形狀不變" : "y = 100 − x：左右翻轉", { fill: C.ink, "font-size": 12.5 });
      }
    }
  });

  /* ---------- 第 10 題：內積、正射影、面積 ---------- */
  define("q10", {
    w: 640, h: 400,
    steps: [
      { title: "畫出 a = (4,3)、b = (1,2)", text: "|a| = 5，|b| = √5，內積 a·b = 4·1 + 3·2 = 10。(1) 正確。" },
      { title: "正射影就是影子", text: "從上方垂直於 a 打光，b 在 a 上的影子就是正射影：長度 = a·b / |a| = 2，向量 = (a·b/|a|²) a = (8/5, 6/5)。(2) 正確。" },
      { title: "行列式給的是平行四邊形", text: "|4·2 − 3·1| = 5 是以 a、b 為鄰邊的平行四邊形面積，三角形只有一半 5/2。(3) 錯。" },
      { title: "轉動 a + t b 直到與 b 垂直", text: "(a + t b)·b = 10 + 5t，t = −2 時為 0。a − 2b = (2, −1) 確實與 b 垂直。(5) 正確。" },
      { title: "三角不等式", text: "a 與 b 不同向，a + b 走的是三角形的第三邊，|a + b| = √50 < 5 + √5。(4) 錯。答案 (1)(2)(5)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -1.2, x1: 6.2, y0: -1.6, y1: 5.2, square: true, pad: { l: 20, r: 10, t: 10, b: 20 } });
      grid(pl, 1); axes(pl, { xStep: 1, yStep: 1 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const a = [4, 3], b = [1, 2];
      if (c.k === 2 || (c.k > 2 && false)) {
        poly(pl, [[0, 0], a, [5, 5], b], { fill: C.c3, opacity: 0.18 * p2 });
        poly(pl, [[0, 0], a, b], { fill: C.c3, opacity: 0.3 * p2 });
        polyline(pl, [a, [5, 5], b], { stroke: C.c3, "stroke-dasharray": "4 3", "stroke-width": 1.4, opacity: p2 });
        label(pl, 2.6, 2.6, "平行四邊形 5", { dx: 10, dy: -4, fill: C.c3, "font-size": 12.5, opacity: p2 });
        label(pl, 1.6, 1.4, "三角形 5/2", { dx: 6, dy: 12, fill: C.c3, "font-size": 12.5, opacity: p2 });
      }
      arrow(pl, 0, 0, a[0], a[1], p0, { stroke: C.c1, "stroke-width": 2.8 });
      arrow(pl, 0, 0, b[0], b[1], p0, { stroke: C.c4, "stroke-width": 2.8 });
      label(pl, a[0], a[1], "a = (4, 3)", { dx: 34, dy: 4, fill: C.c1, cls: "math", "font-size": 13, opacity: p0 });
      label(pl, b[0], b[1], "b = (1, 2)", { dx: -8, dy: -12, fill: C.c4, cls: "math", "font-size": 13, opacity: p0, "text-anchor": "end" });
      if (p0 >= 1 && c.k <= 1) { arc(pl, 0, 0, 0.8, Math.atan2(3, 4), Math.atan2(2, 1), { stroke: C.c2 }); label(pl, 0.95, 0.85, "θ", { fill: C.c2, cls: "math", "font-size": 13 }); }
      if (p1 > 0) {
        // 光線
        const nx = -3 / 5, ny = 4 / 5; // 垂直於 a 的單位向量
        const proj = [8 / 5, 6 / 5];
        for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.36; const px = b[0] * t, py = b[1] * t; const pr = [(px * 4 + py * 3) / 25 * 4, (px * 4 + py * 3) / 25 * 3]; seg(pl, px + nx * 1.4, py + ny * 1.4, pr[0], pr[1], p1, { stroke: C.warn, "stroke-width": 1, opacity: 0.55, "stroke-dasharray": "3 3" }); }
        seg(pl, b[0], b[1], proj[0], proj[1], p1, { stroke: C.c4, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        arrow(pl, 0, 0, proj[0], proj[1], p1, { stroke: C.c3, "stroke-width": 5 });
        rightAngle(pl, proj[0], proj[1], 4 / 5, 3 / 5, nx, ny, 0.25);
        label(pl, proj[0], proj[1], "正射影 (8/5, 6/5)，長 2", { dx: 20, dy: 20, fill: C.c3, "font-size": 12.5, "font-weight": 600, opacity: p1 });
        if (c.k <= 1) label(pl, 3.2, 0.6, "a·b = |a| × 影長 = 5 × 2 = 10", { fill: C.ink, "font-size": 12.5, opacity: p1 });
      }
      if (c.k === 3) {
        const t = lerp(0, -2, p3); const v = [a[0] + t * b[0], a[1] + t * b[1]];
        arrow(pl, 0, 0, v[0], v[1], 1, { stroke: C.c2, "stroke-width": 2.6 });
        label(pl, v[0], v[1], `a + (${fmt(t, 1)}) b`, { dx: 30, dy: 16, fill: C.c2, cls: "math", "font-size": 12.5 });
        const dp = v[0] * b[0] + v[1] * b[1];
        tag(c.svg, c.W - 12, 24, `(a + t b)·b = 10 + 5t = ${fmt(dp, 1)}`, { anchor: "end", fill: Math.abs(dp) < 0.05 ? C.ok : C.c2, cls: "mono", "font-size": 12.5 });
        if (Math.abs(dp) < 0.05) { rightAngle(pl, 0, 0, v[0] / Math.hypot(v[0], v[1]), v[1] / Math.hypot(v[0], v[1]), b[0] / Math.sqrt(5), b[1] / Math.sqrt(5), 0.3, { stroke: C.ok, "stroke-width": 2 }); tag(c.svg, c.W - 12, 48, "t = −2：a − 2b = (2, −1) ⊥ b", { anchor: "end", fill: C.ok, "font-weight": 700 }); }
      }
      if (c.k === 4) {
        arrow(pl, a[0], a[1], a[0] + b[0], a[1] + b[1], p4, { stroke: C.c4, "stroke-width": 2, "stroke-dasharray": "5 3" });
        arrow(pl, 0, 0, 5, 5, p4, { stroke: C.c2, "stroke-width": 2.6 });
        label(pl, 5, 5, "a + b，長 √50 ≈ 7.07", { dx: -10, dy: -10, fill: C.c2, "font-size": 12.5, opacity: p4, "text-anchor": "end" });
        tag(c.svg, c.W - 12, 24, "|a| + |b| = 5 + √5 ≈ 7.24 > |a + b|", { anchor: "end", fill: C.ink, "font-size": 12.5, opacity: p4 });
      }
      if (c.k === 0 || c.k === 1) tag(c.svg, c.W - 12, 24, "a·b = 4·1 + 3·2 = 10", { anchor: "end", fill: C.c1, cls: "mono", "font-size": 12.5, "font-weight": 600 });
      if (c.k === 2) tag(c.svg, c.W - 12, 24, "| 4·2 − 3·1 | = 5", { anchor: "end", fill: C.c3, cls: "mono", "font-size": 12.5, "font-weight": 600 });
    }
  });

  /* ---------- 第 11 題：平面、法向量、距離、平行線 ---------- */
  define("q11", {
    w: 640, h: 420,
    steps: [
      { title: "平面 E：x + 2y + 2z = 6", text: "先把它和三個座標軸的交點畫出來：(6,0,0)、(0,3,0)、(0,0,3)。這片三角形只是平面的一小塊，平面本身是無限延伸的。" },
      { title: "係數就是法向量", text: "n = (1, 2, 2) 垂直於平面上的每一條線。它的長度是 3，這個數字等一下會用到。(1) 正確。" },
      { title: "點到平面的距離：沿法向量走", text: "從 P(3,3,3) 沿 −n 方向走，走到平面時剛好是 (2,1,1)，走了 |n| = 3 的長度。公式 |3+6+6−6| / 3 = 3 說的就是這件事。(2)(5) 正確。" },
      { title: "直線 L 的方向與 n 垂直", text: "L 的方向 (2,−1,0) 與 n 內積為 0，所以 L 平行於平面「或」躺在平面上。檢查 L 上的點 (1,1,0)：1 + 2 + 0 = 3 ≠ 6，不在平面上，所以是平行且不相交。(3) 對、(4) 錯。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -4.6, x1: 4.6, y0: -3.2, y1: 4.2, square: true, pad: { l: 8, r: 8, t: 8, b: 8 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const P3 = (x, y, z) => proj3(x, y, z);
      const A3 = (a, b, p, attrs) => { const u = P3(...a), v = P3(...b); arrow(pl, u[0], u[1], v[0], v[1], p, attrs); };
      const S3 = (a, b, p, attrs) => { const u = P3(...a), v = P3(...b); seg(pl, u[0], u[1], v[0], v[1], p, attrs); };
      const D3 = (a, attrs) => { const u = P3(...a); dot(pl, u[0], u[1], attrs); };
      const L3 = (a, str, attrs) => { const u = P3(...a); label(pl, u[0], u[1], str, attrs); };
      // 座標軸
      A3([0, 0, 0], [7, 0, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 4.2, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 0, 4], 1, { stroke: C.axis, "stroke-width": 1.3 });
      L3([7.4, 0, 0], "x", { cls: "math", fill: C.ink3 }); L3([0, 4.4, 0], "y", { cls: "math", fill: C.ink3 }); L3([0, 0, 4.25], "z", { cls: "math", fill: C.ink3 });
      // 平面片
      const tri = [[6, 0, 0], [0, 3, 0], [0, 0, 3]].map(q => P3(...q));
      if (p0 > 0) {
        poly(pl, [tri[0], [lerp(tri[0][0], tri[1][0], p0), lerp(tri[0][1], tri[1][1], p0)], [lerp(tri[0][0], tri[2][0], p0), lerp(tri[0][1], tri[2][1], p0)]], { fill: C.c1, opacity: 0.22 });
        polyline(pl, tri.concat([tri[0]]), { stroke: C.c1, "stroke-width": 1.8, opacity: p0 });
        L3([6, 0, 0], "(6,0,0)", { dy: 16, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 }); L3([0, 3, 0], "(0,3,0)", { dx: 30, dy: 4, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 }); L3([0, 0, 3], "(0,0,3)", { dx: -30, dy: -4, cls: "mono", "font-size": 11, fill: C.c1, opacity: p0 });
        tag(c.svg, 12, 22, "E：x + 2y + 2z = 6", { fill: C.c1, "font-weight": 700, "font-size": 13 });
      }
      // 法向量（從垂足 (2,1,1) 出發）
      const F = [2, 1, 1];
      if (p1 > 0) {
        A3(F, [2 + 0.8, 1 + 1.6, 1 + 1.6], p1, { stroke: C.c2, "stroke-width": 2.6 });
        L3([2.9, 2.7, 2.6], "n = (1, 2, 2)", { dx: -50, dy: -2, fill: C.c2, cls: "math", "font-size": 13, opacity: p1 });
        tag(c.svg, 12, 46, "|n| = √(1+4+4) = 3", { fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) {
        const P = [3, 3, 3];
        D3(P, { fill: C.c4, r: 5.5 }); L3(P, "P(3, 3, 3)", { dx: 44, dy: -4, fill: C.c4, cls: "mono", "font-size": 12 });
        // 從 P 走向 F
        const cur = [lerp(P[0], F[0], p2), lerp(P[1], F[1], p2), lerp(P[2], F[2], p2)];
        S3(P, cur, 1, { stroke: C.c4, "stroke-width": 2, "stroke-dasharray": "5 3" });
        D3(cur, { fill: C.c4, r: 4 });
        if (p2 >= 1) { D3(F, { fill: C.ok, r: 5.5 }); L3(F, "垂足 (2, 1, 1)", { dx: 6, dy: 18, fill: C.ok, cls: "mono", "font-size": 12, "text-anchor": "start" }); }
        tag(c.svg, 12, 70, `距離 = |3 + 6 + 6 − 6| / 3 = ${fmt(3 * p2, 1)}`, { fill: C.c4, cls: "mono", "font-size": 12.5 });
      }
      if (p3 > 0) {
        const Lp = (t) => [1 + 2 * t, 1 - t, 0];
        const a = Lp(-1.3), b = Lp(1.9);
        S3(a, [lerp(a[0], b[0], p3), lerp(a[1], b[1], p3), 0], 1, { stroke: C.c3, "stroke-width": 2.6 });
        D3([1, 1, 0], { fill: C.c3, r: 5 }); L3([1, 1, 0], "(1,1,0)：1+2+0 = 3 ≠ 6", { dx: 10, dy: 18, fill: C.c3, "font-size": 11.5, cls: "mono", "text-anchor": "start", opacity: p3 });
        A3([1, 1, 0], [1 + 1.2, 1 - 0.6, 0], p3, { stroke: C.c3, "stroke-width": 2 });
        L3([2.4, 0.3, 0], "(2, −1, 0)", { dx: 0, dy: 16, fill: C.c3, cls: "mono", "font-size": 11.5, opacity: p3 });
        L3(b, "L", { dx: 8, dy: -6, fill: C.c3, cls: "math", "font-size": 14, opacity: p3 });
        tag(c.svg, 12, 94, "(2,−1,0)·(1,2,2) = 0，且 (1,1,0) ∉ E  ⇒  L ∥ E", { fill: C.c3, "font-size": 12.5, opacity: p3 });
      }
    }
  });

  /* ---------- 第 12 題：雙曲線的定義與基本量 ---------- */
  define("q12", {
    w: 640, h: 400,
    steps: [
      { title: "先畫中心矩形", text: "a = 3、b = 4：以 x = ±3、y = ±4 圍出矩形，兩條對角線就是漸近線 y = ±(4/3)x。(2) 正確。" },
      { title: "雙曲線貼著漸近線長出來", text: "頂點在 (±3, 0)，貫軸長 2a = 6，(3) 正確。曲線離中心越遠，越貼近對角線。" },
      { title: "焦距 c 就是矩形的半對角線", text: "c² = a² + b² = 25。把半對角線（長 5）轉到 x 軸上，就落在焦點 (±5, 0)。(1) 正確。" },
      { title: "定義：到兩焦點的距離差固定", text: "P 在曲線上移動時，|PF₁ − PF₂| 永遠等於 2a = 6，不是 8。(4) 錯。" },
      { title: "驗證 (5, 16/3)", text: "x = 5 正好是焦點的 x 座標，代入得 y = ±16/3，這兩點是正焦弦的端點。(5) 正確。答案 (1)(2)(3)(5)。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -8.5, x1: 8.5, y0: -6, y1: 6, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      grid(pl, 1, { opacity: 0.6 }); axes(pl, { xStep: 2, yStep: 2 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const a = 3, b = 4, cc = 5;
      // 矩形與漸近線
      if (p0 > 0) {
        polyline(pl, [[-a, -b], [a, -b], [a, b], [-a, b], [-a, -b]], { stroke: C.c2, "stroke-width": 1.4, "stroke-dasharray": "5 3", opacity: p0 });
        const q = sub(p0, 0.4, 1);
        seg(pl, -8.5 * q, -8.5 * q * b / a, 8.5 * q, 8.5 * q * b / a, 1, { stroke: C.c2, "stroke-width": 1.4 });
        seg(pl, -8.5 * q, 8.5 * q * b / a, 8.5 * q, -8.5 * q * b / a, 1, { stroke: C.c2, "stroke-width": 1.4 });
        label(pl, 4.2, 5.6, "y = (4/3)x", { fill: C.c2, cls: "math", "font-size": 12, opacity: q });
        label(pl, 4.2, -5.6, "y = −(4/3)x", { fill: C.c2, cls: "math", "font-size": 12, opacity: q });
      }
      // 雙曲線
      const U = 1.55;
      if (p1 > 0) {
        [1, -1].forEach(sgn => {
          const pts1 = [], pts2 = [];
          for (let i = 0; i <= 80; i++) { const u = (i / 80) * U * p1; pts1.push([sgn * a * Math.cosh(u), b * Math.sinh(u)]); pts2.push([sgn * a * Math.cosh(u), -b * Math.sinh(u)]); }
          polyline(pl, pts1, { stroke: C.c1, "stroke-width": 2.6 }); polyline(pl, pts2, { stroke: C.c1, "stroke-width": 2.6 });
        });
        dot(pl, a, 0, { fill: C.c1 }); dot(pl, -a, 0, { fill: C.c1 });
        if (c.k === 1) { seg(pl, -a, -0.6, a, -0.6, 1, { stroke: C.c1, "stroke-width": 1.5 }); label(pl, 0, -0.6, "貫軸長 2a = 6", { dy: 16, fill: C.c1, "font-size": 12.5 }); }
      }
      // 焦點：半對角線旋轉
      if (p2 > 0) {
        const ang = Math.atan2(b, a) * (1 - p2);
        seg(pl, 0, 0, cc * Math.cos(ang), cc * Math.sin(ang), 1, { stroke: C.c4, "stroke-width": 2.4 });
        arc(pl, 0, 0, 1.1, ang, Math.atan2(b, a), { stroke: C.c4, "stroke-width": 1.2, "stroke-dasharray": "3 3" });
        label(pl, cc * Math.cos(ang) / 2, cc * Math.sin(ang) / 2, "c = 5", { dx: 16, dy: -8, fill: C.c4, cls: "math", "font-size": 13 });
        if (p2 >= 1) { dot(pl, cc, 0, { fill: C.c4, r: 6 }); dot(pl, -cc, 0, { fill: C.c4, r: 6 }); label(pl, cc, 0, "F₁(5, 0)", { dy: -11, dx: 14, fill: C.c4, cls: "mono", "font-size": 12 }); label(pl, -cc, 0, "F₂(−5, 0)", { dy: -11, dx: -14, fill: C.c4, cls: "mono", "font-size": 12 }); }
        tag(c.svg, 12, 22, "c² = a² + b² = 9 + 16 = 25", { fill: C.c4, cls: "mono", "font-size": 12.5 });
      }
      if (p3 > 0) {
        const u = lerp(-1.25, 1.25, p3); const P = [a * Math.cosh(u), b * Math.sinh(u)];
        seg(pl, P[0], P[1], cc, 0, 1, { stroke: C.c3, "stroke-width": 1.8 }); seg(pl, P[0], P[1], -cc, 0, 1, { stroke: C.c3, "stroke-width": 1.8 });
        dot(pl, P[0], P[1], { fill: C.c3, r: 6 }); label(pl, P[0], P[1], "P", { dx: 14, dy: 4, fill: C.c3, cls: "math", "font-size": 14 });
        const d1 = Math.hypot(P[0] - cc, P[1]), d2 = Math.hypot(P[0] + cc, P[1]);
        tag(c.svg, 12, 46, `PF₂ − PF₁ = ${fmt(d2, 2)} − ${fmt(d1, 2)} = ${fmt(d2 - d1, 2)} = 2a`, { fill: C.c3, cls: "mono", "font-size": 12.5 });
      }
      if (p4 > 0) {
        seg(pl, cc, -16 / 3, cc, 16 / 3, p4, { stroke: C.c5, "stroke-width": 2.2, "stroke-dasharray": "5 3" });
        dot(pl, cc, 16 / 3, { fill: C.c5, r: 6, opacity: p4 }); dot(pl, cc, -16 / 3, { fill: C.c5, r: 6, opacity: p4 });
        label(pl, cc, 16 / 3, "(5, 16/3)", { dx: 40, dy: -4, fill: C.c5, cls: "mono", "font-size": 12.5, opacity: p4 });
        tag(c.svg, 12, 70, "25/9 − 16/9 = 1 ✓（正焦弦端點 y = b²/a）", { fill: C.c5, "font-size": 12.5, opacity: p4 });
      }
    }
  });
})(window.ANIM);

(function (A) {
  "use strict";
  const { define, C, el, lerp, ease, sub, fmt, PI, plane, grid, axes, seg, arrow, dot, label, tag, curve, poly, polyline, circle, arc, rightAngle, proj3, clamp } = A;

  /* ---------- 第 13 題：依餘數分堆 ---------- */
  define("q13", {
    w: 640, h: 380,
    steps: [
      { title: "只看除以 3 的餘數", text: "三個數的和是不是 3 的倍數，只跟它們的餘數有關。把 1～9 依餘數 0、1、2 分成三堆，每堆剛好 3 個。" },
      { title: "情形一：三個同一堆", text: "餘數 0+0+0、1+1+1、2+2+2 都是 3 的倍數。每堆只有 3 個數，取法各 1 種，共 3 種。" },
      { title: "情形二：三堆各取一個", text: "餘數 0+1+2 = 3。每堆各有 3 種選法，共 3 × 3 × 3 = 27 種。" },
      { title: "其他組合都不行", text: "例如兩個餘 0 加一個餘 1，餘數和是 1；兩個餘 1 加一個餘 2，餘數和是 4。都不是 3 的倍數。" },
      { title: "合計 3 + 27 = 30", text: "答案是 30。分類討論的關鍵，是找到「真正影響結果的特徵」——這題是餘數。" }
    ],
    draw(c) {
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3), p4 = c.P(4);
      const g = el("g", null, c.svg);
      const cols = [C.c1, C.c2, C.c3]; const names = ["餘 0：{3, 6, 9}", "餘 1：{1, 4, 7}", "餘 2：{2, 5, 8}"];
      const S = 44;
      const posRow = (n) => [60 + (n - 1) * 62, 60];
      const posGrp = (n) => { const r = n % 3, j = Math.floor((n - 1) / 3); return [120 + r * 190, 150 + j * 60]; };
      // 群組標題
      for (let r = 0; r < 3; r++) { el("text", { x: 120 + r * 190 + S / 2, y: 128, text: names[r], "font-size": 13, fill: cols[r], "text-anchor": "middle", "font-weight": 600, opacity: p0 }, g); }
      // 情形一高亮
      let hi = -1;
      if (c.k === 1) hi = Math.min(2, Math.floor(p1 * 3));
      // 情形二：連線
      if (c.k === 2) {
        const pick = Math.floor(p2 * 26.999); const i0 = pick % 3, i1 = Math.floor(pick / 3) % 3, i2 = Math.floor(pick / 9) % 3;
        const chosen = [[3, 6, 9][i0], [1, 4, 7][i1], [2, 5, 8][i2]];
        const pts = chosen.map(n => posGrp(n));
        polyline({ X: (x) => x, Y: (y) => y, g }, pts.map(p => [p[0] + S / 2, p[1] + S / 2]), { stroke: C.c4, "stroke-width": 3, opacity: 0.8 });
        el("text", { x: 320, y: 352, text: `{${chosen.join(", ")}}：和 = ${chosen[0] + chosen[1] + chosen[2]}，第 ${pick + 1} / 27 種`, "font-size": 13, cls: "mono", fill: C.c4, "text-anchor": "middle", "font-weight": 600 }, g);
        chosen.forEach(n => { const p = posGrp(n); el("rect", { x: p[0] - 4, y: p[1] - 4, width: S + 8, height: S + 8, rx: 10, fill: "none", stroke: C.c4, "stroke-width": 2.5 }, g); });
      }
      if (c.k === 3) {
        const bad = p3 < 0.5 ? [[3, 6, 1], "0 + 0 + 1 = 1"] : [[1, 4, 2], "1 + 1 + 2 = 4"];
        bad[0].forEach(n => { const p = posGrp(n); el("rect", { x: p[0] - 4, y: p[1] - 4, width: S + 8, height: S + 8, rx: 10, fill: "none", stroke: C.bad, "stroke-width": 2.5, "stroke-dasharray": "5 3" }, g); });
        el("text", { x: 320, y: 352, text: `餘數 ${bad[1]}，不是 3 的倍數 ✗`, "font-size": 13.5, cls: "mono", fill: C.bad, "text-anchor": "middle", "font-weight": 600 }, g);
      }
      for (let n = 1; n <= 9; n++) {
        const r = n % 3; const a = posRow(n), b = posGrp(n); const x = lerp(a[0], b[0], p0), y = lerp(a[1], b[1], p0);
        const inHi = hi >= 0 && r === hi;
        el("rect", { x, y, width: S, height: S, rx: 9, fill: cols[r], opacity: p0 > 0.3 ? (inHi ? 1 : 0.85) : 0.5, stroke: inHi ? C.ink : "none", "stroke-width": 2.5 }, g);
        el("text", { x: x + S / 2, y: y + S / 2 + 7, text: String(n), "font-size": 20, fill: "#fff", "text-anchor": "middle", "font-weight": 700, cls: "mono" }, g);
        if (p0 > 0.5) el("text", { x: x + S / 2, y: y + S + 13, text: "餘 " + r, "font-size": 10.5, fill: C.ink3, "text-anchor": "middle", opacity: sub(p0, 0.5, 1) }, g);
      }
      if (c.k === 1) el("text", { x: 320, y: 352, text: ["{3, 6, 9}", "{1, 4, 7}", "{2, 5, 8}"][hi] + "：同堆取三個，1 種", "font-size": 13.5, fill: C.ink, "text-anchor": "middle", cls: "mono", "font-weight": 600 }, g);
      if (c.k === 0) el("text", { x: 320, y: 352, text: "1～9 依餘數分成三堆", "font-size": 13.5, fill: C.ink2, "text-anchor": "middle" }, g);
      if (p1 >= 1) tag(c.svg, 12, 22, "同堆取三個：3 種", { fill: C.c1, "font-size": 12.5, "font-weight": 600 });
      if (p2 >= 1) tag(c.svg, 12, 46, "三堆各取一個：3 × 3 × 3 = 27 種", { fill: C.c4, "font-size": 12.5, "font-weight": 600 });
      if (p4 > 0) tag(c.svg, 12, 70, "合計 3 + 27 = 30 種", { fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p4 });
    }
  });

  /* ---------- 第 14 題：餘弦定理 → 正弦定理 → 外接圓 ---------- */
  define("q14", {
    w: 640, h: 400,
    steps: [
      { title: "已知兩邊夾角", text: "AB = 3、AC = 5、∠A = 120°。要求外接圓半徑，得先知道一條邊「和它所對的角」——所以先把 BC 算出來。" },
      { title: "餘弦定理＝有角度修正的畢氏定理", text: "從 C 向 AB 的延長線作垂線，垂足 D。∠CAD = 60°，AD = 2.5、CD = (5√3)/2，DB = 5.5。BC² = CD² + DB² = 18.75 + 30.25 = 49，BC = 7。這正是 9 + 25 − 2·3·5·cos120° = 49。" },
      { title: "畫出外接圓", text: "三邊的中垂線交於圓心 O，半徑 R 就是要求的量。" },
      { title: "正弦定理：邊 ÷ 對角的正弦 ＝ 直徑", text: "取 B 的對徑點 B′，∠BCB′ = 90°、∠BB′C = 60°（與 120° 互補），所以 BC = BB′·sin 60°，即 2R = 7 / sin 120° = 14/√3，R = 7√3/3 ≈ 4.04。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -5, x1: 7, y0: -1.8, y1: 8.2, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const Apt = [0, 0], B = [3, 0], Cc = [-2.5, 5 * Math.sqrt(3) / 2];
      const O = [1.5, 3.7528], R = 4.0415;
      if (p2 > 0) { circle(pl, O[0], O[1], R * p2, { stroke: C.c5, "stroke-width": 2 }); if (p2 >= 1) { dot(pl, O[0], O[1], { fill: C.c5 }); label(pl, O[0], O[1], "O", { dx: 12, dy: -4, fill: C.c5, cls: "math", "font-size": 14 }); } }
      // 三角形
      poly(pl, [Apt, B, Cc], { fill: C.c1, opacity: 0.12 * p0 });
      seg(pl, Apt[0], Apt[1], B[0], B[1], p0, { stroke: C.c1, "stroke-width": 2.4 });
      seg(pl, Apt[0], Apt[1], Cc[0], Cc[1], p0, { stroke: C.c1, "stroke-width": 2.4 });
      seg(pl, B[0], B[1], Cc[0], Cc[1], p0, { stroke: C.c4, "stroke-width": 2.4 });
      label(pl, Apt[0], Apt[1], "A", { dx: 4, dy: 20, cls: "math", "font-size": 15 }); label(pl, B[0], B[1], "B", { dx: 10, dy: 20, cls: "math", "font-size": 15 }); label(pl, Cc[0], Cc[1], "C", { dx: -6, dy: -10, cls: "math", "font-size": 15 });
      label(pl, 1.5, 0, "3", { dy: 18, fill: C.c1, cls: "math", "font-size": 13 }); label(pl, -1.25, 2.17, "5", { dx: 12, dy: 4, fill: C.c1, cls: "math", "font-size": 13 });
      label(pl, 0.25, 2.17, p1 >= 1 ? "7" : "?", { dx: 12, dy: 0, fill: C.c4, cls: "math", "font-size": 14, "font-weight": 700 });
      arc(pl, 0, 0, 0.7, 0, 2 * PI / 3, { stroke: C.c2 }); label(pl, 0.35, 0.75, "120°", { dx: 14, dy: 0, fill: C.c2, "font-size": 12 });
      if (p1 > 0) {
        const D = [-2.5, 0];
        seg(pl, 0, 0, D[0] * p1, 0, 1, { stroke: C.ink3, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        seg(pl, Cc[0], Cc[1], Cc[0], Cc[1] * (1 - p1), 1, { stroke: C.c3, "stroke-width": 2 });
        if (p1 >= 1) {
          rightAngle(pl, D[0], D[1], 1, 0, 0, 1, 0.3); label(pl, D[0], D[1], "D", { dx: -10, dy: 18, cls: "math", "font-size": 14 });
          label(pl, -1.25, 0, "2.5", { dy: 18, fill: C.ink2, cls: "mono", "font-size": 12 }); label(pl, -2.5, 2.17, "5√3/2", { dx: -26, fill: C.c3, cls: "mono", "font-size": 12 });
          arc(pl, 0, 0, 0.9, 2 * PI / 3, PI, { stroke: C.c3 }); label(pl, -1.05, 0.55, "60°", { fill: C.c3, "font-size": 11.5 });
          tag(c.svg, 12, 22, "BC² = CD² + DB² = 18.75 + 30.25 = 49", { fill: C.c4, cls: "mono", "font-size": 12.5 });
          tag(c.svg, 12, 46, "＝ 9 + 25 − 2·3·5·cos120°  ⇒  BC = 7", { fill: C.c4, cls: "mono", "font-size": 12.5 });
        }
      }
      if (p3 > 0) {
        const Bp = [2 * O[0] - B[0], 2 * O[1] - B[1]];
        seg(pl, B[0], B[1], Bp[0], Bp[1], p3, { stroke: C.c5, "stroke-width": 2, "stroke-dasharray": "6 4" });
        if (p3 >= 1) {
          dot(pl, Bp[0], Bp[1], { fill: C.c5 }); label(pl, Bp[0], Bp[1], "B′", { dx: -4, dy: -10, fill: C.c5, cls: "math", "font-size": 14 });
          seg(pl, Bp[0], Bp[1], Cc[0], Cc[1], 1, { stroke: C.c5, "stroke-width": 1.8 });
          const u = [(B[0] - Cc[0]), (B[1] - Cc[1])], lu = Math.hypot(u[0], u[1]); const v = [(Bp[0] - Cc[0]), (Bp[1] - Cc[1])], lv = Math.hypot(v[0], v[1]);
          rightAngle(pl, Cc[0], Cc[1], u[0] / lu, u[1] / lu, v[0] / lv, v[1] / lv, 0.35, { stroke: C.c5 });
          label(pl, Bp[0] + 0.5, Bp[1] - 0.55, "60°", { fill: C.c5, "font-size": 11.5 });
          label(pl, (B[0] + Bp[0]) / 2 + 0.6, (B[1] + Bp[1]) / 2, "2R", { dx: 14, fill: C.c5, cls: "math", "font-size": 13 });
          tag(c.svg, 12, 70, "2R = BC / sin A = 7 / (√3/2) = 14/√3", { fill: C.c5, cls: "mono", "font-size": 12.5 });
          tag(c.svg, 12, 94, "R = 7√3 / 3 ≈ 4.04", { fill: C.ok, "font-size": 14, "font-weight": 700 });
        }
      }
    }
  });

  /* ---------- 第 15 題：外積＝面積＋法向量 ---------- */
  define("q15", {
    w: 640, h: 400,
    steps: [
      { title: "三個點分別落在三條座標軸上", text: "A(1,0,0)、B(0,2,0)、C(0,0,3)。先把它們連成三角形。" },
      { title: "用 A 當起點，寫出兩邊向量", text: "AB = (−1, 2, 0)、AC = (−1, 0, 3)。三角形完全由這兩個向量決定。" },
      { title: "外積：長度是面積，方向是法向量", text: "AB × AC = (2·3 − 0·0, 0·(−1) − (−1)·3, (−1)·0 − 2·(−1)) = (6, 3, 2)。它垂直於三角形所在的平面，所以 6x + 3y + 2z = 6 就是平面 ABC。" },
      { title: "|AB × AC| = 7 是平行四邊形面積", text: "√(36 + 9 + 4) = 7。三角形是平行四邊形的一半：7/2。" }
    ],
    draw(c) {
      const K = { ax: -0.8, ay: -0.5 };
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -3.6, x1: 3.2, y0: -2.2, y1: 3.8, square: true, pad: { l: 8, r: 8, t: 8, b: 8 } });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const P3 = (x, y, z) => proj3(x, y, z, K);
      const A3 = (a, b, p, attrs) => { const u = P3(...a), v = P3(...b); arrow(pl, u[0], u[1], v[0], v[1], p, attrs); };
      const S3 = (a, b, p, attrs) => { const u = P3(...a), v = P3(...b); seg(pl, u[0], u[1], v[0], v[1], p, attrs); };
      const D3 = (a, attrs) => { const u = P3(...a); dot(pl, u[0], u[1], attrs); };
      const L3 = (a, str, attrs) => { const u = P3(...a); label(pl, u[0], u[1], str, attrs); };
      A3([0, 0, 0], [3, 0, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 3.2, 0], 1, { stroke: C.axis, "stroke-width": 1.3 }); A3([0, 0, 0], [0, 0, 3.7], 1, { stroke: C.axis, "stroke-width": 1.3 });
      L3([3.3, 0, 0], "x", { cls: "math", fill: C.ink3 }); L3([0, 3.4, 0], "y", { cls: "math", fill: C.ink3 }); L3([0, 0, 3.9], "z", { cls: "math", fill: C.ink3 });
      const Ap = [1, 0, 0], Bp = [0, 2, 0], Cp = [0, 0, 3], Dp = [-1, 2, 3];
      const tri = [Ap, Bp, Cp].map(q => P3(...q));
      if (p3 > 0) { const par = [Ap, Bp, Dp, Cp].map(q => P3(...q)); poly(pl, par, { fill: C.c3, opacity: 0.18 * p3 }); polyline(pl, par.concat([par[0]]), { stroke: C.c3, "stroke-width": 1.5, "stroke-dasharray": "5 3", opacity: p3 }); L3(Dp, "D", { dx: 10, dy: -6, cls: "math", "font-size": 13, fill: C.c3, opacity: p3 }); }
      poly(pl, tri, { fill: C.c1, opacity: 0.25 * p0 });
      S3(Ap, Bp, p0, { stroke: C.c1, "stroke-width": 2 }); S3(Bp, Cp, p0, { stroke: C.c1, "stroke-width": 2 }); S3(Cp, Ap, p0, { stroke: C.c1, "stroke-width": 2 });
      D3(Ap, { fill: C.c1 }); D3(Bp, { fill: C.c1 }); D3(Cp, { fill: C.c1 });
      L3(Ap, "A(1,0,0)", { dx: -8, dy: 20, cls: "mono", "font-size": 11.5 }); L3(Bp, "B(0,2,0)", { dx: 34, dy: 4, cls: "mono", "font-size": 11.5 }); L3(Cp, "C(0,0,3)", { dx: -34, dy: -4, cls: "mono", "font-size": 11.5 });
      if (p1 > 0) {
        A3(Ap, Bp, p1, { stroke: C.c2, "stroke-width": 3 }); A3(Ap, Cp, p1, { stroke: C.c4, "stroke-width": 3 });
        tag(c.svg, 12, 22, "AB = (−1, 2, 0)", { fill: C.c2, cls: "mono", "font-size": 12.5, opacity: p1 });
        tag(c.svg, 12, 46, "AC = (−1, 0, 3)", { fill: C.c4, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) {
        const n = [6, 3, 2]; const s = 0.5 * p2; const tip = [Ap[0] + n[0] * s, Ap[1] + n[1] * s, Ap[2] + n[2] * s];
        A3(Ap, tip, 1, { stroke: C.c3, "stroke-width": 3.2 });
        L3(tip, "AB × AC = (6, 3, 2)", { dx: 0, dy: 18, fill: C.c3, cls: "mono", "font-size": 12.5, "font-weight": 600, opacity: p2 });
        tag(c.svg, 12, 70, "(2·3−0·0, 0·(−1)−(−1)·3, (−1)·0−2·(−1))", { fill: C.c3, cls: "mono", "font-size": 11.5, opacity: p2 });
        tag(c.svg, 12, 94, "平面 ABC：6x + 3y + 2z = 6", { fill: C.c3, "font-size": 12.5, opacity: p2 });
      }
      if (p3 > 0) {
        tag(c.svg, c.W - 12, 22, "|(6,3,2)| = √49 = 7 ＝ 平行四邊形面積", { anchor: "end", fill: C.c3, "font-size": 12.5, opacity: p3 });
        tag(c.svg, c.W - 12, 46, "△ABC = 7 / 2", { anchor: "end", fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p3 });
      }
    }
  });

  /* ---------- 第 16 題：指數成長與對數尺 ---------- */
  define("q16", {
    w: 640, h: 400,
    steps: [
      { title: "每 3 小時翻一倍", text: "500 → 1000 → 2000 → 4000 …，每一步都是「乘 2」。畫出來是一條越來越陡的曲線 N = 500·2^(t/3)。" },
      { title: "目標是 100 倍", text: "50,000 ÷ 500 = 100。問題變成：2 要連乘幾次才會超過 100？2⁶ = 64 不夠，2⁷ = 128 夠，答案介於 6 和 7 次之間。" },
      { title: "換成對數尺，曲線變直線", text: "把縱軸改成「每格乘 10」的對數尺，指數曲線就變成直線。乘法變加法，這就是對數的本事：翻倍次數 = log 100 / log 2 = 2 / 0.3010 ≈ 6.64。" },
      { title: "6.64 次 × 3 小時 ≈ 19.93 小時", text: "19 小時時只有約 80.6 倍（40,300 隻），20 小時時約 101.6 倍（50,800 隻），所以第一次超過是在 20 小時。答案 20。" }
    ],
    draw(c) {
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      const W = c.W, H = c.H; const L = 62, Rr = 20, T = 18, Bm = 34;
      const X = (t) => L + (t / 24) * (W - L - Rr);
      const yLin = (n) => T + (1 - n / 70000) * (H - T - Bm);
      const yLog = (n) => T + (1 - (Math.log10(n) - Math.log10(300)) / (Math.log10(80000) - Math.log10(300))) * (H - T - Bm);
      const m = p2; const Y = (n) => lerp(yLin(n), yLog(n), m);
      const g = el("g", null, c.svg);
      // 格線與刻度
      const linTicks = [10000, 20000, 30000, 40000, 50000, 60000], logTicks = [1000, 10000];
      linTicks.forEach(v => { el("line", { x1: L, y1: Y(v), x2: W - Rr, y2: Y(v), stroke: C.grid, opacity: 1 - m }, g); el("text", { x: L - 6, y: Y(v) + 4, text: (v / 1000) + "k", "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: 1 - m }, g); });
      if (m > 0) [500, 1000, 5000, 10000, 50000].forEach(v => { el("line", { x1: L, y1: Y(v), x2: W - Rr, y2: Y(v), stroke: C.grid, opacity: m }, g); el("text", { x: L - 6, y: Y(v) + 4, text: v >= 1000 ? (v / 1000) + "k" : String(v), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: m }, g); });
      el("line", { x1: L, y1: T, x2: L, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
      el("line", { x1: L, y1: H - Bm, x2: W - Rr, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
      for (let t = 0; t <= 24; t += 3) { el("line", { x1: X(t), y1: H - Bm - 3, x2: X(t), y2: H - Bm + 3, stroke: C.axis }, g); el("text", { x: X(t), y: H - Bm + 15, text: String(t), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "middle" }, g); }
      el("text", { x: W - Rr, y: H - Bm + 28, text: "t（小時）", "font-size": 11.5, fill: C.ink2, "text-anchor": "end" }, g);
      el("text", { x: L + 6, y: T + 10, text: m > 0.5 ? "數量（對數尺）" : "數量", "font-size": 11.5, fill: C.ink2 }, g);
      // 曲線
      const f = (t) => 500 * Math.pow(2, t / 3);
      const tEnd = 24 * p0; let d = "";
      for (let i = 0; i <= 200; i++) { const t = (tEnd * i) / 200; const n = f(t); if (n > 80000) break; d += (i ? "L" : "M") + fmt(X(t), 1) + " " + fmt(Y(n), 1); }
      if (d) el("path", { d, fill: "none", stroke: C.c1, "stroke-width": 2.6 }, g);
      // 階梯點
      for (let k = 0; k <= 7; k++) { const t = 3 * k, n = f(t); if (n > 60000 || t > tEnd) continue; el("circle", { cx: X(t), cy: Y(n), r: 4.5, fill: C.c1, stroke: C.surface, "stroke-width": 1.5 }, g); if (k <= 5 || m > 0.5) el("text", { x: X(t) + 6, y: Y(n) - 7, text: n >= 1000 ? fmt(n / 1000, 0) + "k" : String(n), "font-size": 10.5, cls: "mono", fill: C.c1 }, g); }
      // 目標線
      if (p1 > 0) {
        el("line", { x1: L, y1: Y(50000), x2: L + (W - L - Rr) * p1, y2: Y(50000), stroke: C.bad, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
        el("text", { x: L + 8, y: Y(50000) - 7, text: "目標 50,000 = 100 倍", "font-size": 12.5, fill: C.bad, "font-weight": 600, opacity: p1 }, g);
        tag(c.svg, L + 10, 40, "2⁶ = 64 < 100 < 128 = 2⁷", { fill: C.ink, cls: "mono", "font-size": 12.5, opacity: p1 });
      }
      if (p2 > 0) tag(c.svg, L + 10, 64, "翻倍次數 = log 100 / log 2 ≈ 2 / 0.3010 ≈ 6.64", { fill: C.c1, cls: "mono", "font-size": 12.5, opacity: p2 });
      if (p3 > 0) {
        const t0 = 19.93 * p3;
        el("line", { x1: X(t0), y1: H - Bm, x2: X(t0), y2: Y(f(t0)), stroke: C.ok, "stroke-width": 2 }, g);
        el("circle", { cx: X(t0), cy: Y(f(t0)), r: 6, fill: C.ok }, g);
        if (p3 >= 1) {
          el("text", { x: X(19.93), y: H - Bm - 6, text: "t ≈ 19.93", "font-size": 12, cls: "mono", fill: C.ok, "text-anchor": "middle", "font-weight": 700 }, g);
          el("circle", { cx: X(19), cy: Y(f(19)), r: 4, fill: C.bad }, g); el("text", { x: X(19) - 8, y: Y(f(19)) + 16, text: "19h：40,300 ✗", "font-size": 10.5, cls: "mono", fill: C.bad, "text-anchor": "end" }, g);
          el("circle", { cx: X(20), cy: Y(f(20)), r: 4, fill: C.ok }, g); el("text", { x: X(20) + 10, y: Y(f(20)) + 16, text: "20h：50,800 ✓", "font-size": 10.5, cls: "mono", fill: C.ok }, g);
          tag(c.svg, L + 10, 88, "t = 3 × 6.64 ≈ 19.93  ⇒  至少 20 小時", { fill: C.ok, "font-size": 13, "font-weight": 700 });
        }
      }
    }
  });

  /* ---------- 第 17 題：內積＝投影，圓上最長投影 ---------- */
  define("q17", {
    w: 640, h: 400,
    steps: [
      { title: "把 3x + 4y 看成內積", text: "3x + 4y = (3, 4)·(x, y)。點 (x, y) 在半徑 2 的圓上，(3, 4) 是一個固定向量，長度 5。" },
      { title: "內積 = |u| × 投影長", text: "讓 P 繞著圓走，看 OP 在 u = (3,4) 方向上的影子。3x + 4y 永遠等於 5 × 影長。" },
      { title: "影子最長 = 半徑", text: "OP 與 u 同向時影長最大，就是半徑 2，所以最大值 = 5 × 2 = 10，在 P = (6/5, 8/5) 達到。" },
      { title: "另一個角度：直線平移到相切", text: "3x + 4y = k 是一族平行線，k 越大越往右上。能碰到圓的最大 k，就是相切的那一條：|k| / 5 = 2，k = 10。" }
    ],
    draw(c) {
      const pl = plane(c.svg, { w: c.W, h: c.H, x0: -3.6, x1: 4.4, y0: -2.8, y1: 4.2, square: true, pad: { l: 10, r: 10, t: 10, b: 10 } });
      grid(pl, 1, { opacity: 0.6 }); axes(pl, { xStep: 1, yStep: 1 });
      const p0 = c.P(0), p1 = c.P(1), p2 = c.P(2), p3 = c.P(3);
      circle(pl, 0, 0, 2 * p0, { stroke: C.c1, "stroke-width": 2.4 });
      const u = [3, 4], uh = [0.6, 0.8];
      arrow(pl, 0, 0, u[0] * 0.8, u[1] * 0.8, p0, { stroke: C.c2, "stroke-width": 2.8 });
      label(pl, 2.4, 3.2, "u = (3, 4)，|u| = 5", { dx: 40, dy: 14, fill: C.c2, cls: "math", "font-size": 13, opacity: p0 });
      // u 方向的延長線
      seg(pl, -2.4, -3.2, 3.2, 4.27, p0, { stroke: C.c2, "stroke-width": 1, "stroke-dasharray": "4 4", opacity: 0.6 });
      if (p1 > 0 || p2 > 0) {
        let th;
        if (c.k === 1) th = lerp(-0.6, 2 * PI - 0.6, p1);
        else if (c.k === 2) th = lerp(2 * PI - 0.6, 2 * PI + Math.atan2(4, 3), p2);
        else th = Math.atan2(4, 3);
        const P = [2 * Math.cos(th), 2 * Math.sin(th)];
        const proj = P[0] * uh[0] + P[1] * uh[1]; const F = [uh[0] * proj, uh[1] * proj];
        seg(pl, P[0], P[1], F[0], F[1], 1, { stroke: C.c4, "stroke-dasharray": "5 3", "stroke-width": 1.5 });
        seg(pl, 0, 0, F[0], F[1], 1, { stroke: C.c3, "stroke-width": 6, "stroke-linecap": "butt" });
        arrow(pl, 0, 0, P[0], P[1], 1, { stroke: C.c1, "stroke-width": 2.4 });
        dot(pl, P[0], P[1], { fill: C.c1, r: 6 }); label(pl, P[0], P[1], "P", { dx: 12, dy: -6, fill: C.c1, cls: "math", "font-size": 14 });
        const val = 3 * P[0] + 4 * P[1];
        tag(c.svg, 12, 22, `影長 = ${fmt(proj, 2)}`, { fill: C.c3, cls: "mono", "font-size": 12.5 });
        tag(c.svg, 12, 46, `3x + 4y = 5 × ${fmt(proj, 2)} = ${fmt(val, 2)}`, { fill: val > 9.95 ? C.ok : C.ink, cls: "mono", "font-size": 13, "font-weight": val > 9.95 ? 700 : 400 });
        if (c.k >= 2 && p2 >= 1) { label(pl, P[0], P[1], "(6/5, 8/5)", { dx: 44, dy: 12, fill: C.ok, cls: "mono", "font-size": 12 }); tag(c.svg, 12, 70, "最大值 = 5 × 2 = 10", { fill: C.ok, "font-size": 14, "font-weight": 700 }); }
      }
      if (p3 > 0) {
        const k = lerp(-6, 10, p3);
        curve(pl, (x) => (k - 3 * x) / 4, -3.6, 4.4, 1, { stroke: C.c5, "stroke-width": 2 });
        label(pl, 3.6, (k - 3 * 3.6) / 4, `3x + 4y = ${fmt(k, 1)}`, { dy: -10, dx: -20, fill: C.c5, cls: "mono", "font-size": 12 });
        if (p3 >= 1) { dot(pl, 1.2, 1.6, { fill: C.ok, r: 6 }); tag(c.svg, c.W - 12, 22, "相切：|k| / 5 = 2  ⇒  k = 10", { anchor: "end", fill: C.ok, "font-weight": 700, "font-size": 13 }); }
      }
    }
  });

  /* ---------- 第 18～20 題：等比成長取對數變直線 ---------- */
  const LF_X = [0, 1, 2, 3, 4], LF_Y = [8, 13, 20, 32, 50], LF_LY = [0.90, 1.11, 1.30, 1.51, 1.70];
  const LF_STEPS = [
    { title: "營收逐年往上彎", text: "把 (x, y) 點出來：8、13、20、32、50。每年大約乘 1.6 倍，所以不是直線，是往上彎的曲線——這是等比（指數）成長的長相。" },
    { title: "取對數：乘法變加法", text: "把縱軸換成 Y = log y。「每年乘固定倍率」變成「每年加固定的數」，五個點幾乎排成一直線。相關係數 0.9999 就是在說這件事。" },
    { title: "配迴歸直線", text: "斜率 b = Σ(x−x̄)(Y−Ȳ) / Σ(x−x̄)² = 2.00 / 10 = 0.2；直線一定通過 (x̄, Ȳ) = (2, 1.30)，所以截距 = 1.30 − 0.2×2 = 0.90。Y = 0.2x + 0.90。" },
    { title: "外推到 2027 年再還原", text: "x = 6 時 Y = 2.1。這是對數值，要還原：y = 10^2.1 = 100 × 10^0.1 ≈ 126（百萬元）。" },
    { title: "斜率 0.2 的真正意思", text: "Y 每年加 0.2，等於 y 每年乘 10^0.2 ≈ 1.58。所以「年成長率約 58%」——斜率不是「每年多 0.2」，而是「每年乘 1.58」。" }
  ];
  function logfit(id, use) {
    define(id, {
      w: 640, h: 400,
      steps: use.map(i => LF_STEPS[i]),
      draw(c) {
        const G = (gid) => { const j = use.indexOf(gid); return j < 0 ? 0 : c.P(j); };
        const p0 = G(0), p1 = G(1), p2 = G(2), p3 = G(3), p4 = G(4);
        const W = c.W, H = c.H, L = 52, Rr = 60, T = 22, Bm = 36;
        const X = (x) => L + ((x + 0.5) / 7.2) * (W - L - Rr);
        const yLin = (y) => T + (1 - y / 60) * (H - T - Bm);
        const yLog = (Y) => T + (1 - (Y - 0.6) / (2.3 - 0.6)) * (H - T - Bm);
        const m = p1;
        const Ypos = (y, Y) => lerp(yLin(y), yLog(Y), m);
        const g = el("g", null, c.svg);
        // 軸與刻度
        [10, 20, 30, 40, 50].forEach(v => { el("line", { x1: L, y1: Ypos(v, 0), x2: W - Rr, y2: Ypos(v, 0), stroke: C.grid, opacity: 1 - m }, g); el("text", { x: L - 6, y: yLin(v) + 4, text: String(v), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: 1 - m }, g); });
        if (m > 0) [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2].forEach(v => { el("line", { x1: L, y1: yLog(v), x2: W - Rr, y2: yLog(v), stroke: C.grid, opacity: m }, g); el("text", { x: L - 6, y: yLog(v) + 4, text: fmt(v, 1), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "end", opacity: m }, g); el("text", { x: W - Rr + 6, y: yLog(v) + 4, text: "y≈" + fmt(Math.pow(10, v), 0), "font-size": 10, cls: "mono", fill: C.ink3, opacity: m * 0.9 }, g); });
        el("line", { x1: L, y1: T, x2: L, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
        el("line", { x1: L, y1: H - Bm, x2: W - Rr, y2: H - Bm, stroke: C.axis, "stroke-width": 1.4 }, g);
        for (let x = 0; x <= 6; x++) { el("line", { x1: X(x), y1: H - Bm - 3, x2: X(x), y2: H - Bm + 3, stroke: C.axis }, g); el("text", { x: X(x), y: H - Bm + 15, text: String(x), "font-size": 10.5, cls: "mono", fill: C.ink3, "text-anchor": "middle" }, g); el("text", { x: X(x), y: H - Bm + 28, text: String(2021 + x), "font-size": 9.5, fill: C.ink3, "text-anchor": "middle" }, g); }
        el("text", { x: L + 6, y: T - 8, text: m > 0.5 ? "Y = log y" : "y（百萬元）", "font-size": 12, fill: C.ink2, cls: "math" }, g);
        // 資料點
        LF_X.forEach((x, i) => {
          const q = sub(p0, i / 6, (i + 2) / 6); if (q <= 0) return;
          el("circle", { cx: X(x), cy: Ypos(LF_Y[i], LF_LY[i]), r: 6, fill: C.c1, stroke: C.surface, "stroke-width": 1.5, opacity: q }, g);
          el("text", { x: X(x), y: Ypos(LF_Y[i], LF_LY[i]) - 11, text: m > 0.5 ? fmt(LF_LY[i], 2) : String(LF_Y[i]), "font-size": 11, cls: "mono", fill: C.c1, "text-anchor": "middle", opacity: q }, g);
        });
        // 倍率箭頭（步驟 4）
        if (p4 > 0) LF_X.slice(0, 4).forEach((x, i) => {
          const q = sub(p4, i / 5, (i + 2) / 5); if (q <= 0) return;
          const y1 = Ypos(LF_Y[i], LF_LY[i]), y2 = Ypos(LF_Y[i + 1], LF_LY[i + 1]);
          el("path", { d: `M${X(x) + 8} ${y1} L${X(x + 1) - 8} ${y2}`, stroke: C.c4, "stroke-width": 2, fill: "none", opacity: q }, g);
          el("text", { x: (X(x) + X(x + 1)) / 2 + 6, y: (y1 + y2) / 2 + 16, text: m > 0.5 ? "+0.2" : "×1.58", "font-size": 11.5, cls: "mono", fill: C.c4, "text-anchor": "middle", opacity: q, "font-weight": 600 }, g);
        });
        // 迴歸直線
        if (p2 > 0) {
          const line = (x) => 0.2 * x + 0.9;
          const x0 = -0.3, x1 = lerp(-0.3, p3 > 0 ? 6.4 : 4.6, p2);
          el("line", { x1: X(x0), y1: yLog(line(x0)), x2: X(x1), y2: yLog(line(x1)), stroke: C.c2, "stroke-width": 2.4, opacity: m }, g);
          el("circle", { cx: X(2), cy: yLog(1.3), r: 5, fill: "none", stroke: C.c2, "stroke-width": 2, opacity: p2 }, g);
          el("text", { x: X(2) + 10, y: yLog(1.3) + 16, text: "(x̄, Ȳ) = (2, 1.30)", "font-size": 11.5, cls: "mono", fill: C.c2, opacity: p2 }, g);
          // 斜率三角形
          if (p2 >= 1) { el("path", { d: `M${X(3)} ${yLog(line(3))} L${X(4)} ${yLog(line(3))} L${X(4)} ${yLog(line(4))}`, fill: "none", stroke: C.c2, "stroke-width": 1.4, "stroke-dasharray": "3 3" }, g); el("text", { x: X(4) + 6, y: (yLog(line(3)) + yLog(line(4))) / 2 + 4, text: "0.2", "font-size": 11, cls: "mono", fill: C.c2 }, g); el("text", { x: X(3.5), y: yLog(line(3)) + 13, text: "1", "font-size": 11, cls: "mono", fill: C.c2, "text-anchor": "middle" }, g); }
          tag(c.svg, L + 12, 44, "b = 2.00 / 10 = 0.2，a = 1.30 − 0.2×2 = 0.90", { fill: C.c2, cls: "mono", "font-size": 12, opacity: p2 });
          tag(c.svg, L + 12, 68, "Y = 0.2x + 0.90", { fill: C.c2, "font-size": 13.5, "font-weight": 700, opacity: p2 });
        }
        if (p3 > 0) {
          el("line", { x1: X(6), y1: H - Bm, x2: X(6), y2: lerp(H - Bm, yLog(2.1), p3), stroke: C.ok, "stroke-width": 2, "stroke-dasharray": "5 3" }, g);
          if (p3 >= 1) { el("circle", { cx: X(6), cy: yLog(2.1), r: 6.5, fill: C.ok }, g); el("text", { x: X(6) + 10, y: yLog(2.1) + 4, text: "Y = 2.1", "font-size": 12, cls: "mono", fill: C.ok, "font-weight": 700 }, g); }
          tag(c.svg, L + 12, 92, "x = 6：Y = 0.2×6 + 0.90 = 2.1", { fill: C.ok, cls: "mono", "font-size": 12, opacity: p3 });
          tag(c.svg, L + 12, 116, "y = 10^2.1 = 100 × 1.26 ≈ 126", { fill: C.ok, "font-size": 13.5, "font-weight": 700, opacity: p3 });
        }
        if (p4 > 0) {
          tag(c.svg, L + 12, 92, "每年 Y 加 0.2  ⇔  每年 y 乘 10^0.2 ≈ 1.58", { fill: C.c4, "font-size": 12.5, opacity: p4 });
          tag(c.svg, L + 12, 116, "年成長率 ≈ 58%", { fill: C.ok, "font-size": 14, "font-weight": 700, opacity: p4 });
        }
      }
    });
  }
  logfit("q18", [0, 1, 2]);
  logfit("q19", [0, 1, 2, 3]);
  logfit("q20", [0, 1, 2, 4]);
})(window.ANIM);
