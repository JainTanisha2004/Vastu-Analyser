"""FastAPI entry point and the canonical Stage 02 analysis preparation path."""

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import math
import os
from typing import Literal, Optional
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, field_validator

from dxf_parser import (
    compute_image_extent,
    generate_floor_plan_image,
    generate_floor_plan_images,
    process_dxf,
)
from geometry import (
    clip_line_segment_to_polygon,
    point_in_polygon,
    polygon_interior_point,
    validate_polygon,
)
from vastu_engine import get_recommendations, run_vastu_analysis


ANALYSIS_VERSION = "2.0"
RULE_VERSION = "legacy-8-sector-v1"
MAX_CACHE_ENTRIES = 50
MAX_ROOMS = 1_000
MAX_ROOM_TYPE_LENGTH = 80
MAX_ROOM_ID_LENGTH = 128

TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


@dataclass(frozen=True)
class PlanSession:
    """Source-neutral cached plan used by preview and final analysis.

    Stage 06 can populate the same shape with source_kind="image" or "pdf"
    and empty walls; it does not need another analysis cache or endpoint path.
    Original room dictionaries are copied before every request and never
    mutated by filtering, scoring, or optimization.
    """

    session_id: str
    source_kind: str
    source_name: str
    source_path: Optional[str]
    background_reference: Optional[dict]
    walls: tuple
    original_rooms: tuple
    drawing_bounds: dict
    image_extent: dict
    created_at: str
    warnings: tuple
    source_metadata: dict


@dataclass(frozen=True)
class PreparedAnalysis:
    session: PlanSession
    center_mode: str
    north_offset: float
    boundary_points: Optional[list]
    all_rooms: list
    active_rooms: list
    active_walls: list
    drawing_bounds: dict
    active_bounds: dict
    drawing_image_extent: dict
    image_extent: dict
    effective_center: dict
    warnings: list
    excluded_room_ids: list


FILE_CACHE: dict[str, PlanSession] = {}


def _evict_cache_entry(file_id):
    """Remove a session and best-effort delete its ephemeral source file."""
    entry = FILE_CACHE.pop(file_id, None)
    source_path = None
    if isinstance(entry, PlanSession):
        source_path = entry.source_path
    elif isinstance(entry, dict):  # Defensive cleanup for a pre-Stage-02 process.
        source_path = entry.get("path")
    if source_path:
        try:
            os.remove(source_path)
        except OSError:
            pass


def _cache_put(file_id, session):
    FILE_CACHE[file_id] = session
    while len(FILE_CACHE) > MAX_CACHE_ENTRIES:
        _evict_cache_entry(next(iter(FILE_CACHE)))


def normalize_angle(value):
    """Validate and normalize degrees to [0, 360), including negative zero."""
    try:
        numeric = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError("Orientation must be a finite number") from error
    if not math.isfinite(numeric):
        raise ValueError("Orientation must be a finite number")
    normalized = numeric % 360.0
    if normalized == 0 or math.isclose(normalized, 360.0, abs_tol=1e-12):
        return 0.0
    return normalized


class Point(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float
    y: float


class RoomInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    room_id: Optional[str] = None
    type: str
    x: float
    y: float
    confidence: Optional[Literal["high", "medium", "low"]] = None
    source: Optional[Literal["parsed", "manual", "ocr_candidate"]] = None

    @field_validator("room_id")
    @classmethod
    def validate_room_id(cls, value):
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Room ID must not be empty")
        if len(stripped) > MAX_ROOM_ID_LENGTH:
            raise ValueError(f"Room ID may contain at most {MAX_ROOM_ID_LENGTH} characters")
        return stripped

    @field_validator("type")
    @classmethod
    def validate_room_type(cls, value):
        stripped = value.strip()
        if not stripped:
            raise ValueError("Room type must not be empty")
        if len(stripped) > MAX_ROOM_TYPE_LENGTH:
            raise ValueError(
                f"Room type may contain at most {MAX_ROOM_TYPE_LENGTH} characters"
            )
        return stripped

    @field_validator("x", "y")
    @classmethod
    def validate_coordinate(cls, value):
        if not math.isfinite(value):
            raise ValueError("Room coordinates must be finite")
        return value


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_id: str
    north_offset: float = 0.0
    rooms: Optional[list[RoomInput]] = None
    center_mode: str = "automatic"
    manual_center: Optional[Point] = None
    house_boundary: Optional[list[Point]] = None

    @field_validator("file_id")
    @classmethod
    def validate_file_id(cls, value):
        stripped = value.strip()
        if not stripped:
            raise ValueError("File ID must not be empty")
        return stripped

    @field_validator("north_offset", mode="before")
    @classmethod
    def validate_north_offset(cls, value):
        return normalize_angle(value)


class AnalyzeRequest(AnalysisRequest):
    pass


class PreviewRequest(AnalysisRequest):
    pass


def _copy_rooms(rooms):
    return [dict(room) for room in rooms]


def _legacy_room_id(session_id, room, index):
    """Create the same compatibility ID for identical preview/analyze input."""
    try:
        namespace = uuid.UUID(session_id)
    except ValueError:
        namespace = uuid.uuid5(uuid.NAMESPACE_URL, session_id)
    material = json.dumps(
        {
            "index": index,
            "type": room.type,
            "x": room.x,
            "y": room.y,
            "confidence": room.confidence,
            "source": room.source,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return str(uuid.uuid5(namespace, f"legacy-request-room:{material}"))


def _normalize_requested_rooms(session, requested_rooms):
    if requested_rooms is None:
        return _copy_rooms(session.original_rooms)
    if len(requested_rooms) > MAX_ROOMS:
        raise HTTPException(status_code=422, detail="Too many rooms")

    normalized = []
    seen_ids = set()
    for index, room in enumerate(requested_rooms):
        room_id = room.room_id or _legacy_room_id(session.session_id, room, index)
        if room_id in seen_ids:
            raise HTTPException(status_code=422, detail="Room IDs must be unique")
        seen_ids.add(room_id)
        normalized.append(
            {
                "room_id": room_id,
                "type": room.type,
                "x": room.x,
                "y": room.y,
                "confidence": room.confidence or "high",
                "source": room.source or "manual",
            }
        )
    return normalized


def resolve_center(
    drawing_bounds,
    center_mode="automatic",
    manual_center=None,
    boundary_points=None,
):
    """Resolve exactly one declared centre mode after boundary validation."""
    if center_mode not in {"automatic", "manual", "boundary"}:
        raise HTTPException(status_code=422, detail="Invalid center mode")
    if center_mode == "manual":
        if manual_center is None:
            raise HTTPException(status_code=422, detail="Manual mode requires manual_center")
        if not (math.isfinite(manual_center.x) and math.isfinite(manual_center.y)):
            raise HTTPException(status_code=422, detail="Center coordinates must be finite")
        if boundary_points and not point_in_polygon(
            manual_center.x, manual_center.y, boundary_points
        ):
            raise HTTPException(
                status_code=422,
                detail="Manual center must be inside the selected house boundary",
            )
        return {"x": manual_center.x, "y": manual_center.y}

    if center_mode == "boundary":
        if not boundary_points:
            raise HTTPException(
                status_code=422, detail="Boundary must have at least 3 points"
            )
        center_x, center_y = polygon_interior_point(boundary_points)
        return {"x": center_x, "y": center_y}

    return {"x": drawing_bounds["auto_cx"], "y": drawing_bounds["auto_cy"]}


def apply_boundary_filter(walls, rooms, boundary_points):
    """Return clipped copies and polygon bounds without mutating session data."""
    if not boundary_points:
        return list(walls), _copy_rooms(rooms), None

    active_rooms = [
        dict(room)
        for room in rooms
        if point_in_polygon(room["x"], room["y"], boundary_points)
    ]
    active_walls = []
    for wall in walls:
        start, end = wall
        clipped = clip_line_segment_to_polygon(
            {"x": start[0], "y": start[1]},
            {"x": end[0], "y": end[1]},
            boundary_points,
        )
        active_walls.extend(clipped)

    xs = [point["x"] for point in boundary_points]
    ys = [point["y"] for point in boundary_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    boundary_bounds = {
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "cx": (min_x + max_x) / 2,
        "cy": (min_y + max_y) / 2,
        "auto_cx": (min_x + max_x) / 2,
        "auto_cy": (min_y + max_y) / 2,
    }
    return active_walls, active_rooms, boundary_bounds


def prepare_analysis_input(request):
    """Prepare one validated geometry/identity snapshot for either endpoint."""
    session = FILE_CACHE.get(request.file_id)
    if session is None:
        raise HTTPException(
            status_code=404, detail="File not found. Please upload again."
        )

    drawing_bounds = dict(session.drawing_bounds)
    boundary_points = None
    if request.house_boundary:
        boundary_points = [
            {"x": point.x, "y": point.y} for point in request.house_boundary
        ]
        validate_polygon(boundary_points, drawing_bounds=drawing_bounds)

    effective_center = resolve_center(
        drawing_bounds,
        request.center_mode,
        request.manual_center,
        boundary_points,
    )
    all_rooms = _normalize_requested_rooms(session, request.rooms)
    if len(all_rooms) > MAX_ROOMS:
        raise HTTPException(status_code=422, detail="Too many rooms")

    active_walls, active_rooms, boundary_bounds = apply_boundary_filter(
        session.walls, all_rooms, boundary_points
    )
    active_bounds = dict(boundary_bounds or drawing_bounds)
    active_bounds["cx"] = effective_center["x"]
    active_bounds["cy"] = effective_center["y"]
    image_extent = compute_image_extent(active_bounds)

    active_ids = {room["room_id"] for room in active_rooms}
    excluded_room_ids = [
        room["room_id"] for room in all_rooms if room["room_id"] not in active_ids
    ]
    warnings = [
        {"code": "dxf_parse_warning", "message": message, "room_ids": []}
        for message in session.warnings
    ]
    if excluded_room_ids:
        count = len(excluded_room_ids)
        noun = "room is" if count == 1 else "rooms are"
        warnings.append(
            {
                "code": "rooms_excluded_by_boundary",
                "message": (
                    f"{count} {noun} outside the selected house boundary and "
                    "was excluded from scoring."
                    if count == 1
                    else f"{count} {noun} outside the selected house boundary and were excluded from scoring."
                ),
                "room_ids": excluded_room_ids,
            }
        )
    uncertain_ids = [
        room["room_id"]
        for room in active_rooms
        if room.get("confidence") in {"low", "medium"}
    ]
    if uncertain_ids:
        count = len(uncertain_ids)
        warnings.append(
            {
                "code": "low_confidence_rooms",
                "message": f"Verify {count} low-confidence room label{'s' if count != 1 else ''} before relying on the score.",
                "room_ids": uncertain_ids,
            }
        )

    return PreparedAnalysis(
        session=session,
        center_mode=request.center_mode,
        north_offset=normalize_angle(request.north_offset),
        boundary_points=boundary_points,
        all_rooms=all_rooms,
        active_rooms=active_rooms,
        active_walls=active_walls,
        drawing_bounds=drawing_bounds,
        active_bounds=active_bounds,
        drawing_image_extent=dict(session.image_extent),
        image_extent=image_extent,
        effective_center=effective_center,
        warnings=warnings,
        excluded_room_ids=excluded_room_ids,
    )


def _room_status(row):
    if row["score"] < 0:
        return "unfavourable"
    if row["max_score"] == 0 and row["score"] == 0:
        return "neutral"
    if row["max_score"] > 0 and row["score"] / row["max_score"] >= 0.5:
        return "auspicious"
    return "inauspicious"


def score_prepared_rooms(prepared):
    rows, total_score, max_score, compliance_percent = run_vastu_analysis(
        prepared.active_rooms, prepared.active_bounds, prepared.north_offset
    )
    rows = [{**row, "status": _room_status(row)} for row in rows]
    rooms_by_id = {room["room_id"]: room for room in prepared.active_rooms}
    scored_rooms = [
        {**rooms_by_id[row["room_id"]], **row}
        for row in rows
    ]
    return rows, scored_rooms, total_score, max_score, compliance_percent


def _common_analysis_response(prepared, scored):
    rows, scored_rooms, total_score, max_score, compliance_percent = scored
    floor_plan_image, zone_map_image = generate_floor_plan_images(
        prepared.active_walls,
        scored_rooms,
        prepared.image_extent,
        prepared.effective_center,
        prepared.north_offset,
        compliance_percent,
    )
    background_reference = prepared.session.background_reference or {}
    drawing_floor_plan_image = (
        background_reference.get("floor_plan_img")
        if isinstance(background_reference, dict)
        else None
    ) or floor_plan_image
    response = {
        "analysis_version": ANALYSIS_VERSION,
        "rule_version": RULE_VERSION,
        "session": {
            "session_id": prepared.session.session_id,
            "source_kind": prepared.session.source_kind,
            "source_name": prepared.session.source_name,
            "created_at": prepared.session.created_at,
            "source_metadata": dict(prepared.session.source_metadata),
        },
        "center_mode": prepared.center_mode,
        "north_offset": prepared.north_offset,
        "orientation": {
            "engine_offset_degrees": prepared.north_offset,
            "north_math_angle_degrees": normalize_angle(90 + prepared.north_offset),
        },
        "effective_center": dict(prepared.effective_center),
        "drawing_bounds": dict(prepared.drawing_bounds),
        "active_bounds": dict(prepared.active_bounds),
        "drawing_image_extent": dict(prepared.drawing_image_extent),
        "image_extent": dict(prepared.image_extent),
        "house_boundary": (
            [dict(point) for point in prepared.boundary_points]
            if prepared.boundary_points
            else None
        ),
        "all_rooms": _copy_rooms(prepared.all_rooms),
        "active_rooms": _copy_rooms(prepared.active_rooms),
        "scored_rooms": _copy_rooms(scored_rooms),
        "rows": [dict(row) for row in rows],
        "total_score": total_score,
        "max_score": max_score,
        "compliance_percent": compliance_percent,
        "warnings": [dict(warning) for warning in prepared.warnings],
        "excluded_room_ids": list(prepared.excluded_room_ids),
        "drawing_floor_plan_img": drawing_floor_plan_image,
        "floor_plan_img": floor_plan_image,
        "zone_map_img": zone_map_image,
        "generated_images": {
            "drawing_floor_plan_img": drawing_floor_plan_image,
            "drawing_image_extent": dict(prepared.drawing_image_extent),
            "floor_plan_img": floor_plan_image,
            "zone_map_img": zone_map_image,
            "image_extent": dict(prepared.image_extent),
        },
    }
    return response


app = FastAPI(title="Vastu Analyser API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://vastu-analyser.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "message": "Vastu Analyser API is running"}


@app.post("/api/upload")
async def upload_dxf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files are supported")

    content = await file.read()
    if len(content) > 70 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 70MB")

    file_id = str(uuid.uuid4())
    filepath = os.path.join(TEMP_DIR, f"{file_id}.dxf")
    with open(filepath, "wb") as uploaded_file:
        uploaded_file.write(content)

    try:
        walls, parsed_rooms, bounds, source_metadata = process_dxf(
            filepath, include_metadata=True
        )
    except ValueError as error:
        try:
            os.remove(filepath)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        try:
            os.remove(filepath)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail="Failed to parse DXF file") from error

    bounds["auto_cx"] = bounds["cx"]
    bounds["auto_cy"] = bounds["cy"]
    image_extent = compute_image_extent(bounds)
    try:
        drawing_floor_plan_image = generate_floor_plan_image(walls, image_extent)
    except Exception as error:
        try:
            os.remove(filepath)
        except OSError:
            pass
        raise HTTPException(
            status_code=500,
            detail="Failed to render the floor plan",
        ) from error
    namespace = uuid.UUID(file_id)
    original_rooms = []
    for index, room in enumerate(parsed_rooms):
        original_rooms.append(
            {
                "room_id": str(uuid.uuid5(namespace, f"parsed-room:{index}")),
                "type": room["type"],
                "x": room["x"],
                "y": room["y"],
                "confidence": room.get("confidence", "high"),
                "source": "parsed",
            }
        )

    session = PlanSession(
        session_id=file_id,
        source_kind="dxf",
        source_name=file.filename,
        source_path=filepath,
        background_reference={
            "kind": "generated_dxf_floor_plan",
            "floor_plan_img": drawing_floor_plan_image,
            "image_extent": dict(image_extent),
        },
        walls=tuple((tuple(wall[0]), tuple(wall[1])) for wall in walls),
        original_rooms=tuple(dict(room) for room in original_rooms),
        drawing_bounds=dict(bounds),
        image_extent=dict(image_extent),
        created_at=datetime.now(timezone.utc).isoformat(),
        warnings=tuple(source_metadata["warnings"]),
        source_metadata=dict(source_metadata),
    )
    _cache_put(file_id, session)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "source_kind": session.source_kind,
        "drawing_bounds": dict(bounds),
        "image_extent": dict(image_extent),
        "rooms": _copy_rooms(original_rooms),
        "wall_count": len(walls),
        "warnings": list(session.warnings),
        "source_metadata": dict(source_metadata),
    }


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    prepared = prepare_analysis_input(request)
    scored = score_prepared_rooms(prepared)
    response = _common_analysis_response(prepared, scored)
    rows, _, _, _, compliance_percent = scored

    optimization = get_recommendations(
        prepared.active_rooms,
        prepared.active_bounds,
        rows,
        compliance_percent,
        prepared.north_offset,
    )
    optimized_floor_plan_image = None
    optimized_zone_map_image = None
    if optimization["move"] is not None and optimization["optimized_rooms"]:
        optimized_rows, _, _, optimized_percent = run_vastu_analysis(
            optimization["optimized_rooms"],
            prepared.active_bounds,
            prepared.north_offset,
        )
        optimized_rows = [
            {**row, "status": _room_status(row)} for row in optimized_rows
        ]
        optimized_by_id = {
            room["room_id"]: room for room in optimization["optimized_rooms"]
        }
        scored_optimized_rooms = [
            {**optimized_by_id[row["room_id"]], **row} for row in optimized_rows
        ]
        optimized_floor_plan_image, optimized_zone_map_image = generate_floor_plan_images(
            prepared.active_walls,
            scored_optimized_rooms,
            prepared.image_extent,
            prepared.effective_center,
            prepared.north_offset,
            optimized_percent,
        )

    response.update(
        {
            "optimization": {
                "original_score": optimization["original_score"],
                "optimized_score": optimization["optimized_score"],
                "improvement": optimization["improvement"],
                "move": optimization["move"],
            },
            "optimized_floor_plan_img": optimized_floor_plan_image,
            "optimized_zone_map_img": optimized_zone_map_image,
        }
    )
    return response


@app.post("/api/preview")
async def preview(request: PreviewRequest):
    prepared = prepare_analysis_input(request)
    scored = score_prepared_rooms(prepared)
    return _common_analysis_response(prepared, scored)


# ---------------------------------------------------------------------------
# RAG-Powered AI Vastu Report & Conversational Chat Endpoints
# ---------------------------------------------------------------------------

from fastapi.responses import StreamingResponse
from report_generator import generate_vastu_report
from chat_engine import stream_chat_response
from report_cache import GLOBAL_CACHE
from llm_client import is_llm_configured


class GenerateReportRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    file_id: Optional[str] = None
    analysis_data: Optional[dict] = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    file_id: str
    message: str
    analysis_data: dict
    report_data: Optional[dict] = None


@app.get("/api/report/status")
async def report_status():
    """Return whether live Gemini LLM is configured."""
    return {
        "llm_configured": is_llm_configured(),
        "model": "gemini-2.5-flash",
    }


@app.post("/api/report/generate")
async def generate_report(request: GenerateReportRequest):
    """Generate or retrieve a cached RAG-powered Vastu narrative report."""
    analysis = request.analysis_data
    if not analysis and request.file_id:
        session = _cache_get(request.file_id)
        # If no explicit analysis was passed, synthesize default preview analysis
        prepared = _prepare_plan_session_analysis(
            session=session,
            room_edits=None,
            center_spec={"mode": "auto"},
            north_offset=0.0,
        )
        scored = score_prepared_rooms(prepared)
        analysis = _common_analysis_response(prepared, scored)

    if not analysis:
        raise HTTPException(
            status_code=400,
            detail="Valid analysis_data or an active file_id session is required to generate report.",
        )

    fingerprint = GLOBAL_CACHE.compute_fingerprint(analysis)
    cached = GLOBAL_CACHE.get_report(fingerprint)
    if cached:
        cached["from_cache"] = True
        return cached

    report = await generate_vastu_report(analysis)
    GLOBAL_CACHE.put_report(fingerprint, report)
    report["from_cache"] = False
    return report


@app.post("/api/report/chat")
async def chat_report(request: ChatRequest):
    """Stream context-grounded conversational answers via Server-Sent Events."""
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not request.analysis_data:
        raise HTTPException(status_code=400, detail="analysis_data is required for grounded chat")

    return StreamingResponse(
        stream_chat_response(
            file_id=request.file_id,
            message=request.message.strip(),
            analysis_data=request.analysis_data,
            report_data=request.report_data,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

