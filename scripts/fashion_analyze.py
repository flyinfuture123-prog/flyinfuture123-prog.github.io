# -*- coding: utf-8 -*-
"""規則式的服飾新聞分析引擎。

對每一則新聞逐一判斷：價格方向與強度（漲價壓力 +100 ～ 降價壓力 -100）、
判斷信心、主題分類、地區、趨勢標籤、重要性，並產生一段中文分析說明。

與 analyze.py 同樣的設計前提：不依賴任何外部服務，沒有金鑰也每天跑得出來。
有 ANTHROPIC_API_KEY 時，fashion_llm.py 會在這個結果之上再疊一層。

趨勢類新聞多半沒有價格方向，分數接近 0 是正常狀態 —— 它們的價值由
trend_tags 與主題分類呈現，不是由方向分數。
"""

from __future__ import annotations

import math
import os
import re
import sys
import unicodedata
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fashion_lexicon as lex  # noqa: E402
from fashion_brands import BY_SLUG, segment_label  # noqa: E402

# 標題比摘要重要得多：標題本身就是結論。
TITLE_WEIGHT = 2.0
SUMMARY_WEIGHT = 0.8

# 反轉詞要緊貼在訊號詞前面才算數，隔太遠通常是兩件事。
NEGATION_WINDOW = 4
INTENSIFIER_WINDOW = 6

# 具體數字（漲幅、金額）讓報導更可信也更重要。
_NUM_MAGNITUDE = re.compile(
    r"(\d{1,3}(?:\.\d+)?\s*[%％]|\d+(?:\.\d+)?\s*[成倍]|\d[\d,.]*\s*(?:元|美元|歐元|日圓|日元|英鎊)"
    r"|[$€£¥]\s?\d)")
_MASK = "　"  # 用全形空白當遮罩，長度與被遮蔽的字元一致


def _norm(text: str) -> str:
    """NFKC + 小寫：英文詞庫收小寫，中文不受影響。

    彎引號要先折疊成直引號，否則 "won't raise prices" 這類否定片語
    在英文媒體慣用的 typographic apostrophe（'）下永遠比對不到，
    整句會反而被 "raise prices" 記成漲價。
    """
    folded = (text or "").replace("’", "'").replace("ʼ", "'")
    return unicodedata.normalize("NFKC", folded).lower()


# --------------------------------------------------------------------------
# 單一欄位的方向掃描
# --------------------------------------------------------------------------

def _scan(text: str) -> Tuple[float, float, List[dict]]:
    """回傳 (漲價分, 降價分, 命中明細)。"""
    if not text:
        return 0.0, 0.0, []
    working = _norm(text)
    hits: List[dict] = []
    up = down = 0.0

    # 1) 片語覆寫優先，命中後遮蔽，避免內含短詞重複計分。
    #    例：「取消折扣」不遮蔽的話會再被「折扣」抓一次而變成負分。
    #    片語也要吃反轉詞：「不打價格戰」不能被「價格戰」記成降價。
    for phrase, score, note in lex.PHRASE_OVERRIDES:
        p = phrase.lower()
        idx = working.find(p)
        while idx != -1:
            before = working[max(0, idx - NEGATION_WINDOW):idx]
            negated = any(n in before for n in lex.NEGATORS)
            signed = -score * 0.8 if negated else score
            hits.append({"term": phrase, "score": round(signed, 2), "kind": "phrase",
                         "note": note, "negated": negated})
            if signed > 0:
                up += signed
            elif signed < 0:
                down += -signed
            working = working[:idx] + _MASK * len(p) + working[idx + len(p):]
            idx = working.find(p)

    # 2) 一般詞彙。長詞優先並遮蔽，讓「售價調漲」不會再被「調漲」拆走。
    ordered = sorted(
        [(t, w, +1) for t, w in lex.UP.items()]
        + [(t, w, -1) for t, w in lex.DOWN.items()],
        key=lambda x: -len(x[0]),
    )
    for term, weight, sign in ordered:
        idx = working.find(term)
        if idx == -1:
            continue
        signed = sign * weight

        # 反轉詞（僅中文）：「取消漲價」「否認調漲」
        before = working[max(0, idx - NEGATION_WINDOW):idx]
        negated = any(n in before for n in lex.NEGATORS)
        if negated:
            signed = -signed * 0.8

        # 強化詞：「全面調漲」「sharply higher prices」。
        # 視窗依詞長放大：固定 6 字的視窗塞不下 "sharply "（8 字），
        # 英文強化詞會全部變成死條目。中文短詞維持原本的窄視窗行為。
        multiplier = 1.0
        for word, mult in lex.INTENSIFIERS.items():
            w = word.lower()
            span = max(INTENSIFIER_WINDOW, len(w) + 2)
            if w in working[max(0, idx - span):idx]:
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
            up += signed
        else:
            down += -signed
        working = working.replace(term, _MASK * len(term))

    return up, down, hits


_KW_RE_CACHE: Dict[str, "re.Pattern"] = {}


def _kw_in(kw: str, text: str) -> bool:
    """分類關鍵字比對：英文走字界（"sale" 不可誤中 "sales"／"wholesale"），
    中文沒有字界問題，照舊用子字串。"""
    if not kw.isascii():
        return kw in text
    rx = _KW_RE_CACHE.get(kw)
    if rx is None:
        rx = re.compile(r"\b" + re.escape(kw) + r"\b")
        _KW_RE_CACHE[kw] = rx
    return bool(rx.search(text))


def _classify(title: str, summary: str) -> dict:
    t, s = _norm(title), _norm(summary)
    best, best_score = None, 0.0
    scores: Dict[str, float] = {}
    for cat in lex.CATEGORIES:
        score = 0.0
        for kw in cat["keywords"]:
            k = kw.lower()
            if _kw_in(k, t):
                score += 2.0
            elif _kw_in(k, s):
                score += 0.7
        if score:
            scores[cat["id"]] = round(score, 2)
        if score > best_score:
            best, best_score = cat, score
    if best is None:
        best = {"id": "other", "label": "其他動態"}
    return {"id": best["id"], "label": best["label"], "scores": scores}


def _region(title: str, summary: str) -> dict:
    text = _norm(title) + " " + _norm(summary)
    for r in lex.REGIONS:
        if any(k.lower() in text for k in r["keywords"]):
            return {"id": r["id"], "label": r["label"]}
    return dict(lex.DEFAULT_REGION)


def _trend_tags(title: str, summary: str) -> List[str]:
    text = _norm(title) + " " + _norm(summary)
    tags = []
    for t in lex.TRENDS:
        if any(k.lower() in text for k in t["keywords"]):
            tags.append(t["id"])
    return tags


def _subject_brand(title: str, brands: List[str]) -> Optional[str]:
    """判斷誰是這則新聞的主角：品牌名出現在標題越前面，越可能是主角。"""
    head = _norm(title)[:24]
    best, best_pos = None, 999
    for slug in brands:
        brand = BY_SLUG.get(slug)
        if not brand:
            continue
        for name in [brand["name"]] + list(brand["aliases"]):
            pos = head.find(_norm(name))
            if pos != -1 and pos < best_pos:
                best, best_pos = slug, pos
    return best


# --------------------------------------------------------------------------
# 逐則分析
# --------------------------------------------------------------------------

def analyze_article(rec: dict) -> dict:
    title = rec.get("title", "")
    summary = rec.get("summary", "")

    t_up, t_down, t_hits = _scan(title)
    s_up, s_down, s_hits = _scan(summary)

    up = t_up * TITLE_WEIGHT + s_up * SUMMARY_WEIGHT
    down = t_down * TITLE_WEIGHT + s_down * SUMMARY_WEIGHT
    raw = up - down

    # tanh 讓極端值收斂；除數 12 是調出來的，太小會讓每則價格新聞都「明確」，
    # 「凍漲」這類溫和訊號也會被推進「明確降價」級距。
    price_score = int(round(100 * math.tanh(raw / 12.0)))

    cat = _classify(title, summary)
    region = _region(title, summary)
    trend_tags = _trend_tags(title, summary)
    tier = int(rec.get("outlet_tier", 3))
    dup = int(rec.get("dup_count", 1))
    norm_title = _norm(title)
    norm_summary = _norm(summary)
    hedges = [h for h in lex.HEDGES if h.lower() in norm_title]
    hedges_body = [h for h in lex.HEDGES if h.lower() in norm_summary]
    # 「傳○○調漲」的句首「傳」是最常見的傳聞句型，但單字「傳」放進詞庫
    # 會誤中宣傳/傳統/傳承，所以只認句首、且排除以傳開頭的常用詞。
    if re.match(r"^傳(?!統|承|奇|遞|人|授|播|媒|產)", norm_title):
        hedges.append("傳")
    has_number = bool(_NUM_MAGNITUDE.search(
        unicodedata.normalize("NFKC", title) + " " + unicodedata.normalize("NFKC", summary)))

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
    conflict = bool(up and down) and min(up, down) / max(up, down) > 0.6
    if conflict:
        conf -= 0.15
    if not distinct:
        conf = min(conf, 0.30)
    confidence = round(max(0.12, min(0.95, conf)), 2)

    # ---- 重要性 ----
    subject = _subject_brand(title, rec.get("brands") or [])
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
    if abs(price_score) >= 50:
        imp += 0.3
    if trend_tags:
        imp += 0.3
    if tier == 3 and dup == 1:
        imp -= 0.8
    importance = max(1, min(5, int(round(imp))))
    # 5/5 要留給真正有份量的事：得有具體數字、多家跟進，或本身就是價格事件。
    if importance == 5 and not (has_number or high_impact or dup >= 3):
        importance = 4
    # 讀不出方向也沒有趨勢標籤的新聞，再怎麼樣也不該排到最前面。
    if not distinct and not trend_tags:
        importance = min(importance, 3)

    # ---- 風險標記 ----
    flags = []
    if hedges or hedges_body:
        flags.append("推測性報導")
    if dup == 1 and tier == 3:
        flags.append("單一非主流來源")
    if conflict:
        flags.append("漲跌訊號混雜")
    if any(h.get("negated") for h in t_hits + s_hits):
        flags.append("含語意反轉")

    drivers = sorted(
        [h for h in t_hits + s_hits if h["score"] != 0],
        key=lambda h: -abs(h["score"]),
    )[:6]

    result = {
        "price_score": price_score,
        "price_label": lex.price_label(price_score),
        "price_key": lex.price_key(price_score),
        "confidence": confidence,
        "category": cat["id"],
        "category_label": cat["label"],
        "region": region["id"],
        "region_label": region["label"],
        "trend_tags": trend_tags,
        "importance": importance,
        "subject_brand": subject,
        "drivers": [{"term": d["term"], "score": d["score"]} for d in drivers],
        "flags": flags,
        "engine": "rules",
        "raw_score": round(raw, 2),
    }
    result["commentary"] = _commentary(rec, result)
    return result


def _commentary(rec: dict, a: dict) -> str:
    """把判斷依據寫成人看得懂的一段話。"""
    brand_names = [BY_SLUG[s]["name"] for s in (rec.get("brands") or []) if s in BY_SLUG]
    subject = (BY_SLUG[a["subject_brand"]]["name"] if a.get("subject_brand")
               else (brand_names[0] if brand_names else ""))

    parts = []
    terms = [d["term"] for d in a["drivers"][:3]]
    if a["price_key"] != "flat" and terms:
        direction = "漲價／成本上行" if a["price_key"] == "up" else "降價／促銷"
        parts.append(f"標題與內文出現「{'」「'.join(terms)}」等訊號，判定為{direction}方向"
                     f"（價格訊號 {a['price_score']:+d}、信心 {int(a['confidence'] * 100)}%）。")
    elif terms:
        parts.append(f"偵測到「{'」「'.join(terms)}」等價格相關用詞，但整體方向不明確，"
                     f"列為價格中性（信心 {int(a['confidence'] * 100)}%）。")
    else:
        parts.append("未偵測到明確的價格方向詞，屬於非價格類報導。")

    tag_labels = [lex.TREND_BY_ID[t]["label"] for t in a["trend_tags"][:3]
                  if t in lex.TREND_BY_ID]
    if tag_labels:
        parts.append(f"命中趨勢標籤「{'」「'.join(tag_labels)}」。")

    scope = f"，主要與{subject}相關" if subject else ""
    parts.append(f"題材屬「{a['category_label']}」，地區為{a['region_label']}{scope}。")

    others = [n for n in brand_names if n != subject][:3]
    if others:
        parts.append(f"同時提及{'、'.join(others)}。")

    dup = int(rec.get("dup_count", 1))
    outlet = rec.get("outlet") or "未標示媒體"
    if dup >= 3:
        parts.append(f"{outlet}等 {dup} 家媒體同步報導，關注度高。")
    elif dup == 2:
        parts.append(f"{outlet}等 2 家媒體報導。")
    else:
        parts.append(f"目前僅見於{outlet}。")

    if "推測性報導" in a["flags"]:
        parts.append("內容帶有推測語氣，品牌正式公告前不宜過度解讀。")
    if "漲跌訊號混雜" in a["flags"]:
        parts.append("同一則同時出現漲跌描述，方向判讀的可靠度較低。")

    parts.append(f"重要性 {a['importance']}/5。")
    return "".join(parts)


# --------------------------------------------------------------------------
# 品牌彙總
# --------------------------------------------------------------------------

def aggregate_brand(slug: str, articles: List[dict]) -> dict:
    brand = BY_SLUG[slug]
    mine = [a for a in articles if slug in (a.get("brands") or [])]
    mine.sort(key=lambda a: (-a["analysis"]["importance"], -a.get("published_ts", 0)))

    counts = {"up": 0, "down": 0, "flat": 0}
    weighted_sum = weight_total = 0.0
    cat_counts: Dict[str, int] = {}
    heat = 0.0
    for a in mine:
        an = a["analysis"]
        counts[an["price_key"]] += 1
        w = an["importance"] * an["confidence"]
        weighted_sum += an["price_score"] * w
        weight_total += w
        heat += an["importance"]
        cat_counts[an["category_label"]] = cat_counts.get(an["category_label"], 0) + 1

    score = int(round(weighted_sum / weight_total)) if weight_total else 0
    top_cats = sorted(cat_counts.items(), key=lambda kv: -kv[1])[:3]

    return {
        "slug": slug,
        "name": brand["name"],
        "en_name": brand["en_name"],
        "segment": brand["segment"],
        "segment_label": segment_label(brand["segment"]),
        "hq": brand["hq"],
        "prominence": brand["prominence"],
        "driver": brand["driver"],
        "article_count": len(mine),
        "price_score": score,
        "price_label": lex.price_label(score),
        "price_key": lex.price_key(score),
        "heat": round(heat, 1),
        "counts": counts,
        "top_categories": [{"label": c, "count": n} for c, n in top_cats],
        "article_ids": [a["id"] for a in mine],
        "headline": mine[0]["title"] if mine else "",
        "summary_text": _brand_commentary(brand, mine, counts, score, top_cats),
    }


def _brand_commentary(brand: dict, mine: List[dict], counts: dict,
                      score: int, top_cats: List[Tuple[str, int]]) -> str:
    if not mine:
        return (f"本期未擷取到{brand['name']}的相關新聞。無聞即無事，"
                f"但也可能是關鍵字未涵蓋，可留意{brand['driver']}等既有觀察重點。")

    parts = [f"共 {len(mine)} 則相關新聞，其中漲價訊號 {counts['up']} 則、"
             f"降價促銷 {counts['down']} 則、價格中性 {counts['flat']} 則。"]
    if top_cats:
        parts.append("題材集中在「" + "」「".join(c for c, _ in top_cats) + "」。")

    top = mine[0]
    parts.append(f"份量最重的一則是〈{top['title']}〉"
                 f"（{top['analysis']['price_label']}、重要性 "
                 f"{top['analysis']['importance']}/5）。")

    if score >= 15:
        tone = "價格面偏向上行，購買該品牌可留意調價時點"
    elif score <= -15:
        tone = "價格面偏向下行，折扣與促銷活動較多"
    else:
        tone = "新聞面沒有明確的價格方向"
    parts.append(f"加權後綜合價格訊號 {score:+d}（{lex.price_label(score)}）—— {tone}。")
    return "".join(parts)


# --------------------------------------------------------------------------
# 趨勢雷達
# --------------------------------------------------------------------------

def trend_board(articles: List[dict]) -> List[dict]:
    """每個趨勢標籤的熱度：則數、加權熱度、代表新聞。"""
    out = []
    for t in lex.TRENDS:
        mine = [a for a in articles if t["id"] in a["analysis"]["trend_tags"]]
        mine.sort(key=lambda a: (-a["analysis"]["importance"], -a.get("published_ts", 0)))
        heat = sum(a["analysis"]["importance"] for a in mine)
        out.append({
            "id": t["id"],
            "label": t["label"],
            "en": t["en"],
            "status": t["status"],
            "status_label": lex.TREND_STATUS_LABEL[t["status"]],
            "note": t["note"],
            "article_count": len(mine),
            "heat": heat,
            "article_ids": [a["id"] for a in mine[:8]],
        })
    out.sort(key=lambda x: (-x["heat"], -x["article_count"]))
    return out


# --------------------------------------------------------------------------
# 全站快報
# --------------------------------------------------------------------------

def daily_brief(brand_summaries: List[dict], trends: List[dict],
                articles: List[dict]) -> dict:
    # 價格壓力指數：只看價格相關題材的新聞，依重要性 × 信心加權。
    price_arts = [a for a in articles
                  if a["analysis"]["category"] in ("pricing", "cost_supply")
                  or a["analysis"]["price_key"] != "flat"]
    wsum = wtot = 0.0
    counts = {"up": 0, "down": 0, "flat": 0}
    for a in price_arts:
        an = a["analysis"]
        counts[an["price_key"]] += 1
        w = an["importance"] * an["confidence"]
        wsum += an["price_score"] * w
        wtot += w
    pressure = int(round(wsum / wtot)) if wtot else 0

    covered = [b for b in brand_summaries if b["article_count"] > 0]
    hottest_brands = sorted(covered, key=lambda b: -b["heat"])[:3]
    up_brands = sorted([b for b in covered if b["price_score"] >= 15],
                       key=lambda b: -b["price_score"])[:3]
    down_brands = sorted([b for b in covered if b["price_score"] <= -15],
                         key=lambda b: b["price_score"])[:3]

    hot_trends = [t for t in trends if t["article_count"] > 0][:5]

    top_articles = sorted(
        articles,
        key=lambda a: (-a["analysis"]["importance"],
                       -abs(a["analysis"]["price_score"]),
                       -a.get("published_ts", 0)),
    )[:8]

    cat_counts: Dict[str, int] = {}
    region_counts: Dict[str, int] = {}
    for a in articles:
        an = a["analysis"]
        cat_counts[an["category_label"]] = cat_counts.get(an["category_label"], 0) + 1
        region_counts[an["region_label"]] = region_counts.get(an["region_label"], 0) + 1
    themes = sorted(cat_counts.items(), key=lambda kv: -kv[1])[:5]
    regions = sorted(region_counts.items(), key=lambda kv: -kv[1])

    text_parts = [
        f"本期共分析 {len(articles)} 則新聞，涵蓋 {len(covered)} 個觀察品牌／板塊。",
        f"價格相關報導中，漲價訊號 {counts['up']} 則、降價促銷 {counts['down']} 則，"
        f"加權後的整體價格壓力為 {pressure:+d}（{lex.price_label(pressure)}）。",
    ]
    if up_brands:
        text_parts.append("漲價訊號最明顯的是"
                          + "、".join(f"{b['name']}（{b['price_score']:+d}）"
                                      for b in up_brands) + "。")
    if down_brands:
        text_parts.append("折扣與降價集中在"
                          + "、".join(f"{b['name']}（{b['price_score']:+d}）"
                                      for b in down_brands) + "。")
    if hot_trends:
        text_parts.append("趨勢雷達上最熱的是「"
                          + "」「".join(t["label"] for t in hot_trends[:3]) + "」。")
    if themes:
        text_parts.append("報導題材以「" + "」「".join(t for t, _ in themes[:3]) + "」為主。")

    return {
        "price_pressure": pressure,
        "price_pressure_label": lex.price_label(pressure),
        "price_pressure_key": lex.price_key(pressure),
        "price_counts": counts,
        "covered_brands": len(covered),
        "hottest_brands": [{"slug": b["slug"], "name": b["name"], "heat": b["heat"],
                            "price_score": b["price_score"]} for b in hottest_brands],
        "up_brands": [{"slug": b["slug"], "name": b["name"],
                       "price_score": b["price_score"]} for b in up_brands],
        "down_brands": [{"slug": b["slug"], "name": b["name"],
                         "price_score": b["price_score"]} for b in down_brands],
        "hot_trends": [{"id": t["id"], "label": t["label"], "count": t["article_count"],
                        "status": t["status"]} for t in hot_trends],
        "themes": [{"label": t, "count": n} for t, n in themes],
        "regions": [{"label": r, "count": n} for r, n in regions],
        "top_article_ids": [a["id"] for a in top_articles],
        "text": "".join(text_parts),
    }


def analyze_all(articles: List[dict]) -> List[dict]:
    for a in articles:
        a["analysis"] = analyze_article(a)
    return articles


if __name__ == "__main__":
    samples = [
        {"title": "UNIQLO宣布秋冬全面調漲 平均漲幅8% 反映棉價與運費",
         "summary": "迅銷表示成本壓力難以吸收。", "outlet": "經濟日報", "outlet_tier": 1,
         "dup_count": 4, "brands": ["uniqlo"]},
        {"title": "傳香奈兒經典包再度調漲 幅度恐達一成",
         "summary": "市場消息尚未獲品牌證實。", "outlet": "某時尚網",
         "outlet_tier": 3, "dup_count": 1, "brands": ["chanel"]},
        {"title": "ZARA年終出清5折起 換季拍賣開跑", "summary": "",
         "outlet": "ETtoday", "outlet_tier": 2, "dup_count": 2, "brands": ["zara"]},
        {"title": "Nike to raise prices on sneakers as tariffs bite",
         "summary": "The company will pass on costs to consumers.",
         "outlet": "Reuters", "outlet_tier": 1, "dup_count": 3, "brands": ["nike"]},
        {"title": "波希米亞風回歸 2026秋冬十大趨勢盤點", "summary": "",
         "outlet": "Vogue", "outlet_tier": 2, "dup_count": 1, "brands": []},
        {"title": "H&M凍漲基本款 吸收關稅成本", "summary": "",
         "outlet": "工商時報", "outlet_tier": 1, "dup_count": 2, "brands": ["hm"]},
    ]
    for s in samples:
        s["id"] = "x"
        r = analyze_article(s)
        print(f"\n{s['title']}")
        print(f"  {r['price_score']:+4d} {r['price_label']:<8} "
              f"conf={r['confidence']:.2f} imp={r['importance']} "
              f"cat={r['category_label']} region={r['region_label']} "
              f"trends={r['trend_tags']} flags={r['flags']}")
        print(f"  {r['commentary']}")
