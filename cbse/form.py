from __future__ import annotations

import asyncio
from typing import Any

from cbse.endpoints import RESULT_URL
from cbse.selectors import XPATH_ROLL, XPATH_SCHOOL, XPATH_ADMIT


async def ensure_on_form(page: Any, timeout: int = 8000) -> None:
    """Return without action if the search form is already visible, else navigate there."""
    try:
        form_filename = RESULT_URL.split('/')[-1]
        if form_filename in page.url and await page.locator(XPATH_ROLL).count() > 0:
            await page.locator(XPATH_ROLL).wait_for(state="visible", timeout=2000)
            return
    except Exception:
        pass
    await page.goto(RESULT_URL, wait_until='domcontentloaded', timeout=timeout)
    await page.locator(XPATH_ROLL).wait_for(state="visible", timeout=5000)


async def fill_and_submit(page: Any, roll: int, school_no: str, admid: str) -> None:
    """Fill form fields and submit — verifies values were accepted before pressing Enter."""
    roll_loc = page.locator(XPATH_ROLL)
    school_loc = page.locator(XPATH_SCHOOL)
    admit_loc = page.locator(XPATH_ADMIT)

    await roll_loc.wait_for(state="visible", timeout=5000)
    await roll_loc.fill(str(roll))
    await school_loc.wait_for(state="visible", timeout=5000)
    await school_loc.fill(str(school_no))
    await admit_loc.wait_for(state="visible", timeout=5000)
    await admit_loc.fill(str(admid))

    actual_roll = await roll_loc.input_value()
    actual_school = await school_loc.input_value()
    actual_admit = await admit_loc.input_value()
    if not actual_roll or not actual_school or not actual_admit:
        raise ValueError(f"Fields not filled: roll={actual_roll}, school={actual_school}, admit={actual_admit}")

    try:
        async with page.expect_navigation(wait_until="domcontentloaded", timeout=8000):
            await admit_loc.press("Enter")
    except Exception:
        await asyncio.sleep(0.3)


async def fast_crack_submit(page: Any, roll: int, school_no: str, admid: str) -> None:
    """Fill+submit for cracking — single JS call to fill all fields, tighter timeout."""
    await page.evaluate("""([r, s, a]) => {
        const inputs = document.querySelectorAll('form input');
        if (inputs.length >= 3) { inputs[0].value = r; inputs[1].value = s; inputs[2].value = a; }
    }""", [str(roll), str(school_no), str(admid)])

    try:
        async with page.expect_navigation(wait_until="domcontentloaded", timeout=5000):
            await page.locator(XPATH_ADMIT).press("Enter")
    except Exception:
        await asyncio.sleep(0.15)
