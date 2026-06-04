"""
Admit-card ID format.

CBSE admit-card ID = PREFIX (2 letters) + last 2 of roll + first 2 of school + centre_mid.

>>> EDIT THIS FILE if CBSE changes how the admit-card ID is composed. <<<
"""


def derive_admid(prefix: str, roll_no: int, school_no: str, centre_mid: str) -> str:
    return f"{prefix.upper()}{str(roll_no)[-2:]}{str(school_no)[:2]}{centre_mid}"
