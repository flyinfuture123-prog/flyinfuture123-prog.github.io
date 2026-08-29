# -*- coding: utf-8 -*-
"""中文標題正規化與近似去重。

同一則通訊社稿會被十幾家媒體原文照登，標題往往只差幾個字
（多一個【快訊】、少一個公司全名、全形括號換半形）。
單純比對字串會放過這些，所以用「字元 3-gram 的包含度」判斷。
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Iterable, List, Sequence

# 媒體常加在標題前後的裝飾，比對前先拔掉。
_NOISE_PATTERNS = [
    r"^[【\[（(]?\s*(快訊|獨家|盤中速報|盤後|盤前|直擊|焦點|專訪|影音|圖輯|更新|即時|重磅|頭條|社論|觀點)\s*[】\]）)]?[:：\-—]?",
    r"[（(]\s*(中央社|路透|彭博|美聯社|法新社|經濟日報|工商時報|自由時報|聯合報|中時|鉅亨網|MoneyDJ|日經)\s*[）)]",
    r"[｜|]\s*[^｜|]{1,12}$",          # 「標題｜媒體名」
    r"\s+[-–—]\s+[^\-–—]{1,16}$",      # 「標題 - 媒體名」（Google News 的格式）
]
_NOISE_RE = [re.compile(p) for p in _NOISE_PATTERNS]

_PUNCT_RE = re.compile(r"[\s　!-/:-@\[-`{-~＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～、。「」『』〈〉《》【】〔〕…—～·]+")
_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    import html as _html
    return _html.unescape(_TAG_RE.sub(" ", text or "")).strip()


def normalize(title: str) -> str:
    """把標題壓成只剩「內容字元」的比對鍵。"""
    t = unicodedata.normalize("NFKC", strip_html(title or ""))
    for rx in _NOISE_RE:
        t = rx.sub("", t)
    t = _PUNCT_RE.sub("", t)
    return t.strip().lower()


def title_hash(title: str) -> str:
    return hashlib.sha1(normalize(title).encode("utf-8")).hexdigest()


def shingles(text: str, n: int = 3) -> set:
    """字元 n-gram。中文沒有空白斷詞，字元 gram 比斷詞穩定且不需字典。"""
    s = normalize(text)
    if len(s) < n:
        return {s} if s else set()
    return {s[i:i + n] for i in range(len(s) - n + 1)}


def containment(a: set, b: set) -> float:
    """以較短者為分母的重疊度 —— 一則標題是另一則的擴寫時仍能抓到。"""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def split_outlet(title: str, known_outlet: str = "") -> tuple:
    """Google News 的標題格式是「真標題 - 媒體名」，把媒體名切出來。

    不能用通用的「切最後一個破折號」規則 —— 「台積電 - 三星 - 英特爾三強鼎立」
    這種標題本身就含破折號，硬切會把標題砍掉一半。所以只有在結尾恰好等於
    已知的來源名稱時才切；拿不到來源名時，退而求其次只認明確像媒體名的短後綴。
    """
    text = (title or "").strip()
    if known_outlet:
        for dash in ("-", "–", "—"):
            suffix = f" {dash} {known_outlet}"
            if text.endswith(suffix):
                return text[: -len(suffix)].strip(), known_outlet
        return text, known_outlet

    m = re.match(r"^(.*?)\s+[-–—]\s+([^\-–—]{2,12})$", text)
    if m and len(m.group(1)) >= 8:
        return m.group(1).strip(), m.group(2).strip()
    return text, ""


def contains_any(haystack: str, needles: Iterable[str]) -> List[str]:
    """回傳實際命中的關鍵詞（而不是只回 True），方便前端標注。"""
    h = unicodedata.normalize("NFKC", haystack or "").lower()
    hits = []
    for n in needles:
        if not n:
            continue
        if unicodedata.normalize("NFKC", n).lower() in h:
            hits.append(n)
    return hits


def same_subject(a: dict, b: dict) -> bool:
    """兩則新聞講的是不是同一批公司。

    這是去重的守門條件。台灣財經標題大量使用同一個模板，只換主角：
    「廣達AI伺服器出貨看增」和「緯創AI伺服器出貨看增」的字元重疊度高達 0.78，
    純看相似度一定會把它們併成一則，然後其中一家的新聞就從網站上消失了。
    兩邊都有標到公司、而且完全不重疊時，一律視為不同新聞。
    """
    ta = set(a.get("tickers") or [])
    tb = set(b.get("tickers") or [])
    if ta and tb:
        return bool(ta & tb)
    return True


def dedupe(records: Sequence[dict], *, threshold: float = 0.68) -> List[dict]:
    """全域去重。

    保留第一次出現的那筆（來源已依可信度與時間排序），把後續重複者的媒體名
    併進 dup_outlets —— 「幾家媒體同時報導」本身就是重要性訊號，不該丟掉。
    用倒排索引先取候選，避免 O(n^2) 全比對。
    """
    kept: List[dict] = []
    index: dict = {}          # shingle -> [kept index]
    seen_exact: dict = {}     # 正規化標題 -> [kept index]

    for rec in records:
        title = rec.get("title", "")
        key = normalize(title)
        if not key:
            continue

        exact_hit = None
        for idx in seen_exact.get(key, ()):
            if same_subject(kept[idx], rec):
                exact_hit = idx
                break
        if exact_hit is not None:
            _merge_dup(kept[exact_hit], rec)
            continue

        sh = shingles(title)
        candidates: dict = {}
        for g in sh:
            for idx in index.get(g, ()):  # noqa: B007
                candidates[idx] = candidates.get(idx, 0) + 1
        hit = None
        for idx, _ in sorted(candidates.items(), key=lambda kv: -kv[1])[:25]:
            if not same_subject(kept[idx], rec):
                continue
            if containment(sh, kept[idx]["_shingles"]) >= threshold:
                hit = idx
                break
        if hit is not None:
            _merge_dup(kept[hit], rec)
            continue

        rec = dict(rec)
        rec["_shingles"] = sh
        rec.setdefault("dup_outlets", [])
        kept.append(rec)
        pos = len(kept) - 1
        seen_exact.setdefault(key, []).append(pos)
        for g in sh:
            index.setdefault(g, []).append(pos)

    for rec in kept:
        rec.pop("_shingles", None)
        # 同一則稿被幾家媒體登，去掉自己與重複值
        outlets = [o for o in dict.fromkeys(rec.get("dup_outlets", [])) if o and o != rec.get("outlet")]
        rec["dup_outlets"] = outlets
        rec["dup_count"] = len(outlets) + 1
    return kept


def _merge_dup(target: dict, dup: dict) -> None:
    target.setdefault("dup_outlets", []).append(dup.get("outlet", ""))
    # 關聯個股取聯集：同一則稿可能是從不同個股的搜尋各撈到一次。
    tickers = set(target.get("tickers") or []) | set(dup.get("tickers") or [])
    target["tickers"] = sorted(tickers)
    # 補齊比較完整的摘要
    if len(dup.get("summary") or "") > len(target.get("summary") or ""):
        target["summary"] = dup["summary"]
