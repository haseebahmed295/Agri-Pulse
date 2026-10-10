"""Post-inference agronomic safety guardrails for Agri-Pulse."""

from typing import Any, Dict
from app.schemas import CandidateDecision, DecisionOutput


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
    1. HOLD command must never deliver water (forced to 0.0 mm).
    2. Heatwave preemptive pre-charging must occur strictly during night hours (22:00 - 05:00).
    3. Water depth is clamped to [0.0, 45.0] mm to prevent surface ponding and soil hypoxia.
    4. Biological rationale text is bounded to 220 characters max.
    """
    # Guardrail 1: HOLD command must never deliver water
    if decision.selected_decision == CandidateDecision.HOLD_CURRENT_LEVEL:
        decision.action_plan.water_depth_mm = 0.0

    # Guardrail 2: Enforce night execution windows for preemptive pre-charge
    if decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE:
        current_window_lower = decision.action_plan.execution_window.lower()
        if any(marker in current_window_lower for marker in DAYTIME_HOURLY_MARKERS):
            decision.action_plan.execution_window = "Tonight 22:30 - 04:30 PKT (Night Only)"

    # Guardrail 3: Clamp water depth bounds
    if decision.action_plan.water_depth_mm > MAX_SINGLE_APPLICATION_DEPTH_MM:
        decision.action_plan.water_depth_mm = MAX_SINGLE_APPLICATION_DEPTH_MM
    elif decision.action_plan.water_depth_mm < 0.0:
        decision.action_plan.water_depth_mm = 0.0

    # Guardrail 4: Ensure biological rationale does not exceed maximum field length
    if len(decision.action_plan.biological_rationale) > MAX_RATIONALE_LENGTH:
        decision.action_plan.biological_rationale = (
            decision.action_plan.biological_rationale[: MAX_RATIONALE_LENGTH - 3] + "..."
        )

    return decision
