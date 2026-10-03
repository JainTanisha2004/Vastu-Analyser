import pytest

from fastapi import HTTPException

from geometry import (
    point_in_polygon,
    polygon_centroid,
    polygon_interior_point,
    signed_area,
    validate_polygon,
)


def test_rectangle_is_a_valid_counter_clockwise_polygon():
    rectangle = [
        {"x": 0, "y": 0}, {"x": 10, "y": 0},
        {"x": 10, "y": 10}, {"x": 0, "y": 10},
    ]
    assert signed_area(rectangle) == 100
    assert validate_polygon(rectangle) is None

def test_l_shape_centroid(l_shape_polygon):
    cx, cy = polygon_centroid(l_shape_polygon)
    assert abs(cx - 25/6) < 0.001
    assert abs(cy - 25/6) < 0.001

def test_l_shape_is_interior(l_shape_polygon):
    cx, cy = polygon_interior_point(l_shape_polygon)
    assert point_in_polygon(cx, cy, l_shape_polygon)

def test_u_shape_centroid_outside():
    u = [{"x":0,"y":0},{"x":10,"y":0},{"x":10,"y":10},{"x":8,"y":10},
         {"x":8,"y":2},{"x":2,"y":2},{"x":2,"y":10},{"x":0,"y":10}]
    cx, cy = polygon_centroid(u)
    # Centroid of U-shape is outside, interior point must be inside
    ix, iy = polygon_interior_point(u)
    assert point_in_polygon(ix, iy, u)

def test_collinear_rejected():
    with pytest.raises(HTTPException, match="collinear") as exc_info:
        validate_polygon([{"x":0,"y":0},{"x":1,"y":1},{"x":2,"y":2}])
    assert exc_info.value.status_code == 422

def test_self_intersecting_rejected():
    with pytest.raises(HTTPException, match="self-intersect") as exc_info:
        validate_polygon([
            {"x": 0, "y": 0}, {"x": 10, "y": 10},
            {"x": 5, "y": 2}, {"x": 2, "y": 8},
        ])
    assert exc_info.value.status_code == 422

def test_too_few_points_rejected():
    with pytest.raises(HTTPException, match="at least 3 points") as exc_info:
        validate_polygon([{"x":0,"y":0},{"x":1,"y":1}])
    assert exc_info.value.status_code == 422


def test_polygon_edges_count_as_inside():
    rectangle = [
        {"x": 0, "y": 0}, {"x": 10, "y": 0},
        {"x": 10, "y": 10}, {"x": 0, "y": 10},
    ]
    assert point_in_polygon(0, 5, rectangle)
    assert point_in_polygon(10, 10, rectangle)


@pytest.mark.parametrize(
    ("points", "message"),
    [
        (
            [
                {"x": 0, "y": 0}, {"x": 10, "y": 0},
                {"x": 10, "y": 0}, {"x": 0, "y": 10},
            ],
            "distinct",
        ),
        (
            [
                {"x": 0, "y": 0}, {"x": 10, "y": 0},
                {"x": float("nan"), "y": 10}, {"x": 0, "y": 10},
            ],
            "finite",
        ),
    ],
)
def test_duplicate_and_non_finite_vertices_are_rejected(points, message):
    with pytest.raises(HTTPException, match=message):
        validate_polygon(points)


def test_boundary_outside_drawing_envelope_is_rejected(sample_bounds):
    with pytest.raises(HTTPException, match="drawing area"):
        validate_polygon(
            [
                {"x": -20000, "y": 0}, {"x": 10, "y": 0},
                {"x": 10, "y": 10}, {"x": 0, "y": 10},
            ],
            drawing_bounds=sample_bounds,
        )
