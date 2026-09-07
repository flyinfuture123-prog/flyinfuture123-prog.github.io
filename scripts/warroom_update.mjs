#!/usr/bin/env node
// 台股戰情室 —— 每日資料更新
//
// 把網頁「更新資料」按鈕的邏輯搬到 GitHub Actions：讀取 data.js 內建快照、
// 向 FinMind 開放 API 抓取最後交易日之後的增量、合併、驗證後回寫 data.js。
// 網頁本身完全不動，Pages 重新部署後所有訊號會以新資料重算。
//
// 用法：
//   node scripts/warroom_update.mjs            # 實際更新（需要對外網路）
//   node scripts/warroom_update.mjs --selftest # 離線自我測試（CI 用，不打 API）
//
// 環境變數：
//   FINMIND_TOKEN  選填。FinMind 註冊 token，可提高請求上限；匿名額度
//                  也足夠一次全量更新（約 165 個請求），沒設定照樣能跑。
//   GITHUB_OUTPUT  存在時寫入 changed / data_date / rows_added 供後續步驟使用。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_JS = path.join(ROOT, 'tw-f7ae6d8241f3f8e1', 'data.js');
const FM = 'https://api.finmindtrade.com/api/v4/data?';

// 個股序列的保留長度。MA240／52 週統計最多要 250 根，全部留足餘裕，
// 讓 data.js 大小長期維持穩定而不是無限成長。大盤層級（taiex/inst/...）
// 一天只長一列，且統計模型會用到完整歷史，不裁。
const KEEP = { px: 480, inst: 90, per: 270, rev: 40 };

const log = m => console.log(`[warroom] ${m}`);

// ---------- data.js 讀寫 ----------
function loadData() {
  const src = fs.readFileSync(DATA_JS, 'utf-8');
  const m = src.match(/^window\.DATA = (\{[\s\S]*\});\s*$/);
  if (!m) throw new Error('data.js 格式不符（找不到 window.DATA = {...};）');
  return JSON.parse(m[1]);
}
function saveData(D) {
  const tmp = DATA_JS + '.tmp';
  fs.writeFileSync(tmp, 'window.DATA = ' + JSON.stringify(D) + ';\n');
  fs.renameSync(tmp, DATA_JS); // 原子換檔，避免留下寫到一半的檔案
}

// ---------- FinMind ----------
async function fm(params, { retries = 3 } = {}) {
  const q = new URLSearchParams(params);
  if (process.env.FINMIND_TOKEN) q.set('token', process.env.FINMIND_TOKEN);
  for (let i = 0; ; i++) {
    const r = await fetch(FM + q.toString(), { headers: { 'user-agent': 'warroom-daily/1.0' } });
    if (r.status === 402 || r.status === 429) {
      if (i >= retries) throw new Error(`FinMind 請求上限（HTTP ${r.status}）：${q.get('dataset')}`);
      const wait = 65 * (i + 1);
      log(`  請求上限，等 ${wait}s 後重試 ${q.get('dataset')} ${q.get('data_id') || ''}`);
      await new Promise(res => setTimeout(res, wait * 1000));
      continue;
    }
    if (!r.ok) {
      if (i >= retries) throw new Error(`HTTP ${r.status}：${q.get('dataset')}`);
      await new Promise(res => setTimeout(res, 5000 * (i + 1)));
      continue;
    }
    const j = await r.json();
    if (j.status && j.status !== 200) throw new Error(`${q.get('dataset')}：${j.msg || 'API 錯誤'}`);
    return j.data || [];
  }
}

// ---------- 合併與整理（與網頁內 updateData 相同語意） ----------
function mergeRows(existing, rows) {
  const seen = new Set(existing.map(r => r[0]));
  const add = rows.filter(r => !seen.has(r[0]));
  return existing.concat(add).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
const tail = (rows, n) => (rows.length > n ? rows.slice(rows.length - n) : rows);
const daysAgo = n => { const t = new Date(); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
const isN = x => typeof x === 'number' && Number.isFinite(x);

function normNews(rows) {
  const out = [], seen = new Set();
  for (const r of rows) {
    if (!r || !r.title || !r.link) continue;
    if (r.source === 'CMoney' || /cmoney\.tw\/forum/.test(r.link) || /股市爆料同學會/.test(r.title)) continue;
    const title = String(r.title).replace(' - ' + r.source, '').trim().slice(0, 90);
    const key = title.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([String(r.date).slice(0, 16), r.source || '', title, r.link]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 25);
}

async function fetchMarketNews() {
  try {
    const r = await fetch('https://api.cnyes.com/media/api/v1/newslist/category/tw_stock?limit=30&page=1');
    if (!r.ok) return null;
    const j = await r.json();
    const items = (j.items && j.items.data) || (j.data && j.data.items) || [];
    return items.map(it => [
      new Date(it.publishAt * 1000).toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 16),
      '鉅亨網', String(it.title).slice(0, 90), 'https://news.cnyes.com/news/id/' + it.newsId,
    ]);
  } catch { return null; }
}

// ---------- 驗證 ----------
// 寫檔前的守門：抓回來的東西不對勁時寧可整批放棄（明天再跑），
// 也不要把壞資料推上線讓整個儀表板算出錯的訊號。
function validate(D, prevLast) {
  const errs = [];
  const last = D.taiex[D.taiex.length - 1];
  if (!(last && last[0] >= prevLast)) errs.push(`taiex 最後交易日倒退（${last && last[0]} < ${prevLast}）`);
  for (const r of D.taiex.slice(-30)) {
    if (!(typeof r[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && isN(r[4]) && r[4] > 1000)) {
      errs.push(`taiex 列格式不符：${JSON.stringify(r).slice(0, 80)}`); break;
    }
  }
  const dates = D.taiex.map(r => r[0]);
  if (new Set(dates).size !== dates.length) errs.push('taiex 有重複日期');
  for (const [code, st] of Object.entries(D.stocks)) {
    const lp = st.px[st.px.length - 1];
    if (!lp || !isN(lp[4]) || lp[4] <= 0) { errs.push(`${code} 價量序列尾端無效`); continue; }
    // 個別股票偶爾停牌，允許落後大盤幾天，但不能差太多
    const gap = (new Date(last[0]) - new Date(lp[0])) / 86400000;
    if (gap > 10) errs.push(`${code} 價量落後大盤 ${gap.toFixed(0)} 天（${lp[0]}）`);
  }
  if (D.news) {
    for (const [k, items] of Object.entries(D.news)) {
      if (!Array.isArray(items)) { errs.push(`news.${k} 不是陣列`); continue; }
      for (const it of items) if (!Array.isArray(it) || it.length !== 4) { errs.push(`news.${k} 項目格式不符`); break; }
    }
  }
  return errs;
}

function ghOutput(kv) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(kv).map(([k, v]) => `${k}=${v}\n`).join(''));
}

// ---------- 主流程 ----------
async function update() {
  const D = loadData();
  const from = D.meta.lastTradeDate;
  log(`快照最後交易日 ${from}，開始抓取增量…`);

  // 大盤價量
  const tx = await fm({ dataset: 'TaiwanStockPrice', data_id: 'TAIEX', start_date: from });
  const beforeRows = D.taiex.length;
  D.taiex = mergeRows(D.taiex, tx.filter(r => r.close > 0).map(r => [r.date, r.open, r.max, r.min, r.close, r.Trading_Volume, r.Trading_money]));
  const added = D.taiex.length - beforeRows;
  log(`taiex +${added} 列（${D.taiex[D.taiex.length - 1][0]}）`);

  if (added === 0) {
    // 假日／連假：沒有新交易日就不動檔案，workflow 跳過 commit。
    log('沒有新交易日，跳過本次更新。');
    ghOutput({ changed: 'false', data_date: from, rows_added: 0 });
    return;
  }

  // 三大法人（現貨）
  const inst = await fm({ dataset: 'TaiwanStockTotalInstitutionalInvestors', start_date: from });
  const byD = {};
  for (const r of inst) (byD[r.date] ||= {})[r.name] = r.buy - r.sell;
  D.inst = mergeRows(D.inst, Object.keys(byD)
    .filter(d => byD[d].Foreign_Investor !== undefined && byD[d].Dealer_Hedging !== undefined)
    .map(d => [d, byD[d].Foreign_Investor, byD[d].Investment_Trust || 0, byD[d].Dealer_self || 0, byD[d].Dealer_Hedging]));

  // 融資融券
  const mg = await fm({ dataset: 'TaiwanStockTotalMarginPurchaseShortSale', start_date: from });
  const mgD = {};
  for (const r of mg) (mgD[r.date] ||= {})[r.name] = r.TodayBalance;
  D.margin = mergeRows(D.margin, Object.keys(mgD)
    .filter(d => mgD[d].MarginPurchaseMoney !== undefined && mgD[d].ShortSale !== undefined)
    .map(d => [d, mgD[d].MarginPurchase, mgD[d].MarginPurchaseMoney, mgD[d].ShortSale]));

  // 台指期法人未平倉
  const fut = await fm({ dataset: 'TaiwanFuturesInstitutionalInvestors', data_id: 'TX', start_date: from });
  const fD = {};
  for (const r of fut) (fD[r.date] ||= {})[r.institutional_investors] = r;
  D.fut = mergeRows(D.fut, Object.keys(fD)
    .filter(d => fD[d]['外資'] && fD[d]['投信'] && fD[d]['自營商'])
    .map(d => {
      const F = fD[d]['外資'], T = fD[d]['投信'], S = fD[d]['自營商'];
      return [d, F.long_open_interest_balance_volume, F.short_open_interest_balance_volume,
        T.long_open_interest_balance_volume, T.short_open_interest_balance_volume,
        S.long_open_interest_balance_volume, S.short_open_interest_balance_volume,
        F.long_deal_volume, F.short_deal_volume];
    }));

  // 美股與匯率
  for (const [k, id] of [['gspc', '^GSPC'], ['ixic', '^IXIC'], ['sox', '^SOX'], ['vix', '^VIX']]) {
    const us = await fm({ dataset: 'USStockPrice', data_id: id, start_date: from });
    D.us[k] = mergeRows(D.us[k], us.filter(r => r.Close > 0).map(r => [r.date, r.Close]));
  }
  const fx = await fm({ dataset: 'TaiwanExchangeRate', data_id: 'USD', start_date: from });
  D.fx = mergeRows(D.fx, fx.filter(r => r.spot_buy > 0).map(r => [r.date, (r.spot_buy + r.spot_sell) / 2]));

  // 個股：價量、法人、估值、月營收、新聞
  const codes = Object.keys(D.stocks);
  log(`大盤完成，更新 ${codes.length} 檔個股…`);
  D.news ||= {};
  let idx = 0;
  const worker = async () => {
    while (idx < codes.length) {
      const code = codes[idx++];
      const st = D.stocks[code];
      const px = await fm({ dataset: 'TaiwanStockPrice', data_id: code, start_date: from });
      st.px = tail(mergeRows(st.px, px.filter(r => r.close > 0).map(r => [r.date, r.open, r.max, r.min, r.close, r.Trading_Volume])), KEEP.px);
      const ii = await fm({ dataset: 'TaiwanStockInstitutionalInvestorsBuySell', data_id: code, start_date: from });
      const iD = {};
      for (const r of ii) (iD[r.date] ||= {})[r.name] = r.buy - r.sell;
      st.inst = tail(mergeRows(st.inst, Object.keys(iD)
        .filter(d => iD[d].Foreign_Investor !== undefined)
        .map(d => [d, iD[d].Foreign_Investor, iD[d].Investment_Trust || 0, (iD[d].Dealer_self || 0) + (iD[d].Dealer_Hedging || 0)])), KEEP.inst);
      const per = await fm({ dataset: 'TaiwanStockPER', data_id: code, start_date: from });
      st.per = tail(mergeRows(st.per, per.map(r => [r.date, r.dividend_yield, r.PER, r.PBR])), KEEP.per);
      const lastRev = st.rev.length ? st.rev[st.rev.length - 1][0] : '2023-01';
      const rev = await fm({ dataset: 'TaiwanStockMonthRevenue', data_id: code, start_date: lastRev + '-01' });
      st.rev = tail(mergeRows(st.rev, rev.map(r => [`${r.revenue_year}-${String(r.revenue_month).padStart(2, '0')}`, r.revenue])), KEEP.rev);
      try {
        const news = await fm({ dataset: 'TaiwanStockNews', data_id: code, start_date: daysAgo(3) });
        D.news[code] = normNews(news);
      } catch (e) { log(`  ${code} 新聞略過（${e.message}）`); }
      log(`  ${code} ${st.name} 完成（${idx}/${codes.length}）`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const mk = await fetchMarketNews();
  if (mk && mk.length) D.news.market = mk;

  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 16);
  D.meta.newsUpdated = now;
  D.meta.lastTradeDate = D.taiex[D.taiex.length - 1][0];
  D.meta.generated = now + '（每日自動更新）';

  const errs = validate(D, from);
  if (errs.length) {
    console.error('[warroom] 驗證失敗，放棄寫檔：\n  - ' + errs.join('\n  - '));
    process.exit(1);
  }
  saveData(D);
  log(`完成：最新交易日 ${D.meta.lastTradeDate}，taiex +${added} 列，data.js ${(fs.statSync(DATA_JS).size / 1024).toFixed(0)} KB`);
  ghOutput({ changed: 'true', data_date: D.meta.lastTradeDate, rows_added: added });
}

// ---------- 離線自我測試（CI 的離線流程檢查用） ----------
function selftest() {
  // mergeRows：去重、排序、保留舊列
  const a = [['2026-01-02', 1], ['2026-01-03', 2]];
  const merged = mergeRows(a, [['2026-01-03', 99], ['2026-01-06', 3], ['2026-01-01', 0]]);
  console.assert(JSON.stringify(merged.map(r => r[0])) === '["2026-01-01","2026-01-02","2026-01-03","2026-01-06"]', 'mergeRows 排序/去重');
  console.assert(merged[2][1] === 2, 'mergeRows 應保留既有列而不是覆蓋');
  // tail
  console.assert(tail([1, 2, 3, 4], 2).join() === '3,4' && tail([1], 5).length === 1, 'tail');
  // normNews：濾論壇、去重、截斷
  const news = normNews([
    { date: '2026-09-05 10:00:00', source: 'X', title: 'A'.repeat(120), link: 'https://x/1' },
    { date: '2026-09-05 11:00:00', source: 'CMoney', title: '爆料', link: 'https://cmoney.tw/forum/1' },
    { date: '2026-09-06 09:00:00', source: 'Y', title: 'B - Y', link: 'https://y/2' },
  ]);
  console.assert(news.length === 2 && news[0][2] === 'B' && news[1][2].length === 90, 'normNews');
  // validate：正常資料通過、壞資料擋下
  const D = loadData();
  console.assert(validate(D, D.meta.lastTradeDate).length === 0, '現有 data.js 應通過驗證');
  const bad = JSON.parse(JSON.stringify(D));
  bad.taiex.push(['2026-13-99', 0, 0, 0, NaN, 0, 0]);
  console.assert(validate(bad, D.meta.lastTradeDate).length > 0, '壞列應被驗證擋下');
  const back = JSON.parse(JSON.stringify(D));
  back.taiex = back.taiex.slice(0, -5);
  console.assert(validate(back, D.meta.lastTradeDate).length > 0, '日期倒退應被擋下');
  // data.js 序列化往返
  const rt = JSON.parse(JSON.stringify(D));
  console.assert(rt.meta.lastTradeDate === D.meta.lastTradeDate && Object.keys(rt.stocks).length === Object.keys(D.stocks).length, '序列化往返');
  log('selftest 通過 ✓');
}

if (process.argv.includes('--selftest')) selftest();
else await update();
