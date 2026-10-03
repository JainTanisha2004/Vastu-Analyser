"""Unit tests for the curated Vastu Shastra knowledge base and retrieval."""

from vastu_knowledge import (
    DIRECTION_SIGNIFICANCE,
    ROOM_SIGNIFICANCE,
    VASTU_KNOWLEDGE,
    REMEDIES,
    get_compliance_tier,
    get_room_remedies,
    get_relevant_knowledge,
)


def test_direction_and_room_definitions():
    assert "N" in DIRECTION_SIGNIFICANCE
    assert "NE" in DIRECTION_SIGNIFICANCE
    assert "SW" in DIRECTION_SIGNIFICANCE
    assert "SE" in DIRECTION_SIGNIFICANCE

    assert "Kitchen" in ROOM_SIGNIFICANCE
    assert "Master Bedroom" in ROOM_SIGNIFICANCE
    assert "Toilet" in ROOM_SIGNIFICANCE


def test_compliance_tiers():
    assert get_compliance_tier(85.0)["rating"].startswith("Excellent")
    assert get_compliance_tier(72.0)["rating"].startswith("Good")
    assert get_compliance_tier(50.0)["rating"].startswith("Moderate")
    assert get_compliance_tier(25.0)["rating"].startswith("Critical")


def test_room_remedies():
    remedies = get_room_remedies("Kitchen", "NE")
    assert len(remedies) >= 1
    assert any("color" in r["type"].lower() for r in remedies)

    toilet_remedies = get_room_remedies("Toilet", "NE")
    assert len(toilet_remedies) >= 1
    assert any("salt" in r["description"].lower() for r in toilet_remedies)


def test_relevant_knowledge_retrieval():
    rows = [
        {
            "room_id": "r1",
            "room_type": "Kitchen",
            "actual_zone": "SE",
            "ideal_zone": "SE",
            "score": 12.0,
            "max_score": 12.0,
            "status": "auspicious",
        },
        {
            "room_id": "r2",
            "room_type": "Toilet",
            "actual_zone": "NE",
            "ideal_zone": "NW",
            "score": -10.0,
            "max_score": 10.0,
            "status": "unfavourable",
        },
    ]
    optimization = {
        "move": {"type": "swap", "room1_type": "Kitchen", "room2_type": "Toilet"},
        "original_score": 50.0,
        "optimized_score": 75.0,
        "improvement": 25.0,
    }

    result = get_relevant_knowledge(rows, compliance_percent=50.0, optimization=optimization)

    assert result["compliance_percent"] == 50.0
    assert len(result["auspicious_rooms"]) == 1
    assert result["auspicious_rooms"][0]["room_type"] == "Kitchen"

    assert len(result["unfavourable_rooms"]) == 1
    assert result["unfavourable_rooms"][0]["room_type"] == "Toilet"
    assert len(result["unfavourable_rooms"][0]["remedies"]) > 0

    assert result["optimization"]["improvement"] == 25.0
