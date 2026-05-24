"""In-memory async sync queue with retry/backoff.

Workers consume SyncJob objects and call PortalClient. Failures retry with
exponential backoff up to MAX_ATTEMPTS, then are surfaced to the log handler.
"""
from __future__ import annotations
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BASE_BACKOFF_S = 1.0


@dataclass
class SyncJob:
    kind: str  # 'post_discord' | 'post_telegram' | 'edit' | 'delete'
    payload: dict
    attempt: int = 0
    on_done: Optional[Callable[[dict], Awaitable[None]]] = field(default=None, repr=False)
    on_fail: Optional[Callable[[Exception], Awaitable[None]]] = field(default=None, repr=False)


class SyncQueue:
    def __init__(self, workers: int = 2):
        self._q: asyncio.Queue[SyncJob] = asyncio.Queue()
        self._workers = workers
        self._tasks: list[asyncio.Task] = []
        self._stopping = asyncio.Event()

    async def enqueue(self, job: SyncJob) -> None:
        await self._q.put(job)

    def start(self, handler: Callable[[SyncJob], Awaitable[Any]]) -> None:
        for i in range(self._workers):
            self._tasks.append(asyncio.create_task(self._run(i, handler)))

    async def stop(self) -> None:
        self._stopping.set()
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
        self._tasks.clear()

    async def _run(self, worker_id: int, handler: Callable[[SyncJob], Awaitable[Any]]) -> None:
        while not self._stopping.is_set():
            job = await self._q.get()
            try:
                result = await handler(job)
                if job.on_done:
                    await job.on_done(result)
            except Exception as e:
                job.attempt += 1
                if job.attempt < MAX_ATTEMPTS:
                    delay = BASE_BACKOFF_S * (2 ** (job.attempt - 1))
                    log.warning("worker=%s job=%s attempt=%s failed, retrying in %.1fs: %s",
                                worker_id, job.kind, job.attempt, delay, e)
                    await asyncio.sleep(delay)
                    await self._q.put(job)
                else:
                    log.error("worker=%s job=%s gave up after %s attempts: %s",
                              worker_id, job.kind, job.attempt, e)
                    if job.on_fail:
                        try:
                            await job.on_fail(e)
                        except Exception:
                            log.exception("on_fail handler failed")
            finally:
                self._q.task_done()
