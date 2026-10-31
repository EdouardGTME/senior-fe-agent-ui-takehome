import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { ToolCallItem } from '../types';
import { GenerativeRenderer } from './GenerativeRenderer';

interface ToolCallCardProps {
  toolCall: ToolCallItem;
}

/**
 * Reference Component:
 * Use the visual language, spacing, and status patterns in this card as your
 * reference when extrapolating the design of `<ToolInterruptCard />` and `<GenerativeRenderer />`.
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const isRunning = toolCall.status === 'running';
  const isCompleted = toolCall.status === 'completed';

  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition-all"
      data-testid={`tool-card-${toolCall.toolCallId}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-100">
                {toolCall.toolName}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isRunning
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
                {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                {toolCall.status === 'failed' && <AlertTriangle className="h-3 w-3" />}
                {toolCall.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Input: <code className="text-slate-300">{JSON.stringify(toolCall.args)}</code>
            </p>
          </div>
        </div>

        {toolCall.durationMs !== undefined && (
          <span className="font-mono text-xs text-slate-400">
            {(toolCall.durationMs / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {/* Live Multi-Step Progress Bar */}
      {isRunning && toolCall.statusText && (
        <div className="mt-3 rounded-lg bg-slate-950/70 p-2.5 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>{toolCall.statusText}</span>
            {toolCall.step && toolCall.totalSteps && (
              <span className="font-mono text-indigo-400">
                Step {toolCall.step}/{toolCall.totalSteps}
              </span>
            )}
          </div>
          {toolCall.step && toolCall.totalSteps && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(toolCall.step / toolCall.totalSteps) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Generative UI or Structured Tool Output */}
      {isCompleted && toolCall.result !== undefined && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <GenerativeRenderer payload={toolCall.result} />
        </div>
      )}
    </div>
  );
};
