"""Pydantic schemas and data contracts for Agri-Pulse Decision Engine."""

from enum import Enum
from typing import List, Optional
import uuid
from pydantic import BaseModel, Field, ConfigDict


class SufficiencyStatus(str, Enum):
    """Water status classification enum."""
    SUFFICIENT_NO_ACTION = "SUFFICIENT_NO_ACTION"
    MODERATE_DEFICIT = "MODERATE_DEFICIT"
    CRITICAL_HEAT_DEFICIT = "CRITICAL_HEAT_DEFICIT"


class CandidateDecision(str, Enum):
    """Tactical irrigation candidate decisions."""
    HOLD_CURRENT_LEVEL = "HOLD_CURRENT_LEVEL"
    PREEMPTIVE_NIGHT_PRECHARGE = "PREEMPTIVE_NIGHT_PRECHARGE"
    SPLIT_CYCLE_LIGHT_IRRIGATION = "SPLIT_CYCLE_LIGHT_IRRIGATION"
    EMERGENCY_CANOPY_COOLING = "EMERGENCY_CANOPY_COOLING"


# --- Input Contract Models (contracts/mock_weather_hydrology.json) ---

class CropContext(BaseModel):
    """Crop profile and physiological vulnerability."""
    model_config = ConfigDict(extra="ignore")

    crop: str = Field(..., description="Crop name e.g., Wheat, Maize, Cotton, Tomato")
    growth_stage: str = Field(..., description="Phenological growth stage")
    thermal_threshold_c: float = Field(..., description="Thermal damage threshold in Celsius")
    primary_heat_vulnerability: str = Field(..., description="Physiological damage description")


class SimulatedDepletion(BaseModel):
    """Depletion model projection summary."""
    model_config = ConfigDict(extra="ignore")

    crosses_wilting_point: bool = Field(..., description="True if moisture breaches wilting point")
    projected_failure_day: Optional[int] = Field(None, description="Day index of wilting point crossing")
    hours_until_stress_onset: Optional[int] = Field(None, description="Hours until critical stress onset")


class HydrologySummary(BaseModel):
    """Pre-computed soil hydrology metrics."""
    model_config = ConfigDict(extra="ignore")

    soil_type: str = Field(..., description="Soil texture class e.g., Sandy Loam, Loam, Clay")
    current_moisture_pct: float = Field(..., ge=0.0, le=100.0, description="Volumetric water content percentage")
    field_capacity_pct: float = Field(..., ge=0.0, le=100.0, description="Field capacity percentage")
    wilting_point_pct: float = Field(..., ge=0.0, le=100.0, description="Permanent wilting point percentage")
    precomputed_deficit_mm: float = Field(..., ge=0.0, description="Precomputed irrigation deficit in mm")
    simulated_depletion: SimulatedDepletion = Field(..., description="Depletion trajectory projection")


class HazardProfile(BaseModel):
    """Meteorological hazard and heatwave profile."""
    model_config = ConfigDict(extra="ignore")

    is_heatwave_active: bool = Field(..., description="Flag indicating active or forecasted heatwave")
    peak_temperature_c: float = Field(..., description="Peak forecasted temperature in Celsius")
    baseline_seasonal_avg_c: float = Field(default=33.0, description="Seasonal average temperature")
    heatwave_duration_days: int = Field(..., ge=0, description="Duration of heat event in days")
    days_until_peak: int = Field(..., description="Days until peak thermal spike")
    total_forecasted_rain_mm: float = Field(default=0.0, ge=0.0, description="Total rain forecast mm")


class AIDecisionInputPayload(BaseModel):
    """Full normalized payload sent into the AI decision module."""
    model_config = ConfigDict(extra="ignore")

    crop_context: CropContext
    hydrology_summary: HydrologySummary
    hazard_profile: HazardProfile
    irrigation_system: str = Field(default="Drip", description="Irrigation system hardware type")
    candidate_decisions: List[str] = Field(
        default=[
            "HOLD_CURRENT_LEVEL",
            "PREEMPTIVE_NIGHT_PRECHARGE",
            "SPLIT_CYCLE_LIGHT_IRRIGATION",
            "EMERGENCY_CANOPY_COOLING",
        ],
        description="Candidate tactical decisions available",
    )


# --- Output Contract Models (contracts/mock_decision_response.json) ---

class ActionPlan(BaseModel):
    """Operational execution plan details."""
    model_config = ConfigDict(extra="ignore")

    water_depth_mm: float = Field(
        ...,
        ge=0.0,
        description="Application depth in mm calculated by hydrology engine.",
    )
    execution_window: str = Field(
        ...,
        description="Actionable hours (must avoid peak daytime heat 10:00 - 18:00).",
    )
    biological_rationale: str = Field(
        ...,
        max_length=220,
        description="Physiological impact rationale.",
    )


class DecisionOutput(BaseModel):
    """Final dispatch emission matching mock_decision_response.json."""
    model_config = ConfigDict(extra="ignore")

    decision_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for the decision record",
    )
    inference_latency_ms: float = Field(
        default=0.0,
        ge=0.0,
        description="Latency in milliseconds for evaluation",
    )
    engine_source: str = Field(
        default="OPENAI_COMPATIBLE_ENGINE",
        description="Originating engine (OPENAI_COMPATIBLE_ENGINE, DETERMINISTIC_FALLBACK)",
    )
    sufficiency_status: SufficiencyStatus = Field(
        ...,
        description="Sufficiency status classification",
    )
    selected_decision: CandidateDecision = Field(
        ...,
        description="Selected tactical action enum",
    )
    decision_confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0",
    )
    projected_depletion_timestamp: Optional[str] = Field(
        default=None,
        description="Timestamp or relative day when soil breaches wilting threshold",
    )
    action_plan: ActionPlan = Field(
        ...,
        description="Concrete application schedule and biological rationale",
    )
