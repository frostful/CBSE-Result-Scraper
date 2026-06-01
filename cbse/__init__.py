"""
cbse/ — the "CBSE can break this" zone.

Everything CBSE controls and may change without warning lives here, isolated so
a yearly update means editing one obvious file:

    endpoints.py  -> result URL changes (new year, new link)
    selectors.py  -> page HTML structure changes (XPaths)
    parser.py     -> result page layout changes (how data is extracted)
    admit_id.py   -> admit-card ID format changes
    form.py       -> form fill / submit / "Result Not Found" behavior changes
    prefixes.py   -> state prefix guesses and combo space

The engine/ package imports from here, never the reverse.
"""

from cbse.endpoints import RESULT_URL
from cbse.selectors import XPATH_ROLL, XPATH_SCHOOL, XPATH_ADMIT
from cbse.prefixes import LETTERS, ALL_COMBOS, STATE_PREFIXES
from cbse.admit_id import derive_admid
from cbse.parser import strip_html, parse_student_html
from cbse.form import ensure_on_form, fill_and_submit, fast_crack_submit

__all__ = [
    "RESULT_URL",
    "XPATH_ROLL", "XPATH_SCHOOL", "XPATH_ADMIT",
    "LETTERS", "ALL_COMBOS", "STATE_PREFIXES",
    "derive_admid",
    "strip_html", "parse_student_html",
    "ensure_on_form", "fill_and_submit", "fast_crack_submit",
]
