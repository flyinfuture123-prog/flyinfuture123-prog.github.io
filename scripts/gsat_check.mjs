#!/usr/bin/env node
/* 學測數A預測題庫的離線自我檢查。
 *
 * 不開瀏覽器，直接在 Node 裡載入 questions.js / anim.js / app.js 的資料層：
 *   1. 題目資料結構完整（題號連續、配分合計 100、答案格式正確、動畫都有對應）。
 *   2. 用一個極簡的假 DOM 把 20 段動畫在多個時間點各畫一次，抓出執行期錯誤。
 *   3. 數學排版語法：$ 成對、\frac 等指令括號成對。
 * 用法：node scripts/gsat_check.mjs [site-dir]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dir = process.argv[2] || "matha-c4f9fd6edf213a5b";
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const errors = [];
const fail = (msg) => errors.push(msg);

/* ---------- 假 DOM ---------- */
class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.textContent = ""; this.style = {}; this.className = ""; this.innerHTML = ""; }
  setAttribute(k, v) { if (typeof v === "string" && /NaN|undefined/.test(v)) fail(`屬性含 NaN/undefined：<${this.tag} ${k}="${v}">`); this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  get firstChild() { return this.children[0] || null; }
  addEventListener() {}
  querySelector() { return new FakeNode("div"); }
  querySelectorAll() { return []; }
}
const documentStub = {
  createElementNS: (ns, tag) => new FakeNode(tag),
  createElement: (tag) => new FakeNode(tag)
};
const windowStub = { matchMedia: () => ({ matches: false }), document: documentStub };
const ctx = { window: windowStub, document: documentStub, console, Math, Number, String, Array, Object, isFinite, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
vm.createContext(ctx);
vm.runInContext(read("questions.js"), ctx, { filename: "questions.js" });
vm.runInContext(read("anim.js"), ctx, { filename: "anim.js" });
const D = windowStub.GSAT, A = windowStub.ANIM;

/* ---------- 題目資料 ---------- */
const qs = D.questions;
const nos = qs.map(q => q.no);
if (nos.join(",") !== Array.from({ length: qs.length }, (_, i) => i + 1).join(",")) fail("題號不連續：" + nos.join(","));
const total = qs.reduce((s, q) => s + q.points, 0);
if (total !== 100) fail("配分合計應為 100，實際 " + total);
const kinds = { single: 0, multi: 0, fill: 0, open: 0 };
const checkTex = (s, where) => {
  if (typeof s !== "string") return;
  const dollars = (s.match(/\$/g) || []).length; if (dollars % 2) fail(`${where}：$ 數量為奇數`);
  let depth = 0; for (const ch of s) { if (ch === "{") depth++; else if (ch === "}") depth--; if (depth < 0) break; } if (depth !== 0) fail(`${where}：大括號不成對`);
  if (/[一-鿿]/.test(s) && /[一-鿿]/.test(s) && /[们后来说对为个这时会发过还样现开关门问间无书长东车电语]/.test(s)) fail(`${where}：疑似簡體字`);
};
for (const q of qs) {
  const w = `第 ${q.no} 題`;
  kinds[q.kind] = (kinds[q.kind] || 0) + 1;
  for (const f of ["vol", "unit", "topic", "stem", "core", "why", "answerText", "anim"]) if (!q[f]) fail(`${w}：缺少欄位 ${f}`);
  if (!Array.isArray(q.solution) || !q.solution.length) fail(`${w}：缺少 solution`);
  if (!A.registry[q.anim]) fail(`${w}：找不到動畫 ${q.anim}`);
  if (![1, 2, 3, 4, 5].includes(q.diff)) fail(`${w}：diff 應為 1～5`);
  if (q.kind === "single") { if (!Array.isArray(q.options) || q.options.length !== 5) fail(`${w}：單選需 5 個選項`); if (!(q.answer >= 1 && q.answer <= 5)) fail(`${w}：單選答案不合法`); }
  else if (q.kind === "multi") { if (!Array.isArray(q.options) || q.options.length !== 5) fail(`${w}：多選需 5 個選項`); if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(a => a < 1 || a > 5)) fail(`${w}：多選答案不合法`); }
  else if (q.kind === "fill") { if (!Array.isArray(q.blanks) || !q.blanks.length) fail(`${w}：選填缺 blanks`); else q.blanks.forEach(b => { if (!/^-?\d$/.test(String(b.ans))) fail(`${w}：空格 ${b.label} 的答案應為單一數字（可含負號）`); if (!q.stem.includes(`\\b{${b.label}}`)) fail(`${w}：題幹缺少空格 \\b{${b.label}}`); }); }
  else if (q.kind === "open") { if (!Array.isArray(q.rubric) || !q.rubric.length) fail(`${w}：非選缺 rubric`); }
  else fail(`${w}：未知題型 ${q.kind}`);
  if (q.group && !D.groups[q.group]) fail(`${w}：找不到題組 ${q.group}`);
  [q.stem, q.core, q.why, ...(q.options || []), ...(q.solution || []), ...(q.rubric || [])].forEach((s, i) => checkTex(s, `${w} 文字 #${i}`));
  if (!D.units.some(u => u.qs.includes(q.no))) fail(`${w}：沒有出現在任何考點單元的 qs 中`);
}
for (const u of D.units) for (const n of u.qs) if (!qs.find(q => q.no === n)) fail(`單元「${u.name}」引用不存在的題號 ${n}`);
if (kinds.single !== 6 || kinds.multi !== 6 || kinds.fill !== 7 || kinds.open !== 1) fail(`題型數量不符（單選 ${kinds.single}／多選 ${kinds.multi}／選填 ${kinds.fill}／非選 ${kinds.open}）`);
// 選填空格編號不重複
const labels = qs.filter(q => q.kind === "fill").flatMap(q => q.blanks.map(b => b.label));
if (new Set(labels).size !== labels.length) fail("選填空格編號重複：" + labels.join(","));

/* ---------- 動畫煙霧測試 ---------- */
let frames = 0;
for (const id of Object.keys(A.registry)) {
  const spec = A.registry[id];
  if (!spec.steps || !spec.steps.length) { fail(`動畫 ${id}：沒有步驟`); continue; }
  spec.steps.forEach((s, i) => { if (!s.title || !s.text) fail(`動畫 ${id} 第 ${i + 1} 步缺 title/text`); });
  for (let k = 0; k < spec.steps.length; k++) for (const t of [0, 0.01, 0.37, 0.5, 0.82, 1]) {
    const svg = new FakeNode("svg");
    const c = { svg, W: spec.w, H: spec.h, k, t, step: k, P: (i) => (k > i ? 1 : k === i ? A.ease(t) : 0), R: (i) => (k > i ? 1 : k === i ? t : 0) };
    try { spec.draw(c); frames++; } catch (e) { fail(`動畫 ${id} 在步驟 ${k} t=${t} 拋出例外：${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e}`); break; }
    if (!svg.children.length) fail(`動畫 ${id} 在步驟 ${k} t=${t} 沒畫任何東西`);
  }
}

/* ---------- 結果 ---------- */
if (errors.length) { console.error(`✗ 檢查失敗（${errors.length} 項）：`); errors.slice(0, 40).forEach(e => console.error("  - " + e)); process.exit(1); }
console.log(`✓ 題目 ${qs.length} 題、配分 ${total}、動畫 ${Object.keys(A.registry).length} 段、繪製 ${frames} 個影格皆正常`);
