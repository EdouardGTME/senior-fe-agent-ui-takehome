import React, { useState } from 'react';
import { Play, Square, RotateCcw, Sparkles, Activity, AlertCircle } from 'lucide-react';
import { ScenarioType } from '../../packages/agent-ui/types';
import { useAgentStream } from '../../packages/agent-ui/useAgentStream';
import { ToolCallCard } from '../../packages/agent-ui/components/ToolCallCard';
import { ToolInterruptCard } from '../../packages/agent-ui/components/ToolInterruptCard';

const SCENARIOS: {
  id: ScenarioType;
  label: string;
  badge: string;
  defaultPrompt: string;
  description: string;
}[] = [
  {
    id: 'standard',
    label: '1. Standard (GenUI + Multi-Step Tool)',
    badge: 'Happy Path',
    defaultPrompt: 'Analyze Q3 2026 European regional campaign performance and show ROAS.',
    description: 'Streams tokens, runs a 3-step Snowflake tool call, and renders an analytics report.',
  },
  {
    id: 'approval',
    label: '2. LangGraph HITL Interrupt',
    badge: 'Task 1',
    defaultPrompt: 'Reallocate Q4 DACH search budget cap from €45k to €75k.',
    description: 'Pauses on a high-risk tool call and waits for a human decision.',
  },
  {
    id: 'chaos',
    label: '3. Chaos Stream (Stall + Drop)',
    badge: 'Task 1',
    defaultPrompt: 'Run 48-hour real-time attribution anomaly audit across Kafka partitions.',
    description: 'Simulates a slow tool step followed by a mid-stream connection drop.',
  },
  {
    id: 'malformed',
    label: '4. Malformed LLM Output',
    badge: 'Task 2',
    defaultPrompt: 'Generate experimental Q3 regional anomaly table.',
    description: 'Emits corrupted schema types inside tool_call_result to test Generative UI safety.',
  },
];

export const AnalyticsWorkspace: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('standard');
  const [promptInput, setPromptInput] = useState<string>(SCENARIOS[0].defaultPrompt);

  const {
    status,
    activeRunId,
    messages,
    toolCalls,
    interrupt,
    error,
    heartbeatCount,
    startRun,
    cancelRun,
    reconnectRun,
    submitInterruptDecision,
  } = useAgentStream({ threadId: 'thread_eu_analytics_01' });

  const handleScenarioChange = (scenario: ScenarioType) => {
    setSelectedScenario(scenario);
    const found = SCENARIOS.find((s) => s.id === scenario);
    if (found) setPromptInput(found.defaultPrompt);
  };

  const isBusy =
    status === 'streaming' || status === 'resuming' || status === 'awaiting_approval';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                Serviceplan Agent-UI Workbench
              </h1>
              <p className="text-xs text-slate-400">
                Shared React/TypeScript Agent Layer • Consuming App: Marketing Analytics Copilot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-slate-300">
              Status: <strong className="text-indigo-400 uppercase">{status}</strong>
            </span>
            {heartbeatCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-slate-400"
                data-testid="heartbeat-counter"
              >
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                HB #{heartbeatCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        {/* Scenario Picker */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((scen) => {
            const active = selectedScenario === scen.id;
            return (
              <button
                key={scen.id}
                type="button"
                onClick={() => handleScenarioChange(scen.id)}
                className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? 'border-indigo-500 bg-indigo-950/30 shadow-sm'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{scen.label}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    {scen.description}
                  </p>
                </div>
                <div className="mt-3">
                  <span className="inline-block rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
                    {scen.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {/* Prompt Bar */}
        <section className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            className="flex-1 bg-transparent px-2 text-sm text-slate-100 focus:outline-none"
            placeholder="Ask the analytics agent..."
          />

          {isBusy ? (
            <button
              type="button"
              data-testid="cancel-run-btn"
              onClick={cancelRun}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Cancel Stream
            </button>
          ) : (
            <button
              type="button"
              data-testid="start-run-btn"
              onClick={() => startRun(selectedScenario, promptInput)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Run Scenario
            </button>
          )}
        </section>

        {/* Agent Conversation & Tool Stream */}
        <section className="flex-1 space-y-4 rounded-2xl border border-slate-800/90 bg-slate-900/30 p-5">
          {messages.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              Select a scenario above and click <strong>Run Scenario</strong> to test the agent stream.
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto max-w-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-100'
                  : 'mr-auto max-w-3xl bg-slate-900 border border-slate-800 text-slate-200'
              }`}
              data-testid={`message-${m.role}`}
            >
              <div className="mb-1 text-[11px] font-mono uppercase text-slate-400">
                {m.role === 'user' ? 'You' : `Agent (${activeRunId || 'run'})`}
              </div>
              <div>{m.content}</div>
            </div>
          ))}

          {/* Tool Calls */}
          {toolCalls.map((tc) => (
            <ToolCallCard key={tc.toolCallId} toolCall={tc} />
          ))}

          {/* Human-in-the-loop Interrupt Card */}
          {interrupt && (
            <ToolInterruptCard
              key={interrupt.interruptId}
              interrupt={interrupt}
              onDecision={submitInterruptDecision}
            />
          )}

          {/* Stream Error / Recovery Banner */}
          {error && (
            <div
              className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200"
              data-testid="stream-error-banner"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Stream Interrupted ({error.code})
                  </div>
                  <div className="text-rose-300/90 mt-0.5">{error.message}</div>
                </div>
              </div>

              {error.recoverable && (
                <button
                  type="button"
                  data-testid="reconnect-btn"
                  onClick={reconnectRun}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-rose-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reconnect from Cursor
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
