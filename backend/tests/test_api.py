import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def crisis():
    return client.get("/api/presets/crisis").json()["payload"]


def test_health_reports_service_status():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] in ("ok", "degraded")
    assert response.json()["local_model_engine"]["status"] in ("online", "offline", "not_configured")


def test_weather_has_168_aligned_hours_and_coordinates():
    response = client.get("/api/weather", params={"latitude": 31.5, "longitude": 74.3})
    assert response.status_code == 200
    data = response.json()
    assert data["location"]["latitude"] == 31.5
    assert data["location"]["longitude"] == 74.3
    assert all(len(series) == 168 for series in data["hourly_series"].values())
    assert len(set(data["hourly_series"]["timestamps"])) == 168
    assert data["cache_status"] in ("live", "cached", "fallback", "mock")


@pytest.mark.parametrize("name,crop,moisture", [
    ("crisis", "Wheat", 14), ("trap", "Cotton", 33), ("scald", "Tomato", 13),
])
def test_presets_are_valid_evaluation_inputs(name, crop, moisture):
    response = client.get(f"/api/presets/{name}")
    assert response.status_code == 200
    payload = response.json()["payload"]
    assert payload["crop_type"] == crop
    assert payload["current_moisture_pct"] == moisture
    assert client.post("/api/evaluate", json=payload).status_code == 200


def test_evaluation_mock_mode_explicit():
    response = client.post("/api/evaluate", json=crisis(), params={"mode": "mock"})
    assert response.status_code == 200
    data = response.json()
    assert response.headers["X-AgriPulse-Mode"] == "mock"
    assert data["engine_source"] == "MOCK"
    assert len(data["chart_series"]) == 7
    assert data["hydrology_summary"]["precomputed_deficit_mm"] == 24
    assert data["action_plan"]["water_depth_mm"] == 24
    assert data["timestamp"]


def test_evaluation_live_model_engine():
    response = client.post("/api/evaluate", json=crisis())
    assert response.status_code == 200
    data = response.json()
    assert data["engine_source"] in (
        "FAST_DECISION_LOGIT_ENGINE",
        "LOCAL_MODEL_ENGINE",
        "TYPESAFE_AI_ENGINE",
        "DETERMINISTIC_FALLBACK",
    )
    assert data["selected_decision"] == "PREEMPTIVE_NIGHT_PRECHARGE"
    assert data["sufficiency_status"] == "CRITICAL_HEAT_DEFICIT"
    assert data["action_plan"]["water_depth_mm"] == 24.0
    assert len(data["chart_series"]) == 7
    assert data["decision_id"] != client.post("/api/evaluate", json=crisis()).json()["decision_id"]


@pytest.mark.parametrize("field,value", [
    ("crop_type", "Rice"), ("growth_stage", "Fruit Set"),
    ("soil_texture", "Sand"), ("irrigation_system", "Unknown"),
    ("current_moisture_pct", 4.9), ("current_moisture_pct", 50.1),
    ("peak_temperature_override", 29.9), ("peak_temperature_override", 48.1),
    ("latitude", 91), ("longitude", -181),
])
def test_invalid_payload_returns_422(field, value):
    payload = crisis()
    payload[field] = value
    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]


def test_missing_fields_and_invalid_coordinates():
    assert client.post("/api/evaluate", json={}).status_code == 422
    assert client.get("/api/weather?latitude=91").status_code == 422
    assert client.get("/api/presets/unknown").status_code == 404


@pytest.mark.parametrize("moisture", [5, 50])
def test_inclusive_moisture_bounds(moisture):
    payload = crisis()
    payload["current_moisture_pct"] = moisture
    assert client.post("/api/evaluate", json=payload).status_code == 200


def test_cors_preflight_and_response():
    headers = {"Origin": "http://localhost:5173"}
    response = client.options("/api/evaluate", headers={
        **headers, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "POST" in response.headers["access-control-allow-methods"]
    response = client.post("/api/evaluate", json=crisis(), headers=headers)
    assert response.headers["access-control-allow-origin"] == "*"


def test_openapi_publishes_all_routes():
    paths = client.get("/openapi.json").json()["paths"]
    assert set(paths) == {"/api/health", "/api/weather", "/api/evaluate", "/api/presets/{preset_id}"}
