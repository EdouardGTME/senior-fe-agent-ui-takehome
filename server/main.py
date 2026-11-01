import asyncio
import json
import uuid
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Serviceplan Mock LangGraph Agent SSE Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state for paused runs and chaos-run progress.
PAUSED_RUNS: Dict[str, Dict[str, Any]] = {}
CHAOS_RUN_PROGRESS: Dict[str, int] = {}


class StreamRequest(BaseModel):
    thread_id: str
    scenario: str = "standard"  # "standard" | "approval" | "chaos" | "malformed"
    prompt: str
    last_event_id: Optional[int] = None


class ResumeRequest(BaseModel):
    interrupt_id: str
    action: str  # "approve" | "edit" | "reject"
    edited_args: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


def sse_event(event_type: str, data: Dict[str, Any], event_id: Optional[int] = None) -> str:
    payload = {**data, "event_id": event_id} if event_id is not None else data
    id_line = f"id: {event_id}\n" if event_id is not None else ""
    return f"{id_line}event: {event_type}\ndata: {json.dumps(payload)}\n\n"


@app.post("/api/runs/stream")
async def stream_run(req: StreamRequest):
    run_id = f"run_{ req.thread_id[-6:] if len(req.thread_id) >= 6 else uuid.uuid4().hex[:6] }"
    msg_id = f"msg_{run_id}_1"
    call_id = f"call_{run_id}_1"
    interrupt_id = f"int_{run_id}_1"

    async def event_generator():
        seq = 1
        start_after = req.last_event_id or 0

        if start_after == 0:
            yield sse_event("run_started", {
                "run_id": run_id,
                "thread_id": req.thread_id,
                "scenario": req.scenario
            }, seq)
        seq += 1
        await asyncio.sleep(0.15)

        # =====================================================================
        # SCENARIO 1: STANDARD (Happy Path Streaming + Multi-Step Tool + GenUI)
        # =====================================================================
        if req.scenario == "standard":
            intro_words = (
                "I will query the Q3 European campaign performance warehouse "
                "and compile a regional ROAS breakdown for you."
            ).split(" ")

            for i, word in enumerate(intro_words):
                if seq > start_after:
                    token = word + (" " if i < len(intro_words) - 1 else "")
                    yield sse_event("message_delta", {
                        "run_id": run_id,
                        "message_id": msg_id,
                        "delta": token
                    }, seq)
                    await asyncio.sleep(0.035)
                seq += 1

            if seq > start_after:
                yield sse_event("tool_call_start", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "tool_name": "query_campaign_analytics",
                    "args": {"quarter": "Q3-2026", "regions": ["DACH", "UK", "FR", "NORDICS"]}
                }, seq)
            seq += 1
            await asyncio.sleep(0.4)

            steps = [
                (1, 3, "Authenticating against AWS Bedrock & Snowflake partition..."),
                (2, 3, "Aggregating spend, conversions, and blended ROAS across 4 regions..."),
                (3, 3, "Validating output schema for generative analytics view...")
            ]
            for step_num, total_steps, label in steps:
                if seq > start_after:
                    yield sse_event("tool_call_progress", {
                        "run_id": run_id,
                        "tool_call_id": call_id,
                        "step": step_num,
                        "total_steps": total_steps,
                        "status_text": label
                    }, seq)
                    await asyncio.sleep(0.55)
                seq += 1

            if seq > start_after:
                yield sse_event("tool_call_result", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "duration_ms": 1680,
                    "result": {
                        "type": "analytics_report",
                        "title": "Q3 2026 European Regional Performance",
                        "currency": "EUR",
                        "summary": {"total_spend": 425000, "blended_roas": 3.42},
                        "rows": [
                            {"region": "DACH", "spend": 180000, "conversions": 4120, "roas": 3.8},
                            {"region": "UK", "spend": 115000, "conversions": 2310, "roas": 3.1},
                            {"region": "FR", "spend": 85000, "conversions": 1890, "roas": 3.3},
                            {"region": "NORDICS", "spend": 45000, "conversions": 980, "roas": 2.9}
                        ]
                    }
                }, seq)
            seq += 1
            await asyncio.sleep(0.25)

            msg_id_2 = f"msg_{run_id}_2"
            outro_words = (
                "DACH led Q3 performance with a 3.8x ROAS on €180,000 spend. "
                "Would you like me to reallocate Q4 budget caps toward DACH channels?"
            ).split(" ")
            for i, word in enumerate(outro_words):
                if seq > start_after:
                    token = word + (" " if i < len(outro_words) - 1 else "")
                    yield sse_event("message_delta", {
                        "run_id": run_id,
                        "message_id": msg_id_2,
                        "delta": token
                    }, seq)
                    await asyncio.sleep(0.03)
                seq += 1

            yield sse_event("run_completed", {"run_id": run_id, "status": "success"}, seq)

        # =====================================================================
        # SCENARIO 2: APPROVAL (LangGraph Interrupt)
        # =====================================================================
        elif req.scenario == "approval":
            words = (
                "I have prepared the Q4 live budget reallocation. Because this action "
                "modifies production spend caps above €25,000, human approval is required before execution."
            ).split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield sse_event("message_delta", {
                    "run_id": run_id,
                    "message_id": msg_id,
                    "delta": token
                }, seq)
                seq += 1
                await asyncio.sleep(0.03)

            proposed_args = {
                "campaign_id": "cmp_dach_q4_search",
                "channel": "Google Ads DACH",
                "current_budget_eur": 45000,
                "proposed_budget_eur": 75000,
                "effective_date": "2026-11-01"
            }

            PAUSED_RUNS[run_id] = {
                "run_id": run_id,
                "thread_id": req.thread_id,
                "interrupt_id": interrupt_id,
                "tool_call_id": call_id,
                "tool_name": "update_campaign_budget_cap",
                "proposed_args": proposed_args
            }

            yield sse_event("langgraph_interrupt", {
                "run_id": run_id,
                "interrupt_id": interrupt_id,
                "tool_call_id": call_id,
                "tool_name": "update_campaign_budget_cap",
                "risk_level": "high",
                "description": "Modify live production budget cap in Google Ads & Meta APIs.",
                "proposed_args": proposed_args
            }, seq)
            seq += 1

            # Keep the connection alive while waiting for the decision.
            for hb in range(1, 15):
                await asyncio.sleep(2.0)
                if run_id not in PAUSED_RUNS:
                    break
                yield sse_event("stream_heartbeat", {
                    "run_id": run_id,
                    "heartbeat_seq": hb,
                    "active_node": "human_approval_gate"
                }, seq)
                seq += 1

        # =====================================================================
        # SCENARIO 3: CHAOS
        # =====================================================================
        elif req.scenario == "chaos":
            intro_words = (
                "Connecting to real-time attribution stream to audit cross-channel anomalies..."
            ).split(" ")

            for i, word in enumerate(intro_words):
                if seq > start_after:
                    token = word + (" " if i < len(intro_words) - 1 else "")
                    yield sse_event("message_delta", {
                        "run_id": run_id,
                        "message_id": msg_id,
                        "delta": token
                    }, seq)
                    await asyncio.sleep(0.04)
                seq += 1

            if seq > start_after:
                yield sse_event("tool_call_start", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "tool_name": "audit_realtime_attribution",
                    "args": {"window_hours": 48, "include_raw_logs": True}
                }, seq)
            seq += 1

            if seq > start_after:
                yield sse_event("tool_call_progress", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "step": 1,
                    "total_steps": 3,
                    "status_text": "Scanning Kafka attribution partitions (long-running step)..."
                }, seq)
                # Simulated slow backend step
                await asyncio.sleep(2.5)
            seq += 1

            # First connection: drop the stream here.
            if req.last_event_id is None:
                yield sse_event("run_error", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "code": "STREAM_INTERRUPTED_RETRYABLE",
                    "message": "AWS Bedrock / SSE upstream connection dropped mid-step after event #" + str(seq - 1),
                    "recoverable": True,
                    "last_event_id": seq - 1
                }, seq)
                return

            # Reconnection: continue from here.
            if seq > start_after:
                yield sse_event("tool_call_progress", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "step": 2,
                    "total_steps": 3,
                    "status_text": "Reconnected from cursor! Resuming partition 2/3 aggregation..."
                }, seq)
                await asyncio.sleep(0.6)
            seq += 1

            if seq > start_after:
                yield sse_event("tool_call_progress", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "step": 3,
                    "total_steps": 3,
                    "status_text": "Finalizing anomaly report..."
                }, seq)
                await asyncio.sleep(0.5)
            seq += 1

            if seq > start_after:
                yield sse_event("tool_call_result", {
                    "run_id": run_id,
                    "tool_call_id": call_id,
                    "duration_ms": 3610,
                    "result": {
                        "type": "analytics_report",
                        "title": "48h Attribution Anomaly Audit (Recovered)",
                        "currency": "EUR",
                        "summary": {"total_spend": 128000, "blended_roas": 3.55},
                        "rows": [
                            {"region": "DACH", "spend": 68000, "conversions": 1650, "roas": 3.9},
                            {"region": "UK", "spend": 60000, "conversions": 1210, "roas": 3.2}
                        ]
                    }
                }, seq)
            seq += 1

            msg_id_2 = f"msg_{run_id}_2"
            recovery_words = (
                "Stream recovered without duplicating prior tokens. "
                "Attribution audit finished cleanly across all partitions."
            ).split(" ")
            for i, word in enumerate(recovery_words):
                if seq > start_after:
                    token = word + (" " if i < len(recovery_words) - 1 else "")
                    yield sse_event("message_delta", {
                        "run_id": run_id,
                        "message_id": msg_id_2,
                        "delta": token
                    }, seq)
                    await asyncio.sleep(0.03)
                seq += 1

            yield sse_event("run_completed", {"run_id": run_id, "status": "success"}, seq)

        # =====================================================================
        # SCENARIO 4: MALFORMED (Hallucinated / Corrupt Schema for Generative UI)
        # =====================================================================
        elif req.scenario == "malformed":
            words = "Here is the experimental breakdown returned by the sub-agent:".split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield sse_event("message_delta", {
                    "run_id": run_id,
                    "message_id": msg_id,
                    "delta": token
                }, seq)
                seq += 1
                await asyncio.sleep(0.03)

            yield sse_event("tool_call_start", {
                "run_id": run_id,
                "tool_call_id": call_id,
                "tool_name": "query_campaign_analytics",
                "args": {"quarter": "Q3-2026", "experimental_schema": True}
            }, seq)
            seq += 1
            await asyncio.sleep(0.4)

            # Corrupt payload.
            yield sse_event("tool_call_result", {
                "run_id": run_id,
                "tool_call_id": call_id,
                "duration_ms": 390,
                "result": {
                    "type": "analytics_report",
                    "title": None,
                    "currency": 99999,
                    "summary": "CORRUPT_SUMMARY_STRING_NOT_OBJECT",
                    "rows": [
                        {"region": "DACH", "spend": "one_hundred_thousand", "conversions": None, "roas": "NaN"},
                        "hallucinated_string_row"
                    ]
                }
            }, seq)
            seq += 1
            await asyncio.sleep(0.2)

            yield sse_event("run_completed", {
                "run_id": run_id,
                "status": "completed_with_warnings"
            }, seq)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/runs/{run_id}/resume")
async def resume_run(run_id: str, req: ResumeRequest):
    if run_id not in PAUSED_RUNS:
        raise HTTPException(
            status_code=404,
            detail="Run ID not found or already resumed (prevent double-submission)."
        )

    paused = PAUSED_RUNS.pop(run_id)
    call_id = paused["tool_call_id"]
    msg_id = f"msg_{run_id}_resume"

    async def resume_generator():
        yield sse_event("run_resumed", {
            "run_id": run_id,
            "interrupt_id": req.interrupt_id,
            "decision": req.action
        })
        await asyncio.sleep(0.25)

        if req.action in ("approve", "edit"):
            final_args = (
                req.edited_args
                if (req.action == "edit" and req.edited_args)
                else paused["proposed_args"]
            )

            yield sse_event("tool_call_start", {
                "run_id": run_id,
                "tool_call_id": call_id,
                "tool_name": paused["tool_name"],
                "args": final_args
            })
            await asyncio.sleep(0.5)

            yield sse_event("tool_call_result", {
                "run_id": run_id,
                "tool_call_id": call_id,
                "duration_ms": 540,
                "result": {
                    "type": "budget_mutation_receipt",
                    "status": "committed",
                    "applied_args": final_args,
                    "audit_id": f"aud_{uuid.uuid4().hex[:6]}"
                }
            })
            await asyncio.sleep(0.2)

            budget_val = final_args.get("proposed_budget_eur", "updated")
            mode_label = "Modified parameters approved. " if req.action == "edit" else "Approved as proposed. "
            text = (
                f"{mode_label}Live budget cap for {final_args.get('campaign_id', 'campaign')} "
                f"is now set to €{budget_val} effective {final_args.get('effective_date', 'immediately')}."
            )
            words = text.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield sse_event("message_delta", {
                    "run_id": run_id,
                    "message_id": msg_id,
                    "delta": token
                })
                await asyncio.sleep(0.03)

            yield sse_event("run_completed", {"run_id": run_id, "status": "success"})

        elif req.action == "reject":
            yield sse_event("tool_call_result", {
                "run_id": run_id,
                "tool_call_id": call_id,
                "duration_ms": 0,
                "result": {
                    "type": "budget_mutation_receipt",
                    "status": "rejected_by_user",
                    "reason": req.reason or "Rejected by reviewer."
                }
            })
            await asyncio.sleep(0.2)

            text = (
                f"Action cancelled ({req.reason or 'Rejected by reviewer'}). "
                "No production budget caps were modified."
            )
            words = text.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield sse_event("message_delta", {
                    "run_id": run_id,
                    "message_id": msg_id,
                    "delta": token
                })
                await asyncio.sleep(0.03)

            yield sse_event("run_completed", {"run_id": run_id, "status": "cancelled_by_user"})

    return StreamingResponse(resume_generator(), media_type="text/event-stream")