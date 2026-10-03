# Analysis contract (Stage 02)

`PlanSession` is the source-neutral in-memory unit used by every analysis
endpoint. A DXF session stores its source kind/name, optional source path and
background reference, immutable original room records, supported wall
segments, full drawing bounds/extents, creation time, parse metadata, and
warnings. Later image/PDF ingestion extends this shape rather than creating a
parallel analyser.

Every room has a stable opaque `room_id`, non-empty `type`, finite drawing-space
`x`/`y`, optional parser confidence, and a `source` (`parsed`, `manual`, or the
reserved future value `ocr_candidate`). Parsed IDs are assigned once at upload.
New clients must send IDs back; a missing legacy ID is deterministically filled
for that session/request. Duplicate IDs are rejected.

Collections have distinct meanings:

- `original_rooms`: immutable parser result in the session.
- `all_rooms`: current user request before boundary filtering (including an
  explicitly empty list).
- `active_rooms`: validated rooms on/inside the optional boundary.
- `scored_rooms`: active rooms enriched by `room_id` with zone, score, status,
  and other row fields.

The response intentionally exposes two image coordinate frames:

- `drawing_floor_plan_img`, `drawing_bounds`, and `drawing_image_extent` are an
  immutable full-drawing canvas. Orientation, boundary, centre, and room-label
  editors must use these three fields together so an in-progress boundary can
  never resize the surface or displace labels.
- `floor_plan_img`, `active_bounds`, and `image_extent` are the active analysis
  view. They may be clipped or recentered by a selected boundary and are used
  for report/scoring presentation, not for full-drawing editing.

The same fields also appear in `generated_images`. Older clients can continue
using the active image fields; the full-drawing fields are additive.

The backend uses mathematical drawing angles: east is 0 degrees, north is 90
degrees, positive rotation is counter-clockwise, and all values normalize to
`[0, 360)`. The existing `north_offset` is an engine rotation subtracted from a
room's raw mathematical angle. A UI compass bearing is clockwise from plan-up,
so the frontend sends `north_offset = (-ui_bearing) mod 360`. For example UI
0 maps to engine 0, UI 22.5 maps to 337.5, and UI 90 maps to 270.

`/api/preview` and `/api/analyze` both call the same preparation and scoring
path. Their geometry, identity, rows, score inputs, warnings, orientation, and
extents therefore have parity; only final optimization output is analyze-only.
