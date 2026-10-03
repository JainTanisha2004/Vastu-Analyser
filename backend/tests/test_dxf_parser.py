import base64
import io

import pytest
from PIL import Image

import dxf_parser
from dxf_parser import (
    compute_image_extent,
    generate_floor_plan_image,
    generate_floor_plan_images,
    process_dxf,
)

def test_image_extent_is_square():
    bounds = {"min_x": 0, "max_x": 100, "min_y": 0, "max_y": 50}
    ext = compute_image_extent(bounds)
    assert ext["x_max"] - ext["x_min"] == ext["y_max"] - ext["y_min"]  # square
    assert ext["x_max"] - ext["x_min"] == 100 * 1.5  # max_span(100) * 1.5 = 150


def test_image_extent_uses_effective_center():
    bounds = {"min_x": 0, "max_x": 100, "min_y": 0, "max_y": 50, "cx": 25, "cy": 25}
    extent = compute_image_extent(bounds)
    assert extent == {"x_min": -75.0, "x_max": 125.0, "y_min": -75.0, "y_max": 125.0}


def test_process_dxf_extracts_walls_labels_and_wall_bounds(synthetic_dxf_factory):
    path = synthetic_dxf_factory()
    walls, rooms, bounds = process_dxf(path)

    assert len(walls) == 6
    assert bounds == {"min_x": 0.0, "max_x": 100.0, "min_y": 0.0, "max_y": 100.0,
                      "cx": 50.0, "cy": 50.0}
    assert rooms == [
        {"type": "Kitchen", "x": 25.0, "y": 25.0, "confidence": "high"},
        {"type": "Master Bedroom", "x": 75.0, "y": 75.0, "confidence": "high"},
    ]


def test_process_dxf_accepts_alias_case_and_spacing_variations(synthetic_dxf_factory):
    path = synthetic_dxf_factory(
        name="aliases.dxf",
        labels=[
            ("  kItChEn  ", 25, 25),
            ("MBR", 75, 75),
            ("WASH   AREA", 25, 75),
        ],
    )
    _, rooms, _ = process_dxf(path)
    assert [(room["type"], room["x"], room["y"]) for room in rooms] == [
        ("Kitchen", 25.0, 25.0),
        ("Master Bedroom", 75.0, 75.0),
        ("Wash", 25.0, 75.0),
    ]
    assert all(room["confidence"] == "high" for room in rooms)


def test_process_dxf_without_recognizable_labels_returns_empty_rooms(synthetic_dxf_factory):
    path = synthetic_dxf_factory(
        name="no-room-labels.dxf",
        labels=[("NORTH", 25, 25), ("12/05/2026", 75, 75), ("Scale 1:100", 25, 75)],
    )
    walls, rooms, bounds = process_dxf(path)
    assert len(walls) == 6
    assert rooms == []
    assert bounds["cx"] == 50.0

def test_image_dimensions():
    walls = []
    rooms = []
    image_extent = {"x_min": 0, "x_max": 1000, "y_min": 0, "y_max": 1000}
    effective_center = {"x": 500, "y": 500}
    fp_b64, zm_b64 = generate_floor_plan_images(walls, rooms, image_extent, effective_center)
    drawing_b64 = generate_floor_plan_image(walls, image_extent)
    floor_plan = Image.open(io.BytesIO(base64.b64decode(fp_b64)))
    zone_map = Image.open(io.BytesIO(base64.b64decode(zm_b64)))
    drawing_plan = Image.open(io.BytesIO(base64.b64decode(drawing_b64)))
    assert floor_plan.size == (1500, 1500)
    assert zone_map.size == (1500, 1500)
    assert drawing_plan.size == (1500, 1500)
    assert drawing_b64 != fp_b64


def test_closed_lwpolyline_includes_closing_edge_and_skips_duplicate_vertices(tmp_path):
    import ezdxf

    path = tmp_path / "closed-polyline.dxf"
    doc = ezdxf.new("R2010")
    modelspace = doc.modelspace()
    modelspace.add_lwpolyline(
        [(0, 0), (100, 0), (100, 100), (100, 100), (0, 100)],
        close=True,
    )
    doc.saveas(path)

    walls, rooms, bounds, metadata = process_dxf(path, include_metadata=True)
    assert rooms == []
    assert walls == [
        [(0.0, 0.0), (100.0, 0.0)],
        [(100.0, 0.0), (100.0, 100.0)],
        [(100.0, 100.0), (0.0, 100.0)],
        [(0.0, 100.0), (0.0, 0.0)],
    ]
    assert bounds["cx"] == bounds["cy"] == 50.0
    assert metadata["room_geometry"] == "text_insertion_points"


def test_unsupported_entities_are_disclosed_in_parse_metadata(tmp_path):
    import ezdxf

    path = tmp_path / "unsupported-entities.dxf"
    doc = ezdxf.new("R2010")
    modelspace = doc.modelspace()
    modelspace.add_line((0, 0), (100, 0))
    modelspace.add_arc((50, 50), radius=20, start_angle=0, end_angle=90)
    doc.saveas(path)

    _, _, _, metadata = process_dxf(path, include_metadata=True)
    assert metadata["ignored_entity_types"] == ["ARC"]
    assert metadata["warnings"] == [
        "Ignored unsupported model-space entity types: ARC."
    ]


def test_modelspace_entity_limit_is_enforced_during_iteration(tmp_path, monkeypatch):
    import ezdxf

    path = tmp_path / "entity-limit.dxf"
    doc = ezdxf.new("R2010")
    modelspace = doc.modelspace()
    for index in range(3):
        modelspace.add_line((index, 0), (index, 10))
    doc.saveas(path)
    monkeypatch.setattr(dxf_parser, "MAX_MODELSPACE_ENTITIES", 2)

    with pytest.raises(ValueError, match="too many model-space entities"):
        process_dxf(path)


def test_polyline_vertex_limit_is_enforced_before_segment_expansion(tmp_path, monkeypatch):
    import ezdxf

    path = tmp_path / "polyline-limit.dxf"
    doc = ezdxf.new("R2010")
    doc.modelspace().add_lwpolyline([(0, 0), (10, 0), (10, 10)])
    doc.saveas(path)
    monkeypatch.setattr(dxf_parser, "MAX_POLYLINE_VERTICES", 2)

    with pytest.raises(ValueError, match="too many polyline vertices"):
        process_dxf(path)

