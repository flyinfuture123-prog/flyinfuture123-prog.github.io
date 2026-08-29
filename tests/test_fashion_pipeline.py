# -*- coding: utf-8 -*-
"""時尚站流程檢查：驗證產出的資料檔，並回歸測試最容易搞錯的語意。

不依賴 pytest。直接 `python tests/test_fashion_pipeline.py [latest.json]`
執行，有錯就非零退出。
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "scripts"))

import fashion_analyze as analyze  # noqa: E402
import textutil as tu  # noqa: E402

FAILURES: list = []


def check(condition: bool, message: str) -> None:
    if not condition:
        FAILURES.append(message)


def make(title: str, summary: str = "", outlet: str = "經濟日報", tier: int = 1,
         dup: int = 1, brands=None) -> dict:
    return {"id": "t", "title": title, "summary": summary, "outlet": outlet,
            "outlet_tier": tier, "dup_count": dup, "brands": brands or ["uniqlo"]}


# --------------------------------------------------------------------------
# 語意回歸：這些是規則式引擎最容易判反的句子
# --------------------------------------------------------------------------

def test_semantics() -> None:
    cases = [
        # (標題, 期望方向, 說明)
        ("UNIQLO宣布全面調漲 平均漲幅8%", "up", "調漲是明確的漲價訊號"),
        ("ZARA年終出清5折起 換季拍賣開跑", "down", "出清與拍賣是降價訊號"),
        ("SHEIN取消折扣、縮減促銷 實質漲價", "up", "「取消折扣」整體是漲價，不能被「折扣」帶走"),
        ("Nike to raise sneaker prices as tariffs bite", "up", "英文 raise prices + tariffs"),
        ("Retailer slashes prices in deep discounts push", "down", "英文降價詞"),
        ("品牌吸收關稅成本 承諾不漲價", "down", "吸收關稅＋不漲價是溫和的價格利好"),
        ("快時尚爆發價格戰 同業互砍求生", "down", "價格戰是向下訊號"),
        ("精品連年調漲 消費者大喊吃不消", "up", "連年調漲"),
        ("成衣廠工資上漲 品牌醞釀反映成本", "up", "成本端推力"),
        ("庫存過剩壓力大 品牌降價求售去化", "down", "庫存與降價"),
    ]
    for title, want, why in cases:
        got = analyze.analyze_article(make(title))
        check(got["price_key"] == want,
              f"語意判讀錯誤：〈{title}〉期望 {want}，實得 {got['price_key']}"
              f"（訊號 {got['price_score']:+d}）—— {why}")


def test_freeze_is_mild() -> None:
    """「凍漲」是溫和訊號，不可以被推進「明確降價」級距。"""
    got = analyze.analyze_article(make("H&M宣布基本款凍漲 自行吸收關稅成本"))
    check(got["price_score"] < 0, f"凍漲應為溫和負向，實得 {got['price_score']:+d}")
    check(got["price_score"] > -45,
          f"凍漲不是降價，分數 {got['price_score']:+d} 不該落入「明確降價」級距")


def test_negators() -> None:
    """否認／取消要能翻轉方向詞，片語覆寫也要吃反轉詞。"""
    got = analyze.analyze_article(make("品牌否認調漲 稱售價維持不變"))
    check(got["price_key"] != "up",
          f"「否認調漲」不該是漲價訊號，實得 {got['price_key']}（{got['price_score']:+d}）")

    war = analyze.analyze_article(make("快時尚龍頭宣示不打價格戰"))
    check(war["price_key"] != "down",
          f"「不打價格戰」不該是降價訊號，實得 {war['price_key']}（{war['price_score']:+d}）")


def test_de_minimis_is_price_up() -> None:
    """「取消小額免稅」是明確漲價事件，不可以被「取消」反轉詞打成反向。"""
    got = analyze.analyze_article(make("美國正式取消小額免稅 電商包裹全面課稅"))
    check(got["price_key"] == "up",
          f"取消小額免稅應為漲價訊號，實得 {got['price_key']}（{got['price_score']:+d}）")


def test_english_edge_cases() -> None:
    """英文的強化詞、彎引號否定與字界分類。"""
    plain = analyze.analyze_article(make("Brands push price hikes this fall"))
    strong = analyze.analyze_article(make("Brands push massive price hikes this fall"))
    check(abs(strong["price_score"]) > abs(plain["price_score"]),
          f"英文強化詞未生效：massive {strong['price_score']:+d} 應大於"
          f" plain {plain['price_score']:+d}")

    curly = analyze.analyze_article(make("Hermes says it won’t raise prices this year"))
    check(curly["price_key"] != "up",
          f"彎引號的 won't raise prices 不該是漲價訊號，實得 {curly['price_score']:+d}")

    sales = analyze.analyze_article(make(
        "Wholesale sales jump as retailer beats quarterly forecast"))
    check(sales["category"] != "pricing",
          f"sales/wholesale 不該被 sale 關鍵字分到價格動態，實得 {sales['category']}")


def test_hedge_words_do_not_misfire() -> None:
    """單字「傳」「恐」不可在宣傳/傳統/恐怖裡誤中；句首的「傳」仍要抓到。"""
    for title in ("品牌大打宣傳戰 邀請代言人站台", "傳統工藝結合時裝 登上米蘭伸展台"):
        got = analyze.analyze_article(make(title, brands=[]))
        check("推測性報導" not in got["flags"],
              f"〈{title}〉不該被標成推測性報導，實得 {got['flags']}")

    rumor = analyze.analyze_article(make("傳愛馬仕明年再調漲柏金包"))
    check("推測性報導" in rumor["flags"], "句首「傳○○」應被標為推測性報導")


def test_region_not_misfired() -> None:
    """裸 uk 不可在 lukewarm/rebuke 裡誤中歐洲。"""
    got = analyze.analyze_article(make(
        "Lukewarm demand weighs on apparel makers", brands=[]))
    check(got["region"] != "eu", f"lukewarm 不該判成歐洲，實得 {got['region']}")
    real = analyze.analyze_article(make(
        "Apparel prices rise across Britain as costs climb", brands=[]))
    check(real["region"] == "eu", f"Britain 應判成歐洲，實得 {real['region']}")


def test_confidence() -> None:
    """推測性報導的信心必須明顯低於確定性報導。"""
    rumor = analyze.analyze_article(make("傳香奈兒經典包再度調漲 幅度恐達一成"))
    firm = analyze.analyze_article(make("香奈兒公告經典包調漲 幅度達一成"))
    check(rumor["confidence"] < firm["confidence"],
          f"含「傳／恐」的報導信心 {rumor['confidence']} 應低於確定性報導 {firm['confidence']}")
    check("推測性報導" in rumor["flags"], "推測性報導應被標記")

    en_rumor = analyze.analyze_article(make(
        "Hermes reportedly mulls price increase for Birkin bags"))
    check("推測性報導" in en_rumor["flags"], "英文推測詞（reportedly/mulls）應被標記")


def test_importance() -> None:
    """主流媒體＋多家跟進＋具體數字，重要性要高於單一來源的軟性報導。"""
    big = analyze.analyze_article(
        make("UNIQLO全面調漲 平均漲幅8%", outlet="經濟日報", tier=1, dup=5))
    small = analyze.analyze_article(
        make("網友分享十套秋冬穿搭靈感", outlet="某某網", tier=3, dup=1, brands=[]))
    check(big["importance"] > small["importance"],
          f"全面調漲的重要性 {big['importance']} 應高於軟性穿搭文 {small['importance']}")


def test_trend_tags() -> None:
    cases = [
        ("老錢風退燒了嗎？靜奢穿搭的下一步", "quiet_luxury"),
        ("Leopard print is everywhere again this fall", "animal_print"),
        ("古著熱潮帶動二手衣價格上漲", "vintage_secondhand"),
        ("波希米亞風回歸 流蘇與大地色當道", "boho"),
    ]
    for title, want in cases:
        got = analyze.analyze_article(make(title, brands=[]))
        check(want in got["trend_tags"],
              f"〈{title}〉應命中趨勢 {want}，實得 {got['trend_tags']}")


def test_region_and_category() -> None:
    got = analyze.analyze_article(make("越南成衣廠面臨關稅不確定性 品牌轉單評估中", brands=[]))
    check(got["region"] == "sea", f"越南新聞地區應為 sea，實得 {got['region']}")

    runway = analyze.analyze_article(make("巴黎時裝週開跑 十個必看品牌大秀", brands=[]))
    check(runway["category"] == "runway",
          f"時裝週新聞分類應為 runway，實得 {runway['category']}")
    check(runway["region"] == "eu", f"巴黎的地區應為 eu，實得 {runway['region']}")

    celeb = analyze.analyze_article(make("金球獎紅毯直擊 女星穿上高級訂製服亮相", brands=[]))
    check(celeb["category"] in ("celebrity", "runway"),
          f"紅毯新聞分類應為名人或大秀，實得 {celeb['category']}")


# --------------------------------------------------------------------------
# 品牌關聯
# --------------------------------------------------------------------------

def test_attach_brands() -> None:
    import fashion_fetch  # noqa: PLC0415
    for title, want_in, want_not_in in [
        ("愛迪達宣布調漲台灣區球鞋售價", ["adidas"], []),
        ("GAP母公司財報遜於預期", ["gap"], []),
        ("Mind the gap: subway safety campaign expands", [], ["gap"]),
        ("美國對成衣加徵關稅 NIKE、GAP、Levi's 評估轉嫁",
         ["nike", "gap", "levis"], []),
        ("Shein and Temu slash prices in fast fashion price war",
         ["shein", "temu"], []),
        ("運動彩券投注站增設", [], ["nike", "adidas"]),
        ("儒鴻、聚陽接單能見度下滑", ["tw-textile"], []),
        # 這些是審查抓過的誤中案例，別名調整後不可回歸。
        ("Nike doubles down on running shoes as prices rise", ["nike"], ["on-running"]),
        ("How to save money on running gear this fall", [], ["on-running"]),
        ("颱風來襲 台北面臨強降雨考驗", [], ["vf"]),
        ("青年返鄉創業 離開雲林又回來的故事", [], ["kering"]),
        ("The North Face 秋冬新品開賣", ["vf"], []),
        ("開雲集團財報不如預期 Gucci持續疲軟", ["kering"], []),
    ]:
        got = fashion_fetch.attach_brands(
            {"title": title, "summary": "", "brands": []})["brands"]
        for slug in want_in:
            check(slug in got, f"〈{title}〉應關聯到 {slug}，實得 {got}")
        for slug in want_not_in:
            check(slug not in got, f"〈{title}〉不該關聯到 {slug}，實得 {got}")


def test_dedupe_merges_same_story() -> None:
    """同一則稿被多家轉載時要合併，並記下有幾家報導。"""
    recs = [
        {"title": "UNIQLO秋冬新品全面調漲 平均漲幅約8% 反映棉價與運費",
         "outlet": "經濟日報", "tickers": ["uniqlo"], "summary": ""},
        {"title": "UNIQLO秋冬新品全面調漲 平均漲幅8%",
         "outlet": "工商時報", "tickers": ["uniqlo"], "summary": ""},
        {"title": "UNIQLO秋冬新品調漲 平均漲幅約8% 反映棉價運費",
         "outlet": "中央社", "tickers": ["uniqlo"], "summary": ""},
        {"title": "ZARA年終出清5折起 換季拍賣開跑",
         "outlet": "ETtoday", "tickers": ["zara"], "summary": ""},
    ]
    kept = tu.dedupe(recs)
    check(len(kept) == 2, f"三則同稿應合併成一則，實得 {len(kept)} 則")
    uq = [k for k in kept if "UNIQLO" in k["title"]]
    check(bool(uq) and uq[0]["dup_count"] == 3,
          f"合併後 dup_count 應為 3，實得 {uq[0]['dup_count'] if uq else 'n/a'}")


def test_dedupe_respects_brand() -> None:
    """同模板不同品牌的標題不可以被併掉。"""
    recs = [
        {"title": "NIKE宣布調漲台灣區球鞋售價 反映關稅成本",
         "outlet": "ETtoday", "tickers": ["nike"], "summary": ""},
        {"title": "愛迪達宣布調漲台灣區球鞋售價 反映關稅成本",
         "outlet": "三立新聞網", "tickers": ["adidas"], "summary": ""},
    ]
    kept = tu.dedupe(recs)
    check(len(kept) == 2, f"兩個品牌的同模板標題應保留 2 則，實得 {len(kept)} 則")


# --------------------------------------------------------------------------
# 資料檔結構
# --------------------------------------------------------------------------

def test_payload(path: str) -> None:
    from fashion_brands import BRANDS  # noqa: PLC0415

    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)

    check(d.get("schema_version") == 1, "schema_version 應為 1")
    check(d.get("site") == "fashion", "site 欄位應為 fashion")
    for key in ("generated_at", "date", "brief", "brands", "trends", "articles",
                "segments", "categories", "regions", "stats"):
        check(key in d, f"資料檔缺少欄位 {key}")

    check(len(d["brands"]) == len(BRANDS),
          f"品牌數量應為 {len(BRANDS)}，實得 {len(d['brands'])}")
    check(d["stats"]["article_count"] == len(d["articles"]), "article_count 與實際則數不符")
    check(d["stats"]["article_count"] >= 8, "新聞則數過少，視為抓取失敗")

    seen_ids = set()
    for a in d["articles"]:
        check(bool(a.get("id")), "新聞缺少 id")
        check(a["id"] not in seen_ids, f"新聞 id 重複：{a['id']}")
        seen_ids.add(a["id"])
        check(bool(a.get("url")), f"新聞 {a['id']} 缺少連結")
        an = a.get("analysis") or {}
        check(bool(an.get("commentary")), f"新聞 {a['id']} 缺少逐則分析")
        check(-100 <= an.get("price_score", 999) <= 100, f"新聞 {a['id']} 價格訊號超出範圍")
        check(0.0 <= an.get("confidence", -1) <= 1.0, f"新聞 {a['id']} 信心超出範圍")
        check(1 <= an.get("importance", 0) <= 5, f"新聞 {a['id']} 重要性超出範圍")
        check(isinstance(an.get("trend_tags"), list), f"新聞 {a['id']} trend_tags 應為列表")

    for b in d["brands"]:
        check(bool(b.get("summary_text")), f"{b.get('slug')} 缺少品牌評述")
        check(-100 <= b.get("price_score", 999) <= 100, f"{b.get('slug')} 價格訊號超出範圍")
        for aid in b.get("article_ids", []):
            check(aid in seen_ids, f"{b['slug']} 引用了不存在的新聞 {aid}")

    for t in d["trends"]:
        for aid in t.get("article_ids", []):
            check(aid in seen_ids, f"趨勢 {t['id']} 引用了不存在的新聞 {aid}")

    for aid in d["brief"].get("top_article_ids", []):
        check(aid in seen_ids, f"快報引用了不存在的新聞 {aid}")

    # 語言統計要能對上
    zh = sum(1 for a in d["articles"] if a.get("lang") == "zh")
    check(d["stats"]["zh_count"] == zh, "zh_count 與實際不符")


def main() -> int:
    test_semantics()
    test_freeze_is_mild()
    test_negators()
    test_de_minimis_is_price_up()
    test_english_edge_cases()
    test_hedge_words_do_not_misfire()
    test_region_not_misfired()
    test_confidence()
    test_importance()
    test_trend_tags()
    test_region_and_category()
    test_attach_brands()
    test_dedupe_merges_same_story()
    test_dedupe_respects_brand()

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
