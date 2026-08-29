# -*- coding: utf-8 -*-
"""產生時尚站離線測試用的新聞 fixture。

沙箱環境連不到任何新聞網站，但整條 pipeline（品牌關聯 → 去重 → 分析 →
彙總 → 產頁）還是要能被驗證。這裡用擬真的中英文時尚標題造一份資料，
時間戳相對於執行當下產生，永遠落在抓取視窗內。

標題涵蓋幾種必須被正確處理的狀況：
  - 同一則稿被多家媒體轉載（測去重與 dup_count）
  - 「凍漲」「取消折扣」這類會被 naive 比對搞錯的片語
  - 帶「傳」「恐」「reportedly」的推測性報導（測信心下修）
  - 一則關稅新聞同時牽動多個品牌（測關聯品牌）
  - 「mind the gap」不可誤中 GAP（測全大寫別名的大小寫敏感比對）
  - 中英文各半（測雙語詞庫與 lang 統計）
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone

TPE = timezone(timedelta(hours=8))

# (標題, 摘要, 媒體, 層級, 語言, 幾小時前)
RAW = [
    # --- UNIQLO 調漲：三家轉載，測去重 ---
    ("UNIQLO秋冬新品全面調漲 平均漲幅約8% 反映棉價與運費",
     "迅銷表示原物料與物流成本壓力難以完全吸收。", "經濟日報", 1, "zh", 3),
    ("UNIQLO秋冬新品全面調漲 平均漲幅8%",
     "", "工商時報", 1, "zh", 3),
    ("UNIQLO秋冬新品調漲 平均漲幅約8% 反映棉價運費",
     "", "中央社", 1, "zh", 4),

    # --- 同模板不同品牌：不可被併掉 ---
    ("NIKE宣布調漲台灣區球鞋售價 反映關稅成本",
     "", "ETtoday", 2, "zh", 5),
    ("愛迪達宣布調漲台灣區球鞋售價 反映關稅成本",
     "", "三立新聞網", 2, "zh", 5),

    # --- 片語覆寫 ---
    ("H&M宣布基本款凍漲 自行吸收新一輪關稅成本",
     "執行長表示不將成本轉嫁給消費者。", "工商時報", 1, "zh", 6),
    ("傳SHEIN縮減折扣、取消免運 實質漲價因應美國關稅",
     "市場消息指出平台正在調整促銷策略。", "數位時代", 2, "zh", 8),
    ("Lululemon cuts discounts as it repositions premium pricing",
     "The yoga wear maker says fewer discounts will protect margins.",
     "Reuters", 1, "en", 9),

    # --- 推測性報導（測信心下修）---
    ("傳香奈兒經典包年底前再度調漲 幅度恐達一成",
     "消息尚未獲品牌證實。", "鏡週刊", 2, "zh", 10),
    ("Hermes reportedly mulls price increase for Birkin bags next year",
     "Sources say the increase could reach 8%.", "某fashion blog", 3, "en", 11),

    # --- 明確漲價（英文）---
    ("Nike to raise sneaker prices in US as tariffs bite",
     "The company will pass on costs to consumers from next quarter.",
     "Reuters", 1, "en", 7),
    ("Luxury price hikes continue: LVMH and Chanel lift handbag prices again",
     "Analysts point to double-digit increases since 2020.", "Vogue Business", 1, "en", 12),

    # --- 降價與促銷 ---
    ("ZARA年終出清5折起 換季拍賣全台開跑",
     "門市與官網同步。", "ETtoday", 2, "zh", 6),
    ("GAP母公司財報遜於預期 加碼折扣去化庫存",
     "Old Navy 銷售疲弱，庫存壓力升高。", "經濟日報", 1, "zh", 14),
    ("Fast fashion price war heats up as Shein and Temu slash prices",
     "Deep discounts spread across categories.", "CNBC", 1, "en", 15),

    # --- 關稅與供應鏈：一則多品牌 ---
    ("美國對東南亞成衣加徵關稅 NIKE、GAP、Levi's 評估漲價轉嫁",
     "越南與孟加拉產能占比高的品牌首當其衝。", "路透", 1, "zh", 16),
    ("Vietnam apparel factories face tariff uncertainty as brands reroute orders",
     "Sourcing executives weigh Bangladesh and India alternatives.",
     "Sourcing Journal", 1, "en", 18),
    ("儒鴻、聚陽接單能見度下滑 品牌客戶下單轉趨保守",
     "台灣紡織雙雄第四季展望保守。", "工商時報", 1, "zh", 20),

    # --- 趨勢報導 ---
    ("2026秋冬十大趨勢盤點：波希米亞回歸、麂皮外套當道",
     "流蘇、絨面與大地色系全面回歸。", "Vogue", 2, "zh", 9),
    ("老錢風退燒了嗎？靜奢穿搭的下一步",
     "低調奢華依然是高價基本款的主要敘事。", "ELLE", 2, "zh", 22),
    ("Leopard print is everywhere again: how animal print took over fall",
     "From runways to fast fashion, the trend cycle accelerates.",
     "Harper's BAZAAR", 2, "en", 23),
    ("古著熱潮帶動二手衣價格上漲 vintage店家：好貨越來越難收",
     "二手市場供需失衡，中古包行情同步走高。", "聯合新聞網", 2, "zh", 13),
    ("Ballet flats and balletcore fade as loafers return",
     "Trend forecasters call the shift to preppy staples.", "Glossy", 2, "en", 26),

    # --- 時裝週 ---
    ("巴黎時裝週開跑 十個必看品牌大秀一次看",
     "本季焦點落在新任創意總監的首秀。", "美麗佳人", 2, "zh", 17),
    ("Paris Fashion Week: quiet luxury gives way to bold color",
     "Designers push saturated palettes for spring.", "WWD", 1, "en", 19),

    # --- 名人穿著 ---
    ("金球獎紅毯直擊：女星穿上香奈兒高級訂製服亮相",
     "紅毯造型清一色向老錢風靠攏。", "ELLE", 2, "zh", 21),

    # --- 人事與併購 ---
    ("Gucci新任創意總監首秀獲好評 開雲集團股價反彈",
     "市場期待品牌重整見效。", "經濟日報", 1, "zh", 24),
    ("Prada completes Versace acquisition in luxury consolidation wave",
     "The deal reshapes Italy's luxury landscape.", "Reuters", 1, "en", 25),

    # --- 財報 ---
    ("Fast Retailing上修全年財測 海外UNIQLO成長強勁",
     "日圓走弱推升海外獲利貢獻。", "日經", 1, "zh", 27),
    ("Inditex quarterly sales beat forecasts as Zara defies slowdown",
     "", "Reuters", 1, "en", 28),

    # --- 永續與二手 ---
    ("快時尚污染再受關注 歐盟研擬紡織廢棄物新規",
     "法規若通過將推升合規成本。", "中央社", 1, "zh", 29),
    ("ThredUp report: resale market grows five times faster than retail",
     "Secondhand adoption accelerates among younger shoppers.",
     "FashionUnited", 1, "en", 30),

    # --- 陷阱與雜訊 ---
    ("Mind the gap: subway safety campaign expands citywide",
     "Nothing to do with apparel.", "某地方報", 3, "en", 31),
    ("運動彩券投注站增設 主管機關公告新規",
     "與運動服飾無關的例行新聞。", "某地方網", 3, "zh", 32),
    ("勞力士傳2026年再調漲 熱門款二手行情同步走高",
     "", "鏡週刊", 2, "zh", 33),
    ("無印良品母公司良品計畫調降日本區服飾售價 帶動買氣",
     "", "日經", 1, "zh", 34),
]


def build(now: datetime) -> list:
    out = []
    for title, summary, outlet, tier, lang, hours_ago in RAW:
        published = now - timedelta(hours=hours_ago)
        out.append({
            "title": title,
            "summary": summary,
            "outlet": outlet,
            "outlet_tier": tier,
            "url": "https://example.invalid/fixture",
            "published": published.isoformat(),
            "published_ts": published.timestamp(),
            "source_id": "fixture",
            "lang": lang,
            "brands": [],
        })
    return out


def main() -> int:
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "fixtures", "fashion_sample.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    data = build(datetime.now(TPE))
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"寫入 {dest}（{len(data)} 則）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
