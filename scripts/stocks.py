# -*- coding: utf-8 -*-
"""台股權值股名單。

權重會隨行情漂移，這裡的 weight 只是「排序與版面用」的近似值（單位：%），
每日抓取時若 TWSE 的公開行情可用，會以當日收盤價更新報價欄位，但名單本身
維持人工策展 —— 自動換股會讓歷史檔案難以比對，寧可手動維護。

aliases 是給新聞比對用的：媒體在標題裡未必寫全名（「台積」「護國神山」
「TSMC」都指 2330），漏掉這些會讓關聯個股判斷失準。
query_terms 則是丟進新聞搜尋的字串，需要考慮同名詞干擾
（「統一」「長榮」「廣達」單獨搜會撈到大量非個股新聞）。
"""

from __future__ import annotations

TOP20 = [
    {
        "ticker": "2330",
        "name": "台積電",
        "full_name": "台灣積體電路製造股份有限公司",
        "en_name": "TSMC",
        "sector": "半導體",
        "weight": 39.5,
        "aliases": ["台積", "台積電", "TSMC", "台灣積體電路", "護國神山", "晶圓代工龍頭"],
        "query_terms": ["台積電", "TSMC 台股"],
        "driver": "先進製程報價、CoWoS 產能、AI 晶片需求、海外建廠成本",
    },
    {
        "ticker": "2317",
        "name": "鴻海",
        "full_name": "鴻海精密工業股份有限公司",
        "en_name": "Hon Hai / Foxconn",
        "sector": "電子代工",
        "weight": 4.6,
        "aliases": ["鴻海", "鴻海精密", "富士康", "Foxconn", "郭台銘", "劉揚偉"],
        "query_terms": ["鴻海", "鴻海 AI 伺服器"],
        "driver": "AI 伺服器機櫃出貨、iPhone 組裝拉貨、電動車佈局、月營收",
    },
    {
        "ticker": "2454",
        "name": "聯發科",
        "full_name": "聯發科技股份有限公司",
        "en_name": "MediaTek",
        "sector": "半導體",
        "weight": 3.3,
        "aliases": ["聯發科", "MediaTek", "天璣", "Dimensity", "蔡力行"],
        "query_terms": ["聯發科", "聯發科 天璣"],
        "driver": "旗艦手機晶片市佔、ASIC 專案、中國手機庫存、法說會財測",
    },
    {
        "ticker": "2308",
        "name": "台達電",
        "full_name": "台達電子工業股份有限公司",
        "en_name": "Delta Electronics",
        "sector": "電子零組件",
        "weight": 2.6,
        "aliases": ["台達電", "台達電子", "Delta", "海英俊", "鄭平"],
        "query_terms": ["台達電", "台達電子"],
        "driver": "AI 資料中心電源、液冷散熱、電動車動力、毛利率變化",
    },
    {
        "ticker": "2382",
        "name": "廣達",
        "full_name": "廣達電腦股份有限公司",
        "en_name": "Quanta Computer",
        "sector": "電腦及週邊",
        "weight": 2.3,
        "aliases": ["廣達", "廣達電腦", "Quanta", "林百里"],
        "query_terms": ["廣達 林百里", "廣達 AI 伺服器"],
        "driver": "AI 伺服器出貨節奏、NB 代工、雲端客戶資本支出",
    },
    {
        "ticker": "2881",
        "name": "富邦金",
        "full_name": "富邦金融控股股份有限公司",
        "en_name": "Fubon Financial",
        "sector": "金融保險",
        "weight": 1.6,
        "aliases": ["富邦金", "富邦金控", "富邦人壽", "台北富邦銀行", "蔡明興"],
        "query_terms": ["富邦金控", "富邦金"],
        "driver": "壽險匯兌損益、避險成本、自結獲利、股利政策",
    },
    {
        "ticker": "2891",
        "name": "中信金",
        "full_name": "中國信託金融控股股份有限公司",
        "en_name": "CTBC Financial",
        "sector": "金融保險",
        "weight": 1.5,
        "aliases": ["中信金", "中信金控", "中國信託", "CTBC", "台灣人壽"],
        "query_terms": ["中信金控", "中信金"],
        "driver": "放款利差、財富管理手續費、海外據點、自結每股盈餘",
    },
    {
        "ticker": "2882",
        "name": "國泰金",
        "full_name": "國泰金融控股股份有限公司",
        "en_name": "Cathay Financial",
        "sector": "金融保險",
        "weight": 1.4,
        "aliases": ["國泰金", "國泰金控", "國泰人壽", "國泰世華", "蔡宏圖"],
        "query_terms": ["國泰金控", "國泰金"],
        "driver": "壽險資金運用、匯損避險、股債評價、月自結獲利",
    },
    {
        "ticker": "3711",
        "name": "日月光投控",
        "full_name": "日月光投資控股股份有限公司",
        "en_name": "ASE Technology Holding",
        "sector": "半導體",
        "weight": 1.3,
        "aliases": ["日月光", "日月光投控", "ASE", "矽品", "環電"],
        "query_terms": ["日月光投控", "日月光 封測"],
        "driver": "先進封裝訂單、封測稼動率、匯率、法說會展望",
    },
    {
        "ticker": "2412",
        "name": "中華電",
        "full_name": "中華電信股份有限公司",
        "en_name": "Chunghwa Telecom",
        "sector": "通信網路",
        "weight": 1.2,
        "aliases": ["中華電", "中華電信", "Chunghwa Telecom", "CHT"],
        "query_terms": ["中華電信", "中華電"],
        "driver": "行動 ARPU、資費競爭、資安與 IDC 業務、穩定股利",
    },
    {
        "ticker": "2303",
        "name": "聯電",
        "full_name": "聯華電子股份有限公司",
        "en_name": "UMC",
        "sector": "半導體",
        "weight": 1.0,
        "aliases": ["聯電", "聯華電子", "UMC"],
        "query_terms": ["聯電 UMC", "聯電 晶圓"],
        "driver": "成熟製程稼動率、代工報價、中國同業競爭、資本支出",
    },
    {
        "ticker": "2345",
        "name": "智邦",
        "full_name": "智邦科技股份有限公司",
        "en_name": "Accton Technology",
        "sector": "通信網路",
        "weight": 0.9,
        "aliases": ["智邦", "智邦科技", "Accton"],
        "query_terms": ["智邦 交換器", "智邦科技"],
        "driver": "800G 交換器出貨、雲端客戶白牌需求、月營收動能",
    },
    {
        "ticker": "3231",
        "name": "緯創",
        "full_name": "緯創資通股份有限公司",
        "en_name": "Wistron",
        "sector": "電腦及週邊",
        "weight": 0.9,
        "aliases": ["緯創", "緯創資通", "Wistron"],
        "query_terms": ["緯創資通", "緯創 AI 伺服器"],
        "driver": "AI 伺服器板卡與系統、GPU 模組、子公司緯穎轉投資效益",
    },
    {
        "ticker": "6669",
        "name": "緯穎",
        "full_name": "緯穎科技服務股份有限公司",
        "en_name": "Wiwynn",
        "sector": "電腦及週邊",
        "weight": 0.8,
        "aliases": ["緯穎", "緯穎科技", "Wiwynn"],
        "query_terms": ["緯穎", "緯穎科技"],
        "driver": "北美雲端資料中心訂單、機櫃出貨、單月營收爆發力",
    },
    {
        "ticker": "2357",
        "name": "華碩",
        "full_name": "華碩電腦股份有限公司",
        "en_name": "ASUS",
        "sector": "電腦及週邊",
        "weight": 0.8,
        "aliases": ["華碩", "華碩電腦", "ASUS", "施崇棠"],
        "query_terms": ["華碩 ASUS", "華碩電腦"],
        "driver": "AI PC 換機潮、顯卡與主機板需求、品牌庫存水位",
    },
    {
        "ticker": "2886",
        "name": "兆豐金",
        "full_name": "兆豐金融控股股份有限公司",
        "en_name": "Mega Financial",
        "sector": "金融保險",
        "weight": 0.8,
        "aliases": ["兆豐金", "兆豐金控", "兆豐銀行", "Mega"],
        "query_terms": ["兆豐金控", "兆豐金"],
        "driver": "外匯與聯貸利差、公股政策、高殖利率題材",
    },
    {
        "ticker": "1216",
        "name": "統一",
        "full_name": "統一企業股份有限公司",
        "en_name": "Uni-President Enterprises",
        "sector": "食品",
        "weight": 0.7,
        "aliases": ["統一企業", "統一超", "Uni-President", "羅智先"],
        "query_terms": ["統一企業 1216", "統一企業 營收"],
        "driver": "中國與台灣食品通路、原物料成本、轉投資統一超收益",
    },
    {
        "ticker": "2884",
        "name": "玉山金",
        "full_name": "玉山金融控股股份有限公司",
        "en_name": "E.SUN Financial",
        "sector": "金融保險",
        "weight": 0.7,
        "aliases": ["玉山金", "玉山金控", "玉山銀行", "E.SUN"],
        "query_terms": ["玉山金控", "玉山金"],
        "driver": "信用卡與財管手續費、放款成長、併購與增資動向",
    },
    {
        "ticker": "2379",
        "name": "瑞昱",
        "full_name": "瑞昱半導體股份有限公司",
        "en_name": "Realtek Semiconductor",
        "sector": "半導體",
        "weight": 0.6,
        "aliases": ["瑞昱", "瑞昱半導體", "Realtek"],
        "query_terms": ["瑞昱 Realtek", "瑞昱半導體"],
        "driver": "網通與 PC 週邊晶片、乙太網路需求、毛利率與庫存",
    },
    {
        "ticker": "3034",
        "name": "聯詠",
        "full_name": "聯詠科技股份有限公司",
        "en_name": "Novatek Microelectronics",
        "sector": "半導體",
        "weight": 0.6,
        "aliases": ["聯詠", "聯詠科技", "Novatek"],
        "query_terms": ["聯詠 驅動 IC", "聯詠科技"],
        "driver": "面板驅動 IC 與 TDDI 報價、電視與手機終端需求、庫存去化",
    },
]

# 市場層級（大盤）也當成一個「虛擬標的」處理，讓盤前簡報有總體視角。
MARKET = {
    "ticker": "TAIEX",
    "name": "台股大盤",
    "full_name": "臺灣證券交易所發行量加權股價指數",
    "en_name": "TAIEX",
    "sector": "指數",
    "weight": 100.0,
    "aliases": ["加權指數", "台股", "大盤", "台北股市", "集中市場", "TAIEX"],
    "query_terms": ["台股 加權指數 收盤", "外資 台股 買超"],
    "driver": "美股與費半走勢、外資買賣超、台幣匯率、期貨未平倉",
}

BY_TICKER = {s["ticker"]: s for s in TOP20}
ALL_TARGETS = [MARKET] + TOP20


def total_weight() -> float:
    return round(sum(s["weight"] for s in TOP20), 2)


if __name__ == "__main__":
    import json
    import sys

    tickers = [s["ticker"] for s in TOP20]
    assert len(tickers) == 20, f"預期 20 檔，實際 {len(tickers)}"
    assert len(set(tickers)) == 20, "有重複的股票代號"
    for s in TOP20:
        assert s["name"] in s["aliases"] or any(s["name"] in a for a in s["aliases"]), s["ticker"]
        assert s["query_terms"], s["ticker"]
    print(f"20 檔權值股，合計約占大盤 {total_weight()}%", file=sys.stderr)
    print(json.dumps([{"ticker": s["ticker"], "name": s["name"], "weight": s["weight"]} for s in TOP20],
                     ensure_ascii=False, indent=2))
