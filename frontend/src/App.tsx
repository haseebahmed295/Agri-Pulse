import React, { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { SatelliteMapView } from './components/map/SatelliteMapView';
import { FieldControls } from './components/controls/FieldControls';
import { StressTimeline } from './components/timeline/StressTimeline';
import { ActionDispatchCard } from './components/dispatch/ActionDispatchCard';
import { useFieldStore } from './store/useFieldStore';
import bgImage from './assets/farm-bg-new.png';

export const App: React.FC = () => {
  const { activeTab, triggerEvaluation } = useFieldStore();

  useEffect(() => {
    // Initial evaluation run on mount
    triggerEvaluation();
  }, [triggerEvaluation]);

  return (
    <div 
      className="h-screen w-screen overflow-hidden flex flex-col text-slate-900 font-sans select-none antialiased bg-cover bg-center bg-no-repeat relative bg-slate-100"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Clean Daylight Ambient Tint Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100/90 via-slate-50/85 to-slate-100/90 pointer-events-none" />

      {/* Top Bar with Brand, Navigation Tabs, Scenarios & Engine Status */}
      <div className="relative z-30">
        <TopBar />
      </div>

      {/* Main Single-Viewport Tabbed Content Area */}
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden">
        {activeTab === 'map' && <SatelliteMapView />}

        {activeTab === 'irrigation' && (
          <div className="h-full w-full grid grid-cols-12 min-h-0 overflow-hidden p-2.5 gap-2.5">
            {/* Left Column: Field Controls & Simulator (3 cols) */}
            <div className="col-span-3 h-full min-h-0 overflow-hidden">
              <FieldControls />
            </div>

            {/* Center Column: Dual-Axis Stress Timeline Graphs (6 cols) */}
            <div className="col-span-6 h-full min-h-0 overflow-hidden">
              <StressTimeline />
            </div>

            {/* Right Column: Action Dispatch Card (3 cols) */}
            <div className="col-span-3 h-full min-h-0 overflow-hidden">
              <ActionDispatchCard />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
