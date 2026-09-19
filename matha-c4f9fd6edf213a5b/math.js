/* 學測數A預測題庫 —— 輕量數學排版（網頁與 PDF 共用）
 * M(html)：把 $...$／$$...$$ 內的類 TeX 語法轉成 HTML；circled(n)：學測答案卡式的圈號。 */
window.GSATMath = (function () {
  "use strict";
  const FUNCS = ["sin", "cos", "tan", "log", "ln", "det", "lim", "max", "min"];
  const SYM = { le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", cdot: "·", times: "×", div: "÷", pi: "π", theta: "θ", alpha: "α", beta: "β", mu: "μ", sigma: "σ", lambda: "λ", omega: "ω", Gamma: "Γ", Delta: "Δ", to: "→", Rightarrow: "⇒", Leftrightarrow: "⇔", iff: "⇔", sum: "∑", in: "∈", notin: "∉", pm: "±", mp: "∓", infty: "∞", deg: "°", circ: "°", triangle: "△", angle: "∠", perp: "⊥", parallel: "∥", langle: "⟨", rangle: "⟩", cdots: "⋯", ldots: "…", dots: "…", mid: "|", subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅", quad: " ", qquad: "  ", therefore: "∴", because: "∵", prime: "′", ast: "∗" };
  const OPS = new Set(["=", "+", "−", "<", ">", "≤", "≥", "≠", "≈", "→", "⇒", "⇔", "±", "×", "·", "∓"]);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function circled(n) {
    n = Number(n);
    if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
    if (n >= 21 && n <= 35) return String.fromCharCode(0x3251 + n - 21);
    if (n >= 36 && n <= 50) return String.fromCharCode(0x32b1 + n - 36);
    return "(" + n + ")";
  }
  function tex(src) {
    let i = 0; const n = src.length; let out = "";
    const isAlpha = (ch) => /[a-zA-Z]/.test(ch);
    function readGroup() { let depth = 0; const start = i + 1; for (; i < n; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) { const inner = src.slice(start, i); i++; return inner; } } } return src.slice(start); }
    function readArg() {
      if (i >= n) return "";
      if (src[i] === "{") return readGroup();
      if (src[i] === "\\") { let j = i + 1; while (j < n && isAlpha(src[j])) j++; if (j === i + 1) j++; const cmd = src.slice(i, j); i = j; return cmd; }
      return src[i++];
    }
    const op = (s) => `<span class="op">${s}</span>`;
    while (i < n) {
      const ch = src[i];
      if (ch === "\\") {
        const j0 = i + 1;
        if (j0 < n && !isAlpha(src[j0])) {
          const sym = src[j0]; i = j0 + 1;
          if (sym === "," || sym === ";" || sym === " ") out += "&thinsp;"; else if (sym === "!") out += ""; else if (sym === "\\") out += "<br>"; else out += esc(sym);
          continue;
        }
        let j = j0; while (j < n && isAlpha(src[j])) j++;
        const cmd = src.slice(j0, j); i = j;
        if (cmd === "frac" || cmd === "tfrac" || cmd === "dfrac") { const a = readArg(), b = readArg(); out += `<span class="frac"><span>${tex(a)}</span><span>${tex(b)}</span></span>`; }
        else if (cmd === "sqrt") { const a = readArg(); out += `<span class="sqrt">√<span class="rad">${tex(a)}</span></span>`; }
        else if (cmd === "vec") { const a = readArg(); out += `<span class="vec">${tex(a)}</span>`; }
        else if (cmd === "ol" || cmd === "overline" || cmd === "bar") { const a = readArg(); out += `<span class="ol">${tex(a)}</span>`; }
        else if (cmd === "b") { const a = readArg(); out += `<span class="blank">${circled(a)}</span>`; }
        else if (cmd === "text" || cmd === "mathrm") { const a = readArg(); out += `<span class="txt">${esc(a)}</span>`; }
        else if (cmd === "mathbb") { const a = readArg(); out += a === "R" ? "ℝ" : a === "N" ? "ℕ" : a === "Z" ? "ℤ" : esc(a); }
        else if (cmd === "mat") { const a = readArg(); const rows = a.split("\\\\").map(r => r.split("&")); out += `<span class="mat">${rows.map(r => `<span class="mr">${r.map(x => `<span>${tex(x.trim())}</span>`).join("")}</span>`).join("")}</span>`; }
        else if (cmd === "left" || cmd === "right") { if (i < n) { if (src[i] === "\\") { i++; out += esc(src[i] || ""); i++; } else if (src[i] === ".") i++; else { out += esc(src[i]); i++; } } }
        else if (cmd === "begin" || cmd === "end") { readArg(); }
        else if (SYM[cmd] !== undefined) { out += OPS.has(SYM[cmd]) ? op(SYM[cmd]) : SYM[cmd]; }
        else if (FUNCS.includes(cmd)) { out += `<span class="fn">${cmd}</span>`; }
        else out += esc("\\" + cmd);
        continue;
      }
      if (ch === "^") { i++; const a = readArg(); out += (a === "\\circ") ? "°" : `<sup>${tex(a)}</sup>`; continue; }
      if (ch === "_") { i++; const a = readArg(); out += `<sub>${tex(a)}</sub>`; continue; }
      if (ch === "{") { out += tex(readGroup()); continue; }
      if (isAlpha(ch)) {
        let j = i; while (j < n && isAlpha(src[j])) j++; const run = src.slice(i, j); i = j;
        if (FUNCS.includes(run)) out += `<span class="fn">${run}</span>`; else out += run.split("").map(l => `<i>${l}</i>`).join("");
        continue;
      }
      if (ch === "-") { out += op("−"); i++; continue; }
      if (ch === "+" || ch === "=") { out += op(ch); i++; continue; }
      if (ch === "<") { out += op("&lt;"); i++; continue; }
      if (ch === ">") { out += op("&gt;"); i++; continue; }
      if (ch === "&") { out += "&amp;"; i++; continue; }
      if (ch === "*") { out += op("·"); i++; continue; }
      out += ch; i++;
    }
    return out;
  }
  function M(html) {
    if (!html) return "";
    return String(html)
      .replace(/\$\$([\s\S]+?)\$\$/g, (m, s) => `<span class="m d">${tex(s.trim())}</span>`)
      .replace(/\$([^$]+?)\$/g, (m, s) => `<span class="m">${tex(s.trim())}</span>`);
  }
  /* 純文字版（PDF 目錄、答案總表用）：去掉 $ 與 HTML 標籤，簡單轉幾個符號 */
  function plain(html) {
    return String(html || "").replace(/<[^>]+>/g, " ").replace(/\$([^$]+?)\$/g, (m, s) => s).replace(/\\(le|ge|ne|approx|cdot|times|pi|theta|to)\b/g, (m, k) => SYM[k] || m).replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  }
  return { M, tex, circled, esc, plain };
})();
