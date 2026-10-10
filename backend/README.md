# Agri-Pulse Backend Service

The **Agri-Pulse Backend** is an asynchronous Python service built with FastAPI, Pydantic v2, and Uvicorn. It coordinates meteorological ingestion, hydrological modeling (FAO-56), ultra-fast local AI decision inference, agronomic safety guardrails, and deterministic fallback execution.

---

## Architecture Overview

```
Client (Vite / React)
        │
        ▼
   [FastAPI HTTP Router] (/api/health, /api/weather, /api/evaluate, /api/presets)
        │
   ┌────┴──────────────────────────────┐
   │                                   │
   ▼                                   ▼
[Weather Pipeline]             [Evaluation Service]
 - Open-Meteo Live API          - Pydantic Validation
 - 168h Hourly Vectors          - FAO-56 Hydrological Depletion
 - Disk Cache Fallback          - AI Decision Engine
                                  ├── Fast Logit Scoring (<150ms)
                                  └── Deterministic Fallback Matrix (<1ms)
                                - Agronomic Guardrails Post-Validation
                                  ├── Hypoxia Water Depth Cap
                                  ├── Night Window Enforcement
                                  └── Zero Depth for HOLD
```

---

## Core Capabilities

1. **Weather Ingestion & Thermal Hazard Profiling (`app/services/weather_service.py`)**:
   - Queries Open-Meteo for 168-hour (7-day) forecast vectors of temperature, humidity, wind, and precipitation.
   - Detects heatwaves (temperatures exceeding baseline by ≥4.0°C for ≥2 consecutive days).
   - Graceful offline fallback: if Open-Meteo is unreachable, cached local profiles are served immediately with `cache_status: "offline_cached"`.

2. **FAO-56 Hydrological Depletion Engine (`app/services/evaluation_service.py`)**:
   - Simulates daily crop evapotranspiration ($ET_c = ET_0 \times K_c$).
   - Calculates volumetric water content trajectory across Sandy Loam, Loam, and Clay soils.
   - Computes wilting point threshold breaches and projected failure timestamps.

3. **Multi-Tier Decision Engine (`app/services/decision_engine.py`)**:
   - **TypeSafe AI System One (Cloud Primary):** Queries the TypeSafe AI cloud API (`https://api.typesafe.ai/v1/systemone` using `jev-latest` / `typesafe-sdk`) for fast, calibrated, discrete tactical action selection (`PREEMPTIVE_NIGHT_PRECHARGE`, `HOLD_CURRENT_LEVEL`, `SPLIT_CYCLE_LIGHT_IRRIGATION`, `EMERGENCY_CANOPY_COOLING`) and water sufficiency status. Enables zero-GPU, lightweight cloud deployment.
   - **Local Inference Fallback (Optional):** Supports local GGUF runners (`llama-server`) via single-pass logit scoring or OpenAI-compatible `/v1/chat/completions`.
   - **Deterministic Fallback Matrix:** Sub-millisecond rules-based agronomic lookup table that guarantees reliable operation even if network or inference runners are offline.

4. **Agronomic Safety Guardrails (`app/services/guardrails.py`)**:
   - **Fault 1:** Enforces `water_depth_mm == 0.0` when decision is `HOLD_CURRENT_LEVEL`.
   - **Fault 2:** Restricts `PREEMPTIVE_NIGHT_PRECHARGE` to nocturnal hours (21:00 to 05:30) to eliminate daytime evaporative losses.
   - **Fault 3:** Caps irrigation depth to prevent field capacity oversaturation and hypoxic root death in heavy soils.

---

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health status of backend, local inference server, and weather cache. |
| `GET` | `/api/weather` | 168-hour hourly weather forecast and thermal hazard analysis. |
| `POST` | `/api/evaluate` | Evaluates field telemetry and returns tactical irrigation directive. |
| `GET` | `/api/presets/{preset_id}` | Returns Golden Demo scenario inputs (`crisis`, `trap`, `scald`). |

Interactive Swagger documentation is available at `http://localhost:8000/docs` when the server is running.

---

## Getting Started

### Prerequisites
- Python 3.11 or newer
- Virtual environment tool (`venv`)

### Installation & Execution (PowerShell on Windows)

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install production & development dependencies
pip install -r requirements-dev.txt

# 5. Start development server
python run.py
```

The API will start at:
- **Base URL:** `http://localhost:8000`
- **Swagger Documentation:** `http://localhost:8000/docs`
- **OpenAPI Schema:** `http://localhost:8000/openapi.json`

---

## Configuration
 
Settings are managed via Pydantic BaseSettings in `app/config.py`. You can configure TypeSafe AI and engine options using environment variables (with or without `AGRI_` prefix):

| Environment Variable | Default Value | Description |
|---|---|---|
| `TYPESAFE_API_KEY` | *(Configured)* | API key for TypeSafe System One cloud inference. |
| `TYPESAFE_MODEL` | `jev-latest` | TypeSafe System One model identifier. |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | Base URL for TypeSafe API. |
| `TYPESAFE_TIMEOUT_SECONDS` | `4.0` | Timeout threshold before fallback triggers. |
| `USE_TYPESAFE_API` | `True` | Set to `True` for cloud TypeSafe API mode. |
| `AGRI_LOCAL_MODEL_BASE_URL` | `http://127.0.0.1:8080` | URL for local GGUF llama-server runner (optional). |
| `AGRI_AI_MODEL_TIMEOUT_SECONDS` | `3.0` | Timeout threshold before fallback triggers. |
| `AGRI_USE_FAST_DECISION_ENGINE` | `True` | Enable single-pass logit scoring mode. |
| `AGRI_FALLBACK_ENABLED` | `True` | Enable instant deterministic matrix fallback. |

---

## Cloud Deployment (Docker)

To deploy the backend to any cloud provider (Render, Railway, Fly.io, Cloud Run):

1. **Build the container:**
   ```bash
   docker build -t agri-pulse-backend .
   ```
2. **Run container with your TypeSafe API key:**
   ```bash
   docker run -p 8000:8000 -e TYPESAFE_API_KEY="your_api_key_here" agri-pulse-backend
   ```

---

## Testing

The test suite contains 45 automated tests covering schemas, endpoints, TypeSafe AI decision engine logic, safety guardrails, and weather ingestion.

Run the full test suite with pytest:

```powershell
python -m pytest tests -v
```

### Test Breakdown
- `tests/test_api.py`: Validates all HTTP routes, health checks, input validation error codes (422), CORS headers, and preset retrieval.
- `tests/test_ai_schemas.py`: Verifies Pydantic contracts and range validations.
- `tests/test_decision_engine.py`: Tests the 3 Golden Demo scenarios, TypeSafe AI live queries, unreachable endpoint fallback, and deterministic fallback speed.
- `tests/test_guardrails.py`: Tests automatic remediation of agronomic faults.
- `tests/test_weather.py`: Tests Open-Meteo live parsing, hazard calculations, and cache fallback.
