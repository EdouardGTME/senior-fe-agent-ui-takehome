# Senior Frontend Engineer (AI-Agent Interfaces) — Technical Assessment

Welcome! This practical exercise is designed to simulate the exact architectural challenges you will own in your first 60 days as our first Senior Frontend Engineer: **building and owning a resilient, shared React/TypeScript agent-UI layer** across multiple products, collaborating on event contracts with our Python/LangGraph backend engineers, and raising the frontend engineering bar across the team.

Rather than asking you to build a boilerplate CRUD app from scratch, we have provided a working starter workspace connected to a local Python FastAPI SSE simulator. Your job is to **diagnose and fix critical streaming/state concurrency bugs, implement a type-safe Generative UI registry, review a teammate's PR, and document your contract recommendations.**

---

## Timebox & Submission Guidelines

* **Deadline:** Tuesday at 23:59 CET.
* **Target Effort:** **2.5 to 3.5 hours** of focused engineering. Please **do not** spend 10+ hours polishing CSS or building unrequested features. We care deeply about state machines, streaming lifecycle safety, component API boundaries, and honest UX states. If you run out of time, stop and write down what you would have done next. We will not penalise an unfinished submission that says clearly what is missing and why.
* **Unpaid:** We know that is a real cost to you. It is a company constraint, not a preference, and we have kept the scope small because of it.
* **Clarifying questions:** Ask before you start. Email Edouard directly. Asking is a positive signal, not a negative one.
* **Submission:** Zip your whole project, including `ARCHITECTURE.md`, `AI_WORKFLOW.md` and your PR review, and name the file with your name, e.g. `john-doe-takehome.zip`. Email it to e.germain@house-of-communication.com.
* **AI Tooling Policy:** You are welcome to use AI coding assistants (Cursor, Claude Code, Copilot, etc.) just as you would in daily production work. Please complete `AI_WORKFLOW.md` briefly noting how you used AI and what you manually architected or corrected. Be prepared to modify and defend every line of your code live during our 45-minute review call. "The model wrote it that way" is not an answer we can work with.

---

## Quick Start

### 1. Start the Mock Python/LangGraph SSE Backend (`:8000`)

The mock backend requires Python 3.9+ and uses FastAPI + Uvicorn (zero external API keys required).

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

*Note: Do not modify `server/main.py`—treat it as a production backend service owned by our Python team (you will critique its event contract in Task 2).*

### 2. Start the Frontend Workspace (`:5173`) & Test Runner

In a new terminal at the repository root:

```bash
npm install
npm run dev
```

To run the automated behavioral test suite (Vitest):

```bash
npm test
```

> **Note:** When you first run `npm test`, **2 tests will fail**. These failing tests pin the exact state-identity and stream-lifecycle bugs you need to solve in **Task 1**.

---

## Repository Structure

We have structured the frontend to reflect the separation between the **shared component library** you will own (`src/packages/agent-ui`) and a **consuming product application** (`src/app/analytics-copilot`):

```text
├── server/
│   ├── main.py                        # FastAPI SSE LangGraph simulator (Clean & Chaos modes)
│   └── requirements.txt
├── src/
│   ├── packages/agent-ui/             # <-- SHARED AGENT-UI LAYER (Your primary domain)
│   │   ├── types.ts                   # Shared SSE event & component contracts
│   │   ├── useAgentStream.ts          # Core SSE streaming & HITL resume hook (HAS BUGS)
│   │   ├── components/
│   │   │   ├── ToolCallCard.tsx       # Reference component (Read-only tool lifecycle)
│   │   │   ├── ToolInterruptCard.tsx  # Human-in-the-loop approval/edit card (NEEDS WORK)
│   │   │   └── GenerativeRenderer.tsx # Controlled Generative UI registry (TASK 2)
│   │   └── __tests__/
│   │       └── agent-ui.test.tsx      # Vitest behavioral suite (2 failing tests to fix)
│   └── app/analytics-copilot/         # <-- CONSUMING PRODUCT #1
│       ├── AnalyticsWorkspace.tsx     # Demo host app with Scenario Selector
│       └── widgets/                   # Pre-styled presentation primitives
│           ├── AnalyticsTable.tsx
│           └── MetricBarChart.tsx
├── reviews/
│   └── PR_104_AgentSummaryCard.md     # Simulated colleague PR for Task 3
├── ARCHITECTURE.md                    # Your contract & shared-layer design note (Task 2)
└── AI_WORKFLOW.md                     # Brief log of your AI tooling usage
```

---

## Your Tasks (In Priority Order)

### Task 1: Harden the Stream Lifecycle & Fix the HITL Interrupt State Bugs (~90 mins)

Inspect `src/packages/agent-ui/useAgentStream.ts` and `src/packages/agent-ui/components/ToolInterruptCard.tsx`.

When our Python backend emits a `langgraph_interrupt` event (Scenario: **`approval`**) or runs under adversarial network conditions (Scenario: **`chaos`**), the starter implementation exhibits three production defects:

1. **Ephemeral Edit State Wiped on Stream Heartbeats (Failing Test #1):** While an agent run is paused waiting for Human-in-the-Loop (HITL) approval, the SSE stream continues emitting `stream_heartbeat` events every 2 seconds to keep the proxy connection alive. Currently, every incoming heartbeat causes the message list / interrupt card to lose the user's unsaved inline parameter edits inside `<ToolInterruptCard />`. Refactor the state boundary and component identity so in-flight user edits are keyed safely by `interrupt_id` and survive background stream ticks.
2. **Zombie Stream & Race Condition on Cancel / Retry (Failing Test #2):** Clicking **Cancel** during an active run sets a UI boolean flag but fails to cleanly abort the underlying `fetch` SSE stream, allowing tokens from a cancelled run to interleave if the user immediately triggers a new run. Fix the `AbortController` lifecycle and model the run status cleanly so invalid overlapping states cannot occur.
3. **Resilient Chaos Recovery & Double-Submit Protection:**
   * In `<ToolInterruptCard />`, extrapolate the design tokens and UX patterns from `<ToolCallCard />` to support **Approve**, **Edit & Approve**, and **Reject (with reason)**—ensuring keyboard accessibility, valid JSON/field checking, and protection against accidental double-submissions while `/resume` is in flight.
   * Under Scenario **`chaos`**, the server injects a 3.5-second tool stall followed by a mid-stream transient disconnect (`STREAM_INTERRUPTED_RETRYABLE`). Ensure the UI preserves all partial output streamed prior to the error, tells the user the truth about the state, and provides a working **Reconnect / Resume** flow (passing `last_event_id` to `/api/runs/stream` so previously streamed tokens are not duplicated).

### Task 2: Controlled Generative UI Registry & Contract Proposal (~60 mins)

1. **Controlled Component Registry (`GenerativeRenderer.tsx`):**
   * When a tool call completes with `result.type === "analytics_report"`, the UI should render the pre-built `<AnalyticsTable />` and `<MetricBarChart />` widgets.
   * However, in Scenario **`malformed`**, the LLM hallucinates corrupt schema types (e.g., strings instead of numbers, null arrays, or an unknown widget type `"pie_3d_experimental"`).
   * Implement a type-safe component registry and runtime schema validator (using `zod` or strict TypeScript type guards) inside `GenerativeRenderer.tsx` paired with an Error Boundary. When validation fails or data is partial, render an **honest fallback state** that explains the schema mismatch to the user and offers a collapsible **"Inspect Raw Agent Payload"** view instead of crashing the React tree.
2. **Architecture & Backend Contract Note (`ARCHITECTURE.md`):**
   * Complete the prompts in `ARCHITECTURE.md` (300–600 words total) detailing how 4+ products will consume your shared components without forking, and what 2–3 concrete changes you would negotiate with our Python/LangGraph engineers for the v1 production SSE contract.

### Task 3: Asynchronous PR Review (`reviews/PR_104_AgentSummaryCard.md`) (~25 mins)

As our first Senior Frontend Engineer, you will review frontend code written by junior/mid-level engineers and backend colleagues. Open `reviews/PR_104_AgentSummaryCard.md`, which contains a 75-line component diff submitted by a teammate, and write **5 to 7 inline review comments** prioritized by severity (security, state bugs, UX honesty, accessibility, and TypeScript safety).

---

## How we score this

| Weight | Criterion |
| ------ | --------- |
| 35% | **State and stream lifecycle correctness (Task 1)**: do the two failing tests pass for the right reasons, can invalid overlapping run states be represented, does reconnect avoid duplicated tokens |
| 20% | **Honest UX under failure**: chaos and malformed scenarios, partial output kept, the user told the truth about the state |
| 20% | **Component API boundaries and validation (Task 2)**: registry design, schema validation, error boundary, fallback |
| 20% | **Judgment and communication**: `ARCHITECTURE.md`, PR review prioritization, `AI_WORKFLOW.md` honesty |
| 5% | **Documentation**: can we run it cold |

A smaller, correct, well-explained solution scores above a larger one with loose ends. Submissions are scored by two reviewers.

---

## IP, data, and privacy

* **You retain all intellectual property in your submission.** We use it solely to evaluate your application. We will not use it in production or derive anything from it.
* **What we collect:** your submitted code, your CV, and correspondence relating to this application. Our lawful basis is taking steps prior to entering a contract with you.
* **Retention:** we delete your submission and application data within 6 months of a hiring decision, unless you separately and explicitly consent to us keeping it on file for future roles. That consent is optional and declining it does not affect this application.
* **Your rights:** you can request access to, correction of, or deletion of your data at any time by emailing Edouard, and we will act within 30 days.
* The hiring company is based in Munich, Germany and is the data controller. CreativeNest acts as our processor for sourcing.

---

## What happens next

If we move forward, we will schedule a **45-minute remote review call** where you walk us through the solution and we dig into the decisions. That conversation carries more weight than the code itself. Expect us to push on your state model, on how you handled the chaos and malformed scenarios, and on your PR review.
