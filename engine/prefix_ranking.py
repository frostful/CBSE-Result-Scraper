"""Frequency-based ranking of known prefixes to try first when cracking."""
from collections import Counter


def build_school_prefix_ranking(prefix_map: dict[int, tuple[str, str]], school_no: str) -> tuple[list[str], list[str], int]:
    """Frequency-sorted prefix list, school-specific if enough data, else global."""
    school_prefix = str(school_no)[:2]
    
    school_counts = Counter()
    global_counts = Counter()
    
    for roll, (prefix, admid) in prefix_map.items():
        global_counts[prefix] += 1
        # AdmitCardID: PREFIX + last2_roll + first2_school + centre_mid
        if len(admid) >= 6 and admid[4:6] == school_prefix:
            school_counts[prefix] += 1
    
    if sum(school_counts.values()) >= 5:
        school_ranking = [p for p, _ in school_counts.most_common()]
        global_ranking = [p for p, _ in global_counts.most_common()]
        return school_ranking, global_ranking, len(school_counts)
    else:
        global_ranking = [p for p, _ in global_counts.most_common()]
        return [], global_ranking, 0
