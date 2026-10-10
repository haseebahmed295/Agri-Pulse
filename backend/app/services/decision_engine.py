"""Agri-Pulse AI Decision Engine Service.

Implements prompt assembly, OpenAI-compatible local/remote client communication,
instant deterministic agronomic fallback, and execution orchestration with guardrails.
Conforms to SPEC-AGRI-AI-002.
"""

import json
import time
from typing import Any, Dict
import httpx

from app.config import settings
from app.schemas import (
    ActionPlan,
    AIDecisionInputPayload,
    CandidateDecision,
    DecisionOutput,
    SufficiencyStatus,
)
from app.services.guardrails import post_inference_guardrails

SYSTEM_INSTRUCTION = """You are Agri-Pulse, an expert autonomous agronomic dispatch officer and thermal plant physiologist.

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
4. STRICT JSON OUTPUT: Return ONLY a valid JSON object matching the required schema. Never return markdown fences, explanations, greetings, or conversational prose.

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
"""


def _normalize_state_dict(state: Dict[str, Any] | AIDecisionInputPayload) -> Dict[str, Any]:
    """Ensures state is represented as a clean dictionary."""
    if isinstance(state, AIDecisionInputPayload):
        return state.model_dump()
    return state


def deterministic_fallback(
    state: Dict[str, Any] | AIDecisionInputPayload,
    reason: str = "",
) -> DecisionOutput:
    """Instant heuristic fallback matrix guaranteeing <1ms zero-downtime recovery."""
    data = _normalize_state_dict(state)
    hydrology = data.get("hydrology_summary", {})
    hazard = data.get("hazard_profile", {})
    crop = data.get("crop_context", {})

    deficit = float(hydrology.get("precomputed_deficit_mm", 0.0))
    is_heatwave = bool(hazard.get("is_heatwave_active", False))
    peak_temp = float(hazard.get("peak_temperature_c", 35.0))
    crop_name = crop.get("crop", "Crop")
    stage = crop.get("growth_stage", "")
    soil_type = hydrology.get("soil_type", "Loam")

    # Determine failure timestamp callout
    depletion = hydrology.get("simulated_depletion", {})
    failure_day = depletion.get("projected_failure_day")
    projected_timestamp = f"Day {failure_day} at 14:00" if failure_day else None

    is_flowering = "Flowering" in stage or "Anthesis" in stage
    is_fruit_set = "Fruit Set" in stage or "Grain Fill" in stage or crop_name.lower() == "tomato"

    if is_heatwave and deficit > 0:
        if is_flowering:
            return DecisionOutput(
                engine_source="DETERMINISTIC_FALLBACK",
                sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
                selected_decision=CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE,
                decision_confidence=0.96,
                projected_depletion_timestamp=projected_timestamp,
                action_plan=ActionPlan(
                    water_depth_mm=deficit,
                    execution_window="Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)",
                    biological_rationale=(
                        f"{crop_name} in anthesis faces irreversible pollen sterility if root-zone moisture drops "
                        f"below critical holding thresholds at {peak_temp}°C. Deep night pre-charge establishes a transpirational cooling buffer."
                    ),
                ),
            )
        elif is_fruit_set or deficit <= 15.0:
            split_depth = round(deficit / 2.0, 1)
            return DecisionOutput(
                engine_source="DETERMINISTIC_FALLBACK",
                sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
                selected_decision=CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION,
                decision_confidence=0.93,
                projected_depletion_timestamp=projected_timestamp,
                action_plan=ActionPlan(
                    water_depth_mm=split_depth,
                    execution_window="Pulsed cycle: 05:00 - 07:00 AM and 20:00 - 22:00 PKT daily",
                    biological_rationale=(
                        f"Acute heat onset in under 24 hours on {soil_type} requires split drip pulsing to sustain "
                        "fruit vascular turgor and micro-climate cooling without surface pooling."
                    ),
                ),
            )
        else:
            return DecisionOutput(
                engine_source="DETERMINISTIC_FALLBACK",
                sufficiency_status=SufficiencyStatus.MODERATE_DEFICIT,
                selected_decision=CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION,
                decision_confidence=0.90,
                projected_depletion_timestamp=projected_timestamp,
                action_plan=ActionPlan(
                    water_depth_mm=round(deficit / 2.0, 1),
                    execution_window="Pulsed 05:00 - 07:00 PKT (Fallback)",
                    biological_rationale=f"Automated safeguard: Light cyclic application to protect {crop_name} surface moisture buffer.",
                ),
            )

    # If no heatwave or moisture is sufficient
    return DecisionOutput(
        engine_source="DETERMINISTIC_FALLBACK",
        sufficiency_status=SufficiencyStatus.SUFFICIENT_NO_ACTION,
        selected_decision=CandidateDecision.HOLD_CURRENT_LEVEL,
        decision_confidence=0.98,
        projected_depletion_timestamp=None,
        action_plan=ActionPlan(
            water_depth_mm=0.0,
            execution_window="No action required during current forecast window",
            biological_rationale=(
                f"High moisture buffer in {soil_type} soil is adequate to sustain vegetative transpiration. "
                "Additional watering risks root-zone oxygen starvation (hypoxia)."
            ),
        ),
    )


async def query_openai_compatible_model(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Queries any standard OpenAI-compatible chat completion endpoint with JSON formatting."""
    data = _normalize_state_dict(state)
    endpoint = f"{settings.OPENAI_API_BASE_URL.rstrip('/')}/chat/completions"

    headers = {"Content-Type": "application/json"}
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "not-needed":
        headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"

    payload = {
        "model": settings.AI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": json.dumps(data)},
        ],
        "temperature": 0.05,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=settings.AI_MODEL_TIMEOUT_SECONDS) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        raw_json = response.json()
        content = raw_json["choices"][0]["message"]["content"]
        
        # Parse the structured JSON response
        parsed = json.loads(content)
        
        # Inject timestamp from state if not populated by model
        depletion = data.get("hydrology_summary", {}).get("simulated_depletion", {})
        failure_day = depletion.get("projected_failure_day")
        if "projected_depletion_timestamp" not in parsed or not parsed["projected_depletion_timestamp"]:
            parsed["projected_depletion_timestamp"] = f"Day {failure_day} at 14:00" if failure_day else None

        parsed["engine_source"] = "OPENAI_COMPATIBLE_ENGINE"
        return DecisionOutput.model_validate(parsed)


async def evaluate_field_decision(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Coordinates AI model evaluation, latency measurement, guardrails, and deterministic fallback.

    Ensures the response always returns valid, boundary-checked DecisionOutput.
    """
    start_time = time.perf_counter()
    data = _normalize_state_dict(state)

    try:
        decision = await query_openai_compatible_model(data)
        source = "OPENAI_COMPATIBLE_ENGINE"
    except Exception as e:
        # Transparently recover with deterministic rule matrix in <1ms
        decision = deterministic_fallback(data, reason=str(e))
        source = "DETERMINISTIC_FALLBACK"

    # Enforce physical and agronomic guardrails
    decision = post_inference_guardrails(decision, data)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)
    decision.inference_latency_ms = elapsed_ms
    decision.engine_source = source

    return decision
