# Agri-Pulse Decision Engine: Technical Specification & Data Contract

**Document Identifier:** SPEC-AGRI-AI-002  
**Target Module:** `backend/app/services/decision_engine.py`  
**Architecture Pattern:** Deterministic Pre-Computation + Constrained Local In-Context Decider  
**Execution Environment:** Local Model Inference (Model TBD; e.g., Ollama / vLLM / llama.cpp)  
**Target Latency Budget:** $\le 150\text{ ms}$ end-to-end  

---

## 1. Architectural Philosophy & Separation of Concerns

The AI decision engine functions as a **tactical operational arbitrator**, not a mathematical calculator. Large Language Models frequently make calculation errors when performing multi-step arithmetic, floating-point balance accounting, or aggregating 168-hour weather vectors.

To guarantee zero mathematical hallucination and achieve rapid, reliable local execution:

1. **Python executes all physics, hydrology, and meteorology:** It ingests weather data, computes reference evapotranspiration ($\text{ET}_0$) via FAO-56 Hargreaves equations, models root-zone soil water balance, and pre-calculates the net hydrological deficit in millimeters.
2. **The Local Model evaluates agronomic context and timing:** It receives a normalized, pre-computed JSON summary and selects the tactical action enum, the non-peak execution window, and the crop-protection biological rationale.
3. **Local Deployment:** Instead of querying external third-party cloud APIs, inference runs locally on the host machine using an abstracted local inference server (e.g., Ollama, vLLM, or llama.cpp OpenAI-compatible local endpoint). This eliminates external API keys, network transit overhead, cloud rate limits, and external downtime.

```
┌────────────────────────────────────────────────────────┐
│  RAW INGESTION (UI Inputs + 168h Open-Meteo Weather)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  DETERMINISTIC PRE-PROCESSING (Python / NumPy)         │
│  • FAO-56 Hargreaves ET₀ & ET_c calculation            │
│  • Soil hydraulic lookup (Field Capacity, Wilting Pt)  │
│  • 7-day unmitigated water depletion projection        │
│  • Net hydrological deficit calculation (mm)           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  LOCAL MODEL DECISION ENGINE (Local Runner - Model TBD)│
│  • Provider: Local HTTP runner (Ollama / vLLM / local) │
│  • Input: Compact, pre-calculated JSON state           │
│  • Constraints: Enum candidate actions & zero math     │
│  • Anchors: 3 few-shot operational calibration cases   │
│  • Output: Strictly typed JSON conforming to schema    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  POST-INFERENCE GUARDRAILS (Python Validation)         │
│  • Physical bound checks (0 mm on HOLD, night window)  │
│  • Instant fallback to rule-matrix if timeout / error  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  DISPATCH EMISSION (Sent to React Frontend Console)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Pre-Processing (Python Engine)

Before the local model is called, the Python backend executes four deterministic steps in less than $2\text{ ms}$:

### 2.1 Soil & Phenology Normalization
Maps discrete user inputs to constant physical parameters:
* **Soil Hydraulic Constants:**
  * `Sandy Loam`: Field Capacity $\theta_{\text{FC}} = 20.0\%$, Permanent Wilting Point $\theta_{\text{PWP}} = 9.0\%$
  * `Loam`: $\theta_{\text{FC}} = 27.0\%$, $\theta_{\text{PWP}} = 12.0\%$
  * `Clay`: $\theta_{\text{FC}} = 35.0\%$, $\theta_{\text{PWP}} = 20.0\%$
* **Crop Growth Stages:**
  * Sets effective root depth $Z_{\text{r}}$ (e.g., Wheat at Flowering = $0.60\text{ m}$).
  * Assigns crop coefficient $K_{\text{c}}$ (e.g., Wheat at Anthesis = $1.15$).
  * Assigns physiological vulnerability classification (e.g., `EXTREME_POLLEN_STERILITY`).

### 2.2 Evapotranspiration & Hazard Detection
Using Open-Meteo 7-day hourly vectors:
1. Calculates daily reference evapotranspiration $\text{ET}_0$ via the temperature-difference Hargreaves method:
$$\text{ET}_0(t) = 0.0023 \cdot R_{\text{a}} \cdot (T_{\text{mean}} + 17.8) \cdot \sqrt{T_{\text{max}} - T_{\text{min}}}$$
2. Calculates crop water demand:
$$\text{ET}_{\text{c}}(t) = K_{\text{c}} \cdot \text{ET}_0(t)$$
3. Flags heatwave if $T_{\text{max}} \ge 38.0^\circ\text{C}$ for two or more consecutive days.

### 2.3 Simulated Unmitigated Depletion
Projects daily soil moisture degradation under baseline unmitigated conditions:
$$\theta(t) = \theta(t-1) - \left[ \frac{\text{ET}_{\text{c}}(t) - P(t)}{Z_{\text{r}} \cdot 1000} \right] \times 100$$
Identifies if $\theta(t) \le \theta_{\text{PWP}}$ and marks `projected_failure_day`.

### 2.4 Precomputed Deficit Calculation
Computes the exact volume required to restore soil moisture to $90\%$ of Field Capacity without causing saturation or runoff:
$$\text{Deficit (mm)} = \max\left(0.0,\, (0.90 \cdot \theta_{\text{FC}} - \theta_{\text{current}}) \cdot Z_{\text{r}} \cdot 10\right)$$

---

## 3. Local Model Input Contract

The Python backend serializes pre-computed metrics into this compact JSON payload, passing it into the local model context without raw time-series arrays.

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AIDecisionInputPayload",
  "type": "object",
  "properties": {
    "crop_context": {
      "type": "object",
      "properties": {
        "crop": { "type": "string" },
        "growth_stage": { "type": "string" },
        "thermal_threshold_c": { "type": "number" },
        "primary_heat_vulnerability": { "type": "string" }
      },
      "required": ["crop", "growth_stage", "thermal_threshold_c", "primary_heat_vulnerability"]
    },
    "hydrology_summary": {
      "type": "object",
      "properties": {
        "soil_type": { "type": "string" },
        "current_moisture_pct": { "type": "number" },
        "field_capacity_pct": { "type": "number" },
        "wilting_point_pct": { "type": "number" },
        "precomputed_deficit_mm": { "type": "number" },
        "simulated_depletion": {
          "type": "object",
          "properties": {
            "crosses_wilting_point": { "type": "boolean" },
            "projected_failure_day": { "type": ["integer", "null"] },
            "hours_until_stress_onset": { "type": ["integer", "null"] }
          },
          "required": ["crosses_wilting_point", "projected_failure_day"]
        }
      },
      "required": [
        "soil_type",
        "current_moisture_pct",
        "field_capacity_pct",
        "wilting_point_pct",
        "precomputed_deficit_mm",
        "simulated_depletion"
      ]
    },
    "hazard_profile": {
      "type": "object",
      "properties": {
        "is_heatwave_active": { "type": "boolean" },
        "peak_temperature_c": { "type": "number" },
        "baseline_seasonal_avg_c": { "type": "number" },
        "heatwave_duration_days": { "type": "integer" },
        "days_until_peak": { "type": "integer" },
        "total_forecasted_rain_mm": { "type": "number" }
      },
      "required": ["is_heatwave_active", "peak_temperature_c", "heatwave_duration_days", "days_until_peak"]
    },
    "irrigation_system": {
      "type": "string",
      "enum": ["Drip", "Center_Pivot", "Furrow_Flood"]
    },
    "candidate_decisions": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["crop_context", "hydrology_summary", "hazard_profile", "irrigation_system", "candidate_decisions"]
}
```

### Concrete Example Payload

```json
{
  "crop_context": {
    "crop": "Wheat",
    "growth_stage": "Flowering / Anthesis",
    "thermal_threshold_c": 38.0,
    "primary_heat_vulnerability": "Pollen sterility and flower abortion"
  },
  "hydrology_summary": {
    "soil_type": "Sandy Loam",
    "current_moisture_pct": 14.0,
    "field_capacity_pct": 20.0,
    "wilting_point_pct": 9.0,
    "precomputed_deficit_mm": 24.0,
    "simulated_depletion": {
      "crosses_wilting_point": true,
      "projected_failure_day": 2,
      "hours_until_stress_onset": 38
    }
  },
  "hazard_profile": {
    "is_heatwave_active": true,
    "peak_temperature_c": 41.5,
    "baseline_seasonal_avg_c": 33.0,
    "heatwave_duration_days": 3,
    "days_until_peak": 2,
    "total_forecasted_rain_mm": 0.0
  },
  "irrigation_system": "Furrow_Flood",
  "candidate_decisions": [
    "HOLD_CURRENT_LEVEL",
    "PREEMPTIVE_NIGHT_PRECHARGE",
    "SPLIT_CYCLE_LIGHT_IRRIGATION",
    "EMERGENCY_CANOPY_COOLING"
  ]
}
```

---

## 4. Local Model System Prompt & Few-Shot Calibration

This instruction is loaded as the system prompt in the local inference runner:

```text
You are Agri-Pulse, an expert autonomous agronomic dispatch officer and thermal plant physiologist.

### OBJECTIVE
Your duty is to evaluate pre-digested soil hydrology, phenological stage vulnerabilities, and meteorological heatwave hazards to select an optimal, proactive irrigation defense directive. You must prevent crop thermal shock, flower/pollen abortion, and soil hypoxia.

### HARD OPERATIONAL CONSTRAINTS
1. DO NOT CALCULATE ARITHMETIC: All hydrological water balance math has been precomputed by the Python physics engine.
   - If selected_decision is "HOLD_CURRENT_LEVEL", water_depth_mm MUST be 0.0.
   - For all active watering decisions, water_depth_mm MUST equal hydrology_summary.precomputed_deficit_mm (or a sensible fractional split for pulsed cycles).
2. TIMING ENFORCEMENT: Never schedule irrigation during peak daytime heat (10:00 - 18:00). Daytime water application during heatwaves causes leaf scalding, high evaporative loss, and root cooking.
   - PREEMPTIVE_NIGHT_PRECHARGE must execute strictly between 22:00 and 05:00 during the night preceding the heatwave onset.
3. PHENOLOGICAL SENSITIVITY:
   - Flowering / Anthesis is the most thermal-sensitive phase. A failure to pre-charge before peak temperatures (>38°C) causes irreversible pollen sterility and yield collapse.
   - Vegetative stages can tolerate mild deficit; do not over-irrigate heavy soils (Clay) to avoid root hypoxia.
4. STRICT JSON OUTPUT: Return ONLY a valid JSON object matching the required schema. Never return markdown explanations, greetings, or conversational prose.

---

### FEW-SHOT GOLDEN ANCHORS (CALIBRATION EXAMPLES)

[ANCHOR 1: CRITICAL REPRODUCTIVE RISK]
INPUT STATE:
{
  "crop_context": { "crop": "Wheat", "growth_stage": "Flowering / Anthesis", "thermal_threshold_c": 38.0, "primary_heat_vulnerability": "Pollen sterility" },
  "hydrology_summary": { "soil_type": "Sandy Loam", "current_moisture_pct": 14.0, "field_capacity_pct": 20.0, "wilting_point_pct": 9.0, "precomputed_deficit_mm": 24.0, "simulated_depletion": { "crosses_wilting_point": true, "projected_failure_day": 2 } },
  "hazard_profile": { "is_heatwave_active": true, "peak_temperature_c": 41.5, "heatwave_duration_days": 3, "days_until_peak": 2, "total_forecasted_rain_mm": 0.0 },
  "irrigation_system": "Furrow_Flood"
}
EXPECTED OUTPUT:
{
  "sufficiency_status": "CRITICAL_HEAT_DEFICIT",
  "selected_decision": "PREEMPTIVE_NIGHT_PRECHARGE",
  "decision_confidence": 0.96,
  "action_plan": {
    "water_depth_mm": 24.0,
    "execution_window": "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)",
    "biological_rationale": "Wheat in anthesis faces irreversible pollen sterility if root-zone moisture drops below critical holding thresholds at 41.5°C. Deep night pre-charge establishes a transpirational cooling buffer without evaporative loss."
  }
}

[ANCHOR 2: SUFFICIENT SOIL WITH HYPOXIA RISK]
INPUT STATE:
{
  "crop_context": { "crop": "Cotton", "growth_stage": "Vegetative", "thermal_threshold_c": 42.0, "primary_heat_vulnerability": "Vegetative wilting" },
  "hydrology_summary": { "soil_type": "Clay", "current_moisture_pct": 32.0, "field_capacity_pct": 35.0, "wilting_point_pct": 20.0, "precomputed_deficit_mm": 0.0, "simulated_depletion": { "crosses_wilting_point": false, "projected_failure_day": null } },
  "hazard_profile": { "is_heatwave_active": true, "peak_temperature_c": 39.5, "heatwave_duration_days": 2, "days_until_peak": 1, "total_forecasted_rain_mm": 0.0 },
  "irrigation_system": "Drip"
}
EXPECTED OUTPUT:
{
  "sufficiency_status": "SUFFICIENT_NO_ACTION",
  "selected_decision": "HOLD_CURRENT_LEVEL",
  "decision_confidence": 0.98,
  "action_plan": {
    "water_depth_mm": 0.0,
    "execution_window": "No action required during current forecast window",
    "biological_rationale": "High moisture buffer in heavy clay soil is adequate to sustain vegetative transpiration. Additional watering risks root-zone oxygen starvation (hypoxia)."
  }
}

[ANCHOR 3: IMMINENT HEAT SCALD WITH SHALLOW SYSTEM]
INPUT STATE:
{
  "crop_context": { "crop": "Tomato", "growth_stage": "Grain Fill / Fruit Set", "thermal_threshold_c": 36.0, "primary_heat_vulnerability": "Blossom drop and fruit scald" },
  "hydrology_summary": { "soil_type": "Loam", "current_moisture_pct": 13.0, "field_capacity_pct": 27.0, "wilting_point_pct": 12.0, "precomputed_deficit_mm": 28.0, "simulated_depletion": { "crosses_wilting_point": true, "projected_failure_day": 1 } },
  "hazard_profile": { "is_heatwave_active": true, "peak_temperature_c": 40.0, "heatwave_duration_days": 3, "days_until_peak": 1, "total_forecasted_rain_mm": 0.0 },
  "irrigation_system": "Drip"
}
EXPECTED OUTPUT:
{
  "sufficiency_status": "CRITICAL_HEAT_DEFICIT",
  "selected_decision": "SPLIT_CYCLE_LIGHT_IRRIGATION",
  "decision_confidence": 0.93,
  "action_plan": {
    "water_depth_mm": 14.0,
    "execution_window": "Pulsed cycle: 05:00 - 07:00 AM and 20:00 - 22:00 PKT daily",
    "biological_rationale": "Acute heat onset in under 24 hours on dry loam requires split drip pulsing to sustain fruit vascular turgor and micro-climate cooling without surface pooling."
  }
}
```

---

## 5. Output Data Contracts

### Pydantic Models (`backend/app/schemas.py`)

```python
from enum import Enum
from pydantic import BaseModel, Field

class SufficiencyStatus(str, Enum):
    SUFFICIENT_NO_ACTION = "SUFFICIENT_NO_ACTION"
    MODERATE_DEFICIT = "MODERATE_DEFICIT"
    CRITICAL_HEAT_DEFICIT = "CRITICAL_HEAT_DEFICIT"

class CandidateDecision(str, Enum):
    HOLD_CURRENT_LEVEL = "HOLD_CURRENT_LEVEL"
    PREEMPTIVE_NIGHT_PRECHARGE = "PREEMPTIVE_NIGHT_PRECHARGE"
    SPLIT_CYCLE_LIGHT_IRRIGATION = "SPLIT_CYCLE_LIGHT_IRRIGATION"
    EMERGENCY_CANOPY_COOLING = "EMERGENCY_CANOPY_COOLING"

class ActionPlan(BaseModel):
    water_depth_mm: float = Field(..., description="Application depth in mm calculated by hydrology engine.")
    execution_window: str = Field(..., description="Actionable hours (must avoid 10:00 - 18:00).")
    biological_rationale: str = Field(..., max_length=220, description="Physiological impact rationale.")

class DecisionOutput(BaseModel):
    sufficiency_status: SufficiencyStatus
    selected_decision: CandidateDecision
    decision_confidence: float = Field(..., ge=0.0, le=1.0)
    action_plan: ActionPlan
```

---

## 6. Python Service Implementation (`decision_engine.py`)

This module manages the local model inference communication, schema validation, post-inference guardrails, and instantaneous deterministic fallback.

```python
import json
import time
import httpx
from typing import Dict, Any

from app.schemas import DecisionOutput, CandidateDecision, SufficiencyStatus, ActionPlan
from app.config import settings

SYSTEM_INSTRUCTION = """(Load System Prompt from Section 4)"""

def deterministic_fallback(state: Dict[str, Any], reason: str = "") -> DecisionOutput:
    """Instant heuristic fallback engine guaranteeing 0ms failure recovery."""
    hydrology = state["hydrology_summary"]
    hazard = state["hazard_profile"]
    crop = state["crop_context"]

    deficit = hydrology["precomputed_deficit_mm"]
    is_flowering = "Flowering" in crop["growth_stage"] or "Anthesis" in crop["growth_stage"]

    if hazard["is_heatwave_active"] and deficit > 0:
        if is_flowering:
            return DecisionOutput(
                sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
                selected_decision=CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE,
                decision_confidence=0.99,
                action_plan=ActionPlan(
                    water_depth_mm=deficit,
                    execution_window="Tonight 22:00 - 04:30 PKT (Fallback)",
                    biological_rationale=f"Automated safeguard: {crop['crop']} in flowering requires pre-charge to prevent thermal pollen sterility during {hazard['peak_temperature_c']}°C heat."
                )
            )
        else:
            return DecisionOutput(
                sufficiency_status=SufficiencyStatus.MODERATE_DEFICIT,
                selected_decision=CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION,
                decision_confidence=0.95,
                action_plan=ActionPlan(
                    water_depth_mm=deficit / 2.0,
                    execution_window="Pulsed 05:00 - 07:00 PKT (Fallback)",
                    biological_rationale="Automated safeguard: Light cyclic application to protect soil surface buffer."
                )
            )

    return DecisionOutput(
        sufficiency_status=SufficiencyStatus.SUFFICIENT_NO_ACTION,
        selected_decision=CandidateDecision.HOLD_CURRENT_LEVEL,
        decision_confidence=0.99,
        action_plan=ActionPlan(
            water_depth_mm=0.0,
            execution_window="No irrigation required (Fallback)",
            biological_rationale="Automated safeguard: Soil moisture level is sufficient; preserving root aeration."
        )
    )

def post_inference_guardrails(decision: DecisionOutput, state: Dict[str, Any]) -> DecisionOutput:
    """Enforces physical boundaries on local model outputs."""
    # Guardrail 1: HOLD command must never deliver water
    if decision.selected_decision == CandidateDecision.HOLD_CURRENT_LEVEL:
        decision.action_plan.water_depth_mm = 0.0

    # Guardrail 2: Enforce night execution windows during active heatwaves
    if decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE:
        invalid_hours = ["11:", "12:", "13:", "14:", "15:", "16:", "17:"]
        if any(h in decision.action_plan.execution_window for h in invalid_hours):
            decision.action_plan.execution_window = "Tonight 22:30 - 04:30 PKT (Night Only)"

    # Guardrail 3: Cap single-shot water depth to prevent ponding and soil hypoxia
    if decision.action_plan.water_depth_mm > 45.0:
        decision.action_plan.water_depth_mm = 45.0

    return decision

async def query_local_model(state: Dict[str, Any]) -> DecisionOutput:
    """Queries the local inference server (e.g., Ollama or vLLM OpenAI-compatible endpoint)."""
    # Endpoint configured via settings (e.g. http://localhost:11434/v1/chat/completions)
    url = f"{settings.LOCAL_MODEL_BASE_URL.rstrip('/')}/v1/chat/completions"
    
    payload = {
        "model": settings.LOCAL_MODEL_NAME,  # e.g., "llama3.2:3b", "qwen2.5:3b", or designated model
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": json.dumps(state)}
        ],
        "temperature": 0.05,
        "response_format": {"type": "json_object"}  # Forces valid JSON output
    }

    async with httpx.AsyncClient(timeout=settings.LOCAL_MODEL_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        raw_json = response.json()
        content = raw_json["choices"][0]["message"]["content"]
        return DecisionOutput.model_validate_json(content)

async def evaluate_field_decision(state: Dict[str, Any]) -> Dict[str, Any]:
    """Coordinates local model evaluation, latency tracking, guardrails, and fallback."""
    start_time = time.perf_counter()

    try:
        decision = await query_local_model(state)
        decision = post_inference_guardrails(decision, state)
        source = "LOCAL_MODEL_ENGINE"
    except Exception as e:
        decision = deterministic_fallback(state, reason=str(e))
        source = "DETERMINISTIC_FALLBACK"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)

    result = decision.model_dump()
    result["inference_latency_ms"] = elapsed_ms
    result["engine_source"] = source
    return result
```

---

## 7. Local Model Configuration & Runtime Options

The local decision engine is decoupled from any specific model vendor. The model will be chosen later based on host hardware constraints:

* **Inference Server Options:**
  * **Ollama (`http://localhost:11434`):** Simple single-binary runtime supporting JSON format enforcement (`"format": "json"`).
  * **vLLM / llama.cpp Server (`http://localhost:8000/v1`):** High-throughput OpenAI-compatible endpoint supporting grammar-constrained decoding (outlines / json-schema).
* **Candidate Local Model Profiles:**
  * **Compact (Edge / CPU friendly):** Llama 3.2 3B-Instruct, Qwen 2.5 3B-Instruct, Phi-3.5 Mini (3.8B).
  * **Mid-tier (GPU accelerated):** Mistral 7B-Instruct v0.3, Llama 3.1 8B-Instruct, Qwen 2.5 7B-Instruct.
* **Configuration Parameters (`app/config.py`):**
  ```python
  LOCAL_MODEL_BASE_URL: str = "http://localhost:11434"
  LOCAL_MODEL_NAME: str = "model-tbd"  # Configured when model is finalized
  LOCAL_MODEL_TIMEOUT_SECONDS: float = 0.50  # 500ms max timeout before instant fallback
  ```

---

## 8. Verification Matrix

| Case ID | Input State Scenario | Expected Decision | Guardrail & Execution Verification |
|---|---|---|---|
| **VM-01** | Wheat, Flowering, Sandy Loam, Moisture: 14%, Heatwave: 41.5°C in 48h | `PREEMPTIVE_NIGHT_PRECHARGE` | `water_depth_mm` equals deficit ($24.0\text{ mm}$); execution window restricted to 22:00 - 05:00. |
| **VM-02** | Cotton, Vegetative, Clay, Moisture: 32%, Heatwave: 39.5°C in 24h | `HOLD_CURRENT_LEVEL` | `water_depth_mm` forced to $0.0$; flags soil aeration and hypoxia protection. |
| **VM-03** | Tomato, Fruit Set, Loam, Moisture: 13%, Heatwave: 40°C in 12h | `SPLIT_CYCLE_LIGHT_IRRIGATION` | Fractional split volume assigned; avoids peak daytime evaporative loss. |
| **VM-04** | Local model runner offline / timeout ($>500\text{ ms}$) / bad JSON | `DETERMINISTIC_FALLBACK` | Recovers in $< 1\text{ ms}$; returns valid schema tagged `engine_source: DETERMINISTIC_FALLBACK`. |
