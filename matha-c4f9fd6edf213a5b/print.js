/* 學測數A預測題庫 —— 列印版（供 scripts/gsat_pdf.mjs 轉 PDF，也可直接用瀏覽器列印）
 * 參數：?week=2026-W38&edition=student|teacher；week 省略時為目前上線的卷子。 */
(function () {
  "use strict";
  const { M, circled, plain } = window.GSATMath;
  const qs = new URLSearchParams(location.search);
  const edition = qs.get("edition") === "teacher" ? "teacher" : "student";
  const wantWeek = qs.get("week") || (window.GSAT && window.GSAT.meta.week);
  const KIND = { single: "單選題", multi: "多選題", fill: "選填題", open: "非選擇題" };
  const SITE_URL = "https://flyinfuture123-prog.github.io/matha-c4f9fd6edf213a5b/";
  const root = document.getElementById("root");

  function loadPaper(week) {
    return new Promise((resolve, reject) => {
      if (window.GSAT && window.GSAT.meta.week === week) return resolve(window.GSAT);
      if (window.GSAT_PAPERS && window.GSAT_PAPERS[week]) return resolve(window.GSAT_PAPERS[week]);
      const s = document.createElement("script"); s.src = `data/papers/${week}.js`;
      s.onload = () => (window.GSAT_PAPERS && window.GSAT_PAPERS[week]) ? resolve(window.GSAT_PAPERS[week]) : reject(new Error("封存檔沒有 " + week));
      s.onerror = () => reject(new Error("讀不到 data/papers/" + week + ".js"));
      document.head.appendChild(s);
    });
  }

  function optsHtml(q) {
    const long = q.options.some(o => plain(o).length > 22);
    return `<ul class="opts ${long ? "long" : ""}">${q.options.map((o, i) => `<li><span class="on">(${i + 1})</span><span>${M(o)}</span></li>`).join("")}</ul>`;
  }
  function stemHtml(q, D) {
    const grp = q.group && D.groups[q.group] && D.questions.find(x => x.group === q.group) === q ? D.groups[q.group] : null;
    return (grp ? `<div class="ctx"><div class="lbl">${grp.title}</div><div>${M(grp.context)}</div></div>` : "") +
      `<div class="stem"><span class="no">${q.no}.</span><div class="body">${M(q.stem)}${q.kind === "single" || q.kind === "multi" ? optsHtml(q) : ""}</div></div>`;
  }
  function answerOf(q) {
    if (q.kind === "single") return `(${q.answer})`;
    if (q.kind === "multi") return q.answer.map(a => `(${a})`).join("");
    if (q.kind === "fill") return q.blanks.map(b => `${circled(b.label)}${b.ans}`).join("　") + `（${q.answerText}）`;
    return q.answerText;
  }
  function section(D, kind, title, note) {
    const list = D.questions.filter(q => q.kind === kind && !q.group);
    if (!list.length) return "";
    const range = `第 ${list[0].no} 至 ${list[list.length - 1].no} 題`;
    return `<div class="sec">${title}（${range}）</div><div class="sec-note">${note}</div>` + list.map(q => qBlock(q, D)).join("");
  }
  function qBlock(q, D) {
    let extra = "";
    if (edition === "teacher") {
      extra = `<div class="ans"><b>答案：</b>${M(answerOf(q))}　<span class="tag">${q.vol}・${q.unit}</span><span class="tag">難度 ${"★".repeat(q.diff)}${"☆".repeat(5 - q.diff)}</span></div>` +
        (q.rubric ? `<div class="sol"><b>評分要點：</b><ol>${q.rubric.map(s => `<li>${M(s)}</li>`).join("")}</ol></div>` : "") +
        `<div class="sol"><b>詳解：</b><ol>${q.solution.map(s => `<li>${M(s)}</li>`).join("")}</ol></div>` +
        `<div class="core"><b>核心意義：</b>${M(q.core)}</div>` +
        `<div class="why"><b>命題說明：</b>${M(q.why)}　<span class="link">動畫：${SITE_URL}#${D.meta.week}/q${q.no}</span></div>`;
    } else if (q.kind === "open") {
      extra = `<div class="blank-space"></div><div class="blank-space"></div>`;
    }
    return `<div class="q">${stemHtml(q, D)}${extra}</div>`;
  }
  function answerSheet(D) {
    const rows = D.questions.map(q => {
      if (q.kind === "single" || q.kind === "multi") return `<tr><td>${q.no}</td><td>${KIND[q.kind]}</td><td>${[1, 2, 3, 4, 5].map(i => `<span class="bub">${i}</span>`).join("")}</td></tr>`;
      if (q.kind === "fill") return `<tr><td>${q.no}</td><td>選填題</td><td>${q.blanks.map(b => `${circled(b.label)}<span class="box"></span>`).join("　")}</td></tr>`;
      return `<tr><td>${q.no}</td><td>非選擇題</td><td class="open">（請將理由與計算過程寫在此處）</td></tr>`;
    }).join("");
    return `<div class="answer-sheet"><h2>答案卡</h2><div class="notes">班級：＿＿＿＿　座號：＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　　得分：＿＿＿＿／100</div><table class="sheet"><tr><th style="width:3em">題號</th><th style="width:6em">題型</th><th>作答</th></tr>${rows}</table></div>`;
  }
  function keyTable(D) {
    return `<h2 style="font-size:14pt;margin:4px 0">答案總表與考點分布</h2><table class="key-table"><tr><th>題號</th><th>題型</th><th>答案</th><th>冊別・單元</th><th>主題</th><th>難度</th></tr>` +
      D.questions.map(q => `<tr><td>${q.no}</td><td>${q.group ? "混合・" : ""}${KIND[q.kind]}</td><td class="l">${M(answerOf(q))}</td><td class="l">${q.vol}・${q.unit}</td><td class="l">${q.topic}</td><td>${q.diff}</td></tr>`).join("") + `</table>`;
  }
  function render(D) {
    const m = D.meta; const isT = edition === "teacher";
    document.title = `${m.title}（${isT ? "教用版" : "學用版"}）`;
    const cover = `<div class="cover"><span class="edition">${isT ? "教用版" : "學用版"}</span><div class="kicker">學測數學 A 預測試題 · 第 ${m.round} 回</div><h1>${m.title}</h1><div class="meta"><span>週次 ${m.week}（${m.from} ～ ${m.to}）</span><span>考試時間 100 分鐘</span><span>滿分 100 分</span></div></div>`;
    const notes = isT
      ? `<div class="notes"><b>教用版說明：</b>本卷為依 108 課綱數學 1、2、3A、4A 命題趨勢自行編寫的預測練習卷。每題附答案、詳解、核心意義與命題說明；每題的動畫解說可在網站上開啟（連結見各題）。多選題計分：全對 5 分、錯 1 個選項 3 分、錯 2 個選項 1 分；選填題全對才給分；非選擇題依評分要點給分。</div>`
      : `<div class="notes"><b>作答注意事項：</b>第壹部分為選擇（填）題，占 85 分：單選題每題 5 分，答錯不倒扣；多選題每題 5 分，所有選項均答對得 5 分，答錯 1 個選項得 3 分，答錯 2 個選項得 1 分，答錯多於 2 個選項或所有選項均未作答得 0 分；選填題每題 5 分，每題須完全答對才給分。第貳部分為混合題或非選擇題，占 15 分，請將非選擇題的理由與計算過程寫在答案卡指定位置。請將答案填入本卷最後一頁的答案卡。</div>`;
    let html = cover + notes;
    if (isT) html += keyTable(D) + `<div class="pb"></div>`;
    html += `<div class="part">第壹部分、選擇（填）題（占 85 分）</div>`;
    html += section(D, "single", "一、單選題", "每題有 5 個選項，其中只有一個是正確或最適當的選項。");
    html += section(D, "multi", "二、多選題", "每題有 5 個選項，其中至少有一個是正確的選項，選出正確選項。");
    html += section(D, "fill", "三、選填題", "答案請填入圈號對應的格子；若答案為負數，負號填在第一格。");
    const mixed = D.questions.filter(q => q.group);
    if (mixed.length) html += `<div class="part">第貳部分、混合題或非選擇題（占 15 分）</div><div class="sec-note">第 ${mixed[0].no} 至 ${mixed[mixed.length - 1].no} 題為題組，選填題每題 5 分，非選擇題 5 分。</div>` + mixed.map(q => qBlock(q, D)).join("");
    if (!isT) html += answerSheet(D);
    else html += `<div class="notes" style="margin-top:14px">線上版（含每題動畫）：${SITE_URL}#${m.week}　·　題目與動畫皆為自行編寫的練習教材，與大考中心無關。</div>`;
    root.innerHTML = html;
  }
  loadPaper(wantWeek).then(D => { render(D); return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; })
    .then(() => { window.PRINT_READY = true; })
    .catch(err => { root.innerHTML = `<div class="err">${err.message}</div>`; window.PRINT_ERROR = err.message; window.PRINT_READY = true; });
})();
