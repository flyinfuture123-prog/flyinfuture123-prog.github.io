// 學測數A預測題庫 —— 題型模板（第 1～10 題）
// 每個模板：slotN(rng, fixed) → 題目物件（不含題號、配分與全卷空格編號，由 paper.mjs 補上）。
// fixed 給定時直接使用該組參數（第 1 回沿用手寫版的數字）。
import { fracTex, fracText, sqrtTex, linTex, polyTex, polyMul, polyAdd, polyEval, piFrac, piText, ptTex, fmt, makeOptions, makeMulti, reduce, gcd } from "./util.mjs";

const P = (fixed, rng, key, f) => (fixed && fixed[key] !== undefined ? fixed[key] : f(rng));

/* ---------- 第 1 題：絕對值＝距離 ---------- */
export function slot1(rng, fixed) {
  const a = P(fixed, rng, "a", r => r.int(-2, 3));
  const gap = P(fixed, rng, "gap", r => r.pick([2, 2, 3, 4]));
  const b = a + gap;
  const ext = P(fixed, rng, "ext", r => r.pick([1, 1, 2, 3])); // 兩端各多出的長度
  const c = gap + 2 * ext;
  const lo = a - ext, hi = b + ext, count = hi - lo + 1;
  const opts = makeOptions(rng, count, [count - 2, count - 1, count + 1, count + 2, gap + 1], (v) => `$${v}$`);
  const A = (v) => (v < 0 ? `(x${v})` : `(x-${v})`);
  const abs = (v) => (v === 0 ? "|x|" : v < 0 ? `|x+${-v}|` : `|x-${v}|`);
  return {
    slot: 1, kind: "single", vol: "數學1", unit: "數與式", topic: "絕對值與數線上的距離", diff: 1, anim: "q1",
    params: { a, b, c },
    stem: `滿足不等式 $${abs(a)}+${abs(b)}\\le ${c}$ 的整數 $x$ 共有幾個？`,
    options: opts.options, answer: opts.answer,
    core: `絕對值 $|x-a|$ 就是數線上 $x$ 到 $a$ 的距離。這題問的是：到 ${a} 和到 ${b} 的距離總和不超過 ${c} 的點在哪裡。`,
    why: "數與式單元通常以一題快速題出現，而絕對值不等式若用「距離」理解，可以不必分段討論就直接看出答案，是命題者喜歡用來區分「會算」與「懂意義」的題型。",
    solution: [
      `把 $${abs(a)}+${abs(b)}$ 看成數線上點 $x$ 到 ${a}、到 ${b} 的距離和。`,
      `當 $${a}\\le x\\le ${b}$ 時，兩段距離合起來剛好是 ${a} 到 ${b} 的長度 ${gap}，恆小於 ${c}，全部符合。`,
      `當 $x>${b}$ 時，$x$ 每向右移 1，兩個距離各增加 1，距離和多 2；由 $x=${b}$ 時的 ${gap} 增加到 ${c}，只能再向右 ${ext}，故 $x\\le ${hi}$。同理向左到 $x\\ge ${lo}$。`,
      `解為 $${lo}\\le x\\le ${hi}$，整數解共 ${count} 個。也可分段計算：$x\\le ${a}$ 時 $${linTex(-2, a + b)}\\le ${c}$ 得 $x\\ge ${lo}$；$x\\ge ${b}$ 時 $${linTex(2, -(a + b))}\\le ${c}$ 得 $x\\le ${hi}$。`
    ],
    answerText: `(${opts.answer})`
  };
}

/* ---------- 第 2 題：餘式定理 ---------- */
export function slot2(rng, fixed) {
  const pair = P(fixed, rng, "roots", r => r.pick([[1, 2], [1, 3], [2, 3], [-1, 1], [0, 2], [-1, 2]]));
  const [r1, r2] = pair;
  const m = P(fixed, rng, "m", r => r.pick([1, 2, 2, 3, -1]));
  const n = P(fixed, rng, "n", r => r.int(-2, 3));
  const a = P(fixed, rng, "a", r => r.int(-2, 3));
  const x3 = P(fixed, rng, "x3", r => { const cands = [r2 + 1, r2 + 2, r1 - 1].filter(v => v !== r1 && v !== r2); return r.pick(cands); });
  const x0 = P(fixed, rng, "x0", r => { const cands = [0, -1, 1, r1 - 1].filter(v => v !== r1 && v !== r2 && v !== x3); return r.pick(cands); });
  const f = (x) => (x - r1) * (x - r2) * (x - a) + m * x + n;
  const f3 = f(x3), ans = f(x0), lineAt0 = m * x0 + n;
  const opts = makeOptions(rng, ans, [lineAt0, ans - 2, ans + 2, ans + 4, ans - 4, ans + 6], (v) => `$${v}$`);
  const D = polyMul([1, -r1], [1, -r2]);
  const fac = (r) => (r === 0 ? "x" : `(${linTex(1, -r)})`);
  const divisor = `${fac(r1)}${fac(r2)}`;
  const rem = linTex(m, n);
  const q = `(x${a < 0 ? "+" + (-a) : a > 0 ? "-" + a : ""})`;
  const q3 = `(${x3 - r1})\\cdot(${x3 - r2})\\cdot(${x3}-a)`;
  const remAt3 = m * x3 + n;
  const kk = (x3 - r1) * (x3 - r2);
  return {
    slot: 2, kind: "single", vol: "數學1", unit: "多項式函數", topic: "餘式定理與三次多項式", diff: 3, anim: "q2",
    params: { r1, r2, a, m, n, x3, x0 },
    stem: `設 $f(x)$ 為首項係數為 1 的三次多項式。已知 $f(x)$ 除以 $${divisor}$ 的餘式為 $${rem}$，且 $f(${x3})=${f3}$，則 $f(${x0})$ 之值為何？`,
    options: opts.options, answer: opts.answer,
    core: `「除以 $${divisor}$ 餘 $${rem}$」的幾何意思是：曲線 $y=f(x)$ 在 $x=${r1}$、$x=${r2}$ 兩處恰好與直線 $y=${rem}$ 相交。差 $f(x)-(${rem})$ 就一定含因式 $${divisor}$。`,
    why: "餘式定理是多項式單元最穩定的考點。以「餘式為一次式」搭配一個額外條件決定剩餘因式，是近年單選題的標準寫法。",
    solution: [
      `由除法原理，$f(x)=${divisor}\\,q(x)+${rem}$；$f(x)$ 是首項係數 1 的三次式，故商 $q(x)=x-a$ 為一次式。`,
      `代入 $x=${x3}$：$f(${x3})=${q3}${remAt3 >= 0 ? "+" + remAt3 : remAt3}=${f3}$，得 $${kk}(${x3}-a)=${f3 - remAt3}$，$a=${a}$。`,
      `所以 $f(x)=${divisor}${q}+${rem}$，$f(${x0})=(${x0 - r1})(${x0 - r2})(${x0 - a})${lineAt0 >= 0 ? "+" + lineAt0 : lineAt0}=${ans}$。`
    ],
    answerText: `(${opts.answer})`
  };
}

/* ---------- 第 3 題：弦長與圓心到直線距離 ---------- */
export function slot3(rng, fixed) {
  const h = P(fixed, rng, "h", r => r.int(-2, 3));
  const k = P(fixed, rng, "k", r => r.int(-2, 2));
  const rd = P(fixed, rng, "rd", r => r.pick([[3, 2], [3, 1], [5, 3], [5, 4], [4, 2], [5, 2]]));
  const [rad, d] = rd;
  const pq = P(fixed, rng, "pq", r => r.pick([[3, 4], [4, 3], [3, -4], [4, -3]]));
  const [p, q] = pq;
  const half2 = rad * rad - d * d; // 半弦長平方
  const base = p * h + q * k;
  const K1 = -base + 5 * d, K2 = -base - 5 * d;
  const K = P(fixed, rng, "which", r => r.pick([0, 1])) === 0 ? K1 : K2;
  const other = K === K1 ? K2 : K1;
  const opts = makeOptions(rng, K, [K - 2, K + 2, K - 4, K + 6, K + 10, K - 6, K + 4].filter(v => v !== other), (v) => `$${v}$`);
  const chordTex = sqrtTex(4 * half2);
  const halfTex = sqrtTex(half2);
  const general = polyTex([1, -2 * h, h * h + k * k - rad * rad], "x").replace(/^x\^\{2\}/, "x^2");
  const circleTex = `x^2+y^2${linTex(-2 * h, 0) ? (h !== 0 ? `${-2 * h > 0 ? "+" : ""}${-2 * h}x` : "") : ""}${k !== 0 ? `${-2 * k > 0 ? "+" : ""}${-2 * k}y` : ""}${h * h + k * k - rad * rad !== 0 ? `${h * h + k * k - rad * rad > 0 ? "+" : ""}${h * h + k * k - rad * rad}` : ""}=0`;
  const lineTex = `${linTex(p, 0)}${q > 0 ? "+" : "-"}${Math.abs(q) === 1 ? "" : Math.abs(q)}y+k=0`;
  const sq = (v) => (v < 0 ? `(y+${-v})` : v === 0 ? "y" : `(y-${v})`);
  const sx = (v) => (v < 0 ? `(x+${-v})` : v === 0 ? "x" : `(x-${v})`);
  return {
    slot: 3, kind: "single", vol: "數學1", unit: "直線與圓", topic: "弦長與圓心到直線的距離", diff: 2, anim: "q3",
    params: { h, k, r: rad, p, q, K, other, d },
    stem: `坐標平面上，圓 $C: ${circleTex}$ 與直線 $L: ${lineTex}$ 相交於 $A$、$B$ 兩點。若 $\\ol{AB}=${chordTex}$，則 $k$ 的值可能為何？`,
    options: opts.options, answer: opts.answer,
    core: `圓心到弦的垂線把弦平分，於是「半徑、圓心到直線的距離、半弦長」構成直角三角形：$r^2=d^2+(\\tfrac{\\ol{AB}}{2})^2$。弦長固定，就等於在固定圓心到直線的距離。`,
    why: "配方求圓心半徑、再用點到直線距離公式，是直線與圓單元每年幾乎必考的一條路；以「弦長已知求參數」出題可以同時檢查這兩個工具。",
    solution: [
      `配方：$${sx(h)}^2+${sq(k)}^2=${rad * rad}$，圓心 $(${h},${k})$，半徑 $r=${rad}$。`,
      `弦長 $${chordTex}$，半弦長 $${halfTex}$，由 $r^2=d^2+${half2}$ 得圓心到 $L$ 的距離 $d=${d}$。`,
      `距離公式：$d=\\frac{|${p}\\cdot${h < 0 ? `(${h})` : h}+${q < 0 ? `(${q})` : q}\\cdot${k < 0 ? `(${k})` : k}+k|}{5}=\\frac{|k${base >= 0 ? "+" + base : base}|}{5}=${d}$，得 $k=${K1}$ 或 $k=${K2}$。選項中只有 ${K}。`
    ],
    answerText: `(${opts.answer})`
  };
}

/* ---------- 第 4 題：三角函數圖形的伸縮與平移 ---------- */
export function slot4(rng, fixed) {
  const A = P(fixed, rng, "A", r => r.pick([2, 3, 3]));
  const b = 2;
  const phi = P(fixed, rng, "phi", r => r.pick([[1, 3], [1, 6], [1, 4], [2, 3], [1, 2]])); // φ = phi[0]/phi[1] · π
  const dd = P(fixed, rng, "d", r => r.pick([1, -1, 2, 1]));
  // 最高點：2x − φ = π/2 → x = (π/2 + φ)/2 = (1/4 + φ/2)π
  const [pn, pd] = phi;
  const xm = reduce(pn * 2 + pd * 1, 4 * pd); // (1/4 + pn/(2pd)) = (pd + 2pn)/(4pd)
  const wrongShift = reduce(pd + 4 * pn, 4 * pd); // π/4 + φ（把 φ 當成平移量）
  const wrong2 = reduce(pd - 2 * pn, 4 * pd); // (π/2 − φ)/2
  const wrong3 = reduce(pn, 2 * pd); // φ/2
  const wrong4 = [1, 4]; const wrong5 = [1, 2]; const wrong6 = reduce(pd + 2 * pn + 4 * pd, 4 * pd); // + π
  const key = (v) => `${v[0]}/${v[1]}`;
  const cands = [wrongShift, wrong2, wrong3, wrong4, wrong5, [1, 12], [11, 12], [3, 4]].filter(v => v[0] > 0 && v[0] <= v[1]);
  const opts = makeOptions(rng, xm, cands, (v) => `$${piFrac(v[0], v[1])}$`, key);
  // 排序：依數值
  const vals = opts.options.map(o => o); // 已由 makeOptions 打亂（非數值不排序），這裡依大小重排
  const parsed = [xm, ...cands].filter((v, i, arr) => arr.findIndex(w => key(w) === key(v)) === i);
  const chosen = opts.options.map(o => parsed.find(v => `$${piFrac(v[0], v[1])}$` === o)).sort((u, v) => u[0] / u[1] - v[0] / v[1]);
  const options = chosen.map(v => `$${piFrac(v[0], v[1])}$`);
  const answer = chosen.findIndex(v => key(v) === key(xm)) + 1;
  const phiTex = piFrac(pn, pd), halfPhiTex = piFrac(pn, 2 * pd);
  const shift = reduce(pn, 2 * pd);
  const fTex = `${A}\\sin\\!\\left(2x-${phiTex}\\right)${dd >= 0 ? "+" + dd : dd}`;
  return {
    slot: 4, kind: "single", vol: "數學3A", unit: "三角", topic: "三角函數圖形的伸縮與平移", diff: 2, anim: "q4",
    params: { A, b, phi: [pn, pd], d: dd, xm },
    stem: `設 $f(x)=${fTex}$。在 $0\\le x\\le\\pi$ 的範圍內，$f(x)$ 的最大值發生在 $x$ 等於下列何者時？`,
    options, answer,
    core: `$${fTex}=${A}\\sin 2\\left(x-${halfPhiTex}\\right)${dd >= 0 ? "+" + dd : dd}$：先把 $\\sin x$ 橫向壓成一半（週期 $\\pi$），再右移 $${halfPhiTex}$，最後拉高 ${A} 倍、${dd >= 0 ? "上移 " + dd : "下移 " + (-dd)}。最大值就發生在「括號裡的角等於 $\\frac{\\pi}{2}$」的地方。`,
    why: "把 $y=\\sin x$ 經過振幅、週期、相位、上下平移四種變換，是 3A 三角函數圖形的核心；「相位要先提出週期係數」是最常見的失分點，因此年年有類似考題。",
    solution: [
      `$\\sin\\theta$ 在 $\\theta=\\frac{\\pi}{2}+2n\\pi$ 時最大。令 $2x-${phiTex}=\\frac{\\pi}{2}+2n\\pi$，得 $x=${piFrac(xm[0], xm[1])}+n\\pi$。`,
      `在 $0\\le x\\le\\pi$ 中只有 $x=${piFrac(xm[0], xm[1])}$，此時 $f(x)=${A}\\cdot 1${dd >= 0 ? "+" + dd : dd}=${A + dd}$。`,
      `常見錯誤：把 $2x-${phiTex}$ 誤當成「右移 $${phiTex}$」，會得到 $\\frac{\\pi}{4}+${phiTex}=${piFrac(wrongShift[0], wrongShift[1])}$，這正是選項裡的陷阱。`
    ],
    answerText: `(${answer})`
  };
}

/* ---------- 第 5 題：貝氏定理 ---------- */
export function slot5(rng, fixed) {
  const N = 2000;
  const preset = P(fixed, rng, "preset", r => r.pick([[1, 90, 5], [1, 95, 5], [1, 80, 10], [2, 90, 5], [2, 95, 10], [5, 90, 5], [5, 80, 2], [5, 95, 10], [2, 80, 5]]));
  const [prev, sens, fp] = preset;
  const sick = N * prev / 100, sickPos = Math.round(sick * sens / 100), healthy = N - sick, healthyPos = Math.round(healthy * fp / 100);
  const posAll = sickPos + healthyPos;
  const exact = sickPos / posAll * 100;
  const ans = Math.round(exact / 5) * 5; // 最接近的 5 的倍數
  const cands = [sens, 100 - fp, 50, 5, 10, 95, 30, 70].filter(v => Math.abs(v - ans) >= 8);
  const opts = makeOptions(rng, ans, cands, (v) => `${v}%`);
  const scenario = P(fixed, rng, "scenario", r => r.pick(["disease", "disease", "spam", "defect"]));
  const words = {
    disease: { pop: "某疾病在某地區的盛行率為", test: "一種快篩試劑對患病者有", posw: "呈陽性", neg: "對未患病者有", fpw: "呈陽性（偽陽性）", draw: "今從該地區隨機抽出一人做快篩，結果為陽性，則此人確實患病的機率最接近下列何者？", A: "患病", B: "陽性", unitA: "患病者", unitB: "未患病者" },
    spam: { pop: "某信箱收到的郵件中，垃圾郵件的比例為", test: "一套過濾程式對垃圾郵件有", posw: "被標記為垃圾郵件", neg: "對正常郵件也有", fpw: "被誤標為垃圾郵件", draw: "今隨機抽出一封被標記為垃圾郵件的信，則它確實是垃圾郵件的機率最接近下列何者？", A: "垃圾郵件", B: "被標記", unitA: "垃圾郵件", unitB: "正常郵件" },
    defect: { pop: "某工廠生產的零件中，瑕疵品的比例為", test: "一台檢測儀對瑕疵品有", posw: "被判定為不合格", neg: "對良品也有", fpw: "被誤判為不合格", draw: "今隨機抽出一個被判定為不合格的零件，則它確實是瑕疵品的機率最接近下列何者？", A: "瑕疵", B: "判定不合格", unitA: "瑕疵品", unitB: "良品" }
  }[scenario];
  return {
    slot: 5, kind: "single", vol: "數學2", unit: "機率", topic: "條件機率與貝氏定理", diff: 3, anim: "q5",
    params: { N, prev, sens, fp, sick, sickPos, healthy, healthyPos, labels: { A: words.A, B: words.B, unitA: words.unitA, unitB: words.unitB } },
    stem: `${words.pop} ${prev}%。${words.test} ${sens}% 的機率${words.posw}，${words.neg} ${fp}% 的機率${words.fpw}。${words.draw}`,
    options: opts.options, answer: opts.answer,
    core: `條件機率就是「縮小樣本空間」：既然已知結果為${words.B}，就只看${words.B}的那些。其中真正${words.A}的其實是少數，因為${words.unitB}多太多了，就算誤判率只有 ${fp}%，人數仍然壓過${words.unitA}。`,
    why: "貝氏定理自 108 課綱納入數學 2 後，篩檢、檢測、垃圾郵件判別等情境反覆出現在學測數A。「陽性也不代表很可能生病」這種反直覺結論，最適合拿來考觀念。",
    solution: [
      `假設有 ${N} 個：${words.unitA} $${N}\\times ${prev}\\%=${sick}$ 個，其中${words.B} $${sick}\\times ${sens}\\%=${sickPos}$ 個；${words.unitB} ${healthy} 個，其中${words.B} $${healthy}\\times ${fp}\\%=${healthyPos}$ 個。`,
      `${words.B}共 $${sickPos}+${healthyPos}=${posAll}$ 個，其中真正${words.A}的有 ${sickPos} 個。`,
      `所求 $=\\frac{${sickPos}}{${posAll}}\\approx ${fmt(exact / 100, 3)}$，最接近 ${ans}%。用公式寫即 $\\frac{${fmt(prev / 100, 2)}\\times ${fmt(sens / 100, 2)}}{${fmt(prev / 100, 2)}\\times ${fmt(sens / 100, 2)}+${fmt(1 - prev / 100, 2)}\\times ${fmt(fp / 100, 2)}}$。`
    ],
    answerText: `(${opts.answer})`
  };
}

/* ---------- 第 6 題：線性變換與行列式 ---------- */
export function slot6(rng, fixed) {
  const M = P(fixed, rng, "M", r => r.pick([[2, 1, 1, 3], [3, 1, 2, 2], [2, 1, 1, 2], [1, 2, 1, 4], [3, 2, 1, 2], [2, 3, 1, 3], [1, 1, 2, 5], [2, 1, 3, 4]]));
  const [a, b, c, d] = M; const det = a * d - b * c;
  const S = P(fixed, rng, "S", r => r.pick([3, 4, 5, 6, 2]));
  const ans = Math.abs(det) * S;
  const opts = makeOptions(rng, ans, [S, (a + d) * S, a * d * S, (Math.abs(det) + 1) * S, (Math.abs(det) + 2) * S, (Math.abs(det) - 1) * S].filter(v => v > 0), (v) => `$${v}$`);
  const map = `(${linTex(a, 0)}${b > 0 ? "+" : "-"}${Math.abs(b) === 1 ? "" : Math.abs(b)}y,\\ ${linTex(c, 0)}${d > 0 ? "+" : "-"}${Math.abs(d) === 1 ? "" : Math.abs(d)}y)`;
  return {
    slot: 6, kind: "single", vol: "數學4A", unit: "矩陣", topic: "線性變換與行列式（面積倍率）", diff: 2, anim: "q6",
    params: { a, b, c, d, S, tri: [[0, 0], [2, 0], [1, S]] },
    stem: `坐標平面上有一線性變換 $T$，將點 $(x,y)$ 映至 $${map}$。已知 $\\triangle ABC$ 的面積為 ${S}，則 $T$ 將 $\\triangle ABC$ 映成的三角形，其面積為何？`,
    options: opts.options, answer: opts.answer,
    core: `線性變換把單位正方形變成以 $(${a},${c})$、$(${b},${d})$ 為鄰邊的平行四邊形，其面積就是行列式的絕對值 $|${a}\\cdot ${d}-${b}\\cdot ${c}|=${Math.abs(det)}$。任何圖形都被同一個倍率放大，所以面積一律乘 ${Math.abs(det)}。`,
    why: "4A 的矩陣單元中，「行列式＝面積倍率」是連結代數與幾何的關鍵觀念，命題者常用它取代繁瑣的座標計算，來測驗學生是否真的理解線性變換。",
    solution: [
      `$T$ 對應的矩陣為 $A=\\mat{${a}&${b}\\\\${c}&${d}}$，$\\det A=${a}\\cdot ${d}-${b}\\cdot ${c}=${det}$。`,
      `線性變換後的面積 $=|\\det A|\\times$ 原面積 $=${Math.abs(det)}\\times ${S}=${ans}$。`
    ],
    answerText: `(${opts.answer})`
  };
}

/* ---------- 第 7 題：三次函數圖形（多選）---------- */
export function slot7(rng, fixed) {
  const h = P(fixed, rng, "h", r => r.pick([0, 0, 1, -1]));
  const q = P(fixed, rng, "q", r => r.pick([1, 1, 2, -1, 3]));
  // f(x) = (x-h)^3 - 3(x-h) + q
  const coefs = polyAdd(polyAdd(polyMul(polyMul([1, -h], [1, -h]), [1, -h]), [-3, 3 * h]), [q]);
  const fTex = polyTex(coefs);
  const M = q + 2, m = q - 2; // 局部極大／極小值，位置 x = h−1、h+1
  const f = (x) => polyEval(coefs, x);
  const sh = (v) => (v === 0 ? "x" : v > 0 ? `(x-${v})` : `(x+${-v})`);
  const pool = [
    { text: `$y=f(x)$ 的圖形對稱於點 $(${h},${q})$`, ok: true, why: `$f(x)-${q}=${sh(h)}^3-3${sh(h)}$ 對 $x=${h}$ 為奇對稱，圖形對稱於 $(${h},${q})$。` },
    { text: `$y=f(x)$ 的圖形對稱於點 $(${h},${q + 1})$`, ok: false, why: `對稱中心是 $(${h},${q})$，不是 $(${h},${q + 1})$。` },
    { text: h === 0 ? `對所有實數 $x$，$f(-x)=-f(x)$` : `對所有實數 $x$，$f(${h}+x)+f(${h}-x)=${2 * q}$`, ok: h !== 0, why: h === 0 ? `$f(0)=${q}\\ne 0$，$f$ 本身不是奇函數。` : `由對稱中心 $(${h},${q})$ 知 $f(${h}+x)+f(${h}-x)=2\\cdot ${q}$。` },
    { text: `方程式 $f(x)=${M}$ 恰有兩個相異實根`, ok: true, why: `$f(x)-${M}=${sh(h - 1)}^2${sh(h + 2)}$，實根為 $${h - 1}$（重根）與 $${h + 2}$，恰兩個相異實根。` },
    { text: `方程式 $f(x)=${M + 1}$ 有三個相異實根`, ok: false, why: `$${M + 1}$ 超過局部極大值 ${M}，水平線只與圖形交於一點，只有一個實根。` },
    { text: `方程式 $f(x)=0$ 有三個相異實根`, ok: m < 0 && 0 < M, why: (m < 0 && 0 < M) ? `局部極小值 ${m}<0<${M} 局部極大值，水平線 $y=0$ 與圖形交於三點。可驗證 $f(${h - 2})=${f(h - 2)}$、$f(${h - 1})=${f(h - 1)}$、$f(${h + 1})=${f(h + 1)}$、$f(${h + 2})=${f(h + 2)}$ 三次變號。` : m === 0 ? `局部極小值恰為 0，$y=0$ 與圖形在 $x=${h + 1}$ 相切，只有兩個相異實根。` : `局部極小值為 $${m}>0$，$y=0$ 在整個圖形的低點下方，只有一個實根。` },
    { text: `方程式 $f(x)=${q}$ 有三個相異實根`, ok: true, why: `$f(x)-${q}=${sh(h)}\\left(${sh(h)}^2-3\\right)$，實根 $x=${h}$、$${h}\\pm\\sqrt{3}$。` },
    { text: `當 $x>${h + 1}$ 時，$f(x)>${m}$`, ok: true, why: `$f(x)-(${m})=${sh(h + 1)}^2${sh(h - 2)}$，$x>${h + 1}$ 時為正，故 $f(x)>${m}$。` },
    { text: `當 $x>${h + 1}$ 時，$f(x)>${M}$`, ok: false, why: `$f(${h + 1.5})$ 仍小於 ${M}；要到 $x>${h + 2}$ 之後 $f(x)$ 才超過 ${M}。` },
    { text: `當 $x>${h + 2}$ 時，$f(x)>${M}$`, ok: true, why: `$x>${h + 2}$ 時 $${sh(h - 1)}^2${sh(h + 2)}>0$，即 $f(x)>${M}$。` }
  ];
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 7, kind: "multi", vol: "數學1", unit: "多項式函數", topic: "三次函數圖形與方程式實根個數", diff: 3, anim: "q7",
    params: { h, q, coefs, M, m },
    stem: `設 $f(x)=${fTex}$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: `三次函數圖形一定有一個對稱中心。用一條水平線 $y=k$ 掃過圖形，交點個數就是方程式 $f(x)=k$ 的實根個數：3 個、2 個（其中一個是相切的重根）或 1 個。`,
    why: "三次函數圖形（對稱中心、局部高低點）搭配「方程式實根個數」，是 108 課綱多項式單元最典型的多選題；不用微積分也能透過因式分解與正負判斷完成。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}

/* ---------- 第 8 題：遞迴數列 ---------- */
export function slot8(rng, fixed) {
  const combo = P(fixed, rng, "combo", r => r.pick([[2, 1], [2, 1], [2, 2], [3, 2]]));
  const [p, rr] = combo; const s = rr / (p - 1); // a_n + s 為等比
  const a1 = P(fixed, rng, "a1", r => r.pick([1, 1, 2]));
  const seq = [a1]; for (let i = 1; i < 6; i++) seq.push(p * seq[i - 1] + rr);
  const first = a1 + s; // 等比首項
  const N = 10;
  // a_n = first·p^{n-1} − s；Σ = first·(p^N − 1)/(p − 1) − N s
  const geo = first * (Math.pow(p, N) - 1) / (p - 1);
  const sum = geo - N * s;
  const powTex = first === 1 ? `${p}^{n-1}` : first === p ? `${p}^{n}` : `${first}\\cdot ${p}^{n-1}`;
  const formulaTex = `${powTex}-${s}`;
  const sumTex = first === p ? `\\frac{${p}(${p}^{${N}}-1)}{${p - 1}}-${N * s}` : `\\frac{${first}(${p}^{${N}}-1)}{${p - 1}}-${N * s}`;
  const pool = [
    { text: `$a_3=${seq[2]}$`, ok: true, why: `$a_2=${seq[1]}$，$a_3=${seq[2]}$。` },
    { text: `$a_4=${seq[3] + rr}$`, ok: false, why: `$a_4=${p}\\cdot ${seq[2]}+${rr}=${seq[3]}$。` },
    { text: `$\\langle a_n+${s}\\rangle$ 為等比數列`, ok: true, why: `$a_{n+1}+${s}=${p}(a_n+${s})$，首項 $a_1+${s}=${first}$，公比 ${p}。` },
    { text: `$a_n=${formulaTex}$`, ok: true, why: `$a_n+${s}=${first}\\cdot ${p}^{n-1}$，故 $a_n=${formulaTex}$。` },
    { text: `$\\sum_{k=1}^{${N}}a_k=${sumTex}$`, ok: true, why: `$\\sum(${first}\\cdot ${p}^{k-1}-${s})=${first}\\cdot\\frac{${p}^{${N}}-1}{${p - 1}}-${N}\\cdot ${s}=${sum}$。` },
    { text: `$\\langle a_n\\rangle$ 為等差數列`, ok: false, why: `$a_2-a_1=${seq[1] - seq[0]}$，$a_3-a_2=${seq[2] - seq[1]}$，差不固定。` },
    { text: `$\\langle a_n\\rangle$ 為等比數列`, ok: false, why: `$\\frac{a_2}{a_1}=${fracTex(seq[1], seq[0])}$，$\\frac{a_3}{a_2}=${fracTex(seq[2], seq[1])}$，比不固定。` }
  ];
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 8, kind: "multi", vol: "數學2", unit: "數列與級數", topic: "遞迴數列化為等比數列", diff: 2, anim: "q8",
    params: { p, r: rr, s, a1, seq: seq.slice(0, 5), first },
    stem: `數列 $\\langle a_n\\rangle$ 滿足 $a_1=${a1}$，且對所有正整數 $n$，$a_{n+1}=${p}a_n+${rr}$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: `$a_{n+1}=${p}a_n+${rr}$ 是「乘 ${p} 再加 ${rr}」。只要把每一項都加 ${s}，就變成純粹的「乘 ${p}」：$a_{n+1}+${s}=${p}(a_n+${s})$，等比數列立刻現形。這個「平移到不動點」的想法，是所有一階遞迴的共同解法。`,
    why: "遞迴數列是數列單元近年最常見的形式。命題者喜歡用「$a_{n+1}=pa_n+q$」型，測驗學生能否自行構造等比數列，再延伸到求和。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}

/* ---------- 第 9 題：資料的線性變換 ---------- */
export function slot9(rng, fixed) {
  const mu = P(fixed, rng, "mu", r => r.pick([60, 65, 70, 50, 55]));
  const sd = P(fixed, rng, "sd", r => r.pick([10, 8, 12, 5]));
  const a = P(fixed, rng, "a", r => r.pick([1.2, 0.8, 1.5, 2, 1.1]));
  const b = P(fixed, rng, "b", r => r.pick([-2, 5, -10, 10, 3]));
  const nMu = +(a * mu + b).toFixed(2), nSd = +(a * sd).toFixed(2);
  const n = 40;
  const pool = [
    { text: `調整後成績的算術平均數為 ${fmt(nMu)} 分`, ok: true, why: `$${a}\\times ${mu}${b >= 0 ? "+" + b : b}=${fmt(nMu)}$。` },
    { text: `調整後成績的算術平均數為 ${fmt(a * mu)} 分`, ok: false, why: `平均數也要跟著平移：$${a}\\times ${mu}${b >= 0 ? "+" + b : b}=${fmt(nMu)}$。` },
    { text: `調整後成績的標準差為 ${fmt(nSd)} 分`, ok: true, why: `標準差乘 $|a|=${a}$：$${a}\\times ${sd}=${fmt(nSd)}$，平移不影響。` },
    { text: `調整後成績的標準差為 ${fmt(a * sd + b)} 分`, ok: false, why: `標準差只受倍率影響，為 $${a}\\times ${sd}=${fmt(nSd)}$，加減常數不會改變離散程度。` },
    { text: `每位學生調整前後的標準化分數（$z$ 分數）相同`, ok: true, why: `$z=\\frac{y-\\mu_y}{\\sigma_y}=\\frac{${a}(x-${mu})}{${fmt(nSd)}}=\\frac{x-${mu}}{${sd}}$，與原來相同（倍率為正）。` },
    { text: `調整前後，數學成績與英文成績的相關係數不變`, ok: true, why: `正的倍率不改變相關係數。` },
    { text: `若改採 $y=100-x$ 調整，則調整後數學成績與英文成績的相關係數，為原相關係數的相反數`, ok: true, why: `倍率為 $-1<0$，相關係數變號。` },
    { text: `若改採 $y=100-x$ 調整，則調整後成績的標準差會變成負的`, ok: false, why: `標準差恆非負，變成 $|-1|\\times ${sd}=${sd}$。` }
  ];
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 9, kind: "multi", vol: "數學2", unit: "數據分析", topic: "資料的線性變換與相關係數", diff: 3, anim: "q9",
    params: { mu, sd, a, b, n },
    stem: `某班 ${n} 位學生數學段考成績的算術平均數為 ${mu} 分、標準差為 ${sd} 分。老師將每位學生的成績 $x$ 調整為 $y=${a}x${b >= 0 ? "+" + b : b}$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: `$y=ax+b$ 只是把資料「拉伸 $a$ 倍再平移 $b$」。平均數跟著變成 $a\\mu+b$，標準差只管拉伸、變成 $|a|\\sigma$；而 $z$ 分數與相關係數看的是「相對位置」，在 $a>0$ 時完全不變，$a<0$ 時相關係數變號。`,
    why: "資料線性變換是數據分析單元最高頻的考點，幾乎年年出現在多選題，且常和相關係數的性質一起考。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}

/* ---------- 第 10 題：平面向量 ---------- */
export function slot10(rng, fixed) {
  const av = P(fixed, rng, "a", r => r.pick([[4, 3], [3, 4], [4, 3]]));
  const bv = P(fixed, rng, "b", r => r.pick([[1, 2], [2, 1], [1, 3], [2, 3], [0, 2], [3, 1], [1, 1]]));
  const [a1, a2] = av, [b1, b2] = bv;
  const dot = a1 * b1 + a2 * b2, la2 = a1 * a1 + a2 * a2, la = Math.sqrt(la2), lb2 = b1 * b1 + b2 * b2;
  const det = a1 * b2 - a2 * b1;
  const proj = [reduce(dot * a1, la2), reduce(dot * a2, la2)];
  const projB = [reduce(dot * b1, lb2), reduce(dot * b2, lb2)];
  const t0 = reduce(-dot, lb2);
  const sum2 = (a1 + b1) ** 2 + (a2 + b2) ** 2;
  const vecTex = (v) => `\\vec{${v}}`;
  const pool = [
    { text: `$\\vec{a}\\cdot\\vec{b}=${dot}$`, ok: true, why: `$${a1}\\cdot ${b1}+${a2}\\cdot ${b2}=${dot}$。` },
    { text: `$\\vec{a}\\cdot\\vec{b}=${dot + 2}$`, ok: false, why: `內積為 $${a1}\\cdot ${b1}+${a2}\\cdot ${b2}=${dot}$。` },
    { text: `$\\vec{b}$ 在 $\\vec{a}$ 方向上的正射影為 $${ptTex(proj[0], proj[1])}$`, ok: true, why: `正射影 $=\\frac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}|^2}\\vec{a}=\\frac{${dot}}{${la2}}(${a1},${a2})=${ptTex(proj[0], proj[1])}$。` },
    { text: `$\\vec{b}$ 在 $\\vec{a}$ 方向上的正射影為 $${ptTex(projB[0], projB[1])}$`, ok: false, why: `$${ptTex(projB[0], projB[1])}$ 是 $\\vec{a}$ 在 $\\vec{b}$ 上的正射影；$\\vec{b}$ 在 $\\vec{a}$ 上的正射影應為 $\\frac{${dot}}{${la2}}\\vec{a}=${ptTex(proj[0], proj[1])}$。` },
    { text: `以 $\\vec{a}$、$\\vec{b}$ 為兩邊的三角形面積為 ${Math.abs(det)}`, ok: false, why: `平行四邊形面積 $=|${a1}\\cdot ${b2}-${a2}\\cdot ${b1}|=${Math.abs(det)}$，三角形面積為 $${fracTex(Math.abs(det), 2)}$。` },
    { text: `以 $\\vec{a}$、$\\vec{b}$ 為鄰邊的平行四邊形面積為 ${Math.abs(det)}`, ok: true, why: `$|${a1}\\cdot ${b2}-${a2}\\cdot ${b1}|=${Math.abs(det)}$。` },
    { text: `$|\\vec{a}+\\vec{b}|=|\\vec{a}|+|\\vec{b}|$`, ok: false, why: `兩向量不同向，$|\\vec{a}+\\vec{b}|=${sqrtTex(sum2)}<|\\vec{a}|+|\\vec{b}|=${la}+${sqrtTex(lb2)}$。` },
    { text: `存在實數 $t$ 使得 $\\vec{a}+t\\vec{b}$ 與 $\\vec{b}$ 垂直`, ok: true, why: `$(\\vec{a}+t\\vec{b})\\cdot\\vec{b}=${dot}+${lb2}t=0$，$t=${fracTex(t0[0], t0[1])}$ 即可。` }
  ];
  const mc = makeMulti(rng, pool, fixed && fixed.sel);
  return {
    slot: 10, kind: "multi", vol: "數學3A", unit: "平面向量", topic: "內積、正射影與面積", diff: 3, anim: "q10",
    params: { a: av, b: bv, dot, det, proj: [proj[0][0] / proj[0][1], proj[1][0] / proj[1][1]], t0: t0[0] / t0[1], la, lb2 },
    stem: `設 $\\vec{a}=(${a1},${a2})$，$\\vec{b}=(${b1},${b2})$。下列哪些選項是正確的？`,
    options: mc.options, answer: mc.answer,
    core: `內積 $\\vec{a}\\cdot\\vec{b}=|\\vec{a}|\\times$（$\\vec{b}$ 在 $\\vec{a}$ 上的投影長），正射影就是「影子」；而二階行列式 $|${a1}\\cdot ${b2}-${a2}\\cdot ${b1}|$ 給的是平行四邊形面積，三角形要再除以 2。`,
    why: "內積與正射影是平面向量的核心，多選題經常把「內積、正射影、面積、三角不等式、垂直條件」打包成一題，一次檢查所有基本功。",
    solution: mc.options.map((o, i) => `(${i + 1}) ${mc.answer.includes(i + 1) ? "正確" : "錯誤"}：${mc.explain[i]}`),
    answerText: mc.answer.map(a => `(${a})`).join("")
  };
}
