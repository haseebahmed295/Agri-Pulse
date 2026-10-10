"""Temporary API fixtures, not hydrology or agronomic recommendations."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from app.api.schemas import EvaluateRequest, EvaluateResponse, WeatherResponse

PKT = timezone(timedelta(hours=5))
FIXTURE = Path(__file__).parent / "fixtures" / "evaluation.json"


def weather_mock(latitude: float, longitude: float) -> WeatherResponse:
    start = datetime.now(PKT).replace(hour=0, minute=0, second=0, microsecond=0)
    # Reproducible synthetic days, with three consecutive hot days.
    peaks = [36.5, 41.5, 40.0, 38.0, 34.0, 33.5, 32.0]
    return WeatherResponse.model_validate({
        "location": {"latitude": latitude, "longitude": longitude, "timezone": "Asia/Karachi"},
        "hazard_summary": {
            "is_heatwave_active": True, "peak_temperature_c": 41.5,
            "baseline_seasonal_avg_c": 33.0, "heatwave_duration_days": 3,
            "days_until_peak": 1, "total_forecasted_rain_mm": 0.0,
        },
        "hourly_series": {
            "timestamps": [(start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(168)],
            "temperature_2m": [peaks[i // 24] for i in range(168)],
            "relative_humidity_2m": [58.0] * 168,
            "precipitation": [0.0] * 168,
        },
        "cache_status": "mock",
    })


def evaluate_mock(payload: EvaluateRequest) -> EvaluateResponse:
    """Validate all inputs at the route; return the fixed API crisis example.

    Intentionally does not pretend to compute results from arbitrary telemetry.
    Replace this provider when hydrology and decision services are implemented.
    """
    start = perf_counter()
    result = json.loads(FIXTURE.read_text(encoding="utf-8"))
    result.update(
        decision_id=str(uuid4()), timestamp=datetime.now(timezone.utc),
        engine_source="MOCK", inference_latency_ms=0.0,
    )
    result["action_plan"]["biological_rationale"] = (
        "Mock API example only: fixed Wheat crisis response. "
        "Submitted telemetry is validated but not evaluated yet."
    )
    today = datetime.now(PKT).date()
    for index, point in enumerate(result["chart_series"]):
        point["date"] = (today + timedelta(days=index)).strftime("%b %d")
    result["total_latency_ms"] = round((perf_counter() - start) * 1000, 3)
    return EvaluateResponse.model_validate(result)
