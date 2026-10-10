# Agri-Pulse Frontend Dashboard

The **Agri-Pulse Frontend** is an edge-first single-page web dashboard built with React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Recharts, and Leaflet. It delivers an interactive tactical cockpit for agricultural resilience under extreme heatwaves.

---

## Key Features

1. **Photorealistic GIS Satellite Field Inspector (`src/components/map/SatelliteMapView.tsx`)**:
   - Integrates Esri 0.5m World Imagery and boundary cartography via Leaflet.
   - Interactive farm plot management with visual polygon geometries reflecting thermal and hydration states.
   - Draggable active field pins for precise GPS geolocation.
   - Field Area & Boundary Editor supporting farmer-friendly units: Acres (ایکڑ), Kanals (8 Kanals per Acre), Hectares, and real-time yield forecasts in Maunds (40kg من).

2. **Single-Viewport Tactical Irrigation Simulator (`src/components/controls/FieldControls.tsx`)**:
   - Zero-scroll layout optimized for laptop and desktop control rooms.
   - Crop species selection (Wheat, Cotton, Maize, Tomato) and phenological growth stages (Anthesis, Vegetative, Grain Fill, Maturity).
   - Soil texture profiles (Sandy Loam, Loam, Clay) and irrigation systems (Furrow Flood, Drip, Center Pivot).
   - Real-time moisture slider (5.0% to 45.0%) with hydraulic reference markers (Wilting, Field Capacity, Saturation).
   - Heatwave simulation toggle (+6°C active) with peak temperature slider (30°C to 48°C).

3. **7-Day Thermal & Depletion Trajectory (`src/components/timeline/StressTimeline.tsx`)**:
   - Dual-axis Recharts graph synchronized across 7 calendar days.
   - Left Y-Axis: Forecast ambient temperature (20°C to 50°C).
   - Right Y-Axis: Volumetric soil moisture content (0% to 40%).
   - Critical reference markers: 38.0°C thermal danger line and 9.0% permanent wilting point threshold.
   - Comparative curves: Red line (Temperature), Orange dashed curve (Baseline unmitigated depletion), Green solid curve (Mitigated safe trajectory).
   - Exhaustion breach alert badge with exact day and hour of failure.

4. **Action Dispatch Card (`src/components/dispatch/ActionDispatchCard.tsx`)**:
   - Dynamic status badge (🟢 SUFFICIENT, 🟡 MODERATE DEFICIT, 🔴 CRITICAL HEAT DEFICIT).
   - Decision confidence readout (e.g., 96% Conf).
   - Tactical directive header (e.g., `PREEMPTIVE_NIGHT_PRECHARGE`).
   - Actionable metrics: Target water depth (mm) and execution window (e.g., "Tonight 22:00 - 04:30 PKT").
   - Biological rationale detailing root zone moisture dynamics and heat prevention.
   - Telemetry valve command trigger button.

5. **TopBar & Golden Demo Presets (`src/components/layout/TopBar.tsx`)**:
   - One-click Golden Demo scenario buttons:
     - 🔴 **Preset A: Heat Crisis** (Wheat in flowering anthesis under 41.5°C heat spike).
     - 🟡 **Preset B: False Security** (Cotton vegetative in clay soil; avoids hypoxia trap).
     - 🟠 **Preset C: Imminent Scald** (Tomato fruit set under furrow flood; avoids scald).
   - Live engine status pill (`LOCAL_MODEL_ENGINE`, `DETERMINISTIC_FALLBACK`, or `MOCK`).
   - Roundtrip latency indicator with live millisecond timing.

---

## Tech Stack

| Layer | Library / Tool | Version | Purpose |
|---|---|---|---|
| Framework | React | 19.2.x | Component lifecycle and UI rendering |
| Language | TypeScript | 6.0.x | Static typing and contract enforcement |
| Bundler | Vite | 8.3.x | Fast development server and production builds |
| Styling | Tailwind CSS | 4.3.x | Utility-first styling with modern CSS engine |
| State Management | Zustand | 5.0.x | Global state without unnecessary rerenders |
| Charts | Recharts | 3.10.x | Responsive SVG dual-axis time-series visualization |
| Maps | Leaflet | 1.9.x | Photorealistic satellite GIS mapping and polygon geometry |
| Icons | Lucide React | 1.55.x | Consistent iconography |

---

## Directory Structure

```
frontend/src/
├── assets/                  # Background images and static graphical assets
├── components/
│   ├── controls/            # FieldControls.tsx (Telemetry inputs & heat spike switch)
│   ├── dashboard/           # Additional dashboard sub-components
│   ├── dispatch/            # ActionDispatchCard.tsx (Directive header, depth, window)
│   ├── layout/              # TopBar.tsx (Navigation tabs, presets, latency pill)
│   ├── map/                 # SatelliteMapView.tsx (Leaflet Esri satellite inspector)
│   ├── navigation/          # Navigation tabs and controls
│   └── timeline/            # StressTimeline.tsx (Recharts dual-axis 7-day graph)
├── lib/
│   ├── api.ts               # Backend API integration with debouncing and fallback
│   ├── mockData.ts          # Default presets, offline mocks, and farmer action maps
│   └── utils.ts             # Styling and class merging helpers
├── store/
│   └── useFieldStore.ts     # Central Zustand state store
├── App.tsx                  # Single-viewport tabbed container
├── main.tsx                 # React DOM mount point
└── index.css                # Tailwind directives and custom scrollbars
```

---

## Getting Started

### Prerequisites
- Node.js (version 18 or newer)
- npm (version 9 or newer)

### Installation & Execution

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. (Optional) Configure map keys
cp .env.example .env

# 4. Start Vite development server
npm run dev
```

The web application will open at:
- **Local URL:** `http://localhost:5173`

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts Vite local development server with hot module reloading (HMR). |
| `npm run build` | Compiles TypeScript (`tsc -b`) and bundles production assets into `dist/`. |
| `npm run preview` | Serves the production build locally for verification. |
| `npm run lint` | Runs ESLint across TypeScript and TSX source files. |

---

## Environment Variables

Copy `.env.example` to `.env` to supply custom map credentials:

```bash
# Optional: Esri ArcGIS / Mapbox access token for high-tier satellite tile quotas
VITE_MAP_API_KEY=your_key_here
VITE_MAPBOX_ACCESS_TOKEN=your_token_here
```

If left unconfigured, the application automatically falls back to bundled public tile endpoints.

---

## Offline & Fault Tolerance

The frontend is built to run reliably under intermittent rural connectivity:
- **150ms Debounced API Calls:** Rapid slider adjustments in `FieldControls` are debounced before dispatching to the backend.
- **3-Second Timeout with Instant Client-Side Fallback:** If the backend service is offline, `src/lib/api.ts` immediately resolves with deterministic calculations from `src/lib/mockData.ts`.
- **Pre-bundled Golden Presets:** All three demo scenarios are embedded directly in the bundle, enabling zero-latency demonstrations without network dependencies.
