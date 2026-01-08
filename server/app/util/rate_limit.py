from __future__ import annotations

import time
from collections import deque
from typing import Deque


class RateLimiter:
    def __init__(self, max_per_sec: int) -> None:
        self._max = max_per_sec
        self._timestamps: Deque[float] = deque()

    def allow(self) -> bool:
        now = time.monotonic()
        cutoff = now - 1.0
        while self._timestamps and self._timestamps[0] < cutoff:
            self._timestamps.popleft()
        if len(self._timestamps) >= self._max:
            return False
        self._timestamps.append(now)
        return True
