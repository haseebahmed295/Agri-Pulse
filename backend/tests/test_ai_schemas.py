"""Unit tests for Agri-Pulse Pydantic Schemas (Test AI-01).

Validates schema constraints, boundary enforcement, and parity with shared contract JSON files.
"""

import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.schemas import (
    ActionPlan,
    AIDecisionInputPayload,
    CandidateDecision,
    DecisionOutput,
    SufficiencyStatus,
)

CONTRACTS_DIR = Path(__file__).resolve().parent.parent.parent / "contracts"


def test_ai_01_parse_mock_weather_hydrology_contract():
    """Verify contracts/mock_weather_hydrology.json parses validly into AIDecisionInputPayload."""
    contract_path = CONTRACTS_DIR / "mock_weather_hydrology.json"
    assert contract_path.exists(), f"Contract file missing at {contract_path}"

    with open(contract_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    payload = AIDecisionInputPayload.model_validate(data)
    assert payload.crop_context.crop == "Wheat"
    assert payload.crop_context.growth_stage == "Flowering / Anthesis"
    assert payload.hydrology_summary.soil_type == "Sandy Loam"
    assert payload.hydrology_summary.current_moisture_pct == 14.0
    assert payload.hydrology_summary.precomputed_deficit_mm == 24.0
    assert payload.hazard_profile.is_heatwave_active is True
    assert payload.hazard_profile.peak_temperature_c == 41.5


def test_ai_01_parse_mock_decision_response_contract():
    """Verify contracts/mock_decision_response.json parses validly into DecisionOutput."""
    contract_path = CONTRACTS_DIR / "mock_decision_response.json"
    assert contract_path.exists(), f"Contract file missing at {contract_path}"

    with open(contract_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    decision = DecisionOutput.model_validate(data)
    assert decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
    assert decision.sufficiency_status == SufficiencyStatus.CRITICAL_HEAT_DEFICIT
    assert decision.decision_confidence == 0.96
    assert decision.action_plan.water_depth_mm == 24.0
    assert "Wheat in anthesis" in decision.action_plan.biological_rationale


def test_ai_01_reject_invalid_candidate_decision():
    """Verify invalid action enums raise ValidationError."""
    with pytest.raises(ValidationError):
        DecisionOutput(
            sufficiency_status=SufficiencyStatus.CRITICAL_HEAT_DEFICIT,
            selected_decision="WATER_NOW",  # Invalid enum
            decision_confidence=0.95,
            action_plan=ActionPlan(
                water_depth_mm=20.0,
                execution_window="Tonight 22:00 - 04:00",
                biological_rationale="Test rationale",
            ),
        )


def test_ai_01_reject_out_of_bounds_confidence():
    """Verify confidence values outside [0.0, 1.0] raise ValidationError."""
    # Greater than 1.0
    with pytest.raises(ValidationError):
        DecisionOutput(
            sufficiency_status=SufficiencyStatus.SUFFICIENT_NO_ACTION,
            selected_decision=CandidateDecision.HOLD_CURRENT_LEVEL,
            decision_confidence=1.25,
            action_plan=ActionPlan(
                water_depth_mm=0.0,
                execution_window="None",
                biological_rationale="Test rationale",
            ),
        )

    # Less than 0.0
    with pytest.raises(ValidationError):
        DecisionOutput(
            sufficiency_status=SufficiencyStatus.SUFFICIENT_NO_ACTION,
            selected_decision=CandidateDecision.HOLD_CURRENT_LEVEL,
            decision_confidence=-0.1,
            action_plan=ActionPlan(
                water_depth_mm=0.0,
                execution_window="None",
                biological_rationale="Test rationale",
            ),
        )


def test_ai_01_reject_negative_water_depth():
    """Verify negative water depth raises ValidationError."""
    with pytest.raises(ValidationError):
        ActionPlan(
            water_depth_mm=-5.0,
            execution_window="Tonight 22:00 - 04:00",
            biological_rationale="Negative water test",
        )


def test_ai_01_reject_excessive_rationale_length():
    """Verify rationale exceeding 220 characters raises ValidationError in ActionPlan."""
    with pytest.raises(ValidationError):
        ActionPlan(
            water_depth_mm=10.0,
            execution_window="Tonight 22:00 - 04:00",
            biological_rationale="X" * 221,
        )
