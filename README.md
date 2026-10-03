# Vastu Analyser

Turn a labelled DXF floor plan into an interactive Vastu analysis. Review the drawing, set its orientation, confirm the centre, check detected room labels, and explore room-by-room scores and recommendations in your browser.

The project pairs a React interface with a FastAPI service. You can run the core analysis locally without an AI API key; connecting Gemini adds AI-generated report text and chat.

## What you can do

- Upload a DXF floor plan up to 70 MB.
- Set the plan's north direction and confirm or adjust its centre point.
- Review detected rooms and edit labels before analysis.
- See directional room scores, recommendations, and a Vastu summary.
- Generate and print or save a report as a PDF.
- Optionally generate an AI-assisted report and ask questions about the analysis.

## Try it locally

### Requirements

- Python 3.10 or later
- Node.js 20.19+ or 22.12+, and npm (required by Vite 7)
- Windows PowerShell to use the included one-command launcher

### Windows

From the project folder, install the dependencies once:

```powershell
Set-Location "C:\path\to\Vastu-Analyser"

py -3 -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

Set-Location frontend
npm.cmd ci
Set-Location ..
```

Then start both services:

```powershell
.\start.ps1
```

The launcher opens the app at [http://127.0.0.1:5173](http://127.0.0.1:5173). The API runs at [http://127.0.0.1:8000](http://127.0.0.1:8000), with interactive API documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Press **Ctrl+C** in the server windows to stop them.

If PowerShell blocks the launcher, run it without changing your execution policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Run the services separately

If you prefer not to use PowerShell, start the API and frontend in separate terminals.

Backend, from `backend/`:

```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Frontend, from `frontend/`:

```powershell
npm run dev
```

The frontend uses `http://localhost:8000` for the API when opened locally. To use a different API address, set `VITE_API_BASE_URL` in `frontend/.env` and restart Vite.

### macOS and Linux

Create environments and install dependencies from the repository root:

```sh
python3 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
```

Start the backend from `backend/`:

```sh
venv/bin/python -m uvicorn main:app --reload --port 8000
```

Start the frontend from `frontend/` in another terminal:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Optional: enable Gemini

AI features use Google's Gemini API. Without a key, analysis still works and report generation uses a built-in deterministic fallback. To enable Gemini, set `GEMINI_API_KEY` in the environment before starting the backend. In PowerShell:

```powershell
$env:GEMINI_API_KEY = "your-key"
.\backend\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

On macOS or Linux:

```sh
export GEMINI_API_KEY="your-key"
```

Never commit API keys or local `.env` files.

## How analysis works

1. The parser reads supported wall lines and polylines, plus room labels from DXF text.
2. The wizard lets you set north, confirm the building centre, and review the detected rooms.
3. The backend places rooms into compass zones and scores them against the project's Vastu rules.
4. The report presents the results with recommendations; the optional Gemini integration adds a narrative and contextual chat.

The DXF reader intentionally supports a defined subset of model-space entities: `LINE` and `LWPOLYLINE` for walls, and `TEXT` and `MTEXT` for room labels. It does not interpret every CAD entity or infer room areas from polygons. Drawings that rely on blocks, arcs, hatches, dimensions, paper space, or other unsupported entities may be only partially interpreted. See [backend/DXF_SUPPORT.md](backend/DXF_SUPPORT.md) for details.

Vastu scores are informational interpretations of the rules in this project, not architectural, engineering, or safety advice.

## Development and tests

Frontend checks, from `frontend/`:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Backend tests, from `backend/`:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

End-to-end tests, from `e2e/` (requires Playwright's Chromium browser):

```powershell
npm.cmd ci
npx.cmd playwright test
```

For full cross-platform instructions and targeted test examples, see [TESTING.md](TESTING.md).

## Project layout

```text
backend/     FastAPI endpoints, DXF parsing, Vastu rules, and tests
frontend/    React application and UI tests
e2e/         Playwright smoke tests and a synthetic DXF fixture
start.ps1    Windows launcher for the local API and frontend
```
