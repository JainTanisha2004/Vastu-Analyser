# Supported DXF subset

The showcase analyser intentionally implements a bounded, honest CAD subset.

- Wall geometry: model-space `LINE` and `LWPOLYLINE` entities. A lightweight
  polyline's declared closing edge is included. Consecutive duplicate vertices
  and zero-length segments are ignored.
- Room candidates: model-space `TEXT` and `MTEXT` insertion points. A room is a
  labelled point, not a measured room polygon or area.
- Bounds and the automatic centre: derived only from supported wall segments.
- Safety limits: 100,000 model-space entities and 250,000 lightweight-polyline
  vertices per upload.

Blocks/inserts, arcs, circles, ellipses, splines, hatches, dimensions, meshes,
3D solids, and paper-space layouts are not interpreted as walls. Unsupported
model-space entity types are listed in upload/session metadata so the UI and
report can disclose that the drawing was only partially interpreted.

This is sufficient for the checked synthetic showcase fixtures; it is not a
general CAD renderer or a replacement for architectural geometry software.
