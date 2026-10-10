"""Agri-Pulse AI Decision Engine Service.

Implements prompt assembly, fast single-pass logit scoring (/completion),
OpenAI-compatible chat completions (/v1/chat/completions),
instant deterministic agronomic fallback, and execution orchestration with guardrails.
Conforms to SPEC-AGRI-AI-002.
"""

import json
import logging
import math
import time
from typing import Any, Dict, List, Tuple
import httpx

try:
    from typesafe_sdk import AsyncTypeSafeClient, Choice
except ImportError:
    AsyncTypeSafeClient = None  # type: ignore
    Choice = None  # type: ignore

from app.config import settings
from app.schemas import (
    ActionPlan,
    AIDecisionInputPayload,
    CandidateDecision,
    DecisionOutput,
    SufficiencyStatus,
)
from app.services.guardrails import post_inference_guardrails

logger = logging.getLogger(__name__)

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

CANDIDATE_CHOICES: List[Tuple[str, str]] = [
    ("HOLD_CURRENT_LEVEL", "No action needed; root soil moisture buffer is sufficient; extra water risks hypoxia."),
    ("PREEMPTIVE_NIGHT_PRECHARGE", "Deep night pre-charge before heatwave for flowering crops facing pollen sterility."),
    ("SPLIT_CYCLE_LIGHT_IRRIGATION", "Split cyclic light irrigation to prevent blossom drop, fruit scald, and midday wilting."),
    ("EMERGENCY_CANOPY_COOLING", "Direct canopy misting/cooling during extreme heat."),
]


def _normalize_state_dict(state: Dict[str, Any] | AIDecisionInputPayload) -> Dict[str, Any]:
    """Ensures state is represented as a clean dictionary."""
    if isinstance(state, AIDecisionInputPayload):
        return state.model_dump()
    return state


def _format_state_summary(data: Dict[str, Any]) -> str:
    """Produces a clean, dense textual summary of the field and weather state."""
    crop = data.get("crop_context", {})
    hydrology = data.get("hydrology_summary", {})
    hazard = data.get("hazard_profile", {})

    crop_name = crop.get("crop", "Crop")
    stage = crop.get("growth_stage", "Vegetative")
    thresh = crop.get("thermal_threshold_c", 38.0)
    vuln = crop.get("primary_heat_vulnerability", "Thermal stress")

    soil = hydrology.get("soil_type", "Loam")
    current_m = hydrology.get("current_moisture_pct", 15.0)
    fc = hydrology.get("field_capacity_pct", 25.0)
    wp = hydrology.get("wilting_point_pct", 12.0)
    deficit = hydrology.get("precomputed_deficit_mm", 0.0)

    heatwave = hazard.get("is_heatwave_active", False)
    peak_t = hazard.get("peak_temperature_c", 35.0)
    days_peak = hazard.get("days_until_peak", 1)

    deficit_note = " (Moisture buffer is high, additional water causes root hypoxia)" if deficit <= 0.0 else ""

    return (
        f"Crop: {crop_name} at stage '{stage}' (Thermal Threshold: {thresh}°C, Vulnerability: {vuln}). "
        f"Hydrology: Soil '{soil}', Current Moisture: {current_m}%, Field Capacity: {fc}%, Wilting Point: {wp}%, Precomputed Deficit: {deficit} mm{deficit_note}. "
        f"Hazard: Heatwave Active={heatwave}, Peak Temp={peak_t}°C in {days_peak} days."
    )


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


async def query_fast_decision_engine(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Performs single-pass logit scoring (n_predict=1) on llama-server /completion endpoint (~40-200ms).

    Directly leverages the single-token decision architecture from D:\\Models\\browser\\harness\\decision.py.
    """
    data = _normalize_state_dict(state)
    symbols = [chr(ord("A") + i) for i in range(len(CANDIDATE_CHOICES))]
    schema_lines = "\n".join(
        [f"[{symbols[i]}] {name} - {desc}" for i, (name, desc) in enumerate(CANDIDATE_CHOICES)]
    )
    state_str = _format_state_summary(data)

    prompt = (
        "<|im_start|>system\n"
        "You are an expert autonomous agronomic dispatch officer and thermal plant physiologist. "
        "Choose the single letter symbol (A, B, C, or D) corresponding to the optimal tactical irrigation directive.<|im_end|>\n"
        "<|im_start|>user\n"
        f"State: {state_str}\n\n"
        "Question: Which tactical irrigation directive must be executed?\n"
        f"Choices:\n{schema_lines}<|im_end|>\n"
        "<|im_start|>assistant\n"
        "<think>\n</think>\n"
        '{"decision": "'
    )

    payload = {
        "prompt": prompt,
        "n_predict": 1,
        "temperature": 1.0,
        "top_k": 0,
        "top_p": 1.0,
        "n_probs": 32,
        "samplers": ["temperature"],
        "stop": ['"', "}", "\n"],
    }

    url = f"{settings.LOCAL_MODEL_BASE_URL.rstrip('/')}/completion"

    async with httpx.AsyncClient(timeout=settings.AI_MODEL_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        res_json = response.json()

    top_logprobs = res_json.get("completion_probabilities", [{}])[0].get("top_logprobs", [])
    cand_logprobs: Dict[int, float] = {}
    for i, sym in enumerate(symbols):
        found = None
        for item in top_logprobs:
            tok = item.get("token", "").strip().upper()
            if tok == sym:
                found = item.get("logprob")
                break
        cand_logprobs[i] = found if found is not None else -50.0

    max_lp = max(cand_logprobs.values())
    exp_vals = {k: math.exp(lp - max_lp) for k, lp in cand_logprobs.items()}
    sum_exp = sum(exp_vals.values()) or 1.0
    norm_probs = {k: round(v / sum_exp, 4) for k, v in exp_vals.items()}
    best_idx = max(norm_probs, key=norm_probs.get)

    selected_choice_name = CANDIDATE_CHOICES[best_idx][0]
    confidence = norm_probs[best_idx]

    # Map candidate choice into full ActionPlan
    deficit = float(data.get("hydrology_summary", {}).get("precomputed_deficit_mm", 0.0))
    crop_name = data.get("crop_context", {}).get("crop", "Crop")
    peak_temp = data.get("hazard_profile", {}).get("peak_temperature_c", 38.0)
    soil_type = data.get("hydrology_summary", {}).get("soil_type", "Soil")
    stage_name = data.get("crop_context", {}).get("growth_stage", "current stage")
    current_m = data.get("hydrology_summary", {}).get("current_moisture_pct", 15.0)

    if selected_choice_name == "PREEMPTIVE_NIGHT_PRECHARGE":
        status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        action = CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
        depth = deficit
        window = "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)"
        damage_reason = "irreversible pollen sterility" if ("Flowering" in stage_name or "Anthesis" in stage_name) else "acute thermal dehydration"
        rationale = (
            f"{crop_name} faces {damage_reason} if root-zone moisture drops "
            f"below critical holding thresholds at {peak_temp}°C. Deep night pre-charge establishes a transpirational cooling buffer."
        )
    elif selected_choice_name == "SPLIT_CYCLE_LIGHT_IRRIGATION":
        status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        action = CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION
        depth = round(deficit / 2.0, 1)
        window = "Pulsed cycle: 05:00 - 07:00 AM and 20:00 - 22:00 PKT daily"
        rationale = (
            f"Acute heat onset in under 24 hours on {soil_type} requires split drip pulsing to sustain "
            f"{crop_name} vascular turgor and micro-climate cooling without surface pooling."
        )
    elif selected_choice_name == "EMERGENCY_CANOPY_COOLING":
        status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        action = CandidateDecision.EMERGENCY_CANOPY_COOLING
        depth = min(deficit, 10.0)
        window = "Daytime misting bursts: 11:00 - 16:00 PKT"
        rationale = f"Direct canopy cooling active during {peak_temp}°C peak heat hazard."
    else:  # HOLD_CURRENT_LEVEL
        status = SufficiencyStatus.SUFFICIENT_NO_ACTION
        action = CandidateDecision.HOLD_CURRENT_LEVEL
        depth = 0.0
        window = "No action required during current forecast window"
        rationale = (
            f"Soil moisture in {soil_type} soil is adequate ({current_m}%). "
            f"Additional watering for {crop_name} risks root-zone oxygen starvation (hypoxia)."
        )

    depletion = data.get("hydrology_summary", {}).get("simulated_depletion", {})
    failure_day = depletion.get("projected_failure_day")
    projected_timestamp = f"Day {failure_day} at 14:00" if failure_day else None

    return DecisionOutput(
        engine_source="FAST_DECISION_LOGIT_ENGINE",
        sufficiency_status=status,
        selected_decision=action,
        decision_confidence=confidence,
        projected_depletion_timestamp=projected_timestamp,
        action_plan=ActionPlan(
            water_depth_mm=depth,
            execution_window=window,
            biological_rationale=rationale,
        ),
    )


async def query_openai_compatible_model(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Queries OpenAI-compatible chat completion endpoint with thinking disabled."""
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
        "max_tokens": 300,
        "chat_template_kwargs": {"enable_thinking": False},
        "enable_thinking": False,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=settings.AI_MODEL_TIMEOUT_SECONDS) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        raw_json = response.json()
        content = raw_json["choices"][0]["message"]["content"]

        parsed = json.loads(content)

        depletion = data.get("hydrology_summary", {}).get("simulated_depletion", {})
        failure_day = depletion.get("projected_failure_day")
        if "projected_depletion_timestamp" not in parsed or not parsed["projected_depletion_timestamp"]:
            parsed["projected_depletion_timestamp"] = f"Day {failure_day} at 14:00" if failure_day else None

        parsed["engine_source"] = "OPENAI_COMPATIBLE_ENGINE"
        return DecisionOutput.model_validate(parsed)


async def query_typesafe_decision_engine(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Queries TypeSafe AI System One API for cloud-native tactical arbitration."""
    if AsyncTypeSafeClient is None or Choice is None:
        raise RuntimeError("typesafe_sdk is not installed")

    api_key = settings.TYPESAFE_API_KEY
    if not api_key:
        raise ValueError("TYPESAFE_API_KEY is not configured")

    data = _normalize_state_dict(state)
    state_str = _format_state_summary(data)

    criteria_decisions = {name: desc for name, desc in CANDIDATE_CHOICES}
    criteria_status = {
        "SUFFICIENT_NO_ACTION": "Soil moisture buffer is sufficient; no irrigation required.",
        "MODERATE_DEFICIT": "Moderate deficit; light application needed.",
        "CRITICAL_HEAT_DEFICIT": "Critical heat deficit; urgent pre-charge or split application required.",
    }

    clean_base_url = settings.TYPESAFE_BASE_URL.rstrip("/").removesuffix("/v1")
    async with AsyncTypeSafeClient(
        api_key=api_key,
        base_url=clean_base_url,
        timeout=settings.TYPESAFE_TIMEOUT_SECONDS,
    ) as client:
        response = await client.system_one(
            state=state_str,
            model=settings.TYPESAFE_MODEL,
            questions={
                "selected_decision": Choice(
                    instructions="Which tactical irrigation directive must be executed?",
                    criteria=criteria_decisions,
                ),
                "sufficiency_status": Choice(
                    instructions="What is the water sufficiency status?",
                    criteria=criteria_status,
                ),
            },
        )

    ans_decision = response.answers["selected_decision"]
    selected_choice_name = ans_decision.choice
    confidence = (
        float(ans_decision.confidence)
        if getattr(ans_decision, "confidence", None) is not None
        else 0.95
    )

    ans_status = response.answers.get("sufficiency_status")
    status_choice_name = getattr(ans_status, "choice", None) if ans_status else None

    # Map candidate choice into full ActionPlan
    deficit = float(data.get("hydrology_summary", {}).get("precomputed_deficit_mm", 0.0))
    crop_name = data.get("crop_context", {}).get("crop", "Crop")
    peak_temp = data.get("hazard_profile", {}).get("peak_temperature_c", 38.0)
    soil_type = data.get("hydrology_summary", {}).get("soil_type", "Soil")
    stage_name = data.get("crop_context", {}).get("growth_stage", "current stage")
    current_m = data.get("hydrology_summary", {}).get("current_moisture_pct", 15.0)

    if selected_choice_name == "PREEMPTIVE_NIGHT_PRECHARGE":
        status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        action = CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
        depth = deficit
        window = "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)"
        damage_reason = (
            "irreversible pollen sterility"
            if ("Flowering" in stage_name or "Anthesis" in stage_name)
            else "acute thermal dehydration"
        )
        rationale = (
            f"{crop_name} faces {damage_reason} if root-zone moisture drops "
            f"below critical holding thresholds at {peak_temp}°C. Deep night pre-charge establishes a transpirational cooling buffer."
        )
    elif selected_choice_name == "SPLIT_CYCLE_LIGHT_IRRIGATION":
        status = (
            SufficiencyStatus[status_choice_name]
            if status_choice_name and status_choice_name in SufficiencyStatus.__members__
            else SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        )
        action = CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION
        depth = round(deficit / 2.0, 1)
        window = "Pulsed cycle: 05:00 - 07:00 AM and 20:00 - 22:00 PKT daily"
        rationale = (
            f"Acute heat onset in under 24 hours on {soil_type} requires split drip pulsing to sustain "
            f"{crop_name} vascular turgor and micro-climate cooling without surface pooling."
        )
    elif selected_choice_name == "EMERGENCY_CANOPY_COOLING":
        status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
        action = CandidateDecision.EMERGENCY_CANOPY_COOLING
        depth = min(deficit, 10.0)
        window = "Daytime misting bursts: 11:00 - 16:00 PKT"
        rationale = f"Direct canopy cooling active during {peak_temp}°C peak heat hazard."
    else:  # HOLD_CURRENT_LEVEL
        status = SufficiencyStatus.SUFFICIENT_NO_ACTION
        action = CandidateDecision.HOLD_CURRENT_LEVEL
        depth = 0.0
        window = "No action required during current forecast window"
        rationale = (
            f"Soil moisture in {soil_type} soil is adequate ({current_m}%). "
            f"Additional watering for {crop_name} risks root-zone oxygen starvation (hypoxia)."
        )

    depletion = data.get("hydrology_summary", {}).get("simulated_depletion", {})
    failure_day = depletion.get("projected_failure_day")
    projected_timestamp = f"Day {failure_day} at 14:00" if failure_day else None

    return DecisionOutput(
        engine_source="TYPESAFE_AI_ENGINE",
        sufficiency_status=status,
        selected_decision=action,
        decision_confidence=confidence,
        projected_depletion_timestamp=projected_timestamp,
        action_plan=ActionPlan(
            water_depth_mm=depth,
            execution_window=window,
            biological_rationale=rationale,
        ),
    )


async def evaluate_field_decision(
    state: Dict[str, Any] | AIDecisionInputPayload,
) -> DecisionOutput:
    """Coordinates AI model evaluation, latency measurement, guardrails, and deterministic fallback.

    Prioritizes TypeSafe AI cloud API, falls back to fast decision logit scoring / chat completions,
    and guarantees <1ms deterministic fallback recovery if offline.
    """
    start_time = time.perf_counter()
    data = _normalize_state_dict(state)

    decision: DecisionOutput | None = None
    source = "DETERMINISTIC_FALLBACK"

    # Step 1: Try TypeSafe Cloud API if enabled and API key is present
    if settings.USE_TYPESAFE_API and settings.TYPESAFE_API_KEY:
        try:
            decision = await query_typesafe_decision_engine(data)
            source = "TYPESAFE_AI_ENGINE"
        except Exception as e:
            logger.warning("TypeSafe API decision query failed, falling back: %s", e)
            decision = None

    # Step 2: Try Fast Decision Engine (local llama-server) if enabled and TypeSafe did not evaluate
    if decision is None and settings.USE_FAST_DECISION_ENGINE:
        try:
            decision = await query_fast_decision_engine(data)
            source = "FAST_DECISION_LOGIT_ENGINE"
        except Exception:
            decision = None

    # Step 3: Try Chat Completions if fast decision failed or disabled
    if decision is None:
        try:
            decision = await query_openai_compatible_model(data)
            source = "OPENAI_COMPATIBLE_ENGINE"
        except Exception:
            decision = None

    # Step 4: Instant deterministic fallback recovery
    if decision is None:
        decision = deterministic_fallback(data, reason="Model server offline or timed out")
        source = "DETERMINISTIC_FALLBACK"

    # Step 5: Enforce physical and agronomic guardrails
    decision = post_inference_guardrails(decision, data)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)
    decision.inference_latency_ms = elapsed_ms
    decision.engine_source = source

    return decision
