# -*- coding: utf-8 -*-
"""全球服飾價格與時尚趨勢新聞的中英雙語詞庫。

這個站的「方向」不是股價多空，而是**服飾價格的漲跌壓力**：
  +100 = 明確的漲價訊號（調漲售價、關稅轉嫁、成本推升）
  -100 = 明確的降價／促銷訊號（降價、折扣戰、清倉、二手替代）
趨勢類新聞多半沒有價格方向，靠 TRENDS 標籤與主題分類呈現，方向分數接近 0
是正常狀態，不是分析失敗。

原則沿用 lexicon.py：
1. 詞彙一律兩個字（或一個英文詞組）以上，單字必誤判。
2. 英文一律用小寫詞組收錄，比對前把全文轉小寫（見 fashion_analyze._scan）。
   英文的否定不好用前綴窗口處理，所以「no price increase」這類整句
   直接進 PHRASE_OVERRIDES。
3. 權重 1-5：1 是語氣、5 是「全線調漲」等級的事件。
"""

from __future__ import annotations

# --------------------------------------------------------------------------
# 片語覆寫：整句語意與拆開相反或需要優先鎖定，最先比對、命中後遮蔽。
# --------------------------------------------------------------------------
PHRASE_OVERRIDES = [
    # (片語, 分數, 說明)
    ("凍漲", -0.5, "宣布不漲價：溫和的價格利好，但不是降價"),
    ("不漲價", -0.8, ""),
    ("不調漲", -0.8, ""),
    ("暫緩漲價", -0.8, ""),
    ("漲價喊停", -1.5, ""),
    ("取消漲價", -1.5, ""),
    ("吸收關稅", -1.0, "品牌自行吸收成本，不轉嫁給消費者"),
    ("自行吸收", -0.8, ""),
    # de minimis（小額免稅）取消是本站最核心的漲價事件之一。這幾句一定要
    # 走片語覆寫：拆開比對時「取消」會被當成反轉詞，把「小額免稅」打成反向。
    ("取消小額免稅", +3.5, "小額包裹改課稅，明確的價格上行事件"),
    ("小額免稅取消", +3.5, ""),
    ("終結小額免稅", +3.0, ""),
    ("廢除小額免稅", +3.5, ""),
    ("取消折扣", +2.5, "縮減折扣等於實質漲價"),
    ("縮減折扣", +2.0, ""),
    ("折扣縮水", +2.0, ""),
    ("減少促銷", +1.5, ""),
    ("全面調漲", +4.5, ""),
    ("全線漲價", +4.5, ""),
    ("連年調漲", +3.5, ""),
    ("二度調漲", +3.5, ""),
    ("再度調漲", +3.0, ""),
    ("逆勢降價", -3.0, ""),
    ("破盤價", -2.5, ""),
    ("價格戰", -3.0, "同業互砍，價格向下"),
    ("折扣戰", -3.0, ""),
    ("越賣越便宜", -2.5, ""),
    ("越來越貴", +2.5, ""),
    ("回不去了", +1.5, "台媒漲價新聞的慣用結尾"),
    ("有感漲價", +3.0, ""),
    ("無痛漲價", +2.5, "偷偷漲：縮水式通膨等"),
    ("縮水式通膨", +2.5, ""),
    # 英文整句（比對前全文已轉小寫）
    ("no price increase", -0.8, ""),
    ("no price hike", -0.8, "子字串比對，同時涵蓋 no price hikes"),
    ("not raising prices", -0.8, ""),
    ("won't raise prices", -0.8, ""),
    ("won't hike prices", -0.8, ""),
    ("will not raise prices", -0.8, ""),
    ("not to raise prices", -0.8, ""),
    ("hold prices", -0.6, ""),
    ("holds prices", -0.6, ""),
    ("holding prices", -0.6, ""),
    ("price freeze", -0.6, ""),
    ("absorb tariffs", -1.0, ""),
    ("absorbing tariffs", -1.0, ""),
    ("absorb the tariff", -1.0, ""),
    ("fewer discounts", +2.0, ""),
    ("cutting discounts", +2.0, ""),
    ("price war", -3.0, ""),
    ("race to the bottom", -2.5, ""),
]

# --------------------------------------------------------------------------
# 漲價訊號（正分）
# --------------------------------------------------------------------------
UP = {
    # 中文：直接的價格動作
    "漲價": 3.0, "調漲": 3.0, "喊漲": 2.5, "調升售價": 3.5, "提高售價": 3.5,
    "售價調漲": 3.5, "調高定價": 3.5, "漲幅": 2.0, "調價": 1.5, "變貴": 2.5,
    "貴了": 2.0, "漲價潮": 3.5, "應聲漲": 2.5, "跟進調漲": 3.0, "醞釀漲價": 2.5,
    "反映成本": 2.5, "轉嫁": 2.5, "漲聲": 2.0, "喊貴": 1.5, "新價格": 1.0,
    # 中文：成本端推力
    "成本上漲": 2.5, "成本上升": 2.5, "成本壓力": 2.0, "原物料上漲": 2.5,
    "棉價上漲": 3.0, "羊絨漲": 2.5, "皮革漲": 2.5, "運費上漲": 2.0,
    "工資上漲": 2.0, "缺工": 1.5, "匯率壓力": 1.5, "通膨壓力": 1.5,
    "加徵關稅": 3.5, "關稅衝擊": 3.0, "關稅成本": 3.0, "課稅": 1.5,
    "取消免稅": 3.0, "小額免稅": 1.5, "供不應求": 2.5, "缺貨": 2.0,
    "限量發售": 1.0, "溢價": 2.0, "炒價": 2.0, "秒殺": 1.0,
    # 英文：價格動作
    "price hike": 3.5, "price hikes": 3.5, "price increase": 3.0,
    "price increases": 3.0, "raise prices": 3.0, "raises prices": 3.0,
    "raising prices": 3.0, "raised prices": 3.0, "hiking prices": 3.0,
    "prices up": 2.5, "higher prices": 2.5, "more expensive": 2.5,
    "price rises": 3.0, "price rise": 2.5, "surcharge": 2.5, "pricier": 2.5,
    "pass on costs": 2.5, "passing on costs": 2.5, "pass along costs": 2.5,
    "premiumisation": 1.5, "premiumization": 1.5,
    # 英文：成本端推力
    "tariff": 2.0, "tariffs": 2.0, "cost pressure": 2.0, "input costs": 1.5,
    "cotton prices rise": 3.0, "freight costs": 1.5, "wage increases": 1.5,
    "de minimis": 2.0, "import duties": 2.0, "supply shortage": 2.0,
    "sold out": 1.0, "resale premium": 2.0,
}

# --------------------------------------------------------------------------
# 降價／促銷訊號（負分）
# --------------------------------------------------------------------------
DOWN = {
    # 中文
    "降價": 3.0, "調降售價": 3.0, "降售價": 3.0, "砍價": 2.5, "殺價": 2.5,
    "折扣": 2.0, "打折": 2.0, "下折扣": 2.0, "促銷": 1.5, "特賣": 1.5,
    "特價": 2.0, "出清": 2.0, "清倉": 2.5, "下殺": 2.5, "半價": 2.5,
    "買一送一": 2.0, "週年慶": 1.0, "折扣季": 1.5, "換季拍賣": 1.5,
    "跳樓大拍賣": 3.0, "低價傾銷": 3.0, "傾銷": 2.5, "削價競爭": 3.0,
    "低價競爭": 2.5, "便宜": 1.0, "平價替代": 2.0, "庫存過剩": 2.5,
    "庫存壓力": 2.5, "去庫存": 2.0, "滯銷": 2.5, "需求疲弱": 2.0,
    "買氣冷": 2.0, "降價求售": 3.0, "價格鬆動": 2.5, "跌價": 2.5,
    "棉價下跌": 2.5, "運費下跌": 1.5, "成本回落": 2.0,
    # 英文
    "price cut": 3.0, "price cuts": 3.0, "cut prices": 3.0, "cuts prices": 3.0,
    "cutting prices": 3.0, "slashing prices": 3.5, "slashes prices": 3.5,
    "price drop": 3.0, "prices fall": 2.5, "falling prices": 2.5,
    "lower prices": 2.5, "lowering prices": 2.5, "cheaper": 2.0,
    "discounts": 2.0, "discounting": 2.5, "deep discounts": 3.0,
    "markdown": 2.5, "markdowns": 2.5, "on sale": 1.5, "clearance": 2.5,
    "promotions": 1.5, "black friday": 1.5, "flash sale": 2.0,
    "excess inventory": 2.5, "inventory glut": 3.0, "oversupply": 2.5,
    "weak demand": 2.0, "dumping": 2.5, "undercutting": 2.5,
    "cotton prices fall": 2.5, "deflation": 1.5, "dupes": 1.5, "dupe culture": 1.5,
}

# --------------------------------------------------------------------------
# 語氣強化詞（乘數）
# --------------------------------------------------------------------------
INTENSIFIERS = {
    "大幅": 1.35, "全面": 1.3, "平均": 1.1, "再度": 1.15, "連續": 1.2,
    "史上": 1.45, "創紀錄": 1.5, "罕見": 1.3, "暴": 1.4, "狂": 1.35,
    "顯著": 1.25, "急遽": 1.3, "全線": 1.3, "有感": 1.2,
    # 英文強化詞是「前綴」比對（sharply higher prices）；"across the board"
    # 在英文語序裡永遠出現在訊號詞後面，當前綴強化詞是死條目，所以不收。
    "sharply": 1.3, "steep": 1.3, "record": 1.4, "double-digit": 1.35,
    "massive": 1.3, "unprecedented": 1.45,
}

# --------------------------------------------------------------------------
# 反轉詞：緊貼在訊號詞前方時翻轉極性（僅中文；英文否定走片語覆寫）
# --------------------------------------------------------------------------
NEGATORS = [
    "不再", "不會", "不打", "未見", "沒有", "取消", "喊停", "暫緩", "撤回",
    "否認", "駁斥", "澄清", "難再", "無意", "拒絕",
]

# --------------------------------------------------------------------------
# 推測詞：降低信心，不改變方向。
# 一律兩字以上：單字「傳」「恐」會誤中宣傳/傳統/恐怖/恐龍。
# 句首的「傳○○」句型另由 fashion_analyze 用正規式單獨處理。
# --------------------------------------------------------------------------
HEDGES = [
    "傳出", "外傳", "傳言", "傳聞", "據悉", "據傳", "傳將", "消息人士",
    "可能", "恐將", "恐達", "恐再", "恐掀", "或將", "研擬", "考慮",
    "評估", "醞釀", "預估", "估計", "料將", "不排除", "疑似", "有望", "可望",
    "reportedly", "rumored", "rumoured", "may raise", "could raise",
    "considering", "mulls", "mulling", "expected to", "sources say",
    "reports say", "insiders",
]

# --------------------------------------------------------------------------
# 主題分類（keywords 中英混收；英文一律小寫）
# --------------------------------------------------------------------------
CATEGORIES = [
    {"id": "pricing", "label": "價格動態", "keywords": [
        "漲價", "降價", "調漲", "調降", "售價", "定價", "價格", "折扣", "促銷",
        "特賣", "清倉", "出清", "拍賣", "下殺", "半價", "折起", "調價", "變貴",
        "免稅", "price", "prices", "pricing", "discount", "markdown", "sale",
        "cost of", "expensive", "cheaper", "clearance"]},
    {"id": "cost_supply", "label": "成本供應鏈", "keywords": [
        "關稅", "成本", "棉價", "原物料", "運費", "工資", "產地", "代工",
        "供應鏈", "紡織", "成衣", "越南", "孟加拉", "印度製", "中國製造",
        "移轉產能", "接單", "tariff", "tariffs", "supply chain", "sourcing",
        "cotton", "freight", "manufacturing", "factories", "de minimis",
        "made in", "wages", "raw material"]},
    {"id": "trend", "label": "趨勢風格", "keywords": [
        "趨勢", "流行", "風格", "穿搭", "風潮", "回歸", "當道", "必備",
        "衣櫥", "造型", "美學", "復古", "極簡", "老錢", "靜奢",
        "trend", "trends", "trending", "style", "styling", "aesthetic",
        "wardrobe", "must-have", "comeback", "revival"]},
    {"id": "runway", "label": "時裝週大秀", "keywords": [
        "時裝週", "時裝周", "大秀", "秀場", "系列", "春夏", "秋冬", "高級訂製",
        "訂製服", "走秀", "開秀", "壓軸", "fashion week", "runway", "couture",
        "collection", "show notes", "front row", "menswear", "womenswear",
        "spring/summer", "fall/winter", "ss26", "fw26", "ss27"]},
    {"id": "collab", "label": "聯名新品", "keywords": [
        "聯名", "合作系列", "攜手", "推出", "上市", "開賣", "發售", "新品",
        "新款", "限定", "限量", "膠囊系列", "collab", "collaboration",
        "capsule", "launches", "launch", "drop", "drops", "limited edition",
        "teams up", "partnership"]},
    {"id": "retail", "label": "通路開店", "keywords": [
        "開幕", "開店", "展店", "關店", "撤出", "門市", "旗艦店", "快閃店",
        "百貨", "櫃位", "進駐", "電商", "官網", "outlet", "store", "stores",
        "flagship", "pop-up", "opens", "closing", "closes", "mall",
        "e-commerce", "retail"]},
    {"id": "earnings", "label": "財報業績", "keywords": [
        "財報", "營收", "業績", "獲利", "虧損", "季報", "年報", "銷售額",
        "同店銷售", "毛利", "財測", "展望", "上修", "下修", "earnings",
        "revenue", "sales", "profit", "quarterly", "guidance", "results",
        "forecast", "outlook", "beats", "misses"]},
    {"id": "sustainability", "label": "永續二手", "keywords": [
        "永續", "環保", "回收", "循環", "二手", "古著", "轉售", "租衣",
        "碳排", "快時尚污染", "紡織廢棄", "漂綠", "sustainable",
        "sustainability", "recycled", "circular", "resale", "secondhand",
        "second-hand", "thrift", "vintage", "greenwashing", "textile waste",
        "carbon"]},
    {"id": "celebrity", "label": "名人穿著", "keywords": [
        "紅毯", "街拍", "私服", "現身", "穿上", "同款", "帶貨", "代言",
        "大使", "紅毯造型", "wore", "wearing", "spotted", "red carpet",
        "ambassador", "style icon", "outfit", "looks", "dressed"]},
    {"id": "personnel", "label": "人事品牌", "keywords": [
        "創意總監", "設計總監", "執行長", "接任", "離任", "請辭", "出任",
        "首秀", "接掌", "creative director", "designer", "ceo", "steps down",
        "appointed", "succeeds", "debut collection", "artistic director",
        "leadership"]},
    {"id": "legal_policy", "label": "法規政策", "keywords": [
        "禁令", "法規", "罰款", "裁罰", "訴訟", "控告", "調查", "查稅",
        "仿冒", "山寨", "智財", "抄襲", "強迫勞動", "ban", "regulation",
        "lawsuit", "sues", "fined", "probe", "counterfeit", "copyright",
        "forced labor", "forced labour", "antitrust", "import ban"]},
    {"id": "ma", "label": "併購資本", "keywords": [
        "收購", "併購", "入股", "出售", "求售", "上市", "掛牌", "私有化",
        "破產", "重整", "acquisition", "acquires", "merger", "stake", "ipo",
        "buyout", "bankruptcy", "takeover", "delisting", "restructuring"]},
]

CATEGORY_BY_ID = {c["id"]: c for c in CATEGORIES}

# 這些主題本身就有「價格會動」的份量，重要性加權。
HIGH_IMPACT_CATEGORIES = {"pricing", "cost_supply", "earnings", "ma", "legal_policy"}

# --------------------------------------------------------------------------
# 地區判定（依序比對，先中後西；沒中就是「全球」）
# --------------------------------------------------------------------------
REGIONS = [
    {"id": "tw", "label": "台灣", "keywords": [
        "台灣", "全台", "台北", "新光三越", "遠百", "微風", "台元"]},
    {"id": "cn", "label": "中國", "keywords": [
        "中國", "大陸", "上海", "北京", "天貓", "淘寶", "雙11", "雙十一",
        "china", "chinese consumers", "tmall"]},
    {"id": "jp", "label": "日本", "keywords": [
        "日本", "東京", "日圓", "日元", "銀座", "japan", "tokyo", "yen"]},
    {"id": "kr", "label": "韓國", "keywords": [
        "韓國", "首爾", "韓系", "korea", "seoul", "korean fashion"]},
    {"id": "us", "label": "美國", "keywords": [
        "美國", "美元", "紐約", "白宮", "川普", "美系", "united states",
        "american shoppers", "new york", "washington", "trump", "u.s."]},
    {"id": "eu", "label": "歐洲", "keywords": [
        "歐洲", "歐盟", "法國", "義大利", "英國", "德國", "西班牙", "巴黎",
        "米蘭", "倫敦", "europe", "european", "paris", "milan", "london",
        # 裸 "uk" 會誤中 lukewarm/rebuke；帶空白的寫法配合 _region 的
        # 「標題 + 空白 + 摘要」串接，行尾的 UK 也比對得到。
        "france", "italy", " uk ", "united kingdom", "britain", "british",
        "eu "]},
    {"id": "sea", "label": "亞洲產地", "keywords": [
        "越南", "孟加拉", "印尼", "印度", "柬埔寨", "斯里蘭卡", "緬甸",
        "vietnam", "bangladesh", "india", "indonesia", "cambodia"]},
]
REGION_BY_ID = {r["id"]: r for r in REGIONS}
DEFAULT_REGION = {"id": "global", "label": "全球"}

# --------------------------------------------------------------------------
# 趨勢標籤：用來把新聞掛上「現在流行什麼」的雷達。
# status: rising / stable / fading —— 人工策展的快照（2026 年 8 月，依
# Vogue Runway、WGSN AW26/27、Pinterest Predicts 2026 等趨勢報告整理），
# 隨季度手動更新。
#
# 英文關鍵字一律用「不會是其他常用字子字串」的詞組：比對是單純子字串，
# 用 "lace" 會誤中 palace、"suit" 會誤中 lawsuit、"cape" 會誤中 escape、
# "trail" 會誤中 trailer —— 這類短字一律加詞（"lace dress"）或不收。
# --------------------------------------------------------------------------
TRENDS = [
    {"id": "boho", "label": "波希米亞復興", "en": "Boho Revival", "status": "rising",
     "keywords": ["波希米亞", "波西米亞", "流蘇", "荷葉邊", "民族風", "嬉皮風",
                   "boho", "bohemian"],
     "note": "Chloé 帶起的 2025-26 主軸，AW26 演變為更濃烈的迷幻波希米亞"},
    {"id": "quiet_luxury", "label": "靜奢老錢風", "en": "Quiet Luxury", "status": "fading",
     "keywords": ["靜奢", "老錢風", "低調奢華", "隱奢", "quiet luxury", "old money",
                   "stealth wealth"],
     "note": "歐美媒體宣告退潮、轉向高調奢華，但台媒「老錢風」用詞仍高頻"},
    {"id": "loud_luxury", "label": "高調奢華極繁", "en": "Loud Luxury / Maximalism",
     "status": "rising",
     "keywords": ["高調奢華", "極繁主義", "極繁", "華麗風", "誇張配飾", "亮片",
                   "loud luxury", "maximalism", "maximalist", "sequins"],
     "note": "2026 的定義性轉向：Pinterest 稱之為 opulent individuality"},
    {"id": "gorpcore", "label": "機能戶外風", "en": "Gorpcore", "status": "stable",
     "keywords": ["機能風", "機能穿搭", "山系", "戶外風", "衝鋒衣", "登山鞋",
                   "gorpcore", "technical wear", "urban outdoor", "outdoor gear"],
     "note": "始祖鳥、Salomon 帶動的都市機能穿搭，已固化為常態品類"},
    {"id": "y2k", "label": "Y2K千禧風", "en": "Y2K", "status": "stable",
     "keywords": ["y2k", "千禧風", "千禧辣妹", "低腰褲", "低腰牛仔", "辣妹風",
                   "low-rise", "velour", "mcbling"],
     "note": "低腰、絲絨、亮片反覆循環，已是常駐懷舊題材"},
    {"id": "balletcore", "label": "芭蕾風", "en": "Balletcore", "status": "rising",
     "keywords": ["芭蕾風", "芭蕾平底鞋", "芭蕾舞鞋", "蝴蝶結", "緞帶", "紗裙",
                   "balletcore", "ballet flats", "ballet pink"],
     "note": "2026 二度爆發、走向 Black Swan 式暗黑成熟版"},
    {"id": "blokecore", "label": "足球球衣風", "en": "Blokecore", "status": "rising",
     "keywords": ["足球衣", "球衣穿搭", "復古球衣", "足球風", "世界盃", "世足",
                   "blokecore", "football jersey", "soccer jersey", "retro kit"],
     "note": "2026 世界盃年最強季節性趨勢，球衣配西裝／牛仔為主流穿法"},
    {"id": "poetcore", "label": "詩人學院風", "en": "Poet-core / Academia", "status": "rising",
     "keywords": ["詩人風", "學院風", "文青風", "高領毛衣", "郵差包", "知性穿搭",
                   "poet-core", "poetcore", "dark academia", "turtleneck"],
     "note": "Pinterest Predicts 2026：復古剪裁混學院懷舊"},
    {"id": "power80s", "label": "80年代權力風", "en": "'80s Power Glamour", "status": "rising",
     "keywords": ["80年代", "墊肩", "寬版西裝", "粗腰帶", "權力套裝",
                   "power dressing", "power suit", "shoulder pads", "chunky belt"],
     "note": "寬鬆西裝、粗腰帶與 80 年代奢華回歸"},
    {"id": "lace_sheer", "label": "蕾絲透膚", "en": "Lace & Sheer", "status": "rising",
     "keywords": ["蕾絲", "透膚", "薄紗", "透視", "襯裙", "sheer", "see-through",
                   "lace dress", "lace top", "lingerie dressing"],
     "note": "Pinterest 2026 關鍵材質，蕾絲從內衣上到外套"},
    {"id": "tuxedo", "label": "晚宴西裝風", "en": "Tuxedo Dressing", "status": "rising",
     "keywords": ["燕尾服", "晚宴西裝", "緞面翻領", "領結", "西裝式禮服",
                   "tuxedo", "le smoking", "black tie", "bow tie"],
     "note": "Vogue 點名的 2026 秋冬四大趨勢之首，日夜通穿的 tuxedo codes"},
    {"id": "capes", "label": "斗篷披風", "en": "Capes & Ponchos", "status": "rising",
     "keywords": ["斗篷", "披風", "披肩", "poncho", "cape coat", "wrap coat"],
     "note": "2026 秋冬最戲劇化的外套宣言（Ralph Lauren 等）"},
    {"id": "artdeco", "label": "1920裝飾藝術", "en": "Art Deco Revival", "status": "rising",
     "keywords": ["裝飾藝術", "1920年代", "20年代", "流蘇晚裝", "art deco",
                   "flapper", "gatsby", "jazz age"],
     "note": "Vogue 2026 秋冬趨勢：Art Deco 晚裝、胸針與流蘇細節"},
    {"id": "colors2026", "label": "2026年度色", "en": "2026 Key Colors", "status": "stable",
     "keywords": ["番茄紅", "皇家紫", "年度代表色", "年度色", "tomato red",
                   "cherry red", "royal purple", "color of the year",
                   "transformative teal", "cloud dancer"],
     "note": "番茄紅與皇家紫貫穿 2026，WGSN 年度色 Transformative Teal"},
    {"id": "denim", "label": "丹寧", "en": "Denim", "status": "stable",
     "keywords": ["丹寧", "牛仔褲", "牛仔外套", "靴型褲", "桶型褲", "直筒褲",
                   "喇叭褲", "denim", "jeans", "bootcut", "barrel jeans", "wide leg"],
     "note": "常青品類；2026 走向直筒／靴型剪裁，bootcut 回歸、barrel 退燒"},
    {"id": "tailoring", "label": "西裝剪裁", "en": "Tailoring", "status": "stable",
     "keywords": ["西裝外套", "套裝", "訂製剪裁", "劍領", "西裝褲",
                   "tailoring", "suiting", "blazer", "pantsuit"],
     "note": "常青品類；2026 秋冬肩線轉向圓潤有機（WGSN AW26/27）"},
    {"id": "athleisure", "label": "運動休閒", "en": "Athleisure", "status": "stable",
     "keywords": ["運動休閒", "運動風", "瑜伽褲", "瑜珈褲", "緊身褲", "運動外套",
                   "athleisure", "activewear", "leggings", "sportswear"],
     "note": "常青品類；2026 冬奧＋世足雙賽事年推升 sporty 語彙"},
    {"id": "retro_sneakers", "label": "復古球鞋", "en": "Retro Sneakers", "status": "stable",
     "keywords": ["復古球鞋", "老爹鞋", "德訓鞋", "薄底鞋", "復古跑鞋",
                   "retro sneakers", "terrace fashion", "gazelle"],
     "note": "薄底復古鞋持續壓過厚底潮流，跑鞋復古熱帶動 ASICS 等品牌"},
    {"id": "sustainable", "label": "永續時尚", "en": "Sustainable Fashion", "status": "stable",
     "keywords": ["永續時尚", "循環時尚", "回收材質", "再生纖維", "升級再造", "環保材質",
                   "sustainable fashion", "circular fashion", "upcycling", "deadstock"],
     "note": "常青議題：供應鏈、法規與材質創新，與二手趨勢互為表裡"},
    {"id": "vintage_secondhand", "label": "古著二手", "en": "Vintage & Secondhand",
     "status": "rising",
     "keywords": ["古著", "二手衣", "二手包", "中古包", "二手市集", "二手精品", "轉售",
                   "vintage", "secondhand", "thrifting", "pre-owned", "archive fashion"],
     "note": "二手市場十年內估自 430 億美元成長至 1,250 億，侵蝕新品需求"},
    {"id": "minimalism", "label": "極簡主義", "en": "Minimalism", "status": "fading",
     "keywords": ["極簡風", "簡約風", "膠囊衣櫥", "基本款", "minimalist", "minimalism",
                   "capsule wardrobe"],
     "note": "2026 明顯退潮：媒體集體從膠囊衣櫥轉向個人化極繁表達"},
    {"id": "fur_knit", "label": "絨毛針織", "en": "Fur Effect & Knitwear", "status": "rising",
     "keywords": ["皮草感", "仿皮草", "羊羔毛", "馬海毛", "毛絨", "圈圈紗", "針織衫",
                   "faux fur", "shearling", "mohair", "chunky knit", "knitwear"],
     "note": "AW26 季節訊號：伸展台大量皮草感、仿毛與立體針織肌理"},
    {"id": "satin", "label": "緞面光澤", "en": "Satin & Sheen", "status": "stable",
     "keywords": ["緞面", "絲緞", "光澤感", "吊帶裙", "絲質",
                   "satin", "slip dress", "liquid shine"],
     "note": "2026 秋冬延續的材質主線，與晚宴西裝、Art Deco 交疊"},
    {"id": "western", "label": "西部牛仔風", "en": "Western", "status": "fading",
     "keywords": ["西部風", "牛仔靴", "西部牛仔", "牛仔帽", "cowboycore",
                   "cowboy boots", "cowboy hat"],
     "note": "2024-25 高峰後退燒，牛仔靴等單品仍常出現於頭條"},
    {"id": "animal_print", "label": "動物紋", "en": "Animal Print", "status": "stable",
     "keywords": ["豹紋", "動物紋", "斑馬紋", "蛇紋", "leopard print", "animal print",
                   "snake print"],
     "note": "常青印花：豹紋自 2024 起回到「新中性色」地位"},
    {"id": "workwear", "label": "工裝風", "en": "Workwear", "status": "stable",
     "keywords": ["工裝褲", "工裝外套", "工裝風", "多口袋", "workwear", "cargo pants",
                   "carhartt"],
     "note": "工裝褲與多口袋設計的街頭長青款，復古美式工裝在二手市場最熱"},
]

TREND_BY_ID = {t["id"]: t for t in TRENDS}
TREND_STATUS_LABEL = {"rising": "上升", "stable": "持平", "fading": "退燒"}


# --------------------------------------------------------------------------
# 價格驅動因素：頁面上「衣價為什麼變動」的說明卡。
# 人工策展的快照（asof 標註整理時點），不是即時資料 —— 內容依當時的
# 公開報導與統計整理，隨情勢演變手動更新。
# --------------------------------------------------------------------------
DRIVERS_ASOF = "2026-08"
PRICE_DRIVERS = [
    {"name": "美國關稅", "direction": "推升",
     "detail": "美國成衣進口平均關稅率從 2025 年初的約 15% 一路墊高到年底的 35%；"
               "2026 年 IEEPA 關稅遭最高法院否決後，改以過渡性關稅與新的 301 條款"
               "關稅接手，疊加基礎稅率後稅負仍遠高於 2024 年之前，品牌陸續轉嫁。"},
    {"name": "小額免稅取消", "direction": "推升",
     "detail": "美國 800 美元以下包裹免稅（de minimis）2025 年起分階段取消，"
               "SHEIN、Temu 隨即調價，部分品類漲逾三成；國會並立法自 2027 年年中"
               "起永久廢除商業包裹免稅。"},
    {"name": "棉花與化纖", "direction": "雙向",
     "detail": "2024-25 年低棉價曾壓低成本，但 2026 年全球棉花消費量超過產量、"
               "產地天候疑慮再起，期棉回到波段高點；聚酯纖維隨原油與能源價格"
               "波動，回收聚酯持續比原生貴兩到四成。"},
    {"name": "海運運價", "direction": "壓低",
     "detail": "貨櫃運力過剩讓運價自 2024 年高峰大幅回落，市場預估 2026 年均價"
               "再往下；但紅海航線復航節奏與補庫存需求仍可能造成短期波動。"},
    {"name": "產地工資", "direction": "推升",
     "detail": "越南 2026 年起基本工資調升 7.2%，孟加拉成衣最低工資一年多來累計"
               "上調約 65%，中國製造業勞動成本年增 5-15%，訂單持續往印度、印尼、"
               "柬埔寨等地移轉。"},
    {"name": "匯率", "direction": "雙向",
     "detail": "美元走弱推高美國進口服飾成本、歐系品牌在美加價；日圓與新台幣的"
               "波動則直接反映在 UNIQLO、無印良品等日系品牌的在地售價上。"},
    {"name": "精品調價潮", "direction": "推升",
     "detail": "愛馬仕、香奈兒、LV 明言將關稅與成本轉嫁，勞力士 2026 年內多次"
               "調價；統計顯示疫情以來累計漲幅前段班的精品已漲超過六成。"},
    {"name": "品牌成本轉嫁", "direction": "推升",
     "detail": "NIKE 自 2025 年年中起調漲美國售價並預估關稅新增約 10 億美元成本，"
               "愛迪達、UNIQLO 亦相繼警告或執行漲價，主因產地集中在被課"
               "15-20% 對等關稅的越南、孟加拉、柬埔寨。"},
    {"name": "需求與庫存", "direction": "壓低",
     "detail": "服飾終端需求疲軟，關稅僅部分轉嫁到消費端、品牌多以壓縮毛利吸收；"
               "折扣通路、消費降級與二手替代持續抑制實際成交價。"},
    {"name": "二手市場替代", "direction": "壓低",
     "detail": "二手服飾市場成長速度數倍於新品零售，年輕客群接受度快速上升，"
               "對新品定價形成長期的替代壓力。"},
]


# --------------------------------------------------------------------------
# 方向級距
# --------------------------------------------------------------------------

def price_label(score: float) -> str:
    if score >= 45:
        return "明確漲價訊號"
    if score >= 15:
        return "偏向漲價"
    if score <= -45:
        return "明確降價訊號"
    if score <= -15:
        return "偏向降價促銷"
    return "價格中性"


def price_key(score: float) -> str:
    if score >= 15:
        return "up"
    if score <= -15:
        return "down"
    return "flat"


def sanity_check() -> None:
    """詞庫不該自我矛盾，也不該和品牌名撞在一起。"""
    overlap = set(UP) & set(DOWN)
    assert not overlap, f"漲價與降價詞重疊：{overlap}"
    for term, weight in list(UP.items()) + list(DOWN.items()):
        assert 0 < weight <= 5, f"{term} 權重超出範圍：{weight}"
        assert len(term) >= 2, f"{term} 太短，容易誤判"
        if term.isascii():
            assert term == term.lower(), f"英文詞 {term} 必須收小寫（比對前全文轉小寫）"

    for term in NEGATORS + HEDGES:
        assert len(term) >= 2, f"詞彙 {term} 是單字，會誤中其他詞"

    from fashion_brands import BRANDS  # noqa: PLC0415

    names = set()
    for b in BRANDS:
        names.add(b["name"])
        names.update(b["aliases"])
    lowered = {n.lower() for n in names}
    for term in list(UP) + list(DOWN) + NEGATORS:
        clashes = [n for n in lowered if term.lower() in n]
        assert not clashes, f"詞彙「{term}」出現在品牌名 {clashes} 之中"

    ids = [c["id"] for c in CATEGORIES]
    assert len(ids) == len(set(ids)), "分類 id 重複"
    tids = [t["id"] for t in TRENDS]
    assert len(tids) == len(set(tids)), "趨勢 id 重複"
    for t in TRENDS:
        assert t["status"] in TREND_STATUS_LABEL, t["id"]
        assert t["keywords"], t["id"]
    rids = [r["id"] for r in REGIONS]
    assert len(rids) == len(set(rids)), "地區 id 重複"


if __name__ == "__main__":
    sanity_check()
    print(f"漲價 {len(UP)} 詞 / 降價 {len(DOWN)} 詞 / 片語覆寫 {len(PHRASE_OVERRIDES)} / "
          f"分類 {len(CATEGORIES)} / 趨勢 {len(TRENDS)} / 地區 {len(REGIONS)}")
