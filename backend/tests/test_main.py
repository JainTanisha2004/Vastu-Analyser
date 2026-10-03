import math

import main as main_module


COMMON_ANALYSIS_KEYS = {
    "analysis_version",
    "rule_version",
    "session",
    "center_mode",
    "north_offset",
    "orientation",
    "rows",
    "total_score",
    "max_score",
    "compliance_percent",
    "effective_center",
    "drawing_bounds",
    "active_bounds",
    "drawing_image_extent",
    "image_extent",
    "house_boundary",
    "all_rooms",
    "active_rooms",
    "scored_rooms",
    "drawing_floor_plan_img",
    "floor_plan_img",
    "zone_map_img",
    "generated_images",
    "warnings",
    "excluded_room_ids",
}
ANALYZE_KEYS = COMMON_ANALYSIS_KEYS | {
    "optimization",
    "optimized_floor_plan_img",
    "optimized_zone_map_img",
}
PREVIEW_KEYS = COMMON_ANALYSIS_KEYS


def upload(client, path, filename=None):
    with path.open("rb") as fixture:
        return client.post(
            "/api/upload",
            files={"file": (filename or path.name, fixture, "application/dxf")},
        )


def test_local_launcher_origin_is_allowed(client):
    response = client.options(
        "/",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_root_health_contract(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Vastu Analyser API is running"}


def test_upload_contract_and_cache_file(client, synthetic_dxf_factory):
    response = upload(client, synthetic_dxf_factory(name="labelled-plan.dxf"))
    assert response.status_code == 200

    data = response.json()
    assert set(data) == {
        "file_id", "filename", "source_kind", "drawing_bounds", "image_extent",
        "rooms", "wall_count", "warnings", "source_metadata",
    }
    assert data["filename"] == "labelled-plan.dxf"
    assert data["wall_count"] == 6
    assert data["drawing_bounds"] == {
        "min_x": 0.0, "max_x": 100.0, "min_y": 0.0, "max_y": 100.0,
        "cx": 50.0, "cy": 50.0, "auto_cx": 50.0, "auto_cy": 50.0,
    }
    assert data["image_extent"] == {"x_min": -25.0, "x_max": 125.0,
                                     "y_min": -25.0, "y_max": 125.0}
    assert [room["type"] for room in data["rooms"]] == ["Kitchen", "Master Bedroom"]
    assert all(
        set(room) == {"room_id", "type", "x", "y", "confidence", "source"}
        for room in data["rooms"]
    )
    assert all(room["source"] == "parsed" for room in data["rooms"])
    assert data["file_id"] in main_module.FILE_CACHE
    assert main_module.FILE_CACHE[data["file_id"]].source_path.startswith(main_module.TEMP_DIR)


def test_upload_without_room_labels_succeeds(client, synthetic_dxf_factory):
    response = upload(client, synthetic_dxf_factory(name="empty.dxf", labels=[]))
    assert response.status_code == 200
    assert response.json()["rooms"] == []


def test_upload_rejects_unsupported_extension(client):
    response = client.post(
        "/api/upload",
        files={"file": ("plan.png", b"synthetic", "image/png")},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Only .dxf files are supported"}
    assert main_module.FILE_CACHE == {}


def test_upload_rejects_malformed_dxf_and_removes_temp_file(client):
    response = client.post(
        "/api/upload",
        files={"file": ("malformed.dxf", b"this is not a DXF", "application/dxf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Failed to parse DXF file"
    assert main_module.FILE_CACHE == {}


def test_upload_rejects_oversized_file(client):
    response = client.post(
        "/api/upload",
        files={"file": ("oversized.dxf", b"x" * (70 * 1024 * 1024 + 1), "application/dxf")},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "File too large. Maximum size is 70MB"}
    assert main_module.FILE_CACHE == {}


def test_missing_session_has_consistent_failure_shape(client):
    payload = {"file_id": "expired-session"}
    for endpoint in ("/api/preview", "/api/analyze"):
        response = client.post(endpoint, json=payload)
        assert response.status_code == 404
        assert response.json() == {"detail": "File not found. Please upload again."}


def test_analyze_automatic_center_and_response_contract(client, synthetic_dxf_factory):
    uploaded = upload(client, synthetic_dxf_factory()).json()
    response = client.post("/api/analyze", json={"file_id": uploaded["file_id"]})
    assert response.status_code == 200
    data = response.json()
    assert set(data) == ANALYZE_KEYS
    assert data["effective_center"] == {"x": 50.0, "y": 50.0}
    assert data["drawing_floor_plan_img"] == "synthetic-drawing-plan"
    assert data["floor_plan_img"] == "synthetic-floor-plan"
    assert data["zone_map_img"] == "synthetic-zone-map"


def test_preview_response_contract(client, synthetic_dxf_factory):
    uploaded = upload(client, synthetic_dxf_factory()).json()
    response = client.post("/api/preview", json={"file_id": uploaded["file_id"]})
    assert response.status_code == 200
    assert set(response.json()) == PREVIEW_KEYS
    assert response.json()["effective_center"] == {"x": 50.0, "y": 50.0}


def test_manual_center_requires_coordinates(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/analyze",
        json={"file_id": file_id, "center_mode": "manual"},
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Manual mode requires manual_center"}


def test_manual_center_and_decimal_north_offset_are_accepted(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/analyze",
        json={
            "file_id": file_id,
            "north_offset": 22.5,
            "center_mode": "manual",
            "manual_center": {"x": 42.25, "y": 24.75},
        },
    )
    assert response.status_code == 200
    assert response.json()["effective_center"] == {"x": 42.25, "y": 24.75}


def test_non_finite_manual_center_is_rejected(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/analyze",
        json={
            "file_id": file_id,
            "center_mode": "manual",
            "manual_center": {"x": "NaN", "y": 24.0},
        },
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Center coordinates must be finite"}


def test_invalid_center_mode_is_rejected(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/preview",
        json={"file_id": file_id, "center_mode": "centroid-ish"},
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid center mode"}


def test_boundary_mode_requires_three_points(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    response = client.post(
        "/api/analyze",
        json={
            "file_id": file_id,
            "center_mode": "boundary",
            "house_boundary": [{"x": 0, "y": 0}, {"x": 10, "y": 10}],
        },
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Boundary must have at least 3 points"}


def test_boundary_filters_rooms_and_returns_effective_geometry(client, synthetic_dxf_factory):
    uploaded = upload(client, synthetic_dxf_factory()).json()
    file_id = uploaded["file_id"]
    boundary = [
        {"x": 0, "y": 0}, {"x": 60, "y": 0},
        {"x": 60, "y": 60}, {"x": 0, "y": 60},
    ]
    response = client.post(
        "/api/analyze",
        json={"file_id": file_id, "center_mode": "boundary", "house_boundary": boundary},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["effective_center"] == {"x": 30.0, "y": 30.0}
    assert data["drawing_image_extent"] == uploaded["image_extent"]
    assert data["generated_images"]["drawing_floor_plan_img"] == "synthetic-drawing-plan"
    assert data["generated_images"]["drawing_image_extent"] == uploaded["image_extent"]
    assert [room["type"] for room in data["active_rooms"]] == ["Kitchen"]
    assert set(data["active_bounds"]) == {
        "min_x", "max_x", "min_y", "max_y", "cx", "cy", "auto_cx", "auto_cy"
    }
    assert set(data["image_extent"]) == {"x_min", "x_max", "y_min", "y_max"}


def test_edited_room_array_reaches_analyze_without_mutating_cache(client, synthetic_dxf_factory):
    uploaded = upload(client, synthetic_dxf_factory()).json()
    custom_rooms = [{"type": "Mandir", "x": 12.5, "y": 87.5, "confidence": "medium"}]
    response = client.post(
        "/api/analyze",
        json={"file_id": uploaded["file_id"], "rooms": custom_rooms},
    )
    assert response.status_code == 200
    active_room = response.json()["active_rooms"][0]
    assert {key: active_room[key] for key in custom_rooms[0]} == custom_rooms[0]
    assert active_room["room_id"]
    assert active_room["source"] == "manual"
    assert [room["type"] for room in main_module.FILE_CACHE[uploaded["file_id"]].original_rooms] == [
        "Kitchen", "Master Bedroom"
    ]


def test_empty_rooms_and_omitted_rooms_are_distinct_for_analyze(client, synthetic_dxf_factory):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    omitted = client.post("/api/analyze", json={"file_id": file_id})
    empty = client.post("/api/analyze", json={"file_id": file_id, "rooms": []})
    assert [room["type"] for room in omitted.json()["active_rooms"]] == ["Kitchen", "Master Bedroom"]
    assert empty.json()["active_rooms"] == []
    assert empty.json()["rows"] == []


def test_preview_uses_provided_rooms_including_an_explicit_empty_array(
    client, synthetic_dxf_factory, monkeypatch
):
    file_id = upload(client, synthetic_dxf_factory()).json()["file_id"]
    observed_rooms = []

    def capture_rooms(rooms, bounds, north_offset):
        observed_rooms.append([room.copy() for room in rooms])
        return [], 0, 0, 0

    monkeypatch.setattr(main_module, "run_vastu_analysis", capture_rooms)
    custom_rooms = [{"type": "Living", "x": 20.5, "y": 30.25, "confidence": "low"}]

    assert client.post("/api/preview", json={"file_id": file_id, "rooms": custom_rooms}).status_code == 200
    assert client.post("/api/preview", json={"file_id": file_id, "rooms": []}).status_code == 200
    assert client.post("/api/preview", json={"file_id": file_id}).status_code == 200

    assert [room["type"] for room in observed_rooms[0]] == ["Living"]
    assert observed_rooms[0][0]["confidence"] == "low"
    assert observed_rooms[0][0]["source"] == "manual"
    assert observed_rooms[0][0]["room_id"]
    assert observed_rooms[1] == []
    assert [room["type"] for room in observed_rooms[2]] == [
        "Kitchen", "Master Bedroom",
    ]
    assert all(room["source"] == "parsed" for room in observed_rooms[2])


def test_request_schema_preserves_fractional_room_coordinates():
    request = main_module.AnalyzeRequest(
        file_id="synthetic",
        rooms=[{"type": "Kitchen", "x": 1.25, "y": 2.75, "confidence": "high"}],
    )
    assert request.rooms[0].x == 1.25
    assert request.rooms[0].y == 2.75
    assert math.isfinite(request.rooms[0].x)
