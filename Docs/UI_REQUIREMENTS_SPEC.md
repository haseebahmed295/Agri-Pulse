# Agri-Pulse: Operations Console UI/UX Specification

**Document Identifier:** SPEC-AGRI-FE-001  
**Companion File:** `Docs/Agri-Pulse_UI_Requirements_Spec.docx`  
**Target Platform:** Single-Viewport React 18 (Vite) + Recharts + Tailwind CSS + Zustand  
**Design Philosophy:** High-Precision Ag-Tech Telemetry (Anti-Slop Craftsmanship)  

---

## 1. Executive Vision: Precision Telemetry vs. Generic SaaS

Agri-Pulse is an autonomous agronomic dispatch officer and thermal plant physiology engine. To make this product shine during live hackathon evaluations, investor demos, and field deployments, the interface must strictly reject generic SaaS templates and chatbot conversational forms. The interface must feel like an industrial-grade precision telemetry console—dense with high-signal data, instantly reactive, and purpose-built for high-stakes thermal crop protection.

### Core Principles
1. **Zero Chatbot Prose:** Agronomists and farm managers need actionable directives, not conversational pleasantries. Output immediate, military-dispatch-style operational commands.
2. **Physical Truth First:** Visual curves represent real thermodynamic and hydrological balances (FAO-56 Hargreaves equations and root-zone water balance), not decorative approximations.
3. **Single-Viewport Focus:** Zero vertical scrolling across all standard 1080p and 768p laptop screens. The entire state—inputs, 7-day curves, and tactical dispatch—is visible simultaneously.
4. **Sub-Second Reactive Loop:** Dragging temperature or moisture sliders must re-render visual trajectories and dispatch decisions in under 300 ms, proving live local AI inference.

---

## 2. Visual Identity & Color System

The visual identity uses a deep technical dark palette optimized for contrast, clarity, and rapid visual parsing under variable ambient lighting:

| Design Element | Color Code | Agronomic & Operational Purpose |
|---|---|---|
| **Canvas & Surfaces** | `#09090B` / `#18181B` (Zinc 950/900) | Dark technical foundation with subtle hairline borders (`#27272A`). Eliminates distracting full-page neon gradients. |
| **Thermal Hazard** | `#EF4444` (Rose 500) | Applied strictly to heatwave curves ($T \ge 38^\circ\text{C}$), critical stress regions, and pulsing danger badges. |
| **Soil Depletion Warning** | `#F59E0B` (Amber 500) | Dashed unmitigated baseline moisture depletion curve and moderate deficit warnings. |
| **Hydrated Buffer** | `#10B981` (Emerald 500) | Mitigated soil moisture trajectory, safe sufficiency badges, and system online beacons. |

---

## 3. Layout Architecture: The Three-Column Command Grid

The application is arranged in a strict single-viewport 3-column layout under a top navigation preset bar:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [TOP BAR] Agri-Pulse Telemetry  │  [Preset A: Crisis]  [Preset B: Trap]  [Preset C: Scald]  │  [Model: 8080 ●] │
├──────────────────────────────┬──────────────────────────────────────────┬──────────────────────────────┤
│ PANEL 1: FIELD TELEMETRY &   │ PANEL 2: DUAL-AXIS TIMELINE              │ PANEL 3: TACTICAL DISPATCH   │
│ STRESS SIMULATOR (28% width) │ & ROOT-ZONE HYDROLOGY (44% width)        │ TERMINAL (28% width)         │
│                              │                                          │                              │
│ • Crop & Stage Selectors     │ • 7-Day Synchronized Timeline            │ • Sufficiency Status Badge   │
│ • Soil Texture Selection     │ • Upper Axis: Temperature Curve (°C)     │   (Pulsing Red / Green)      │
│ • Current Moisture Slider    │   with 38°C Hazard Shading               │ • Monospace Directive Name   │
│   (5% to 50%)                │ • Lower Axis: Soil Depletion Curve (%)   │   PREEMPTIVE_NIGHT_PRECHARGE │
│ • +6°C Heat Spike Toggle     │   vs. Protected Pre-Charge Curve         │ • Target Depth: [ 24.0 mm ]  │
│ • Peak Temp Override Slider  │ • Critical Breach Callout Badge:         │ • Window: Tonight 22:00-04:30│
│ • Irrigation System Enum     │   "Exhaustion Day 2 at 14:00"            │ • Physiological Rationale    │
│                              │                                          │ • Live Model Latency: 184 ms │
└──────────────────────────────┴──────────────────────────────────────────┴──────────────────────────────┘
```

* **Top Bar (Preset Dock & System Beacon):** Features 1-click preset scenario pills alongside a live model connectivity beacon (`llama-server 8080: online [●]`).
* **Panel 1 (Left ~28% - Field Telemetry & Stress Simulator):** Houses crop selector, growth stage dropdown, soil texture selection, volumetric moisture slider (5%–50%), +6°C heat spike toggle, and peak temperature override slider (30°C–48°C).
* **Panel 2 (Center ~44% - Dual-Axis Hazard & Hydrology Timeline):** The Recharts visual centerpiece. Plots the 7-day temperature curve (left axis) with translucent 38°C danger shading against the dual soil moisture curves (right axis: unmitigated baseline vs. protected pre-charge). Features a beacon marker highlighting the exact hour of root-zone exhaustion.
* **Panel 3 (Right ~28% - Tactical Dispatch Terminal):** Displays the autonomous decision payload: Color-coded Sufficiency Status badge, bold monospace directive (e.g. `PREEMPTIVE_NIGHT_PRECHARGE`), numerical water depth stat (e.g. `24.0 mm`), execution time window badge with night-time moon icon, plant physiology rationale, and live latency counter.

---

## 4. The Three Golden Demo Scenarios (One-Click Presets)

| Preset ID & Label | Field Input State | Tactical Directive Dispatched | Biological Rationale & Key Takeaway |
|---|---|---|---|
| **Preset A: The Crisis** | Wheat · Flowering / Anthesis<br>Sandy Loam · 14.0% Moisture<br>41.5°C Heatwave in 48h | **`PREEMPTIVE_NIGHT_PRECHARGE`**<br>Status: `CRITICAL_HEAT_DEFICIT`<br>Depth: `24.0 mm`<br>Window: `22:00 - 04:30 PKT` | Anthesis is hypersensitive: heat shock causes irreversible pollen sterility. Deep night watering creates a transpirational cooling buffer without evaporative scalding. |
| **Preset B: The Trap (Hypoxia)** | Cotton · Vegetative<br>Heavy Clay · 33.0% Moisture<br>39.5°C Heatwave in 24h | **`HOLD_CURRENT_LEVEL`**<br>Status: `SUFFICIENT_NO_ACTION`<br>Depth: `0.0 mm`<br>Window: `No action required` | Proves the AI doesn't naively irrigate every heatwave. Heavy clay retains adequate moisture; adding water causes soil hypoxia (root drowning). |
| **Preset C: The Scald (Pulsed)** | Tomato · Fruit Set / Grain Fill<br>Loam · 13.0% Moisture<br>40.0°C Acute Spike in 12h | **`SPLIT_CYCLE_LIGHT_IRRIGATION`**<br>Status: `CRITICAL_HEAT_DEFICIT`<br>Depth: `14.0 mm` (Split pulses)<br>Window: `05:00-07:00 & 20:00-22:00` | Shallow root system facing acute heat requires cyclic morning/evening pulsing to sustain vascular turgor and prevent fruit scald without surface ponding. |

---

## 5. The "Live Wow Factor": Dynamic Stress Simulation

1. **Instant Local Slider Reactivity (0 ms):** Labels update seamlessly with zero mouse stutter.
2. **Debounced API Dispatch (150 ms):** Sends `EvaluateRequest` without flooding the backend.
3. **Live Curve Deformation:** The temperature curve shoots into the red-shaded zone; the baseline moisture curve steepens and breaches the Wilting Point line.
4. **Beacon Marker Pops Up:** Pinned badge highlights `"Exhaustion: Day 2 at 14:00"`.
5. **Tactical Flip:** The right dispatch card flips from green `HOLD_CURRENT_LEVEL` to a pulsing red `PREEMPTIVE_NIGHT_PRECHARGE` with exact application depth (e.g., $24.0\text{ mm}$).
6. **Speed Readout:** Latency counter displays `"Latency: 184 ms"`, proving the local model evaluated the scenario in real time.

---

## 6. Technical Frontend Stack

* **Framework:** React 18 + Vite (TypeScript for end-to-end type safety matching `contracts/decision_types.ts`)
* **Styling:** Tailwind CSS + Radix UI Primitives (Slider, Select, Tooltip, Badge)
* **Charting:** Recharts (SVG ResponsiveContainer with synchronized dual axes)
* **State Management:** Zustand (reactive store managing sliders and debouncing)
* **Icons:** Lucide React (`Droplets`, `Flame`, `Sprout`, `Moon`, `AlertTriangle`, `Cpu`, `Clock`, `ShieldCheck`)

### Target Source Tree (`frontend/src/`)
```
frontend/src/
├── components/
│   ├── controls/           # Panel 1: Crop, Stage, Soil selectors & sliders
│   ├── timeline/           # Panel 2: Dual-axis Recharts temperature & moisture graph
│   ├── dispatch/           # Panel 3: Tactical dispatch card & execution specs
│   ├── navigation/         # Top bar: Brand beacon & Golden Preset Dock
│   └── ui/                 # Radix / shadcn primitives (slider, badge, select)
├── store/                  # Zustand telemetry & simulation store
├── lib/                    # API client (POST /api/evaluate) & types
├── App.tsx                 # Single-viewport 3-column layout
└── main.tsx
```
