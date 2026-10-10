src/
├── components/
│   ├── layout/
│   │   └── TopBar.tsx
│   ├── controls/
│   │   └── FieldControls.tsx
│   ├── timeline/
│   │   └── StressTimeline.tsx
│   └── dispatch/
│       └── ActionDispatchCard.tsx
├── store/
│   └── useFieldStore.ts
├── lib/
│   ├── api.ts
│   └── mockData.ts
├── App.tsx
└── main.tsx
Step 1: Install Libraries
Install zustand (for fast state without lag) and recharts (for the timeline chart).
Step 2: Create Data & API Layer (src/lib/)
mockData.ts: Holds the initial mock response (mock_decision_response.json) and the 3 one-click presets (Crisis, Trap, Scald) so the app works 100% offline immediately.
api.ts: Handles calling the backend API with a 150ms debounce so rapid slider drags don’t overload the backend.
Step 3: Create the Zustand Store (src/store/useFieldStore.ts)
Central brain of the app:
Holds inputs: crop, stage, soil, moisture, isHeatwave, tempOverride.
Holds outputs: decision, waterDepth, rationale, latency.
Action: applyPreset('crisis' | 'trap' | 'scald') to switch everything in 1 click.
Step 4: Build the 4 Visual Components
TopBar.tsx: Header with logo, engine status badge, the 3 preset buttons, and live latency indicator.
FieldControls.tsx: Left column with clean dropdowns, reactive sliders, and heatwave switch.
StressTimeline.tsx: Center column with dual-axis chart (38°C danger threshold, temp line, unmitigated vs. mitigated moisture curves).
ActionDispatchCard.tsx: Right column showing status badge (Green / Amber / Red), dispatched decision header, water depth in mm, execution window, and rationale.
Step 5: Assemble in App.tsx & Verify Single-Viewport
Assemble in a 3-column layout with h-screen overflow-hidden to guarantee zero vertical scrollbars.
Verify all 6 requirements from your test plan (FE-01 through FE-06).
Let me know if you are ready to begin with Step 1 (installing packages) and Step 2 (creating mockData & api)
src/components/
├── layout/
│   └── TopBar.tsx                 (Header Bar - Full Width, 56px height)
│       ├── Left Section:
│       │   ├── App Branding & Icon ("AGRI-PULSE v1.0.0 MVP")
│       │   └── Engine Badge (e.g., "LOCAL_MODEL_ENGINE" or "FALLBACK")
│       ├── Center Section:
│       │   └── 3 Golden Demo Preset Buttons:
│       │       ├── 🔴 Preset A: Heat Crisis
│       │       ├── 🟡 Preset B: False Security
│       │       └── 🟠 Preset C: Imminent Scald
│       └── Right Section:
│           └── Live Latency Pill (e.g., "Latency: 28.4 ms" + spinner on load)
│
├── controls/
│   └── FieldControls.tsx          (Left Panel - 3/12 Grid Columns)
│       ├── Section Title: "Field Telemetry & Simulator"
│       ├── Dropdowns:
│       │   ├── Crop Type (Wheat, Maize, Cotton, Tomato)
│       │   ├── Growth Stage (Vegetative, Flowering, Grain Fill, Maturity)
│       │   ├── Soil Type (Sandy Loam, Loam, Clay)
│       │   └── Irrigation System (Furrow Flood, Drip, Center Pivot)
│       ├── Moisture Slider Block:
│       │   ├── Dynamic Color Badge (Red <10%, Amber <18%, Green ≥18%)
│       │   ├── Range Slider (5.0% to 45.0%, step 0.5%)
│       │   └── Hydraulic Markers: 5% (Wilting) | 20% (FC) | 45% (Saturation)
│       └── Heatwave Simulation Block:
│           ├── +6°C Heat Spike Toggle Button (OFF vs. +6°C ACTIVE)
│           └── Peak Temperature Slider (30.0°C to 48.0°C)
│
├── timeline/
│   └── StressTimeline.tsx         (Center Panel - 6/12 Grid Columns)
│       ├── Header & Breach Indicator:
│       │   ├── Title: "7-Day Thermal & Depletion Trajectory"
│       │   └── Pulsing Alert Badge: "Exhaustion Breach: Day 2 at 14:00"
│       ├── Recharts Dual-Axis Graph (Synchronized on 7-Day calendar dates):
│       │   ├── Left Y-Axis: Temperature (20°C to 50°C, Rose color)
│       │   ├── Right Y-Axis: Volumetric Moisture (0% to 40%, Cyan color)
│       │   ├── 38°C Critical Heat Reference Line (Dashed red marker)
│       │   ├── 9% Wilting Point Reference Line (Dashed orange marker)
│       │   ├── Curve 1: Red Solid Line (Forecast Temperature)
│       │   ├── Curve 2: Orange Dashed Line (Baseline Depletion)
│       │   ├── Curve 3: Green Solid Line (Mitigated Safe Pre-charge Trajectory)
│       │   └── Custom Tooltip showing all values per day on hover
│       └── Legend Bar: Color dots and calendar span tag
│
└── dispatch/
    └── ActionDispatchCard.tsx     (Right Panel - 3/12 Grid Columns)
        ├── Card Header: "Action Dispatch Card" + Decision ID hash
        ├── Dynamic Status Badge:
        │   ├── 🟢 SUFFICIENT - NO ACTION
        │   ├── 🟡 MODERATE DEFICIT
        │   └── 🔴 CRITICAL HEAT DEFICIT (Pulsing animation)
        │   └── Confidence Score (e.g., "96% Conf")
        ├── Dispatched Action Header (Bold monospace, e.g., "PREEMPTIVE_NIGHT_PRECHARGE")
        ├── Metric KPI Cards:
        │   ├── Target Water Depth: "24.0 mm"
        │   └── Execution Window: "Tonight 22:00 - 04:30 PKT"
        ├── Biological Rationale Card:
        │   └── Scientific agronomic explanation for why this action was selected
        └── Dispatch Trigger Button:
            └── "Dispatch Command to Telemetry Valve" (interactive queue trigger)
