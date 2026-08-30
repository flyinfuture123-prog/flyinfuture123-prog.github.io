#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""產生 patentmap 站台的 data/book.json。

內容以 scripts/patentmap/ 底下的 Python 模組維護，補進缺頁後重跑此腳本即可。

用法:
    python3 scripts/patentmap_build.py patentmap-4b9c7e2a51d8f306/data/book.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from patentmap import ch01_02, ch03_05, ch06_08, workflow


def build():
    book = {
        "meta": dict(ch01_02.META),
        "workflow": workflow.WORKFLOW,
        "foreword": ch01_02.FOREWORD,
        "chapters": [
            ch01_02.CH1, ch01_02.CH2,
            ch03_05.CH3, ch03_05.CH4, ch03_05.CH5,
            ch06_08.CH6, ch06_08.CH7,
        ],
    }
    book["meta"]["coverage"] = {
        "covered": "1–81",
        "byImage": ["1–26", "37–45", "78–81"],
        "byOcr": ["27–36", "46–77"],
        "excluded": ["82–96"],
        "excludedDetail": [
            {"range": "82–94", "what": "7-3 個別簡報之展示範例"},
            {"range": "95", "what": "第八章 結論"},
            {"range": "96", "what": "作者簡歷"},
        ],
    }
    return book


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    out = argv[1]
    book = build()
    parent = os.path.dirname(out)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(book, fh, ensure_ascii=False, indent=1)

    chapters = book["chapters"]
    sections = sum(len(c.get("sections", [])) for c in chapters)
    pending = sum(1 for c in chapters if c.get("pending")) + sum(
        1 for c in chapters for s in c.get("sections", []) if s.get("pending"))
    print("wrote %s (%d bytes)" % (out, os.path.getsize(out)))
    print("chapters=%d sections=%d pending=%d phases=%d"
          % (len(chapters), sections, pending, len(book["workflow"]["phases"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
