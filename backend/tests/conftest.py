import os
import sys
from pathlib import Path

import ezdxf
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main as main_module

@pytest.fixture
def sample_bounds():
    return {"min_x": 0, "max_x": 10000, "min_y": 0, "max_y": 8000,
            "auto_cx": 5000, "auto_cy": 4000, "cx": 5000, "cy": 4000}

@pytest.fixture
def sample_rooms():
    return [
        {"type": "Kitchen", "x": 9000, "y": 4000},   # East of center
        {"type": "Mandir", "x": 5000, "y": 7000},     # North of center
        {"type": "Master Bedroom", "x": 1000, "y": 1000},  # SW of center
    ]

@pytest.fixture
def l_shape_polygon():
    return [
        {"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 5},
        {"x": 5, "y": 5}, {"x": 5, "y": 10}, {"x": 0, "y": 10},
    ]


@pytest.fixture
def duplicate_point_polygon():
    return [
        {"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 10},
        {"x": 10, "y": 10}, {"x": 0, "y": 10},
    ]


@pytest.fixture
def non_finite_polygon():
    return [
        {"x": 0, "y": 0}, {"x": 10, "y": 0},
        {"x": float("nan"), "y": 10}, {"x": 0, "y": 10},
    ]


@pytest.fixture
def synthetic_dxf_factory(tmp_path):
    """Build small synthetic ASCII DXFs in arbitrary drawing units.

    The plan extent is 0..100 on both axes. Default room insertion points are
    also their expected centroids for parser characterization: Kitchen (25, 25)
    and Master Bedroom (75, 75). No personal or real floor-plan data is used.
    """

    def build(name="synthetic.dxf", labels=None):
        path = Path(tmp_path) / name
        doc = ezdxf.new("R2010")
        modelspace = doc.modelspace()

        walls = [
            ((0, 0), (100, 0)),
            ((100, 0), (100, 100)),
            ((100, 100), (0, 100)),
            ((0, 100), (0, 0)),
            ((50, 0), (50, 100)),
            ((0, 50), (100, 50)),
        ]
        for start, end in walls:
            modelspace.add_line(start, end, dxfattribs={"layer": "WALLS"})

        if labels is None:
            labels = [
                ("Kitchen", 25, 25),
                ("Master Bedroom", 75, 75),
                ("Project title outside plan", 200, 200),
            ]
        for text, x, y in labels:
            modelspace.add_text(
                text,
                dxfattribs={"insert": (x, y), "height": 2.5, "layer": "LABELS"},
            )

        doc.saveas(path)
        return path

    return build


@pytest.fixture(autouse=True)
def isolate_upload_cache(tmp_path, monkeypatch):
    """Give every test a fresh upload directory and in-memory file cache."""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    main_module.FILE_CACHE.clear()
    monkeypatch.setattr(main_module, "TEMP_DIR", str(upload_dir))
    yield
    for file_id in list(main_module.FILE_CACHE):
        main_module._evict_cache_entry(file_id)
    main_module.FILE_CACHE.clear()
    assert list(upload_dir.iterdir()) == []


@pytest.fixture
def client(monkeypatch):
    """Fast API client with deterministic image payloads for endpoint tests.

    The real Matplotlib renderer is exercised in test_dxf_parser.py. Endpoint
    contract tests only need to prove that both image fields are populated.
    """
    monkeypatch.setattr(
        main_module,
        "generate_floor_plan_image",
        lambda *args, **kwargs: "synthetic-drawing-plan",
    )
    monkeypatch.setattr(
        main_module,
        "generate_floor_plan_images",
        lambda *args, **kwargs: ("synthetic-floor-plan", "synthetic-zone-map"),
    )
    with TestClient(main_module.app) as test_client:
        yield test_client
