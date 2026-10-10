# Person 4: System Integration, Test Scenarios & Pitch Lead — Task & Test Plan

**Role:** System Integration, Quality Assurance & Pitch Lead  
**Workspace Ownership:**  
* `backend/tests/**`  
* `scripts/seed_scenarios.py`  
* `contracts/**`  
* `README.md` and presentation assets  
**Shared Contracts Managed:**  
* `contracts/mock_weather_hydrology.json`  
* `contracts/mock_decision_response.json`  
**Target Delivery:** End-to-end integration test suite, 3 Golden Demo scenarios, 100% offline resilience verification, and 90-second pitch deck  

---

## 1. Input & Output Requirements

### Input Requirements (Consumed Interfaces)
* Ingests Person 2's backend services (`weather_service.py`, `hydrology_service.py`).
* Ingests Person 3's decision module (`decision_engine.py`, `schemas.py`).
* Ingests Person 1's React client running on `http://localhost:5173`.

### Output Requirements (Delivered Artifacts)
1. **Locked Contract Files (Delivered Day 1):**
   * `contracts/mock_weather_hydrology.json` (Contract between Backend Math and AI).
   * `contracts/mock_decision_response.json` (Contract between AI/Backend and Frontend).
2. **Three Golden Demo Presets (in UI and test scripts):**
   * **Preset A (The Crisis):** Wheat · Flowering · Sandy Loam · Moisture 14% · 41.5°C Heatwave $\rightarrow$ `PREEMPTIVE_NIGHT_PRECHARGE` (24–32 mm).
   * **Preset B (The Trap):** Cotton · Vegetative · Clay · Moisture 33% · 39.5°C Heatwave $\rightarrow$ `HOLD_CURRENT_LEVEL` (0 mm, hypoxia defense).
   * **Preset C (The Imminent Scald):** Tomato · Fruit Set · Loam · Moisture 13% · 40.0°C in 12h $\rightarrow$ `SPLIT_CYCLE_LIGHT_IRRIGATION` (14 mm).
3. **End-to-End Integration Test Suite:** Automated test harness verifying full roundtrip execution.
4. **90-Second Hackathon Live Demo Script & 5-Slide Pitch Deck:**
   * Slide 1: The Invisible Loss (anthesis heat shock economics).
   * Slide 2: The Solution (Predictive thermal pre-charging vs reactive replenishment).
   * Slide 3: Live Demo (Walking through the 3 Presets in 45 seconds).
   * Slide 4: Local Offline Edge Architecture (Privacy, sub-150ms latency, zero cloud dependency).
   * Slide 5: The Team & Vision.

---

## 2. Test Plan & Verification Matrix

### Test INT-01: Cross-Module Contract Parity Check
* **Objective:** Ensure zero data structure drift between all three engineering modules.
* **Input:** Actual output from Person 2 backend pipeline piped directly into Person 3 decision module, then into Person 1 frontend parser.
* **Test Method:** Execute contract validator script comparing runtime payloads against `contracts/*.json`.
* **Pass Criteria:**
  * Zero missing fields, zero unexpected keys, zero enum mismatches.
  * Pydantic validation passes with 100% clean exit code.

### Test INT-02: End-to-End Preset A (The Reproductive Crisis)
* **Objective:** Verify end-to-end execution of Scenario A from user click to visual UI update.
* **Input:** Trigger Preset A button in UI or execute `python scripts/seed_scenarios.py --preset crisis`.
* **Pass Criteria:**
  * Status badge turns Pulsing Red (`CRITICAL_HEAT_DEFICIT`).
  * Action card displays `PREEMPTIVE_NIGHT_PRECHARGE`.
  * Water depth displays $24.0\text{ mm}$ to $32.0\text{ mm}$.
  * Execution window is restricted to night hours (`22:00 - 04:30 PKT`).
  * Center chart renders dual-axis forecast and failure callout badge on Day 2.

### Test INT-03: End-to-End Preset B (Hypoxia Prevention Trap)
* **Objective:** Prove the system prevents over-irrigation when soil buffer is high.
* **Input:** Trigger Preset B button in UI or execute `python scripts/seed_scenarios.py --preset trap`.
* **Pass Criteria:**
  * Status badge turns Green (`SUFFICIENT_NO_ACTION`).
  * Action card displays `HOLD_CURRENT_LEVEL`.
  * Water depth strictly equals $0.0\text{ mm}$.
  * Rationale explicitly notes heavy clay retention and prevention of root hypoxia.

### Test INT-04: End-to-End Preset C (The Imminent Daytime Scald)
* **Objective:** Verify pulsed watering decision for shallow-root crop facing imminent heat.
* **Input:** Trigger Preset C button in UI or execute `python scripts/seed_scenarios.py --preset scald`.
* **Pass Criteria:**
  * Status badge turns Red (`CRITICAL_HEAT_DEFICIT`).
  * Action card displays `SPLIT_CYCLE_LIGHT_IRRIGATION`.
  * Water depth is split into fractional cycle (e.g., $14.0\text{ mm}$).
  * Execution window specifies morning/evening split pulses avoiding peak midday heat.

### Test INT-05: Total Reactive Loop Latency Benchmark
* **Objective:** Enforce the hackathon performance standard across the entire stack.
* **Input:** Frontend slider drag event triggering POST `/api/evaluate`.
* **Test Method:** Measure end-to-end wall-clock time from browser network dispatch to React component re-render.
* **Pass Criteria:**
  * $P_{95}$ end-to-end roundtrip $\le 150\text{ ms}$.
  * UI shows updated action card without visible stutter.

### Test INT-06: 100% Offline Simulation & Zero-Wi-Fi Resilience
* **Objective:** Guarantee live hackathon pitch cannot fail due to venue Wi-Fi drops.
* **Test Method:** Disconnect host machine from all Wi-Fi and ethernet networks, restart backend and frontend, and execute all 3 demo presets.
* **Pass Criteria:**
  * Entire application loads and executes without internet connectivity.
  * Weather fallback loads cached profile; local model runs on host without network calls.
  * All 3 presets execute and render successfully.

---

## 3. Daily Test & Milestones Checklist

- [ ] **Day 1:** Both mock contract JSON files created and committed in `contracts/`.
- [ ] **Day 2–3:** Pitch structure drafted; automated contract verification test script built.
- [ ] **Day 4–5:** Conduct first end-to-end integration handshake; resolve CORS and payload discrepancies.
- [ ] **Day 6:** Verify Presets A, B, and C in Tests INT-02, INT-03, and INT-04; enforce latency in Test INT-05.
- [ ] **Day 7:** Offline resilience verified in Test INT-06; 5 rehearsal runs completed for 90-second pitch.
