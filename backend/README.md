# Agri-Pulse backend endpoints

Phase one implements the four HTTP routes in `../Docs/API_SPECIFICATION.md`, typed
request/response contracts, validation errors, CORS, presets, and Swagger docs.

Weather and evaluation are **mock providers**. Weather returns 168 synthetic
hours. Evaluation validates the submitted fields but always returns the fixed
Wheat crisis example, including seven chart points. It does not calculate a
recommendation from the inputs. Responses carry `X-AgriPulse-Mode: mock`,
`cache_status: mock`, or `engine_source: MOCK`. These explicit development markers
will be replaced by the specification's live/fallback markers during integration.
Health reports degraded/unconfigured services instead of claiming connectivity.

Live Open-Meteo ingestion, persistent weather caching, FAO-56 hydrology, local
model inference, timeout handling, and agronomic guardrails are subsequent work.
Performance targets have not been benchmarked.

## Run locally

Install Python 3.11 or newer. From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe run.py
```

API: `http://localhost:8000` — Swagger: `http://localhost:8000/docs`.

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

Routes:

- `GET /api/health`
- `GET /api/weather?latitude=33.6844&longitude=73.0479`
- `POST /api/evaluate`
- `GET /api/presets/{crisis|trap|scald}`

Unknown preset IDs return 404; invalid inputs return FastAPI's 422 detail array.
The scald preset uses the API enum `Grain_Fill` for the Fruit Set display label.
Omitted location fields default to Islamabad and omitted heat spike defaults to 0.
