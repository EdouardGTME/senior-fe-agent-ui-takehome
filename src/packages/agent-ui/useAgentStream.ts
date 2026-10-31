import { useState, useCallback, useRef } from 'react';
import {
  AgentMessage,
  ToolCallItem,
  PendingInterrupt,
  RunLifecycleStatus,
  ScenarioType,
  StreamErrorState,
} from './types';

interface UseAgentStreamOptions {
  threadId?: string;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const threadId = options.threadId || 'thread_default_01';

  const [status, setStatus] = useState<RunLifecycleStatus>('idle');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [interrupt, setInterrupt] = useState<PendingInterrupt | null>(null);
  const [error, setError] = useState<StreamErrorState | null>(null);
  const [heartbeatCount, setHeartbeatCount] = useState<number>(0);
  const [lastScenario, setLastScenario] = useState<ScenarioType>('standard');
  const [lastPrompt, setLastPrompt] = useState<string>('');

  // NOTE FOR CANDIDATE (TASK 1):
  // Inspect how AbortController, stream cancellation, and state updates on
  // `stream_heartbeat` and cursor reconnection are handled below.
  const abortControllerRef = useRef<AbortController | null>(null);

  const parseSseStream = async (
    response: Response,
    onEvent: (eventType: string, data: any) => void
  ) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onEvent(eventType, parsed);
          } catch {
            // Ignore malformed JSON frames
          }
        }
      }
    }
  };

  const handleServerEvent = useCallback((eventType: string, data: any) => {
    switch (eventType) {
      case 'run_started': {
        setActiveRunId(data.run_id);
        setStatus('streaming');
        break;
      }

      case 'message_delta': {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === data.message_id);
          if (exists) {
            return prev.map((m) =>
              m.id === data.message_id ? { ...m, content: m.content + data.delta } : m
            );
          }
          return [
            ...prev,
            { id: data.message_id, role: 'assistant', content: data.delta },
          ];
        });
        break;
      }

      case 'tool_call_start': {
        setToolCalls((prev) => {
          const existing = prev.find((t) => t.toolCallId === data.tool_call_id);
          if (existing) {
            return prev.map((t) =>
              t.toolCallId === data.tool_call_id
                ? { ...t, args: data.args, status: 'running' }
                : t
            );
          }
          return [
            ...prev,
            {
              toolCallId: data.tool_call_id,
              toolName: data.tool_name,
              args: data.args || {},
              status: 'running',
            },
          ];
        });
        break;
      }

      case 'tool_call_progress': {
        setToolCalls((prev) =>
          prev.map((t) =>
            t.toolCallId === data.tool_call_id
              ? {
                  ...t,
                  step: data.step,
                  totalSteps: data.total_steps,
                  statusText: data.status_text,
                }
              : t
          )
        );
        break;
      }

      case 'tool_call_result': {
        setToolCalls((prev) =>
          prev.map((t) =>
            t.toolCallId === data.tool_call_id
              ? {
                  ...t,
                  status: 'completed',
                  durationMs: data.duration_ms,
                  result: data.result,
                }
              : t
          )
        );
        break;
      }

      case 'langgraph_interrupt': {
        setStatus('awaiting_approval');
        setInterrupt({
          runId: data.run_id,
          interruptId: data.interrupt_id,
          toolCallId: data.tool_call_id,
          toolName: data.tool_name,
          riskLevel: data.risk_level || 'high',
          description: data.description,
          proposedArgs: data.proposed_args || {},
          status: 'pending',
        });
        break;
      }

      case 'stream_heartbeat': {
        // BUG TRAP #1:
        // On every heartbeat tick, we increment heartbeatCount AND accidentally
        // clone/re-assign the `interrupt` object with a new synthetic reference,
        // which causes naive child consumers to reset their local form state!
        setHeartbeatCount(data.heartbeat_seq || 0);
        setInterrupt((prev) =>
          prev
            ? {
                ...prev,
                // BUG: Mutating interruptId on heartbeat breaks component identity!
                interruptId: `${prev.interruptId}_hb_${data.heartbeat_seq}`,
              }
            : null
        );
        break;
      }

      case 'run_error': {
        setStatus('error');
        setError({
          code: data.code || 'UNKNOWN_ERROR',
          message: data.message || 'Stream interrupted unexpectedly.',
          recoverable: Boolean(data.recoverable),
          lastEventId: data.last_event_id,
        });
        break;
      }

      case 'run_completed': {
        setStatus('completed');
        break;
      }
    }
  }, []);

  const startRun = useCallback(
    async (scenario: ScenarioType, prompt: string, resumeFromEventId?: number) => {
      setLastScenario(scenario);
      setLastPrompt(prompt);
      setError(null);

      // If starting a fresh run (not reconnecting from cursor), reset state
      if (resumeFromEventId === undefined) {
        setMessages([{ id: `user_${Date.now()}`, role: 'user', content: prompt }]);
        setToolCalls([]);
        setInterrupt(null);
        setHeartbeatCount(0);
      }

      setStatus('streaming');

      try {
        const response = await fetch('/api/runs/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            thread_id: threadId,
            scenario,
            prompt,
            last_event_id: resumeFromEventId ?? null,
          }),
          // BUG TRAP #2:
          // Notice that `abortControllerRef.current` is never created or passed as `signal`!
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        await parseSseStream(response, handleServerEvent);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        setStatus('error');
        setError({
          code: 'NETWORK_FAILURE',
          message: err?.message || 'Failed to connect to agent stream.',
          recoverable: true,
        });
      }
    },
    [handleServerEvent, threadId]
  );

  const cancelRun = useCallback(() => {
    // BUG TRAP #2:
    // This sets status to 'cancelled', but does NOT abort the active fetch stream!
    // Tokens from the still-open response will continue arriving and mutating state.
    setStatus('cancelled');
  }, []);

  const reconnectRun = useCallback(async () => {
    if (!error?.lastEventId) {
      await startRun(lastScenario, lastPrompt);
      return;
    }
    await startRun(lastScenario, lastPrompt, error.lastEventId);
  }, [error, lastPrompt, lastScenario, startRun]);

  const submitInterruptDecision = useCallback(
    async (
      action: 'approve' | 'edit' | 'reject',
      editedArgs?: Record<string, unknown>,
      reason?: string
    ) => {
      if (!interrupt || !activeRunId) return;

      setStatus('resuming');
      setInterrupt((prev) => (prev ? { ...prev, status: 'submitting' } : null));

      try {
        const response = await fetch(`/api/runs/${activeRunId}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interrupt_id: interrupt.interruptId,
            action,
            edited_args: editedArgs,
            reason,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resume failed with status ${response.status}`);
        }

        setInterrupt((prev) =>
          prev
            ? {
                ...prev,
                status: 'resolved',
                resolution: { action, appliedArgs: editedArgs, reason },
              }
            : null
        );

        await parseSseStream(response, handleServerEvent);
      } catch (err: any) {
        setStatus('error');
        setError({
          code: 'RESUME_FAILED',
          message: err?.message || 'Failed to submit approval decision.',
          recoverable: true,
        });
      }
    },
    [activeRunId, handleServerEvent, interrupt]
  );

  return {
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
  };
}
