#!/usr/bin/env node
// 學測數A預測題庫 —— 用 Chromium 把 print.html 轉成教用版／學用版 PDF
//
// 用法：node scripts/gsat_pdf.mjs --week 2026-W38 [--out 目錄] [--edition student|teacher]
// 需要 playwright（本機：全域安裝或 node_modules；CI 由 workflow 安裝）與 Chromium。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "matha-c4f9fd6edf213a5b");
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const week = opt("--week"); if (!/^\d{4}-W\d{2}$/.test(week || "")) { console.error("請指定 --week 2026-W38"); process.exit(2); }
const outDir = path.resolve(opt("--out", path.join(SITE, "pdf")));
const editions = opt("--edition") ? [opt("--edition")] : ["student", "teacher"];

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const paths = [path.join(ROOT, "node_modules"), process.env.PLAYWRIGHT_NODE_MODULES, "/opt/node22/lib/node_modules", "/usr/lib/node_modules", "/usr/local/lib/node_modules"].filter(Boolean);
  for (const p of paths) { try { return req(req.resolve("playwright", { paths: [p] })); } catch (e) { /* 下一個 */ } }
  try { return req("playwright"); } catch (e) { throw new Error("找不到 playwright，請先 npm i --no-save playwright"); }
}
const { chromium } = loadPlaywright();
const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  for (const ed of editions) {
    const ctx = await browser.newContext({ locale: "zh-TW" });
    const page = await ctx.newPage();
    page.on("pageerror", e => console.error("[print] 頁面錯誤：", e.message));
    const url = pathToFileURL(path.join(SITE, "print.html")).href + `?week=${week}&edition=${ed}`;
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.PRINT_READY === true, null, { timeout: 60000 });
    const err = await page.evaluate(() => window.PRINT_ERROR || null);
    if (err) throw new Error(`列印頁載入失敗（${week} ${ed}）：${err}`);
    await page.emulateMedia({ media: "print" });
    const title = await page.title();
    const file = path.join(outDir, `${week}-${ed}.pdf`);
    await page.pdf({
      path: file, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;color:#666;width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>${title}</span><span>學測數A預測題庫</span></div>`,
      footerTemplate: `<div style="font-size:8px;color:#666;width:100%;text-align:center;font-family:sans-serif">第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁</div>`,
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" }
    });
    const size = fs.statSync(file).size;
    if (size < 20000) throw new Error(`PDF 過小（${size} bytes）：${file}`);
    console.log(`[pdf] ${file}（${(size / 1024).toFixed(0)} KB）`);
    await ctx.close();
  }
} finally { await browser.close(); }
