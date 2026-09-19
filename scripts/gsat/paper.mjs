// 學測數A預測題庫 —— 組卷：呼叫 20 個題型模板、編題號與空格、寫出 questions.js / 封存檔。
import { makeRng, weekRange } from "./util.mjs";
import * as SA from "./slots-a.mjs";
import * as SB from "./slots-b.mjs";

export const SITE_DIR = "matha-c4f9fd6edf213a5b";
export const YEAR = 116;

/* 考點熱度（靜態）；各單元對應題號由組卷結果填入 */
export const UNITS = [
  { vol: "數學1", name: "數與式", heat: 2, note: "絕對值＝距離、根式與指數律、算幾不等式。多半以一題單選或選填出現，難度不高但要快。" },
  { vol: "數學1", name: "直線與圓", heat: 4, note: "圓心到直線的距離幾乎年年考：弦長、切線、圓與直線的位置關係都靠它。" },
  { vol: "數學1", name: "多項式函數", heat: 5, note: "餘式定理、因式定理與三次函數圖形（對稱中心、水平線交點數）是最穩定的考點。" },
  { vol: "數學1", name: "指數與對數", heat: 5, note: "對數估算（位數、倍增次數、成長率）年年出現，常包裝成生活情境的素養題。" },
  { vol: "數學2", name: "數列與級數", heat: 4, note: "遞迴數列搭配等比、Σ 求和；把遞迴式「平移成等比」是最常見的解法。" },
  { vol: "數學2", name: "數據分析", heat: 5, note: "資料線性變換後的平均、標準差、相關係數，以及迴歸直線的預測，是混合題的最愛。" },
  { vol: "數學2", name: "排列組合", heat: 4, note: "計數常搭配「分類」：依餘數、依顏色、依位置分堆再組合。" },
  { vol: "數學2", name: "機率", heat: 4, note: "條件機率與貝氏定理是 108 課綱強調的重點，篩檢、檢測情境反覆出現。" },
  { vol: "數學3A", name: "三角", heat: 5, note: "正弦、餘弦定理與三角函數圖形的平移伸縮，通常一題基本、一題應用。" },
  { vol: "數學3A", name: "指數與對數函數", heat: 3, note: "函數圖形的單調性與對稱，較常和數學 1 的對數運算合併命題。", also: [16] },
  { vol: "數學3A", name: "平面向量", heat: 5, note: "內積、正射影、面積（二階行列式）與柯西不等式；向量是連結幾何與代數的樞紐。" },
  { vol: "數學4A", name: "空間向量", heat: 4, note: "外積求面積與法向量、三階行列式求體積，計算量不大但觀念要清楚。" },
  { vol: "數學4A", name: "空間中的平面與直線", heat: 4, note: "法向量、點到平面距離、直線與平面的關係，多選題常一次考完。" },
  { vol: "數學4A", name: "矩陣", heat: 4, note: "線性變換與行列式（面積倍率）、轉移矩陣，是 4A 最常被抽考的部分。" },
  { vol: "數學4A", name: "二次曲線", heat: 3, note: "橢圓、雙曲線、拋物線的定義與基本量，以多選或選填一題為主。" }
];

/* 第 1 回（2026-W38）沿用手寫版的數字 */
export const WEEK1 = {
  week: "2026-W38", round: 1,
  fixed: {
    1: { a: 1, gap: 2, ext: 1 },
    2: { roots: [1, 2], m: 2, n: 1, a: 1, x3: 3, x0: 0 },
    3: { h: 2, k: -1, rd: [3, 2], pq: [3, 4], which: 0 },
    4: { A: 3, phi: [1, 3], d: 1 },
    5: { preset: [1, 90, 5], scenario: "disease" },
    6: { M: [2, 1, 1, 3], S: 4 },
    7: { h: 0, q: 1, sel: [0, 2, 3, 5, 9] },
    8: { combo: [2, 1], a1: 1, sel: [0, 2, 3, 4, 5] },
    9: { mu: 60, sd: 10, a: 1.2, b: -2, sel: [0, 3, 4, 5, 6] },
    10: { a: [4, 3], b: [1, 2], sel: [0, 2, 4, 6, 7] },
    11: { plane: 0, F: [2, 1, 1], v: [2, -1, 0], Q: [1, 1, 0], t: 1, sel: [0, 2, 4, 5, 7] },
    12: { type: "hyperbola", abc: [3, 4, 5], sel: [0, 2, 4, 6, 8] },
    13: { n: 9 },
    14: { tri: [3, 5, 120, 7] },
    15: { pre: [1, 2, 3, 7], perm: [0, 1, 2] },
    16: { T: 3, R: 100, mode: "grow", N0: 500, subj: "bacteria" },
    17: { r0: 2, u: [3, 4], want: "max" },
    18: { pre: { a0: 0.9, b: 0.2, xp: 6 }, scen: "startup" }
  }
};

const SLOTS = [SA.slot1, SA.slot2, SA.slot3, SA.slot4, SA.slot5, SA.slot6, SA.slot7, SA.slot8, SA.slot9, SA.slot10, SB.slot11, SB.slot12, SB.slot13, SB.slot14, SB.slot15, SB.slot16, SB.slot17];

export function buildPaper({ week, round, fixed = null, today = null }) {
  const rng = makeRng("gsat-matha/" + week);
  const qs = [];
  SLOTS.forEach((fn, i) => { qs.push(fn(rng.sub("s" + (i + 1)), fixed ? fixed[i + 1] : null)); });
  const g = SB.logfitGroup(rng.sub("g18"), fixed ? fixed[18] : null);
  qs.push(...g.questions);
  // 題號、配分、空格編號（選填的圈號從 ⑬ 起，接在 12 題選擇題之後）
  let label = 13;
  qs.forEach((q, i) => {
    q.no = i + 1; q.points = 5;
    if (q.kind === "fill") {
      q.blanks.forEach(b => { b.label = label++; });
      q.stem = q.stem.replace(/\\b\{(\d+)\}/g, (m, k) => `\\b{${q.blanks[+k - 1].label}}`);
    }
  });
  const units = UNITS.map(u => { const own = qs.filter(q => q.unit === u.name).map(q => q.no); const extra = (u.also || []).filter(n => !own.includes(n)); const { also, ...rest } = u; return { ...rest, qs: [...own, ...extra].sort((a, b) => a - b) }; });
  const { from, to } = weekRange(week);
  return {
    meta: { year: YEAR, week, round, from, to, generated: today || new Date().toISOString().slice(0, 10), title: `${YEAR} 學測數A 預測卷 第 ${round} 回`, minutes: 100 },
    units, groups: { [g.group.id]: { title: g.group.title, context: g.group.context } }, questions: qs
  };
}

/* ---------- 序列化 ---------- */
const HEADER = "/* 由 scripts/gsat_build.mjs 產生，請勿手改；題型模板在 scripts/gsat/。 */\n";
export const serializeCurrent = (paper) => HEADER + "window.GSAT = " + JSON.stringify(paper, null, 1) + ";\n";
export const serializeArchived = (paper) => HEADER + "window.GSAT_PAPERS = window.GSAT_PAPERS || {};\nwindow.GSAT_PAPERS[" + JSON.stringify(paper.meta.week) + "] = " + JSON.stringify(paper) + ";\n";
export const serializeArchive = (list) => HEADER + "window.GSAT_ARCHIVE = " + JSON.stringify(list, null, 1) + ";\n";
export function parseJsObject(src, varName) {
  const re = new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*");
  const m = re.exec(src); if (!m) throw new Error(`找不到 ${varName}`);
  let body = src.slice(m.index + m[0].length).trim(); if (body.endsWith(";")) body = body.slice(0, -1);
  return JSON.parse(body);
}
export function archiveEntry(paper) {
  const w = paper.meta.week;
  return { week: w, round: paper.meta.round, from: paper.meta.from, to: paper.meta.to, title: paper.meta.title, file: `data/papers/${w}.js`, pdf: { student: `pdf/${w}-student.pdf`, teacher: `pdf/${w}-teacher.pdf` } };
}
