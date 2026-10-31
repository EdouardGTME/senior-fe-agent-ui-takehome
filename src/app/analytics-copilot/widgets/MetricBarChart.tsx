import React from 'react';
import { AnalyticsRow } from '../../../packages/agent-ui/types';

interface MetricBarChartProps {
  rows: AnalyticsRow[];
  currency: string;
}

export const MetricBarChart: React.FC<MetricBarChartProps> = ({ rows }) => {
  const maxRoas = Math.max(...rows.map((r) => r.roas), 4.0);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        ROAS Efficiency by Region
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const widthPct = Math.min(100, Math.round((row.roas / maxRoas) * 100));
          return (
            <div key={row.region} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-200">{row.region}</span>
                <span className="font-mono text-indigo-400">{row.roas.toFixed(1)}x</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
