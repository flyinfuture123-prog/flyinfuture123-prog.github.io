#!/usr/bin/env node
// 學測數A預測題庫 —— 每週組卷與封存
//
// 用法：
//   node scripts/gsat_build.mjs --init                 以第 1 回的固定參數重寫 questions.js（一次性）
//   node scripts/gsat_build.mjs --rotate [--date D]    若目前週次已過期：封存本週卷 → 產生新一回；印出 changed/prev_week/new_week
//   node scripts/gsat_build.mjs --preview W [--out F]  產生指定週次（如 2026-W41）的卷子到檔案或標準輸出，不動站台
//   node scripts/gsat_build.mjs --status               顯示目前上線的週次
//   加 --dry-run 時 --rotate 只印出將要做的事，不寫檔。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPaper, WEEK1, SITE_DIR, serializeCurrent, serializeArchived, serializeArchive, parseJsObject, archiveEntry } from "./gsat/paper.mjs";
import { taipeiDate, weekId, nextWeekId, compareWeek } from "./gsat/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, SITE_DIR);
const F = { current: path.join(SITE, "questions.js"), archive: path.join(SITE, "archive.js"), papers: path.join(SITE, "data", "papers"), pdf: path.join(SITE, "pdf") };
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const log = (m) => console.log(`[gsat] ${m}`);
const writeAtomic = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", text); fs.renameSync(file + ".tmp", file); };
const readCurrent = () => parseJsObject(fs.readFileSync(F.current, "utf8"), "window.GSAT");
const readArchive = () => (fs.existsSync(F.archive) ? parseJsObject(fs.readFileSync(F.archive, "utf8"), "window.GSAT_ARCHIVE") : []);
const ghOut = (kv) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(kv).map(([k, v]) => `${k}=${v}\n`).join("")); };

if (flag("--init")) {
  const paper = buildPaper({ week: WEEK1.week, round: WEEK1.round, fixed: WEEK1.fixed, today: opt("--date", null) });
  writeAtomic(F.current, serializeCurrent(paper));
  if (!fs.existsSync(F.archive)) writeAtomic(F.archive, serializeArchive([]));
  fs.mkdirSync(F.papers, { recursive: true }); fs.mkdirSync(F.pdf, { recursive: true });
  for (const d of [F.papers, F.pdf]) { const keep = path.join(d, ".gitkeep"); if (!fs.readdirSync(d).length) fs.writeFileSync(keep, ""); }
  log(`已寫出第 ${paper.meta.round} 回（${paper.meta.week}，${paper.meta.from}～${paper.meta.to}）`);
} else if (flag("--status")) {
  const cur = readCurrent(); const arc = readArchive();
  log(`目前上線：第 ${cur.meta.round} 回 ${cur.meta.week}（${cur.meta.from}～${cur.meta.to}），封存 ${arc.length} 回`);
} else if (flag("--preview")) {
  const week = opt("--preview"); if (!/^\d{4}-W\d{2}$/.test(week || "")) { console.error("請給週次，例如 --preview 2026-W41"); process.exit(2); }
  const paper = buildPaper({ week, round: 0 });
  const out = opt("--out", null);
  if (out) { writeAtomic(out, serializeCurrent(paper)); log(`已寫出 ${out}`); }
  else paper.questions.forEach(q => console.log(`${String(q.no).padStart(2)} [${q.kind}] ${q.topic}｜答：${q.answerText}｜${q.stem.replace(/<[^>]+>/g, "").slice(0, 70)}`));
} else if (flag("--rotate")) {
  const dry = flag("--dry-run");
  const now = opt("--date", null) ? new Date(opt("--date") + "T12:00:00+08:00") : new Date();
  const target = weekId(taipeiDate(now));
  const cur = readCurrent();
  if (compareWeek(target, cur.meta.week) <= 0) {
    log(`目前週次 ${cur.meta.week} 仍是最新（今天屬於 ${target}），不需更新`);
    ghOut({ changed: "false", prev_week: cur.meta.week, new_week: cur.meta.week });
  } else {
    // 一次只前進到「今天所屬的週次」；中間若跳過幾週（排程沒跑），就直接用今天的週次，回數 +1。
    const round = cur.meta.round + 1;
    const fresh = buildPaper({ week: target, round, today: opt("--date", null) });
    const entry = archiveEntry(cur);
    const arc = readArchive().filter(e => e.week !== cur.meta.week);
    arc.unshift(entry);
    log(`封存第 ${cur.meta.round} 回 ${cur.meta.week} → ${entry.file}；產生第 ${round} 回 ${target}（${fresh.meta.from}～${fresh.meta.to}）`);
    if (!dry) {
      writeAtomic(path.join(SITE, entry.file), serializeArchived(cur));
      writeAtomic(F.archive, serializeArchive(arc));
      writeAtomic(F.current, serializeCurrent(fresh));
      for (const d of [F.papers, F.pdf]) { const keep = path.join(d, ".gitkeep"); if (fs.existsSync(keep) && fs.readdirSync(d).length > 1) fs.unlinkSync(keep); }
    } else log("（dry-run，未寫檔）");
    ghOut({ changed: dry ? "false" : "true", prev_week: cur.meta.week, prev_round: cur.meta.round, new_week: target, new_round: round });
  }
} else {
  console.log("用法：--init | --status | --preview <week> [--out f] | --rotate [--date YYYY-MM-DD] [--dry-run]");
  process.exit(2);
}
