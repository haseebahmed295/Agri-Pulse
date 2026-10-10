# Person 1: Frontend & Visualization Engineer — Task & Test Plan

**Role:** Frontend & UI Visualization Specialist  
**Workspace Ownership:** `frontend/src/**`  
**Shared Contract Ingested:** `contracts/mock_decision_response.json`  
**Target Delivery:** Single-viewport operational console in React (Vite) + Recharts + Zustand  

---

## 1. Input & Output Requirements

### Input Requirements (Consumed Interfaces)
* Ingests `contracts/mock_decision_response.json` during isolated development (Days 1–4).
* Ingests live response from `POST http://localhost:8000/api/evaluate` during integration (Day 5+).
* Input state emitted to backend:
  * Crop: `Wheat` | `Maize` | `Cotton` | `Tomato`
  * Growth Stage: `Vegetative` | `Flowering_Anthesis` | `Grain_Fill` | `Maturity`
  * Soil Texture: `Sandy Loam` | `Loam` | `Clay`
  * Current Moisture: Float percentage ($5.0\%$ to $45.0\%$)
  * Heatwave Toggle: Boolean (`true` = +6°C spike)
  * Peak Temperature Override: Float ($30.0^\circ\text{C}$ to $48.0^\circ\text{C}$)

### Output Requirements (Delivered Artifacts)
1. **Single-Viewport Console (Zero Vertical Scrolling):** Fits completely on 1366x768 and 1920x1080 screens without vertical body scrollbars.
2. **Left Panel (Field Controls & Simulator):** Dropdowns for crop, stage, soil; interactive range sliders for moisture and simulated heat spike.
3. **Center Panel (Dual-Axis Recharts Timeline):**
   * Red curve (top axis): 7-day temperature trajectory with critical threshold shading ($T \ge 38^\circ\text{C}$).
   * Orange/dashed curve (bottom axis): Unmitigated baseline soil moisture depletion.
   * Green solid curve (bottom axis): Mitigated pre-charge moisture trajectory.
   * Highlighted badge: Root-zone exhaustion alert timestamp.
4. **Right Panel (Action Dispatch Card):**
   * Status badge: Green (`SUFFICIENT_NO_ACTION`), Amber (`MODERATE_DEFICIT`), Pulsing Red (`CRITICAL_HEAT_DEFICIT`).
   * Selected action header in bold monospace.
   * Target water depth (mm) and execution window (hours).
   * Biological rationale text.
   * Live latency indicator (`Latency: XX ms`).
5. **Preset Buttons (Top Bar):** 3 one-click preset buttons for Golden Demos (Crisis, Trap, Imminent Scald).

---

## 2. Test Plan & Verification Matrix

### Test FE-01: Mock Contract Ingestion & Render Integrity
* **Objective:** Verify UI mounts and renders without errors using `mock_decision_response.json`.
* **Input:** Static mock JSON containing `PREEMPTIVE_NIGHT_PRECHARGE`, 24.0 mm, and 24.5 ms latency.
* **Test Method:** Mount component tree; verify DOM presence of action title, badges, depth values, and rationale.
* **Pass Criteria:**
  * Action card displays `PREEMPTIVE_NIGHT_PRECHARGE`.
  * Water depth displays `24.0 mm`.
  * Status badge shows red styling for `CRITICAL_HEAT_DEFICIT`.
  * Zero browser console errors or TypeScript type mismatches.

### Test FE-02: Dual-Axis Recharts Curve Synchronization
* **Objective:** Ensure temperature and moisture series align on the same 7-day calendar x-axis.
* **Input:** 7-day weather and depletion array.
* **Test Method:** Visual and DOM inspection of SVG paths in Recharts.
* **Pass Criteria:**
  * Left y-axis scales temperature (20°C to 50°C).
  * Right y-axis scales volumetric moisture (0% to 50%).
  * Critical heat threshold line renders at 38°C mark.
  * Wilting point threshold renders horizontally as danger boundary.

### Test FE-03: Zustand Reactive State & Slider Reactivity
* **Objective:** Test client-side reactivity when moving sliders.
* **Input:** Drag Current Moisture slider from 14% to 35%; toggle +6°C heat spike.
* **Test Method:** Inspect Zustand store state updates and local chart re-renders.
* **Pass Criteria:**
  * Slider changes reflect instantly in UI label (0 ms lag).
  * Heat spike toggle immediately raises forecast temperature line by +6°C.
  * Local state updates do not trigger unmounted component re-renders.

### Test FE-04: Single-Viewport Layout & Responsiveness
* **Objective:** Enforce zero-scroll layout constraint.
* **Input:** Screen resolutions 1920x1080 and 1366x768 at 100% DPI zoom.
* **Test Method:** Inspect `document.body.scrollHeight` vs `window.innerHeight`.
* **Pass Criteria:**
  * `scrollHeight <= window.innerHeight` across all panels.
  * No horizontal or vertical scrollbars appear on viewport.
  * Text and buttons do not overlap or clip.

### Test FE-05: Debounced Backend API Request Loop
* **Objective:** Verify slider dragging does not spam the backend endpoint.
* **Input:** Rapidly drag moisture slider 20 times within 1 second.
* **Test Method:** Monitor network tab requests to `POST /api/evaluate`.
* **Pass Criteria:**
  * API requests are debounced to 150 ms intervals.
  * Maximum 2 network requests fired during rapid continuous drag.
  * Response updates Action Dispatch card in $<300\text{ ms}$ total end-to-end loop.

### Test FE-06: Golden Demo Preset Buttons
* **Objective:** Ensure top-bar preset buttons instantly configure the console for demo scenarios.
* **Input:** Click "Preset A (Crisis)", "Preset B (Trap)", "Preset C (Scald)".
* **Test Method:** Assert field inputs and dispatched action values upon clicking each preset.
* **Pass Criteria:**
  * Preset A selects Wheat, Flowering, Sandy Loam, 14% moisture.
  * Preset B selects Cotton, Vegetative, Clay, 33% moisture.
  * Preset C selects Tomato, Fruit Set, Loam, 12% moisture.
  * Dispatch card transitions to expected action within 150 ms.

---

## 3. Daily Test & Milestones Checklist

- [ ] **Day 1–2:** Mock contract loaded; static 3-column layout passes Test FE-01 and FE-04.
- [ ] **Day 3–4:** Recharts component passes Test FE-02; Zustand store passes Test FE-03.
- [ ] **Day 5:** Live API connection passes Test FE-05.
- [ ] **Day 6–7:** Preset buttons pass Test FE-06; single-viewport responsiveness validated on target laptop.
