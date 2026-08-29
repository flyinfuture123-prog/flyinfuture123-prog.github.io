# -*- coding: utf-8 -*-
"""全球服飾價格與時尚趨勢的新聞抓取層。

主來源：Google 新聞 RSS 搜尋，中英雙語各跑一組：
  - zh-TW：台灣媒體的服飾漲價、快時尚、穿搭趨勢報導
  - en-US：國際媒體的 apparel prices / fashion trend 報導
  這條路不通，整個站就沒資料，是唯一被視為「必須成功」的來源。

次要來源：國際時尚媒體的公開 RSS（WWD、Hypebeast、FashionUnited…），
  全部 best-effort —— 掛掉只會少幾則國際新聞，不影響主流程。

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
from fashion_brands import BRANDS  # noqa: E402

log = logging.getLogger("fashion_fetch")

TPE = timezone(timedelta(hours=8))

GOOGLE_NEWS = {
    "zh": "https://news.google.com/rss/search?q={q}&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant",
    "en": "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US%3Aen",
}

# 撈不到幾則時改用的放寬窗口（天）。
WIDE_WINDOW_DAYS = 7

# --------------------------------------------------------------------------
# 主題查詢：不綁品牌的大主題，價格與趨勢各半。
# 查詢字串刻意用台灣媒體／國際媒體真的會下的詞。窗口（天）依題材的
# 新聞密度設定：漲價與精品調價是「事件型」題材，7 天常常一則都沒有，
# 用 30 天；快時尚與穿搭趨勢天天有稿，用預設窗口即可。
# Google News 查詢語法備忘：OR 要大寫、括號可分組、"…" 強制詞組；
# 整串 q 會經過 URL 編碼，所以 H&M 的 & 不會截斷參數。
# --------------------------------------------------------------------------
TOPIC_QUERIES = [
    # (查詢, 語言, 備註, 最小窗口天數)
    ("服飾 (漲價 OR 調漲)", "zh", "服飾漲價", 30),
    ("(服裝 OR 成衣) 價格", "zh", "服裝價格", 14),
    ("快時尚", "zh", "快時尚", 7),
    ("穿搭 趨勢", "zh", "穿搭趨勢", 7),
    ("時裝週 OR 時裝周", "zh", "時裝週", 14),
    ("精品 (漲價 OR 調漲)", "zh", "精品漲價", 30),
    ("運動服飾 OR 機能服飾", "zh", "運動服飾", 14),
    ("紡織 (成本 OR 關稅)", "zh", "紡織成本", 30),
    ("(服飾 OR 服裝) (展店 OR 業績)", "zh", "服飾通路", 30),
    ("二手精品 OR 古著", "zh", "二手古著", 14),
    ("永續時尚", "zh", "永續時尚", 14),
    ('"apparel prices" OR "clothing prices"', "en", "apparel prices", 14),
    ('("price increase" OR "price hike") (apparel OR clothing OR fashion)',
     "en", "price hikes", 14),
    ('"fast fashion"', "en", "fast fashion", 7),
    ("fashion trends", "en", "fashion trends", 7),
    ('"fashion week"', "en", "fashion week", 14),
    ('luxury ("price increase" OR "price hike" OR "raises prices")',
     "en", "luxury prices", 30),
    ("sneaker prices", "en", "sneaker prices", 14),
    ("apparel tariffs", "en", "apparel tariffs", 14),
    ('"de minimis" (apparel OR imports)', "en", "de minimis", 30),
    ("(resale OR secondhand) fashion market", "en", "resale", 14),
]

# --------------------------------------------------------------------------
# 國際時尚媒體 RSS（best-effort）。掛掉只會少幾則，不會讓整個排程失敗。
# works 狀態以建站當時實測為準；來源改版或加牆時由 health 記錄看得出來。
# --------------------------------------------------------------------------
INTL_FEEDS = [
    {"id": "wwd", "url": "https://wwd.com/feed/", "outlet": "WWD", "lang": "en"},
    {"id": "fashionunited", "url": "https://fashionunited.com/rss/news",
     "outlet": "FashionUnited", "lang": "en"},
    {"id": "hypebeast", "url": "https://hypebeast.com/feed", "outlet": "Hypebeast", "lang": "en"},
    {"id": "fashiondive", "url": "https://www.fashiondive.com/feeds/news/",
     "outlet": "Fashion Dive", "lang": "en"},
    {"id": "glossy", "url": "https://www.glossy.co/feed/", "outlet": "Glossy", "lang": "en"},
    {"id": "thefashionlaw", "url": "https://www.thefashionlaw.com/feed/",
     "outlet": "The Fashion Law", "lang": "en"},
]

# --------------------------------------------------------------------------
# 來源可信度分級，供重要性計分使用。
# 1 = 國際時尚產業媒體與主流財經通訊社；2 = 一般大型媒體與消費時尚刊物。
# --------------------------------------------------------------------------
OUTLET_TIER = {
    1: ["WWD", "Business of Fashion", "BoF", "Vogue Business", "Reuters", "路透",
        "Bloomberg", "彭博", "Financial Times", "FT中文", "Nikkei", "日經",
        "華爾街日報", "Wall Street Journal", "經濟日報", "工商時報", "中央社",
        "FashionUnited", "Fashion Dive", "The Fashion Law", "Just Style",
        "Sourcing Journal", "CNBC", "Fashion Network", "FashionNetwork"],
    2: ["Vogue", "ELLE", "GQ", "Harper's BAZAAR", "Marie Claire", "美麗佳人",
        "Cosmopolitan", "Hypebeast", "Highsnobiety", "Glossy", "Jing Daily",
        "聯合新聞網", "自由時報", "中時新聞網", "ETtoday", "TVBS", "三立新聞網",
        "Yahoo奇摩", "商業周刊", "天下雜誌", "遠見", "數位時代", "鏡週刊",
        "風傳媒", "POPBEE", "Bella", "儂儂", "明周", "早安健康",
        "The Guardian", "衛報", "New York Times", "紐約時報", "BBC", "CNN",
        "Forbes", "富比士", "AP", "美聯社", "法新社"],
}
_TIER_LOOKUP = {name: tier for tier, names in OUTLET_TIER.items() for name in names}


def outlet_tier(outlet: str) -> int:
    o = (outlet or "").strip()
    if not o:
        return 3
    for name, tier in _TIER_LOOKUP.items():
        if name in o or o in name:
            return tier
    return 3


# --------------------------------------------------------------------------
# RSS entry 解析（與 fetch_news.py 相同邏輯；兩站的來源獨立演化，刻意不共用）
# --------------------------------------------------------------------------

def _entry_time(entry) -> Optional[datetime]:
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime.fromtimestamp(calendar.timegm(st), tz=timezone.utc).astimezone(TPE)
            except (ValueError, OverflowError, OSError):
                continue
    return None


_LI_RE = re.compile(r"<li\b", re.I)
_FONT_RE = re.compile(r"<font[^>]*>([^<]{1,32})</font>", re.I)


def _clean_summary(entry, title: str) -> Tuple[str, List[str]]:
    """回傳 (摘要, 叢集中其他媒體名)。Google 新聞叢集見 fetch_news.py 的說明。"""
    raw = entry.get("summary") or entry.get("description") or ""
    if len(_LI_RE.findall(raw)) >= 2:
        outlets = [o.strip() for o in _FONT_RE.findall(raw) if o.strip()]
        return "", outlets

    text = re.sub(r"\s{2,}", " ", tu.strip_html(raw))
    head = tu.normalize(text)[:40]
    if head and head in tu.normalize(title):
        return "", []
    return text[:400], []


def _mk_record(*, title: str, url: str, outlet: str, published: Optional[datetime],
               summary: str, source_id: str, lang: str, brands: List[str],
               dup_outlets: Optional[List[str]] = None) -> Optional[dict]:
    title = (title or "").strip()
    if len(tu.normalize(title)) < 6:
        return None
    if not (url or "").strip():
        return None
    return {
        "title": title,
        "url": url,
        "outlet": outlet or "",
        "outlet_tier": outlet_tier(outlet),
        "published": published.isoformat() if published else "",
        "published_ts": published.timestamp() if published else 0.0,
        "summary": summary or "",
        "source_id": source_id,
        "lang": lang,
        "brands": sorted(set(brands)),
        "dup_outlets": list(dup_outlets or []),
    }


# --------------------------------------------------------------------------
# 主來源：Google 新聞 RSS（中英）
# --------------------------------------------------------------------------

def fetch_google_news(query: str, *, lang: str, days: int, brands: List[str],
                      limit: int = 30) -> List[dict]:
    q = f"{query} when:{days}d"
    resp = net.get(GOOGLE_NEWS[lang].format(q=quote(q, safe="")))
    if resp is None:
        return []
    feed = feedparser.parse(resp.content)
    if getattr(feed, "bozo", 0) and not feed.entries:
        log.warning("Google News 回傳無法解析的內容：%s", query)
        return []

    out: List[dict] = []
    for entry in feed.entries[:limit]:
        source_name = (entry.get("source", {}) or {}).get("title") or ""
        title, outlet = tu.split_outlet(entry.get("title", ""), source_name)
        summary, cluster_outlets = _clean_summary(entry, title)
        rec = _mk_record(
            title=title,
            url=entry.get("link", ""),
            outlet=outlet,
            published=_entry_time(entry),
            summary=summary,
            source_id=f"google_{lang}",
            lang=lang,
            brands=brands,
            dup_outlets=cluster_outlets,
        )
        if rec:
            out.append(rec)
    return out


# --------------------------------------------------------------------------
# 次要來源：國際媒體 RSS（best-effort）
# --------------------------------------------------------------------------

def fetch_intl_feed(feed_cfg: dict, *, limit: int = 25) -> List[dict]:
    resp = net.get(feed_cfg["url"], attempts=2)
    if resp is None:
        return []
    feed = feedparser.parse(resp.content)
    out: List[dict] = []
    for entry in feed.entries[:limit]:
        title = entry.get("title", "")
        summary, _ = _clean_summary(entry, title)
        rec = _mk_record(
            title=title,
            url=entry.get("link", ""),
            outlet=feed_cfg["outlet"],
            published=_entry_time(entry),
            summary=summary,
            source_id=feed_cfg["id"],
            lang=feed_cfg.get("lang", "en"),
            brands=[],
        )
        if rec:
            out.append(rec)
    return out


# --------------------------------------------------------------------------
# 關聯品牌判定
# --------------------------------------------------------------------------

_ASCII_RE_CACHE: Dict[str, re.Pattern] = {}

# 混大小寫但同時是日常英文片語的別名，強制大小寫敏感比對：
# "plans on holding prices" 不該中 On 這個品牌。
_CASE_SENSITIVE_ALIASES = {"On Holding"}


def _alias_matches(alias: str, text: str, text_lower: str) -> bool:
    """英文別名走字界比對，中文別名走子字串。

    全大寫短別名（GAP、SHEIN、NB…）常常同時是一般英文字或縮寫，
    "mind the gap" 不該中 GAP，所以這類別名採大小寫敏感比對；
    其餘 ASCII 別名不分大小寫但仍要求字界，避免 "adidasneakers" 之類
    黏字誤中；中文沒有字界問題，照舊用子字串。
    """
    if not alias.isascii():
        return alias.lower() in text_lower
    case_sensitive = ((alias.isupper() and len(alias) <= 5)
                      or alias in _CASE_SENSITIVE_ALIASES)
    key = ("cs:" if case_sensitive else "ci:") + alias
    rx = _ASCII_RE_CACHE.get(key)
    if rx is None:
        pattern = r"(?<![A-Za-z0-9])" + re.escape(alias) + r"(?![A-Za-z0-9])"
        rx = re.compile(pattern, 0 if case_sensitive else re.IGNORECASE)
        _ASCII_RE_CACHE[key] = rx
    return bool(rx.search(text))


def attach_brands(rec: dict) -> dict:
    """依標題與摘要中出現的品牌名/別名，補上關聯品牌。

    搜尋來源帶進來的品牌一律保留（那是查詢意圖），另外掃描文字補上
    「同時被提到的其他品牌」，供應鏈與比價新聞才連得到多個品牌。
    """
    text = f"{rec.get('title', '')} {rec.get('summary', '')}"
    text_lower = text.lower()
    found = set(rec.get("brands") or [])
    matched_terms: List[str] = []
    for b in BRANDS:
        hits = [a for a in b["aliases"] if _alias_matches(a, text, text_lower)]
        if hits:
            found.add(b["slug"])
            matched_terms.extend(hits)
    rec["brands"] = sorted(found)
    rec["matched_terms"] = sorted(set(matched_terms))
    return rec


# --------------------------------------------------------------------------
# 服飾物價指數（best-effort、免金鑰）
#
# 兩個公開端點，掛掉只會讓頁面少兩個數字，不影響新聞主流程：
#   FRED    fredgraph.csv?id=CPIAPPSL   美國服飾 CPI（月，季調）
#   Eurostat prc_hicp_manr / CP03       歐元區衣著鞋類 HICP 年增率
# --------------------------------------------------------------------------

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAPPSL"
EUROSTAT_HICP = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
                 "prc_hicp_manr?format=JSON&lang=EN&coicop=CP03&geo=EU27_2020"
                 "&lastTimePeriod=4")


def _fred_apparel_cpi() -> Optional[dict]:
    resp = net.get(FRED_CSV, attempts=2)
    if resp is None:
        return None
    rows = []
    for line in resp.text.splitlines():
        parts = line.strip().split(",")
        if len(parts) != 2 or not parts[0][:4].isdigit():
            continue
        try:
            rows.append((parts[0], float(parts[1])))
        except ValueError:
            continue  # 缺值標記 "."
    if len(rows) < 13:
        return None
    period, latest = rows[-1]
    _, year_ago = rows[-13]
    yoy = round((latest / year_ago - 1) * 100, 1) if year_ago else None
    return {"id": "us_cpi", "label": "美國服飾CPI年增", "period": period[:7],
            "yoy": yoy, "level": round(latest, 1), "source": "FRED CPIAPPSL"}


def _eurostat_apparel_hicp() -> Optional[dict]:
    resp = net.get(EUROSTAT_HICP, attempts=2)
    if resp is None:
        return None
    try:
        payload = resp.json()
        values = payload["value"]
        time_index = payload["dimension"]["time"]["category"]["index"]
    except (ValueError, KeyError, TypeError):
        log.warning("Eurostat 回傳格式與預期不符")
        return None
    # JSON-stat：value 的 key 是時間索引的字串；取最新一期「有值」的月份。
    by_idx = {idx: period for period, idx in time_index.items()}
    best = None
    for key, val in values.items():
        try:
            period = by_idx.get(int(key))
        except (TypeError, ValueError):
            continue
        if period and (best is None or period > best[0]):
            best = (period, val)
    if not best or not isinstance(best[1], (int, float)):
        return None
    return {"id": "eu_hicp", "label": "歐元區衣著鞋類HICP年增", "period": best[0],
            "yoy": round(float(best[1]), 1), "level": None,
            "source": "Eurostat prc_hicp_manr CP03"}


def fetch_price_indices(health: Optional[dict] = None) -> List[dict]:
    """抓服飾物價指數。全部 best-effort，抓不到就回空列表。"""
    out: List[dict] = []
    for name, fn in (("fred_cpi", _fred_apparel_cpi),
                     ("eurostat_hicp", _eurostat_apparel_hicp)):
        item = None
        try:
            item = fn()
        except Exception as exc:  # noqa: BLE001 — 指數是加分項，不得中斷流程
            log.warning("%s 抓取失敗：%s", name, exc)
        if item:
            out.append(item)
        if health is not None:
            health["sources"].append({"id": name, "ok": bool(item),
                                      "items": 1 if item else 0, "note": "price-index"})
        net.polite_sleep(0.5)
    return out


# --------------------------------------------------------------------------
# 統籌
# --------------------------------------------------------------------------

def collect(*, days: int = 2, limit_per_query: int = 30,
            fixture: Optional[str] = None) -> Tuple[List[dict], dict]:
    """回傳 (去重後的新聞, 來源健康狀況)。"""
    health = {"sources": [], "queries": 0, "raw_items": 0, "errors": []}

    if fixture:
        log.info("離線模式：讀取 fixture %s", fixture)
        with open(fixture, encoding="utf-8") as fh:
            raw = json.load(fh)
        health["sources"].append({"id": "fixture", "ok": True, "items": len(raw), "note": fixture})
        articles = [attach_brands(r) for r in raw]
        return _finalize(articles, days, health), health

    raw: List[dict] = []

    # 1) 大主題查詢 —— 這是主力。
    for query, lang, note, min_days in TOPIC_QUERIES:
        q_days = max(days, min_days)
        health["queries"] += 1
        items = fetch_google_news(query, lang=lang, days=q_days, brands=[],
                                  limit=limit_per_query)
        # 冷門主題在短窗口可能一則都沒有，放寬一次。
        if len(items) < 3 and q_days < WIDE_WINDOW_DAYS:
            health["queries"] += 1
            items.extend(fetch_google_news(query, lang=lang, days=WIDE_WINDOW_DAYS,
                                           brands=[], limit=limit_per_query))
        raw.extend(items)
        health["sources"].append({"id": f"google_{lang}:{note}", "ok": bool(items),
                                  "items": len(items), "note": note})
        log.info("主題「%s」（%s）：%d 則", note, lang, len(items))
        net.polite_sleep(1.0)

    # 2) 逐品牌查詢。品牌新聞由別名比對關聯，查詢本身撈的是該品牌的近況。
    for b in BRANDS:
        items: List[dict] = []
        for lang_key, query in (("zh", b.get("query_zh")), ("en", b.get("query_en"))):
            if not query:
                continue
            health["queries"] += 1
            items.extend(fetch_google_news(query, lang=lang_key, days=days,
                                           brands=[b["slug"]], limit=limit_per_query))
            net.polite_sleep(1.0)
        # 重點品牌一則都沒有時放寬窗口再試一次（只試第一個查詢語言）。
        if not items and b["prominence"] >= 4 and days < WIDE_WINDOW_DAYS:
            query = b.get("query_zh") or b.get("query_en")
            lang_key = "zh" if b.get("query_zh") else "en"
            health["queries"] += 1
            items.extend(fetch_google_news(query, lang=lang_key, days=WIDE_WINDOW_DAYS,
                                           brands=[b["slug"]], limit=limit_per_query))
            net.polite_sleep(1.0)
        raw.extend(items)
        health["sources"].append({"id": f"brand:{b['slug']}", "ok": bool(items),
                                  "items": len(items), "note": b["name"]})
        log.info("品牌 %s：%d 則", b["name"], len(items))

    # 3) best-effort 的國際媒體 RSS
    for feed_cfg in INTL_FEEDS:
        try:
            items = fetch_intl_feed(feed_cfg)
        except Exception as exc:  # noqa: BLE001 — 次要來源不得中斷整個流程
            log.warning("%s 抓取失敗：%s", feed_cfg["id"], exc)
            health["errors"].append(f"{feed_cfg['id']}: {exc}")
            items = []
        raw.extend(items)
        health["sources"].append({"id": feed_cfg["id"], "ok": bool(items),
                                  "items": len(items), "note": "best-effort"})
        net.polite_sleep(0.5)

    health["raw_items"] = len(raw)
    articles = [attach_brands(r) for r in raw]
    return _finalize(articles, days, health), health


def _finalize(articles: List[dict], days: int, health: dict) -> List[dict]:
    # 事件型主題（精品調價、關稅）用的是 30 天窗口，過濾門檻必須跟著放寬，
    # 否則放寬撈回來的那些會在這裡被全部丟掉。重要性排序仍然偏好新的新聞。
    max_topic_window = max(q[3] for q in TOPIC_QUERIES)
    effective = max(days, WIDE_WINDOW_DAYS, max_topic_window)
    cutoff = datetime.now(TPE) - timedelta(days=effective, hours=6)
    fresh = [a for a in articles
             if not a.get("published_ts") or a["published_ts"] >= cutoff.timestamp()]

    # 排序決定去重時「誰是正本」：先看媒體層級，再看時間新舊。
    fresh.sort(key=lambda a: (a.get("outlet_tier", 3), -a.get("published_ts", 0)))

    # textutil.dedupe 的「同主體守門」看的是 tickers 欄位；這裡的主體是品牌，
    # 借同一個欄位過一趟，出來再改回 brands。
    for a in fresh:
        a["tickers"] = a.get("brands") or []
    deduped = tu.dedupe(fresh)
    for a in deduped:
        a["brands"] = sorted(set(a.pop("tickers", []) or []))
    deduped.sort(key=lambda a: -a.get("published_ts", 0))

    for a in deduped:
        a["id"] = tu.title_hash(a["title"])[:12]

    health["after_dedupe"] = len(deduped)
    health["dropped_stale"] = len(articles) - len(fresh)
    log.info("原始 %d 則 → 過期濾除 %d → 去重後 %d 則",
             len(articles), len(articles) - len(fresh), len(deduped))
    return deduped


def main() -> int:
    ap = argparse.ArgumentParser(description="抓取全球服飾價格與時尚趨勢新聞")
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
