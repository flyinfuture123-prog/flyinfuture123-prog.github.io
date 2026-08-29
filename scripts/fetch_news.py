# -*- coding: utf-8 -*-
"""新聞抓取層。

主來源：Google 新聞 RSS 搜尋（免金鑰、涵蓋台灣所有主要財經媒體、
        支援 when:Nd 時間限縮）。這條路不通，整個站就沒資料，所以它是唯一
        被視為「必須成功」的來源。
次要來源：鉅亨網 / Yahoo 股市 的公開列表，全部 best-effort —— 掛掉只會少
        幾則大盤新聞，不影響個股。
行情：   證交所 OpenAPI 的每日收盤，用來在頁面上把新聞和股價擺在一起。

所有對外請求都經過 net.get()，不會往上丟例外。
"""

from __future__ import annotations

import argparse
import calendar
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

import feedparser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import net  # noqa: E402
import textutil as tu  # noqa: E402
from stocks import ALL_TARGETS, TOP20  # noqa: E402

log = logging.getLogger("fetch")

TPE = timezone(timedelta(hours=8))

GOOGLE_NEWS = ("https://news.google.com/rss/search?q={q}"
               "&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant")
CNYES_LIST = ("https://api.cnyes.com/media/api/v1/newslist/category/{cat}"
              "?limit={limit}")
YAHOO_RSS = "https://tw.stock.yahoo.com/rss?category=news"
TWSE_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"

# 來源可信度分級，供重要性計分使用。
OUTLET_TIER = {
    1: ["經濟日報", "工商時報", "中央社", "鉅亨網", "MoneyDJ", "路透", "彭博", "Bloomberg",
        "Reuters", "日經", "Nikkei", "華爾街日報", "financialtimes", "科技新報"],
    2: ["聯合新聞網", "自由時報", "中時新聞網", "TVBS", "三立新聞網", "ETtoday", "Yahoo奇摩",
        "Yahoo奇摩股市", "商業周刊", "天下雜誌", "遠見", "數位時代", "財訊", "今周刊", "非凡新聞"],
}
_TIER_LOOKUP = {name: tier for tier, names in OUTLET_TIER.items() for name in names}


def outlet_tier(outlet: str) -> int:
    """1 = 財經主流媒體，2 = 一般大型媒體，3 = 其他/內容農場。"""
    o = (outlet or "").strip()
    if not o:
        return 3
    for name, tier in _TIER_LOOKUP.items():
        if name in o or o in name:
            return tier
    return 3


def _entry_time(entry) -> Optional[datetime]:
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime.fromtimestamp(calendar.timegm(st), tz=timezone.utc).astimezone(TPE)
            except (ValueError, OverflowError, OSError):
                continue
    return None


def _clean_summary(entry, title: str) -> str:
    raw = entry.get("summary") or entry.get("description") or ""
    text = tu.strip_html(raw)
    # Google 的 description 常常只是把標題和媒體名再列一次，那就沒有資訊量。
    if tu.normalize(text)[:40] and tu.normalize(text)[:40] in tu.normalize(title):
        return ""
    text = re.sub(r"\s{2,}", " ", text)
    return text[:400]


def _mk_record(*, title: str, url: str, outlet: str, published: Optional[datetime],
               summary: str, source_id: str, tickers: List[str]) -> Optional[dict]:
    title = (title or "").strip()
    if len(tu.normalize(title)) < 6:
        return None
    # 沒有連結的新聞讀者無法回頭查證原文，對這個站來說沒有價值；
    # 而且 CI 的資料驗證會要求每一則都有 url，寧可在這裡就丟掉。
    if not (url or "").strip():
        return None
    return {
        "title": title,
        "url": url or "",
        "outlet": outlet or "",
        "outlet_tier": outlet_tier(outlet),
        "published": published.isoformat() if published else "",
        "published_ts": published.timestamp() if published else 0.0,
        "summary": summary or "",
        "source_id": source_id,
        "tickers": sorted(set(tickers)),
    }


# --------------------------------------------------------------------------
# 主來源：Google 新聞 RSS
# --------------------------------------------------------------------------

def fetch_google_news(query: str, *, days: int, tickers: List[str],
                      limit: int = 40) -> List[dict]:
    q = f'{query} when:{days}d'
    resp = net.get(GOOGLE_NEWS.format(q=quote(q, safe="")))
    if resp is None:
        return []
    feed = feedparser.parse(resp.content)
    if getattr(feed, "bozo", 0) and not feed.entries:
        log.warning("Google News 回傳無法解析的內容：%s", query)
        return []

    out: List[dict] = []
    for entry in feed.entries[:limit]:
        raw_title = entry.get("title", "")
        title, split_outlet = tu.split_outlet(raw_title)
        outlet = (entry.get("source", {}) or {}).get("title") or split_outlet
        rec = _mk_record(
            title=title,
            url=entry.get("link", ""),
            outlet=outlet,
            published=_entry_time(entry),
            summary=_clean_summary(entry, title),
            source_id="google_news",
            tickers=tickers,
        )
        if rec:
            out.append(rec)
    return out


# --------------------------------------------------------------------------
# 次要來源（best-effort，失敗只記錄不影響流程）
# --------------------------------------------------------------------------

def fetch_cnyes(category: str = "tw_stock", limit: int = 30) -> List[dict]:
    resp = net.get(CNYES_LIST.format(cat=category, limit=limit), attempts=2)
    if resp is None:
        return []
    try:
        payload = resp.json()
        items = payload["items"]["data"]
    except (ValueError, KeyError, TypeError) as exc:
        log.warning("鉅亨網回傳格式與預期不符：%s", exc)
        return []

    out: List[dict] = []
    for item in items:
        try:
            ts = float(item.get("publishAt") or 0)
            published = datetime.fromtimestamp(ts, tz=TPE) if ts else None
        except (ValueError, OSError, OverflowError):
            published = None
        rec = _mk_record(
            title=item.get("title", ""),
            url=f"https://news.cnyes.com/news/id/{item.get('newsId')}" if item.get("newsId") else "",
            outlet="鉅亨網",
            published=published,
            summary=tu.strip_html(item.get("summary", ""))[:400],
            source_id="cnyes",
            tickers=[],
        )
        if rec:
            out.append(rec)
    return out


def fetch_yahoo() -> List[dict]:
    resp = net.get(YAHOO_RSS, attempts=2)
    if resp is None:
        return []
    feed = feedparser.parse(resp.content)
    out: List[dict] = []
    for entry in feed.entries[:40]:
        title = entry.get("title", "")
        rec = _mk_record(
            title=title,
            url=entry.get("link", ""),
            outlet="Yahoo奇摩股市",
            published=_entry_time(entry),
            summary=_clean_summary(entry, title),
            source_id="yahoo",
            tickers=[],
        )
        if rec:
            out.append(rec)
    return out


def fetch_quotes() -> Dict[str, dict]:
    """證交所每日收盤行情（全部上市個股）。抓不到就回空 dict。"""
    resp = net.get(TWSE_DAY_ALL, attempts=2, timeout=30)
    if resp is None:
        return {}
    try:
        rows = resp.json()
    except ValueError:
        log.warning("證交所行情回傳非 JSON")
        return {}
    wanted = {s["ticker"] for s in TOP20}
    quotes: Dict[str, dict] = {}
    for row in rows if isinstance(rows, list) else []:
        code = str(row.get("Code", "")).strip()
        if code not in wanted:
            continue
        close = _to_float(row.get("ClosingPrice"))
        change = _to_float(row.get("Change"))
        prev = close - change if close is not None and change is not None else None
        quotes[code] = {
            "close": close,
            "change": change,
            "change_pct": round(change / prev * 100, 2) if prev else None,
            "volume": _to_float(row.get("TradeVolume")),
        }
    return quotes


def _to_float(value) -> Optional[float]:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError, AttributeError):
        return None


# --------------------------------------------------------------------------
# 關聯個股判定
# --------------------------------------------------------------------------

def attach_tickers(rec: dict) -> dict:
    """依標題與摘要中出現的公司名/別名，補上關聯個股。

    搜尋來源帶進來的 ticker 一律保留（那是查詢意圖），另外掃描文字補上
    「同時被提到的其他權值股」，這樣一則供應鏈新聞才連得到多檔。
    """
    text = f"{rec.get('title','')} {rec.get('summary','')}"
    found = set(rec.get("tickers") or [])
    matched_terms: List[str] = []
    for s in TOP20:
        # 公司名與別名用單純的子字串比對就夠了；代號一定要走正規式，
        # 否則「買超23300萬元」裡的 2330 會被誤判成台積電。
        hits = tu.contains_any(text, [s["name"]] + list(s["aliases"]))
        if re.search(rf"(?<!\d){s['ticker']}(?!\d)", text):
            hits = hits + [s["ticker"]]
        if hits:
            found.add(s["ticker"])
            matched_terms.extend(hits)
    rec["tickers"] = sorted(found)
    rec["matched_terms"] = sorted(set(matched_terms))
    return rec


# --------------------------------------------------------------------------
# 統籌
# --------------------------------------------------------------------------

def collect(*, days: int = 2, limit_per_query: int = 40,
            fixture: Optional[str] = None) -> Tuple[List[dict], dict]:
    """回傳 (去重後的新聞, 來源健康狀況)。"""
    health = {"sources": [], "queries": 0, "raw_items": 0, "errors": []}

    if fixture:
        log.info("離線模式：讀取 fixture %s", fixture)
        with open(fixture, encoding="utf-8") as fh:
            raw = json.load(fh)
        health["sources"].append({"id": "fixture", "ok": True, "items": len(raw), "note": fixture})
        articles = [attach_tickers(r) for r in raw]
        return _finalize(articles, days, health), health

    raw: List[dict] = []

    # 1) 逐檔（含大盤）跑 Google 新聞搜尋 —— 這是主力。
    for target in ALL_TARGETS:
        got = 0
        for term in target["query_terms"]:
            health["queries"] += 1
            tickers = [] if target["ticker"] == "TAIEX" else [target["ticker"]]
            items = fetch_google_news(term, days=days, tickers=tickers,
                                      limit=limit_per_query)
            got += len(items)
            raw.extend(items)
            net.polite_sleep(1.0)
        log.info("%s(%s)：%d 則", target["name"], target["ticker"], got)
        health["sources"].append({"id": f"google:{target['ticker']}", "ok": got > 0,
                                  "items": got, "note": target["name"]})

    # 2) best-effort 的市場面來源
    for name, fn in (("cnyes", fetch_cnyes), ("yahoo", fetch_yahoo)):
        try:
            items = fn()
        except Exception as exc:  # noqa: BLE001 — 次要來源不得中斷整個流程
            log.warning("%s 抓取失敗：%s", name, exc)
            health["errors"].append(f"{name}: {exc}")
            items = []
        raw.extend(items)
        health["sources"].append({"id": name, "ok": bool(items), "items": len(items),
                                  "note": "best-effort"})
        net.polite_sleep(0.5)

    health["raw_items"] = len(raw)
    articles = [attach_tickers(r) for r in raw]
    return _finalize(articles, days, health), health


def _finalize(articles: List[dict], days: int, health: dict) -> List[dict]:
    cutoff = datetime.now(TPE) - timedelta(days=days, hours=6)
    fresh = [a for a in articles
             if not a.get("published_ts") or a["published_ts"] >= cutoff.timestamp()]

    # 排序決定去重時「誰是正本」：先看媒體層級，再看時間新舊。
    fresh.sort(key=lambda a: (a.get("outlet_tier", 3), -a.get("published_ts", 0)))
    deduped = tu.dedupe(fresh)
    deduped.sort(key=lambda a: -a.get("published_ts", 0))

    for a in deduped:
        a["id"] = tu.title_hash(a["title"])[:12]

    health["after_dedupe"] = len(deduped)
    health["dropped_stale"] = len(articles) - len(fresh)
    log.info("原始 %d 則 → 過期濾除 %d → 去重後 %d 則",
             len(articles), len(articles) - len(fresh), len(deduped))
    return deduped


def main() -> int:
    ap = argparse.ArgumentParser(description="抓取台股權值股新聞")
    ap.add_argument("--days", type=int, default=2)
    ap.add_argument("--fixture", help="離線測試用的 JSON 檔")
    ap.add_argument("--out", default="-")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    articles, health = collect(days=args.days, fixture=args.fixture)
    payload = {"articles": articles, "health": health}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"寫入 {args.out}（{len(articles)} 則）", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
