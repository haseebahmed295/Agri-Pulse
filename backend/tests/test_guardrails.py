"""Unit tests for Agri-Pulse Post-Inference Guardrails (Test AI-04).

Verifies physical invariant guardrails override faulty or hallucinated model outputs.
"""

from app.schemas import (
    ActionPlan,
    CandidateDecision,
    DecisionOutput,
    SufficiencyStatus,
)
from app.services.guardrails import post_inference_guardrails


def test_ai_04_fault_1_hold_with_positive_water_depth():
    """Fault 1: HOLD_CURRENT_LEVEL must strictly force water_depth_mm = 0.0."""
    faulty_decision = DecisionOutput(
        sufficiency_status=SufficiencyStatus.SUFFICIENT_NO_ACTION,
        selected_decision=CandidateDecision.HOLD_CURRENT_LEVEL,
        decision_confidence=0.95,
        action_plan=ActionPlan(
            water_depth_mm=20.0,  # Hallucinated depth on HOLD
            execution_window="None",
            biological_rationale="Adequate moisture buffer in heavy soil.",
        ),
    )

    corrected = post_inference_guardrails(faulty_decision)
    assert corrected.action_plan.water_depth_mm == 0.0


def test_ai_04_fault_2_daytime_window_on_preemptive_precharge():
    """Fault 2: PREEMPTIVE_NIGHT_PRECHARGE with daytime window must be corrected to night window."""
    faulty_decision = DecisionOutput(
        sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
        selected_decision=CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE,
        decision_confidence=0.92,
        action_plan=ActionPlan(
            water_depth_mm=25.0,
            execution_window="Today 14:00 - 17:00 PKT",  # Prohibited daytime heat window
            biological_rationale="Flowering wheat requires hydration before heatwave.",
        ),
    )

    corrected = post_inference_guardrails(faulty_decision)
    assert "22:30 - 04:30" in corrected.action_plan.execution_window
    assert "Night Only" in corrected.action_plan.execution_window


def test_ai_04_fault_3_water_depth_exceeds_hypoxia_cap():
    """Fault 3: Single-shot water depth > 45.0 mm must be clamped to 45.0 mm."""
    faulty_decision = DecisionOutput(
        sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
        selected_decision=CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE,
        decision_confidence=0.90,
        action_plan=ActionPlan(
            water_depth_mm=65.0,  # Exceeds 45mm soil hypoxia/ponding cap
            execution_window="Tonight 22:00 - 04:00 PKT",
            biological_rationale="Deep soil deficit refill.",
        ),
    )

    corrected = post_inference_guardrails(faulty_decision)
    assert corrected.action_plan.water_depth_mm == 45.0


def test_ai_04_valid_decision_left_intact():
    """Valid decisions should pass through guardrails without alteration."""
    valid_decision = DecisionOutput(
        sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
        selected_decision=CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE,
        decision_confidence=0.96,
        action_plan=ActionPlan(
            water_depth_mm=24.0,
            execution_window="Tonight 22:00 - 04:30 PKT",
            biological_rationale="Wheat in anthesis needs transpirational cooling buffer.",
        ),
    )

    checked = post_inference_guardrails(valid_decision)
    assert checked.action_plan.water_depth_mm == 24.0
    assert checked.action_plan.execution_window == "Tonight 22:00 - 04:30 PKT"
