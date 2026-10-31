# Architecture & Backend Contract Proposal

> **Instructions:** Keep your answers concise and concrete (300–600 words total across all sections). We will discuss your proposals directly with our engineers during the 45-minute review call.

## 1. Multi-Product Component API Design
*Our shared agent-UI layer will be used by at least four products (e.g., a full-screen Analytics Workbench, a compact CRM sidebar copilot, an HR document auditor, and an internal ops dashboard). How did you structure (or how would you evolve) the API boundaries between state hooks (`useAgentStream`) and UI primitives (`ToolCallCard`, `ToolInterruptCard`, `GenerativeRenderer`) so product teams can customize layout and styling without forking your package?*

- **Your Response:**
  *(Write here)*

---

## 2. Library vs. Custom State Architecture
*Why did you choose your current state management approach for streaming/interrupts? As we scale to production, where would you adopt existing ecosystem libraries (e.g., AG-UI / CopilotKit, assistant-ui, Vercel AI SDK, LangChain `useStream`, XState, TanStack Query) versus maintaining custom primitives?*

- **Your Response:**
  *(Write here)*

---

## 3. Python / LangGraph SSE Contract Critique
*Inspect the SSE event shapes and endpoints in `server/main.py`. If you were sitting down with our Python/LangGraph engineers on Monday to lock in the v1 production contract, what **2 to 3 specific changes** would you require regarding event schemas, cursor resumption, concurrency, or shared type generation (e.g., Pydantic-to-TypeScript/Zod)?*

- **Your Response:**
  *(Write here)*

---

## 4. Scope Cuts & Production Next Steps
*What did you intentionally simplify or defer to stay within the 3-hour timebox, and what are the top two engineering priorities you would tackle next before shipping this to production clients handling confidential financial/HR data?*

- **Your Response:**
  *(Write here)*
