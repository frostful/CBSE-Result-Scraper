"""
XPath selectors for the CBSE result search form.

>>> EDIT THIS FILE when CBSE changes the result page HTML structure <<<
(e.g. the input fields move, or the surrounding tables change).
"""

XPATH_ROLL   = "xpath=/html/body/table[3]/tbody/tr/td/font/center[2]/form/div[1]/center/table/tbody/tr[1]/td[2]/input"
XPATH_SCHOOL = "xpath=/html/body/table[3]/tbody/tr/td/font/center[2]/form/div[1]/center/table/tbody/tr[2]/td[2]/input"
XPATH_ADMIT  = "xpath=/html/body/table[3]/tbody/tr/td/font/center[2]/form/div[1]/center/table/tbody/tr[3]/td[2]/input"
