"""Post-inference agronomic safety guardrails for Agri-Pulse."""

from typing import Any, Dict
from app.schemas import CandidateDecision, DecisionOutput, SufficiencyStatus


DAYTIME_HOURLY_MARKERS = [
    "10:", "11:", "12:", "13:", "14:", "15:", "16:", "17:", "18:",
    "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm",
    "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm",
]

MAX_SINGLE_APPLICATION_DEPTH_MM = 45.0
MAX_RATIONALE_LENGTH = 220


def post_inference_guardrails(
    decision: DecisionOutput,
    state: Dict[str, Any] | None = None,
) -> DecisionOutput:
    """Enforces strict physical boundaries on model outputs before dispatch emission.

    Rules enforced:
    1. Zero deficit / safe buffer MUST NOT irrigate: forced to HOLD_CURRENT_LEVEL & SUFFICIENT_NO_ACTION.
    2. HOLD command must never deliver water (forced to 0.0 mm).
    3. Active deficit under stress must prescribe active irrigation with non-zero water depth.
    4. Heatwave preemptive pre-charging must occur strictly during night hours (22:00 - 05:00).
    5. Water depth is clamped to [0.0, 45.0] mm to prevent surface ponding and soil hypoxia.
    6. Biological rationale text is bounded to 220 characters max.
    """
    if state:
        hydrology = state.get("hydrology_summary", {})
        hazard = state.get("hazard_profile", {})
        crop = state.get("crop_context", {})

        deficit = float(hydrology.get("precomputed_deficit_mm", 0.0))
        current_m = float(hydrology.get("current_moisture_pct", 0.0))
        fc = float(hydrology.get("field_capacity_pct", 25.0))
        pwp = float(hydrology.get("wilting_point_pct", 12.0))
        soil_type = hydrology.get("soil_type", "Soil")
        crop_name = crop.get("crop", "Crop")
        stage_name = crop.get("growth_stage", "current stage")
        peak_temp = float(hazard.get("peak_temperature_c", 35.0))
        is_heatwave = bool(hazard.get("is_heatwave_active", False))
        target_m = 0.88 * fc

        # Rule 1: Zero deficit / optimal buffer -> HOLD and SUFFICIENT
        if deficit <= 0.0 or current_m >= target_m:
            decision.selected_decision = CandidateDecision.HOLD_CURRENT_LEVEL
            decision.sufficiency_status = SufficiencyStatus.SUFFICIENT_NO_ACTION
            decision.action_plan.water_depth_mm = 0.0
            decision.action_plan.execution_window = "No action required during current forecast window"
            decision.action_plan.biological_rationale = (
                f"Soil moisture in {soil_type} is optimal ({current_m:.1f}%). "
                f"Transpirational cooling buffer is already adequate; additional watering for {crop_name} risks root hypoxia."
            )
            decision.projected_depletion_timestamp = None
            decision.decision_confidence = max(decision.decision_confidence, 0.95)
            return decision

        # Rule 2: Active deficit -> Ensure action matches physical stress
        if decision.selected_decision == CandidateDecision.HOLD_CURRENT_LEVEL:
            if is_heatwave and ("Flowering" in stage_name or "Anthesis" in stage_name):
                decision.selected_decision = CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
                decision.sufficiency_status = SufficiencyStatus.CRITICAL_HEAT_DEFICIT
                decision.action_plan.water_depth_mm = min(deficit, MAX_SINGLE_APPLICATION_DEPTH_MM)
                decision.action_plan.execution_window = "Tonight 22:00 - 04:30 PKT (Prior to Heat Day 1)"
                decision.action_plan.biological_rationale = (
                    f"{crop_name} in anthesis faces thermal damage at {peak_temp:.1f}°C. "
                    f"Pre-charge required to restore depleted moisture buffer ({current_m:.1f}%)."
                )
            else:
                decision.selected_decision = CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION
                decision.sufficiency_status = (
                    SufficiencyStatus.CRITICAL_HEAT_DEFICIT if is_heatwave else SufficiencyStatus.MODERATE_DEFICIT
                )
                decision.action_plan.water_depth_mm = min(max(round(deficit / 2.0, 1), 6.0), MAX_SINGLE_APPLICATION_DEPTH_MM)
                decision.action_plan.execution_window = "Pulsed cycle: 05:00 - 07:00 AM and 20:00 - 22:00 PKT daily"
                decision.action_plan.biological_rationale = (
                    f"Root zone depleted ({current_m:.1f}%). Replenishment required for {crop_name}."
                )

        if decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE:
            if decision.action_plan.water_depth_mm <= 0.0:
                decision.action_plan.water_depth_mm = min(deficit, MAX_SINGLE_APPLICATION_DEPTH_MM)
            if not is_heatwave:
                decision.sufficiency_status = SufficiencyStatus.MODERATE_DEFICIT

        elif decision.selected_decision == CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION:
            if decision.action_plan.water_depth_mm <= 0.0:
                decision.action_plan.water_depth_mm = min(max(round(deficit / 2.0, 1), 6.0), MAX_SINGLE_APPLICATION_DEPTH_MM)
            if not is_heatwave:
                decision.sufficiency_status = SufficiencyStatus.MODERATE_DEFICIT

    # Guardrail: HOLD command must never deliver water
    if decision.selected_decision == CandidateDecision.HOLD_CURRENT_LEVEL:
        decision.action_plan.water_depth_mm = 0.0

    # Guardrail: Enforce night execution windows for preemptive pre-charge
    if decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE:
        current_window_lower = decision.action_plan.execution_window.lower()
        if any(marker in current_window_lower for marker in DAYTIME_HOURLY_MARKERS) or "no " in current_window_lower:
            decision.action_plan.execution_window = "Tonight 22:30 - 04:30 PKT (Night Only)"

    # Guardrail: Clamp water depth bounds
    if decision.action_plan.water_depth_mm > MAX_SINGLE_APPLICATION_DEPTH_MM:
        decision.action_plan.water_depth_mm = MAX_SINGLE_APPLICATION_DEPTH_MM
    elif decision.action_plan.water_depth_mm < 0.0:
        decision.action_plan.water_depth_mm = 0.0

    # Guardrail: Ensure biological rationale does not exceed maximum field length
    if len(decision.action_plan.biological_rationale) > MAX_RATIONALE_LENGTH:
        decision.action_plan.biological_rationale = (
            decision.action_plan.biological_rationale[: MAX_RATIONALE_LENGTH - 3] + "..."
        )

    return decision
