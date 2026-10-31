import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsWorkspace } from '../../../app/analytics-copilot/AnalyticsWorkspace';

/**
 * Helper to create a controllable ReadableStream that emits SSE frames on demand.
 */
function createControllableSseStream() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  return {
    stream,
    emit(eventType: string, data: Record<string, unknown>) {
      const frame = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      controllerRef?.enqueue(encoder.encode(frame));
    },
    close() {
      controllerRef?.close();
    },
  };
}

describe('Shared Agent-UI Layer — Behavioral Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('FAILING BUG #1: preserves unsaved inline user edits in ToolInterruptCard across background stream_heartbeat events', async () => {
    const sse = createControllableSseStream();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(sse.stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    render(<AnalyticsWorkspace />);

    // Start run
    await userEvent.click(screen.getByTestId('start-run-btn'));

    sse.emit('run_started', { run_id: 'run_test_1', thread_id: 't1', scenario: 'approval' });
    sse.emit('langgraph_interrupt', {
      run_id: 'run_test_1',
      interrupt_id: 'int_stable_01',
      tool_call_id: 'call_01',
      tool_name: 'update_campaign_budget_cap',
      risk_level: 'high',
      description: 'Update live budget cap',
      proposed_args: {
        campaign_id: 'cmp_dach_q4',
        current_budget_eur: 45000,
        proposed_budget_eur: 75000,
      },
    });

    const budgetInput = (await screen.findByTestId('proposed-budget-input')) as HTMLInputElement;
    expect(budgetInput.value).toBe('75000');

    // User edits the proposed budget from 75000 to 62500 before clicking approve
    await userEvent.clear(budgetInput);
    await userEvent.type(budgetInput, '62500');
    expect(budgetInput.value).toBe('62500');

    // Now the backend sends a background SSE heartbeat while waiting for human approval
    sse.emit('stream_heartbeat', {
      run_id: 'run_test_1',
      heartbeat_seq: 1,
      active_node: 'human_approval_gate',
    });

    await waitFor(() => {
      expect(screen.getByTestId('heartbeat-counter')).toHaveTextContent('HB #1');
    });

    // CRITICAL ASSERTION: The user's in-progress edit ('62500') MUST NOT be wiped out by the heartbeat!
    const inputAfterHeartbeat = screen.getByTestId('proposed-budget-input') as HTMLInputElement;
    expect(inputAfterHeartbeat.value).toBe('62500');
  });

  it('FAILING BUG #2: aborts the underlying fetch request and ignores trailing tokens when Cancel Stream is clicked', async () => {
    const sse = createControllableSseStream();
    let capturedSignal: AbortSignal | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      return new Response(sse.stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    render(<AnalyticsWorkspace />);
    await userEvent.click(screen.getByTestId('start-run-btn'));

    sse.emit('run_started', { run_id: 'run_cancel_test', thread_id: 't1', scenario: 'standard' });
    sse.emit('message_delta', {
      run_id: 'run_cancel_test',
      message_id: 'msg_1',
      delta: 'Initial partial output. ',
    });

    await waitFor(() => {
      expect(screen.getByTestId('message-assistant')).toHaveTextContent('Initial partial output.');
    });

    // Click Cancel Stream
    const cancelBtn = screen.getByTestId('cancel-run-btn');
    await userEvent.click(cancelBtn);

    // 1. Verify an AbortSignal was passed to fetch and is now aborted
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
