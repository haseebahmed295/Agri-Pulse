"""HTTP contracts from API_SPECIFICATION.md."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class Contract(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)


class EvaluateRequest(Contract):
    crop_type: Literal["Wheat", "Maize", "Cotton", "Tomato"]
    growth_stage: Literal["Vegetative", "Flowering_Anthesis", "Grain_Fill", "Maturity"]
    soil_texture: Literal["Sandy Loam", "Loam", "Clay"]
    current_moisture_pct: float = Field(ge=5, le=50)
    irrigation_system: Literal["Drip", "Center_Pivot", "Furrow_Flood"]
    simulated_heat_spike: float = 0.0
    peak_temperature_override: float | None = Field(default=None, ge=30, le=48)
    latitude: Latitude = 33.6844
    longitude: Longitude = 73.0479


class LocalModelHealth(Contract):
    provider: str
    base_url: str
    status: str


class WeatherHealth(Contract):
    provider: str
    status: str
    cached: bool


class HealthResponse(Contract):
    status: str
    version: str
    local_model_engine: LocalModelHealth
    weather_pipeline: WeatherHealth
    timestamp: datetime


class Location(Contract):
    latitude: Latitude
    longitude: Longitude
    timezone: str = "Asia/Karachi"


class HazardSummary(Contract):
    is_heatwave_active: bool
    peak_temperature_c: float
    baseline_seasonal_avg_c: float
    heatwave_duration_days: int = Field(ge=0)
    days_until_peak: int = Field(ge=0)
    total_forecasted_rain_mm: float = Field(ge=0)


class HourlySeries(Contract):
    timestamps: list[str] = Field(min_length=168, max_length=168)
    temperature_2m: list[float] = Field(min_length=168, max_length=168)
    relative_humidity_2m: list[float] = Field(min_length=168, max_length=168)
    precipitation: list[float] = Field(min_length=168, max_length=168)


class WeatherResponse(Contract):
    location: Location
    hazard_summary: HazardSummary
    hourly_series: HourlySeries
    cache_status: str


class ActionPlan(Contract):
    water_depth_mm: float = Field(ge=0)
    execution_window: str
    biological_rationale: str


class HydrologySummary(Contract):
    field_capacity_pct: float
    wilting_point_pct: float
    current_moisture_pct: float
    precomputed_deficit_mm: float = Field(ge=0)
    root_depth_cm: float = Field(gt=0)


class ChartPoint(Contract):
    day: int = Field(ge=1, le=7)
    date: str
    forecast_temp_c: float
    baseline_moisture_pct: float
    protected_moisture_pct: float
    wilting_point_pct: float
    field_capacity_pct: float
    is_critical_heat: bool


class EvaluateResponse(Contract):
    decision_id: UUID
    timestamp: datetime
    engine_source: str
    inference_latency_ms: float = Field(ge=0)
    total_latency_ms: float = Field(ge=0)
    sufficiency_status: Literal["SUFFICIENT_NO_ACTION", "MODERATE_DEFICIT", "CRITICAL_HEAT_DEFICIT"]
    selected_decision: Literal[
        "HOLD_CURRENT_LEVEL", "PREEMPTIVE_NIGHT_PRECHARGE",
        "SPLIT_CYCLE_LIGHT_IRRIGATION", "EMERGENCY_CANOPY_COOLING",
    ]
    decision_confidence: float = Field(ge=0, le=1)
    action_plan: ActionPlan
    projected_depletion_timestamp: str | None
    hydrology_summary: HydrologySummary
    chart_series: list[ChartPoint] = Field(min_length=7, max_length=7)


class PresetResponse(Contract):
    preset_id: Literal["crisis", "trap", "scald"]
    label: str
    payload: EvaluateRequest
