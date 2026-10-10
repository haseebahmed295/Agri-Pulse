import React, { useState } from 'react';
import { useFieldStore } from '../../store/useFieldStore';
import type { ChartDataPoint } from '../../lib/mockData';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Area,
} from 'recharts';
import { AlertTriangle, TrendingUp, Layers, Droplets, Thermometer, SplitSquareVertical, Flame, Sprout, CheckCircle2 } from 'lucide-react';

type GraphViewMode = 'split' | 'combined' | 'moisture' | 'temp';

interface TooltipPayloadItem {
  dataKey?: unknown;
  value?: unknown;
  payload?: unknown;
}

interface CustomBadgeProps {
  viewBox?: { x: number; y: number; width: number; height: number };
  text: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  align?: 'left' | 'right' | 'center';
  offsetY?: number;
  offsetX?: number;
  icon?: 'flame' | 'sprout' | 'alert';
}

const CustomReferenceBadge: React.FC<CustomBadgeProps> = ({
  viewBox,
  text,
  textColor,
  bgColor,
  borderColor,
  align = 'right',
  offsetY = -21,
  offsetX = 0,
  icon,
}) => {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  const charWidth = 6.2;
  const hasIcon = Boolean(icon);
  const iconSpace = hasIcon ? 15 : 0;
  const pillWidth = Math.max(76, text.length * charWidth + 14 + iconSpace);
  const pillHeight = 20;

  let posX = x + 8 + offsetX;
  if (align === 'right') {
    posX = x + width - pillWidth - 12 + offsetX;
  } else if (align === 'center') {
    posX = x + (width - pillWidth) / 2 + offsetX;
  }

  const posY = y + offsetY;

  const renderIcon = () => {
    if (!icon) return null;
    const iconX = posX + 7;
    const iconY = posY + 4.5;
    if (icon === 'flame') {
      return (
        <path
          d="M5.5 9.5A1.8 1.8 0 0 0 7.3 7.7c0-1.1-.4-1.6-.8-2.4-.8-1.7-.2-3.2 1.6-4.8.4 2 1.6 3.9 3.2 5.2 1.6 1.3 2.4 2.8 2.4 4.4a5.6 5.6 0 1 1-11.2 0c0-.9.3-1.8.8-2.4a2 2 0 0 0 2.2 1.8z"
          fill="#e11d48"
          transform={`translate(${iconX}, ${iconY}) scale(0.68)`}
        />
      );
    }
    if (icon === 'sprout') {
      return (
        <g transform={`translate(${iconX}, ${iconY}) scale(0.65)`} stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16h8M6 16c0-3.3 1.2-5.5 2.5-6.7M4 7a3.3 3.3 0 0 1 3.3 3.3v.8A3.3 3.3 0 0 1 4 7.8V7zM12 4a3.3 3.3 0 0 0-3.3 3.3v.8A3.3 3.3 0 0 0 12 4.8V4z" />
        </g>
      );
    }
    if (icon === 'alert') {
      return (
        <g transform={`translate(${iconX}, ${iconY}) scale(0.65)`} stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="m8.5 1.5 7 12a1.5 1.5 0 0 1-1.3 2.3h-14a1.5 1.5 0 0 1-1.3-2.3l7-12a1.5 1.5 0 0 1 2.6 0z" />
          <path d="M8.5 6.5v3.5M8.5 13h.01" />
        </g>
      );
    }
    return null;
  };

  return (
    <g className="recharts-custom-badge pointer-events-none">
      <rect
        x={posX}
        y={posY}
        width={pillWidth}
        height={pillHeight}
        rx={6}
        ry={6}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={1}
        style={{ filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.08))' }}
      />
      {renderIcon()}
      <text
        x={hasIcon ? posX + 16 + (pillWidth - 16) / 2 : posX + pillWidth / 2}
        y={posY + 13.5}
        textAnchor="middle"
        fill={textColor}
        fontSize={10}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {text}
      </text>
    </g>
  );
};

export const StressTimeline: React.FC = () => {
  const { decision, isLoading } = useFieldStore();
  const series = decision.chart_series || [];
  const [viewMode, setViewMode] = useState<GraphViewMode>('split');

  const wp = decision.hydrology_summary?.wilting_point_pct ?? 9.0;
  const fc = decision.hydrology_summary?.field_capacity_pct ?? 20.0;

  // Dynamically position badges where curves do not cross:
  // If moisture drops below wp early (Sandy Loam), the left side has the crossing,
  // so Wilting Danger belongs on the RIGHT (where curves are flat/below wp).
  // If moisture stays high early (Clay), the left side is wide open, so Wilting Danger belongs on the LEFT.
  const wpCrossesEarly = wp <= 12 || series.findIndex((p) => p.baseline_moisture_pct <= wp) <= 2;
  const wpAlign: 'left' | 'right' = wpCrossesEarly ? 'right' : 'left';
  const fcAlign: 'center' | 'right' = wpAlign === 'right' ? 'center' : 'right';

  const renderSharedTooltip = (active?: boolean, payload?: readonly TooltipPayloadItem[], label?: string | number) => {
    if (active && payload && payload.length) {
      const dataPoint = series.find((p) => p.date === label) || (payload[0]?.payload as ChartDataPoint | undefined);
      const tempVal = dataPoint?.forecast_temp_c ?? payload.find((p) => p.dataKey === 'forecast_temp_c')?.value;
      const baselineVal = dataPoint?.baseline_moisture_pct ?? payload.find((p) => p.dataKey === 'baseline_moisture_pct')?.value;
      const protectedVal = dataPoint?.protected_moisture_pct ?? payload.find((p) => p.dataKey === 'protected_moisture_pct')?.value;

      const temp = typeof tempVal === 'number' ? tempVal : Number(tempVal ?? 0);
      const baseline = typeof baselineVal === 'number' ? baselineVal : Number(baselineVal ?? 0);
      const protectedM = typeof protectedVal === 'number' ? protectedVal : Number(protectedVal ?? 0);
      const isHeat = temp >= 38;
      const isBelowWp = protectedM < wp;

      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-2.5 rounded-xl shadow-xl text-xs space-y-1 z-50 min-w-[210px]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-bold text-slate-900">{label} Forecast</span>
            {isHeat && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-600" />
                <span>Heatwave Alert</span>
              </span>
            )}
          </div>
          <div className="text-rose-700 flex items-center justify-between gap-4 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Afternoon Peak Temp:</span>
            </span>
            <span className="font-bold font-mono text-rose-800">{temp}°C</span>
          </div>
          <div className="text-amber-700 flex items-center justify-between gap-4 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>Without Watering (Drying):</span>
            </span>
            <span className="font-bold font-mono text-amber-800">{baseline}%</span>
          </div>
          <div className="text-emerald-700 flex items-center justify-between gap-4 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>With Safe Watering:</span>
            </span>
            <span className="font-bold font-mono text-emerald-800">{protectedM}%</span>
          </div>
          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>Root Moisture Status:</span>
            <span className={isBelowWp ? 'text-rose-700 font-bold flex items-center gap-1' : 'text-emerald-700 font-bold flex items-center gap-1'}>
              {isBelowWp ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>Below Wilting Point</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Protected Buffer</span>
                </>
              )}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full p-1.5">
      <section className="h-full flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 select-none shadow-sm overflow-hidden">
        
        {/* Header, Mode Controls and Breach Status */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-1.5 shrink-0 gap-2">
          {/* Title & Integrated Status Indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 truncate">
                  7-Day Heat & Soil Water Forecast
                </span>
                {isLoading && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    <span>Recalculating</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Daily afternoon heatwave risk vs. root-zone water depletion
              </p>
            </div>
          </div>

          {/* View Mode Switcher - Sleek Segmented Control (Zero text wrap, spacious) */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-white text-emerald-900 font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Separated Temperature and Soil Moisture panels"
            >
              <SplitSquareVertical className="w-3.5 h-3.5 text-emerald-600" />
              <span>Split 2-Tier</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('combined')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'combined'
                  ? 'bg-white text-emerald-900 font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Overlay Temperature and Moisture on unified chart"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Combined</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('moisture')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'moisture'
                  ? 'bg-white text-cyan-900 font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Focus on Soil Moisture only"
            >
              <Droplets className="w-3.5 h-3.5 text-cyan-600" />
              <span>Moisture</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('temp')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'temp'
                  ? 'bg-white text-rose-900 font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Focus on Afternoon Heatwave only"
            >
              <Thermometer className="w-3.5 h-3.5 text-rose-600" />
              <span>Temp</span>
            </button>
          </div>
        </div>

        {/* 1. SPLIT 2-TIER VIEW: Clean separation of Temperature and Soil Moisture */}
        {viewMode === 'split' && (
          <div className="flex-1 w-full min-h-0 flex flex-col justify-between gap-1.5 pt-1">
            {/* Top Tier: Temperature & Heatwave Risk */}
            <div className="h-[46%] w-full min-h-[140px] flex flex-col bg-slate-50/60 rounded-xl border border-slate-200/80 p-1.5">
              <div className="flex items-center justify-between px-2 pt-0.5 text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1.5 text-rose-700">
                  <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                  <span>Afternoon Peak Temperature (°C)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Heatwave danger above 38°C</span>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 12, right: 24, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontWeight={600} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} dy={3} />
                    <YAxis
                      domain={[20, 48]}
                      ticks={[20, 30, 38, 48]}
                      stroke="#e11d48"
                      fontSize={10}
                      fontWeight={700}
                      tickFormatter={(v) => `${v}°C`}
                      tickLine={false}
                      axisLine={{ stroke: '#fca5a5' }}
                      width={38}
                    />
                    <ReferenceArea y1={38} y2={48} fill="#fee2e2" fillOpacity={0.4} />
                    <Tooltip content={({ active, payload, label }) => renderSharedTooltip(active, payload, label)} />
                    <Line
                      type="monotone"
                      dataKey="forecast_temp_c"
                      name="Afternoon Peak Temp"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5.5 }}
                    />
                    <ReferenceLine
                      y={38}
                      stroke="#e11d48"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={
                        <CustomReferenceBadge
                          text="38°C Heatwave Danger"
                          icon="flame"
                          textColor="#be123c"
                          bgColor="#ffffff"
                          borderColor="#fca5a5"
                          align="right"
                          offsetX={-12}
                        />
                      }
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Tier: Root-Zone Moisture & Depletion */}
            <div className="h-[52%] w-full min-h-[160px] flex flex-col bg-slate-50/60 rounded-xl border border-slate-200/80 p-1.5">
              <div className="flex items-center justify-between px-2 pt-0.5 text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1.5 text-cyan-800">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Root-Zone Soil Moisture (%)</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">Optimal holding zone: {wp}% – {fc}%</span>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 12, right: 24, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontWeight={600} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} dy={4} />
                    <YAxis
                      domain={[0, 45]}
                      ticks={[0, 10, 20, 30, 40]}
                      stroke="#0284c7"
                      fontSize={10}
                      fontWeight={700}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      axisLine={{ stroke: '#7dd3fc' }}
                      width={38}
                    />
                    {/* Safe Holding Zone Band */}
                    <ReferenceArea y1={wp} y2={fc} fill="#dcfce7" fillOpacity={0.4} />
                    <Tooltip content={({ active, payload, label }) => renderSharedTooltip(active, payload, label)} />
                    <Line
                      type="monotone"
                      dataKey="baseline_moisture_pct"
                      name="Without Watering"
                      stroke="#d97706"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#d97706', stroke: '#ffffff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="protected_moisture_pct"
                      name="With Safe Watering"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5.5, fill: '#22c55e' }}
                    />
                    <ReferenceLine
                      y={fc}
                      stroke="#16a34a"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={
                        <CustomReferenceBadge
                          text={`Field Capacity (${fc}%)`}
                          icon="sprout"
                          textColor="#15803d"
                          bgColor="#ffffff"
                          borderColor="#86efac"
                          align={fcAlign}
                          offsetX={fcAlign === 'right' ? -12 : 0}
                          offsetY={-21}
                        />
                      }
                    />
                    <ReferenceLine
                      y={wp}
                      stroke="#d97706"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={
                        <CustomReferenceBadge
                          text={`Wilting Danger (${wp}%)`}
                          icon="alert"
                          textColor="#b91c1c"
                          bgColor="#ffffff"
                          borderColor="#fca5a5"
                          align={wpAlign}
                          offsetX={wpAlign === 'right' ? -12 : 10}
                          offsetY={-21}
                        />
                      }
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 2. COMBINED OVERLAY VIEW: Unified dual-axis with zero text collision */}
        {viewMode === 'combined' && (
          <div className="flex-1 w-full min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 16, right: 30, bottom: 4, left: 14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} dy={6} />
                <YAxis
                  yAxisId="temp"
                  domain={[15, 45]}
                  ticks={[15, 25, 35, 45]}
                  stroke="#e11d48"
                  fontSize={11}
                  fontWeight={700}
                  tickFormatter={(v) => `${v}°C`}
                  tickLine={false}
                  axisLine={{ stroke: '#fca5a5' }}
                  width={44}
                />
                <YAxis
                  yAxisId="moisture"
                  orientation="right"
                  domain={[0, 45]}
                  ticks={[0, 15, 30, 45]}
                  stroke="#0284c7"
                  fontSize={11}
                  fontWeight={700}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={{ stroke: '#7dd3fc' }}
                  width={38}
                />
                {/* Subtle, non-intrusive heat danger shading */}
                <ReferenceArea yAxisId="temp" y1={38} y2={45} fill="#fee2e2" fillOpacity={0.25} />
                <Tooltip content={({ active, payload, label }) => renderSharedTooltip(active, payload, label)} />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="forecast_temp_c"
                  name="Afternoon Peak Temp"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="moisture"
                  type="monotone"
                  dataKey="baseline_moisture_pct"
                  name="Without Watering"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3.5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5 }}
                />
                <Line
                  yAxisId="moisture"
                  type="monotone"
                  dataKey="protected_moisture_pct"
                  name="With Safe Watering"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#22c55e' }}
                />
                <ReferenceLine
                  yAxisId="temp"
                  y={38}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text="38°C Heat Damage"
                      icon="flame"
                      textColor="#be123c"
                      bgColor="#ffffff"
                      borderColor="#fca5a5"
                      align="right"
                      offsetX={-12}
                      offsetY={-21}
                    />
                  }
                />
                <ReferenceLine
                  yAxisId="moisture"
                  y={fc}
                  stroke="#16a34a"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text={`Field Capacity (${fc}%)`}
                      icon="sprout"
                      textColor="#15803d"
                      bgColor="#ffffff"
                      borderColor="#86efac"
                      align="center"
                      offsetY={-21}
                    />
                  }
                />
                <ReferenceLine
                  yAxisId="moisture"
                  y={wp}
                  stroke="#d97706"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text={`Wilting Danger (${wp}%)`}
                      icon="alert"
                      textColor="#b91c1c"
                      bgColor="#ffffff"
                      borderColor="#fca5a5"
                      align={wpAlign}
                      offsetX={wpAlign === 'right' ? -12 : 10}
                      offsetY={-21}
                    />
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. MOISTURE ONLY FOCUS VIEW */}
        {viewMode === 'moisture' && (
          <div className="flex-1 w-full min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 16, right: 30, bottom: 4, left: 14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} dy={6} />
                <YAxis
                  domain={[0, 45]}
                  ticks={[0, 10, 20, 30, 40]}
                  stroke="#0284c7"
                  fontSize={11}
                  fontWeight={700}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={{ stroke: '#7dd3fc' }}
                  width={38}
                />
                <ReferenceArea y1={wp} y2={fc} fill="#dcfce7" fillOpacity={0.4} />
                <Tooltip content={({ active, payload, label }) => renderSharedTooltip(active, payload, label)} />
                <Line
                  type="monotone"
                  dataKey="baseline_moisture_pct"
                  name="Without Watering"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#d97706', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="protected_moisture_pct"
                  name="With Safe Watering"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={{ r: 4.5, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6.5, fill: '#22c55e' }}
                />
                <ReferenceLine
                  y={fc}
                  stroke="#16a34a"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text={`Field Capacity (${fc}%)`}
                      icon="sprout"
                      textColor="#15803d"
                      bgColor="#ffffff"
                      borderColor="#86efac"
                      align={fcAlign}
                      offsetX={fcAlign === 'right' ? -12 : 0}
                      offsetY={-21}
                    />
                  }
                />
                <ReferenceLine
                  y={wp}
                  stroke="#d97706"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text={`Wilting Point (${wp}%)`}
                      icon="alert"
                      textColor="#b91c1c"
                      bgColor="#ffffff"
                      borderColor="#fca5a5"
                      align={wpAlign}
                      offsetX={wpAlign === 'right' ? -12 : 10}
                      offsetY={-21}
                    />
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. TEMPERATURE ONLY FOCUS VIEW */}
        {viewMode === 'temp' && (
          <div className="flex-1 w-full min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 16, right: 30, bottom: 4, left: 14 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} dy={6} />
                <YAxis
                  domain={[20, 48]}
                  ticks={[20, 28, 38, 48]}
                  stroke="#e11d48"
                  fontSize={11}
                  fontWeight={700}
                  tickFormatter={(v) => `${v}°C`}
                  tickLine={false}
                  axisLine={{ stroke: '#fca5a5' }}
                  width={44}
                />
                <ReferenceArea y1={38} y2={48} fill="#fee2e2" fillOpacity={0.45} />
                <Tooltip content={({ active, payload, label }) => renderSharedTooltip(active, payload, label)} />
                <Area type="monotone" dataKey="forecast_temp_c" stroke="#e11d48" strokeWidth={2.5} fill="url(#tempGradient)" />
                <ReferenceLine
                  y={38}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={
                    <CustomReferenceBadge
                      text="38°C Crop Heat Damage Threshold"
                      icon="flame"
                      textColor="#be123c"
                      bgColor="#ffffff"
                      borderColor="#fca5a5"
                      align="right"
                      offsetX={-12}
                    />
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        <div className="pt-2 mt-1 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700 shrink-0 font-medium">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block shadow-2xs" />
              <span>Daily High Temp (°C)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-600 inline-block" />
              <span className="text-amber-800">Without Watering (Drying)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shadow-2xs" />
              <span className="text-emerald-800 font-bold">With Safe Watering</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-600" />
              <span>&gt;38°C Heat Danger</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
              <Sprout className="w-3 h-3 text-emerald-600" />
              <span>Safe Moisture Buffer</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
