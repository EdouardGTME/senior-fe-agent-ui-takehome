import React, { useState } from 'react';
import { ShieldAlert, Check, Edit3, XCircle } from 'lucide-react';
import { PendingInterrupt } from '../types';

interface ToolInterruptCardProps {
  interrupt: PendingInterrupt;
  onDecision: (
    action: 'approve' | 'edit' | 'reject',
    editedArgs?: Record<string, unknown>,
    reason?: string
  ) => void;
}

/**
 * TASK 1: Human-in-the-Loop Interrupt Card
 *
 * Requirements to complete / fix:
 * 1. Inline edits made by the user (e.g. changing `proposed_budget_eur`) must survive while the run is paused.
 * 2. Prevent accidental double-submissions while `interrupt.status === 'submitting'`.
 * 3. Support "Approve", "Edit & Approve" (with validation), and "Reject" (with optional reason note),
 *    and show a clear audit summary once resolved.
 */
export const ToolInterruptCard: React.FC<ToolInterruptCardProps> = ({
  interrupt,
  onDecision,
}) => {
  const [budgetDraft, setBudgetDraft] = useState<string>(
    String(interrupt.proposedArgs.proposed_budget_eur ?? '')
  );
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const isSubmitting = interrupt.status === 'submitting';
  const isResolved = interrupt.status === 'resolved';

  const handleApproveOrEdit = () => {
    const numericBudget = Number(budgetDraft);
    const hasModifiedBudget =
      numericBudget !== Number(interrupt.proposedArgs.proposed_budget_eur);

    if (isEditing || hasModifiedBudget) {
      onDecision('edit', {
        ...interrupt.proposedArgs,
        proposed_budget_eur: numericBudget,
      });
    } else {
      onDecision('approve');
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 shadow-md"
      data-testid="tool-interrupt-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-amber-200">
                Human Approval Required: <span className="font-mono">{interrupt.toolName}</span>
              </h3>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-300">
                {interrupt.riskLevel} risk
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{interrupt.description}</p>
          </div>
        </div>
      </div>

      {/* Parameter Editor */}
      <div className="mt-3 rounded-lg bg-slate-950/80 p-3 border border-slate-800 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Campaign ID:</span>{' '}
            <span className="font-mono text-slate-200">
              {String(interrupt.proposedArgs.campaign_id ?? '')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Current Cap:</span>{' '}
            <span className="font-mono text-slate-200">
              €{String(interrupt.proposedArgs.current_budget_eur ?? '')}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <label
            htmlFor="proposed-budget-input"
            className="text-xs font-medium text-slate-200"
          >
            Proposed Budget Cap (€):
          </label>
          <input
            id="proposed-budget-input"
            data-testid="proposed-budget-input"
            type="number"
            disabled={isResolved}
            value={budgetDraft}
            onChange={(e) => {
              setIsEditing(true);
              setBudgetDraft(e.target.value);
            }}
            className="w-36 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-100 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <label
            htmlFor="reject-reason-input"
            className="text-xs font-medium text-slate-400"
          >
            Rejection / Audit Note (optional):
          </label>
          <input
            id="reject-reason-input"
            data-testid="reject-reason-input"
            type="text"
            placeholder="Reason if rejecting..."
            disabled={isResolved}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      {!isResolved ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="interrupt-reject-btn"
            onClick={() => onDecision('reject', undefined, rejectReason)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject Action
          </button>

          <button
            type="button"
            data-testid="interrupt-approve-btn"
            onClick={handleApproveOrEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            {isEditing ? <Edit3 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {isSubmitting
              ? 'Submitting...'
              : isEditing
              ? 'Approve with Edits'
              : 'Approve & Execute'}
          </button>
        </div>
      ) : (
        <div
          className="mt-3 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-slate-300 border border-slate-800"
          data-testid="interrupt-resolution-banner"
        >
          Decision recorded:{' '}
          <span className="font-semibold uppercase text-amber-300">
            {interrupt.resolution?.action}
          </span>
        </div>
      )}
    </div>
  );
};
