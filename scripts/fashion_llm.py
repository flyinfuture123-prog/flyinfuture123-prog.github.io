# -*- coding: utf-8 -*-
"""選用的 Claude 深度分析層（時尚站）。

規則式引擎（fashion_analyze.py）能判斷價格方向與題材，但讀不懂
「這件事對消費者荷包和趨勢意味著什麼」。當 repository secret 裡有
ANTHROPIC_API_KEY 時，這一層會把每則新聞再送給 Claude 逐則重寫分析；
沒有金鑰、套件沒裝、API 出錯、回傳解析不了 —— 任何一種情況都直接沿用
規則式結果，絕不讓整個排程失敗。

成本可控：預設只處理重要性最高的前 N 則（FASHION_LLM_MAX_ARTICLES），
模型也可用 FASHION_LLM_MODEL 覆寫。
"""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fashion_lexicon as lex  # noqa: E402

log = logging.getLogger("fashion_llm")

DEFAULT_MODEL = "claude-opus-5"
DEFAULT_BATCH = 10
DEFAULT_MAX_ARTICLES = 150

CATEGORY_IDS = [c["id"] for c in lex.CATEGORIES] + ["other"]
CATEGORY_LABELS = {c["id"]: c["label"] for c in lex.CATEGORIES}
CATEGORY_LABELS["other"] = "其他動態"
REGION_IDS = [r["id"] for r in lex.REGIONS] + [lex.DEFAULT_REGION["id"]]
REGION_LABELS = {r["id"]: r["label"] for r in lex.REGIONS}
REGION_LABELS[lex.DEFAULT_REGION["id"]] = lex.DEFAULT_REGION["label"]
TREND_IDS = [t["id"] for t in lex.TRENDS]

SYSTEM_PROMPT = """你是一位時尚產業分析師，替一份「全球服飾價格與時尚趨勢」的每日簡報逐則標註新聞。
讀者是台灣的一般消費者與時尚愛好者，關心「衣服、鞋子、包包會變貴還是變便宜」
以及「現在流行什麼、接下來會流行什麼」。請用繁體中文（台灣用語）作答。

對每一則新聞（標題可能是中文或英文），判斷：
1. price_score：對「消費者實際購買價格」的方向與強度，-100（明確降價／大促銷）
   到 +100（明確漲價／成本全面轉嫁）。注意慣用語：「凍漲」「吸收關稅」是不漲價、
   「取消折扣」「縮減促銷」是實質漲價、「調漲」「price hike」是漲價。
   趨勢報導、秀場報導、名人穿搭等與價格無關者，請給接近 0 的分數。
2. confidence：這個判斷的可信度 0.0-1.0。帶「傳」「恐」「reportedly」等推測語氣、
   或來源不明時，信心要明顯調低。
3. category：從給定的分類代碼中選一個最貼切的。
4. region：這則新聞主要涉及的地區代碼。
5. trend_tags：命中的趨勢標籤代碼（0-3 個），只在內容真的與該趨勢相關時才給。
6. importance：1-5。5 保留給會影響大量消費者的事件（大品牌全面調漲、重大關稅
   政策、指標性併購）；例行的單品促銷或名人穿搭給 1-2。
7. commentary：一到三句話的分析，說明「這對消費者或市場實際意味著什麼」，
   而不是複述標題。英文新聞請一併把重點用中文講清楚。
8. drivers：從標題／摘要中挑出 1-4 個關鍵詞（原文語言即可），作為判斷依據。
9. risk_flags：任何應提醒讀者的疑慮（例如「僅單一來源」「純屬市場傳聞」
   「數字未經品牌證實」）。沒有就給空陣列。

嚴格要求：
- 保持中立的資訊整理語氣。不要出現「建議購買／快搶／必買」這類促購字眼。
- 只根據提供的標題與摘要作答，不要編造原文沒有的數字、日期或事件。
- 每一則輸入都必須有一筆對應的輸出，id 原樣回傳，不可增刪。"""


def _client_and_key() -> Tuple[Optional[object], str]:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return None, ""
    try:
        import anthropic  # noqa: PLC0415
    except ImportError:
        log.warning("有 ANTHROPIC_API_KEY 但未安裝 anthropic 套件，改用規則式分析")
        return None, key
    try:
        return anthropic.Anthropic(api_key=key, max_retries=3, timeout=120.0), key
    except Exception as exc:  # noqa: BLE001
        log.warning("建立 Anthropic client 失敗：%s", exc)
        return None, key


def is_enabled() -> bool:
    client, _ = _client_and_key()
    return client is not None


def _schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "price_score": {"type": "integer", "minimum": -100, "maximum": 100},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "category": {"type": "string", "enum": CATEGORY_IDS},
                        "region": {"type": "string", "enum": REGION_IDS},
                        "trend_tags": {"type": "array",
                                       "items": {"type": "string", "enum": TREND_IDS}},
                        "importance": {"type": "integer", "minimum": 1, "maximum": 5},
                        "commentary": {"type": "string"},
                        "drivers": {"type": "array", "items": {"type": "string"}},
                        "risk_flags": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["id", "price_score", "confidence", "category", "region",
                                 "trend_tags", "importance", "commentary", "drivers",
                                 "risk_flags"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["results"],
        "additionalProperties": False,
    }


def _batch_payload(batch: List[dict]) -> str:
    from fashion_brands import BY_SLUG  # noqa: PLC0415

    items = []
    for a in batch:
        names = [BY_SLUG[s]["name"] for s in (a.get("brands") or []) if s in BY_SLUG]
        items.append({
            "id": a["id"],
            "title": a.get("title", ""),
            "summary": (a.get("summary") or "")[:300],
            "outlet": a.get("outlet", ""),
            "published": a.get("published", ""),
            "related_brands": names,
            "reported_by_n_outlets": a.get("dup_count", 1),
        })
    catalog = "\n".join(f"- {cid}：{CATEGORY_LABELS[cid]}" for cid in CATEGORY_IDS)
    regions = "\n".join(f"- {rid}：{REGION_LABELS[rid]}" for rid in REGION_IDS)
    trends = "\n".join(f"- {t['id']}：{t['label']}（{t['en']}）" for t in lex.TRENDS)
    return (f"可用的 category 代碼：\n{catalog}\n\n"
            f"可用的 region 代碼：\n{regions}\n\n"
            f"可用的 trend_tags 代碼：\n{trends}\n\n"
            f"請分析以下 {len(items)} 則新聞：\n"
            f"{json.dumps(items, ensure_ascii=False, indent=2)}")


def _call(client, model: str, effort: str, batch: List[dict]) -> Optional[List[dict]]:
    try:
        response = client.messages.create(
            model=model,
            max_tokens=16000,
            system=[{"type": "text", "text": SYSTEM_PROMPT,
                     "cache_control": {"type": "ephemeral"}}],
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": _schema()},
            },
            messages=[{"role": "user", "content": _batch_payload(batch)}],
        )
    except Exception as exc:  # noqa: BLE001 — 這層失敗只該降級，不該中斷排程
        log.warning("Claude 呼叫失敗（%s），這批改用規則式結果", exc)
        return None

    if getattr(response, "stop_reason", None) == "refusal":
        log.warning("Claude 拒絕回應這批新聞，改用規則式結果")
        return None

    text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    try:
        return json.loads(text)["results"]
    except (ValueError, KeyError, TypeError) as exc:
        log.warning("Claude 回傳無法解析（%s），這批改用規則式結果", exc)
        return None


def _merge(article: dict, item: dict) -> None:
    """把 Claude 的判斷覆寫上去，同時保留規則式結果供對照。"""
    rules = article["analysis"]
    score = max(-100, min(100, int(item.get("price_score", rules["price_score"]))))
    cat_id = item.get("category") or rules["category"]
    region_id = item.get("region") or rules["region"]
    tags = [t for t in (item.get("trend_tags") or []) if t in lex.TREND_BY_ID]
    article["analysis"] = {
        **rules,
        "price_score": score,
        "price_label": lex.price_label(score),
        "price_key": lex.price_key(score),
        "confidence": round(max(0.0, min(1.0, float(item.get("confidence",
                                                             rules["confidence"])))), 2),
        "category": cat_id,
        "category_label": CATEGORY_LABELS.get(cat_id, "其他動態"),
        "region": region_id,
        "region_label": REGION_LABELS.get(region_id, lex.DEFAULT_REGION["label"]),
        "trend_tags": tags or rules["trend_tags"],
        "importance": max(1, min(5, int(item.get("importance", rules["importance"])))),
        "commentary": (item.get("commentary") or "").strip() or rules["commentary"],
        "drivers": [{"term": d, "score": 0} for d in (item.get("drivers") or [])[:6]]
                   or rules["drivers"],
        "flags": list(dict.fromkeys((item.get("risk_flags") or []) + rules["flags"]))[:6],
        "engine": "claude",
        "rules_price_score": rules["price_score"],
        "rules_commentary": rules["commentary"],
    }


def enrich(articles: List[dict]) -> dict:
    """就地升級 articles 的分析內容，回傳這一層的執行狀況。"""
    status = {"enabled": False, "model": None, "attempted": 0, "upgraded": 0,
              "batches_failed": 0, "reason": ""}

    client, key = _client_and_key()
    if client is None:
        status["reason"] = "未設定 ANTHROPIC_API_KEY" if not key else "Anthropic client 無法建立"
        log.info("跳過 Claude 深度分析：%s", status["reason"])
        return status

    model = os.environ.get("FASHION_LLM_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    effort = os.environ.get("FASHION_LLM_EFFORT", "low").strip() or "low"
    batch_size = _int_env("FASHION_LLM_BATCH", DEFAULT_BATCH)
    max_articles = _int_env("FASHION_LLM_MAX_ARTICLES", DEFAULT_MAX_ARTICLES)

    # 先處理重要性高的，額度用完時被犧牲的是最不重要的那些。
    ordered = sorted(articles, key=lambda a: (-a["analysis"]["importance"],
                                              -abs(a["analysis"]["price_score"])))
    targets = ordered[:max_articles]
    by_id: Dict[str, dict] = {a["id"]: a for a in targets}

    status.update({"enabled": True, "model": model, "attempted": len(targets)})
    log.info("Claude 深度分析：%s（effort=%s）處理 %d/%d 則",
             model, effort, len(targets), len(articles))

    for start in range(0, len(targets), batch_size):
        batch = targets[start:start + batch_size]
        results = _call(client, model, effort, batch)
        if results is None:
            status["batches_failed"] += 1
            continue
        for item in results:
            article = by_id.get(str(item.get("id", "")))
            if article is None:
                continue
            try:
                _merge(article, item)
                status["upgraded"] += 1
            except (TypeError, ValueError) as exc:
                log.warning("合併 Claude 結果失敗（id=%s）：%s", item.get("id"), exc)

    log.info("Claude 深度分析完成：%d 則升級，%d 批失敗",
             status["upgraded"], status["batches_failed"])
    return status


def _int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, "").strip() or default))
    except ValueError:
        return default


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    print("Claude 深度分析：", "可用" if is_enabled() else "未啟用（將使用規則式分析）")
    print("預設模型：", os.environ.get("FASHION_LLM_MODEL", DEFAULT_MODEL))
    print("分類代碼：", ", ".join(CATEGORY_IDS))
    print("趨勢代碼：", ", ".join(TREND_IDS))
