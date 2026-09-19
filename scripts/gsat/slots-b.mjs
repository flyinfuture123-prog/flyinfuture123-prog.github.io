// 學測數A預測題庫 —— 題型模板（第 11～20 題）
import { fracTex, fracText, sqrtTex, sqrtText, linTex, ptTex, fmt, makeMulti, reduce, isSquare } from "./util.mjs";

const P = (fixed, rng, key, f) => (fixed && fixed[key] !== undefined ? fixed[key] : f(rng));
const v3 = (v) => `(${v.join(",")})`;
const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const add3 = (u, v, k = 1) => [u[0] + k * v[0], u[1] + k * v[1], u[2] + k * v[2]];
const planeTex = (n, D) => `${linTex(n[0], 0)}${n[1] >= 0 ? "+" : "-"}${Math.abs(n[1]) === 1 ? "" : Math.abs(n[1])}y${n[2] >= 0 ? "+" : "-"}${Math.abs(n[2]) === 1 ? "" : Math.abs(n[2])}z=${D}`;

/* ---------- 第 11 題：空間中的平面與直線 ---------- */
const PLANES = [
  { n: [1, 2, 2], D: 6, F: [[2, 1, 1], [0, 1, 2], [2, 2, 0]], v: [[2, -1, 0], [0, 1, -1], [2, 0, -1]], Q: [[1, 1, 0], [0, 1, 0], [2, 3, 0]], t: [1, 2] },
  { n: [2, 2, 1], D: 6, F: [[1, 1, 2], [2, 0, 2], [0, 2, 2]], v: [[1, -1, 0], [0, 1, -2], [1, 0, -2]], Q: [[1, 1, 0], [0, 2, 0], [2, 2, 0]], t: [1, 2] },
  { n: [2, 1, 2], D: 6, F: [[1, 2, 1], [2, 0, 1], [1, 0, 2]], v: [[1, -2, 0], [0, 2, -1], [1, 0, -1]], Q: [[1, 1, 0], [0, 2, 0]], t: [1, 2] },
  { n: [2, 3, 6], D: 12, F: [[0, 2, 1], [3, 0, 1], [3, 2, 0]], v: [[3, -2, 0], [0, 2, -1], [3, 0, -1]], Q: [[1, 1, 0], [0, 1, 0]], t: [1] }
];
export function slot11(rng, fixed) {
  const pi = P(fixed, rng, "plane", r => r.int(0, PLANES.length - 1));
  const pl = PLANES[pi];
  const F = P(fixed, rng, "F", r => r.pick(pl.F));
  const v = P(fixed, rng, "v", r => r.pick(pl.v));
  const Q = P(fixed, rng, "Q", r => r.pick(pl.Q));
  const t = P(fixed, rng, "t", r => r.pick(pl.t));
  const n = pl.n, D = pl.D, nl = Math.sqrt(dot3(n, n));
  const Pp = add3(F, n, t); const dist = t * nl;
  const distQ = Math.abs(dot3(n, Q) - D); // 分子
  const comp = (q0, vi) => { if (!vi) return String(q0); const tt = (Math.abs(vi) === 1 ? "" : Math.abs(vi)) + "t"; if (q0 === 0) return (vi > 0 ? "" : "-") + tt; return `${q0}${vi > 0 ? "+" : "-"}${tt}`; };
  const lineTex = `(x,y,z)=(${comp(Q[0], v[0])},\\ ${comp(Q[1], v[1])},\\ ${comp(Q[2], v[2])})`;
  const Fw = add3(F, v, 1);
  const numer = dot3(n, Pp) - D;
  const pool = [
    { text: `$${v3(n)}$ 是 $E$ 的一個法向量`, ok: true, why: `平面方程式的係數 $${v3(n)}$ 即法向量。` },
    { text: `$${v3(v)}$ 是 $E$ 的一個法向量`, ok: false, why: `$${v3(v)}$ 與法向量 $${v3(n)}$ 的內積為 0，它平行於平面，不是法向量。` },
    { text: `$P$ 到 $E$ 的距離為 ${fmt(dist)}`, ok: true, why: `$d=\\frac{|${n[0]}\\cdot ${Pp[0]}+${n[1]}\\cdot ${Pp[1]}+${n[2]}\\cdot ${Pp[2]}-${D}|}{\\sqrt{${n[0] ** 2}+${n[1] ** 2}+${n[2] ** 2}}}=\\frac{${Math.abs(numer)}}{${nl}}=${fmt(dist)}$。` },
    { text: `$P$ 到 $E$ 的距離為 ${Math.abs(numer)}`, ok: false, why: `代入平面式得 $|${numer}|$ 之後還要除以 $|\\vec{n}|=${nl}$，距離是 ${fmt(dist)}。` },
    { text: `$L$ 與 $E$ 平行（沒有交點）`, ok: true, why: `$L$ 的方向向量 $${v3(v)}$ 與 $${v3(n)}$ 內積為 0，且 $L$ 上的點 $${v3(Q)}$ 代入得 $${dot3(n, Q)}\\ne ${D}$，不在 $E$ 上，故平行。` },
    { text: `$L$ 落在 $E$ 上`, ok: false, why: `$${v3(Q)}$ 代入 $E$ 得 $${dot3(n, Q)}\\ne ${D}$，$L$ 不在 $E$ 上。` },
    { text: `$L$ 與 $E$ 恰交於一點`, ok: false, why: `方向向量與法向量垂直，$L$ 不可能穿過 $E$。` },
    { text: `過 $P$ 且與 $E$ 垂直的直線，交 $E$ 於點 $${v3(F)}$`, ok: true, why: `從 $P$ 沿 $-\\vec{n}$ 方向走距離 ${fmt(dist)}，即 $P-${t}\\cdot ${v3(n)}=${v3(F)}$，代入 $E$ 成立。` },
    { text: `過 $P$ 且與 $E$ 垂直的直線，交 $E$ 於點 $${v3(Fw)}$`, ok: false, why: `$${v3(Fw)}$ 雖在 $E$ 上，但 $P-${v3(Fw)}=${v3(add3(Pp, Fw, -1))}$ 不平行於法向量，不是垂足；垂足是 $${v3(F)}$。` },
    { text: `$L$ 上任一點到 $E$ 的距離都是 $${fracTex(distQ, nl)}$`, ok: true, why: `$L\\parallel E$，距離處處相等，取 $${v3(Q)}$ 計算得 $\\frac{${distQ}}{${nl}}$。` }
  ];
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 11, kind: "multi", vol: "數學4A", unit: "空間中的平面與直線", topic: "法向量、點到平面距離、直線與平面的關係", diff: 3, anim: "q11",
    params: { n, D, F, v, Q, P: Pp, t, dist },
    stem: `空間中，平面 $E: ${planeTex(n, D)}$，直線 $L: ${lineTex}$，$t$ 為實數，點 $P${v3(Pp)}$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: `平面方程式 $${planeTex(n, D)}$ 的係數就是法向量 $\\vec{n}$。點到平面的距離是「沿著法向量方向走多遠會碰到平面」；直線方向 $\\perp\\vec{n}$ 表示直線與平面平行或在平面上，再用一個點判斷是哪一種。`,
    why: "空間中的平面與直線在學測數A多以一題多選涵蓋「法向量、距離、位置關係、垂足」四個小觀念，是 4A 拿分的關鍵題。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}

/* ---------- 第 12 題：二次曲線 ---------- */
export function slot12(rng, fixed) {
  const type = P(fixed, rng, "type", r => r.pick(["hyperbola", "hyperbola", "ellipse"]));
  const abc = P(fixed, rng, "abc", r => (type === "hyperbola" ? r.pick([[3, 4, 5], [4, 3, 5]]) : r.pick([[5, 4, 3], [5, 3, 4]])));
  const [a, b, c] = abc;
  const lr = reduce(b * b, a);
  let pool, eq, name, defText;
  if (type === "hyperbola") {
    eq = `\\frac{x^2}{${a * a}}-\\frac{y^2}{${b * b}}=1`; name = "雙曲線";
    defText = `雙曲線的定義是「到兩焦點的距離差固定為 $2a$」。以 $a=${a}$、$b=${b}$ 畫出中心矩形，對角線就是漸近線，對角線的一半長 $\\sqrt{a^2+b^2}=${c}$ 就是焦距 $c$。`;
    pool = [
      { text: `$\\Gamma$ 的焦點為 $(\\pm ${c},0)$`, ok: true, why: `$c^2=a^2+b^2=${a * a}+${b * b}=${c * c}$，焦點 $(\\pm ${c},0)$。` },
      { text: `$\\Gamma$ 的焦點為 $(\\pm ${a},0)$`, ok: false, why: `$(\\pm ${a},0)$ 是頂點；焦點在 $(\\pm ${c},0)$。` },
      { text: `$\\Gamma$ 的漸近線為 $y=\\pm${fracTex(b, a)}x$`, ok: true, why: `漸近線 $\\frac{x}{${a}}\\pm\\frac{y}{${b}}=0$，即 $y=\\pm${fracTex(b, a)}x$。` },
      { text: `$\\Gamma$ 的漸近線為 $y=\\pm${fracTex(a, b)}x$`, ok: false, why: `漸近線斜率是 $\\pm\\frac{b}{a}=\\pm${fracTex(b, a)}$。` },
      { text: `$\\Gamma$ 的貫軸長為 ${2 * a}`, ok: true, why: `貫軸長 $2a=${2 * a}$。` },
      { text: `$\\Gamma$ 的共軛軸長為 ${2 * b}`, ok: true, why: `共軛軸長 $2b=${2 * b}$。` },
      { text: `對 $\\Gamma$ 上任一點 $P$，$P$ 到兩焦點的距離差之絕對值為 ${2 * c}`, ok: false, why: `距離差的絕對值為 $2a=${2 * a}$，不是 $2c$。` },
      { text: `對 $\\Gamma$ 上任一點 $P$，$P$ 到兩焦點的距離差之絕對值為 ${2 * a}`, ok: true, why: `這正是雙曲線的定義：$|\\ol{PF_1}-\\ol{PF_2}|=2a=${2 * a}$。` },
      { text: `點 $${ptTex(c, lr)}$ 在 $\\Gamma$ 上`, ok: true, why: `$\\frac{${c * c}}{${a * a}}-\\frac{(${fracTex(lr[0], lr[1])})^2}{${b * b}}=\\frac{${c * c}}{${a * a}}-\\frac{${b * b}}{${a * a}}=1$。這點是正焦弦的端點（$y=\\frac{b^2}{a}$）。` }
    ];
  } else {
    eq = `\\frac{x^2}{${a * a}}+\\frac{y^2}{${b * b}}=1`; name = "橢圓";
    defText = `橢圓的定義是「到兩焦點的距離和固定為 $2a$」。$a=${a}$ 是長軸的一半、$b=${b}$ 是短軸的一半，焦距 $c=\\sqrt{a^2-b^2}=${c}$：短軸端點到焦點的距離恰好等於 $a$，這就是 $a^2=b^2+c^2$ 的直角三角形。`;
    pool = [
      { text: `$\\Gamma$ 的焦點為 $(\\pm ${c},0)$`, ok: true, why: `$c^2=a^2-b^2=${a * a}-${b * b}=${c * c}$，焦點 $(\\pm ${c},0)$。` },
      { text: `$\\Gamma$ 的焦點為 $(0,\\pm ${c})$`, ok: false, why: `$x^2$ 的分母較大，長軸在 $x$ 軸上，焦點是 $(\\pm ${c},0)$。` },
      { text: `$\\Gamma$ 的長軸長為 ${2 * a}`, ok: true, why: `長軸長 $2a=${2 * a}$。` },
      { text: `$\\Gamma$ 的短軸長為 ${b}`, ok: false, why: `短軸長是 $2b=${2 * b}$。` },
      { text: `對 $\\Gamma$ 上任一點 $P$，$P$ 到兩焦點的距離和為 ${2 * a}`, ok: true, why: `這正是橢圓的定義：$\\ol{PF_1}+\\ol{PF_2}=2a=${2 * a}$。` },
      { text: `對 $\\Gamma$ 上任一點 $P$，$P$ 到兩焦點的距離和為 ${2 * c}`, ok: false, why: `距離和為 $2a=${2 * a}$，不是 $2c$。` },
      { text: `$\\Gamma$ 的離心率為 $${fracTex(c, a)}$`, ok: true, why: `$e=\\frac{c}{a}=${fracTex(c, a)}$。` },
      { text: `點 $${ptTex(c, lr)}$ 在 $\\Gamma$ 上`, ok: true, why: `$\\frac{${c * c}}{${a * a}}+\\frac{(${fracTex(lr[0], lr[1])})^2}{${b * b}}=\\frac{${c * c}+${b * b}}{${a * a}}=1$。` },
      { text: `$\\Gamma$ 的焦距為 ${c}`, ok: false, why: `焦距是兩焦點的距離 $2c=${2 * c}$。` }
    ];
  }
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 12, kind: "multi", vol: "數學4A", unit: "二次曲線", topic: `${name}的定義與基本量`, diff: 2, anim: "q12",
    params: { type, a, b, c, lr: lr[0] / lr[1] },
    stem: `坐標平面上，${name} $\\Gamma: ${eq}$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: defText,
    why: "二次曲線在數A通常只佔一題，最常考的就是由標準式讀出 $a$、$b$、$c$ 與定義中的常數；「距離差（和）是 $2a$ 不是 $2c$」是最常見的陷阱。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}

/* ---------- 第 13 題：依餘數分類計數 ---------- */
export function slot13(rng, fixed) {
  const n = P(fixed, rng, "n", r => r.pick([9, 9, 10, 12]));
  const classes = [[], [], []]; for (let i = 1; i <= n; i++) classes[i % 3].push(i);
  const C3 = (k) => (k * (k - 1) * (k - 2)) / 6;
  const same = classes.reduce((s, c) => s + C3(c.length), 0), each = classes[0].length * classes[1].length * classes[2].length;
  // 暴力驗證
  let brute = 0; for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) for (let k = j + 1; k <= n; k++) if ((i + j + k) % 3 === 0) brute++;
  if (brute !== same + each) throw new Error("第 13 題計數不一致");
  const total = brute;
  const digits = String(total).split("");
  const setTex = (c) => `\\{${c.join(",\\ ")}\\}`;
  return {
    slot: 13, kind: "fill", vol: "數學2", unit: "排列組合", topic: "依餘數分類計數", diff: 3, anim: "q13",
    params: { n, classes, same, each, total },
    stem: `從 1、2、3、…、${n} 這${n === 9 ? "九" : n === 10 ? "十" : "十二"}個數中任取三個相異的數，使其和為 3 的倍數，共有 $${digits.map((_, i) => `\\b{${i + 1}}`).join("")}$ 種取法。`,
    blanks: digits.map(d => ({ ans: d })),
    core: `「和是 3 的倍數」只跟每個數除以 3 的餘數有關。先把 1 到 ${n} 依餘數 0、1、2 分成三堆，三個餘數相加要是 3 的倍數，只有兩種可能：三個同堆，或三堆各取一個。`,
    why: "「分類後再計數」是排列組合單元最常見的思路，依餘數分堆更是近年愛考的變形，因為它同時測驗數論直覺與組合計算。",
    solution: [
      `依除以 3 的餘數分堆：餘 0：$${setTex(classes[0])}$；餘 1：$${setTex(classes[1])}$；餘 2：$${setTex(classes[2])}$。`,
      `三個餘數之和為 3 的倍數，只有「三個同餘」（$0+0+0$、$1+1+1$、$2+2+2$）或「三種餘數各一」（$0+1+2$）。`,
      `同一堆取三個：$${classes.map(c => `C^{${c.length}}_{3}`).join("+")}=${classes.map(c => C3(c.length)).join("+")}=${same}$ 種；三堆各取一個：$${classes.map(c => c.length).join("\\times ")}=${each}$ 種。合計 $${same}+${each}=${total}$ 種。`
    ],
    answerText: String(total)
  };
}

/* ---------- 第 14 題：餘弦定理與正弦定理 ---------- */
const TRI = [[3, 5, 120, 7], [5, 8, 60, 7], [3, 8, 60, 7], [7, 8, 120, 13], [8, 15, 60, 13], [5, 16, 120, 19]];
export function slot14(rng, fixed) {
  const tri = P(fixed, rng, "tri", r => r.pick(TRI));
  const [b, c, Adeg, a] = tri; // AB = c, AC = b, 對邊 BC = a
  const cosTerm = Adeg === 120 ? `+${b * c}` : `-${b * c}`;
  const digits = String(a).split("");
  const blanks = [...digits.map(d => ({ ans: d })), { ans: "3" }, { ans: "3" }];
  const stemR = `\\frac{${digits.map((_, i) => `\\b{${i + 1}}`).join("")}\\sqrt{\\b{${digits.length + 1}}}}{\\b{${digits.length + 2}}}`;
  return {
    slot: 14, kind: "fill", vol: "數學3A", unit: "三角", topic: "餘弦定理與正弦定理（外接圓半徑）", diff: 3, anim: "q14",
    params: { b, c, A: Adeg, a },
    stem: `在 $\\triangle ABC$ 中，$\\ol{AB}=${c}$，$\\ol{AC}=${b}$，$\\angle A=${Adeg}^\\circ$。則 $\\triangle ABC$ 外接圓的半徑為 $${stemR}$。（化為最簡根式與最簡分數）`,
    blanks,
    core: `餘弦定理是「有角度修正的畢氏定理」，先用它從兩邊夾角求出對邊；正弦定理 $\\frac{a}{\\sin A}=2R$ 則說：一條邊除以它所對的角的正弦，永遠等於外接圓直徑。`,
    why: "「兩邊夾角求第三邊，再求外接圓半徑」把餘弦定理與正弦定理串成一題，是三角單元選填題的經典組合，計算量適中且答案需化簡，很符合學測風格。",
    solution: [
      `餘弦定理：$\\ol{BC}^2=${c}^2+${b}^2-2\\cdot ${c}\\cdot ${b}\\cos ${Adeg}^\\circ=${c * c}+${b * b}${cosTerm}=${a * a}$，得 $\\ol{BC}=${a}$。`,
      `正弦定理：$2R=\\frac{\\ol{BC}}{\\sin A}=\\frac{${a}}{\\sin ${Adeg}^\\circ}=\\frac{${a}}{\\sqrt{3}/2}=\\frac{${2 * a}}{\\sqrt{3}}$。`,
      `故 $R=\\frac{${a}}{\\sqrt{3}}=\\frac{${a}\\sqrt{3}}{3}$。`
    ],
    answerText: `${a}√3⁄3`
  };
}

/* ---------- 第 15 題：外積與三角形面積 ---------- */
const AREA_PRESETS = (() => {
  const out = [];
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) {
    const S2 = a * a * b * b + b * b * c * c + c * c * a * a;
    if (isSquare(S2)) { const S = Math.round(Math.sqrt(S2)); if (S % 2 === 1 && S < 100) out.push([a, b, c, S]); }
  }
  return out;
})();
export function slot15(rng, fixed) {
  const pre = P(fixed, rng, "pre", r => r.pick(AREA_PRESETS));
  const perm = P(fixed, rng, "perm", r => r.pick([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]));
  const abc = [pre[perm[0]], pre[perm[1]], pre[perm[2]]]; const S = pre[3];
  const [a, b, c] = abc;
  const AB = [-a, b, 0], AC = [-a, 0, c];
  const n = [b * c, a * c, a * b]; // AB × AC
  const digits = String(S).split("");
  return {
    slot: 15, kind: "fill", vol: "數學4A", unit: "空間向量", topic: "外積與三角形面積", diff: 2, anim: "q15",
    params: { a, b, c, n, S },
    stem: `空間中有三點 $A(${a},0,0)$、$B(0,${b},0)$、$C(0,0,${c})$。則 $\\triangle ABC$ 的面積為 $\\frac{${digits.map((_, i) => `\\b{${i + 1}}`).join("")}}{\\b{${digits.length + 1}}}$。（化為最簡分數）`,
    blanks: [...digits.map(d => ({ ans: d })), { ans: "2" }],
    core: `兩個空間向量的外積 $\\vec{u}\\times\\vec{v}$ 同時給出兩件事：它的長度是兩向量張成的平行四邊形面積，它的方向垂直於這個平面（也就是平面 $ABC$ 的法向量）。三角形面積就是平行四邊形的一半。`,
    why: "外積是 4A 空間向量最具代表性的工具，「三點求三角形面積」是最直接的考法，也常延伸成求平面方程式或四面體體積。",
    solution: [
      `$\\vec{AB}=${v3(AB)}$，$\\vec{AC}=${v3(AC)}$。`,
      `$\\vec{AB}\\times\\vec{AC}=(${b}\\cdot ${c}-0\\cdot 0,\\ 0\\cdot(${-a})-(${-a})\\cdot ${c},\\ (${-a})\\cdot 0-${b}\\cdot(${-a}))=${v3(n)}$。`,
      `$|\\vec{AB}\\times\\vec{AC}|=\\sqrt{${n[0] ** 2}+${n[1] ** 2}+${n[2] ** 2}}=${S}$，故 $\\triangle ABC$ 面積 $=\\frac{${S}}{2}$。順帶一提，平面 $ABC$ 的方程式即 $${planeTex(n, a * b * c)}$。`
    ],
    answerText: `${S}⁄2`
  };
}

/* ---------- 第 16 題：指數成長／衰變與對數估算 ---------- */
const LOGS = { 100: [2, "2"], 1000: [3, "3"], 50: [2 - 0.3010, "2-0.3010"], 200: [2 + 0.3010, "2+0.3010"], 500: [3 - 0.3010, "3-0.3010"] };
export function slot16(rng, fixed) {
  let pick;
  for (let tries = 0; tries < 200; tries++) {
    const T = P(fixed, rng, "T", r => r.pick([2, 3, 4, 5, 6]));
    const R = P(fixed, rng, "R", r => r.pick([100, 1000, 50, 200, 500]));
    const tStar = T * LOGS[R][0] / 0.3010;
    const ans = Math.floor(tStar) + 1;
    const fracPart = tStar - Math.floor(tStar);
    if (ans >= 10 && ans <= 99 && fracPart > 0.05 && fracPart < 0.95) { pick = { T, R, tStar, ans }; break; }
    if (fixed) break;
  }
  if (!pick) throw new Error("第 16 題找不到合適參數");
  const { T, R, tStar, ans } = pick;
  const mode = P(fixed, rng, "mode", r => r.pick(["grow", "grow", "decay"]));
  const N0 = P(fixed, rng, "N0", r => r.pick([500, 200, 1000, 800]));
  const target = mode === "grow" ? N0 * R : N0 / R;
  const before = Math.pow(2, (ans - 1) / T), after = Math.pow(2, ans / T);
  const digits = String(ans).split("");
  const subj = P(fixed, rng, "subj", r => r.pick(["bacteria", "virus", "drug"]));
  const words = mode === "grow"
    ? { bacteria: ["某實驗室培養一種細菌，其數量每", "小時增為原來的 2 倍。若一開始有", "隻", "隻"], virus: ["某社群平台的一則貼文，其轉發次數每", "小時增為原來的 2 倍。若一開始有", "次", "次"], drug: ["某池塘中的藻類覆蓋面積每", "小時增為原來的 2 倍。若一開始覆蓋", "平方公尺", "平方公尺"] }[subj]
    : { bacteria: ["某放射性物質的殘留量每", "小時減為原來的一半。若一開始有", "毫克", "毫克"], virus: ["某藥物在血液中的濃度每", "小時減為原來的一半。若服藥後濃度為", "單位", "單位"], drug: ["某水池中的汙染物含量每", "小時減為原來的一半。若一開始含量為", "公克", "公克"] }[subj];
  const tgtText = mode === "grow" ? `首次超過 ${target.toLocaleString("en-US")} ${words[3]}` : `首次低於 ${fmt(target, 2)} ${words[3]}`;
  const ratioText = mode === "grow" ? `${R} 倍` : `$\\frac{1}{${R}}$`;
  return {
    slot: 16, kind: "fill", vol: "數學1", unit: "指數與對數", topic: mode === "grow" ? "指數成長與對數估算" : "指數衰變（半衰期）與對數估算", diff: 3, anim: "q16",
    params: { T, R, N0, mode, tStar: +tStar.toFixed(2), ans, target },
    stem: `${words[0]} ${T} ${words[1]} ${N0.toLocaleString("en-US")} ${words[2]}，則至少需經過 $${digits.map((_, i) => `\\b{${i + 1}}`).join("")}$ 個整數小時後，${mode === "grow" ? "其數量" : "其含量"}才會${tgtText}。（$\\log 2\\approx 0.3010$）`,
    blanks: digits.map(d => ({ ans: d })),
    core: `要從 ${N0.toLocaleString("en-US")} 變成 ${mode === "grow" ? target.toLocaleString("en-US") : fmt(target, 2)} 是「變成 ${ratioText}」，問題其實是：2 要自乘幾次才會超過 ${R}？這個次數就是 $\\log_2 ${R}=\\frac{\\log ${R}}{\\log 2}\\approx ${fmt(LOGS[R][0] / 0.3010, 2)}$。對數把「連乘幾次」翻譯成「除一下」。`,
    why: "指數成長（或半衰期）搭配對數估算，是學測數A每年幾乎必出的素養題型：細菌、病毒、複利、放射性衰變都只是包裝，核心永遠是 $\\log$ 把乘法變加法。",
    solution: [
      `設經過 $t$ 小時，${mode === "grow" ? "數量" : "含量"}為 $${N0}\\cdot ${mode === "grow" ? `2^{t/${T}}` : `\\left(\\frac{1}{2}\\right)^{t/${T}}`}$。要求 $${mode === "grow" ? `2^{t/${T}}>${R}` : `2^{t/${T}}>${R}`}$。`,
      `兩邊取對數：$\\frac{t}{${T}}\\log 2>\\log ${R}=${LOGS[R][1]}$，$t>\\frac{${T}\\times ${fmt(LOGS[R][0], 4)}}{0.3010}\\approx ${fmt(tStar, 2)}$。`,
      `故最少需 ${ans} 個整數小時。驗算：$t=${ans - 1}$ 時 $2^{${ans - 1}/${T}}\\approx ${fmt(before, 1)}<${R}$；$t=${ans}$ 時 $2^{${ans}/${T}}\\approx ${fmt(after, 1)}>${R}$。`
    ],
    answerText: String(ans)
  };
}

/* ---------- 第 17 題：內積與柯西不等式 ---------- */
export function slot17(rng, fixed) {
  const r0 = P(fixed, rng, "r0", r => r.pick([1, 2, 2, 3]));
  const u = P(fixed, rng, "u", r => r.pick([[3, 4], [4, 3], [5, 12], [12, 5], [6, 8], [8, 6]]));
  const [p, q] = u; const lu = Math.round(Math.sqrt(p * p + q * q));
  const want = P(fixed, rng, "want", r => r.pick(["max", "max", "min"]));
  let val = r0 * lu; if (val < 10) { return slot17(rng, Object.assign({}, fixed, { r0: 2, u: [3, 4] })); }
  const ans = want === "max" ? val : -val;
  const digits = String(ans).split("");
  const pt = want === "max" ? [reduce(r0 * p, lu), reduce(r0 * q, lu)] : [reduce(-r0 * p, lu), reduce(-r0 * q, lu)];
  return {
    slot: 17, kind: "fill", vol: "數學3A", unit: "平面向量", topic: `內積與柯西不等式（${want === "max" ? "最大值" : "最小值"}）`, diff: 3, anim: "q17",
    params: { r0, p, q, lu, want, val },
    stem: `設實數 $x$、$y$ 滿足 $x^2+y^2=${r0 * r0}$，則 $${linTex(p, 0)}+${q}y$ 的${want === "max" ? "最大值" : "最小值"}為 $${digits.map((_, i) => `\\b{${i + 1}}`).join("")}$。${want === "min" ? "（若為負數，負號填在第一格）" : ""}`,
    blanks: digits.map(d => ({ ans: d })),
    core: `$${p}x+${q}y$ 就是向量 $(x,y)$ 與 $(${p},${q})$ 的內積，等於 $|(${p},${q})|=${lu}$ 乘上 $(x,y)$ 在 $(${p},${q})$ 方向的投影長。$(x,y)$ 在半徑 ${r0} 的圓上，投影最長就是 ${r0}，所以最大值是 $${lu}\\times ${r0}=${val}$${want === "min" ? `，反向時最小值為 $-${val}$` : ""}。`,
    why: "柯西不等式在 108 課綱放在平面向量內積之後，「圓上的點使一次式最大」是它最典型的應用，也可以用直線平移到與圓相切來解，一題兩解法，命題價值高。",
    solution: [
      `由柯西不等式（或內積的性質）：$|${p}x+${q}y|=|(${p},${q})\\cdot(x,y)|\\le|(${p},${q})|\\,|(x,y)|=${lu}\\times ${r0}=${val}$。`,
      `${want === "max" ? "最大值" : "最小值"} $${ans}$ 在 $(x,y)$ 與 $(${p},${q})$ ${want === "max" ? "同向" : "反向"}時達到，即 $(x,y)=${ptTex(pt[0], pt[1])}$。`,
      `另解：直線 $${p}x+${q}y=k$ 與圓 $x^2+y^2=${r0 * r0}$ 有交點 $\\iff \\frac{|k|}{${lu}}\\le ${r0} \\iff -${val}\\le k\\le ${val}$。`
    ],
    answerText: String(ans)
  };
}

/* ---------- 第 18～20 題：取對數後的線性迴歸（題組）---------- */
const TEN = { 0: 1, 1: 1.26, 2: 1.58, 3: 2.0, 4: 2.51, 5: 3.16, 6: 3.98, 7: 5.01, 8: 6.31, 9: 7.94 };
const LOGFIT_PRESETS = (() => {
  const out = [];
  for (const b of [0.1, 0.2, 0.3]) for (const a0 of [0.7, 0.8, 0.9, 1.0]) {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map(x => Math.round(Math.pow(10, a0 + b * x)));
    const Ys = ys.map(y => +Math.log10(y).toFixed(2));
    const meanY = Ys.reduce((s, v) => s + v, 0) / 5;
    const sxy = xs.reduce((s, x, i) => s + (x - 2) * (Ys[i] - meanY), 0);
    if (Math.abs(meanY - (a0 + 2 * b)) > 0.006 || Math.abs(sxy - 10 * b) > 0.03) continue;
    for (const xp of [5, 6, 7, 8]) { const Yp = +(a0 + b * xp).toFixed(2); if (Yp >= 2 && Yp < 2.95) out.push({ a0, b, xp, Yp, ys, Ys }); }
  }
  return out;
})();
export function logfitGroup(rng, fixed) {
  const pre = fixed && fixed.pre ? LOGFIT_PRESETS.find(p => p.a0 === fixed.pre.a0 && p.b === fixed.pre.b && p.xp === fixed.pre.xp) : rng.pick(LOGFIT_PRESETS);
  if (!pre) throw new Error("第 18～20 題找不到指定的參數組");
  const { a0, b, xp, Yp, ys, Ys } = pre;
  const scen = P(fixed, rng, "scen", r => r.pick(["startup", "app", "ev"]));
  const w = { startup: ["某新創公司", "年營收", "百萬元"], app: ["某款手機應用程式", "年度活躍用戶數", "萬人"], ev: ["某電動車品牌在某國的", "年銷量", "千輛"] }[scen];
  const y0 = 2021; const years = [0, 1, 2, 3, 4].map(i => y0 + i);
  const meanY = +(a0 + 2 * b).toFixed(2);
  const fracDigit = Math.round((Yp - 2) * 10); const factor = TEN[fracDigit];
  const yp = Math.round(100 * factor);
  const rate = Math.round((Math.pow(10, b) - 1) * 100);
  const growthApprox = TEN[Math.round(b * 10)];
  const bDigit = Math.round(b * 10), aInt = Math.floor(a0 + 1e-9), aDec = Math.round((a0 - aInt) * 100);
  const aDecDigits = String(aDec).padStart(2, "0").split("");
  const Y2 = Ys.map(v => v.toFixed(2));
  const context = `${w[0]} ${years[0]} 年至 ${years[4]} 年的${w[1]}（單位：${w[2]}）如下表。令 $x$ 表示年份代號（${years[0]} 年 $x=0$，${years[1]} 年 $x=1$，依此類推），$y$ 表示該年的${w[1]}。` +
    `<table><tr><th>年份</th>${years.map(y => `<td>${y}</td>`).join("")}</tr><tr><th>$x$</th>${[0, 1, 2, 3, 4].map(x => `<td>${x}</td>`).join("")}</tr><tr><th>$y$（${w[2]}）</th>${ys.map(y => `<td>${y}</td>`).join("")}</tr></table>` +
    `分析師發現 $y$ 隨 $x$ 大致呈等比成長，於是令 $Y=\\log y$（常用對數），得到 $Y$ 的值（四捨五入至小數第二位）依序為 ${Y2.join("、")}。` +
    `已知 $x$ 的算術平均數 $\\bar{x}=2$，$Y$ 的算術平均數 $\\bar{Y}=${meanY.toFixed(2)}$，且 $\\sum_{i=1}^{5}(x_i-\\bar{x})(Y_i-\\bar{Y})=${(10 * b).toFixed(2)}$，$\\sum_{i=1}^{5}(x_i-\\bar{x})^2=10$，$x$ 與 $Y$ 的相關係數約為 0.9999。` +
    `（計算時可取 $10^{0.${fracDigit}}\\approx ${factor.toFixed(2)}$${fracDigit !== bDigit ? `，$10^{0.${bDigit}}\\approx ${growthApprox.toFixed(2)}$` : ""}。）`;
  const params = { xs: [0, 1, 2, 3, 4], ys, Ys, a0, b, xp, Yp, yp, years, rate, unit: w[2], label: w[1] };
  const lineTex = `Y=${b}x+${a0.toFixed(2)}`;
  const q18 = {
    slot: 18, kind: "fill", group: "g18", vol: "數學2", unit: "數據分析", topic: "迴歸直線（取對數後的線性關係）", diff: 3, anim: "q18", params,
    stem: `$Y$ 對 $x$ 的迴歸直線方程式為 $Y=0.\\b{1}\\,x+${aInt}.\\b{2}\\b{3}$。`,
    blanks: [{ ans: String(bDigit) }, { ans: aDecDigits[0] }, { ans: aDecDigits[1] }],
    core: `${w[1]}每年乘上一個固定倍率，看起來是往上彎的曲線；但取對數之後，「每年乘固定倍率」變成「每年加固定數」，點就排成一直線。迴歸直線一定通過 $(\\bar{x},\\bar{Y})$，斜率由 $\\frac{\\sum(x_i-\\bar{x})(Y_i-\\bar{Y})}{\\sum(x_i-\\bar{x})^2}$ 決定。`,
    why: "混合題近年偏好「真實資料＋數學模型」的素養情境，而「取對數後做線性迴歸」正是數學 2 數據分析與數學 1 對數的自然結合，很可能成為題組的骨幹。",
    solution: [
      `斜率 $b=\\frac{\\sum(x_i-\\bar{x})(Y_i-\\bar{Y})}{\\sum(x_i-\\bar{x})^2}=\\frac{${(10 * b).toFixed(2)}}{10}=${b}$。`,
      `迴歸直線通過 $(\\bar{x},\\bar{Y})=(2,${meanY.toFixed(2)})$，截距 $a=${meanY.toFixed(2)}-${b}\\times 2=${a0.toFixed(2)}$。`,
      `故 $${lineTex}$。`
    ],
    answerText: `Y = ${b}x + ${a0.toFixed(2)}`
  };
  const ypDigits = String(yp).split("");
  const q19 = {
    slot: 19, kind: "fill", group: "g18", vol: "數學1", unit: "指數與對數", topic: "利用迴歸直線預測並還原對數", diff: 3, anim: "q19", params,
    stem: `依第 18 題的迴歸直線預測，${years[0] + xp} 年（$x=${xp}$）的${w[1]}約為 $${ypDigits.map((_, i) => `\\b{${i + 1}}`).join("")}$ ${w[2]}。（四捨五入至整數）`,
    blanks: ypDigits.map(d => ({ ans: d })),
    core: `迴歸直線給的是 $Y=\\log y$ 的預測值，最後要記得「還原」：$y=10^{Y}$。$10^{${Yp.toFixed(1)}}=10^2\\times 10^{0.${fracDigit}}$，把整數部分與小數部分拆開，就能用題目給的近似值算出來。`,
    why: "「代入迴歸直線外推，再把對數還原成原量」是這類題組必有的第二步，測驗的是對數與指數互為反運算的理解。",
    solution: [
      `代入 $x=${xp}$：$Y=${b}\\times ${xp}+${a0.toFixed(2)}=${Yp.toFixed(1)}$。`,
      `還原：$y=10^{${Yp.toFixed(1)}}=10^2\\times 10^{0.${fracDigit}}\\approx 100\\times ${factor.toFixed(2)}=${yp}$。`,
      `故預測約為 ${yp} ${w[2]}。`
    ],
    answerText: String(yp)
  };
  const q20 = {
    slot: 20, kind: "open", group: "g18", vol: "數學1", unit: "指數與對數", topic: "等比成長與對數線性的關係、成長率估計", diff: 4, anim: "q20", params,
    stem: `若該${w[1]}每年皆以固定的比率成長，試說明為何 $Y=\\log y$ 與 $x$ 之間會呈現線性關係；並依第 18 題的迴歸直線，估計${w[1]}的年成長率（以百分比表示，四捨五入至整數）。（非選擇題，請寫出理由與計算過程）`,
    core: `等比數列取對數會變成等差數列：$y=y_0 r^x$ 兩邊取 $\\log$ 得 $\\log y=\\log y_0+x\\log r$，這是斜率 $\\log r$ 的直線。所以迴歸直線的斜率 ${b} 不是「每年多 ${b}」，而是「每年乘上 $10^{${b}}$」。`,
    why: "非選擇題通常要求「說明為什麼」，而「等比取對數變等差」是整個題組的觀念核心，最適合作為需要文字論證的壓軸小題。",
    rubric: [
      `設每年成長倍率為 $r$，初始值 $y_0$，則第 $x$ 年 $y=y_0\\,r^x$。（1 分）`,
      `兩邊取常用對數：$Y=\\log y=\\log y_0+x\\log r$，是 $x$ 的一次函數，故 $Y$ 與 $x$ 呈線性關係，且直線斜率為 $\\log r$。（2 分）`,
      `由迴歸直線斜率 $\\log r=${b}$，得 $r=10^{${b}}\\approx ${growthApprox.toFixed(2)}$。（1 分）`,
      `年成長率約為 $${growthApprox.toFixed(2)}-1=${(growthApprox - 1).toFixed(2)}$，即約 ${rate}%。（1 分）`
    ],
    solution: [
      `若每年以固定比率成長，設倍率為 $r$、初始值 $y_0$，則 $y=y_0 r^x$，這是等比型的指數成長。`,
      `取對數：$Y=\\log y=\\log y_0+(\\log r)\\,x$。$\\log y_0$ 與 $\\log r$ 都是常數，所以 $Y$ 是 $x$ 的一次函數，圖形為直線，斜率即 $\\log r$。`,
      `迴歸直線 $${lineTex}$ 的斜率 ${b} 即為 $\\log r$，故 $r=10^{${b}}\\approx ${growthApprox.toFixed(2)}$，年成長率約 $${rate}\\%$。`,
      `驗算：$${ys[0]}\\times ${growthApprox.toFixed(2)}^4\\approx ${fmt(ys[0] * Math.pow(growthApprox, 4), 1)}$，與 ${years[4]} 年的 ${ys[4]} 相近。`
    ],
    answerText: `年成長率約 ${rate}%`
  };
  return { group: { id: "g18", title: "第 18 至 20 題為題組", context }, questions: [q18, q19, q20] };
}
