// 學測數A預測題庫 —— 產生器共用工具：亂數、分數與數學排版字串、ISO 週次。

/* ---------- 亂數（mulberry32，種子來自字串）---------- */
export function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^ (h >>> 16)) >>> 0;
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rng = {
    float: next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; },
    sub: (label) => makeRng(seedStr + "/" + label)
  };
  return rng;
}

/* ---------- 數論與分數 ---------- */
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
export function reduce(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; }
/** 分數的 TeX：整數就寫整數，否則 \frac{}{}；負號放在最前面 */
export function fracTex(n, d = 1, opt = {}) {
  [n, d] = reduce(n, d);
  if (d === 1) return String(n);
  const s = n < 0 ? "-" : ""; const f = `\\frac{${Math.abs(n)}}{${d}}`;
  return s + f;
}
/** 分數的純文字（動畫與 PDF 標題用）：7/2、-1/3 */
export function fracText(n, d = 1) { [n, d] = reduce(n, d); return d === 1 ? String(n) : `${n}/${d}`; }
/** 化簡根號：sqrtTex(50) → 5\sqrt{2}，sqrtTex(49) → 7 */
export function simplifySqrt(n) { let k = 1, m = n; for (let p = 2; p * p <= m; p++) { while (m % (p * p) === 0) { m /= p * p; k *= p; } } return [k, m]; }
export function sqrtTex(n) { const [k, m] = simplifySqrt(n); if (m === 1) return String(k); return (k === 1 ? "" : String(k)) + `\\sqrt{${m}}`; }
export function sqrtText(n) { const [k, m] = simplifySqrt(n); if (m === 1) return String(k); return (k === 1 ? "" : String(k)) + `√${m}`; }
/** 帶號整數："+3"、"-3"；0 回傳 "" */
export const signed = (n) => (n === 0 ? "" : n > 0 ? `+${n}` : `${n}`);
/** 一次式 mx+n 的 TeX（m、n 整數） */
export function linTex(m, n, v = "x") {
  let s = "";
  if (m !== 0) s += (m === 1 ? "" : m === -1 ? "-" : String(m)) + v;
  if (n !== 0) s += s ? (n > 0 ? `+${n}` : `${n}`) : String(n);
  return s || "0";
}
/** 多項式 TeX：coefs 由最高次到常數，如 [1,-3,0,1] → x^3-3x+1 */
export function polyTex(coefs, v = "x") {
  const deg = coefs.length - 1; let s = "";
  coefs.forEach((c, i) => {
    if (c === 0) return; const p = deg - i;
    let term = "";
    const ac = Math.abs(c);
    if (p === 0) term = String(ac); else term = (ac === 1 ? "" : String(ac)) + v + (p === 1 ? "" : `^{${p}}`);
    if (!s) s = (c < 0 ? "-" : "") + term; else s += (c < 0 ? "-" : "+") + term;
  });
  return s || "0";
}
/** 多項式相乘 */
export function polyMul(a, b) { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; }
export function polyAdd(a, b) { const n = Math.max(a.length, b.length); const r = new Array(n).fill(0); a.forEach((x, i) => { r[n - a.length + i] += x; }); b.forEach((x, i) => { r[n - b.length + i] += x; }); return r; }
export function polyEval(c, x) { return c.reduce((s, k) => s * x + k, 0); }
/** π 的有理倍數：piFrac(5,12) → \frac{5\pi}{12}；piFrac(1,1) → \pi；piFrac(0,1) → 0 */
export function piFrac(n, d) {
  [n, d] = reduce(n, d);
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : ""; n = Math.abs(n);
  if (d === 1) return sign + (n === 1 ? "\\pi" : `${n}\\pi`);
  return sign + `\\frac{${n === 1 ? "" : n}\\pi}{${d}}`;
}
export function piText(n, d) {
  [n, d] = reduce(n, d);
  if (n === 0) return "0";
  const sign = n < 0 ? "−" : ""; n = Math.abs(n);
  if (d === 1) return sign + (n === 1 ? "π" : `${n}π`);
  return sign + `${n === 1 ? "" : n}π/${d}`;
}
/** 座標 TeX：(a,b) 用分數 */
export const ptTex = (...xs) => "(" + xs.map(x => (Array.isArray(x) ? fracTex(x[0], x[1]) : String(x))).join(",\\ ") + ")";
/** 數值格式化 */
export function fmt(n, d = 2) { const s = Number(n).toFixed(d); return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(/^-0$/, "0"); }
export const isSquare = (n) => { const r = Math.round(Math.sqrt(n)); return r * r === n; };

/* ---------- 選項工具 ---------- */
/** 從正解與干擾項組出 5 個相異選項；回傳 { options, answer }（answer 為 1～5） */
export function makeOptions(rng, correct, distractors, format = (v) => String(v), key = (v) => String(v)) {
  const seen = new Set([key(correct)]); const picked = [];
  for (const d of distractors) { if (d == null) continue; const k = key(d); if (seen.has(k)) continue; seen.add(k); picked.push(d); if (picked.length === 4) break; }
  // 干擾項不夠時，用正解 ±1、±2… 補齊（僅限數值）
  let delta = 1;
  while (picked.length < 4 && typeof correct === "number" && delta < 50) {
    for (const cand of [correct + delta, correct - delta]) { const k = key(cand); if (!seen.has(k) && picked.length < 4) { seen.add(k); picked.push(cand); } }
    delta++;
  }
  if (picked.length < 4) throw new Error("干擾項不足");
  const all = rng.shuffle([correct, ...picked]);
  // 數值選項依大小排序較像學測（單選常遞增）
  if (all.every(v => typeof v === "number")) all.sort((a, b) => a - b);
  return { options: all.map(format), answer: all.findIndex(v => key(v) === key(correct)) + 1 };
}
/** 多選：從敘述池挑 5 個，保證至少 2 真 1 假；pool 元素 {text, ok} */
export function makeMulti(rng, pool, sel) {
  for (let tries = 0; tries < 50; tries++) {
    const chosen = sel ? sel.map(i => pool[i]) : rng.shuffle(pool).slice(0, 5);
    const t = chosen.filter(s => s.ok).length;
    if (t >= 2 && t <= 4) {
      const answer = chosen.map((s, i) => (s.ok ? i + 1 : 0)).filter(Boolean);
      return { options: chosen.map(s => s.text), answer, explain: chosen.map(s => s.why) };
    }
  }
  throw new Error("無法組出符合條件的多選題");
}

/* ---------- ISO 週次（以台北時間為準）---------- */
export function taipeiDate(d = new Date()) { const t = new Date(d.getTime() + 8 * 3600 * 1000); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
export function isoWeek(dateUtcMidnight) {
  const d = new Date(dateUtcMidnight.getTime());
  const day = (d.getUTCDay() + 6) % 7; // 週一 = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // 該週的週四
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}
export function weekId(dateUtcMidnight) { const { year, week } = isoWeek(dateUtcMidnight); return `${year}-W${String(week).padStart(2, "0")}`; }
/** 週次 → 週一與週日的日期（YYYY-MM-DD） */
export function weekRange(id) {
  const m = /^(\d{4})-W(\d{2})$/.exec(id); if (!m) throw new Error("週次格式錯誤：" + id);
  const year = +m[1], week = +m[2];
  const jan4 = new Date(Date.UTC(year, 0, 4)); const day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4.getTime() - day * 86400000 + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const f = (d) => d.toISOString().slice(0, 10);
  return { from: f(monday), to: f(sunday) };
}
export function nextWeekId(id) { const { to } = weekRange(id); const d = new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return weekId(d); }
export const compareWeek = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
