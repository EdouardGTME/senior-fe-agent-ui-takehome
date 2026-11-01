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
      try {
        controllerRef?.enqueue(encoder.encode(frame));
      } catch {
        // The consumer already cancelled this stream.
      }
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

  it('keeps unsaved edits in ToolInterruptCard while the run waits for approval', async () => {
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

    const inputAfterHeartbeat = screen.getByTestId('proposed-budget-input') as HTMLInputElement;
    expect(inputAfterHeartbeat.value).toBe('62500');
  });

  it('does not show output from a cancelled run, even after a new run has started', async () => {
    const oldSse = createControllableSseStream();
    const newSse = createControllableSseStream();
    const streams = [oldSse, newSse];
    let call = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const sse = streams[call++];
      return new Response(sse.stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    render(<AnalyticsWorkspace />);
    await userEvent.click(screen.getByTestId('start-run-btn'));

    oldSse.emit('run_started', { run_id: 'run_old', thread_id: 't1', scenario: 'standard' });
    oldSse.emit('message_delta', {
      run_id: 'run_old',
      message_id: 'msg_old_1',
      delta: 'Old run output. ',
    });

    await waitFor(() => {
      expect(screen.getByText(/Old run output\./)).toBeInTheDocument();
    });

    // Cancel, then immediately start a second run
    await userEvent.click(screen.getByTestId('cancel-run-btn'));
    await userEvent.click(await screen.findByTestId('start-run-btn'));

    newSse.emit('run_started', { run_id: 'run_new', thread_id: 't1', scenario: 'standard' });
    newSse.emit('message_delta', {
      run_id: 'run_new',
      message_id: 'msg_new_1',
      delta: 'New run output.',
    });

    // The cancelled run keeps sending after the new run has begun
    oldSse.emit('message_delta', {
      run_id: 'run_old',
      message_id: 'msg_old_2',
      delta: 'STALE TOKEN FROM CANCELLED RUN',
    });

    await waitFor(() => {
      expect(screen.getByText(/New run output\./)).toBeInTheDocument();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByText(/STALE TOKEN FROM CANCELLED RUN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Old run output\./)).not.toBeInTheDocument();
  });
});
