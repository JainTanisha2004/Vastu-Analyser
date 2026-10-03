"""Bounded DXF parsing and deterministic floor-plan image rendering."""

import base64
import io
import math

import ezdxf
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

from constants import CORE_DIRECTIONS
from vastu_engine import (
    detect_room_type_with_confidence,
    is_valid_room_text,
    strip_mtext_formatting,
)


IMAGE_DPI = 150
IMAGE_INCHES = 10  # 1500x1500 px
MAX_MODELSPACE_ENTITIES = 100_000
MAX_POLYLINE_VERTICES = 250_000
ZERO_LENGTH_EPSILON = 1e-9


def compute_image_extent(drawing_bounds):
    """Return a square extent containing bounds around the effective centre."""
    span_x = drawing_bounds["max_x"] - drawing_bounds["min_x"]
    span_y = drawing_bounds["max_y"] - drawing_bounds["min_y"]
    max_span = max(span_x, span_y)
    padding = max_span * 0.25
    cx = drawing_bounds.get(
        "cx", (drawing_bounds["min_x"] + drawing_bounds["max_x"]) / 2
    )
    cy = drawing_bounds.get(
        "cy", (drawing_bounds["min_y"] + drawing_bounds["max_y"]) / 2
    )
    dist_x = max(
        abs(drawing_bounds["max_x"] - cx), abs(drawing_bounds["min_x"] - cx)
    )
    dist_y = max(
        abs(drawing_bounds["max_y"] - cy), abs(drawing_bounds["min_y"] - cy)
    )
    half = max(dist_x, dist_y) + padding
    return {
        "x_min": cx - half,
        "x_max": cx + half,
        "y_min": cy - half,
        "y_max": cy + half,
    }


def _is_zero_length(start, end):
    return math.hypot(end[0] - start[0], end[1] - start[1]) <= ZERO_LENGTH_EPSILON


def process_dxf(filename, include_metadata=False):
    """Parse bounded model-space walls and room-label insertion points.

    LINE and LWPOLYLINE are supported as wall segments. TEXT and MTEXT are
    supported as room candidates. Other entity types are ignored and reported
    in metadata. The legacy three-value return remains the default.
    """
    doc = ezdxf.readfile(filename)
    modelspace = doc.modelspace()
    entities = []
    for entity_count, entity in enumerate(modelspace, start=1):
        if entity_count > MAX_MODELSPACE_ENTITIES:
            raise ValueError(
                "DXF contains too many model-space entities "
                f"(maximum {MAX_MODELSPACE_ENTITIES})."
            )
        entities.append(entity)

    lines = []
    rooms = []
    wall_xs = []
    wall_ys = []
    ignored_entity_types = set()
    polyline_vertex_count = 0

    def append_segment(start, end):
        start_xy = (float(start[0]), float(start[1]))
        end_xy = (float(end[0]), float(end[1]))
        if _is_zero_length(start_xy, end_xy):
            return
        lines.append([start_xy, end_xy])
        wall_xs.extend([start_xy[0], end_xy[0]])
        wall_ys.extend([start_xy[1], end_xy[1]])

    for entity in entities:
        entity_type = entity.dxftype()
        if entity_type == "LINE":
            append_segment(entity.dxf.start, entity.dxf.end)
        elif entity_type == "LWPOLYLINE":
            points = [(point[0], point[1]) for point in entity.get_points()]
            polyline_vertex_count += len(points)
            if polyline_vertex_count > MAX_POLYLINE_VERTICES:
                raise ValueError(
                    f"DXF contains too many polyline vertices (maximum {MAX_POLYLINE_VERTICES})."
                )
            for index in range(len(points) - 1):
                append_segment(points[index], points[index + 1])
            if entity.closed and len(points) > 1:
                append_segment(points[-1], points[0])
        elif entity_type not in {"TEXT", "MTEXT"}:
            ignored_entity_types.add(entity_type)

    if not wall_xs:
        raise ValueError("No valid DXF geometry found.")

    min_wall_x, max_wall_x = min(wall_xs), max(wall_xs)
    min_wall_y, max_wall_y = min(wall_ys), max(wall_ys)
    span_x = max_wall_x - min_wall_x
    span_y = max_wall_y - min_wall_y
    margin = max(span_x, span_y) * 0.10

    for entity in entities:
        if entity.dxftype() not in {"TEXT", "MTEXT"}:
            continue
        raw = (
            entity.dxf.text
            if entity.dxftype() == "TEXT"
            else strip_mtext_formatting(entity.text)
        )
        location = entity.dxf.insert
        if not (
            min_wall_x - margin <= location.x <= max_wall_x + margin
            and min_wall_y - margin <= location.y <= max_wall_y + margin
        ):
            continue
        if not is_valid_room_text(raw):
            continue
        room_type, confidence = detect_room_type_with_confidence(raw)
        rooms.append(
            {
                "type": room_type,
                "x": float(location.x),
                "y": float(location.y),
                "confidence": confidence,
            }
        )

    bounds = {
        "min_x": min_wall_x,
        "max_x": max_wall_x,
        "min_y": min_wall_y,
        "max_y": max_wall_y,
        "cx": (min_wall_x + max_wall_x) / 2,
        "cy": (min_wall_y + max_wall_y) / 2,
    }
    ignored = sorted(ignored_entity_types)
    warnings = []
    if ignored:
        warnings.append(
            f"Ignored unsupported model-space entity types: {', '.join(ignored)}."
        )
    metadata = {
        "supported_wall_entities": ["LINE", "LWPOLYLINE"],
        "supported_label_entities": ["TEXT", "MTEXT"],
        "room_geometry": "text_insertion_points",
        "ignored_entity_types": ignored,
        "warnings": warnings,
    }
    if include_metadata:
        return lines, rooms, bounds, metadata
    return lines, rooms, bounds


def generate_floor_plan_image(walls, image_extent, effective_center=None):
    """Render walls against a fixed drawing extent as a base64 PNG.

    ``effective_center`` is optional so interactive editors can use one
    immutable, center-free drawing throughout boundary and room editing while
    analysis/report images may still show the effective Brahmasthan marker.
    """
    plt.style.use("dark_background")
    fig1, ax1 = plt.subplots(figsize=(IMAGE_INCHES, IMAGE_INCHES), dpi=IMAGE_DPI)
    fig1.subplots_adjust(left=0, right=1, top=1, bottom=0)
    if walls:
        ax1.add_collection(LineCollection(walls, colors="white", linewidths=1.0))
    # Room markers remain a React overlay; baking them into this image duplicates
    # labels during interactive review and print rendering.
    if effective_center is not None:
        ax1.plot(
            effective_center["x"],
            effective_center["y"],
            "+",
            color="yellow",
            markersize=12,
            markeredgewidth=2,
        )
    ax1.set_xlim(image_extent["x_min"], image_extent["x_max"])
    ax1.set_ylim(image_extent["y_min"], image_extent["y_max"])
    ax1.set_aspect("equal")
    ax1.axis("off")
    floor_buffer = io.BytesIO()
    fig1.savefig(
        floor_buffer,
        format="png",
        dpi=IMAGE_DPI,
        facecolor=fig1.get_facecolor(),
        edgecolor="none",
    )
    plt.close(fig1)
    floor_buffer.seek(0)
    return base64.b64encode(floor_buffer.read()).decode("utf-8")


def generate_floor_plan_images(
    walls,
    rooms,
    image_extent,
    effective_center,
    north_offset=0.0,
    compliance_percent=0.0,
):
    """Generate base64 PNGs for the wall plan and its scored eight-zone map."""
    plt.style.use("dark_background")
    cx, cy = effective_center["x"], effective_center["y"]
    extent_span = image_extent["x_max"] - image_extent["x_min"]
    radius = extent_span * 0.35
    floor_plan_b64 = generate_floor_plan_image(
        walls, image_extent, effective_center=effective_center
    )

    fig2, ax2 = plt.subplots(figsize=(IMAGE_INCHES, IMAGE_INCHES), dpi=IMAGE_DPI)
    fig2.subplots_adjust(left=0, right=1, top=1, bottom=0)
    if walls:
        ax2.add_collection(LineCollection(walls, colors="#555555", linewidths=0.8))

    for base_angle in CORE_DIRECTIONS.values():
        boundary_angle = base_angle + north_offset - 22.5
        radians = math.radians(boundary_angle)
        ax2.plot(
            [cx, cx + radius * math.cos(radians)],
            [cy, cy + radius * math.sin(radians)],
            color="#444444",
            linewidth=0.6,
            linestyle="--",
        )

    zone_colors = {
        "N": "#4CAF50",
        "NE": "#8BC34A",
        "E": "#FFEB3B",
        "SE": "#FFC107",
        "S": "#FF9800",
        "SW": "#FF5722",
        "W": "#E91E63",
        "NW": "#9C27B0",
    }
    label_radius = radius * 0.85
    for direction, base_angle in CORE_DIRECTIONS.items():
        radians = math.radians(base_angle + north_offset)
        ax2.text(
            cx + label_radius * math.cos(radians),
            cy + label_radius * math.sin(radians),
            direction,
            color=zone_colors.get(direction, "white"),
            fontsize=14,
            ha="center",
            va="center",
            fontweight="bold",
            bbox={"boxstyle": "round,pad=0.3", "facecolor": "black", "alpha": 0.7},
        )

    for room in rooms:
        score = room.get("score", 0)
        max_score = room.get("max_score", 1)
        ratio = (
            max(0.0, min(1.0, (score + max_score) / (2 * max_score)))
            if max_score > 0
            else 0.5
        )
        color = plt.cm.RdYlGn(ratio)
        ax2.plot(
            room["x"], room["y"], "o", color=color, markersize=12,
            markeredgecolor="white", markeredgewidth=1,
        )
        label = room.get("room_type", room.get("type", ""))
        zone = room.get("actual_zone", "")
        ax2.annotate(
            f"{label}\n{zone} ({score:+.1f})",
            (room["x"], room["y"]),
            textcoords="offset points",
            xytext=(0, 14),
            color="white",
            fontsize=7,
            ha="center",
            va="bottom",
        )

    ax2.plot(cx, cy, "+", color="yellow", markersize=15, markeredgewidth=2)
    north_plot_angle = 90 + north_offset
    arrow_length = radius * 0.35
    north_x = cx + arrow_length * math.cos(math.radians(north_plot_angle))
    north_y = cy + arrow_length * math.sin(math.radians(north_plot_angle))
    ax2.annotate(
        "N",
        xy=(north_x, north_y),
        xytext=(cx, cy),
        arrowprops={"arrowstyle": "->", "color": "red", "lw": 2.5},
        color="red",
        fontsize=18,
        fontweight="bold",
        ha="center",
        va="center",
    )
    ax2.set_xlim(image_extent["x_min"], image_extent["x_max"])
    ax2.set_ylim(image_extent["y_min"], image_extent["y_max"])
    ax2.set_aspect("equal")
    ax2.axis("off")
    zone_buffer = io.BytesIO()
    fig2.savefig(
        zone_buffer,
        format="png",
        dpi=IMAGE_DPI,
        facecolor=fig2.get_facecolor(),
        edgecolor="none",
    )
    plt.close(fig2)
    zone_buffer.seek(0)
    zone_map_b64 = base64.b64encode(zone_buffer.read()).decode("utf-8")
    return floor_plan_b64, zone_map_b64
