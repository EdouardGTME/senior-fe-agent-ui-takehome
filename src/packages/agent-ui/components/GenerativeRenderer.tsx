import React from 'react';
import { AnalyticsReportPayload } from '../types';
import { AnalyticsTable } from '../../../app/analytics-copilot/widgets/AnalyticsTable';
import { MetricBarChart } from '../../../app/analytics-copilot/widgets/MetricBarChart';

interface GenerativeRendererProps {
  payload: unknown;
}

/**
 * TASK 2: Controlled Generative UI Registry & Non-Deterministic Fallback
 *
 * Current Problem:
 * Below, the starter code blindly casts `payload as AnalyticsReportPayload` without
 * runtime schema validation (e.g. Zod) or an Error Boundary.
 * When you run the `malformed` scenario, the LLM returns corrupt types (null title,
 * string summary, string inside `rows`), which crashes the entire React application!
 *
 * Your Goal:
 * 1. Create a clean component registry pattern and validate incoming payloads at runtime (e.g., with `zod`).
 * 2. If validation fails—or if a child visualization throws—render a truthful, user-friendly
 *    "Malformed / Partial Agent Output" fallback card with a collapsible "Inspect Raw Payload" viewer.
 */
export const GenerativeRenderer: React.FC<GenerativeRendererProps> = ({ payload }) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, any>;

  if (record.type === 'analytics_report') {
    // UNSAFE CAST: This crashes on Scenario `malformed`!
    const report = record as AnalyticsReportPayload;

    return (
      <div className="space-y-4" data-testid="generative-analytics-report">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-100">{report.title.toUpperCase()}</h4>
          <span className="text-xs text-slate-400">
            Total Spend: €{report.summary.total_spend.toLocaleString()} • Blended ROAS:{' '}
            {report.summary.blended_roas}x
          </span>
        </div>

        <MetricBarChart rows={report.rows} currency={report.currency} />
        <AnalyticsTable rows={report.rows} currency={report.currency} />
      </div>
    );
  }

  return (
    <pre className="rounded-lg bg-slate-950 p-3 text-xs font-mono text-slate-300 overflow-x-auto">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
};
