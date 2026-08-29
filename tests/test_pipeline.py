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
        ("聯電11月營收年減15% 需求疲弱", "bear", "營收年減＋需求疲弱"),
    ]
    for title, want, why in cases:
        got = analyze.analyze_article(make(title))
        check(got["sentiment_key"] == want,
              f"語意判讀錯誤：〈{title}〉期望 {want}，實得 {got['sentiment_key']}"
              f"（情緒 {got['sentiment']:+d}）—— {why}")


def test_negators_do_not_misfire() -> None:
    """反轉詞不可以在「無塵室」「未來」「不動產」這種詞裡誤中。

    這曾經是個很難察覺的錯：分數看起來完全合理，只是方向剛好相反。
    """
    cases = [
        ("台積電無塵室擴產 產能滿載", "bull", "「無塵室」裡的無不是否定"),
        ("緯創未來訂單滿手 明年產能吃緊", "bull", "「未來」裡的未不是否定"),
        ("廣達不動產處分利益入帳 獲利成長", "bull", "「不動產」裡的不不是否定"),
        ("聯電無線通訊晶片需求強勁", "bull", "「無線」裡的無不是否定"),
    ]
    for title, want, why in cases:
        got = analyze.analyze_article(make(title))
        check(got["sentiment_key"] == want,
              f"反轉詞誤中：〈{title}〉期望 {want}，實得 {got['sentiment_key']}"
              f"（情緒 {got['sentiment']:+d}）—— {why}")

    # 真正的否定仍然要生效
    for title in ("智邦未能突破前高", "緯創訂單遭取消"):
        got = analyze.analyze_article(make(title))
        check(got["sentiment"] < 0, f"〈{title}〉的否定沒有生效（{got['sentiment']:+d}）")


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


def test_dedupe_respects_subject() -> None:
    """同模板不同主角的標題不可以被併掉。

    「廣達AI伺服器出貨看增」和「緯創AI伺服器出貨看增」的字元重疊度是 0.78，
    沒有主體守門的話其中一家的新聞會直接從網站上消失。
    """
    recs = [
        {"title": "廣達AI伺服器出貨看增", "outlet": "經濟日報", "tickers": ["2382"], "summary": ""},
        {"title": "緯創AI伺服器出貨看增", "outlet": "工商時報", "tickers": ["3231"], "summary": ""},
        {"title": "廣達AI伺服器出貨看增 法人喊買", "outlet": "鉅亨網",
         "tickers": ["2382"], "summary": ""},
    ]
    kept = tu.dedupe(recs)
    check(len(kept) == 2, f"兩家公司的同模板標題應保留 2 則，實得 {len(kept)} 則")
    names = {k["title"][:2] for k in kept}
    check(names == {"廣達", "緯創"}, f"保留下來的應該是廣達與緯創各一則，實得 {names}")


def test_split_outlet_keeps_dashes_in_title() -> None:
    """標題本身含破折號時不可以被當成媒體名切掉。"""
    title, outlet = tu.split_outlet("台積電 - 三星 - 英特爾三強鼎立 - 經濟日報", "經濟日報")
    check(title == "台積電 - 三星 - 英特爾三強鼎立",
          f"標題被切壞了：{title}")
    check(outlet == "經濟日報", f"媒體名應為經濟日報，實得 {outlet}")

    title2, _ = tu.split_outlet("鴻海11月營收年增12%", "中央社")
    check(title2 == "鴻海11月營收年增12%", f"沒有後綴時不該改動標題：{title2}")


def test_lookalike_names_do_not_match() -> None:
    """同字開頭但不同公司／不相干的用語不可以被掛上個股。"""
    import fetch_news  # noqa: PLC0415
    for title, want_empty in [
        ("統一發票中獎號碼公布 千萬特獎在超商", True),
        ("統一超商全新門市開幕", True),
        ("長榮航空調整冬季航班", True),
        ("統一企業11月營收年增5%", False),
        ("長榮海運運價回升", False),
    ]:
        got = fetch_news.attach_tickers({"title": title, "summary": "", "tickers": []})["tickers"]
        if want_empty:
            check(not got, f"〈{title}〉不該關聯到任何個股，實得 {got}")
        else:
            check(bool(got), f"〈{title}〉應該要關聯到個股，實得空的")


def test_google_cluster_description() -> None:
    """Google 新聞的叢集 description 不可以被剝成一坨黏在一起的標題。"""
    import fetch_news  # noqa: PLC0415
    cluster = ('<ol><li><a href="#">台積電11月營收創高</a>'
               '<font color="#6f6f6f">經濟日報</font></li>'
               '<li><a href="#">台積電營收年增28%</a>'
               '<font color="#6f6f6f">工商時報</font></li>'
               '<li><a href="#">台積電續創同期新高</a>'
               '<font color="#6f6f6f">中央社</font></li></ol>')
    summary, outlets = fetch_news._clean_summary({"summary": cluster}, "台積電11月營收創高")
    check(summary == "", f"叢集不該產生摘要，實得：{summary[:60]}")
    check(outlets == ["經濟日報", "工商時報", "中央社"],
          f"應從叢集取出跟進的媒體名，實得 {outlets}")


def test_irrelevant_news_is_dropped() -> None:
    """市場面的綜合 RSS 會夾帶完全無關的新聞，必須擋在資料集之外。

    以下標題都是第一次正式上線時真的被抓進來、顯示在網站上的內容。
    """
    import fetch_news  # noqa: PLC0415

    noise = [
        "基輔遇襲釀37死！軍方彈藥庫藏住宅區遭擊中",
        "濟州島男子出門釣魚失聯！今在海邊尋獲遺體",
        "西藏尼泊爾邊境發現第二處堰塞湖 若潰決對下方堰塞湖衝擊很大",
        "中職》前5局遭勝騎士8K壓制王苡丞開轟救隊",
        "民眾騎機車硬闖奈良吊橋！警方卻無法開罰",
    ]
    for title in noise:
        rec = fetch_news.attach_tickers({"title": title, "summary": "", "tickers": []})
        check(not rec["tickers"] and not fetch_news.is_market_relevant(rec),
              f"〈{title}〉是雜訊，不該留在資料集裡")

    keep = [
        "台股周一恐跌500點　專家點名：5檔低位階個股逢低布局",
        "72萬股東嗨了！外資大買365億狂掃「這檔」奪冠",
        "法人：華許言論偏中性　輝達財報蘋果新機有利台股",
    ]
    for title in keep:
        rec = fetch_news.attach_tickers({"title": title, "summary": "", "tickers": []})
        check(fetch_news.is_market_relevant(rec),
              f"〈{title}〉是市場面新聞，不該被濾掉")


def test_query_hint_is_not_evidence() -> None:
    """用某檔股票的關鍵字查到，不等於那則新聞就是該股的新聞。

    Google 新聞對「富邦金控」會回中職賽事（富邦悍將對中信兄弟的比賽叫
    「金控大戰」），對「統一企業」會回統一投信的 ETF。第一次正式上線時，
    53% 的新聞掛著內文完全沒提到該公司的個股標記，就是因為程式把查詢意圖
    當成了證據。
    """
    import fetch_news  # noqa: PLC0415

    # 模擬「由 2881 富邦金控的查詢撈回來」的棒球新聞
    rec = fetch_news.attach_tickers({
        "title": "中職》「金控大戰」票房開紅盤！ 洲際寫本季第3多觀眾紀錄",
        "summary": "", "tickers": ["2881"],
    })
    check(not rec["tickers"],
          f"內文沒提到富邦金，不該掛上個股標記，實得 {rec['tickers']}")
    check(rec.get("query_ticker") == "2881", "查詢意圖應保留在 query_ticker 供除錯")
    check(not fetch_news.is_market_relevant(rec), "棒球新聞不該通過市場相關性")

    # 真的提到公司的，標記要留下來，而且要有依據
    rec2 = fetch_news.attach_tickers({
        "title": "富邦金11月自結每股盈餘0.85元", "summary": "", "tickers": ["2881"],
    })
    check(rec2["tickers"] == ["2881"], f"應標記 2881，實得 {rec2['tickers']}")
    check(rec2["matched_terms"], "標記必須附上命中的詞當依據")


def test_single_token_query_is_quoted() -> None:
    """單一詞查詢要加引號，否則「統一企業」會被拆開撈到統一投信的 ETF。"""
    import inspect  # noqa: PLC0415

    import fetch_news  # noqa: PLC0415
    src = inspect.getsource(fetch_news.fetch_google_news)
    check('f\'"{query}"\'' in src or '"{query}"' in src,
          "fetch_google_news 應對單一詞查詢加引號")
    check('" " not in query' in src,
          "有空白的複合查詢不能加引號（會變成要求兩詞相鄰）")


def test_non_news_pages_are_dropped() -> None:
    """報價頁不是新聞，混進 RSS 時要擋掉。"""
    import fetch_news  # noqa: PLC0415
    for title in ("富邦金(2881) 個股概覽 | 個股 - 股市",
                  "緯創(3231) 個股概覽 | 個股 - 股市"):
        check(fetch_news.is_non_news(title), f"〈{title}〉是報價頁，不是新聞")
    for title in ("鴻海11月營收年增12%", "台積電法說會上修財測"):
        check(not fetch_news.is_non_news(title), f"〈{title}〉是新聞，不該被當成報價頁")


def test_drivers_have_no_duplicate_terms() -> None:
    """同一個詞在標題和摘要都命中時，判斷依據不該印兩次。"""
    got = analyze.analyze_article(
        make("國泰金上半年大賺765億元 總座預告明年配息更優渥",
             summary="國泰金大賺，配息看好。"))
    terms = [d["term"] for d in got["drivers"]]
    check(len(terms) == len(set(terms)), f"drivers 出現重複詞：{terms}")


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
    test_negators_do_not_misfire()
    test_confidence()
    test_importance()
    test_dedupe()
    test_dedupe_respects_subject()
    test_split_outlet_keeps_dashes_in_title()
    test_lookalike_names_do_not_match()
    test_google_cluster_description()
    test_irrelevant_news_is_dropped()
    test_query_hint_is_not_evidence()
    test_single_token_query_is_quoted()
    test_non_news_pages_are_dropped()
    test_drivers_have_no_duplicate_terms()
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
