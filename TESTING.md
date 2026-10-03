# Testing Vastu Analyser

Run each layer from its own directory so configuration and fixtures resolve consistently. The commands below do not require paid services or external APIs after dependencies are installed.

## Prerequisites

- Python dependencies installed in `backend/venv` (Windows) or an equivalent active virtual environment.
- Frontend dependencies installed from `frontend/package-lock.json` with `npm ci`.
- Playwright dependencies installed from `e2e/package-lock.json` with `npm ci` and a local Chromium browser available to Playwright.
- Ports `8000` and `5173` available for the end-to-end suite, or occupied only by the matching local backend/frontend processes.

On Windows PowerShell installations that block `npm.ps1`, use the explicit `npm.cmd` and `npx.cmd` launchers shown below. No execution-policy change is required.

## Windows PowerShell

Backend, from `backend/`:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

Frontend, from `frontend/`:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

End to end, from `e2e/`:

```powershell
npx.cmd playwright test
```

The Playwright configuration starts FastAPI and Vite automatically, uses the checked synthetic `tests/fixtures/sample.dxf`, and retains a trace and screenshot for failures. It reuses an already-running server only when the configured local URL responds.

## POSIX shells

Use the equivalent launchers from the same directories:

```sh
# backend/
./venv/bin/python -m pytest -q

# frontend/
npm run test
npm run lint
npm run build

# e2e/
npx playwright test
```

If the Python environment has another documented path, use its interpreter rather than creating a second environment solely to match these examples.

## Targeted checks

Pytest accepts a test path or node ID:

```powershell
.\venv\Scripts\python.exe -m pytest -q tests\test_main.py
```

Vitest accepts paths after `--`:

```powershell
npm.cmd run test -- src\api\__tests__\vastuApi.test.js
```

Playwright accepts a file, title filter, or UI option:

```powershell
npx.cmd playwright test tests\smoke.spec.js
npx.cmd playwright test --grep "critical wizard journey"
```

## Test-data and artifact policy

- Backend DXFs are generated from synthetic `0..100` coordinate fixtures during tests.
- The checked E2E DXF is synthetic, contains no personal floor-plan data, and states its expected bounds and room insertion points in DXF comments.
- `backend/temp/`, `frontend/dist/`, and Playwright `test-results/` are generated/ignored output. Do not treat them as source fixtures.
- Do not weaken assertions, skip failing tests, or suppress lint rules to make a run green. Record product defects separately from harness or environment failures.

Current measured counts and known pre-existing findings belong in the active stage report, not in this command guide, because counts change as coverage grows.
