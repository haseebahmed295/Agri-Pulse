import React, { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { FieldControls } from './components/controls/FieldControls';
import { StressTimeline } from './components/timeline/StressTimeline';
import { ActionDispatchCard } from './components/dispatch/ActionDispatchCard';
import { useFieldStore } from './store/useFieldStore';
import bgImage from './assets/farm-bg-new.png';

export const App: React.FC = () => {
  const { triggerEvaluation } = useFieldStore();

  useEffect(() => {
    // Initial evaluation run on mount
    triggerEvaluation();
  }, [triggerEvaluation]);

  return (
    <div 
      className="h-screen w-screen overflow-hidden flex flex-col text-zinc-100 font-sans select-none antialiased bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Top Bar with Brand & Presets */}
      <TopBar />

      {/* Main Single-Viewport 3-Column Operational Grid */}
      <main className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* Left Column: Field Controls & Simulator (3 cols) */}
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <FieldControls />
        </div>

        {/* Center Column: Dual-Axis Stress Timeline (6 cols) */}
        <div className="col-span-6 h-full min-h-0 overflow-hidden">
          <StressTimeline />
        </div>

        {/* Right Column: Action Dispatch Card (3 cols) */}
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <ActionDispatchCard />
        </div>
      </main>
    </div>
  );
};

export default App;
