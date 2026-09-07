#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""產生「全球螢光粉進展」站台的 data/site.json。

內容以 scripts/phosphor/ 底下的 Python 模組維護；改了模組就重跑此腳本，
否則頁面會跟原始資料對不上（CI 會比對兩邊是否同步）。

用法:
    python3 scripts/phosphor_build.py phosphor-f44f6e8f9e7fdd61/data/site.json
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from phosphor import (meta, intro, spectra, timeline, materials, applications,
                      landscape, news, frontier, faq, glossary, sources)

URL_RE = re.compile(r"^https?://[^\s]+$")
DATE_RE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


def collect_sources(site):
    """走訪整份資料，把所有 src/srcs/url 欄位彙整成去重後的來源清單，接在人工清單之後。"""
    found = {}

    def add(url, name, where):
        if not url or url in found:
            return
        found[url] = {"name": name or url.replace("https://", "").replace("http://", "").split("/")[0], "url": url, "kind": where}

    def walk(obj, where):
        if isinstance(obj, dict):
            if obj.get("src"):
                add(obj["src"], obj.get("srcName"), where)
            if obj.get("url") and ("name" in obj) and len(obj) <= 3:
                add(obj["url"], obj.get("name"), where)
            for k, v in obj.items():
                if k in ("src", "srcName"):
                    continue
                walk(v, where)
        elif isinstance(obj, list):
            for v in obj:
                walk(v, where)

    labels = {"timeline": "里程碑", "materials": "材料家族", "applications": "應用", "landscape": "全球版圖",
              "news": "最新動態", "frontier": "研究前沿", "faq": "常見問題"}
    for key, label in labels.items():
        walk(site[key], label)
    manual = list(site["sources"]["list"])
    seen = {m["url"] for m in manual}
    auto = [v for u, v in found.items() if u not in seen]
    auto.sort(key=lambda x: (x["kind"], x["name"]))
    site["sources"]["list"] = manual + auto
    site["sources"]["autoCount"] = len(auto)


def build():
    return {
        "meta": meta.META,
        "intro": intro.INTRO,
        "spectra": spectra.SPECTRA,
        "timeline": timeline.TIMELINE,
        "materials": materials.MATERIALS,
        "applications": applications.APPLICATIONS,
        "landscape": landscape.LANDSCAPE,
        "news": news.NEWS,
        "frontier": frontier.FRONTIER,
        "faq": faq.FAQ,
        "glossary": glossary.GLOSSARY,
        "sources": sources.SOURCES,
    }


def validate(site):
    """結構檢查：缺欄位、壞網址、壞日期、重複 id 都直接讓產生器失敗。"""
    errors = []

    def need(obj, keys, where):
        for k in keys:
            if k not in obj or obj[k] in (None, "", []):
                errors.append("%s 缺 %s" % (where, k))

    def url_ok(u, where):
        if u and not URL_RE.match(u):
            errors.append("%s 網址格式不對：%s" % (where, u))

    need(site["meta"], ["title", "subtitle", "compiled", "version", "chips"], "meta")

    it = site["intro"]
    need(it, ["lead", "how", "stats", "why", "metrics", "figCaption"], "intro")

    sp = site["spectra"]
    ids = set()
    for c in sp["curves"]:
        need(c, ["id", "name", "formula", "peak", "fwhm", "color"], "spectra.curve")
        if c["id"] in ids:
            errors.append("spectra.curve id 重複：%s" % c["id"])
        ids.add(c["id"])
    for p in sp["presets"]:
        need(p, ["name", "curves", "note"], "spectra.preset")
        for cid in p["curves"]:
            if cid not in ids:
                errors.append("spectra.preset %s 引用不存在的曲線 %s" % (p["name"], cid))

    for e in site["timeline"]["events"]:
        need(e, ["year", "title", "detail", "region", "category"], "timeline " + str(e.get("year")))
        url_ok(e.get("src"), "timeline " + str(e.get("title")))

    fids = set()
    for f in site["materials"]["families"]:
        need(f, ["id", "name", "formula", "color", "colorGroup", "status", "plain", "pros", "cons", "history"], "materials " + str(f.get("id")))
        if f["id"] in fids:
            errors.append("materials id 重複：%s" % f["id"])
        fids.add(f["id"])
        url_ok(f.get("src"), "materials " + str(f.get("id")))

    for a in site["applications"]["items"]:
        need(a, ["id", "name", "icon", "lead", "points"], "applications " + str(a.get("id")))
        for s in a.get("srcs", []):
            url_ok(s.get("url"), "applications " + str(a.get("id")))

    for r in site["landscape"]["regions"]:
        need(r, ["id", "name", "lead", "companies"], "landscape " + str(r.get("id")))
        for c in r["companies"]:
            need(c, ["name", "note"], "landscape %s company" % r.get("id"))
            url_ok(c.get("src"), "landscape company " + str(c.get("name")))
        for c in r.get("research", []):
            need(c, ["name", "note"], "landscape %s research" % r.get("id"))
            url_ok(c.get("src"), "landscape research " + str(c.get("name")))
    for e in site["landscape"]["market"]["estimates"]:
        need(e, ["source", "label", "value", "display", "scope"], "market")
    for p in site["landscape"]["patents"]:
        need(p, ["title", "detail"], "patents")
        url_ok(p.get("src"), "patents " + str(p.get("title")))

    for n in site["news"]["items"]:
        need(n, ["date", "title", "detail", "region", "tags", "src"], "news " + str(n.get("title")))
        if not DATE_RE.match(str(n.get("date", ""))):
            errors.append("news 日期格式不對：%s（%s）" % (n.get("date"), n.get("title")))
        url_ok(n.get("src"), "news " + str(n.get("title")))

    for f in site["frontier"]["items"]:
        need(f, ["id", "title", "lead", "why", "points"], "frontier " + str(f.get("id")))
        for s in f.get("srcs", []):
            url_ok(s.get("url"), "frontier " + str(f.get("id")))

    for q in site["faq"]:
        need(q, ["q", "a"], "faq")
        url_ok(q.get("src"), "faq " + str(q.get("q")))

    terms = set()
    for g in site["glossary"]:
        need(g, ["term", "zh", "explain"], "glossary")
        if g["term"] in terms:
            errors.append("glossary 重複：%s" % g["term"])
        terms.add(g["term"])

    for s in site["sources"]["list"]:
        need(s, ["name", "url", "kind"], "sources")
        url_ok(s.get("url"), "sources " + str(s.get("name")))

    # 簡體字／大陸用語巡檢：這個站給台灣讀者看，抓幾個最常混進來的詞。
    banned = ["荧光", "激光", "硅", "纳米", "质量", "软件", "信息", "视频", "数据", "网络", "通过", "实现", "应用"]
    blob = json.dumps(site, ensure_ascii=False)
    for w in banned:
        if w in blob:
            # 允許出現在明確標示為簡體檢索詞的欄位（例如 sources 的名稱）
            idx = blob.find(w)
            errors.append("疑似簡體／大陸用語「%s」：…%s…" % (w, blob[max(0, idx - 30):idx + 30]))
    return errors


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    out = argv[1]
    site = build()
    collect_sources(site)
    errors = validate(site)
    if errors:
        for e in errors:
            print("::error::" + e, file=sys.stderr)
        print("共 %d 個問題，未寫出檔案" % len(errors), file=sys.stderr)
        return 1
    parent = os.path.dirname(out)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(site, fh, ensure_ascii=False, indent=1)
    print("wrote %s (%d bytes)" % (out, os.path.getsize(out)))
    print("timeline=%d materials=%d applications=%d regions=%d news=%d frontier=%d faq=%d glossary=%d sources=%d" % (
        len(site["timeline"]["events"]), len(site["materials"]["families"]),
        len(site["applications"]["items"]), len(site["landscape"]["regions"]),
        len(site["news"]["items"]), len(site["frontier"]["items"]),
        len(site["faq"]), len(site["glossary"]), len(site["sources"]["list"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
