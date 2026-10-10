"""Canonical API preset inputs; Fruit Set maps to the Grain_Fill wire enum."""

from app.api.schemas import EvaluateRequest, PresetResponse

PRESETS = {
    "crisis": PresetResponse(
        preset_id="crisis", label="Scenario A: Anthesis Thermal Crisis",
        payload=EvaluateRequest(
            crop_type="Wheat", growth_stage="Flowering_Anthesis",
            soil_texture="Sandy Loam", current_moisture_pct=14,
            irrigation_system="Furrow_Flood", simulated_heat_spike=6,
            peak_temperature_override=41.5,
        ),
    ),
    "trap": PresetResponse(
        preset_id="trap", label="Scenario B: Hypoxia Prevention Trap",
        payload=EvaluateRequest(
            crop_type="Cotton", growth_stage="Vegetative", soil_texture="Clay",
            current_moisture_pct=33, irrigation_system="Drip",
            peak_temperature_override=39.5,
        ),
    ),
    "scald": PresetResponse(
        preset_id="scald", label="Scenario C: Imminent Scald",
        payload=EvaluateRequest(
            crop_type="Tomato", growth_stage="Grain_Fill", soil_texture="Loam",
            current_moisture_pct=13, irrigation_system="Drip",
            peak_temperature_override=40,
        ),
    ),
}
