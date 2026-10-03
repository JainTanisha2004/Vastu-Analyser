from vastu_engine import calculate_room_score
from constants import VASTU_RULES

def test_room_score_east_with_offset_90(sample_bounds):
    """Backend north_offset=90: East room → South zone."""
    room = {"type": "Kitchen", "x": 9000, "y": 4000}  # East of center
    rule = VASTU_RULES["Kitchen"]
    angle, score = calculate_room_score(room, sample_bounds, rule, north_offset=90)
    assert 265 < angle < 275  # ~270° = South

def test_room_score_east_with_offset_270(sample_bounds):
    """Backend north_offset=270: East room → North zone."""
    room = {"type": "Kitchen", "x": 9000, "y": 4000}
    rule = VASTU_RULES["Kitchen"]
    angle, score = calculate_room_score(room, sample_bounds, rule, north_offset=270)
    assert 85 < angle < 95  # ~90° = North


from vastu_engine import calculate_total_score, get_recommendations, run_vastu_analysis

def test_total_score_changes_with_offset(sample_bounds, sample_rooms):
    score_0 = calculate_total_score(sample_rooms, sample_bounds, north_offset=0)
    score_90 = calculate_total_score(sample_rooms, sample_bounds, north_offset=90)
    assert score_0 != score_90

def test_optimization_uses_offset(sample_bounds, sample_rooms):
    rows_0, _, _, pct_0 = run_vastu_analysis(sample_rooms, sample_bounds, north_offset=0)
    rows_90, _, _, pct_90 = run_vastu_analysis(sample_rooms, sample_bounds, north_offset=90)
    rec_0 = get_recommendations(sample_rooms, sample_bounds, rows_0, pct_0, north_offset=0)
    rec_90 = get_recommendations(sample_rooms, sample_bounds, rows_90, pct_90, north_offset=90)
    # At least the scores should differ
    assert rec_0["original_score"] != rec_90["original_score"]


from vastu_engine import (
    optimize_layout, detect_room_type_with_confidence, MAX_OPTIMIZE_ROOMS,
)


def test_optimizer_skips_oversized_layouts(sample_bounds):
    """Layouts larger than MAX_OPTIMIZE_ROOMS return unchanged (DoS guard)."""
    rooms = [{"type": "Kitchen", "x": 9000, "y": 4000}
             for _ in range(MAX_OPTIMIZE_ROOMS + 5)]
    orig, best, config, move = optimize_layout(rooms, sample_bounds, 50.0)
    assert move is None
    assert best == orig
    assert config is rooms


def test_detect_confidence_levels():
    assert detect_room_type_with_confidence("Kitchen")[1] == "high"
    assert detect_room_type_with_confidence("Xyzzy Lounge Spot")[1] in ("high", "medium")
    assert detect_room_type_with_confidence("Zxqwv")[0] == "Generic Room"
    assert detect_room_type_with_confidence("Zxqwv")[1] == "low"


