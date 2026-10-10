# Person 2: Backend & Hydrology Physics Engineer — Task & Test Plan

**Role:** Backend Infrastructure & Hydrology Physics Specialist  
**Workspace Ownership:**  
* `backend/app/main.py`  
* `backend/app/api/routes.py`  
* `backend/app/services/weather_service.py`  
* `backend/app/services/hydrology_service.py`  
**Shared Contract Emitted:** `contracts/mock_weather_hydrology.json`  
**Target Delivery:** FastAPI server, Open-Meteo async client, and deterministic FAO-56 hydrological calculation engine  

---

## 1. Input & Output Requirements

### Input Requirements (Consumed Interfaces)
* Open-Meteo public REST API query:
  * Latitude & Longitude (e.g., Islamabad / Rawalpindi: `33.6844, 73.0479`)
  * Parameters: `hourly=temperature_2m,relative_humidity_2m,precipitation`
* Field telemetry payload from frontend:
  * Crop (`Wheat`, `Maize`, `Cotton`, `Tomato`)
  * Growth stage (`Vegetative`, `Flowering_Anthesis`, `Grain_Fill`, `Maturity`)
  * Soil texture (`Sandy Loam`, `Loam`, `Clay`)
  * Current moisture percentage (e.g., `14.0%`)

### Output Requirements (Delivered Artifacts)
1. **Weather Service (`GET /api/weather`):** Returns 168-hour structured vectors for temperature, relative humidity, and precipitation.
2. **Hydraulic Constants Tables:**
   * Sandy Loam: $\theta_{\text{FC}} = 20.0\%$, $\theta_{\text{PWP}} = 9.0\%$
   * Loam: $\theta_{\text{FC}} = 27.0\%$, $\theta_{\text{PWP}} = 12.0\%$
   * Clay: $\theta_{\text{FC}} = 35.0\%$, $\theta_{\text{PWP}} = 20.0\%$
3. **Pre-computed State Object (`mock_weather_hydrology.json` structure):**
   * Precomputed deficit in millimeters: $\text{Deficit} = \max(0.0, (0.90 \cdot \theta_{\text{FC}} - \theta_{\text{current}}) \cdot Z_{\text{r}} \cdot 10)$
   * 7-day projected unmitigated soil moisture array $\theta(t)$
   * Heatwave flag (`true` if $T_{\text{max}} \ge 38.0^\circ\text{C}$ for $\ge 2$ consecutive days)
   * Projected failure day and hour (when $\theta(t) \le \theta_{\text{PWP}} + 3\%$)
4. **CORS Middleware:** Permissive CORS enabled for `http://localhost:5173`.

---

## 2. Test Plan & Verification Matrix

### Test BE-01: Open-Meteo Keyless API Ingestion
* **Objective:** Verify asynchronous retrieval of 168-hour weather forecast without authentication barriers.
* **Input:** Coordinates `latitude=33.6844, longitude=73.0479`.
* **Test Method:** Execute async unit test in `pytest` calling `fetch_7day_forecast()`.
* **Pass Criteria:**
  * Returns HTTP status 200.
  * Vectors `temperature_2m`, `relative_humidity_2m`, `precipitation` each contain exactly 168 entries.
  * Handles offline timeout gracefully with cached seasonal default fallback.

### Test BE-02: Hargreaves $\text{ET}_0$ & $\text{ET}_{\text{c}}$ Math Accuracy
* **Objective:** Validate calculation of reference evapotranspiration against known FAO-56 standards.
* **Input:** $T_{\text{max}} = 41.5^\circ\text{C}$, $T_{\text{min}} = 26.0^\circ\text{C}$, Extraterrestrial radiation $R_{\text{a}} = 16.2\text{ mm/day}$, $K_{\text{c}} = 1.15$.
* **Test Method:** Run unit test on `calculate_hargreaves_et0()` and `calculate_crop_etc()`.
* **Pass Criteria:**
  * $\text{ET}_0$ calculation matches formula within $\pm 0.05\text{ mm/day}$.
  * $\text{ET}_{\text{c}}$ correctly scales with $K_{\text{c}}$ ($>8.5\text{ mm/day}$ during heatwave conditions).
  * Compute execution time $\le 0.5\text{ ms}$.

### Test BE-03: Soil Constants & Root Depth Mapping
* **Objective:** Ensure physical lookups map correctly for all supported combinations.
* **Input:** Loop through all 4 crops across all 4 stages in Sandy Loam, Loam, and Clay.
* **Test Method:** Run parameterized unit test in `pytest`.
* **Pass Criteria:**
  * Sandy Loam maps to $\theta_{\text{FC}}=20.0\%$, $\theta_{\text{PWP}}=9.0\%$.
  * Clay maps to $\theta_{\text{FC}}=35.0\%$, $\theta_{\text{PWP}}=20.0\%$.
  * Wheat at Flowering maps root depth $Z_{\text{r}} = 0.60\text{ m}$.
  * Zero lookup key errors or undefined return values.

### Test BE-04: Daily Depletion Curve & Failure Day Flagging
* **Objective:** Verify root-zone water balance accurately detectswilting point breach.
* **Input:** Sandy Loam ($\theta_{\text{PWP}} = 9.0\%$), initial moisture = $14.0\%$, 3-day heatwave ($41.5^\circ\text{C}$), rain = $0\text{ mm}$.
* **Test Method:** Call `project_7day_depletion()`.
* **Pass Criteria:**
  * Daily moisture monotonically decreases across Days 1 to 3.
  * Identifies wilting breach on Day 2 ($t=2$).
  * Returns `crosses_wilting_point: true` and `projected_failure_day: 2`.

### Test BE-05: Deficit Calculation Precision & Clamping
* **Objective:** Verify net irrigation deficit calculation guarantees safe refill to 90% Field Capacity.
* **Input Case A:** Sandy Loam ($\theta_{\text{FC}}=20\%$), current moisture = $14.0\%$, $Z_{\text{r}} = 0.60\text{ m}$.
* **Input Case B:** Clay ($\theta_{\text{FC}}=35\%$), current moisture = $33.0\%$, $Z_{\text{r}} = 0.80\text{ m}$.
* **Test Method:** Call `compute_net_deficit_mm()`.
* **Pass Criteria:**
  * Case A: Target moisture = $18.0\%$; deficit = $(18.0 - 14.0) \times 0.60 \times 10 = 24.0\text{ mm}$.
  * Case B: Target moisture = $31.5\%$; since current ($33\%$) > target, deficit clamps strictly to $0.0\text{ mm}$ (no negative depth).

### Test BE-06: Endpoint Latency & CORS Verification
* **Objective:** Validate route performance and local CORS headers.
* **Input:** HTTP OPTIONS and POST requests to `/api/weather` and `/api/evaluate`.
* **Test Method:** Execute benchmark using `httpx` async client.
* **Pass Criteria:**
  * Response header `access-control-allow-origin: *` present.
  * Hydrology math execution completes in $<5\text{ ms}$.
  * Combined weather fetch + math pipeline completes in $<25\text{ ms}$.

---

## 3. Daily Test & Milestones Checklist

- [ ] **Day 1–2:** Open-Meteo async client passes Test BE-01; CORS middleware verified.
- [ ] **Day 3–4:** Math functions pass Tests BE-02, BE-03, BE-04, and BE-05.
- [ ] **Day 5:** State compilation matches `contracts/mock_weather_hydrology.json`.
- [ ] **Day 6–7:** Latency verified under 25 ms in Test BE-06; verified integration with Person 3.
