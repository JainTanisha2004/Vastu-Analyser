"""Stage 02 contract tests for the source-neutral analysis pipeline.

These tests intentionally describe identity and preparation invariants rather
than image rendering details. A room_id identifies the same logical room in
all_rooms, active_rooms, scored_rooms, and rows; array position is never an
identity contract.
"""

import math

import main as main_module


def upload(client, path):
    with path.open("rb") as fixture:
        return client.post(
            "/api/upload",
            files={"file": (path.name, fixture, "application/dxf")},
        )


def test_upload_creates_a_source_neutral_session_with_stable_room_ids(
    client, synthetic_dxf_factory
):
    data = upload(client, synthetic_dxf_factory()).json()

    session = main_module.FILE_CACHE[data["file_id"]]
    assert isinstance(session, main_module.PlanSession)
    assert session.session_id == data["file_id"]
    assert session.source_kind == "dxf"
    assert session.source_name == "synthetic.dxf"
    assert session.background_reference == {
        "kind": "generated_dxf_floor_plan",
        "floor_plan_img": "synthetic-drawing-plan",
        "image_extent": data["image_extent"],
    }
    assert session.created_at

    room_ids = [room["room_id"] for room in data["rooms"]]
    assert len(room_ids) == len(set(room_ids)) == 2
    assert all(room_id and isinstance(room_id, str) for room_id in room_ids)
    assert all(room["source"] == "parsed" for room in data["rooms"])
    assert [room["room_id"] for room in session.original_rooms] == room_ids


def test_preview_and_analyze_share_preparation_and_scoring_contract(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    payload = {
        "file_id": file_id,
        "north_offset": -22.5,
        "center_mode": "boundary",
        "house_boundary": [
            {"x": 0, "y": 0},
            {"x": 60, "y": 0},
            {"x": 60, "y": 60},
            {"x": 35, "y": 35},
            {"x": 0, "y": 60},
        ],
    }

    preview = client.post("/api/preview", json=payload)
    analyze = client.post("/api/analyze", json=payload)
    assert preview.status_code == analyze.status_code == 200

    preview_data = preview.json()
    analyze_data = analyze.json()
    parity_fields = (
        "analysis_version",
        "north_offset",
        "orientation",
        "effective_center",
        "drawing_bounds",
        "active_bounds",
        "drawing_floor_plan_img",
        "drawing_image_extent",
        "image_extent",
        "all_rooms",
        "active_rooms",
        "scored_rooms",
        "rows",
        "total_score",
        "max_score",
        "compliance_percent",
        "warnings",
    )
    for field in parity_fields:
        assert preview_data[field] == analyze_data[field]

    assert preview_data["north_offset"] == 337.5
    assert [row["room_id"] for row in preview_data["rows"]] == [
        room["room_id"] for room in preview_data["active_rooms"]
    ]


def test_room_identity_survives_delete_reorder_and_boundary_filter(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    current_rooms = [
        {
            "room_id": "room-c",
            "type": "Mandir",
            "x": 90,
            "y": 90,
            "confidence": "high",
            "source": "manual",
        },
        {
            "room_id": "room-a",
            "type": "Kitchen",
            "x": 20,
            "y": 20,
            "confidence": "medium",
            "source": "parsed",
        },
    ]
    payload = {
        "file_id": file_id,
        "rooms": current_rooms,
        "center_mode": "boundary",
        "house_boundary": [
            {"x": 0, "y": 0},
            {"x": 60, "y": 0},
            {"x": 60, "y": 60},
            {"x": 0, "y": 60},
        ],
    }

    data = client.post("/api/analyze", json=payload).json()
    assert [room["room_id"] for room in data["all_rooms"]] == ["room-c", "room-a"]
    assert [room["room_id"] for room in data["active_rooms"]] == ["room-a"]
    assert [room["room_id"] for room in data["scored_rooms"]] == ["room-a"]
    assert [row["room_id"] for row in data["rows"]] == ["room-a"]
    warnings_by_code = {warning["code"]: warning for warning in data["warnings"]}
    assert warnings_by_code["rooms_excluded_by_boundary"] == {
        "code": "rooms_excluded_by_boundary",
        "message": "1 room is outside the selected house boundary and was excluded from scoring.",
        "room_ids": ["room-c"],
    }
    assert warnings_by_code["low_confidence_rooms"]["room_ids"] == ["room-a"]


def test_duplicate_room_ids_are_rejected(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    duplicate_rooms = [
        {"room_id": "duplicate", "type": "Kitchen", "x": 10, "y": 10},
        {"room_id": "duplicate", "type": "Living", "x": 20, "y": 20},
    ]
    response = client.post(
        "/api/analyze", json={"file_id": file_id, "rooms": duplicate_rooms}
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Room IDs must be unique"}


def test_legacy_rooms_without_ids_receive_deterministic_request_ids(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    payload = {
        "file_id": file_id,
        "rooms": [{"type": "Kitchen", "x": 12.25, "y": 33.75}],
    }
    first = client.post("/api/preview", json=payload).json()
    second = client.post("/api/analyze", json=payload).json()
    first_id = first["all_rooms"][0]["room_id"]
    assert first_id == second["all_rooms"][0]["room_id"]
    assert first_id


def test_orientation_is_finite_normalized_and_full_rotation_invariant(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    base = client.post("/api/analyze", json={"file_id": file_id, "north_offset": 0})
    wrapped = client.post(
        "/api/analyze", json={"file_id": file_id, "north_offset": 720}
    )
    fractional = client.post(
        "/api/analyze", json={"file_id": file_id, "north_offset": 360.25}
    )

    assert base.json()["rows"] == wrapped.json()["rows"]
    assert wrapped.json()["north_offset"] == 0
    assert fractional.json()["north_offset"] == 0.25
    assert fractional.json()["orientation"] == {
        "engine_offset_degrees": 0.25,
        "north_math_angle_degrees": 90.25,
    }

    for value in ("NaN", "Infinity", "-Infinity"):
        response = client.post(
            "/api/analyze", json={"file_id": file_id, "north_offset": value}
        )
        assert response.status_code == 422


def test_manual_center_must_be_inside_an_active_boundary(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/analyze",
        json={
            "file_id": file_id,
            "center_mode": "manual",
            "manual_center": {"x": 90, "y": 90},
            "house_boundary": [
                {"x": 0, "y": 0},
                {"x": 60, "y": 0},
                {"x": 60, "y": 60},
                {"x": 0, "y": 60},
            ],
        },
    )
    assert response.status_code == 422
    assert response.json() == {
        "detail": "Manual center must be inside the selected house boundary"
    }


def test_explicit_empty_rooms_remain_empty_in_every_collection(
    client, synthetic_dxf_factory
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    data = client.post(
        "/api/analyze", json={"file_id": file_id, "rooms": []}
    ).json()
    assert data["all_rooms"] == []
    assert data["active_rooms"] == []
    assert data["scored_rooms"] == []
    assert data["rows"] == []
    assert data["total_score"] == data["max_score"] == data["compliance_percent"] == 0


def test_room_schema_rejects_non_finite_coordinates():
    for coordinate in (math.nan, math.inf, -math.inf):
        try:
            main_module.RoomInput(
                room_id="finite-check",
                type="Kitchen",
                x=coordinate,
                y=1,
            )
        except ValueError:
            pass
        else:
            raise AssertionError("non-finite room coordinate was accepted")
