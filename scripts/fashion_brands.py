# -*- coding: utf-8 -*-
"""全球服飾品牌觀察名單。

選錄原則：對「全球服飾價格」與「時尚趨勢」有指標意義的公司／品牌，
分成快時尚、運動休閒、精品、電商平台與其他五個板塊。prominence 1-5 是
人工給的「對全球服飾價格的影響力」，只用在排序與彙總加權，不是市值排名。
中文名以台灣媒體實際用法為準（鉅亨網「耐吉」「露露檸檬」、經濟日報
「迅銷」「印地紡」、一般媒體「愛迪達」「香奈兒」）。

aliases 是給新聞比對用的，收錄原則與 stocks.py 相同：只放唯一指向這個
品牌的字串。英文別名的比對規則（見 fashion_fetch._alias_matches）：
  - 全大寫且長度 <= 5 的別名（GAP、SHEIN、UGG…）採「大小寫敏感 + 字界」
    比對，避免 "mind the gap" 之類的一般英文字誤中；
  - 其他 ASCII 別名採「不分大小寫 + 字界」比對；
  - 中文別名採單純子字串比對。
刻意不放會撞到一般英文用語的名字：Coach（教練）、Vans（貨車）、
Supreme（Supreme Court）、Converse（動詞）一律用全名或中文名替代。

query_zh / query_en 是丟進 Google 新聞搜尋的字串，沒有就不搜（仍可透過
主題查詢與別名比對被關聯到）。運動品牌的中文搜尋要加（財報 OR 業績…）
錨點，否則會撈到大量球鞋開箱與名人穿著。
"""

from __future__ import annotations

SEGMENTS = [
    {"id": "fast", "label": "快時尚"},
    {"id": "sport", "label": "運動休閒"},
    {"id": "luxury", "label": "精品"},
    {"id": "ecom", "label": "電商平台"},
    {"id": "other", "label": "其他"},
]

BRANDS = [
    # ---- 快時尚 ------------------------------------------------------------
    {
        "slug": "uniqlo",
        "name": "UNIQLO",
        "en_name": "Uniqlo / Fast Retailing",
        "segment": "fast",
        "hq": "日本",
        "prominence": 5,
        "aliases": ["UNIQLO", "Uniqlo", "優衣庫", "迅銷", "Fast Retailing", "柳井正", "GU"],
        "query_zh": "UNIQLO OR 優衣庫 OR 迅銷",
        "query_en": "Uniqlo",
        "driver": "平價機能服飾定價、日圓匯率、台灣展店與 GU 副牌、美國關稅轉嫁",
    },
    {
        "slug": "zara",
        "name": "ZARA",
        "en_name": "Zara / Inditex",
        "segment": "fast",
        "hq": "西班牙",
        "prominence": 5,
        "aliases": ["ZARA", "Zara", "Inditex", "印地紡", "Bershka", "Massimo Dutti",
                     "Pull&Bear"],
        "query_zh": "ZARA",
        "query_en": "Zara Inditex",
        "driver": "全球最大快時尚集團的定價與上新速度，平價服飾業的風向標",
    },
    {
        "slug": "hm",
        "name": "H&M",
        "en_name": "H&M Group",
        "segment": "fast",
        "hq": "瑞典",
        "prominence": 4,
        "aliases": ["H&M", "H＆M", "Hennes & Mauritz"],
        "query_zh": "\"H&M\"",
        "query_en": "\"H&M\" fashion",
        "driver": "平價定位與 SHEIN 之間的價格競爭、庫存與折扣深度",
    },
    {
        "slug": "gap",
        "name": "GAP",
        "en_name": "Gap Inc.",
        "segment": "fast",
        "hq": "美國",
        "prominence": 3,
        "aliases": ["GAP", "Gap Inc", "蓋璞", "Old Navy", "Banana Republic", "Athleta"],
        "query_zh": "GAP 服飾",
        "query_en": "Gap Inc",
        "driver": "美國中價位成衣、關稅轉嫁、Old Navy 平價線與同店成長",
    },
    {
        "slug": "primark",
        "name": "Primark",
        "en_name": "Primark",
        "segment": "fast",
        "hq": "愛爾蘭",
        "prominence": 3,
        "aliases": ["Primark", "普里馬克", "普利馬克"],
        "query_en": "Primark",
        "driver": "歐洲最低價帶的定價紀律、不做電商也能低價的成本結構",
    },
    {
        "slug": "muji",
        "name": "無印良品",
        "en_name": "MUJI",
        "segment": "fast",
        "hq": "日本",
        "prominence": 2,
        "aliases": ["無印良品", "MUJI", "良品計畫"],
        "query_zh": "無印良品",
        "driver": "基本款服飾定價、日圓匯率、亞洲門市調價",
    },

    # ---- 電商平台 ----------------------------------------------------------
    {
        "slug": "shein",
        "name": "SHEIN",
        "en_name": "Shein",
        "segment": "ecom",
        "hq": "新加坡（發跡於中國）",
        "prominence": 5,
        "aliases": ["SHEIN", "Shein", "希音"],
        "query_zh": "SHEIN",
        "query_en": "Shein",
        "driver": "超快時尚極限低價、各國小額包裹免稅存廢、港股上市與估值",
    },
    {
        "slug": "temu",
        "name": "Temu",
        "en_name": "Temu / PDD",
        "segment": "ecom",
        "hq": "中國",
        "prominence": 4,
        "aliases": ["Temu", "TEMU", "拼多多", "PDD Holdings"],
        "query_en": "Temu",
        "driver": "跨境低價百貨含服飾、de minimis 關稅政策衝擊、補貼戰",
    },

    # ---- 運動休閒 ----------------------------------------------------------
    {
        "slug": "nike",
        "name": "NIKE",
        "en_name": "Nike",
        "segment": "sport",
        "hq": "美國",
        "prominence": 5,
        "aliases": ["NIKE", "Nike", "耐吉", "耐克", "Air Jordan", "Jordan Brand"],
        "query_zh": "Nike 漲價 OR 財報 OR 業績",
        "query_en": "Nike",
        "driver": "運動鞋服定價權、關稅與越南產能、直營與批發通路策略",
    },
    {
        "slug": "adidas",
        "name": "adidas",
        "en_name": "Adidas",
        "segment": "sport",
        "hq": "德國",
        "prominence": 4,
        "aliases": ["adidas", "Adidas", "愛迪達", "阿迪達斯", "三葉草"],
        "query_zh": "愛迪達 OR adidas 業績",
        "query_en": "Adidas",
        "driver": "復古鞋款熱潮的量價策略、庫存週期、關稅成本",
    },
    {
        "slug": "lululemon",
        "name": "lululemon",
        "en_name": "Lululemon",
        "segment": "sport",
        "hq": "加拿大",
        "prominence": 4,
        "aliases": ["lululemon", "Lululemon", "露露檸檬", "露露樂蒙"],
        "query_zh": "lululemon",
        "query_en": "Lululemon",
        "driver": "高價瑜伽服的定價天花板、平價模仿品（dupe）文化、台灣機能布供應鏈",
    },
    {
        "slug": "puma",
        "name": "PUMA",
        "en_name": "Puma",
        "segment": "sport",
        "hq": "德國",
        "prominence": 2,
        "aliases": ["PUMA", "Puma", "彪馬"],
        "query_en": "Puma sportswear",
        "driver": "運動品牌價格戰風向球、銷售重挫後的重整與併購傳聞",
    },
    {
        "slug": "underarmour",
        "name": "Under Armour",
        "en_name": "Under Armour",
        "segment": "sport",
        "hq": "美國",
        "prominence": 2,
        "aliases": ["Under Armour", "安德瑪"],
        "query_en": "Under Armour",
        "driver": "美系機能服、越南／印尼關稅成本、重整策略",
    },
    {
        "slug": "asics",
        "name": "ASICS",
        "en_name": "Asics / Onitsuka Tiger",
        "segment": "sport",
        "hq": "日本",
        "prominence": 3,
        "aliases": ["ASICS", "Asics", "亞瑟士", "Onitsuka Tiger", "鬼塚虎"],
        "query_en": "Asics",
        "driver": "跑鞋復古熱、日圓匯率下的定價調整、增速最快的運動品牌",
    },
    {
        "slug": "on-running",
        "name": "On 昂跑",
        "en_name": "On Holding",
        "segment": "sport",
        "hq": "瑞士",
        "prominence": 3,
        # 「On Running」不能當別名：小寫比對會誤中日常英文 "on running shoes"。
        # 品牌搜尋撈回來的新聞在抓取端就已掛上 slug，別名只負責交叉提及。
        "aliases": ["On Holding", "昂跑"],
        "query_en": "On Running Holding",
        "driver": "高價跑鞋新勢力的漲價能力、對 NIKE 的市占侵蝕、台廠鈺齊連動",
    },
    {
        "slug": "deckers-hoka",
        "name": "HOKA/UGG",
        "en_name": "Deckers Outdoor",
        "segment": "sport",
        "hq": "美國",
        "prominence": 3,
        "aliases": ["Deckers", "德克斯", "HOKA", "Hoka", "UGG"],
        "query_en": "Hoka UGG Deckers",
        "driver": "厚底跑鞋與雪靴兩大趨勢品牌的財報與調價",
    },
    {
        "slug": "anta",
        "name": "安踏",
        "en_name": "Anta Sports",
        "segment": "sport",
        "hq": "中國",
        "prominence": 3,
        "aliases": ["安踏", "Anta", "FILA", "斐樂"],
        "query_zh": "安踏 OR FILA",
        "driver": "中國最大運動集團，觀察中國消費力、國潮與歐美品牌大中華表現",
    },

    # ---- 精品 --------------------------------------------------------------
    {
        "slug": "lvmh",
        "name": "LVMH",
        "en_name": "LVMH",
        "segment": "luxury",
        "hq": "法國",
        "prominence": 5,
        "aliases": ["LVMH", "路威酩軒", "Louis Vuitton", "路易威登", "Dior", "迪奧",
                     "Tiffany", "蒂芙尼", "Loewe", "Celine", "阿爾諾"],
        "query_zh": "LVMH OR 路易威登",
        "query_en": "LVMH",
        "driver": "全球最大精品集團，LV/Dior 年度調價與財報是精品景氣溫度計",
    },
    {
        "slug": "hermes",
        "name": "愛馬仕",
        "en_name": "Hermès",
        "segment": "luxury",
        "hq": "法國",
        "prominence": 4,
        "aliases": ["愛馬仕", "Hermès", "Hermes", "柏金包", "Birkin", "Kelly包"],
        "query_zh": "愛馬仕",
        "query_en": "Hermes price",
        "driver": "每年 1 月例行全球調價、柏金包配貨制、二手行情指標",
    },
    {
        "slug": "chanel",
        "name": "香奈兒",
        "en_name": "Chanel",
        "segment": "luxury",
        "hq": "法國",
        "prominence": 4,
        "aliases": ["香奈兒", "Chanel", "CHANEL"],
        "query_zh": "香奈兒",
        "query_en": "Chanel price",
        "driver": "經典包款連年多次調漲，「香奈兒又漲價」是台媒固定題材",
    },
    {
        "slug": "kering",
        "name": "Kering/Gucci",
        "en_name": "Kering / Gucci",
        "segment": "luxury",
        "hq": "法國",
        "prominence": 4,
        # 「開雲」兩字會誤中「離開雲林」這類跨詞邊界，一律用全名「開雲集團」。
        "aliases": ["Kering", "開雲集團", "Gucci", "古馳", "Saint Laurent", "聖羅蘭",
                     "Balenciaga", "巴黎世家", "Bottega Veneta", "寶緹嘉"],
        "query_zh": "Gucci OR 開雲集團",
        "query_en": "Kering Gucci",
        "driver": "Gucci 銷售重挫後的品牌重整與換帥、精品逆風期的折扣紀律",
    },
    {
        "slug": "prada",
        "name": "Prada/Miu Miu",
        "en_name": "Prada Group",
        "segment": "luxury",
        "hq": "義大利",
        "prominence": 3,
        "aliases": ["Prada", "普拉達", "Miu Miu", "繆繆", "Versace", "凡賽斯"],
        "query_en": "Prada Miu Miu",
        "driver": "Miu Miu 逆勢高速成長、併購 Versace 後的整合",
    },
    {
        "slug": "burberry",
        "name": "Burberry",
        "en_name": "Burberry",
        "segment": "luxury",
        "hq": "英國",
        "prominence": 2,
        "aliases": ["Burberry", "博柏利", "巴寶莉"],
        "query_en": "Burberry",
        "driver": "先漲價後轉打折的重整實驗，精品定價策略的對照組",
    },
    {
        "slug": "moncler",
        "name": "Moncler",
        "en_name": "Moncler",
        "segment": "luxury",
        "hq": "義大利",
        "prominence": 3,
        "aliases": ["Moncler", "盟可睞", "Stone Island", "石頭島"],
        "query_en": "Moncler",
        "driver": "高價羽絨與冬季趨勢指標，台灣消費者滲透率高",
    },
    {
        "slug": "richemont",
        "name": "歷峰/卡地亞",
        "en_name": "Richemont / Cartier",
        "segment": "luxury",
        "hq": "瑞士",
        "prominence": 3,
        "aliases": ["Richemont", "歷峰", "Cartier", "卡地亞", "梵克雅寶", "Van Cleef"],
        "query_en": "Richemont Cartier",
        "driver": "硬奢（珠寶錶）相對軟奢的抗跌表現、金價連動調價",
    },
    {
        "slug": "tapestry",
        "name": "Tapestry/蔻馳",
        "en_name": "Tapestry (Coach)",
        "segment": "luxury",
        "hq": "美國",
        "prominence": 3,
        "aliases": ["Tapestry", "泰佩思琦", "蔻馳", "Kate Spade"],
        "query_en": "Tapestry Coach earnings",
        "driver": "輕奢代表：低價位包款在 Z 世代翻紅，「精品降級消費」最佳案例",
    },
    {
        "slug": "rolex",
        "name": "勞力士",
        "en_name": "Rolex",
        "segment": "luxury",
        "hq": "瑞士",
        "prominence": 2,
        "aliases": ["勞力士", "Rolex"],
        "query_zh": "勞力士 價格 OR 調漲",
        "driver": "一年多次調價與二手行情，高價消費信心的側面指標",
    },

    # ---- 其他 --------------------------------------------------------------
    {
        "slug": "levis",
        "name": "Levi's",
        "en_name": "Levi Strauss",
        "segment": "other",
        "hq": "美國",
        "prominence": 3,
        "aliases": ["Levi's", "Levis", "李維斯", "利惠", "Levi Strauss"],
        "query_en": "Levi's jeans",
        "driver": "丹寧趨勢風向球（寬褲取代緊身褲）、關稅下的產地移轉",
    },
    {
        "slug": "vf",
        "name": "The North Face/VF",
        "en_name": "VF Corporation",
        "segment": "other",
        "hq": "美國",
        "prominence": 3,
        # 「北面」會誤中「台北面臨…」；寫北面的報導幾乎都同時帶英文名。
        "aliases": ["VF Corp", "VF Corporation", "威富", "The North Face",
                     "北臉", "Timberland", "添柏嵐"],
        "query_en": "VF Corp North Face",
        "driver": "戶外＋街頭品牌組合的重整、台灣定價高於日韓的爭議",
    },
    {
        "slug": "amer",
        "name": "始祖鳥/Salomon",
        "en_name": "Amer Sports",
        "segment": "other",
        "hq": "芬蘭",
        "prominence": 3,
        "aliases": ["Amer Sports", "亞瑪芬", "Arc'teryx", "Arcteryx", "始祖鳥",
                     "Salomon", "薩洛蒙"],
        "query_en": "Amer Sports Arc'teryx Salomon",
        "driver": "機能戶外奢華風（Gorpcore）代表，漲價能力與中國市場成長",
    },
    {
        "slug": "tw-textile",
        "name": "台灣紡織供應鏈",
        "en_name": "Taiwan textile makers",
        "segment": "other",
        "hq": "台灣",
        "prominence": 3,
        "aliases": ["儒鴻", "聚陽", "遠東新", "紡織股", "成衣股"],
        "query_zh": "紡織股 OR 成衣股",
        "driver": "全球品牌的上游代工報價與接單（儒鴻、聚陽），成本端的領先指標",
    },
    {
        "slug": "resale",
        "name": "二手轉售平台",
        "en_name": "Resale platforms",
        "segment": "other",
        "hq": "全球",
        "prominence": 2,
        "aliases": ["Vinted", "ThredUp", "The RealReal", "Vestiaire", "StockX"],
        "query_en": "Vinted ThredUp resale fashion",
        "driver": "二手服飾價格與滲透率，新品定價的替代壓力",
    },
]

BY_SLUG = {b["slug"]: b for b in BRANDS}
SEGMENT_BY_ID = {s["id"]: s for s in SEGMENTS}


def segment_label(seg_id: str) -> str:
    seg = SEGMENT_BY_ID.get(seg_id)
    return seg["label"] if seg else "其他"


if __name__ == "__main__":
    import json
    import sys

    slugs = [b["slug"] for b in BRANDS]
    assert len(slugs) == len(set(slugs)), "slug 重複"
    for b in BRANDS:
        assert b["segment"] in SEGMENT_BY_ID, f"{b['slug']} 的 segment 不在 SEGMENTS 裡"
        assert 1 <= b["prominence"] <= 5, b["slug"]
        assert b["aliases"], b["slug"]
        for a in b["aliases"]:
            assert len(a) >= 2, f"{b['slug']} 的別名 {a!r} 太短，容易誤判"
            # 這些字同時是常見英文單字，見模組說明，一律禁止入列。
            assert a.lower() not in ("coach", "vans", "supreme", "converse",
                                     "guess", "boss"), \
                f"{b['slug']} 的別名 {a!r} 會撞到一般英文用語"
    print(f"{len(BRANDS)} 個品牌／板塊 {len(SEGMENTS)} 類", file=sys.stderr)
    print(json.dumps([{"slug": b["slug"], "name": b["name"], "segment": b["segment"]}
                      for b in BRANDS], ensure_ascii=False, indent=2))
