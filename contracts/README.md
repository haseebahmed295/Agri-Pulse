# Agri-Pulse Data Contracts

This directory contains the shared interface contracts between the **Agri-Pulse** frontend (React / TypeScript) and backend (FastAPI / Python).

---

## Files

| File | Type | Description |
|---|---|---|
| [`decision_types.ts`](decision_types.ts) | TypeScript Definitions | Shared types matching backend Pydantic schemas in `backend/app/api/schemas.py`. |
| [`mock_decision_response.json`](mock_decision_response.json) | JSON Contract | Canonical response payload for tactical evaluation (Wheat anthesis heat crisis). |
| [`mock_weather_hydrology.json`](mock_weather_hydrology.json) | JSON Contract | Canonical 168-hour weather forecast and FAO-56 hydrological depletion input contract. |

---

## Contract Schemas

### 1. Tactical Evaluation Response (`mock_decision_response.json`)

The output delivered by `POST /api/evaluate`:

```json
{
  "decision_id": "7b8e1a2f-5b6d-4d2b-9a1c-3e4f5a6b7c8d",
  "inference_latency_ms": 24.5,
  "engine_source": "LOCAL_MODEL_ENGINE",
  "sufficiency_status": "CRITICAL_HEAT_DEFICIT",
  "selected_decision": "PREEMPTIVE_NIGHT_PRECHARGE",
  "decision_confidence": 0.96,
  "projected_depletion_timestamp": "Day 2 at 14:00",
  "action_plan": {
    "water_depth_mm": 24.0,
    "execution_window": "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)",
    "biological_rationale": "Wheat in anthesis faces irreversible pollen sterility if root-zone moisture drops below critical holding thresholds at 41.5°C. Deep night pre-charge establishes a transpirational cooling buffer without evaporative loss."
  }
}
```

#### Fields Reference
- `decision_id`: Unique identifier (UUIDv4) for the evaluation run.
- `inference_latency_ms`: Roundtrip execution latency of the decision engine in milliseconds.
- `engine_source`: Engine provider string (`LOCAL_MODEL_ENGINE`, `DETERMINISTIC_FALLBACK`, or `OPENAI_COMPATIBLE_ENGINE`).
- `sufficiency_status`: Enum representing hydrological state:
  - `SUFFICIENT_NO_ACTION`: Soil moisture adequate through forecast heat event.
  - `MODERATE_DEFICIT`: Marginal deficit requiring daytime hold or split cycle.
  - `CRITICAL_HEAT_DEFICIT`: Urgent threshold breach requiring preemptive recharge.
- `selected_decision`: Tactical irrigation directive:
  - `HOLD_CURRENT_LEVEL`
  - `PREEMPTIVE_NIGHT_PRECHARGE`
  - `SPLIT_CYCLE_LIGHT_IRRIGATION`
  - `EMERGENCY_CANOPY_COOLING`
- `decision_confidence`: Float between `0.0` and `1.0`.
- `action_plan`:
  - `water_depth_mm`: Irrigation application depth in millimeters (float, non-negative).
  - `execution_window`: Specific operational time window (e.g., nighttime irrigation to prevent daytime evaporation).
  - `biological_rationale`: Agronomic justification detailing crop stage, thermal vulnerability, and transpirational dynamics.

---

### 2. Weather & Hydrological Payload (`mock_weather_hydrology.json`)

Contract describing field telemetry and 7-day micro-climate vectors:

- `crop_context`: Crop species, phenological stage, thermal limit (°C), and primary vulnerability.
- `hydrology_summary`: Soil texture class, current volumetric water content, field capacity, permanent wilting point, and projected exhaustion timing.
- `hazard_profile`: Thermal wave status, peak forecast temperature, heatwave duration, days until peak, and rainfall estimates.
- `candidate_decisions`: Allowable action set for evaluation.

---

## Type Synchronization

When updating models:
1. Ensure changes to `backend/app/api/schemas.py` are reflected in `decision_types.ts`.
2. Run backend test suite:
   ```bash
   pytest backend/tests/test_ai_schemas.py
   ```
3. Run frontend TypeScript verification:
   ```bash
   cd frontend && npx tsc -b
   ```
