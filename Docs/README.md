# Agri-Pulse Documentation Suite

This directory contains the engineering specifications, agronomic decision engine documentation, interface guidelines, and modular test plans for the **Agri-Pulse** platform.

---

## Technical Specifications

| Document | Primary Focus | Key Contents |
|---|---|---|
| [`API_SPECIFICATION.md`](API_SPECIFICATION.md) | Backend REST Interfaces | Route definitions (`/api/health`, `/api/weather`, `/api/evaluate`, `/api/presets/{id}`), JSON schemas, CORS policies, P95 latency targets (<150ms). |
| [`AI_Decision_Engine_Spec.md`](AI_Decision_Engine_Spec.md) | Hydrological & Decision Logic | FAO-56 depletion equations, single-pass logit scoring inference, deterministic decision matrices, and safety guardrails. |
| [`UI_REQUIREMENTS_SPEC.md`](UI_REQUIREMENTS_SPEC.md) | Frontend User Experience | Single-viewport dashboard layout, GIS satellite view, 7-day dual-axis trajectory, farmer units (Acres, Maunds), and accessibility rules. |
| `Agri-Pulse_SRS_v2.docx` | System Requirements Specification | Comprehensive system requirement specification document. |
| `Agri-Pulse_AI_Decision_Engine_Spec.docx` | Formal AI Engine Document | Formatted Word specification of the AI decision pipeline. |
| `Agri-Pulse_UI_Requirements_Spec.docx` | Formal UI Design Document | Formatted Word specification of user interface behaviors. |

---

## Role-Based Test Plans & Verification Matrices

Each module has a dedicated test plan designed for targeted validation and regression testing:

### 1. Frontend Test Plan
- **Path:** [`person_1_frontend/TEST_PLAN.md`](person_1_frontend/TEST_PLAN.md)
- **Scope:** Interface verification (FE-01 through FE-06)
- **Coverage:**
  - `FE-01`: TopBar branding, engine status badge, and latency readout.
  - `FE-02`: Field telemetry controls, reactive sliders, and heatwave switch.
  - `FE-03`: Recharts dual-axis thermal and moisture trajectory chart.
  - `FE-04`: Action dispatch card, confidence display, and execution window.
  - `FE-05`: 150ms slider debouncing and offline resilience.
  - `FE-06`: Single-viewport zero-scrollbar constraint on 1080p and laptop screens.

### 2. Backend Test Plan
- **Path:** [`person_2_backend/TEST_PLAN.md`](person_2_backend/TEST_PLAN.md)
- **Scope:** Server endpoints and data pipelines (BE-01 through BE-06)
- **Coverage:**
  - `BE-01`: Live Open-Meteo weather ingestion and local disk cache fallback.
  - `BE-02`: Pydantic telemetry input validation and HTTP 422 handlers.
  - `BE-03`: Golden scenario presets (`crisis`, `trap`, `scald`).
  - `BE-04`: Health route service connectivity reporting.
  - `BE-05`: Cross-Origin Resource Sharing (CORS) preflight verification.
  - `BE-06`: Automated pytest test execution.

### 3. AI Decision Engine Test Plan
- **Path:** [`person_3_ai_engine/TEST_PLAN.md`](person_3_ai_engine/TEST_PLAN.md)
- **Scope:** Intelligence layer and agronomic safety (AI-01 through AI-05)
- **Coverage:**
  - `AI-01`: Shared data contract validation against TypeScript definitions.
  - `AI-02`: Local llama-server inference runner and fast logit scoring.
  - `AI-03`: Golden demo scenarios (Wheat crisis, Cotton hypoxia trap, Tomato scald).
  - `AI-04`: Post-inference agronomic guardrails (hypoxia caps, night windows, zero depth holds).
  - `AI-05`: Deterministic fallback matrix execution under 1ms.

### 4. Integration & Golden Demo Test Plan
- **Path:** [`person_4_integration_pitch/TEST_PLAN.md`](person_4_integration_pitch/TEST_PLAN.md)
- **Scope:** End-to-end integration and live presentation readiness (INT-01 through INT-05)
- **Coverage:**
  - `INT-01`: Full-stack local orchestration (FastAPI + Vite).
  - `INT-02`: One-click scenario demonstration stability.
  - `INT-03`: Network fault tolerance and graceful offline degradation.
  - `INT-04`: Visual clarity and daylight readability for field evaluation.
  - `INT-05`: Presentation timing and pitch walkthrough flow.

---

## Golden Demo Presets Quick Reference

| Preset ID | Crop | Soil | Trigger Event | Recommended Action | Key Rationale |
|---|---|---|---|---|---|
| `crisis` | Wheat (Anthesis) | Sandy Loam | +6°C Heat Spike (41.5°C peak) | `PREEMPTIVE_NIGHT_PRECHARGE` (24 mm) | Prevent irreversible pollen sterility before noon heat arrives. |
| `trap` | Cotton (Vegetative) | Clay | High moisture (33%), normal heat | `HOLD_CURRENT_LEVEL` (0 mm) | Prevent hypoxic root rot and oxygen deprivation in heavy soil. |
| `scald` | Tomato (Fruit Set) | Loam | Extreme heat (42.0°C), low moisture (13%) | `SPLIT_CYCLE_LIGHT_IRRIGATION` (12 mm) | Avoid boiling shallow root zones under midday sun via staged cycling. |
