# -*- coding: utf-8 -*-
"""共用的 HTTP 取用層。

排程工作最常見的死法是「某個來源今天壞了，整個 run 掛掉」。
這裡的規則只有一條：對外請求永遠不會往上丟例外，失敗就回 None，
由呼叫端決定要不要降級。
"""

from __future__ import annotations

import logging
import random
import time
from typing import Optional

import requests

log = logging.getLogger("net")

# 用一般瀏覽器的 UA。部分台灣媒體與 Google News 對空 UA 會回 403。
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DEFAULT_TIMEOUT = 20
MAX_ATTEMPTS = 3

_session: Optional[requests.Session] = None


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.headers.update({
            "User-Agent": UA,
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.6",
        })
        _session = s
    return _session


def get(url: str, *, timeout: int = DEFAULT_TIMEOUT, attempts: int = MAX_ATTEMPTS,
        headers: Optional[dict] = None) -> Optional[requests.Response]:
    """取回一個 URL；全部重試都失敗就回 None（不丟例外）。"""
    last = ""
    for attempt in range(1, attempts + 1):
        try:
            resp = session().get(url, timeout=timeout, headers=headers)
        except requests.RequestException as exc:
            last = f"{type(exc).__name__}: {exc}"
        else:
            if resp.status_code == 200:
                return resp
            # 429/5xx 值得重試，4xx 其他狀況重試也沒用。
            last = f"HTTP {resp.status_code}"
            if resp.status_code < 500 and resp.status_code != 429:
                log.warning("放棄 %s（%s，不可重試）", url, last)
                return None
        if attempt < attempts:
            backoff = 2 ** attempt + random.uniform(0, 0.8)
            log.info("重試 %s（第 %d 次失敗：%s），%.1fs 後再試", url, attempt, last, backoff)
            time.sleep(backoff)
    log.warning("放棄 %s（重試 %d 次仍失敗：%s）", url, attempts, last)
    return None


def polite_sleep(base: float = 1.0) -> None:
    """來源之間留點間隔，避免被判定為爬蟲。"""
    time.sleep(base + random.uniform(0, 0.6))
