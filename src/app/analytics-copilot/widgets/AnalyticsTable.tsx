import React from 'react';
import { AnalyticsRow } from '../../../packages/agent-ui/types';

interface AnalyticsTableProps {
  rows: AnalyticsRow[];
  currency: string;
}

export const AnalyticsTable: React.FC<AnalyticsTableProps> = ({ rows, currency }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-950/90 text-slate-400 uppercase">
          <tr>
            <th className="px-3 py-2">Region</th>
            <th className="px-3 py-2 text-right">Spend ({currency})</th>
            <th className="px-3 py-2 text-right">Conversions</th>
            <th className="px-3 py-2 text-right">ROAS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70 bg-slate-900/40">
          {rows.map((row) => (
            <tr key={row.region} className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-medium text-slate-200">{row.region}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-300">
                €{row.spend.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-300">
                {row.conversions.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">
                {row.roas.toFixed(2)}x
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
