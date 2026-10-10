# Person 3: Local AI & Decision Engine Engineer — Task & Test Plan

**Role:** Local AI Model & Decision Logic Specialist  
**Workspace Ownership:**  
* `backend/app/schemas.py`  
* `backend/app/services/decision_engine.py`  
* `backend/app/services/guardrails.py`  
**Shared Contract Ingested:** `contracts/mock_weather_hydrology.json`  
**Shared Contract Emitted:** `contracts/mock_decision_response.json`  
**Target Delivery:** Local Model Inference Client, Post-Inference Guardrails, and Deterministic Fallback Matrix  

---

## 1. Input & Output Requirements

### Input Requirements (Consumed Interfaces)
* Receives pre-computed state object conforming strictly to `contracts/mock_weather_hydrology.json`:
  * `crop_context`: Crop type, stage, thermal threshold, vulnerability tag.
  * `hydrology_summary`: Soil type, current moisture, $\theta_{\text{FC}}$, $\theta_{\text{PWP}}$, precomputed deficit (mm), simulated depletion flag.
  * `hazard_profile`: Heatwave active flag, peak temp, duration, days until peak.
  * `irrigation_system`: `Drip`, `Center_Pivot`, `Furrow_Flood`.
  * `candidate_decisions`: 4 bounded decision enums.

### Output Requirements (Delivered Artifacts)
1. **Pydantic Data Models (`schemas.py`):**
   * Enums: `SufficiencyStatus`, `CandidateDecision`.
   * Models: `ActionPlan`, `DecisionOutput`.
   * Exported TypeScript type definitions matching the Pydantic schema for Person 1.
2. **Local Model Client Service (`decision_engine.py`):**
   * Pluggable client pointing to local runner (e.g., `http://localhost:11434` or local OpenAI-compatible endpoint).
   * JSON mode constrained output (`response_format: {"type": "json_object"}`).
3. **Safety Guardrails (`guardrails.py`):**
   * Enforces zero water on `HOLD_CURRENT_LEVEL`.
   * Overrides execution window to night hours (22:00 to 05:00) during heatwaves.
   * Caps single-application depth to $\le 45.0\text{ mm}$.
4. **Deterministic Agronomic Fallback Matrix:**
   * Heuristic rule-engine executing in $<1\text{ ms}$ if local model times out ($>500\text{ ms}$) or returns invalid JSON.

---

## 2. Test Plan & Verification Matrix

### Test AI-01: Pydantic Schema Validation & Boundary Enforcement
* **Objective:** Ensure data contracts strictly validate fields and reject invalid values.
* **Input:** Valid state payload vs. malformed payloads (missing deficit, moisture $> 100\%$, unknown decision string).
* **Test Method:** Run `pytest` on `schemas.py` validation.
* **Pass Criteria:**
  * Valid payload parses into `DecisionOutput` without errors.
  * Invalid action enum (e.g., `"WATER_NOW"`) raises `ValidationError`.
  * Confidence outside $[0.0, 1.0]$ raises `ValidationError`.

### Test AI-02: Local Model Structured Output Conformance
* **Objective:** Verify local model runner consistently returns JSON parseable by `DecisionOutput`.
* **Input:** `mock_weather_hydrology.json` sent to local runner.
* **Test Method:** Execute 10 consecutive inference requests to `query_local_model()`.
* **Pass Criteria:**
  * 10 out of 10 requests return valid JSON matching schema.
  * Zero markdown fences (` ```json `), conversational prose, or headers in model response.

### Test AI-03: The Three Golden Calibration Tests
* **Objective:** Verify the decision engine selects correct agronomic directives for standard scenarios.
* **Test Scenarios:**
  * **Scenario 1 (Reproductive Crisis):** Wheat + Flowering + 41.5°C heat in 48h.
    * *Expected:* `selected_decision: PREEMPTIVE_NIGHT_PRECHARGE`, `water_depth_mm: 24.0`, status: `CRITICAL_HEAT_DEFICIT`.
  * **Scenario 2 (Hypoxia Avoidance):** Cotton + Vegetative + Clay + 39.5°C heat.
    * *Expected:* `selected_decision: HOLD_CURRENT_LEVEL`, `water_depth_mm: 0.0`, status: `SUFFICIENT_NO_ACTION`.
  * **Scenario 3 (Daytime Scald Avoidance):** Tomato + Fruit Set + Loam + 40.0°C in 12h.
    * *Expected:* `selected_decision: SPLIT_CYCLE_LIGHT_IRRIGATION`, status: `CRITICAL_HEAT_DEFICIT`.
* **Pass Criteria:**
  * Model reproduces all three expected decisions and rationale links.

### Test AI-04: Post-Inference Guardrail Enforcers
* **Objective:** Verify physical safety rules override any potential model slips.
* **Test Method:** Feed intentionally faulty model responses into `post_inference_guardrails()`:
  * Fault 1: `selected_decision: HOLD_CURRENT_LEVEL` with `water_depth_mm = 20.0`.
  * Fault 2: `selected_decision: PREEMPTIVE_NIGHT_PRECHARGE` with daytime window (`14:00 - 17:00`).
  * Fault 3: `water_depth_mm = 65.0`.
* **Pass Criteria:**
  * Fault 1 overridden to `water_depth_mm = 0.0`.
  * Fault 2 overridden to nighttime window (`Tonight 22:30 - 04:30 PKT`).
  * Fault 3 capped to `water_depth_mm = 45.0`.

### Test AI-05: Instant Deterministic Fallback Matrix
* **Objective:** Guarantee zero application downtime when local model runner is stopped or times out.
* **Test Method:** Terminate local inference runner process and invoke `evaluate_field_decision()`.
* **Pass Criteria:**
  * Call catches connection error and returns valid `DecisionOutput`.
  * Field `engine_source` marked as `DETERMINISTIC_FALLBACK`.
  * Fallback recovery latency $\le 1.0\text{ ms}$.

### Test AI-06: Local Model Latency Benchmark
* **Objective:** Validate local inference execution time satisfies hackathon target.
* **Input:** Standard state payload on target laptop hardware.
* **Test Method:** Benchmark 20 runs using `time.perf_counter()`.
* **Pass Criteria:**
  * $P_{95}$ local inference latency $\le 100\text{ ms}$.
  * System memory usage stays below host budget.

---

## 3. Daily Test & Milestones Checklist

- [ ] **Day 1–2:** Pydantic schemas pass Test AI-01; TypeScript types exported for Person 1.
- [ ] **Day 3–4:** Local runner returns valid structured JSON passing Test AI-02 and AI-03.
- [ ] **Day 5:** Guardrails pass Test AI-04; fallback matrix passes Test AI-05.
- [ ] **Day 6–7:** Latency verified $\le 100\text{ ms}$ in Test AI-06; verified integration with Person 2 and Person 4.
