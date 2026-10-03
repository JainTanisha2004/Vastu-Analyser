import math
import re
from constants import VASTU_RULES, ROOM_ALIASES, CORE_DIRECTIONS, IGNORE_LABELS


def angular_distance(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def fuzzy_membership(angle, peak, spread=45):
    d = angular_distance(angle, peak)
    if d >= spread:
        return 0
    return 1 - d / spread


def get_angle(cx, cy, x, y):
    ang = math.degrees(math.atan2(y - cy, x - cx))
    return (ang + 360) % 360


def strip_mtext_formatting(text):
    """Remove MTEXT formatting codes like \\A1; \\P \\f... etc."""
    # Collapse escaped backslashes first so they aren't mistaken for format codes
    text = re.sub(r"\\\\", " ", text)
    # Paragraph / line breaks become spaces (so "Kitchen\PStore" → "Kitchen Store")
    text = re.sub(r"\\[PpNn]", " ", text)
    # Other formatting directives (font, colour, height, etc.) are removed
    text = re.sub(r"\\[AaCcFfHhLlOoQqSsTtWw][^;]*;", "", text)
    text = re.sub(r"\{|\}", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_valid_room_text(text):
    if not text:
        return False
    text = strip_mtext_formatting(text)
    text = text.strip()
    if not text:
        return False
    if len(text) <= 1:
        return False

    # ── TIER 1: Length Constraints ──
    if len(text) > 35 or len(text.split()) > 5:
        return False

    # ── TIER 2: Metadata Pattern Recognition (Regex) ──
    # Dates (e.g., 12/05/2026 or 12-05-26)
    if re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', text):
        return False
    # Phone Numbers / Mobiles / Landlines (e.g., 99994-05912, 0731-4291938)
    if re.search(r'\d{3,5}[-\s]?\d{6,8}', text) or re.search(r'\d{10}', text):
        return False
    # Emails and Websites
    if '@' in text or 'www.' in text.lower() or '.com' in text.lower():
        return False

    # ── TIER 3: Poison Word Filtering ──
    lower_text = text.lower()
    poison_words = [
        'owner', 'architect', 'consultant', 'engineer', 
        'plot no', 'drg', 'date', 'mob', 'fax', 'email', 
        'address', 'client', 'project', 'scale',
        'ph.', 'tel.', 'office no', 'signature', 'drawn by', 'checked by'
    ]
    if any(word in lower_text for word in poison_words):
        return False

    # ── TIER 4: Dimension & Ignore List Filters ──
    if re.fullmatch(r"[0-9\.\-\'\"\sxX/]+", text):
        return False
        
    normalized = normalize_text(text)
    if normalized in IGNORE_LABELS:
        return False

    return True


def normalize_text(text):
    text = text.lower()
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    text = re.sub(r"[-_/\.]", " ", text)
    text = re.sub(r"\d+", "", text)
    text = re.sub(r"[^a-z\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def detect_room_type_with_confidence(text):
    """Detect the canonical room type and a confidence level.

    Returns (room_type, confidence) where confidence is one of:
      'high'   — matched a keyword exactly in pass 1
      'medium' — only matched via a substring/word-boundary fallback (pass 2)
      'low'    — no keyword matched; defaulted to "Generic Room"
    The confidence is surfaced in the UI so the user knows which auto-detected
    labels are worth double-checking.
    """
    clean = normalize_text(text)
    words = set(clean.split())
    if not words:
        return "Generic Room", "low"

    best_match = None
    best_score = 0

    # Pass 1: multi-word subset matching (exact phrase match)
    for room_type, keywords in ROOM_ALIASES.items():
        score = 0
        for kw in keywords:
            kw_words = set(kw.split())
            if len(kw_words) > 1 and kw_words.issubset(words):
                score += len(kw_words) * 2  # bonus for multi-word match
            elif len(kw_words) == 1 and kw_words.issubset(words):
                score += 1
        if score > best_score:
            best_score = score
            best_match = room_type

    if best_match and best_score > 0:
        return best_match, "high"

    # Pass 2: Regex Word Boundary matching
    # Ensures 'entry' matches 'front entry' but NOT 'pentry'
    for room_type, keywords in ROOM_ALIASES.items():
        for kw in keywords:
            # \b asserts position at a word boundary
            if re.search(r'\b' + re.escape(kw) + r'\b', clean):
                return room_type, "medium"

    return "Generic Room", "low"


def detect_room_type(text):
    """Backward-compatible wrapper returning only the room type string."""
    room_type, _ = detect_room_type_with_confidence(text)
    return room_type


def get_likely_zone(angle):
    sectors = [
        (337.5, 360, "E"), (0, 22.5, "E"),
        (22.5, 67.5, "NE"),
        (67.5, 112.5, "N"),
        (112.5, 157.5, "NW"),
        (157.5, 202.5, "W"),
        (202.5, 247.5, "SW"),
        (247.5, 292.5, "S"),
        (292.5, 337.5, "SE"),
    ]
    for start, end, zone in sectors:
        if start <= angle < end:
            return zone
    return "E"

def get_ideal_zone(room_type):
    rule = VASTU_RULES.get(room_type)
    # FIX: Safely return 'N/A' if the rule doesn't exist OR if scores are empty
    if not rule or not rule.get("scores"):
        return "N/A"
    return max(rule["scores"], key=rule["scores"].get)


def run_vastu_analysis(rooms, bounds, north_offset=0.0):
    cx, cy = bounds["cx"], bounds["cy"]
    rows = []
    total_score = 0.0
    max_score = 0.0

    for room in rooms:
        raw_angle = get_angle(cx, cy, room["x"], room["y"])
        adjusted_angle = (raw_angle - north_offset + 360) % 360

        room_type = room["type"]
        rule = VASTU_RULES.get(room_type, VASTU_RULES["Generic Room"])

        score = 0.0
        for direction, dir_angle in CORE_DIRECTIONS.items():
            mem = fuzzy_membership(adjusted_angle, dir_angle)
            if mem > 0:
                dir_score = rule["scores"].get(direction, rule["def"])
                score += mem * dir_score

        actual_zone = get_likely_zone(adjusted_angle)
        ideal_zone = get_ideal_zone(room_type)

        rows.append({
            "room_id": room.get("room_id"),
            "room_type": room_type,
            "angle": round(adjusted_angle, 1),
            "actual_zone": actual_zone,
            "ideal_zone": ideal_zone,
            "score": round(score, 2),
            "max_score": rule["max"],
        })

        total_score += score
        max_score += rule["max"]

    if max_score > 0:
        compliance_percent = round(
            max(0.0, min(100.0, (total_score / max_score) * 100)), 1
        )
    else:
        compliance_percent = 0.0

    return rows, round(total_score, 2), max_score, compliance_percent


def calculate_room_score(room, bounds, rule, north_offset=0.0):
    cx, cy = bounds["cx"], bounds["cy"]
    angle = get_angle(cx, cy, room["x"], room["y"])
    adjusted_angle = (angle - north_offset + 360) % 360

    score = 0.0
    for direction, dir_angle in CORE_DIRECTIONS.items():
        mem = fuzzy_membership(adjusted_angle, dir_angle)
        if mem > 0:
            dir_score = rule["scores"].get(direction, rule["def"])
            score += mem * dir_score

    return adjusted_angle, score


def calculate_total_score(rooms, bounds, north_offset=0.0):
    total = 0
    max_total = 0

    for r in rooms:
        rule = VASTU_RULES.get(r["type"], VASTU_RULES["Generic Room"])
        angle, score = calculate_room_score(r, bounds, rule, north_offset)
        total += score
        max_total += rule["max"]

    if max_total == 0:
        return 0.0
    return (total / max_total) * 100


IMMUTABLE_ROOMS = ["Balcony", "Main Door", "Staircase", "Foyer", "Generic Room"]

ROOM_SIZE_CLASS = {
    "Living": "large",
    "Dining": "large",

    "Kitchen": "medium",
    "Master Bedroom": "medium",
    "Kids Bedroom": "medium",
    "Guest": "medium",
    "Elders Bedroom": "medium",

    "Toilet": "small",
    "Wash": "small",

    "Mandir": "tiny",

    "Generic Room": "medium",
}


def get_priority_rooms(rooms, bounds, north_offset=0.0):
    priority = []

    for i, r in enumerate(rooms):
        rule = VASTU_RULES.get(r["type"], VASTU_RULES["Generic Room"])
        angle, score = calculate_room_score(r, bounds, rule, north_offset)
        r["score"] = score

        if score < 0.5 * rule["max"] and r["type"] not in IMMUTABLE_ROOMS:
            priority.append(i)

    return sorted(priority, key=lambda i: rooms[i]["score"])


def valid_swap(r1, r2):
    if r1["type"] in IMMUTABLE_ROOMS:
        return False
    if r2["type"] in IMMUTABLE_ROOMS:
        return False

    size1 = ROOM_SIZE_CLASS.get(r1["type"], "medium")
    size2 = ROOM_SIZE_CLASS.get(r2["type"], "medium")

    if size1 != size2:
        return False
    return True


def simulate_swap(rooms, i, j):
    new_rooms = [r.copy() for r in rooms]
    new_rooms[i]["type"], new_rooms[j]["type"] = new_rooms[j]["type"], new_rooms[i]["type"]
    return new_rooms


def simulate_cycle(rooms, indices):
    new_rooms = [r.copy() for r in rooms]
    types = [rooms[i]["type"] for i in indices]
    for k in range(len(indices)):
        new_rooms[indices[k]]["type"] = types[k - 1]
    return new_rooms


# ── Optimizer safety limits ──────────────────────────────────────────────
# The layout optimizer explores pair- and 3-cycle swaps. Cycle search is
# O(priority × n²) per evaluation, so it must be bounded to avoid pinning a CPU
# core on pathological inputs. These caps only affect very large plans; typical
# homes have well under MAX_CYCLE_ROOMS rooms and are optimized fully.
MAX_OPTIMIZE_ROOMS = 60   # above this, skip optimization entirely
MAX_CYCLE_ROOMS = 18      # above this, run pair swaps only (no 3-cycles)


def optimize_layout(rooms, bounds, percent, north_offset=0.0):
    original_score = percent
    best_score = original_score
    best_config = rooms
    best_move = None

    n = len(rooms)
    if n > MAX_OPTIMIZE_ROOMS:
        # Too many rooms to optimize safely — return the layout unchanged.
        return original_score, best_score, best_config, best_move

    priority = get_priority_rooms(rooms, bounds, north_offset)

    # Pair swaps
    for i in priority:
        for j in range(len(rooms)):
            if i == j:
                continue
            if not valid_swap(rooms[i], rooms[j]):
                continue

            new_rooms = simulate_swap(rooms, i, j)
            score = calculate_total_score(new_rooms, bounds, north_offset)

            if score > best_score:
                best_score = score
                best_config = new_rooms
                best_move = ("swap", i, j)

    # Cycle swaps (3-room cycles) — only for modestly sized layouts
    if n > MAX_CYCLE_ROOMS:
        return original_score, best_score, best_config, best_move

    for a in priority:
        for bi in range(len(rooms)):
            for c in range(len(rooms)):
                if len({a, bi, c}) < 3:
                    continue
                if not valid_swap(rooms[a], rooms[bi]):
                    continue
                if not valid_swap(rooms[bi], rooms[c]):
                    continue

                new_rooms = simulate_cycle(rooms, [a, bi, c])
                score = calculate_total_score(new_rooms, bounds, north_offset)

                if score > best_score:
                    best_score = score
                    best_config = new_rooms
                    best_move = ("cycle", a, bi, c)

    return original_score, best_score, best_config, best_move


def get_recommendations(rooms, bounds, rows, compliance_percent, north_offset=0.0):
    rooms_copy = [r.copy() for r in rooms]

    original_score, optimized_score, optimized_rooms, move = optimize_layout(
        rooms_copy, bounds, compliance_percent, north_offset
    )

    result = {
        "original_score": round(original_score, 2),
        "optimized_score": round(optimized_score, 2),
        "improvement": round(optimized_score - original_score, 2),
        "move": None,
        "optimized_rooms": optimized_rooms,
    }

    if move:
        if move[0] == "swap":
            i, j = move[1], move[2]
            result["move"] = {
                "type": "swap",
                "room_a": rooms[i]["type"],
                "room_b": rooms[j]["type"],
                "room_id_a": rooms[i].get("room_id"),
                "room_id_b": rooms[j].get("room_id"),
                "index_a": i,
                "index_b": j,
            }
        elif move[0] == "cycle":
            a, bi, c = move[1], move[2], move[3]
            result["move"] = {
                "type": "cycle",
                "room_a": rooms[a]["type"],
                "room_b": rooms[bi]["type"],
                "room_c": rooms[c]["type"],
                "room_id_a": rooms[a].get("room_id"),
                "room_id_b": rooms[bi].get("room_id"),
                "room_id_c": rooms[c].get("room_id"),
                "index_a": a,
                "index_b": bi,
                "index_c": c,
            }

    return result
