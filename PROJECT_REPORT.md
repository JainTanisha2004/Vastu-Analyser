# Vastu Analyser — Comprehensive Project Report

---

## 1. Project Overview

**Vastu Analyser** is a full-stack web application that parses architectural floor plans (DXF files), detects rooms, determines their compass placement relative to the building's center, and scores each room against traditional **Vaastu Shastra** principles. The user is guided through a 5-step wizard interface and receives an instant compliance report with scores, status badges, and actionable recommendations.

### Core Problem Solved
Architects and homeowners need a quick way to evaluate whether a floor plan adheres to Vaastu Shastra principles (ancient Indian architectural science) without manually measuring angles and looking up rule tables. This app automates the entire pipeline: parsing CAD drawings, fuzzy compass matching, directional scoring, and report generation.

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend** | Python | 3.x | Core language |
| | FastAPI | latest | REST API framework with async support |
| | Uvicorn | latest (standard) | ASGI server to run FastAPI |
| | ezdxf | latest | DXF/CAD file parsing library |
| | matplotlib | latest | Server-side floor plan image generation (PNG) |
| | pandas | latest | Data handling (available, not heavily used) |
| | python-multipart | latest | File upload parsing for FastAPI |
| | numpy | latest | Numerical support for matplotlib |
| **Frontend** | React | 19.2.0 | UI component library |
| | React DOM | 19.2.0 | DOM rendering |
| | Vite | 7.3.x | Build tool and dev server |
| | Tailwind CSS | 4.2.1 | Utility-first CSS framework |
| | @tailwindcss/vite | 4.2.1 | Vite plugin for Tailwind v4 |
| | axios | 1.13.6 | HTTP client for API calls |
| | react-router-dom | 7.13.1 | Routing (installed, not actively used — single-page wizard) |
| **Tooling** | ESLint | 9.x | JavaScript linting |
| | PostCSS + Autoprefixer | 8.x / 10.x | CSS processing |
| | PowerShell | 5.1 | `start.ps1` one-click launcher |

---

## 3. Project Architecture

```
vastu-analyser/
├── start.ps1                  # One-click launcher (backend + frontend + browser)
├── backend/
│   ├── requirements.txt       # Python dependencies
│   ├── main.py                # FastAPI app: endpoints, CORS, file caching
│   ├── constants.py           # Vaastu rules, room aliases, compass directions
│   ├── vastu_engine.py        # Scoring engine: fuzzy logic, room detection, recommendations
│   ├── dxf_parser.py          # DXF parsing + matplotlib image generation
│   └── temp/                  # Runtime: uploaded DXF files (gitignored)
├── frontend/
│   ├── package.json           # Node dependencies and scripts
│   ├── vite.config.js         # Vite + React + Tailwind plugin config
│   ├── .env                   # VITE_API_BASE_URL=http://localhost:8000
│   ├── index.html             # SPA entry point
│   ├── public/                # Static assets
│   └── src/
│       ├── main.jsx           # React root render (StrictMode + App)
│       ├── App.jsx            # Renders WizardPage (single route)
│       ├── index.css          # Global CSS: fonts, animations, scrollbar, variables
│       ├── api/
│       │   └── vastuApi.js    # Axios wrappers for all 3 API endpoints
│       ├── pages/
│       │   └── WizardPage.jsx # State orchestrator: manages all wizard state + step routing
│       └── components/
│           ├── MandalaBackground.jsx   # Decorative rotating SVG mandala patterns
│           ├── StepSidebar.jsx         # Left sidebar: 5-step progress tracker
│           ├── CompassRose.jsx         # SVG compass with 8 directional arcs + floor plan overlay
│           ├── UploadStep.jsx          # Step 0: Drag-and-drop DXF upload
│           ├── OrientationStep.jsx     # Step 1: Compass rotation + flip + preview
│           ├── CenterPointStep.jsx     # Step 2: Draggable Brahmasthan center marker
│           ├── RoomLabelsStep.jsx      # Step 3: Room label verification + add/delete
│           └── ReportStep.jsx          # Step 4: Compass + table + score + recommendations
```

---

## 4. Backend — File-by-File Breakdown

### 4.1 `constants.py` — Rules & Configuration

This file is the **knowledge base** of the entire application. It contains:

- **`VASTU_RULES`** (dict): 15 room types, each with:
  - `max` — maximum possible score for that room type
  - `scores` — a dict mapping compass directions (N, NE, E, SE, S, SW, W, NW) to signed score values. Positive = auspicious, negative = inauspicious.
  - `def` — default score for directions not explicitly listed (always 0)
  
  Example: `Kitchen` scores +12 in SE (ideal), +7 in S/E, and -9 in NE (worst).

- **`ROOM_ALIASES`** (dict): Maps each canonical room type to a list of keyword aliases used for fuzzy matching. E.g., `"Toilet"` matches `['toilet', 'bathroom', 'bath', 'wc', 'washroom', ...]`. Contains ~50+ keywords across 15 room types.

- **`IGNORE_LABELS`** (set): ~60 strings that should be rejected as room labels. Includes structural terms (`'staircase'` is NOT ignored — it's a valid room), dimension annotations, floor names, and CAD artifacts.

- **`CORE_DIRECTIONS`** (dict): Maps the 8 compass directions to mathematical angles in the standard coordinate system (E=0°, N=90°, W=180°, S=270°).

### 4.2 `vastu_engine.py` — Scoring Engine

The brain of the analysis. Key functions:

| Function | Purpose |
|----------|---------|
| `angular_distance(a, b)` | Compute shortest angular distance between two bearings (handles wrapping past 360°) |
| `fuzzy_membership(angle, peak, spread=45)` | Returns 0-1 membership value. If the room angle is within `spread°` of a direction's peak, membership is `1 - distance/spread`. Used to smoothly interpolate scores instead of hard sector boundaries. |
| `get_angle(cx, cy, x, y)` | Compute the bearing angle from building center to room position using `atan2` |
| `strip_mtext_formatting(text)` | Clean MTEXT formatting codes like `\A1;`, `\P`, `\f...;`, curly braces from raw DXF strings |
| `is_valid_room_text(text)` | Filter out dimension strings (`"3.5 x 4.0"`), single chars, and ignored labels |
| `normalize_text(text)` | Lowercase, split camelCase, remove digits/punctuation, collapse whitespace |
| `detect_room_type(text)` | **Two-pass detection:** Pass 1 does multi-word subset matching (e.g., "master bedroom" scores higher than just "bedroom"). Pass 2 does substring/partial matching as fallback. Returns canonical room type or "Generic Room". |
| `get_likely_zone(angle)` | Convert a continuous angle to one of 8 discrete compass sectors (each 45° wide) |
| `get_ideal_zone(room_type)` | Look up which direction has the highest score for a room type in VASTU_RULES |
| `run_vastu_analysis(rooms, bounds, north_offset)` | **Main analysis pipeline.** For each room: compute angle from center → adjust by north offset → compute fuzzy score across all 8 directions → determine actual zone → produce row. Returns `(rows, total_score, max_score, compliance_percent)`. |
| `get_recommendations(rows)` | For rooms scoring below 50% of their max, generate "Move X from Y to Z — estimated gain: +N points" strings. Returns top 5 sorted by potential gain. |

**Fuzzy Scoring Algorithm (Key Innovation):**
Instead of hard-coding "Kitchen in SE = good, Kitchen in E = bad", the engine uses a **fuzzy membership function with spread=45°**. If a kitchen is at 340° (between E and SE), it gets partial credit from both directions. The final score for a room is:

$$\text{score} = \sum_{d \in \text{directions}} \mu(\theta, \theta_d) \times \text{rule\_score}(d)$$

where $\mu(\theta, \theta_d) = \max(0, 1 - \frac{|\theta - \theta_d|}{45})$ is the fuzzy membership.

### 4.3 `dxf_parser.py` — DXF Parsing & Image Generation

| Function | Purpose |
|----------|---------|
| `process_dxf(filename)` | Opens the DXF file using `ezdxf`, extracts `LINE` and `LWPOLYLINE` entities as wall segments. Extracts `TEXT` and `MTEXT` entities, strips formatting, validates with `is_valid_room_text()`, detects room type with `detect_room_type()`. Returns `(walls, rooms, bounds)`. |
| `generate_floor_plan_images(walls, rooms, bounds, north_offset, compliance_percent)` | Generates **two matplotlib figures** rendered to base64 PNG: (1) **Floor Plan Layout** — walls in white, room labels in cyan, center crosshair in yellow. (2) **Vastu Zone Map** — walls dimmed, 8 zone boundary lines, direction labels with colors, room dots colored by RdYlGn colormap based on score, north arrow, compliance percentage in title. |

### 4.4 `main.py` — FastAPI Application

Sets up the FastAPI server with CORS middleware (allows all origins for local development). Creates a `temp/` directory for DXF uploads. Maintains an **in-memory cache** (`FILE_CACHE`) keyed by UUID, storing parsed wall/room/bounds data so repeated analysis/preview calls don't re-parse the DXF.

Defines 3 endpoints (detailed in Section 6) and 2 Pydantic request models (`AnalyzeRequest`, `PreviewRequest`).

### 4.5 `requirements.txt`

```
fastapi
uvicorn[standard]
ezdxf
matplotlib
pandas
python-multipart
numpy
```

---

## 5. Frontend — File-by-File Breakdown

### 5.1 `main.jsx`
Entry point. Renders `<App />` wrapped in `<StrictMode>` into the `#root` DOM element. Imports `index.css` for global styles.

### 5.2 `App.jsx`
Minimal — renders `<WizardPage />`. Acts as the root component. No routing logic (single-page wizard).

### 5.3 `index.css` — Global Styles
- Imports Google Fonts: **Playfair Display** (headings) + **Nunito** (body)
- Imports Tailwind CSS v4 via `@import "tailwindcss"`
- CSS custom properties: `--orange-primary`, `--yellow-cta`, status colors
- Font smoothing: `-webkit-font-smoothing: antialiased`
- Background: 135° gradient from `#7C2D12` → `#EA580C` → `#FFF7ED` → back
- Custom thin scrollbar with rounded thumb
- 10 animation keyframes: `orbit`, `pulse-ring`, `compass-rotate`, `fadeSlideIn`, `fadeSlideDown`, `spin`, `shimmer`, `gentle-float`
- Corresponding utility classes: `.animate-fadeSlideIn`, `.animate-orbit`, `.animate-pulse-ring`, `.animate-compass-slow`, `.animate-spin-slow`, `.animate-float`, `.animate-shimmer`

### 5.4 `vastuApi.js` — API Client
Three async functions wrapping axios calls:

| Function | Calls | Returns |
|----------|-------|---------|
| `uploadFile(file)` | `POST /api/upload` (multipart) | `{ file_id, filename, bounds, rooms, wall_count }` |
| `analyzeFile(fileId, northOffset)` | `POST /api/analyze` (JSON) | `{ rows, total_score, max_score, compliance_percent, recommendations }` |
| `getPreview(fileId, northOffset)` | `POST /api/preview` (JSON) | `{ floor_plan_img, zone_map_img }` (base64 PNGs) |

Base URL comes from `VITE_API_BASE_URL` environment variable (defaults to `http://localhost:8000`).

### 5.5 `WizardPage.jsx` — State Orchestrator
The central hub. Manages all wizard state via `useState`:

| State Variable | Type | Purpose |
|---------------|------|---------|
| `currentStep` | number (0-4) | Which wizard step is active |
| `fileId` | string | UUID returned by upload API |
| `filename` | string | Original upload filename |
| `rooms` | array | `[{type, x, y}, ...]` — room positions |
| `bounds` | object | `{min_x, max_x, min_y, max_y, cx, cy}` |
| `northOffset` | number | Degrees of compass rotation |
| `flipState` | boolean | Whether floor plan is horizontally flipped |
| `previewImages` | object | `{floor_plan_img, zone_map_img}` base64 |
| `analysisData` | object | Full analysis response |
| `centerPoint` | object | `{x, y}` percentage for Brahmasthan |
| `isLoading` | boolean | Loading state for analysis |
| `error` | string | Error message toast |

**Key flows:**
- `handleUploadSuccess(data)` — saves file_id/rooms/bounds, advances to step 1
- `handleCenterNext()` — advances to step 3 AND triggers `runAnalysis()` 
- `runAnalysis()` — calls `analyzeFile()` API
- `goBack()` — decrements step

Renders two side-by-side cards:
1. **Left card** (280px) — `<StepSidebar>`
2. **Right card** (flex-1) — switches step component via `renderStep()`

### 5.6 `MandalaBackground.jsx`
Decorative component rendering two slowly rotating SVG mandala patterns (concentric circles + radial lines + petal paths) positioned at left and right edges of the viewport. Pure visual — no interactivity.

### 5.7 `StepSidebar.jsx`
Vertical progress tracker showing 5 steps with:
- **Circle badges**: orange when active/complete, gray border when pending
- **Green checkmark overlay** on completed steps
- **Orange connector line** between completed steps (gray for pending)
- **Title + description** text block beside each circle
- Title header: "Generate Home's Vaastu Report"

### 5.8 `CompassRose.jsx`
Complex SVG compass component featuring:
- **8 colored directional arcs** (N=blue, NE=green, E=lime, etc.)
- **Floor plan image** clipped into a circle at center, rotated by `northOffset`
- **Degree tick marks** every 22.5°
- **Red north needle** that rotates with the compass
- **Room dots** overlaid at correct positions with hover tooltips
- **Rotating compass ring** animation

Props: `size`, `northOffset`, `floorPlanImg`, `roomDots`, `hoveredRoomIndex`, `onRoomHover`, `bounds`

### 5.9 `UploadStep.jsx` (Step 0)
Drag-and-drop upload zone with:
- Dashed border that changes on drag-over/upload-complete
- File validation (.dxf only, 70MB max)
- Progress spinner during upload
- Absolutely positioned "Upload & Next" button
- Error display for invalid files

### 5.10 `OrientationStep.jsx` (Step 1)
Compass orientation control with:
- `<CompassRose>` displaying the floor plan
- 4 control buttons: Left (-22.5°), Right (+22.5°), Zoom, Flip
- Debounced preview fetch (400ms) on north offset change
- Warm yellow tip bar at bottom

### 5.11 `CenterPointStep.jsx` (Step 2)
Floor plan with a draggable center marker:
- Shows the floor plan image as background
- Orange "Brahmasthan" marker with pulsing ring animation
- Mouse drag updates `centerPoint` (x%, y%)
- Tooltip label follows the marker

### 5.12 `RoomLabelsStep.jsx` (Step 3)
Room label verification and management:
- **Loading state**: Animated magnifying glass with orbiting animation while analysis runs
- **Room chips**: Positioned on the floor plan at correct coordinates
  - Purple chips = detected by backend
  - Orange chips with "(new)" tag = manually added by user
- **Add Room dropdown**: Full list of 15 room types
- **Delete button**: Removes selected chip
- **Merged data model**: Uses `rooms[]` as source of truth, pulls labels from `analysisRows[]` when available

### 5.13 `ReportStep.jsx` (Step 4)
Final report with:
- **Left column (52%)**: CompassRose with scored room dots
- **Right column (48%)**: 
  - Analysis table: Room name, Direction, Status badge (Auspicious/Inauspicious/Unfavourable)
  - Colored side bar indicators per row
  - Compliance progress bar with percentage
  - "View Full Report" CTA button
- **Recommendations section**: Numbered cards with staggered fade-in animations
- **Interactive**: Hovering a table row highlights the corresponding room dot on the compass

---

## 6. API Endpoints

### `GET /`
**Purpose:** Health check  
**Response:** `{ "status": "ok", "message": "Vastu Analyser API is running" }`

### `POST /api/upload`
**Purpose:** Upload and parse a DXF floor plan  
**Content-Type:** `multipart/form-data`  
**Body:** `file` — the .dxf file (max 70MB)  
**Process:**
1. Validate file extension (.dxf only)
2. Validate file size (≤70MB)
3. Save to `backend/temp/{uuid}.dxf`
4. Call `process_dxf()` to extract walls, rooms, bounds
5. Reject if no rooms found
6. Cache parsed data in `FILE_CACHE[file_id]`

**Response:**
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "my_house.dxf",
  "bounds": { "min_x": 0, "max_x": 100, "min_y": 0, "max_y": 80, "cx": 50, "cy": 40 },
  "rooms": [
    { "type": "Kitchen", "x": 75.2, "y": 30.1 },
    { "type": "Master Bedroom", "x": 25.0, "y": 60.0 }
  ],
  "wall_count": 342
}
```

### `POST /api/analyze`
**Purpose:** Run Vaastu analysis on a previously uploaded file  
**Content-Type:** `application/json`  
**Body:** `{ "file_id": "...", "north_offset": 0.0 }`  
**Process:**
1. Look up parsed data from `FILE_CACHE`
2. Call `run_vastu_analysis()` with rooms, bounds, north_offset
3. Call `get_recommendations()` on the scored rows

**Response:**
```json
{
  "rows": [
    {
      "room_type": "Kitchen",
      "angle": 315.0,
      "actual_zone": "SE",
      "ideal_zone": "SE",
      "score": 12.0,
      "max_score": 12
    }
  ],
  "total_score": 45.2,
  "max_score": 80,
  "compliance_percent": 56.5,
  "recommendations": [
    "Move Master Bedroom from NE to SW — estimated gain: +18 points"
  ]
}
```

### `POST /api/preview`
**Purpose:** Generate floor plan + zone map images with current orientation  
**Content-Type:** `application/json`  
**Body:** `{ "file_id": "...", "north_offset": 0.0 }`  
**Process:**
1. Look up parsed data from `FILE_CACHE`
2. Run analysis to get scored rooms
3. Call `generate_floor_plan_images()` to render matplotlib figures
4. Encode as base64 PNG strings

**Response:**
```json
{
  "floor_plan_img": "iVBORw0KGgo...",   // base64 PNG
  "zone_map_img": "iVBORw0KGgo..."      // base64 PNG
}
```

---

## 7. Request Flow — End-to-End

### Flow 1: File Upload (Step 0 → Step 1)

```
User drops .dxf file
       │
       ▼
UploadStep.jsx
  └── handleUpload()
       │
       ▼
vastuApi.js → uploadFile(file)
  └── POST /api/upload (multipart/form-data)
       │
       ▼
main.py → upload_dxf()
  ├── Validates .dxf extension and file size  
  ├── Saves file to backend/temp/{uuid}.dxf
  ├── Calls dxf_parser.process_dxf(filepath)
  │     ├── ezdxf.readfile() parses DXF entities
  │     ├── Extracts LINE + LWPOLYLINE → walls[]
  │     ├── Extracts TEXT + MTEXT → raw labels
  │     ├── strip_mtext_formatting() cleans labels
  │     ├── is_valid_room_text() filters noise
  │     ├── detect_room_type() maps to canonical types
  │     └── Returns (walls, rooms, bounds)
  ├── Caches result in FILE_CACHE[file_id]
  └── Returns {file_id, filename, bounds, rooms, wall_count}
       │
       ▼
WizardPage.jsx → handleUploadSuccess(data)
  ├── setFileId(data.file_id)
  ├── setRooms(data.rooms)
  ├── setBounds(data.bounds)
  └── setCurrentStep(1)  →  renders OrientationStep
```

### Flow 2: Orientation Adjustment (Step 1)

```
User clicks Left/Right rotation buttons
       │
       ▼
OrientationStep.jsx → rotateLeft() / rotateRight()
  └── onNorthOffsetChange((offset ± 22.5) % 360)
       │
       ▼
WizardPage.jsx → setNorthOffset(newValue)
  └── Re-renders OrientationStep with new northOffset
       │
       ▼
OrientationStep useEffect (debounced 400ms)
  └── vastuApi.js → getPreview(fileId, northOffset)
       └── POST /api/preview
            │
            ▼
       main.py → preview()
         ├── run_vastu_analysis() for score data
         ├── generate_floor_plan_images() → matplotlib renders
         └── Returns {floor_plan_img, zone_map_img} (base64)
            │
            ▼
       WizardPage.jsx → setPreviewImages(data)
         └── CompassRose re-renders with new floor plan image
```

### Flow 3: Center Point + Analysis (Step 2 → Step 3)

```
User drags Brahmasthan marker, then clicks Next
       │
       ▼
CenterPointStep.jsx → onNext()
       │
       ▼
WizardPage.jsx → handleCenterNext()
  ├── setCurrentStep(3)  →  renders RoomLabelsStep (loading state)
  └── runAnalysis()
       │
       ▼
vastuApi.js → analyzeFile(fileId, northOffset)
  └── POST /api/analyze
       │
       ▼
main.py → analyze()
  └── run_vastu_analysis(rooms, bounds, north_offset)
       ├── For each room:
       │   ├── get_angle(cx, cy, x, y) → raw angle
       │   ├── Adjust angle by north_offset
       │   ├── For each of 8 directions:
       │   │   ├── fuzzy_membership(adjusted_angle, dir_angle)
       │   │   └── Accumulate: score += membership × rule_score
       │   ├── get_likely_zone(angle) → actual_zone
       │   └── get_ideal_zone(room_type) → ideal_zone
       ├── Compute compliance_percent = (total_score / max_score) × 100
       └── get_recommendations(rows) → top 5 improvement suggestions
       │
       ▼
WizardPage.jsx → setAnalysisData(data), setIsLoading(false)
  └── RoomLabelsStep shows room chips on floor plan
```

### Flow 4: Report Display (Step 4)

```
User verifies room labels, clicks Submit
       │
       ▼
WizardPage.jsx → handleRoomLabelsSubmit()
  └── setCurrentStep(4)
       │
       ▼
ReportStep renders with analysisData:
  ├── Left: CompassRose with scored roomDots (color-coded)
  ├── Right: Table of rooms with status badges
  ├── Compliance bar
  └── Recommendations grid
```

---

## 8. Frontend ↔ Backend Connection

### Connection Architecture
```
┌─────────────────────┐         HTTP/JSON         ┌─────────────────────┐
│   React Frontend    │ ◄────────────────────────► │   FastAPI Backend   │
│   localhost:5173    │                            │   localhost:8000    │
│                     │                            │                     │
│  vastuApi.js        │   POST /api/upload         │  main.py            │
│  (axios client)     │   POST /api/analyze        │  (CORS enabled)     │
│                     │   POST /api/preview        │                     │
└─────────────────────┘                            └─────────────────────┘
```

### Key Connection Details

1. **Base URL Configuration**: The frontend reads `VITE_API_BASE_URL` from `.env` (set to `http://localhost:8000`). This is injected at build time by Vite via `import.meta.env`.

2. **CORS**: The backend enables `CORSMiddleware` with `allow_origins=["*"]` so the frontend (running on port 5173) can make cross-origin requests to port 8000.

3. **Data Format**: 
   - Upload uses `multipart/form-data` (file upload)
   - Analyze and Preview use `application/json` (Pydantic models)
   - Images are transferred as **base64-encoded PNGs** inside JSON responses (no separate image hosting needed)

4. **State Linkage**: The `file_id` UUID is the key that links frontend state to backend cached data. After upload, every subsequent API call passes `file_id` to reference the same parsed DXF data.

5. **No Authentication**: This is a local development tool — no auth middleware.

---

## 9. Dependencies Deep Dive

### Backend Dependencies

| Package | Role | Why Needed |
|---------|------|------------|
| **fastapi** | Web framework | Async, automatic OpenAPI docs, Pydantic validation, dependency injection |
| **uvicorn[standard]** | ASGI server | Runs FastAPI with hot reload in development |
| **ezdxf** | DXF parser | Industry-standard Python library for reading/writing AutoCAD DXF files. Handles all DXF versions and entity types. |
| **matplotlib** | Image generation | Renders floor plan and zone map as PNG images server-side. Uses `Agg` backend (no GUI needed). |
| **python-multipart** | File uploads | Required by FastAPI for `UploadFile` parameter to parse multipart form data |
| **pandas** | Data handling | Available for any tabular data processing |
| **numpy** | Numerical ops | Dependency of matplotlib; used implicitly in array operations |

### Frontend Dependencies

| Package | Role | Why Needed |
|---------|------|------------|
| **react** / **react-dom** | UI framework | Component-based UI with hooks (useState, useEffect, useCallback, useRef) |
| **axios** | HTTP client | Promise-based HTTP client for API calls; better error handling than fetch |
| **react-router-dom** | Routing | Installed but not actively used (wizard is single-page) |
| **@tailwindcss/vite** | CSS framework | Vite plugin for Tailwind v4 — JIT compilation of utility classes |
| **@vitejs/plugin-react** | Build plugin | Enables JSX transformation and React Fast Refresh |
| **eslint** + plugins | Linting | Code quality enforcement |
| **postcss** + **autoprefixer** | CSS processing | Vendor prefix automation |

---

## 10. Key Algorithms & Concepts

### 10.1 Fuzzy Membership Scoring
Traditional Vaastu apps use hard sector boundaries (each direction occupies exactly 45°). This app uses **fuzzy logic** — if a room is between two sectors, it gets partial scores from both. This produces more realistic and less jarring results.

### 10.2 Two-Pass Room Detection
Raw DXF text labels like "MASTER BED ROOM" or "Pooja\\PRoom" need intelligent matching:
- **Pass 1**: Multi-word subset matching — "master bedroom" gets 4 points (2 words × 2 bonus) vs "bedroom" getting 1 point
- **Pass 2**: Substring matching as fallback — catches partial matches like "drawing" in "drawing room"

### 10.3 MTEXT Formatting Stripping
AutoCAD MTEXT entities embed formatting codes like `\A1;`, `\fArial;`, `\P` (paragraph break), `{` `}` (grouping). These are stripped with regex before room detection.

### 10.4 Debounced Preview
When the user rotates the compass, the preview API call is debounced by 400ms to avoid flooding the server. Only the latest orientation generates a server-side image.

### 10.5 Merged Room Data Model
The frontend maintains two data sources:
- `rooms[]` from upload: `{type, x, y}` — raw room positions
- `analysisRows[]` from analysis: `{room_type, actual_zone, score, ...}` — scored data

RoomLabelsStep merges these into `mergedRooms[]`, using rooms as the positional source of truth and pulling labels from analysisRows when available. This allows manually added rooms to coexist with detected ones.

---

## 11. Design System

| Element | Value |
|---------|-------|
| **Primary Color** | `#EA580C` (orange-600) |
| **CTA Color** | `#EAB308` (yellow-500) |
| **Heading Font** | Playfair Display (serif, 700-800 weight) |
| **Body Font** | Nunito (sans-serif, 300-800 weight) |
| **Card Style** | `bg-white/95 backdrop-blur-sm rounded-3xl` with subtle box-shadow |
| **Background** | 135° gradient: deep brown → orange → cream → orange → brown |
| **Status: Auspicious** | `#16A34A` (green) on `#F0FDF4` |
| **Status: Inauspicious** | `#EA580C` (orange) on `#FFF7ED` |
| **Status: Unfavourable** | `#DC2626` (red) on `#FEF2F2` |
| **Back Button** | `bg: #F3F4F6`, `color: #374151` |
| **Next/Submit Button** | `bg: #EAB308`, `color: white` |
| **Layout** | Two-card wizard: 280px sidebar + flexible content area, min-height 640px |

---

## 12. How to Run

### Prerequisites
- Python 3.8+
- Node.js 18+
- PowerShell (Windows)

### One-Click Start
```powershell
cd vastu-analyser
.\start.ps1
```
This script:
1. Starts the backend (`uvicorn main:app --reload --port 8000`) in a new terminal
2. Starts the frontend (`npx vite --port 5173`) in another terminal
3. Opens `http://localhost:5173` in the default browser

### Manual Start
```powershell
# Terminal 1: Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

---

## 13. Potential Interview Questions & Answers

### Architecture & Design

**Q: Why did you choose FastAPI over Flask/Django?**  
A: FastAPI provides automatic request validation via Pydantic models, native async support for file uploads, and auto-generated OpenAPI documentation. It's significantly faster than Flask for I/O-bound operations (file parsing, image generation) and has a modern Python type-hint-driven design.

**Q: Why are floor plan images generated server-side with matplotlib instead of client-side?**  
A: The DXF file contains thousands of wall segments and complex coordinate systems. Rendering on the server with matplotlib avoids transferring raw geometry data (which can be several MB) to the client. The base64 PNG approach keeps the API simple (single JSON response) and eliminates the need for a WebGL/Canvas rendering library on the frontend.

**Q: Why use an in-memory cache (`FILE_CACHE`) instead of a database?**  
A: This is a single-user local development tool. An in-memory dict provides zero-latency lookups without database setup complexity. For a production deployment, this would be replaced with Redis or a database with TTL-based expiry.

**Q: Why is there no authentication?**  
A: This is designed as a local tool. For production, JWT or session-based auth would be added via FastAPI's dependency injection system.

### Algorithms

**Q: Explain the fuzzy scoring system.**  
A: Instead of hard 45° sector boundaries, I use a linear fuzzy membership function. If a room is at 350° and the East direction peaks at 0°, the angular distance is 10°. With a spread of 45°, membership = 1 - (10/45) ≈ 0.78. The room gets 78% of East's score. If it's also within 45° of NE (at 45°), it gets partial NE score too. This prevents cliff-edge score changes when rooms are near sector boundaries.

**Q: How does room detection handle ambiguous labels like "BED ROOM 1"?**  
A: The `detect_room_type()` function uses two passes. First, it tries multi-word subset matching — "bed room" matches "Elders Bedroom" aliases. Second, it falls back to substring matching. Digits are stripped during normalization, so "BED ROOM 1" becomes "bed room", which matches. The priority system (multi-word matches score higher) ensures "master bedroom" takes precedence over generic "bedroom".

**Q: What is `strip_mtext_formatting` and why is it needed?**  
A: AutoCAD's MTEXT format embeds formatting codes directly in the text string (e.g., `\fArial|b1;Kitchen\P` means "Kitchen in bold Arial with a paragraph break"). Without stripping these codes, the room detection algorithm would see `farialbkitchenp` and fail to match "Kitchen". The function uses regex to remove all standard MTEXT escape sequences.

### Frontend

**Q: How is state managed across wizard steps?**  
A: All state lives in `WizardPage.jsx` using React's `useState` hooks — 12 state variables total. State is passed down to step components as props, with setter functions passed as callbacks (e.g., `onRoomsUpdate={setRooms}`). This is a "lifted state" pattern — no external state management library is needed because data flows in one direction.

**Q: Why not use Redux or Zustand?**  
A: The wizard has only 5 steps with a linear flow. All state is needed by a single page component. The React built-in `useState` pattern is simpler, has zero bundle cost, and is perfectly adequate for this use case. Adding a state library would be over-engineering.

**Q: How does the CompassRose SVG work?**  
A: It's a pure SVG component with mathematically computed paths. Eight directional arcs are drawn using SVG arc commands (M, A, L paths). The floor plan image is clipped into a circle using SVG `<clipPath>`. Room dots are mapped from real-world coordinates to SVG coordinates using a scale factor derived from the bounds. The entire compass ring rotates via CSS transform based on `northOffset`.

**Q: How does the debounced preview work?**  
A: In `OrientationStep`, a `useEffect` watches `northOffset`. On each change, it clears the previous timeout and sets a new 400ms timeout. Only the last orientation change within 400ms triggers an API call. This prevents hammering the server when the user clicks Left/Right rapidly.

**Q: How are manually added rooms handled alongside detected rooms?**  
A: The `rooms[]` array is the single source of truth for positions. When a user clicks "Add Room", a new entry `{type, x, y}` is appended to this array (placed at the floor plan center). The `mergedRooms` computed array in `RoomLabelsStep` maps over `rooms[]` and pulls the display label from `analysisRows[i]` if it exists, or falls back to `room.type` for manually added ones. This ensures new rooms render correctly even without backend analysis data.

### Infrastructure

**Q: How are the frontend and backend connected?**  
A: The frontend runs on Vite dev server (port 5173) and makes HTTP requests to the FastAPI backend (port 8000) using axios. The backend has CORS middleware allowing all origins. The base URL is configured via a `.env` file with `VITE_API_BASE_URL`. Vite injects this at build time via `import.meta.env`.

**Q: How would you deploy this to production?**  
A: Backend: Dockerize the FastAPI app, use gunicorn with uvicorn workers, add Redis for file caching, add S3 for file storage. Frontend: Run `vite build` to produce static assets, serve via Nginx or a CDN. Set `VITE_API_BASE_URL` to the production API domain. Add HTTPS, authentication, rate limiting, and file cleanup cron jobs.

**Q: What is the `start.ps1` script?**  
A: A PowerShell one-click launcher that opens two terminal windows (backend + frontend), activates the Python virtual environment, starts both servers, and opens the browser automatically. It uses ASCII-only output to avoid PowerShell encoding issues.

---

## 14. Known Limitations & Future Improvements

1. **No persistent storage** — uploaded files and cache are lost on server restart
2. **Single-user** — in-memory cache doesn't support concurrent users
3. **No undo/redo** in the wizard
4. **Center point** (Brahmasthan) is a UI-only feature — the backend always uses the geometric center from bounds
5. **Room labels cannot be dragged** to different positions (only added/deleted)
6. **No PDF export** for the final report
7. **No mobile-responsive layout** — optimized for desktop (1100px+ width)

---

*Report generated for Vastu Analyser project — covers architecture, code, APIs, algorithms, and interview preparation.*
