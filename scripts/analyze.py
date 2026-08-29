# -*- coding: utf-8 -*-
"""規則式新聞分析引擎。

對每一則新聞逐一判斷：情緒方向與強度、判斷信心、主題分類、影響時間、
重要性，並產生一段說明「為什麼這樣判斷」的中文分析。

設計上刻意不依賴任何外部服務 —— 這是預設路徑，必須在沒有任何金鑰、
沒有任何額度的情況下每天都跑得出來。有 ANTHROPIC_API_KEY 時，llm.py
會在這個結果之上再疊一層更細緻的分析。
"""

from __future__ import annotations

import math
import os
import re
import sys
import unicodedata
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lexicon as lex  # noqa: E402
from stocks import BY_TICKER  # noqa: E402

# 標題比摘要重要得多：台灣財經標題本身就是結論。
TITLE_WEIGHT = 2.0
SUMMARY_WEIGHT = 0.8

# 反轉詞要緊貼在情緒詞前面才算數，隔太遠通常是兩件事。
NEGATION_WINDOW = 4
INTENSIFIER_WINDOW = 5

_NUM_MAGNITUDE = re.compile(
    r"(\d{2,}(?:\.\d+)?\s*[%％]|\d+(?:\.\d+)?\s*[成倍]|\d+(?:\.\d+)?\s*[億兆])")
_MASK = "　"  # 用全形空白當遮罩，長度與被遮蔽的中文字一致


def _norm(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "")


# --------------------------------------------------------------------------
# 單一欄位的情緒掃描
# --------------------------------------------------------------------------

def _scan(text: str) -> Tuple[float, float, List[dict]]:
    """回傳 (利多分, 利空分, 命中明細)。"""
    if not text:
        return 0.0, 0.0, []
    working = _norm(text)
    hits: List[dict] = []
    bull = bear = 0.0

    # 1) 片語覆寫優先。命中後把該片語遮蔽，避免內含的短詞被重複計算。
    #    例：「利空出盡」若不遮蔽，會再被「利空」抓一次而變成負分。
    for phrase, score, note in lex.PHRASE_OVERRIDES:
        idx = working.find(phrase)
        while idx != -1:
            hits.append({"term": phrase, "score": score, "kind": "phrase", "note": note})
            if score > 0:
                bull += score
            elif score < 0:
                bear += -score
            working = working[:idx] + _MASK * len(phrase) + working[idx + len(phrase):]
            idx = working.find(phrase)

    # 2) 一般詞彙。長詞優先，同樣遮蔽，讓「營收創新高」不會再被「營收」拆走。
    ordered = sorted(
        [(t, w, +1) for t, w in lex.BULLISH.items()]
        + [(t, w, -1) for t, w in lex.BEARISH.items()],
        key=lambda x: -len(x[0]),
    )
    for term, weight, sign in ordered:
        idx = working.find(term)
        if idx == -1:
            continue
        signed = sign * weight

        # 反轉詞：「未能突破」「訂單取消」
        before = working[max(0, idx - NEGATION_WINDOW):idx]
        negated = any(n in before for n in lex.NEGATORS)
        if negated:
            signed = -signed * 0.8

        # 強化詞：「大幅調升」「暴增」
        window = working[max(0, idx - INTENSIFIER_WINDOW):idx]
        multiplier = 1.0
        for word, mult in lex.INTENSIFIERS.items():
            if word in window:
                multiplier = max(multiplier, mult)
        signed *= multiplier

        hits.append({
            "term": term,
            "score": round(signed, 2),
            "kind": "term",
            "negated": negated,
            "intensified": multiplier > 1.0,
        })
        if signed > 0:
            bull += signed
        else:
            bear += -signed
        # 每個詞在同一欄位只計一次
        working = working.replace(term, _MASK * len(term))

    return bull, bear, hits


def _classify(title: str, summary: str) -> dict:
    t, s = _norm(title), _norm(summary)
    best, best_score = None, 0.0
    scores: Dict[str, float] = {}
    for cat in lex.CATEGORIES:
        score = 0.0
        for kw in cat["keywords"]:
            k = _norm(kw)
            if not k:
                continue
            if k in t:
                score += 2.0
            elif k in s:
                score += 0.7
        if score:
            scores[cat["id"]] = round(score, 2)
        if score > best_score:
            best, best_score = cat, score
    if best is None:
        best = {"id": "other", "label": "其他動態", "horizon": "中期"}
    return {"id": best["id"], "label": best["label"], "horizon": best["horizon"],
            "scores": scores}


_SHORT_HORIZON = ("今日", "盤中", "盤後", "單日", "收盤", "開盤", "早盤", "本週", "隔日")
_LONG_HORIZON = ("明年", "未來三年", "未來五年", "長期", "五年", "十年", "藍圖", "願景")


def _horizon(title: str, summary: str, default: str) -> str:
    text = _norm(title) + _norm(summary)
    if any(k in text for k in _LONG_HORIZON):
        return "長期"
    if any(k in text for k in _SHORT_HORIZON):
        return "短期"
    return default


def _subject_ticker(title: str, tickers: List[str]) -> Optional[str]:
    """判斷誰是這則新聞的主角：公司名出現在標題越前面，越可能是主角。"""
    head = _norm(title)[:16]
    best, best_pos = None, 999
    for tk in tickers:
        stock = BY_TICKER.get(tk)
        if not stock:
            continue
        for name in [stock["name"]] + list(stock["aliases"]):
            pos = head.find(_norm(name))
            if pos != -1 and pos < best_pos:
                best, best_pos = tk, pos
    return best


# --------------------------------------------------------------------------
# 逐則分析
# --------------------------------------------------------------------------

def analyze_article(rec: dict) -> dict:
    title = rec.get("title", "")
    summary = rec.get("summary", "")

    t_bull, t_bear, t_hits = _scan(title)
    s_bull, s_bear, s_hits = _scan(summary)

    bull = t_bull * TITLE_WEIGHT + s_bull * SUMMARY_WEIGHT
    bear = t_bear * TITLE_WEIGHT + s_bear * SUMMARY_WEIGHT
    raw = bull - bear

    # tanh 讓極端值收斂：一則新聞塞十個利多詞，也不該比真正的漲停新聞更多。
    # 除數 12 是調出來的 —— 太小的話幾乎每則都會頂到「強力」，級距就失去意義。
    sentiment = int(round(100 * math.tanh(raw / 12.0)))

    cat = _classify(title, summary)
    horizon = _horizon(title, summary, cat["horizon"])
    tier = int(rec.get("outlet_tier", 3))
    dup = int(rec.get("dup_count", 1))
    hedges = [h for h in lex.HEDGES if h in _norm(title)]
    hedges_body = [h for h in lex.HEDGES if h in _norm(summary)]
    has_number = bool(_NUM_MAGNITUDE.search(_norm(title) + " " + _norm(summary)))

    # ---- 信心度 ----
    distinct = {h["term"] for h in t_hits + s_hits}
    conf = 0.35 + 0.10 * min(len(distinct), 4)
    conf += {1: 0.10, 2: 0.05}.get(tier, 0.0)
    if has_number:
        conf += 0.08
    if dup >= 3:
        conf += 0.05
    if hedges:
        conf -= 0.20
    elif hedges_body:
        conf -= 0.10
    conflict = bool(bull and bear) and min(bull, bear) / max(bull, bear) > 0.6
    if conflict:
        conf -= 0.15
    if not distinct:
        conf = min(conf, 0.30)
    confidence = round(max(0.12, min(0.95, conf)), 2)

    # ---- 重要性 ----
    subject = _subject_ticker(title, rec.get("tickers") or [])
    imp = 1.8
    imp += {1: 1.0, 2: 0.4}.get(tier, 0.0)
    imp += 0.8 if dup >= 3 else (0.4 if dup == 2 else 0.0)
    high_impact = cat["id"] in lex.HIGH_IMPACT_CATEGORIES
    if high_impact:
        imp += 0.8
    if subject:
        imp += 0.7
    if has_number:
        imp += 0.6
    if abs(sentiment) >= 50:
        imp += 0.3
    if tier == 3 and dup == 1:
        imp -= 0.8
    importance = max(1, min(5, int(round(imp))))
    # 5/5 要留給真正有份量的事：得有具體數字、多家跟進，或本身就是重大事件類型。
    if importance == 5 and not (has_number or high_impact or dup >= 3):
        importance = 4
    # 完全讀不出方向的新聞，再怎麼樣也不該排到最前面。
    if not distinct:
        importance = min(importance, 3)

    # ---- 風險標記 ----
    flags = []
    if hedges or hedges_body:
        flags.append("推測性報導")
    if dup == 1 and tier == 3:
        flags.append("單一非主流來源")
    if conflict:
        flags.append("多空訊號混雜")
    if not distinct:
        flags.append("無明確方向詞")
    if any(h.get("negated") for h in t_hits + s_hits):
        flags.append("含語意反轉")

    # 同一個詞在標題和摘要各命中一次，會變成「出現『大賺』『大賺』等訊號」，
    # 讀起來像壞掉。每個詞只留分數絕對值最大的那一次。
    best_by_term: Dict[str, dict] = {}
    for h in t_hits + s_hits:
        if h["score"] == 0:
            continue
        prev = best_by_term.get(h["term"])
        if prev is None or abs(h["score"]) > abs(prev["score"]):
            best_by_term[h["term"]] = h
    drivers = sorted(best_by_term.values(), key=lambda h: -abs(h["score"]))[:6]

    result = {
        "sentiment": sentiment,
        "sentiment_label": lex.sentiment_label(sentiment),
        "sentiment_key": lex.sentiment_key(sentiment),
        "confidence": confidence,
        "category": cat["id"],
        "category_label": cat["label"],
        "horizon": horizon,
        "importance": importance,
        "subject_ticker": subject,
        "drivers": [{"term": d["term"], "score": d["score"]} for d in drivers],
        "flags": flags,
        "engine": "rules",
        "raw_score": round(raw, 2),
    }
    result["commentary"] = _commentary(rec, result)
    return result


def _commentary(rec: dict, a: dict) -> str:
    """把判斷依據寫成人看得懂的一段話，而不是只丟一個分數。"""
    stock_names = [BY_TICKER[t]["name"] for t in (rec.get("tickers") or []) if t in BY_TICKER]
    subject = (BY_TICKER[a["subject_ticker"]]["name"] if a.get("subject_ticker")
               else (stock_names[0] if stock_names else "相關個股"))

    parts = []
    terms = [d["term"] for d in a["drivers"][:3]]
    if terms:
        parts.append(f"標題與內文出現「{'」「'.join(terms)}」等訊號，判定為{a['sentiment_label']}"
                     f"（情緒 {a['sentiment']:+d}、信心 {int(a['confidence'] * 100)}%）。")
    else:
        parts.append(f"未偵測到明確的多空用詞，暫列{a['sentiment_label']}"
                     f"（信心 {int(a['confidence'] * 100)}%），建議以原文為準。")

    parts.append(f"題材屬「{a['category_label']}」，對{subject}的影響多反映在{a['horizon']}。")

    if len(stock_names) > 1:
        others = [n for n in stock_names if n != subject][:3]
        if others:
            parts.append(f"同時牽動{'、'.join(others)}。")

    dup = int(rec.get("dup_count", 1))
    outlet = rec.get("outlet") or "未標示媒體"
    if dup >= 3:
        parts.append(f"{outlet}等 {dup} 家媒體同步報導，市場關注度高。")
    elif dup == 2:
        parts.append(f"{outlet}等 2 家媒體報導。")
    else:
        parts.append(f"目前僅見於{outlet}。")

    if "推測性報導" in a["flags"]:
        parts.append("內容帶有「傳／可望／恐」等推測語氣，正式公告前不宜過度解讀。")
    if "多空訊號混雜" in a["flags"]:
        parts.append("同一則同時出現多空描述，方向判讀的可靠度較低。")

    parts.append(f"重要性 {a['importance']}/5。")
    return "".join(parts)


# --------------------------------------------------------------------------
# 個股彙總
# --------------------------------------------------------------------------

def aggregate_stock(ticker: str, articles: List[dict]) -> dict:
    stock = BY_TICKER[ticker]
    mine = [a for a in articles if ticker in (a.get("tickers") or [])]
    mine.sort(key=lambda a: (-a["analysis"]["importance"], -a.get("published_ts", 0)))

    counts = {"bull": 0, "bear": 0, "flat": 0}
    weighted_sum = weight_total = 0.0
    cat_counts: Dict[str, int] = {}
    for a in mine:
        an = a["analysis"]
        counts[an["sentiment_key"]] += 1
        w = an["importance"] * an["confidence"]
        weighted_sum += an["sentiment"] * w
        weight_total += w
        cat_counts[an["category_label"]] = cat_counts.get(an["category_label"], 0) + 1

    score = int(round(weighted_sum / weight_total)) if weight_total else 0
    top_cats = sorted(cat_counts.items(), key=lambda kv: -kv[1])[:3]

    return {
        "ticker": ticker,
        "name": stock["name"],
        "full_name": stock["full_name"],
        "sector": stock["sector"],
        "weight": stock["weight"],
        "driver": stock["driver"],
        "article_count": len(mine),
        "sentiment": score,
        "sentiment_label": lex.sentiment_label(score),
        "sentiment_key": lex.sentiment_key(score),
        "temperature": int(round((score + 100) / 2)),
        "counts": counts,
        "top_categories": [{"label": c, "count": n} for c, n in top_cats],
        "article_ids": [a["id"] for a in mine],
        "headline": mine[0]["title"] if mine else "",
        "summary_text": _stock_commentary(stock, mine, counts, score, top_cats),
    }


def _stock_commentary(stock: dict, mine: List[dict], counts: dict,
                      score: int, top_cats: List[Tuple[str, int]]) -> str:
    if not mine:
        return (f"今日未擷取到{stock['name']}的相關新聞。無聞即無事，"
                f"但也可能是關鍵字未涵蓋，可留意{stock['driver']}等既有觀察重點。")

    parts = [f"共 {len(mine)} 則相關新聞，其中偏多 {counts['bull']} 則、"
             f"偏空 {counts['bear']} 則、中性 {counts['flat']} 則。"]
    if top_cats:
        parts.append("題材集中在「" + "」「".join(c for c, _ in top_cats) + "」。")

    top = mine[0]
    parts.append(f"份量最重的一則是〈{top['title']}〉"
                 f"（{top['analysis']['sentiment_label']}、重要性 "
                 f"{top['analysis']['importance']}/5）。")

    if score >= 15:
        tone = "新聞面偏向正向，但仍需確認是否已反映在股價"
    elif score <= -15:
        tone = "新聞面偏向負向，留意賣壓與後續澄清"
    else:
        tone = "多空訊息互見，新聞面未給出明確方向"
    parts.append(f"加權後綜合情緒 {score:+d}（{lex.sentiment_label(score)}）—— {tone}。")
    return "".join(parts)


# --------------------------------------------------------------------------
# 大盤層級
# --------------------------------------------------------------------------

def market_brief(stock_summaries: List[dict], articles: List[dict]) -> dict:
    scored = [s for s in stock_summaries if s["article_count"] > 0]
    if scored:
        wsum = sum(s["sentiment"] * s["weight"] for s in scored)
        wtot = sum(s["weight"] for s in scored)
        index_sentiment = int(round(wsum / wtot)) if wtot else 0
    else:
        index_sentiment = 0

    ranked = sorted(scored, key=lambda s: -s["sentiment"])
    strongest = [{"ticker": s["ticker"], "name": s["name"], "sentiment": s["sentiment"]}
                 for s in ranked[:3]]
    weakest = [{"ticker": s["ticker"], "name": s["name"], "sentiment": s["sentiment"]}
               for s in ranked[-3:][::-1]]

    top_articles = sorted(
        articles,
        key=lambda a: (-a["analysis"]["importance"],
                       -abs(a["analysis"]["sentiment"]),
                       -a.get("published_ts", 0)),
    )[:8]

    cat_counts: Dict[str, int] = {}
    for a in articles:
        label = a["analysis"]["category_label"]
        cat_counts[label] = cat_counts.get(label, 0) + 1
    themes = sorted(cat_counts.items(), key=lambda kv: -kv[1])[:5]

    text_parts = [
        f"今日共分析 {len(articles)} 則新聞，涵蓋 20 檔權值股中的 {len(scored)} 檔。",
        f"依權重加權後的整體新聞情緒為 {index_sentiment:+d}"
        f"（{lex.sentiment_label(index_sentiment)}）。",
    ]
    pos = [s for s in strongest if s["sentiment"] > 0]
    neg = [s for s in weakest if s["sentiment"] < 0]
    if pos:
        text_parts.append("新聞面最強的是"
                          + "、".join(f"{s['name']}（{s['sentiment']:+d}）" for s in pos) + "。")
    if neg:
        text_parts.append("最弱的是"
                          + "、".join(f"{s['name']}（{s['sentiment']:+d}）" for s in neg) + "。")
    if themes:
        text_parts.append("主導題材為「" + "」「".join(t for t, _ in themes[:3]) + "」。")

    return {
        "sentiment": index_sentiment,
        "sentiment_label": lex.sentiment_label(index_sentiment),
        "sentiment_key": lex.sentiment_key(index_sentiment),
        "temperature": int(round((index_sentiment + 100) / 2)),
        "covered_stocks": len(scored),
        "strongest": strongest,
        "weakest": weakest,
        "themes": [{"label": t, "count": n} for t, n in themes],
        "top_article_ids": [a["id"] for a in top_articles],
        "text": "".join(text_parts),
    }


def analyze_all(articles: List[dict]) -> List[dict]:
    for a in articles:
        a["analysis"] = analyze_article(a)
    return articles


if __name__ == "__main__":
    samples = [
        {"title": "台積電法說會上修全年財測 CoWoS產能明年再翻倍",
         "summary": "外資調升目標價。", "outlet": "經濟日報", "outlet_tier": 1,
         "dup_count": 4, "tickers": ["2330"]},
        {"title": "傳鴻海遭客戶砍單 12月營收恐月減兩成",
         "summary": "市場傳出北美客戶調整拉貨節奏。", "outlet": "某財經網",
         "outlet_tier": 3, "dup_count": 1, "tickers": ["2317"]},
        {"title": "聯發科利空出盡 法人喊進", "summary": "",
         "outlet": "工商時報", "outlet_tier": 1, "dup_count": 2, "tickers": ["2454"]},
        {"title": "廣達未能突破前高 賣壓沉重", "summary": "",
         "outlet": "自由時報", "outlet_tier": 2, "dup_count": 1, "tickers": ["2382"]},
        {"title": "中華電信宣布配息創新高 殖利率逾4%", "summary": "",
         "outlet": "中央社", "outlet_tier": 1, "dup_count": 3, "tickers": ["2412"]},
        {"title": "台達電第三季法說會登場", "summary": "",
         "outlet": "中央社", "outlet_tier": 1, "dup_count": 1, "tickers": ["2308"]},
    ]
    for s in samples:
        s["id"] = "x"
        r = analyze_article(s)
        print(f"\n{s['title']}")
        print(f"  {r['sentiment']:+4d} {r['sentiment_label']:<4} "
              f"conf={r['confidence']:.2f} imp={r['importance']} "
              f"cat={r['category_label']} horizon={r['horizon']} flags={r['flags']}")
        print(f"  {r['commentary']}")
