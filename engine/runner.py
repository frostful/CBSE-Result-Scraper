"""Scrape orchestration / runner."""
import os
import csv
import time
import random
import threading
import queue
import asyncio

from config import DATA_DIR
from cbse.endpoints import RESULT_URL
from cbse.selectors import XPATH_ROLL
from cbse.prefixes import ALL_COMBOS, STATE_PREFIXES
from cbse.parser import parse_student_html
from cbse.form import fill_and_submit
from engine.browser import (
    async_playwright, stealth_helper,
    abort_useless_requests, create_stealth_context, cleanup_orphaned_browsers,
)
from engine.prefix_ranking import build_school_prefix_ranking
from engine.workers import worker_crack_async
from storage.results_store import ensure_data_dir, get_existing_rolls
from storage.prefix_map import load_prefix_map, save_prefix_map


async def main_async(school_no, centre_mid, rolls_to_scrape, state, workers, stop_event, q, prefix_map, csv_file, learned_prefixes, known_prefixes):
    if not async_playwright:
        q.put("[X] Playwright not installed.")
        return

    killed = cleanup_orphaned_browsers()
    if killed > 0:
        q.put(f"[*] Cleaned up {killed} orphaned browser process(es) from previous run.")

    pw = await async_playwright().start()
    
    # Headful on purpose: headless/server runs get IP-banned fast. Run locally.
    browser = await pw.chromium.launch(
        headless=False, 
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-extensions',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
        ]
    )

    pages = []
    q.put(f"[*] Launching Playwright (Chromium Async) with {workers} context(s)...")

    async def launch_worker(i):
        for attempt in range(2):
            if stop_event and stop_event.is_set():
                return None
            try:
                ctx = await create_stealth_context(browser)
                page = await ctx.new_page()

                def make_handler(p):
                    def handle_dialog(dialog):
                        p._dialog_fired = True
                        asyncio.create_task(dialog.accept())
                    return handle_dialog

                page.on("dialog", make_handler(page))
                await page.route("**/*", abort_useless_requests)
                if stealth_helper:
                    await stealth_helper.apply_stealth_async(page)
                await page.goto(RESULT_URL, wait_until='domcontentloaded', timeout=25000)
                await page.wait_for_selector(XPATH_ROLL, timeout=15000)
                q.put(f"[*] Worker {i+1} ready (stealth context active)")
                return page
            except Exception as e:
                q.put(f"[!] Worker {i+1} attempt {attempt+1} failed: {type(e).__name__}: {str(e)[:80]}")
                if attempt == 0:
                    await asyncio.sleep(random.uniform(1.0, 2.5))
        q.put(f"[X] Worker {i+1} could not be launched after 2 attempts.")
        return None

    BATCH = 5
    for batch_start in range(0, workers, BATCH):
        if stop_event and stop_event.is_set():
            break
        batch_indices = range(batch_start, min(batch_start + BATCH, workers))
        results = await asyncio.gather(*(launch_worker(i) for i in batch_indices))
        for page in results:
            if page is not None:
                pages.append(page)
        if batch_start + BATCH < workers:
            await asyncio.sleep(random.uniform(0.5, 1.0))

    if not pages:
        q.put("[X] Error: Could not launch any browser contexts.")
        try:
            await browser.close()
            await pw.stop()
        except: pass
        return

    q.put(f"[*] All {len(pages)} workers online. Starting async scrape...")
    
    results_data = []
    
    def save_partial_data():
        save_prefix_map(prefix_map)
        if results_data:
            try:
                file_exists = os.path.exists(csv_file)
                with open(csv_file, 'a', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    if not file_exists:
                        writer.writerow(['Roll', 'Name', 'MotherName', 'FatherName', 'SchoolName', 'SubjectCode', 'SubjectName', 'Theory', 'Practical', 'Total', 'Grade', 'Result'])
                    for s in results_data:
                        for sub in s['Subjects']:
                            writer.writerow([s['Roll'], s['Name'], s['MotherName'], s['FatherName'], s['SchoolName'], sub['SubCode'], sub['SubName'], sub['Theory'], sub['Practical'], sub['Total'], sub['Grade'], s['ResultStatus']])
                results_data.clear()
            except Exception:
                pass

    session_start = time.time()

    for idx, roll in enumerate(rolls_to_scrape):
        if stop_event and stop_event.is_set():
            q.put("[!] Scraping stopped by user.")
            save_partial_data()
            break
            
        total_remaining = len(rolls_to_scrape) - idx
        q.put(f"[SYS_ROLL] {roll}|{total_remaining}")
        q.put(f"\n[{idx+1}/{len(rolls_to_scrape)}] Processing Roll: {roll}")
        roll_start = time.time()

        if idx > 0:
            await asyncio.sleep(random.uniform(0.3, 0.8))

        prefix, admid, winning_page = None, None, None
        
        if roll in prefix_map:
            prefix, admid = prefix_map[roll]
            q.put(f"   -> Using mapped admit ID: {admid}")
        else:
            school_ranking_live, global_ranking_live, _ = build_school_prefix_ranking(prefix_map, school_no)
            live_learned = school_ranking_live if school_ranking_live else global_ranking_live
            
            q.put("   -> Missing prefix. Attempting to crack asynchronously...")
            
            # Priority: school-specific freq → global freq → state guesses → exhaustive brute force
            test_prefixes = []
            seen = set()
            for p in live_learned + known_prefixes + ALL_COMBOS:
                if p not in seen:
                    seen.add(p)
                    test_prefixes.append(p)

            total_to_try = len(test_prefixes)

            prefix_queue = asyncio.Queue()
            for p in test_prefixes:
                prefix_queue.put_nowait(p)

            found_event = asyncio.Event()
            result_list = []
            throttle_until = [0.0]  # shared rate-limit cooldown timestamp

            tasks = []
            for i in range(len(pages)):
                tasks.append(asyncio.create_task(worker_crack_async(
                    pages[i], prefix_queue, roll, school_no, centre_mid, found_event, result_list, i, q, stop_event, throttle_until
                )))

            done, pending = await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)
            # Cancel any stragglers (shouldn't happen, but be safe)
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

            q.put(f"   [i] Finished prefix search for roll {roll} ({total_to_try} candidates).")

            if result_list:
                res = result_list[0]
                prefix = res[0]
                admid = res[1]
                if len(res) > 2:
                    winning_page = pages[res[2]]
                prefix_map[roll] = (prefix, admid)
                q.put(f"   [+] CRACKED: Prefix {prefix} works!")
                save_partial_data()

        if stop_event and stop_event.is_set():
            continue

        if not admid:
            roll_elapsed = time.time() - roll_start
            q.put(f"   [X] Failed to crack prefix for {roll}. ({roll_elapsed:.1f}s)")
            await asyncio.gather(*(
                p.goto(RESULT_URL, wait_until='domcontentloaded', timeout=3000)
                for p in pages
            ), return_exceptions=True)
            continue

        try:
            target_page = winning_page if winning_page is not None else pages[0]
            body_text = await target_page.inner_text('body')
            if "Candidate Name" not in body_text:
                await fill_and_submit(target_page, roll, school_no, admid)
                try:
                    await target_page.wait_for_function('document.body.innerText.includes("Candidate Name")', timeout=3000)
                except Exception:
                    pass

            content = await target_page.content()
            student_data = parse_student_html(content, roll, admid)
            if student_data:
                results_data.append(student_data)
                roll_elapsed = time.time() - roll_start
                q.put(f"   [+] Extracted: {student_data['Name']} - {student_data['ResultStatus']} ({roll_elapsed:.1f}s)")
        except Exception as e:
            q.put(f"   [X] Parsing Error: {str(e)}")

        async def reset_page(p):
            try:
                await p.goto(RESULT_URL, wait_until='domcontentloaded', timeout=8000)
                await p.locator(XPATH_ROLL).wait_for(state="visible", timeout=5000)
            except Exception:
                try:
                    await p.goto(RESULT_URL, wait_until='domcontentloaded', timeout=8000)
                except Exception:
                    pass
        await asyncio.gather(*(reset_page(p) for p in pages), return_exceptions=True)
            
    for p in pages:
        try: await p.context.close()
        except: pass
    try:
        await browser.close()
        await pw.stop()
    except: pass
    cleanup_orphaned_browsers()
    
    save_partial_data()
    total_elapsed = time.time() - session_start
    mins, secs = divmod(int(total_elapsed), 60)
    q.put(f"\n[+] SCRAPING COMPLETED SUCCESSFULLY. Total time: {mins}m {secs}s")


def async_runner_thread(school_no, centre_mid, rolls_to_scrape, state, workers, stop_event, q, prefix_map, csv_file, learned_prefixes, known_prefixes):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main_async(school_no, centre_mid, rolls_to_scrape, state, workers, stop_event, q, prefix_map, csv_file, learned_prefixes, known_prefixes))
    except Exception as e:
        q.put(f"[X] Async engine error: {str(e)}")
    finally:
        loop.close()
        q.put("__ENGINE_DONE__")


def run_scraper_generator(school_no, centre_mid, roll_start, roll_end, stop_event=None, state="default", workers=1):
    ensure_data_dir()
    
    csv_file = os.path.join(DATA_DIR, f"{school_no}_results.csv")
    existing_rolls = get_existing_rolls(school_no)
    all_rolls = list(range(int(roll_start), int(roll_end) + 1))
    rolls_to_scrape = [r for r in all_rolls if r not in existing_rolls]
    
    if len(existing_rolls) > 0:
        yield f"[*] Found {len(existing_rolls)} previously scraped rolls. Skipping them."
        
    if not rolls_to_scrape:
        yield "[*] All requested rolls have already been scraped. Nothing to do."
        yield "DONE"
        return

    prefix_map = load_prefix_map()
    
    school_ranking, global_ranking, school_data_count = build_school_prefix_ranking(prefix_map, school_no)
    
    if school_data_count > 0:
        yield f"[*] Smart prediction: {school_data_count} unique prefixes learned for school {school_no} (school-specific mode)"
    elif global_ranking:
        yield f"[*] Smart prediction: Using global frequency ranking ({len(global_ranking)} prefixes learned)"
    else:
        yield "[*] No historical prefix data. Using state prefixes + default fallback + brute force."
    
    learned_prefixes = school_ranking if school_ranking else global_ranking
    
    state_prefixes = STATE_PREFIXES.get(state, STATE_PREFIXES["default"])
    known_prefixes = list(dict.fromkeys(state_prefixes + STATE_PREFIXES["default"]))

    q = queue.Queue()
    t = threading.Thread(target=async_runner_thread, args=(
        school_no, centre_mid, rolls_to_scrape, state, workers, stop_event, 
        q, prefix_map, csv_file, learned_prefixes, known_prefixes
    ))
    t.start()

    while True:
        try:
            msg = q.get(timeout=0.5)
            if msg == "__ENGINE_DONE__":
                break
            yield msg
        except queue.Empty:
            if not t.is_alive():
                break

    if stop_event and stop_event.is_set():
        yield "STOPPED"
    else:
        yield "DONE"
