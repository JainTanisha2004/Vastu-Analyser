"""Bounded polygon geometry used by the shared analysis preparation path."""

import math

from fastapi import HTTPException


MAX_BOUNDARY_VERTICES = 200
RELATIVE_AREA_EPSILON = 1e-10
RELATIVE_COORDINATE_EPSILON = 1e-9
BOUNDARY_ENVELOPE_SPANS = 1.0


def signed_area(points):
    """Return shoelace area; positive values indicate counter-clockwise order."""
    area = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        area += point["x"] * next_point["y"]
        area -= next_point["x"] * point["y"]
    return area / 2


def polygon_centroid(points):
    """Return the area centroid, falling back to the vertex mean at zero area."""
    area = signed_area(points)
    if abs(area) < 1e-12:
        return (
            sum(point["x"] for point in points) / len(points),
            sum(point["y"] for point in points) / len(points),
        )

    cx = 0.0
    cy = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        cross = point["x"] * next_point["y"] - next_point["x"] * point["y"]
        cx += (point["x"] + next_point["x"]) * cross
        cy += (point["y"] + next_point["y"]) * cross
    return cx / (6 * area), cy / (6 * area)


def _coordinate_scale(*points):
    return max(
        1.0,
        *(abs(value) for point in points for value in (point["x"], point["y"])),
    )


def point_on_segment(px, py, start, end):
    """Return True when a point lies on a closed line segment."""
    point = {"x": px, "y": py}
    scale = _coordinate_scale(point, start, end)
    tolerance = scale * RELATIVE_COORDINATE_EPSILON
    cross = ((px - start["x"]) * (end["y"] - start["y"]) -
             (py - start["y"]) * (end["x"] - start["x"]))
    segment_length = max(1.0, math.hypot(end["x"] - start["x"], end["y"] - start["y"]))
    if abs(cross) > tolerance * segment_length:
        return False
    return (
        min(start["x"], end["x"]) - tolerance <= px <= max(start["x"], end["x"]) + tolerance
        and min(start["y"], end["y"]) - tolerance <= py <= max(start["y"], end["y"]) + tolerance
    )


def point_in_polygon(px, py, points):
    """Ray-casting point-in-polygon test that treats the boundary as inside."""
    if not points:
        return False

    inside = False
    previous = points[-1]
    for current in points:
        if point_on_segment(px, py, previous, current):
            return True
        if ((current["y"] > py) != (previous["y"] > py)):
            intersection_x = (
                (previous["x"] - current["x"])
                * (py - current["y"])
                / (previous["y"] - current["y"])
                + current["x"]
            )
            if px < intersection_x:
                inside = not inside
        previous = current
    return inside


def _orientation(first, second, third):
    return ((second["x"] - first["x"]) * (third["y"] - first["y"]) -
            (second["y"] - first["y"]) * (third["x"] - first["x"]))


def segments_intersect(first_start, first_end, second_start, second_end):
    """Return True for proper, touching, or collinear-overlapping segments."""
    values = (
        _orientation(first_start, first_end, second_start),
        _orientation(first_start, first_end, second_end),
        _orientation(second_start, second_end, first_start),
        _orientation(second_start, second_end, first_end),
    )
    scale = _coordinate_scale(first_start, first_end, second_start, second_end)
    tolerance = scale * scale * RELATIVE_COORDINATE_EPSILON
    signs = [0 if abs(value) <= tolerance else (1 if value > 0 else -1) for value in values]

    if signs[0] != signs[1] and signs[2] != signs[3]:
        return True
    if signs[0] == 0 and point_on_segment(second_start["x"], second_start["y"], first_start, first_end):
        return True
    if signs[1] == 0 and point_on_segment(second_end["x"], second_end["y"], first_start, first_end):
        return True
    if signs[2] == 0 and point_on_segment(first_start["x"], first_start["y"], second_start, second_end):
        return True
    if signs[3] == 0 and point_on_segment(first_end["x"], first_end["y"], second_start, second_end):
        return True
    return False


def is_self_intersecting(points):
    """Detect intersection between non-adjacent polygon edges."""
    count = len(points)
    for first_index in range(count):
        first_next = (first_index + 1) % count
        for second_index in range(first_index + 1, count):
            second_next = (second_index + 1) % count
            if first_index == second_index or first_next == second_index or second_next == first_index:
                continue
            if segments_intersect(
                points[first_index], points[first_next],
                points[second_index], points[second_next],
            ):
                return True
    return False


def _points_are_close(first, second, tolerance):
    return math.hypot(first["x"] - second["x"], first["y"] - second["y"]) <= tolerance


def validate_polygon(points, drawing_bounds=None):
    """Validate a simple convex or concave polygon and return it unchanged.

    The minimum area is relative to drawing scale (`scale² * 1e-10`) and at
    most 200 vertices are accepted. If drawing bounds are supplied, vertices
    may extend by one full drawing span on each side, which is ample for a
    hand-drawn perimeter while bounding pathological clipping work.
    """
    if len(points) < 3:
        raise HTTPException(status_code=422, detail="Boundary must have at least 3 points")
    if len(points) > MAX_BOUNDARY_VERTICES:
        raise HTTPException(
            status_code=422,
            detail=f"Boundary may contain at most {MAX_BOUNDARY_VERTICES} points",
        )
    if any(
        not (math.isfinite(point["x"]) and math.isfinite(point["y"]))
        for point in points
    ):
        raise HTTPException(status_code=422, detail="Boundary coordinates must be finite")

    xs = [point["x"] for point in points]
    ys = [point["y"] for point in points]
    polygon_scale = max(max(xs) - min(xs), max(ys) - min(ys), 1.0)
    tolerance = polygon_scale * RELATIVE_COORDINATE_EPSILON
    for index, point in enumerate(points):
        if any(_points_are_close(point, earlier, tolerance) for earlier in points[:index]):
            raise HTTPException(
                status_code=422,
                detail="Boundary vertices must be distinct; duplicate or zero-length edges are not allowed",
            )

    if drawing_bounds:
        span_x = max(drawing_bounds["max_x"] - drawing_bounds["min_x"], 1.0)
        span_y = max(drawing_bounds["max_y"] - drawing_bounds["min_y"], 1.0)
        envelope = {
            "min_x": drawing_bounds["min_x"] - span_x * BOUNDARY_ENVELOPE_SPANS,
            "max_x": drawing_bounds["max_x"] + span_x * BOUNDARY_ENVELOPE_SPANS,
            "min_y": drawing_bounds["min_y"] - span_y * BOUNDARY_ENVELOPE_SPANS,
            "max_y": drawing_bounds["max_y"] + span_y * BOUNDARY_ENVELOPE_SPANS,
        }
        if any(
            point["x"] < envelope["min_x"] or point["x"] > envelope["max_x"]
            or point["y"] < envelope["min_y"] or point["y"] > envelope["max_y"]
            for point in points
        ):
            raise HTTPException(
                status_code=422,
                detail="Boundary points are too far outside the uploaded drawing area",
            )
        polygon_scale = max(span_x, span_y, 1.0)

    if abs(signed_area(points)) <= polygon_scale * polygon_scale * RELATIVE_AREA_EPSILON:
        raise HTTPException(status_code=422, detail="Boundary points are collinear or area is too small")
    if is_self_intersecting(points):
        raise HTTPException(status_code=422, detail="Boundary polygon must not self-intersect")
    return None


def polygon_interior_point(points):
    """Return a deterministic point inside a valid convex or concave polygon."""
    cx, cy = polygon_centroid(points)
    if point_in_polygon(cx, cy, points):
        return cx, cy

    xs = [point["x"] for point in points]
    ys = [point["y"] for point in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    best = None
    best_distance = float("inf")
    for x_index in range(20):
        for y_index in range(20):
            px = min_x + (max_x - min_x) * (x_index + 0.5) / 20
            py = min_y + (max_y - min_y) * (y_index + 0.5) / 20
            if point_in_polygon(px, py, points):
                distance = (px - cx) ** 2 + (py - cy) ** 2
                if distance < best_distance:
                    best = (px, py)
                    best_distance = distance
    if best:
        return best

    # A valid polygon always has boundary points; this defensive fallback is
    # on its first edge and is therefore accepted by point_in_polygon.
    return (
        (points[0]["x"] + points[1]["x"]) / 2,
        (points[0]["y"] + points[1]["y"]) / 2,
    )


def get_intersection(first_start, first_end, second_start, second_end):
    """Return the intersection of two non-parallel closed segments, if any."""
    first_dx = first_end["x"] - first_start["x"]
    first_dy = first_end["y"] - first_start["y"]
    second_dx = second_end["x"] - second_start["x"]
    second_dy = second_end["y"] - second_start["y"]
    denominator = -second_dx * first_dy + first_dx * second_dy
    if abs(denominator) < 1e-12:
        return None

    s = (-first_dy * (first_start["x"] - second_start["x"])
         + first_dx * (first_start["y"] - second_start["y"])) / denominator
    t = (second_dx * (first_start["y"] - second_start["y"])
         - second_dy * (first_start["x"] - second_start["x"])) / denominator
    if -1e-12 <= s <= 1 + 1e-12 and -1e-12 <= t <= 1 + 1e-12:
        return {
            "x": first_start["x"] + t * first_dx,
            "y": first_start["y"] + t * first_dy,
        }
    return None


def clip_line_segment_to_polygon(start, end, polygon):
    """Clip one segment to a validated polygon, returning inside subsegments."""
    intersections = [start, end]
    for index, polygon_start in enumerate(polygon):
        polygon_end = polygon[(index + 1) % len(polygon)]
        intersection = get_intersection(start, end, polygon_start, polygon_end)
        if intersection:
            intersections.append(intersection)

    intersections.sort(
        key=lambda point: math.hypot(point["x"] - start["x"], point["y"] - start["y"])
    )
    unique_points = []
    for point in intersections:
        if not unique_points or not _points_are_close(point, unique_points[-1], 1e-7):
            unique_points.append(point)

    clipped_segments = []
    for index in range(len(unique_points) - 1):
        first = unique_points[index]
        second = unique_points[index + 1]
        midpoint = {
            "x": (first["x"] + second["x"]) / 2,
            "y": (first["y"] + second["y"]) / 2,
        }
        if point_in_polygon(midpoint["x"], midpoint["y"], polygon):
            clipped_segments.append([
                (first["x"], first["y"]),
                (second["x"], second["y"]),
            ])
    return clipped_segments
