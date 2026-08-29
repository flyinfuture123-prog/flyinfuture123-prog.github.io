# -*- coding: utf-8 -*-
"""台股權值股名單。

TAIEX 是「全市值加權、不做流通調整、沒有權重上限」的指數，所以權重每天都在動。
這份 weight 是 2025 年底至 2026 年初的近似快照，只用在排序與版面上；把它當成
「涵蓋約六成指數權重的關注池」比當成精準排名誠實得多 —— 第 11～20 名的權重
全部擠在 0.4%～0.7% 的窄帶內，一個月的漲跌就足以進出前 20。

刻意不做自動換股：名單一天一個樣，歷史封存就無法互相比較了。

只收上市（TWSE）股票。上櫃的權值股（環球晶、力旺、信驊、元太…）屬於櫃買
指數，不在 TAIEX 裡。

aliases 是給新聞比對用的。收錄原則是「只放唯一指向這家公司的字串」：
公司全名、簡稱、英文名、明確的子公司、負責人。刻意**不放**產品名與產業
通稱（「信用卡」「先進封裝」「7-ELEVEN」）—— 那會讓每則產業新聞都被掛上
一堆不相干的個股。

query_terms 是丟進新聞搜尋的字串。要避開同名干擾：「統一」「長榮」「廣達」
單獨搜會撈到大量非個股的結果，所以用能唯一指涉公司的寫法。
"""

from __future__ import annotations

TOP20 = [
    {
        "ticker": "2330",
        "name": "台積電",
        "full_name": "台灣積體電路製造股份有限公司",
        "en_name": "TSMC",
        "sector": "半導體",
        "weight": 40.5,
        "aliases": ["台積電", "台積", "TSMC", "台灣積體電路", "護國神山", "魏哲家"],
        "query_terms": ["台積電", "台積電 法說會"],
        "driver": "先進製程報價、CoWoS 產能、AI 晶片需求、海外建廠成本、月營收",
    },
    {
        "ticker": "2317",
        "name": "鴻海",
        "full_name": "鴻海精密工業股份有限公司",
        "en_name": "Hon Hai / Foxconn",
        "sector": "電子代工",
        "weight": 3.6,
        "aliases": ["鴻海", "鴻海精密", "富士康", "Foxconn", "劉揚偉"],
        "query_terms": ["鴻海", "鴻海 AI 伺服器"],
        "driver": "AI 伺服器機櫃出貨、iPhone 組裝拉貨、電動車佈局、月營收",
    },
    {
        "ticker": "2308",
        "name": "台達電",
        "full_name": "台達電子工業股份有限公司",
        "en_name": "Delta Electronics",
        "sector": "電子零組件",
        "weight": 2.8,
        "aliases": ["台達電", "台達電子", "Delta Electronics", "鄭平", "海英俊"],
        "query_terms": ["台達電", "台達電子 電源"],
        "driver": "AI 資料中心電源、液冷散熱、電動車動力、毛利率變化",
    },
    {
        "ticker": "2454",
        "name": "聯發科",
        "full_name": "聯發科技股份有限公司",
        "en_name": "MediaTek",
        "sector": "半導體",
        "weight": 2.4,
        "aliases": ["聯發科", "MediaTek", "天璣", "蔡力行"],
        "query_terms": ["聯發科", "聯發科 天璣"],
        "driver": "旗艦手機晶片市佔、ASIC 專案、中國手機庫存、法說會財測",
    },
    {
        "ticker": "2881",
        "name": "富邦金",
        "full_name": "富邦金融控股股份有限公司",
        "en_name": "Fubon Financial",
        "sector": "金融保險",
        "weight": 1.35,
        "aliases": ["富邦金", "富邦金控", "富邦人壽", "台北富邦銀行", "北富銀", "蔡明興"],
        "query_terms": ["富邦金控", "富邦金 自結"],
        "driver": "壽險匯兌損益、避險成本、自結獲利、股利政策",
    },
    {
        "ticker": "2382",
        "name": "廣達",
        "full_name": "廣達電腦股份有限公司",
        "en_name": "Quanta Computer",
        "sector": "電腦及週邊",
        "weight": 1.2,
        "aliases": ["廣達電腦", "廣達", "Quanta", "林百里"],
        "query_terms": ["廣達電腦", "廣達 AI 伺服器"],
        "driver": "AI 伺服器出貨節奏、NB 代工、雲端客戶資本支出",
    },
    {
        "ticker": "2412",
        "name": "中華電",
        "full_name": "中華電信股份有限公司",
        "en_name": "Chunghwa Telecom",
        "sector": "通信網路",
        "weight": 1.1,
        "aliases": ["中華電信", "中華電", "Chunghwa Telecom"],
        "query_terms": ["中華電信", "中華電信 股利"],
        "driver": "行動 ARPU、資費競爭、資安與 IDC 業務、穩定股利",
    },
    {
        "ticker": "2882",
        "name": "國泰金",
        "full_name": "國泰金融控股股份有限公司",
        "en_name": "Cathay Financial",
        "sector": "金融保險",
        "weight": 1.05,
        "aliases": ["國泰金", "國泰金控", "國泰人壽", "國泰世華", "蔡宏圖"],
        "query_terms": ["國泰金控", "國泰金 自結"],
        "driver": "壽險資金運用、匯損避險、股債評價、月自結獲利",
    },
    {
        "ticker": "3711",
        "name": "日月光投控",
        "full_name": "日月光投資控股股份有限公司",
        "en_name": "ASE Technology Holding",
        "sector": "半導體",
        "weight": 0.95,
        "aliases": ["日月光投控", "日月光", "ASE Technology", "矽品"],
        "query_terms": ["日月光投控", "日月光 封測"],
        "driver": "先進封裝訂單、封測稼動率、匯率、法說會展望",
    },
    {
        "ticker": "2891",
        "name": "中信金",
        "full_name": "中國信託金融控股股份有限公司",
        "en_name": "CTBC Financial",
        "sector": "金融保險",
        "weight": 0.92,
        "aliases": ["中信金", "中信金控", "中國信託", "CTBC", "台灣人壽"],
        "query_terms": ["中信金控", "中國信託 金控"],
        "driver": "放款利差、財富管理手續費、海外據點、自結每股盈餘",
    },
    {
        "ticker": "2303",
        "name": "聯電",
        "full_name": "聯華電子股份有限公司",
        "en_name": "UMC",
        "sector": "半導體",
        "weight": 0.68,
        "aliases": ["聯電", "聯華電子", "UMC"],
        "query_terms": ["聯電 晶圓代工", "聯華電子"],
        "driver": "成熟製程稼動率、代工報價、中國同業競爭、資本支出",
    },
    {
        "ticker": "2886",
        "name": "兆豐金",
        "full_name": "兆豐金融控股股份有限公司",
        "en_name": "Mega Financial",
        "sector": "金融保險",
        "weight": 0.65,
        "aliases": ["兆豐金", "兆豐金控", "兆豐銀行", "Mega Financial"],
        "query_terms": ["兆豐金控", "兆豐銀行"],
        "driver": "外匯與聯貸利差、公股政策、高殖利率題材",
    },
    {
        "ticker": "2345",
        "name": "智邦",
        "full_name": "智邦科技股份有限公司",
        "en_name": "Accton Technology",
        "sector": "通信網路",
        "weight": 0.62,
        "aliases": ["智邦科技", "智邦", "Accton"],
        "query_terms": ["智邦科技", "智邦 交換器"],
        "driver": "800G 交換器出貨、雲端客戶白牌需求、月營收動能",
    },
    {
        "ticker": "6669",
        "name": "緯穎",
        "full_name": "緯穎科技服務股份有限公司",
        "en_name": "Wiwynn",
        "sector": "電腦及週邊",
        "weight": 0.58,
        "aliases": ["緯穎", "緯穎科技", "Wiwynn"],
        "query_terms": ["緯穎科技", "緯穎 資料中心"],
        "driver": "北美雲端資料中心訂單、機櫃出貨、單月營收爆發力",
    },
    {
        "ticker": "2357",
        "name": "華碩",
        "full_name": "華碩電腦股份有限公司",
        "en_name": "ASUS",
        "sector": "電腦及週邊",
        "weight": 0.55,
        "aliases": ["華碩", "華碩電腦", "ASUS", "施崇棠"],
        "query_terms": ["華碩電腦", "華碩 AI PC"],
        "driver": "AI PC 換機潮、顯卡與主機板需求、品牌庫存水位",
    },
    {
        "ticker": "2884",
        "name": "玉山金",
        "full_name": "玉山金融控股股份有限公司",
        "en_name": "E.SUN Financial",
        "sector": "金融保險",
        "weight": 0.54,
        "aliases": ["玉山金", "玉山金控", "玉山銀行", "E.SUN"],
        "query_terms": ["玉山金控", "玉山銀行"],
        "driver": "信用卡與財管手續費、放款成長、併購與增資動向",
    },
    {
        "ticker": "1216",
        # 顯示名刻意用全名。單寫「統一」會在「統一發票」「統一超商」「兩岸統一」
        # 這些完全無關的標題上誤命中。
        "name": "統一企業",
        "full_name": "統一企業股份有限公司",
        "en_name": "Uni-President Enterprises",
        "sector": "食品",
        "weight": 0.5,
        "aliases": ["統一企業", "Uni-President", "羅智先", "統一企業中國"],
        "query_terms": ["統一企業", "統一企業 營收"],
        "driver": "中國與台灣食品通路、原物料成本、轉投資統一超收益",
    },
    {
        "ticker": "2603",
        # 同理：「長榮」會撈到長榮航空（2618）與長榮大學。
        "name": "長榮海運",
        "full_name": "長榮海運股份有限公司",
        "en_name": "Evergreen Marine",
        "sector": "航運",
        "weight": 0.47,
        "aliases": ["長榮海運", "Evergreen Marine", "貨櫃三雄"],
        "query_terms": ["長榮海運", "長榮海運 運價"],
        "driver": "SCFI 運價指數、紅海繞行、新造船交付、貨櫃供需",
    },
    {
        "ticker": "3231",
        "name": "緯創",
        "full_name": "緯創資通股份有限公司",
        "en_name": "Wistron",
        "sector": "電腦及週邊",
        "weight": 0.45,
        "aliases": ["緯創資通", "緯創", "Wistron"],
        "query_terms": ["緯創資通", "緯創 AI 伺服器"],
        "driver": "AI 伺服器板卡與系統、GPU 模組、子公司緯穎轉投資效益",
    },
    {
        "ticker": "2885",
        "name": "元大金",
        "full_name": "元大金融控股股份有限公司",
        "en_name": "Yuanta Financial",
        "sector": "金融保險",
        "weight": 0.42,
        "aliases": ["元大金", "元大金控", "元大證券", "元大投信", "Yuanta"],
        "query_terms": ["元大金控", "元大證券"],
        "driver": "台股成交量帶動的經紀手續費、ETF 規模、自營操作損益",
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
        assert s["name"] in s["aliases"], f"{s['ticker']} 的 name 必須也列在 aliases 裡"
        assert s["query_terms"], s["ticker"]
        assert len(s["name"]) >= 2, s["ticker"]
        for a in s["aliases"]:
            assert not a.isdigit(), f"{s['ticker']} 的 aliases 不應放純數字（代號另走正規式）"
    print(f"20 檔權值股，合計約占大盤 {total_weight()}%", file=sys.stderr)
    print(json.dumps([{"ticker": s["ticker"], "name": s["name"], "weight": s["weight"]}
                      for s in TOP20], ensure_ascii=False, indent=2))
