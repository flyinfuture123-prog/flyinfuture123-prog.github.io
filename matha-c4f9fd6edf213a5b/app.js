/* 學測數A預測題庫 —— 頁面邏輯 */
(function () {
  "use strict";
  const A = window.ANIM;
  const CURRENT = window.GSAT; const ARCHIVE = window.GSAT_ARCHIVE || [];
  let D = CURRENT;
  const $ = (s, r) => (r || document).querySelector(s);
  const storeKey = () => `gsat-matha-116-${D.meta.week}`;
  const KIND = { single: "單選題", multi: "多選題", fill: "選填題", open: "非選擇題" };
  const KIND_CLS = { single: "k1", multi: "k2", fill: "k3", open: "k4" };

  /* ---------- 數學排版（math.js）---------- */
  const { M, circled, esc } = window.GSATMath;

  /* ---------- 狀態 ---------- */
  let state = load();
  function load() {
    try {
      let s = JSON.parse(localStorage.getItem(storeKey()) || "null");
      if (!s && D === CURRENT && D.meta.round === 1) s = JSON.parse(localStorage.getItem("gsat-matha-116-v1") || "null"); // 第 1 回上線初期的舊鍵
      if (s && s.answers) return s;
    } catch (e) { /* ignore */ }
    return { answers: {}, results: {}, timer: null };
  }
  function save() { try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* ignore */ } }
  const view = { mode: "list", cur: null, filter: "all" };
  let player = null;
  let byNo = {}; const indexQs = () => { byNo = {}; D.questions.forEach(q => { byNo[q.no] = q; }); }; indexQs();

  /* ---------- 週次切換與封存 ---------- */
  const isCurrent = () => D === CURRENT;
  function loadPaper(week) {
    return new Promise((resolve, reject) => {
      if (week === CURRENT.meta.week) return resolve(CURRENT);
      if (window.GSAT_PAPERS && window.GSAT_PAPERS[week]) return resolve(window.GSAT_PAPERS[week]);
      const entry = ARCHIVE.find(e => e.week === week); if (!entry) return reject(new Error("沒有這一週的卷子"));
      const sc = document.createElement("script"); sc.src = entry.file;
      sc.onload = () => (window.GSAT_PAPERS && window.GSAT_PAPERS[week]) ? resolve(window.GSAT_PAPERS[week]) : reject(new Error("封存檔格式不對"));
      sc.onerror = () => reject(new Error("讀不到封存檔")); document.head.appendChild(sc);
    });
  }
  function switchWeek(week, qno) {
    if (week === D.meta.week) { if (qno) openQ(qno); return Promise.resolve(); }
    return loadPaper(week).then(paper => {
      if (player) { player.destroy(); player = null; }
      D = paper; indexQs(); state = load(); view.mode = "list"; view.cur = null; view.filter = "all";
      renderHeat(); renderWeekbar(); renderPaperBar(); renderArchive();
      if (qno && byNo[qno]) openQ(qno); else { renderPaperBody(); setHash("paper"); }
    }).catch(err => alert(err.message));
  }
  function renderWeekbar() {
    const m = D.meta; const opts = [CURRENT, ...ARCHIVE.map(e => ({ meta: e }))];
    $("#paper-title").textContent = m.title;
    $("#paper-lede").textContent = `週次 ${m.week}（${m.from} ～ ${m.to}）・共 20 題／100 分，考試時間 100 分鐘。單選 6 題、多選 6 題、選填 5 題（各 5 分），混合題 3 小題（15 分）。`;
    $("#weekbar").innerHTML = `<label>切換卷子 <select id="week-select">${opts.map(o => `<option value="${o.meta.week}" ${o.meta.week === m.week ? "selected" : ""}>第 ${o.meta.round} 回（${o.meta.week}，${o.meta.from.slice(5).replace("-", "/")}～${o.meta.to.slice(5).replace("-", "/")}）${o === CURRENT ? " · 本週" : ""}</option>`).join("")}</select></label>` +
      (isCurrent() ? '<span class="pill">本週卷 · 下週一自動換卷</span>' : `<span class="pill old">封存卷</span>${archivePdfLinks(ARCHIVE.find(e => e.week === m.week))}`);
    $("#week-select").onchange = (e) => switchWeek(e.target.value);
  }
  function archivePdfLinks(e) { if (!e || !e.pdf) return ""; return `<a class="btn sm pdf-s" href="${e.pdf.student}" target="_blank" rel="noopener">學用版 PDF</a><a class="btn sm pdf-t" href="${e.pdf.teacher}" target="_blank" rel="noopener">教用版 PDF</a>`; }
  function renderArchive() {
    const host = $("#archive-list"); if (!host) return;
    const cur = `<div class="card arch cur"><div class="row"><span class="round">第 ${CURRENT.meta.round} 回</span><span class="dates">${CURRENT.meta.week} · ${CURRENT.meta.from} ～ ${CURRENT.meta.to}</span><span class="pill" style="margin-left:auto">本週</span></div><div class="small muted">本週卷子線上作答中；下週一換卷時會自動封存並產生 PDF。</div><div class="links"><button class="btn sm" data-week="${CURRENT.meta.week}">線上作答</button></div></div>`;
    const rows = ARCHIVE.map(e => `<div class="card arch"><div class="row"><span class="round">第 ${e.round} 回</span><span class="dates">${e.week} · ${e.from} ～ ${e.to}</span></div><div class="links"><button class="btn sm" data-week="${e.week}">線上作答／看動畫</button>${archivePdfLinks(e)}</div></div>`).join("");
    host.innerHTML = `<div class="arch-list">${cur}${rows}</div>` + (ARCHIVE.length ? "" : '<div class="arch-empty" style="margin-top:12px">目前還沒有封存的卷子。第一次換卷會在下週一清晨進行，屆時第 1 回會出現在這裡並附上兩種 PDF。</div>');
    host.querySelectorAll("[data-week]").forEach(b => { b.onclick = () => { switchWeek(b.dataset.week).then(() => { const top = $("#paper").getBoundingClientRect().top + window.scrollY - 64; window.scrollTo({ top, behavior: "smooth" }); }); }; });
  }

  /* ---------- 計分 ---------- */
  function grade(q, ans) {
    if (ans == null) return null;
    if (q.kind === "single") { const ok = Number(ans) === q.answer; return { score: ok ? q.points : 0, status: ok ? "ok" : "bad" }; }
    if (q.kind === "multi") {
      const sel = new Set((ans || []).map(Number)); const cor = new Set(q.answer);
      let wrong = 0; for (let i = 1; i <= q.options.length; i++) if (sel.has(i) !== cor.has(i)) wrong++;
      const score = [5, 3, 1, 0, 0, 0][Math.min(wrong, 5)]; if (sel.size === 0) return { score: 0, status: "bad", wrong: 5 };
      return { score, status: wrong === 0 ? "ok" : score > 0 ? "part" : "bad", wrong };
    }
    if (q.kind === "fill") {
      const norm = (s) => String(s == null ? "" : s).trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
      const marks = q.blanks.map((b, i) => norm(ans[i]) === norm(b.ans));
      const ok = marks.every(Boolean); return { score: ok ? q.points : 0, status: ok ? "ok" : "bad", marks };
    }
    if (q.kind === "open") { if (typeof ans.grade !== "number") return null; const s = ans.grade; return { score: s, status: s >= q.points ? "ok" : s > 0 ? "part" : "bad" }; }
    return null;
  }
  const resultOf = (q) => state.results[q.no] || null;
  function totals() {
    let score = 0, answered = 0, max = 0;
    D.questions.forEach(q => { max += q.points; const r = resultOf(q); if (r) { answered++; score += r.score; } });
    return { score, answered, max, total: D.questions.length };
  }

  /* ---------- 計時 ---------- */
  function timerRemaining() {
    const t = state.timer; if (!t) return null;
    const elapsed = (t.elapsed || 0) + (t.running ? Date.now() - t.start : 0);
    return D.meta.minutes * 60 * 1000 - elapsed;
  }
  function timerToggle() {
    const t = state.timer;
    if (!t) state.timer = { start: Date.now(), elapsed: 0, running: true };
    else if (t.running) { t.elapsed = (t.elapsed || 0) + Date.now() - t.start; t.running = false; }
    else { t.start = Date.now(); t.running = true; }
    save(); renderPaperBar();
  }
  function timerReset() { state.timer = null; save(); renderPaperBar(); }
  setInterval(() => { if (state.timer && state.timer.running) { const el = $("#timer-display"); if (el) el.textContent = fmtTime(timerRemaining()); const rem = timerRemaining(); if (el) el.classList.toggle("warn", rem < 10 * 60 * 1000); } }, 1000);
  function fmtTime(ms) { const neg = ms < 0; ms = Math.abs(ms); const s = Math.floor(ms / 1000); const mm = String(Math.floor(s / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0"); return (neg ? "−" : "") + mm + ":" + ss; }

  /* ---------- 首頁統計、考點熱度 ---------- */
  function renderHero() {
    const units = new Set(D.questions.map(q => q.unit)).size;
    $("#hero-stats").innerHTML = [[D.questions.length, "題／每週一回"], [Object.keys(A.registry).length, "段核心意義動畫"], [units, "個涵蓋單元"], ["第 " + CURRENT.meta.round + " 回", "本週上線（" + CURRENT.meta.week + "）"]]
      .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
  }
  function renderHeat() {
    const vols = ["數學1", "數學2", "數學3A", "數學4A"]; const sub = { "數學1": "高一上", "數學2": "高一下", "數學3A": "高二上", "數學4A": "高二下" };
    $("#heat-grid").innerHTML = vols.map(v => {
      const rows = D.units.filter(u => u.vol === v).map(u => `
        <div class="unit">
          <div class="u-name">${u.name}</div>
          <div class="u-q">${u.qs.map(n => `<a href="#q${n}" data-q="${n}">第 ${n} 題</a>`).join("")}</div>
          <div class="u-bar" title="預測熱度 ${u.heat}/5"><i style="width:${u.heat * 20}%"></i></div>
          <div class="u-note">${u.note}</div>
        </div>`).join("");
      return `<div class="card heat-card"><h3>${v}<span class="tag">${sub[v]}</span></h3>${rows}</div>`;
    }).join("");
  }

  /* ---------- 試卷工具列 ---------- */
  function renderPaperBar() {
    const t = totals(); const rem = timerRemaining();
    const bar = $("#paperbar");
    bar.innerHTML = `
      <div class="prog"><div class="small muted">已作答 <b class="num">${t.answered}</b> / ${t.total} 題</div><div class="bar"><i style="width:${(t.answered / t.total) * 100}%"></i></div></div>
      <div class="score">得分 <b>${t.score}</b> / ${t.max}</div>
      <div class="timer ${rem != null && rem < 600000 ? "warn" : ""}" id="timer-display" title="剩餘時間">${rem == null ? "100:00" : fmtTime(rem)}</div>
      <button class="btn sm" id="btn-timer">${!state.timer ? "開始計時" : state.timer.running ? "暫停" : "繼續"}</button>
      ${state.timer ? '<button class="btn sm ghost" id="btn-timer-reset">歸零</button>' : ""}
      <div class="chips" id="filters">${[["all", "全部"], ["single", "單選"], ["multi", "多選"], ["fill", "選填"], ["mixed", "混合題"], ["todo", "未作答"], ["bad", "答錯"]].map(([k, s]) => `<button class="chip ${view.filter === k ? "on" : ""}" data-f="${k}">${s}</button>`).join("")}</div>
      ${view.mode === "q" ? '<button class="btn sm" id="btn-list">☰ 題目列表</button>' : ""}`;
    $("#btn-timer").onclick = timerToggle;
    const r = $("#btn-timer-reset"); if (r) r.onclick = () => { if (confirm("要把計時器歸零嗎？")) timerReset(); };
    $("#filters").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; view.filter = b.dataset.f; view.mode = "list"; setHash("paper"); renderPaperBar(); renderPaperBody(); };
    const l = $("#btn-list"); if (l) l.onclick = () => { view.mode = "list"; setHash("paper"); renderPaperBar(); renderPaperBody(); };
  }

  /* ---------- 題目列表 ---------- */
  function passFilter(q) {
    const f = view.filter, r = resultOf(q);
    if (f === "all") return true; if (f === "mixed") return !!q.group; if (f === "todo") return !r; if (f === "bad") return r && r.status !== "ok";
    return q.kind === f;
  }
  function renderList() {
    const qs = D.questions.filter(passFilter);
    const body = $("#paper-body");
    if (!qs.length) { body.innerHTML = '<div class="card qpane muted">這個篩選條件下沒有題目。</div>'; return; }
    body.innerHTML = `<div class="qlist">${qs.map(q => {
      const r = resultOf(q); const st = r ? r.status : "";
      return `<div class="card qcard ${st}" data-q="${q.no}" role="button" tabindex="0">
        <div class="row"><span class="qno">${q.no}</span><span class="kind ${KIND_CLS[q.kind]}">${q.group ? "混合題・" : ""}${KIND[q.kind]}</span>${r ? `<span class="status ${st}">${st === "ok" ? "答對" : st === "part" ? "部分得分" : "答錯"} · ${r.score} 分</span>` : ""}</div>
        <div class="title">${q.topic}</div>
        <div class="meta"><span>${q.vol}・${q.unit}</span><span class="stars" title="難度">${"★".repeat(q.diff)}${"☆".repeat(5 - q.diff)}</span><span>${q.points} 分</span></div>
      </div>`;
    }).join("")}</div>`;
    body.querySelectorAll(".qcard").forEach(c => { const open = () => openQ(Number(c.dataset.q)); c.onclick = open; c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }; });
  }

  /* ---------- 單題畫面 ---------- */
  function openQ(no, noScroll) {
    view.mode = "q"; view.cur = no; setHash("q" + no);
    renderPaperBar(); renderQ();
    if (!noScroll) { const top = $("#paper").getBoundingClientRect().top + window.scrollY - 64; window.scrollTo({ top, behavior: "smooth" }); }
  }
  function renderPaperBody() { if (view.mode === "q" && view.cur) renderQ(); else { if (player) { player.destroy(); player = null; } renderList(); } }

  function renderQ() {
    const q = byNo[view.cur]; if (!q) { view.mode = "list"; renderList(); return; }
    const r = resultOf(q); const ans = state.answers[q.no];
    const body = $("#paper-body");
    const nav = `<div class="qnav" role="tablist" aria-label="題號">${D.questions.map(x => { const rr = resultOf(x); return `<button data-q="${x.no}" class="${x.no === q.no ? "cur " : ""}${rr ? rr.status : ""}" title="第 ${x.no} 題：${x.topic}">${x.no}</button>`; }).join("")}</div>`;
    const grp = q.group ? D.groups[q.group] : null;
    let answerArea = "";
    if (q.kind === "single" || q.kind === "multi") {
      const sel = new Set(q.kind === "single" ? (ans != null ? [Number(ans)] : []) : (ans || []).map(Number));
      const cor = new Set(q.kind === "single" ? [q.answer] : q.answer);
      answerArea = `<ul class="opts">${q.options.map((o, i) => {
        const k = i + 1; let cls = sel.has(k) ? "sel" : "";
        if (r) { if (sel.has(k) && cor.has(k)) cls = "right"; else if (sel.has(k) && !cor.has(k)) cls = "wrong"; else if (!sel.has(k) && cor.has(k)) cls = "missed"; }
        return `<li><label class="opt ${cls}"><input type="${q.kind === "single" ? "radio" : "checkbox"}" name="opt-${q.no}" value="${k}" ${sel.has(k) ? "checked" : ""} ${r ? "disabled" : ""}><span class="on">(${k})</span><span>${M(o)}</span></label></li>`;
      }).join("")}</ul>${q.kind === "multi" ? '<div class="small muted" style="margin-top:8px">多選題：全對 5 分、錯 1 個選項 3 分、錯 2 個選項 1 分。</div>' : ""}`;
    } else if (q.kind === "fill") {
      answerArea = `<div class="blanks">${q.blanks.map((b, i) => `<div class="blank-in"><label for="bl-${q.no}-${i}">${circled(b.label)}</label><input id="bl-${q.no}-${i}" data-i="${i}" inputmode="numeric" maxlength="3" autocomplete="off" value="${ans && ans[i] != null ? esc(ans[i]) : ""}" ${r ? "disabled" : ""} class="${r ? (r.marks[i] ? "right" : "wrong") : ""}"></div>`).join("")}</div>
        <div class="small muted" style="margin-top:8px">每格填一個數字；若答案為負數，負號填在第一格。</div>`;
    } else {
      const g = ans && typeof ans.grade === "number" ? ans.grade : null;
      answerArea = `<textarea class="freetext" id="open-${q.no}" placeholder="在這裡寫下你的說明與計算過程（只會存在你的瀏覽器裡）">${ans && ans.text ? esc(ans.text) : ""}</textarea>
        <div class="small muted" style="margin-top:6px">寫完後展開下方「參考答案與評分要點」，對照後自評分數。</div>
        <div class="selfgrade">自評得分：${[0, 1, 2, 3, 4, 5].map(s => `<button type="button" data-g="${s}" class="${g === s ? "on" : ""}">${s}</button>`).join("")}<span class="muted">/ 5</span></div>`;
    }
    let fb = "";
    if (r) {
      const cls = r.status; const head = cls === "ok" ? "答對了！" : cls === "part" ? "部分得分" : "答錯了";
      fb = `<div class="feedback show ${cls}"><b>${head}</b> 得 ${r.score} / ${q.points} 分。正確答案：${M(q.answerText)}${q.kind === "multi" && r.wrong ? `（你有 ${r.wrong} 個選項判斷錯誤）` : ""}</div>`;
    }
    const solTitle = q.kind === "open" ? "參考答案與評分要點" : "詳解";
    const sol = `<details class="sol" ${r ? "open" : ""}><summary>${solTitle}</summary><div class="sol-body">
        ${q.rubric ? `<div class="key"><b>評分要點</b><ol>${q.rubric.map(s => `<li>${M(s)}</li>`).join("")}</ol></div>` : ""}
        <ol>${q.solution.map(s => `<li>${M(s)}</li>`).join("")}</ol>
        <div class="key"><b>答案：</b>${M(q.answerText)}</div>
      </div></details>`;
    const idx = D.questions.findIndex(x => x.no === q.no);
    const prev = D.questions[idx - 1], next = D.questions[idx + 1];
    body.innerHTML = nav + `<div class="qview">
      <div class="card qpane">
        <div class="qhead"><span class="qno">${q.no}</span><div class="badges"><span class="badge kind">${q.group ? "混合題・" : ""}${KIND[q.kind]}</span><span class="badge">${q.vol}・${q.unit}</span><span class="badge"><span class="stars">${"★".repeat(q.diff)}${"☆".repeat(5 - q.diff)}</span></span><span class="badge">${q.points} 分</span></div></div>
        ${grp ? `<div class="ctx"><div class="ctx-label">${grp.title}</div><div class="stem">${M(grp.context)}</div></div>` : ""}
        <div class="stem">${M(q.stem)}</div>
        ${answerArea}
        <div class="actions">
          ${q.kind !== "open" ? (r ? '<button class="btn" id="btn-retry">重新作答</button>' : '<button class="btn primary" id="btn-submit">送出答案</button>') : '<button class="btn" id="btn-save-open">儲存作答</button>'}
          <span class="spacer" style="flex:1"></span>
          <button class="btn sm ghost" id="btn-prev" ${prev ? "" : "disabled"}>‹ 上一題</button>
          <button class="btn sm ghost" id="btn-next" ${next ? "" : "disabled"}>下一題 ›</button>
        </div>
        ${fb}
        <div class="core"><span class="lbl">核心意義</span><span>${M(q.core)}</span></div>
        ${sol}
        <div class="why"><b>為什麼預測會考：</b>${M(q.why)}</div>
      </div>
      <div class="card player">
        <h3>核心意義動畫<span class="tag">第 ${q.no} 題專屬</span></h3>
        <div id="player-host"></div>
      </div>
    </div>`;
    // 事件
    body.querySelectorAll(".qnav button").forEach(b => { b.onclick = () => openQ(Number(b.dataset.q), true); });
    const bp = $("#btn-prev"), bn = $("#btn-next"); if (bp && prev) bp.onclick = () => openQ(prev.no, true); if (bn && next) bn.onclick = () => openQ(next.no, true);
    body.querySelectorAll(".opt input").forEach(inp => {
      inp.addEventListener("change", () => {
        if (q.kind === "single") state.answers[q.no] = Number(inp.value);
        else { const set = new Set((state.answers[q.no] || []).map(Number)); if (inp.checked) set.add(Number(inp.value)); else set.delete(Number(inp.value)); state.answers[q.no] = Array.from(set).sort(); }
        save(); body.querySelectorAll(".opt").forEach(o => o.classList.toggle("sel", o.querySelector("input").checked));
      });
    });
    body.querySelectorAll(".blank-in input").forEach(inp => {
      inp.addEventListener("input", () => { const arr = (state.answers[q.no] || []).slice(); arr[Number(inp.dataset.i)] = inp.value; state.answers[q.no] = arr; save(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { const s = $("#btn-submit"); if (s) s.click(); } });
    });
    const sub = $("#btn-submit");
    if (sub) sub.onclick = () => {
      const a = state.answers[q.no];
      if (a == null || (Array.isArray(a) && a.filter(x => x != null && x !== "").length === 0)) { alert("請先作答再送出。"); return; }
      if (q.kind === "fill" && q.blanks.some((b, i) => !a[i] || String(a[i]).trim() === "")) { alert("還有空格沒填。"); return; }
      const res = grade(q, a); if (!res) return; state.results[q.no] = res; save(); renderPaperBar(); renderQ();
      if (player) player.goto(0, 0);
      if (player && !player.reduced) player.play();
    };
    const retry = $("#btn-retry"); if (retry) retry.onclick = () => { delete state.results[q.no]; delete state.answers[q.no]; save(); renderPaperBar(); renderQ(); };
    const so = $("#btn-save-open"); if (so) so.onclick = () => { const t = $("#open-" + q.no).value; state.answers[q.no] = Object.assign({}, state.answers[q.no] || {}, { text: t }); save(); so.textContent = "已儲存 ✓"; setTimeout(() => { so.textContent = "儲存作答"; }, 1200); };
    body.querySelectorAll(".selfgrade button").forEach(b => b.onclick = () => {
      const t = $("#open-" + q.no).value; const gsel = Number(b.dataset.g);
      state.answers[q.no] = Object.assign({}, state.answers[q.no] || {}, { text: t, grade: gsel });
      state.results[q.no] = grade(q, state.answers[q.no]); save(); renderPaperBar(); renderQ();
    });
    // 動畫
    if (player) player.destroy();
    const spec = A.get(q.anim);
    const host = $("#player-host");
    if (spec) player = new A.Player(host, spec, { autoplay: true, q });
    else host.innerHTML = '<div class="muted small">這一題尚未提供動畫。</div>';
  }

  /* ---------- 路由 ---------- */
  function setHash(h) {
    const wk = isCurrent() ? "" : D.meta.week;
    const full = h === "paper" ? (wk || "paper") : (wk ? wk + "/" + h : h);
    if (location.hash !== "#" + full) history.replaceState(null, "", "#" + full);
  }
  function route() {
    const m = /^#(?:(\d{4}-W\d{2}))?\/?(?:q(\d+))?$/.exec(location.hash);
    if (!m || (!m[1] && !m[2])) return false;
    const week = m[1] || CURRENT.meta.week, qno = m[2] ? Number(m[2]) : null;
    if (week !== D.meta.week) { switchWeek(week, qno); return true; }
    if (qno && byNo[qno]) { openQ(qno); return true; }
    return false;
  }
  window.addEventListener("hashchange", () => { route(); });
  document.addEventListener("click", (e) => { const a = e.target.closest("a[data-q]"); if (a) { e.preventDefault(); openQ(Number(a.dataset.q)); } });

  /* ---------- 主題與重設 ---------- */
  const THEME_KEY = "gsat-theme";
  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  try { applyTheme(localStorage.getItem(THEME_KEY) || ""); } catch (e) { /* ignore */ }
  $("#btn-theme").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme"); const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = cur ? (cur === "dark" ? "light" : "dark") : (sysDark ? "light" : "dark");
    applyTheme(next); try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  };
  $("#btn-reset").onclick = () => { if (!confirm(`確定要清除「${D.meta.title}」的作答紀錄與計時嗎？此動作無法復原。`)) return; state = { answers: {}, results: {}, timer: null }; save(); try { localStorage.removeItem("gsat-matha-116-v1"); } catch (e) { /* ignore */ } renderPaperBar(); renderPaperBody(); };
  $("#cta-start").addEventListener("click", (e) => { e.preventDefault(); const first = D.questions.find(q => !resultOf(q)) || D.questions[0]; openQ(first.no); });

  /* ---------- 啟動 ---------- */
  renderHero(); renderHeat(); renderWeekbar(); renderArchive(); renderPaperBar();
  if (!route()) renderPaperBody();
})();
