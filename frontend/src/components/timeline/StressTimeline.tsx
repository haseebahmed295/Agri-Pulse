import React from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, Clock } from 'lucide-react';

export const StressTimeline: React.FC = () => {
  const { decision } = useFieldStore();
  const series = decision.chart_series || [];

  return (
    <div className="h-full p-4">
      <section className="h-full flex flex-col bg-[#0c2415]/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 select-none shadow-2xl overflow-hidden">
        {/* Header and Alert Pill */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-semibold uppercase tracking-wider text-white">
              7-Day Thermal & Depletion Trajectory
            </h2>
            <p className="text-[13px] text-[#9cb5a6]">
              Dual-Axis Synchronized Model (Atmospheric Demand vs. Root Zone Hydrology)
            </p>
          </div>

          {decision.projected_depletion_timestamp && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" strokeWidth={2.5} />
              <span className="text-red-500 font-bold text-[13px] tracking-wide">
                Exhaustion Breach: {decision.projected_depletion_timestamp}
              </span>
            </div>
          )}
        </div>

        <div className="w-full h-px bg-white/10 my-4" />

        {/* Chart Canvas */}
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255, 255, 255, 0.15)" vertical={true} horizontal={false} />

              <XAxis
                dataKey="date"
                stroke="#9cb5a6"
                fontSize={12}
                tickLine={true}
                axisLine={{ stroke: '#9cb5a6' }}
                dy={10}
              />

              {/* Left Y-Axis: Temperature (°C) */}
              <YAxis
                yAxisId="temp"
                domain={[20, 60]}
                ticks={[20, 30, 44, 60]}
                stroke="#fba696"
                fontSize={12}
                tickFormatter={(v) => `${v}°C`}
                tickLine={true}
                axisLine={{ stroke: '#fba696' }}
                width={60}
              />

              {/* Right Y-Axis: Moisture (%) */}
              <YAxis
                yAxisId="moisture"
                orientation="right"
                domain={[0, 60]}
                ticks={[0, 20, 40, 60]}
                stroke="#a7eed6"
                fontSize={12}
                tickFormatter={(v) => `${v}%`}
                tickLine={true}
                axisLine={{ stroke: '#a7eed6' }}
                width={50}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#0f291e]/90 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-2xl text-xs space-y-1.5">
                      <p className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5 text-[14px]">
                        {data.date} (Day {data.day})
                      </p>
                      <div className="flex items-center justify-between gap-6 text-[#fba696] text-[13px]">
                        <span>Forecast Temp:</span>
                        <span className="font-mono font-bold">{data.forecast_temp_c}°C</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-[#a7eed6] text-[13px]">
                        <span>Baseline Moisture:</span>
                        <span className="font-mono font-bold">{data.baseline_moisture_pct}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-[#fce88e] text-[13px]">
                        <span>Mitigated Moisture:</span>
                        <span className="font-mono font-bold">{data.protected_moisture_pct}%</span>
                      </div>
                    </div>
                  );
                }}
              />

              {/* Critical Thermal Threshold: 35°C */}
              <ReferenceLine
                yAxisId="temp"
                y={35}
                stroke="#fba696"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: '35°C Critical Threshold',
                  fill: '#fba696',
                  fontSize: 11,
                  position: 'insideBottomLeft',
                }}
              />

              {/* Wilting Point Threshold: 5% */}
              <ReferenceLine
                yAxisId="moisture"
                y={5}
                stroke="#fce88e"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: '5% Wilting Point',
                  fill: '#fce88e',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />

              {/* Curves */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="forecast_temp_c"
                name="Temperature"
                stroke="#fba696"
                strokeWidth={2}
                dot={{ r: 4, fill: '#fba696', stroke: 'none' }}
                activeDot={{ r: 6 }}
              />

              <Line
                yAxisId="moisture"
                type="monotone"
                dataKey="baseline_moisture_pct"
                name="Baseline Moisture"
                stroke="#a7eed6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#a7eed6', stroke: 'none' }}
                activeDot={{ r: 6 }}
              />

              <Line
                yAxisId="moisture"
                type="monotone"
                dataKey="protected_moisture_pct"
                name="Mitigated Moisture"
                stroke="#fce88e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#fce88e', stroke: 'none' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-start text-[12px] text-white">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fba696] inline-block shadow-md" /> Forecast Temp
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#a7eed6] inline-block shadow-md" /> Baseline Depletion
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-transparent inline-block border-b-2 border-dashed border-[#fce88e] relative">
                 <span className="w-2.5 h-2.5 rounded-full bg-[#fce88e] inline-block shadow-md absolute -top-1 left-0.5" />
              </span>{' '}
              Pre-charged Safe Trajectory
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
