"""
Admit-card prefix search space.

LETTERS / ALL_COMBOS define the exhaustive 2-letter brute-force space.
STATE_PREFIXES are frequency-ordered guesses per state to try first.

>>> EDIT THIS FILE to tune state-specific prefix guesses or the combo space. <<<
"""
import itertools

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
ALL_COMBOS = ["".join(p) for p in itertools.product(LETTERS, repeat=2)]

STATE_PREFIXES = {
    "andhra_pradesh": ["RE", "NA", "RA", "YS", "CH", "GA", "KA"],
    "arunachal_pradesh": ["TA", "DO", "WA", "LO"],
    "assam": ["GO", "SH", "DA", "BO", "SA", "BA"],
    "bihar": ["SI", "KU", "YA", "SH", "MI", "PA", "CH"],
    "chhattisgarh": ["SA", "SI", "KU", "YA", "DE"],
    "delhi": ["KU", "SI", "SH", "JA", "GU", "CH"],
    "goa": ["FE", "DS", "NA", "KA", "PR", "DE"],
    "gujarat": ["PA", "SH", "DE", "ME", "JO", "CH"],
    "haryana": ["SI", "GR", "KU", "SH", "YA", "JA", "CH", "EL", "AM", "AY", "AI", "RA", "MA", "GI", "RI", "AV", "AN", "MU", "TA"],
    "himachal_pradesh": ["SH", "SI", "TH", "KU", "RA"],
    "j_and_k": ["DA", "BH", "LO", "MA", "KH", "SH"],
    "jharkhand": ["KU", "SI", "YA", "MA", "SO", "MU"],
    "karnataka": ["GO", "PA", "SH", "RA", "KU", "NA"],
    "kerala": ["NA", "ME", "PI", "VA", "TH", "GE", "JO"],
    "madhya_pradesh": ["SH", "SI", "JA", "YA", "MI", "CH"],
    "maharashtra": ["PA", "DE", "KA", "JO", "KU", "SH", "CH"],
    "manipur": ["SI", "SH"],
    "meghalaya": ["SA", "MA", "SH"],
    "mizoram": ["LA", "CH", "VA"],
    "nagaland": ["JA", "AO", "SE"],
    "odisha": ["AS", "HU", "OO", "IK", "RA", "AL", "TY", "NA", "DA", "KA", "AI", "AN", "TH", "UL", "AM", "HI", "SH", "TA", "ND", "LI", "YA", "LA", "SA", "NK", "AR", "EL", "RI", "TI", "UA", "GI"],
    "punjab": ["GR", "SI", "KA", "HA", "MA", "SA", "AM", "GU", "BA", "PA"],
    "rajasthan": ["SI", "SH", "JA", "ME", "YA", "CH"],
    "sikkim": ["GU", "BH", "LE", "SH", "CH", "SU"],
    "tamil_nadu": ["KU", "RA", "IY", "SW", "NA", "BA", "SU"],
    "telangana": ["RE", "RA", "GO", "KU", "CH"],
    "tripura": ["DE", "SA", "DA", "TR", "SH"],
    "uttar_pradesh": ["SI", "KU", "SH", "YA", "MI", "PA", "CH"],
    "uttarakhand": ["NE", "BI", "RA", "SH", "JO", "CH"],
    "west_bengal": ["GH", "CH", "BO", "DA", "SE", "MU", "BA", "SA", "MI"],
    "default": [
        "AL", "RA", "AA", "GR", "AI", "TA", "AN", "OO", "GI", "AK", "NA", "AY", "AS", "HU", "IA", "IK", 
        "GA", "HA", "AR", "DA", "LA", "IN", "HI", "TY", "RI", "NI", "RY", "HY", "TI", "UT", "SH", "TH", 
        "VA", "MA", "CK", "SA", "AT", "IY", "ER", "AH", "AM", "GH", "AU", "EL", "OA", "KA", "LI", "RL", 
        "IS", "HO", "TS", "EE", "DI", "AV", "OY", "ON", "EY", "HN", "AG", "OI", "RK", "IH", "TR", "RO", 
        "UN", "YA", "MI", "HR", "EI", "LE", "RE", "DH", "RG", "GT", "TK", "UA", "UR", "IO", "IM", "TU", 
        "DO", "CA", "SY", "LY", "MT", "NL", "EJ", "SI", "AO", "TO", "RR", "AD", "UK", "NT", "AB", "RS", 
        "MH", "RU", "IR", "OU", "JA", "EO", "NY", "KH", "II", "GY", "SN", "AP", "EN", "ED", "DE", "ZA", 
        "JN", "HM", "MN", "MU", "EA", "BI", "EV", "GM", "IT", "LK", "LL", "GN", "GP", "UV"
    ]
}
