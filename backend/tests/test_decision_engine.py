"""Unit and benchmark tests for Agri-Pulse Decision Engine (Tests AI-03, AI-05, AI-06).

Tests golden calibration scenarios, instant fallback recovery, and latency budgets.
"""

import time
import pytest
from unittest.mock import patch, AsyncMock
import httpx

from app.schemas import (
    CandidateDecision,
    DecisionOutput,
    SufficiencyStatus,
)
from app.services.decision_engine import (
    deterministic_fallback,
    evaluate_field_decision,
)

# Golden Test Scenarios
SCENARIO_1_WHEAT_CRISIS = {
    "crop_context": {
        "crop": "Wheat",
        "growth_stage": "Flowering / Anthesis",
        "thermal_threshold_c": 38.0,
        "primary_heat_vulnerability": "Pollen sterility and flower abortion",
    },
    "hydrology_summary": {
        "soil_type": "Sandy Loam",
        "current_moisture_pct": 14.0,
        "field_capacity_pct": 20.0,
        "wilting_point_pct": 9.0,
        "precomputed_deficit_mm": 24.0,
        "simulated_depletion": {
            "crosses_wilting_point": True,
            "projected_failure_day": 2,
            "hours_until_stress_onset": 38,
        },
    },
    "hazard_profile": {
        "is_heatwave_active": True,
        "peak_temperature_c": 41.5,
        "baseline_seasonal_avg_c": 33.0,
        "heatwave_duration_days": 3,
        "days_until_peak": 2,
        "total_forecasted_rain_mm": 0.0,
    },
    "irrigation_system": "Furrow_Flood",
    "candidate_decisions": [
        "HOLD_CURRENT_LEVEL",
        "PREEMPTIVE_NIGHT_PRECHARGE",
        "SPLIT_CYCLE_LIGHT_IRRIGATION",
        "EMERGENCY_CANOPY_COOLING",
    ],
}

SCENARIO_2_COTTON_TRAP = {
    "crop_context": {
        "crop": "Cotton",
        "growth_stage": "Vegetative",
        "thermal_threshold_c": 42.0,
        "primary_heat_vulnerability": "Vegetative wilting",
    },
    "hydrology_summary": {
        "soil_type": "Clay",
        "current_moisture_pct": 32.0,
        "field_capacity_pct": 35.0,
        "wilting_point_pct": 20.0,
        "precomputed_deficit_mm": 0.0,
        "simulated_depletion": {
            "crosses_wilting_point": False,
            "projected_failure_day": None,
        },
    },
    "hazard_profile": {
        "is_heatwave_active": True,
        "peak_temperature_c": 39.5,
        "baseline_seasonal_avg_c": 33.0,
        "heatwave_duration_days": 2,
        "days_until_peak": 1,
        "total_forecasted_rain_mm": 0.0,
    },
    "irrigation_system": "Drip",
    "candidate_decisions": [
        "HOLD_CURRENT_LEVEL",
        "PREEMPTIVE_NIGHT_PRECHARGE",
        "SPLIT_CYCLE_LIGHT_IRRIGATION",
        "EMERGENCY_CANOPY_COOLING",
    ],
}

SCENARIO_3_TOMATO_SCALD = {
    "crop_context": {
        "crop": "Tomato",
        "growth_stage": "Grain Fill / Fruit Set",
        "thermal_threshold_c": 36.0,
        "primary_heat_vulnerability": "Blossom drop and fruit scald",
    },
    "hydrology_summary": {
        "soil_type": "Loam",
        "current_moisture_pct": 13.0,
        "field_capacity_pct": 27.0,
        "wilting_point_pct": 12.0,
        "precomputed_deficit_mm": 28.0,
        "simulated_depletion": {
            "crosses_wilting_point": True,
            "projected_failure_day": 1,
        },
    },
    "hazard_profile": {
        "is_heatwave_active": True,
        "peak_temperature_c": 40.0,
        "baseline_seasonal_avg_c": 33.0,
        "heatwave_duration_days": 3,
        "days_until_peak": 1,
        "total_forecasted_rain_mm": 0.0,
    },
    "irrigation_system": "Drip",
    "candidate_decisions": [
        "HOLD_CURRENT_LEVEL",
        "PREEMPTIVE_NIGHT_PRECHARGE",
        "SPLIT_CYCLE_LIGHT_IRRIGATION",
        "EMERGENCY_CANOPY_COOLING",
    ],
}


def test_ai_03_golden_scenario_1_wheat_crisis():
    """Scenario 1: Wheat at flowering in 41.5C heatwave triggers PREEMPTIVE_NIGHT_PRECHARGE."""
    decision = deterministic_fallback(SCENARIO_1_WHEAT_CRISIS)
    assert decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
    assert decision.sufficiency_status == SufficiencyStatus.CRITICAL_HEAT_DEFICIT
    assert decision.action_plan.water_depth_mm == 24.0
    assert "Tonight 22:00" in decision.action_plan.execution_window
    assert "pollen sterility" in decision.action_plan.biological_rationale.lower()


def test_ai_03_golden_scenario_2_cotton_hypoxia_trap():
    """Scenario 2: Cotton in vegetative stage on moist clay triggers HOLD_CURRENT_LEVEL."""
    decision = deterministic_fallback(SCENARIO_2_COTTON_TRAP)
    assert decision.selected_decision == CandidateDecision.HOLD_CURRENT_LEVEL
    assert decision.sufficiency_status == SufficiencyStatus.SUFFICIENT_NO_ACTION
    assert decision.action_plan.water_depth_mm == 0.0
    assert "hypoxia" in decision.action_plan.biological_rationale.lower()


def test_ai_03_golden_scenario_3_tomato_scald_avoidance():
    """Scenario 3: Tomato at fruit set facing imminent heat triggers SPLIT_CYCLE_LIGHT_IRRIGATION."""
    decision = deterministic_fallback(SCENARIO_3_TOMATO_SCALD)
    assert decision.selected_decision == CandidateDecision.SPLIT_CYCLE_LIGHT_IRRIGATION
    assert decision.sufficiency_status == SufficiencyStatus.CRITICAL_HEAT_DEFICIT
    assert decision.action_plan.water_depth_mm == 14.0  # 28mm / 2
    assert "Pulsed" in decision.action_plan.execution_window
    assert "turgor" in decision.action_plan.biological_rationale.lower()


@pytest.mark.asyncio
async def test_ai_05_deterministic_fallback_on_unreachable_endpoint():
    """Test AI-05: evaluate_field_decision recovers gracefully when endpoint is unreachable."""
    start = time.perf_counter()
    decision = await evaluate_field_decision(SCENARIO_1_WHEAT_CRISIS)
    elapsed = (time.perf_counter() - start) * 1000

    assert isinstance(decision, DecisionOutput)
    assert decision.engine_source == "DETERMINISTIC_FALLBACK"
    assert decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
    assert decision.action_plan.water_depth_mm == 24.0
    # Fallback and socket error recovery execute in sub-second or near-timeout time
    assert elapsed < 1500.0


def test_ai_05_fallback_matrix_submillisecond_speed():
    """Test AI-05: Fallback function itself executes in under 1.0 ms."""
    times = []
    for _ in range(50):
        t0 = time.perf_counter()
        deterministic_fallback(SCENARIO_1_WHEAT_CRISIS)
        times.append((time.perf_counter() - t0) * 1000)

    avg_time = sum(times) / len(times)
    assert avg_time < 1.0, f"Average fallback execution time {avg_time:.3f} ms exceeded 1.0 ms"


@pytest.mark.asyncio
async def test_ai_02_mocked_openai_compatible_endpoint_success():
    """Test AI-02: Simulates a successful OpenAI-compatible model response."""
    mock_model_response = {
        "id": "chatcmpl-mock-123",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": (
                        '{"sufficiency_status": "CRITICAL_HEAT_DEFICIT", '
                        '"selected_decision": "PREEMPTIVE_NIGHT_PRECHARGE", '
                        '"decision_confidence": 0.97, '
                        '"action_plan": {'
                        '"water_depth_mm": 24.0, '
                        '"execution_window": "Tonight 22:00 - 04:30 PKT", '
                        '"biological_rationale": "Wheat in anthesis requires transpirational buffer to avoid sterility."}}'
                    ),
                },
            }
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json=mock_model_response,
        request=httpx.Request("POST", "http://localhost:8000/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        decision = await evaluate_field_decision(SCENARIO_1_WHEAT_CRISIS)
        assert decision.engine_source == "OPENAI_COMPATIBLE_ENGINE"
        assert decision.selected_decision == CandidateDecision.PREEMPTIVE_NIGHT_PRECHARGE
        assert decision.action_plan.water_depth_mm == 24.0
        assert decision.decision_confidence == 0.97
