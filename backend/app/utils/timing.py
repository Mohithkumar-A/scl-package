"""High-precision execution timer utilities."""

from __future__ import annotations

import time
from typing import Generator
from contextlib import contextmanager


class Timer:
    def __init__(self) -> None:
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self.elapsed: float = 0.0

    def start(self) -> None:
        self.start_time = time.perf_counter()

    def stop(self) -> float:
        self.end_time = time.perf_counter()
        self.elapsed = self.end_time - self.start_time
        return self.elapsed


@contextmanager
def measure_time() -> Generator[Timer, None, None]:
    t = Timer()
    t.start()
    try:
        yield t
    finally:
        t.stop()
