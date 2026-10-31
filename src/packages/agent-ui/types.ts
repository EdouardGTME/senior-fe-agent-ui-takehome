export type ScenarioType = 'standard' | 'approval' | 'chaos' | 'malformed';

export type RunLifecycleStatus =
  | 'idle'
  | 'streaming'
  | 'awaiting_approval'
  | 'resuming'
  | 'error'
  | 'cancelled'
  | 'completed';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallItem {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  step?: number;
  totalSteps?: number;
  statusText?: string;
  durationMs?: number;
  result?: unknown;
}

export interface PendingInterrupt {
  runId: string;
  interruptId: string;
  toolCallId: string;
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  proposedArgs: Record<string, unknown>;
  status: 'pending' | 'submitting' | 'resolved';
  resolution?: {
    action: 'approve' | 'edit' | 'reject';
    appliedArgs?: Record<string, unknown>;
    reason?: string;
  };
}

export interface StreamErrorState {
  code: string;
  message: string;
  recoverable: boolean;
  lastEventId?: number;
}

export interface AnalyticsRow {
  region: string;
  spend: number;
  conversions: number;
  roas: number;
}

export interface AnalyticsReportPayload {
  type: 'analytics_report';
  title: string;
  currency: string;
  summary: {
    total_spend: number;
    blended_roas: number;
  };
  rows: AnalyticsRow[];
}
