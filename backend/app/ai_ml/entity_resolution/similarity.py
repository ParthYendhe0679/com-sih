"""String and identifier similarity metrics for Entity Resolution."""

import difflib
import re
from typing import List, Set
from app.ai_ml.utils.metrics import (
    normalize_phone_number,
    normalize_text_token,
    normalize_vehicle_plate,
)


def compute_token_sort_ratio(s1: str, s2: str) -> float:
    """Token Sort Ratio: splits strings into tokens, sorts alphabetically, and calculates similarity."""
    t1 = " ".join(sorted(normalize_text_token(s1).split()))
    t2 = " ".join(sorted(normalize_text_token(s2).split()))
    if not t1 and not t2:
        return 1.0
    if not t1 or not t2:
        return 0.0
    return float(difflib.SequenceMatcher(None, t1, t2).ratio())


def compute_jaro_winkler_similarity(s1: str, s2: str) -> float:
    """Calculates Jaro-Winkler string distance between two tokens."""
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if s1 == s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    match_distance = (max(len1, len2) // 2) - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0
    transpositions = 0

    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j]:
                continue
            if s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions //= 2
    jaro = (
        (matches / len1)
        + (matches / len2)
        + ((matches - transpositions) / matches)
    ) / 3.0

    # Prefix scale (up to 4 chars)
    prefix = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return float(jaro + (prefix * 0.1 * (1.0 - jaro)))


def compute_name_similarity(name1: str, name2: str) -> float:
    """Composite name similarity combining token sort ratio and Jaro-Winkler."""
    if not name1 or not name2:
        return 0.0
    n1 = normalize_text_token(name1)
    n2 = normalize_text_token(name2)
    if n1 == n2:
        return 1.0

    # Check abbreviation match (e.g. "K. Verma" vs "Karan Verma")
    words1 = n1.split()
    words2 = n2.split()
    if len(words1) >= 2 and len(words2) >= 2:
        if words1[-1] == words2[-1]:  # Same surname
            # Check if first initials match
            if words1[0][0] == words2[0][0]:
                if len(words1[0]) == 1 or len(words2[0]) == 1:
                    return 0.85

    token_ratio = compute_token_sort_ratio(n1, n2)
    if token_ratio == 1.0:
        return 1.0

    jw_ratio = compute_jaro_winkler_similarity(n1, n2)
    if token_ratio < 0.5:
        return round(token_ratio * 0.60 + jw_ratio * 0.20, 4)
    return round(max(token_ratio * 0.90, 0.5 * token_ratio + 0.5 * jw_ratio), 4)


def compute_phone_similarity(phone1: str, phone2: str) -> float:
    """Phone number similarity: 1.0 for exact 10-digit match, 0.7 for partial overlap."""
    p1 = normalize_phone_number(phone1)
    p2 = normalize_phone_number(phone2)
    if not p1 or not p2:
        return 0.0
    if p1 == p2:
        return 1.0
    if p1[-7:] == p2[-7:]:
        return 0.80
    return 0.0


def compute_address_similarity(addr1: str, addr2: str) -> float:
    """Address token Jaccard similarity."""
    t1 = set(normalize_text_token(addr1).split())
    t2 = set(normalize_text_token(addr2).split())
    if not t1 or not t2:
        return 0.0
    intersection = t1.intersection(t2)
    union = t1.union(t2)
    return round(len(intersection) / len(union), 4)


def compute_vehicle_similarity(v1: str, v2: str) -> float:
    """Vehicle registration similarity."""
    p1 = normalize_vehicle_plate(v1)
    p2 = normalize_vehicle_plate(v2)
    if not p1 or not p2:
        return 0.0
    if p1 == p2:
        return 1.0
    ratio = difflib.SequenceMatcher(None, p1, p2).ratio()
    return round(ratio, 4) if ratio >= 0.8 else 0.0
