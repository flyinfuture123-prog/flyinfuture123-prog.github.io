# -*- coding: utf-8 -*-
"""流程檢查：驗證產出的資料檔，並回歸測試最容易搞錯的中文語意。

不依賴 pytest —— CI 裡少一個相依套件就少一個壞掉的理由。
直接 `python tests/test_pipeline.py [latest.json]` 執行，有錯就非零退出。
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "scripts"))

import analyze  # noqa: E402
import textutil as tu  # noqa: E402

FAILURES: list = []


def check(condition: bool, message: str) -> None:
    if not condition:
        FAILURES.append(message)


# --------------------------------------------------------------------------
# 語意回歸：這些是規則式引擎最容易判反的句子
# --------------------------------------------------------------------------

def make(title: str, summary: str = "", outlet: str = "經濟日報", tier: int = 1,
         dup: int = 1, tickers=None) -> dict:
    return {"id": "t", "title": title, "summary": summary, "outlet": outlet,
            "outlet_tier": tier, "dup_count": dup, "tickers": tickers or ["2330"]}


def test_semantics() -> None:
    cases = [
        # (標題, 期望方向, 說明)
        ("台積電利空出盡 買盤回籠", "bull", "「利空出盡」整體是利多，不能被「利空」帶走"),
        ("聯發科利多出盡 股價開低", "bear", "「利多出盡」是利空"),
        ("鴻海本業由虧轉盈 單季獲利回升", "bull", "轉盈是明確的基本面改善"),
        ("華碩第三季由盈轉虧", "bear", "轉虧是明確利空"),
        ("聯電虧損收斂 毛利率回升", "bull", "還在虧但方向轉正"),
        ("台達電財測不如預期 法人下修", "bear", "「不如預期」必須是利空"),
        ("廣達營收優於預期 訂單滿手", "bull", "「優於預期」必須是利多"),
        ("智邦未能突破前高", "bear", "反轉詞要能翻轉「突破」"),
        ("緯創訂單遭取消 客戶轉單", "bear", "取消訂單是利空"),
        ("中華電今日除息 每股配發4.5元", "flat", "除息本身是機械性價格調整，不是利空"),
        ("玉山金完成填息", "bull", "填息是利多、貼息是利空"),
        ("國泰金貼息 股價走弱", "bear", "貼息是利空"),
        ("台積電11月營收年增28% 創同期新高", "bull", "營收年增＋創同期新高"),
        ("聯詠11月營收年減15% 需求疲弱", "bear", "營收年減＋需求疲弱"),
    ]
    for title, want, why in cases:
        got = analyze.analyze_article(make(title))
        check(got["sentiment_key"] == want,
              f"語意判讀錯誤：〈{title}〉期望 {want}，實得 {got['sentiment_key']}"
              f"（情緒 {got['sentiment']:+d}）—— {why}")


def test_confidence() -> None:
    """推測性報導的信心必須明顯低於確定性報導。"""
    rumor = analyze.analyze_article(make("傳鴻海遭客戶砍單 12月營收恐大減"))
    firm = analyze.analyze_article(make("鴻海公告遭客戶砍單 12月營收大減"))
    check(rumor["confidence"] < firm["confidence"],
          f"含「傳／恐」的報導信心 {rumor['confidence']} 應低於確定性報導 {firm['confidence']}")
    check("推測性報導" in rumor["flags"], "推測性報導應被標記")


def test_importance() -> None:
    """主流媒體＋多家跟進＋具體數字，重要性要高於單一來源的軟性報導。"""
    big = analyze.analyze_article(
        make("台積電下修全年財測 資本支出砍逾三成", outlet="經濟日報", tier=1, dup=5))
    small = analyze.analyze_article(
        make("台積電獲頒企業永續獎", outlet="某某網", tier=3, dup=1))
    check(big["importance"] > small["importance"],
          f"重大財測新聞重要性 {big['importance']} 應高於軟性報導 {small['importance']}")


def test_dedupe() -> None:
    """同一則稿被多家轉載時要合併，並記下有幾家報導。"""
    recs = [
        {"title": "台積電11月營收3,420億元 年增28%創同期新高", "outlet": "經濟日報",
         "tickers": ["2330"], "summary": ""},
        {"title": "台積電11月營收年增28% 續創同期新高", "outlet": "工商時報",
         "tickers": ["2330"], "summary": ""},
        {"title": "台積電11月營收3420億 年增28%創同期新高", "outlet": "中央社",
         "tickers": ["2330"], "summary": ""},
        {"title": "鴻海11月營收年增12% AI伺服器出貨放量", "outlet": "鉅亨網",
         "tickers": ["2317"], "summary": ""},
    ]
    kept = tu.dedupe(recs)
    check(len(kept) == 2, f"三則同稿應合併成一則，實得 {len(kept)} 則")
    tsmc = [k for k in kept if "台積電" in k["title"]]
    check(bool(tsmc) and tsmc[0]["dup_count"] == 3,
          f"合併後 dup_count 應為 3，實得 {tsmc[0]['dup_count'] if tsmc else 'n/a'}")


def test_multi_stock_link() -> None:
    """一則供應鏈新聞要能同時連到多檔。"""
    import fetch_news  # noqa: PLC0415
    rec = fetch_news.attach_tickers({
        "title": "美國宣布對半導體加徵關稅 台積電、聯電、日月光投控評估影響",
        "summary": "", "tickers": [],
    })
    for want in ("2330", "2303", "3711"):
        check(want in rec["tickers"], f"關聯個股應包含 {want}，實得 {rec['tickers']}")


def test_ticker_not_matched_inside_longer_number() -> None:
    """代號比對不能把長數字裡的片段當成股票代號。"""
    import fetch_news  # noqa: PLC0415
    rec = fetch_news.attach_tickers({
        "title": "外資今日買超金額達23300萬元", "summary": "", "tickers": [],
    })
    check("2330" not in rec["tickers"],
          f"23300 裡的 2330 不該被當成台積電，實得 {rec['tickers']}")


# --------------------------------------------------------------------------
# 資料檔結構
# --------------------------------------------------------------------------

def test_payload(path: str) -> None:
    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)

    check(d.get("schema_version") == 1, "schema_version 應為 1")
    for key in ("generated_at", "date", "market", "stocks", "articles", "stats", "categories"):
        check(key in d, f"資料檔缺少欄位 {key}")

    check(len(d["stocks"]) == 20, f"個股數量應為 20，實得 {len(d['stocks'])}")
    check(d["stats"]["article_count"] == len(d["articles"]), "article_count 與實際則數不符")
    check(d["stats"]["article_count"] >= 8, "新聞則數過少，視為抓取失敗")

    seen_ids = set()
    for a in d["articles"]:
        check(bool(a.get("id")), "新聞缺少 id")
        check(a["id"] not in seen_ids, f"新聞 id 重複：{a['id']}")
        seen_ids.add(a["id"])
        an = a.get("analysis") or {}
        check(bool(an.get("commentary")), f"新聞 {a['id']} 缺少逐則分析")
        check(-100 <= an.get("sentiment", 999) <= 100, f"新聞 {a['id']} 情緒超出範圍")
        check(0.0 <= an.get("confidence", -1) <= 1.0, f"新聞 {a['id']} 信心超出範圍")
        check(1 <= an.get("importance", 0) <= 5, f"新聞 {a['id']} 重要性超出範圍")
        check(an.get("horizon") in ("短期", "中期", "長期"), f"新聞 {a['id']} 影響時間異常")

    for s in d["stocks"]:
        check(bool(s.get("summary_text")), f"{s.get('ticker')} 缺少個股評述")
        check(-100 <= s.get("sentiment", 999) <= 100, f"{s.get('ticker')} 情緒超出範圍")
        for aid in s.get("article_ids", []):
            check(aid in seen_ids, f"{s['ticker']} 引用了不存在的新聞 {aid}")

    for aid in d["market"].get("top_article_ids", []):
        check(aid in seen_ids, f"市場摘要引用了不存在的新聞 {aid}")


def main() -> int:
    test_semantics()
    test_confidence()
    test_importance()
    test_dedupe()
    test_multi_stock_link()
    test_ticker_not_matched_inside_longer_number()

    if len(sys.argv) > 1:
        test_payload(sys.argv[1])
    else:
        print("（未提供資料檔路徑，略過資料結構檢查）")

    if FAILURES:
        print(f"\n✗ {len(FAILURES)} 項檢查未通過：\n", file=sys.stderr)
        for f in FAILURES:
            print("  - " + f, file=sys.stderr)
        return 1
    print("✓ 所有檢查通過")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
