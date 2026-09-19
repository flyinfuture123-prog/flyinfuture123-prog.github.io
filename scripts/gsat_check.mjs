#!/usr/bin/env node
/* 學測數A預測題庫的離線自我檢查。
 *
 * 不開瀏覽器，直接在 Node 裡：
 *   1. 驗證站上的 questions.js / archive.js：題號連續、配分合計 100、答案格式、空格編號、每題都有動畫、封存檔與 PDF 都存在。
 *   2. 用題型模板另外組出多個週次的卷子（含第 1 回的固定參數），逐一做同樣的結構檢查，確認產生器對各種參數都穩定。
 *   3. 用一個極簡的假 DOM，把每一題的動畫（帶該題參數）在多個時間點各畫一次，抓出執行期錯誤。
 * 用法：node scripts/gsat_check.mjs [site-dir] [--weeks N]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildPaper, WEEK1, parseJsObject } from "./gsat/paper.mjs";
import { nextWeekId } from "./gsat/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wi = args.indexOf("--weeks");
const nWeeks = wi >= 0 ? (Number(args[wi + 1]) || 10) : 10;
const positional = args.filter((a, i) => !a.startsWith("--") && i !== wi + 1);
const dir = path.resolve(ROOT, positional[0] || "matha-c4f9fd6edf213a5b");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const errors = [];
const fail = (msg) => errors.push(msg);

/* ---------- 假 DOM ---------- */
class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.textContent = ""; this.style = {}; this.className = ""; this.innerHTML = ""; }
  setAttribute(k, v) { if (typeof v === "string" && /NaN|undefined|Infinity/.test(v)) fail(`屬性含 NaN/undefined/Infinity：<${this.tag} ${k}="${v.slice(0, 60)}">`); this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  get firstChild() { return this.children[0] || null; }
  addEventListener() {}
  querySelector() { return new FakeNode("div"); }
  querySelectorAll() { return []; }
}
const documentStub = { createElementNS: (ns, tag) => new FakeNode(tag), createElement: (tag) => new FakeNode(tag) };
const windowStub = { matchMedia: () => ({ matches: false }), document: documentStub };
const ctx = { window: windowStub, document: documentStub, console, Math, Number, String, Array, Object, isFinite, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
vm.createContext(ctx);
vm.runInContext(read("anim.js"), ctx, { filename: "anim.js" });
vm.runInContext(read("math.js"), ctx, { filename: "math.js" });
const A = windowStub.ANIM, MATH = windowStub.GSATMath;

/* ---------- 單份卷子的結構檢查 ---------- */
const checkTex = (s, where) => {
  if (typeof s !== "string") return;
  const dollars = (s.match(/\$/g) || []).length; if (dollars % 2) fail(`${where}：$ 數量為奇數`);
  let depth = 0; for (const ch of s) { if (ch === "{") depth++; else if (ch === "}") depth--; if (depth < 0) break; } if (depth !== 0) fail(`${where}：大括號不成對`);
  if (/[们后来说对为个这时会发过还样现开关门问间无书长东车电语]/.test(s)) fail(`${where}：疑似簡體字`);
  const html = MATH.M(s); if (/\\[a-zA-Z]+/.test(html.replace(/<[^>]+>/g, ""))) fail(`${where}：有排版器不認得的指令 → ${html.replace(/<[^>]+>/g, "").match(/\\[a-zA-Z]+/)[0]}`);
};
function checkPaper(D, tagName) {
  const qs = D.questions; const w = (q) => `${tagName} 第 ${q.no} 題`;
  const nos = qs.map(q => q.no);
  if (nos.join(",") !== Array.from({ length: qs.length }, (_, i) => i + 1).join(",")) fail(`${tagName}：題號不連續：` + nos.join(","));
  const total = qs.reduce((s, q) => s + q.points, 0); if (total !== 100) fail(`${tagName}：配分合計應為 100，實際 ${total}`);
  if (!D.meta || !/^\d{4}-W\d{2}$/.test(D.meta.week) || !(D.meta.round >= 1)) fail(`${tagName}：meta 缺 week/round`);
  const kinds = { single: 0, multi: 0, fill: 0, open: 0 };
  for (const q of qs) {
    kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    for (const f of ["vol", "unit", "topic", "stem", "core", "why", "answerText", "anim", "params"]) if (!q[f]) fail(`${w(q)}：缺少欄位 ${f}`);
    if (!Array.isArray(q.solution) || !q.solution.length) fail(`${w(q)}：缺少 solution`);
    if (!A.registry[q.anim]) fail(`${w(q)}：找不到動畫 ${q.anim}`);
    if (![1, 2, 3, 4, 5].includes(q.diff)) fail(`${w(q)}：diff 應為 1～5`);
    if (q.kind === "single") { if (!Array.isArray(q.options) || q.options.length !== 5) fail(`${w(q)}：單選需 5 個選項`); if (!(q.answer >= 1 && q.answer <= 5)) fail(`${w(q)}：單選答案不合法`); if (new Set(q.options).size !== 5) fail(`${w(q)}：單選選項重複`); }
    else if (q.kind === "multi") { if (!Array.isArray(q.options) || q.options.length !== 5) fail(`${w(q)}：多選需 5 個選項`); if (!Array.isArray(q.answer) || q.answer.length < 2 || q.answer.length > 4 || q.answer.some(a => a < 1 || a > 5)) fail(`${w(q)}：多選答案應有 2～4 個`); if (new Set(q.options).size !== 5) fail(`${w(q)}：多選選項重複`); }
    else if (q.kind === "fill") { if (!Array.isArray(q.blanks) || !q.blanks.length) fail(`${w(q)}：選填缺 blanks`); else q.blanks.forEach(b => { if (!/^-?\d$/.test(String(b.ans)) && String(b.ans) !== "-") fail(`${w(q)}：空格 ${b.label} 的答案應為單一數字或負號`); if (!q.stem.includes(`\\b{${b.label}}`)) fail(`${w(q)}：題幹缺少空格 \\b{${b.label}}`); }); }
    else if (q.kind === "open") { if (!Array.isArray(q.rubric) || !q.rubric.length) fail(`${w(q)}：非選缺 rubric`); }
    else fail(`${w(q)}：未知題型 ${q.kind}`);
    if (q.group && !D.groups[q.group]) fail(`${w(q)}：找不到題組 ${q.group}`);
    [q.stem, q.core, q.why, ...(q.options || []), ...(q.solution || []), ...(q.rubric || [])].forEach((s, i) => checkTex(s, `${w(q)} 文字 #${i}`));
    if (!D.units.some(u => u.qs.includes(q.no))) fail(`${w(q)}：沒有出現在任何考點單元的 qs 中`);
  }
  Object.values(D.groups || {}).forEach(g => checkTex(g.context, `${tagName} 題組`));
  for (const u of D.units) for (const n of u.qs) if (!qs.find(q => q.no === n)) fail(`${tagName}：單元「${u.name}」引用不存在的題號 ${n}`);
  if (kinds.single !== 6 || kinds.multi !== 6 || kinds.fill !== 7 || kinds.open !== 1) fail(`${tagName}：題型數量不符（單選 ${kinds.single}／多選 ${kinds.multi}／選填 ${kinds.fill}／非選 ${kinds.open}）`);
  const labels = qs.filter(q => q.kind === "fill").flatMap(q => q.blanks.map(b => b.label));
  if (new Set(labels).size !== labels.length) fail(`${tagName}：選填空格編號重複`);
  if (labels.length && labels[0] !== 13) fail(`${tagName}：選填空格應從 ⑬ 開始`);
  /* 動畫煙霧測試（帶該題參數） */
  let frames = 0;
  for (const q of qs) {
    const spec = A.registry[q.anim]; if (!spec) continue;
    const p = Object.assign({}, spec.defaults || {}, q.params || {});
    let steps; try { steps = typeof spec.steps === "function" ? spec.steps(p) : spec.steps; } catch (e) { fail(`${w(q)} 動畫 steps() 拋出例外：${e.message}`); continue; }
    if (!steps || !steps.length) { fail(`${w(q)} 動畫沒有步驟`); continue; }
    steps.forEach((s, i) => { if (!s.title || !s.text) fail(`${w(q)} 動畫第 ${i + 1} 步缺 title/text`); if (/NaN|undefined/.test(s.title + s.text)) fail(`${w(q)} 動畫第 ${i + 1} 步文字含 NaN/undefined`); });
    for (let k = 0; k < steps.length; k++) for (const t of [0, 0.01, 0.37, 0.5, 0.82, 1]) {
      const svg = new FakeNode("svg");
      const c = { svg, W: spec.w, H: spec.h, k, t, step: k, p, steps, P: (i) => (k > i ? 1 : k === i ? A.ease(t) : 0), R: (i) => (k > i ? 1 : k === i ? t : 0) };
      try { spec.draw(c); frames++; } catch (e) { fail(`${w(q)} 動畫 ${q.anim} 在步驟 ${k} t=${t} 拋出例外：${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e}`); break; }
      if (!svg.children.length) fail(`${w(q)} 動畫在步驟 ${k} t=${t} 沒畫任何東西`);
    }
  }
  return frames;
}

/* ---------- 1. 站上的檔案 ---------- */
const live = parseJsObject(read("questions.js"), "window.GSAT");
let frames = checkPaper(live, `上線卷 ${live.meta.week}`);
const archive = fs.existsSync(path.join(dir, "archive.js")) ? parseJsObject(read("archive.js"), "window.GSAT_ARCHIVE") : [];
for (const e of archive) {
  for (const f of [e.file, e.pdf && e.pdf.student, e.pdf && e.pdf.teacher]) if (!f || !fs.existsSync(path.join(dir, f))) fail(`封存 ${e.week}：缺少檔案 ${f}`);
  if (e.file && fs.existsSync(path.join(dir, e.file))) {
    const src = read(e.file); const m = /window\.GSAT_PAPERS\["([^"]+)"\]\s*=\s*([\s\S]*);\s*$/.exec(src);
    if (!m || m[1] !== e.week) fail(`封存 ${e.week}：檔案內容的週次不符`);
    else { try { const P = JSON.parse(m[2]); if (P.meta.week !== e.week || P.meta.round !== e.round) fail(`封存 ${e.week}：meta 與索引不一致`); frames += checkPaper(P, `封存卷 ${e.week}`); } catch (err) { fail(`封存 ${e.week}：無法解析（${err.message}）`); } }
  }
  if (e.pdf) for (const f of [e.pdf.student, e.pdf.teacher]) { const fp = path.join(dir, f); if (fs.existsSync(fp) && fs.statSync(fp).size < 20000) fail(`封存 ${e.week}：${f} 檔案過小`); }
}
if (archive.some(e => e.week >= live.meta.week)) fail("封存清單裡有比上線卷更新的週次");

/* ---------- 2. 產生器對多個週次的穩定性 ---------- */
let papers = 0;
try { checkPaper(buildPaper({ week: WEEK1.week, round: 1, fixed: WEEK1.fixed, today: "2026-09-19" }), "第 1 回（固定參數）"); papers++; } catch (e) { fail("第 1 回產生失敗：" + e.message); }
let wk = live.meta.week;
for (let i = 0; i < nWeeks; i++) {
  wk = nextWeekId(wk);
  try { frames += checkPaper(buildPaper({ week: wk, round: 2 + i, today: "2026-09-19" }), `模擬 ${wk}`); papers++; } catch (e) { fail(`模擬 ${wk} 產生失敗：${e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e.message}`); }
}

/* ---------- 結果 ---------- */
if (errors.length) { console.error(`✗ 檢查失敗（${errors.length} 項）：`); errors.slice(0, 60).forEach(e => console.error("  - " + e)); process.exit(1); }
console.log(`✓ 上線卷 ${live.meta.week}（第 ${live.meta.round} 回）、封存 ${archive.length} 回、另模擬 ${papers} 份卷子；動畫共繪製 ${frames} 個影格皆正常`);
