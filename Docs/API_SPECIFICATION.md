# Agri-Pulse API Specification

**Document Identifier:** SPEC-AGRI-API-003  
**Base URL:** `http://localhost:8000`  
**API Version:** `v1.0.0` (Hackathon MVP)  
**Protocol:** HTTP/1.1 over TCP / REST JSON  
**Target Roundtrip Latency:** $\le 150\text{ ms}$ ($P_{95}$)  

---

## 1. Overview & Architecture Standards

The Agri-Pulse API connects the React (Vite) Single Page Application to the Python FastAPI backend. It serves three functional roles:
1. **Weather Ingestion:** Provides real-time and cached 168-hour public meteorological forecasts from Open-Meteo.
2. **Hydrological Evaluation & Dispatch:** Ingests field telemetry and simulation controls, executes deterministic FAO-56 moisture modeling, invokes the local decision model, applies agronomic guardrails, and returns actionable irrigation directives.
3. **Golden Demo Presets:** Delivers pre-configured demo scenarios for one-click testing without manual form entry.

### Global Headers
* `Content-Type: application/json`
* `Accept: application/json`

### Cross-Origin Resource Sharing (CORS)
The API runs with permissive CORS headers to support local Vite development (`http://localhost:5173`):
* `Access-Control-Allow-Origin: *`
* `Access-Control-Allow-Methods: GET, POST, OPTIONS`
* `Access-Control-Allow-Headers: *`

---

## 2. API Endpoints Summary

| Method | Endpoint | Description | Expected Latency |
|---|---|---|---|
| `GET` | `/api/health` | System health, local runner connectivity, and weather cache status | $< 2\text{ ms}$ |
| `GET` | `/api/weather` | 168-hour hourly weather forecast and thermal hazard summary | $< 25\text{ ms}$ |
| `POST` | `/api/evaluate` | Main evaluation engine (Telemetry $\rightarrow$ FAO-56 $\rightarrow$ Local AI $\rightarrow$ Dispatch) | $< 120\text{ ms}$ |
| `GET` | `/api/presets/{preset_id}` | Returns pre-configured Golden Demo scenario payloads (`crisis`, `trap`, `scald`) | $< 2\text{ ms}$ |

---

## 3. Endpoint Specifications

### 3.1 Health Check (`GET /api/health`)

Checks server readiness, local model server reachability, and weather fallback cache.

#### Request
```http
GET /api/health HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "local_model_engine": {
    "provider": "ollama",
    "base_url": "http://localhost:11434",
    "status": "connected"
  },
  "weather_pipeline": {
    "provider": "Open-Meteo",
    "status": "online",
    "cached": true
  },
  "timestamp": "2026-10-10T10:30:00Z"
}
```

---

### 3.2 Weather Forecast Ingestion (`GET /api/weather`)

Fetches hourly 7-day meteorological vectors for the target agricultural sector. If the external Open-Meteo API is unreachable, it automatically serves cached seasonal averages.

#### Request Parameters (Query)
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `latitude` | `float` | No | `33.6844` | Sector latitude (default: Rawalpindi/Islamabad) |
| `longitude` | `float` | No | `73.0479` | Sector longitude (default: Rawalpindi/Islamabad) |

#### Request Example
```http
GET /api/weather?latitude=33.6844&longitude=73.0479 HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "location": {
    "latitude": 33.6844,
    "longitude": 73.0479,
    "timezone": "Asia/Karachi"
  },
  "hazard_summary": {
    "is_heatwave_active": true,
    "peak_temperature_c": 41.5,
    "baseline_seasonal_avg_c": 33.0,
    "heatwave_duration_days": 3,
    "days_until_peak": 2,
    "total_forecasted_rain_mm": 0.0
  },
  "hourly_series": {
    "timestamps": ["2026-10-10T00:00", "2026-10-10T01:00"],
    "temperature_2m": [26.4, 25.8],
    "relative_humidity_2m": [58.0, 61.0],
    "precipitation": [0.0, 0.0]
  },
  "cache_status": "live"
}
```

---

### 3.3 Main Decision & Hydrology Evaluation (`POST /api/evaluate`)

The core application endpoint. It ingests physical telemetry, executes deterministic FAO-56 equations, evaluates the local AI model, applies post-inference safety guardrails, and outputs the operational dispatch card alongside 7-day visualization curves for Recharts.

#### Request Body (`JSON`)

| Field | Type | Required | Constraints / Enums | Description |
|---|---|---|---|---|
| `crop_type` | `string` | Yes | `Wheat`, `Maize`, `Cotton`, `Tomato` | Target crop species |
| `growth_stage` | `string` | Yes | `Vegetative`, `Flowering_Anthesis`, `Grain_Fill`, `Maturity` | Discrete phenological phase |
| `soil_texture` | `string` | Yes | `Sandy Loam`, `Loam`, `Clay` | Soil hydraulic classification |
| `current_moisture_pct` | `float` | Yes | `5.0` to `50.0` | Volumetric soil water content ($\theta$) |
| `irrigation_system` | `string` | Yes | `Drip`, `Center_Pivot`, `Furrow_Flood` | Field delivery hardware |
| `simulated_heat_spike` | `float` | No | Default: `0.0` | Temperature offset (e.g., `6.0` for $+6^\circ\text{C}$ spike) |
| `peak_temperature_override`| `float`| No | `30.0` to `48.0` | Direct slider override for peak temperature |
| `latitude` | `float` | No | Default: `33.6844` | Geographic coordinate |
| `longitude` | `float` | No | Default: `73.0479` | Geographic coordinate |

#### Request Example
```json
{
  "crop_type": "Wheat",
  "growth_stage": "Flowering_Anthesis",
  "soil_texture": "Sandy Loam",
  "current_moisture_pct": 14.0,
  "irrigation_system": "Furrow_Flood",
  "simulated_heat_spike": 6.0,
  "peak_temperature_override": 41.5
}
```

#### Response (`200 OK`)
```json
{
  "decision_id": "7b8e1a2f-5b6d-4d2b-9a1c-3e4f5a6b7c8d",
  "timestamp": "2026-10-10T10:35:12Z",
  "engine_source": "LOCAL_MODEL_ENGINE",
  "inference_latency_ms": 28.4,
  "total_latency_ms": 34.1,
  "sufficiency_status": "CRITICAL_HEAT_DEFICIT",
  "selected_decision": "PREEMPTIVE_NIGHT_PRECHARGE",
  "decision_confidence": 0.96,
  "action_plan": {
    "water_depth_mm": 24.0,
    "execution_window": "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)",
    "biological_rationale": "Wheat in anthesis faces irreversible pollen sterility if root-zone moisture drops below critical holding thresholds at 41.5C. Deep night pre-charge establishes a transpirational cooling buffer without evaporative loss."
  },
  "projected_depletion_timestamp": "Day 2 at 14:00",
  "hydrology_summary": {
    "field_capacity_pct": 20.0,
    "wilting_point_pct": 9.0,
    "current_moisture_pct": 14.0,
    "precomputed_deficit_mm": 24.0,
    "root_depth_cm": 60
  },
  "chart_series": [
    {
      "day": 1,
      "date": "Oct 10",
      "forecast_temp_c": 36.5,
      "baseline_moisture_pct": 14.0,
      "protected_moisture_pct": 18.0,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": false
    },
    {
      "day": 2,
      "date": "Oct 11",
      "forecast_temp_c": 41.5,
      "baseline_moisture_pct": 8.5,
      "protected_moisture_pct": 14.8,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": true
    },
    {
      "day": 3,
      "date": "Oct 12",
      "forecast_temp_c": 40.0,
      "baseline_moisture_pct": 5.2,
      "protected_moisture_pct": 11.4,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": true
    },
    {
      "day": 4,
      "date": "Oct 13",
      "forecast_temp_c": 37.0,
      "baseline_moisture_pct": 5.0,
      "protected_moisture_pct": 9.6,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": false
    },
    {
      "day": 5,
      "date": "Oct 14",
      "forecast_temp_c": 34.0,
      "baseline_moisture_pct": 5.0,
      "protected_moisture_pct": 9.0,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": false
    },
    {
      "day": 6,
      "date": "Oct 15",
      "forecast_temp_c": 33.5,
      "baseline_moisture_pct": 5.0,
      "protected_moisture_pct": 8.5,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": false
    },
    {
      "day": 7,
      "date": "Oct 16",
      "forecast_temp_c": 32.0,
      "baseline_moisture_pct": 5.0,
      "protected_moisture_pct": 8.0,
      "wilting_point_pct": 9.0,
      "field_capacity_pct": 20.0,
      "is_critical_heat": false
    }
  ]
}
```

---

### 3.4 Golden Demo Presets (`GET /api/presets/{preset_id}`)

Retrieves pre-configured scenario input payloads for quick UI loading or automated test seeding.

#### Path Parameters
* `preset_id`: One of `crisis`, `trap`, `scald`.

#### Preset Definitions
* `crisis`: Wheat · Flowering · Sandy Loam · Moisture 14% · 41.5°C Peak Heat.
* `trap`: Cotton · Vegetative · Clay · Moisture 33% · 39.5°C Heat (Testing hypoxia hold).
* `scald`: Tomato · Fruit Set · Loam · Moisture 13% · 40.0°C in 12h (Testing pulsed cycle).

#### Request Example
```http
GET /api/presets/crisis HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "preset_id": "crisis",
  "label": "Scenario A: Anthesis Thermal Crisis",
  "payload": {
    "crop_type": "Wheat",
    "growth_stage": "Flowering_Anthesis",
    "soil_texture": "Sandy Loam",
    "current_moisture_pct": 14.0,
    "irrigation_system": "Furrow_Flood",
    "simulated_heat_spike": 6.0,
    "peak_temperature_override": 41.5
  }
}
```

---

## 4. Error Responses & Fallback Behavior

### 4.1 Schema Validation Failure (`422 Unprocessable Entity`)
Returned when an incoming field violates enum constraints or bounds (e.g., negative moisture or unknown crop).

```json
{
  "detail": [
    {
      "loc": ["body", "current_moisture_pct"],
      "msg": "Input should be greater than or equal to 5.0",
      "type": "greater_than_equal"
    }
  ]
}
```

### 4.2 Local Model Timeout or Failure (`200 OK with Fallback Tag`)
If the local model runner is offline, errors out, or exceeds 500 ms, the API **does not return HTTP 500**. Instead, it triggers the deterministic agronomic matrix in $<1\text{ ms}$ and marks the output:

```json
{
  "decision_id": "9a2f1c3e-4b5d-4e6f-8a1c-7b8e1a2f5b6d",
  "engine_source": "DETERMINISTIC_FALLBACK",
  "inference_latency_ms": 0.8,
  "sufficiency_status": "CRITICAL_HEAT_DEFICIT",
  "selected_decision": "PREEMPTIVE_NIGHT_PRECHARGE",
  "decision_confidence": 0.99,
  "action_plan": {
    "water_depth_mm": 24.0,
    "execution_window": "Tonight 22:00 - 04:30 PKT (Fallback Safeguard)",
    "biological_rationale": "Automated safeguard: Wheat in flowering requires pre-charge to prevent thermal pollen sterility during 41.5C heat."
  }
}
```

---

## 5. cURL Testing Quick Reference

### Test Health
```bash
curl -X GET http://localhost:8000/api/health
```

### Test Weather Ingestion
```bash
curl -X GET "http://localhost:8000/api/weather?latitude=33.6844&longitude=73.0479"
```

### Test Full Evaluation (Scenario A: Crisis)
```bash
curl -X POST http://localhost:8000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "crop_type": "Wheat",
    "growth_stage": "Flowering_Anthesis",
    "soil_texture": "Sandy Loam",
    "current_moisture_pct": 14.0,
    "irrigation_system": "Furrow_Flood",
    "simulated_heat_spike": 6.0,
    "peak_temperature_override": 41.5
  }'
```

### Test Fetching Preset
```bash
curl -X GET http://localhost:8000/api/presets/crisis
```
