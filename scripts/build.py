# -*- coding: utf-8 -*-
"""每日建置：抓新聞 → 逐則分析 → 產生資料檔。

輸出：
  <site>/data/latest.json     今天的完整資料（網頁預設讀這個）
  <site>/data/YYYY-MM-DD.json 當日封存
  <site>/data/index.json      有哪些日期可查

刻意把「抓取失敗」和「產出空資料」分開處理：
單一來源掛掉是常態，靜靜記錄就好；但整份資料是空的代表整條路斷了，
那就要讓 CI 紅燈，而不是安靜地把好好的網站蓋成空白。
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import analyze  # noqa: E402
import fetch_news  # noqa: E402
import lexicon as lex  # noqa: E402
import llm  # noqa: E402
from stocks import TOP20, total_weight  # noqa: E402

log = logging.getLogger("build")

TPE = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 低於這個則數就視為抓取失敗 —— 正常的一天，光台積電就不只這個量。
MIN_ARTICLES = 8
# 封存保留天數，避免 repo 無限膨脹。
ARCHIVE_DAYS = 180


def build(*, days: int, fixture: str | None, use_llm: bool,
          out_dir: str, now: datetime) -> dict:
    articles, health = fetch_news.collect(days=days, fixture=fixture)
    log.info("取得 %d 則新聞，開始逐則分析", len(articles))

    analyze.analyze_all(articles)

    llm_status = {"enabled": False, "reason": "已停用（--no-llm）"}
    if use_llm:
        llm_status = llm.enrich(articles)

    summaries = [analyze.aggregate_stock(s["ticker"], articles) for s in TOP20]
    summaries.sort(key=lambda s: -s["weight"])
    market = analyze.market_brief(summaries, articles)

    engine = "claude" if llm_status.get("upgraded") else "rules"
    payload = {
        "schema_version": 1,
        "generated_at": now.isoformat(timespec="seconds"),
        "date": now.strftime("%Y-%m-%d"),
        "timezone": "Asia/Taipei",
        "window_days": days,
        "engine": engine,
        "market": market,
        "stocks": summaries,
        "articles": articles,
        "categories": [{"id": c["id"], "label": c["label"]} for c in lex.CATEGORIES]
                      + [{"id": "other", "label": "其他動態"}],
        "stats": {
            "article_count": len(articles),
            "stock_count": len(summaries),
            "covered_stocks": market["covered_stocks"],
            "index_weight_covered": total_weight(),
            "sources": health,
            "llm": llm_status,
        },
    }
    return payload


def write_outputs(payload: dict, out_dir: str) -> List[str]:
    data_dir = os.path.join(out_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    written = []

    for name in ("latest.json", f"{payload['date']}.json"):
        path = os.path.join(data_dir, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        written.append(path)

    # 重建索引，順便把過舊的封存刪掉
    _prune_archive(data_dir, payload["date"])
    entries = []
    for fname in sorted(os.listdir(data_dir), reverse=True):
        if not (len(fname) == 15 and fname.endswith(".json")):
            continue
        try:
            with open(os.path.join(data_dir, fname), encoding="utf-8") as fh:
                day = json.load(fh)
        except (ValueError, OSError):
            continue
        entries.append({
            "date": day.get("date", fname[:-5]),
            "file": fname,
            "article_count": day.get("stats", {}).get("article_count", 0),
            "sentiment": day.get("market", {}).get("sentiment", 0),
            "engine": day.get("engine", "rules"),
        })

    index_path = os.path.join(data_dir, "index.json")
    with open(index_path, "w", encoding="utf-8") as fh:
        json.dump({"generated_at": payload["generated_at"], "days": entries},
                  fh, ensure_ascii=False, separators=(",", ":"))
    written.append(index_path)
    return written


def _prune_archive(data_dir: str, today: str) -> None:
    try:
        cutoff = (datetime.strptime(today, "%Y-%m-%d")
                  - timedelta(days=ARCHIVE_DAYS)).strftime("%Y-%m-%d")
    except ValueError:
        return
    for fname in os.listdir(data_dir):
        if len(fname) == 15 and fname.endswith(".json") and fname[:-5] < cutoff:
            try:
                os.remove(os.path.join(data_dir, fname))
                log.info("刪除過舊封存 %s", fname)
            except OSError:
                pass


def write_step_summary(payload: dict, path: str) -> None:
    """寫進 GitHub Actions 的 job summary，讓每次排程結果在 UI 上一眼可讀。"""
    m = payload["market"]
    stats = payload["stats"]
    lines = [
        f"## 台股權值股新聞分析 — {payload['date']}",
        "",
        f"- 新聞則數：**{stats['article_count']}**",
        f"- 涵蓋個股：**{stats['covered_stocks']} / {stats['stock_count']}**",
        f"- 加權新聞情緒：**{m['sentiment']:+d}（{m['sentiment_label']}）**",
        f"- 分析引擎：**{payload['engine']}**"
        + (f"（{stats['llm'].get('model')}，升級 {stats['llm'].get('upgraded', 0)} 則）"
           if payload["engine"] == "claude" else "（規則式）"),
        "",
        "### 新聞面最強 / 最弱",
        "",
        "| 方向 | 個股 | 情緒 |",
        "| --- | --- | --- |",
    ]
    for s in m["strongest"]:
        lines.append(f"| 強 | {s['name']}（{s['ticker']}） | {s['sentiment']:+d} |")
    for s in m["weakest"]:
        lines.append(f"| 弱 | {s['name']}（{s['ticker']}） | {s['sentiment']:+d} |")

    failed = [s for s in stats["sources"]["sources"] if not s.get("ok")]
    if failed:
        lines += ["", f"### 取用失敗的來源（{len(failed)}）", ""]
        lines += [f"- `{s['id']}`（{s.get('note', '')}）" for s in failed[:20]]

    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="建置台股權值股新聞分析資料")
    ap.add_argument("--site-dir", required=True, help="網站目錄（data/ 會寫在底下）")
    ap.add_argument("--days", type=int, default=2, help="回溯天數")
    ap.add_argument("--fixture", help="離線測試用的新聞 JSON")
    ap.add_argument("--no-llm", action="store_true", help="強制只用規則式分析")
    ap.add_argument("--allow-empty", action="store_true",
                    help="即使沒抓到新聞也照樣寫出（僅供測試）")
    ap.add_argument("--date", help="覆寫日期字串 YYYY-MM-DD（測試用）")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    now = datetime.now(TPE)
    if args.date:
        stamp = datetime.strptime(args.date, "%Y-%m-%d")
        now = now.replace(year=stamp.year, month=stamp.month, day=stamp.day)

    site_dir = args.site_dir if os.path.isabs(args.site_dir) else \
        os.path.join(REPO_ROOT, args.site_dir)

    payload = build(days=args.days, fixture=args.fixture,
                    use_llm=not args.no_llm, out_dir=site_dir, now=now)

    count = payload["stats"]["article_count"]
    if count < MIN_ARTICLES and not args.allow_empty:
        log.error("只取得 %d 則新聞（低於門檻 %d），視為抓取失敗，"
                  "不覆寫既有資料。", count, MIN_ARTICLES)
        return 2

    for path in write_outputs(payload, site_dir):
        log.info("已寫入 %s", path)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        try:
            write_step_summary(payload, summary_path)
        except OSError as exc:
            log.warning("寫入 step summary 失敗：%s", exc)

    log.info("完成：%d 則新聞、涵蓋 %d 檔、整體情緒 %+d",
             count, payload["stats"]["covered_stocks"], payload["market"]["sentiment"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
