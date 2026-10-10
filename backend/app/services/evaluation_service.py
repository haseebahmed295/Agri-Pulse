"""Live agronomic and hydrological evaluation service.

Connects incoming API EvaluateRequest to the AI Decision Engine, computes physical
hydrology parameters, projects 7-day moisture trajectories, and returns EvaluateResponse.
"""

from datetime import datetime, timedelta, timezone
from time import perf_counter
from uuid import UUID, uuid4

from app.api.schemas import (
    ActionPlan as ApiActionPlan,
    ChartPoint,
    EvaluateRequest,
    EvaluateResponse,
    HydrologySummary as ApiHydrologySummary,
)
from app.schemas import AIDecisionInputPayload, CropContext, HazardProfile, HydrologySummary, SimulatedDepletion
from app.services.decision_engine import evaluate_field_decision

PKT = timezone(timedelta(hours=5))

# Soil texture physical constants
SOIL_CONSTANTS = {
    "Sandy Loam": {"fc": 20.0, "pwp": 9.0},
    "Loam": {"fc": 27.0, "pwp": 12.0},
    "Clay": {"fc": 35.0, "pwp": 20.0},
}

# Crop root depths (cm) by growth stage
ROOT_DEPTH_LOOKUP = {
    ("Wheat", "Flowering_Anthesis"): 60.0,
    ("Wheat", "Grain_Fill"): 70.0,
    ("Wheat", "Vegetative"): 40.0,
    ("Wheat", "Maturity"): 80.0,
    ("Cotton", "Vegetative"): 80.0,
    ("Cotton", "Flowering_Anthesis"): 90.0,
    ("Tomato", "Grain_Fill"): 50.0,
    ("Tomato", "Flowering_Anthesis"): 45.0,
    ("Tomato", "Vegetative"): 35.0,
    ("Maize", "Flowering_Anthesis"): 75.0,
    ("Maize", "Vegetative"): 50.0,
}

# Crop thermal thresholds and vulnerabilities
CROP_HAZARDS = {
    "Wheat": {"threshold": 38.0, "vuln": "Pollen sterility and flower abortion"},
    "Cotton": {"threshold": 42.0, "vuln": "Vegetative wilting and square shedding"},
    "Tomato": {"threshold": 36.0, "vuln": "Blossom drop and fruit scald"},
    "Maize": {"threshold": 38.0, "vuln": "Silk drying and tassel blast"},
}


def _compute_hydrology(payload: EvaluateRequest) -> dict:
    soil = SOIL_CONSTANTS.get(payload.soil_texture, {"fc": 25.0, "pwp": 12.0})
    fc = soil["fc"]
    pwp = soil["pwp"]
    current = payload.current_moisture_pct

    root_depth_cm = ROOT_DEPTH_LOOKUP.get((payload.crop_type, payload.growth_stage), 60.0)
    root_depth_m = root_depth_cm / 100.0

    # Deficit to reach 90% of field capacity
    target_moisture = 0.90 * fc
    deficit_mm = max(0.0, (target_moisture - current) * root_depth_m * 10.0)

    # Determine wilting point crossing
    crosses_wp = current <= (pwp + 4.0)
    failure_day = 2 if crosses_wp else None

    return {
        "fc": fc,
        "pwp": pwp,
        "current": current,
        "deficit": round(deficit_mm, 1),
        "root_depth_cm": root_depth_cm,
        "crosses_wp": crosses_wp,
        "failure_day": failure_day,
    }


def _compute_hazard(payload: EvaluateRequest) -> dict:
    crop_info = CROP_HAZARDS.get(payload.crop_type, {"threshold": 38.0, "vuln": "Thermal stress"})
    thresh = crop_info["threshold"]

    # Base season peak afternoon temperature by crop (before heat spike)
    base_peaks = {
        "Wheat": 35.5,
        "Cotton": 33.5,
        "Tomato": 34.0,
        "Maize": 32.5,
    }
    base_peak = base_peaks.get(payload.crop_type, 34.0)

    spike = payload.simulated_heat_spike or 0.0
    if payload.peak_temperature_override is not None:
        peak_temp = payload.peak_temperature_override
    else:
        peak_temp = base_peak + spike

    is_heatwave = (spike > 0.0) or (peak_temp >= thresh) or (peak_temp >= 38.0)

    return {
        "is_heatwave": is_heatwave,
        "peak_temp": round(peak_temp, 1),
        "threshold": thresh,
        "vulnerability": crop_info["vuln"],
    }


def _generate_chart_series(
    payload: EvaluateRequest,
    hydrology: dict,
    hazard: dict,
    applied_water_mm: float,
) -> list[ChartPoint]:
    today = datetime.now(PKT).date()
    peak = hazard["peak_temp"]
    fc = hydrology["fc"]
    pwp = hydrology["pwp"]
    initial_m = hydrology["current"]

    # 7-day relative temperature offsets
    temp_curve = [
        round(peak - 4.5, 1),
        round(peak, 1),
        round(peak - 1.5, 1),
        round(peak - 3.5, 1),
        round(peak - 6.5, 1),
        round(peak - 7.0, 1),
        round(peak - 8.5, 1),
    ]

    chart: list[ChartPoint] = []
    base_m = initial_m
    # Protected moisture gains transpirational buffer from water application
    prot_m = initial_m + (applied_water_mm / (hydrology["root_depth_cm"] / 10.0)) if applied_water_mm > 0 else initial_m
    prot_m = min(prot_m, fc)

    for i in range(7):
        t = temp_curve[i]
        is_crit = t >= 38.0

        if i > 0:
            daily_loss = 4.5 if is_crit else 2.2
            base_m = max(5.0, round(base_m - daily_loss, 1))
            prot_loss = 3.2 if is_crit else 1.8
            safe_floor = pwp + 1.8 if (applied_water_mm > 0 or initial_m >= 0.85 * fc) else pwp + 0.5
            prot_m = max(safe_floor, round(prot_m - prot_loss, 1))

        chart.append(
            ChartPoint(
                day=i + 1,
                date=(today + timedelta(days=i)).strftime("%b %d"),
                forecast_temp_c=t,
                baseline_moisture_pct=round(base_m, 1),
                protected_moisture_pct=round(prot_m, 1),
                wilting_point_pct=pwp,
                field_capacity_pct=fc,
                is_critical_heat=is_crit,
            )
        )

    return chart


async def evaluate_live(payload: EvaluateRequest) -> EvaluateResponse:
    """Executes live evaluation by querying the AI decision engine with field telemetry."""
    start = perf_counter()

    hydrology = _compute_hydrology(payload)
    hazard = _compute_hazard(payload)

    # Build input payload for AI decision engine
    ai_input = AIDecisionInputPayload(
        crop_context=CropContext(
            crop=payload.crop_type,
            growth_stage=payload.growth_stage,
            thermal_threshold_c=hazard["threshold"],
            primary_heat_vulnerability=hazard["vulnerability"],
        ),
        hydrology_summary=HydrologySummary(
            soil_type=payload.soil_texture,
            current_moisture_pct=hydrology["current"],
            field_capacity_pct=hydrology["fc"],
            wilting_point_pct=hydrology["pwp"],
            precomputed_deficit_mm=hydrology["deficit"],
            simulated_depletion=SimulatedDepletion(
                crosses_wilting_point=hydrology["crosses_wp"],
                projected_failure_day=hydrology["failure_day"],
            ),
        ),
        hazard_profile=HazardProfile(
            is_heatwave_active=hazard["is_heatwave"],
            peak_temperature_c=hazard["peak_temp"],
            baseline_seasonal_avg_c=33.0,
            heatwave_duration_days=3,
            days_until_peak=2,
            total_forecasted_rain_mm=0.0,
        ),
        irrigation_system=payload.irrigation_system,
    )

    # Query the AI decision engine (Fast logit scoring on local model)
    decision = await evaluate_field_decision(ai_input)

    # Generate 7-day projection curves
    chart = _generate_chart_series(
        payload, hydrology, hazard, decision.action_plan.water_depth_mm
    )

    total_latency = round((perf_counter() - start) * 1000, 2)

    return EvaluateResponse(
        decision_id=UUID(decision.decision_id),
        timestamp=datetime.now(timezone.utc),
        engine_source=decision.engine_source,
        inference_latency_ms=decision.inference_latency_ms,
        total_latency_ms=total_latency,
        sufficiency_status=decision.sufficiency_status.value,
        selected_decision=decision.selected_decision.value,
        decision_confidence=round(decision.decision_confidence, 4),
        action_plan=ApiActionPlan(
            water_depth_mm=decision.action_plan.water_depth_mm,
            execution_window=decision.action_plan.execution_window,
            biological_rationale=decision.action_plan.biological_rationale,
        ),
        projected_depletion_timestamp=decision.projected_depletion_timestamp,
        hydrology_summary=ApiHydrologySummary(
            field_capacity_pct=hydrology["fc"],
            wilting_point_pct=hydrology["pwp"],
            current_moisture_pct=hydrology["current"],
            precomputed_deficit_mm=hydrology["deficit"],
            root_depth_cm=hydrology["root_depth_cm"],
        ),
        chart_series=chart,
    )
