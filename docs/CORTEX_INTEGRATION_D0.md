# CORTEX integration note (D0, 2026-11-25)

WHAT IT IS: `src/brain/mind/cortex/` = 12 pure engines between Resolution and Planning. `createCortex(deps).decide(input)` returns ONE typed decision (ANSWER, RUN, PLAN, ASK, DECLINE, PROPOSE_OUTSIDE_AI) plus reasons, rejected options and a trace. It proposes; the Charter and permission broker decide. Status: ISOLATED-TESTED. No caller.

CHANGED BY D0: exact computation is no longer hard-wired to addition. `exactConceptKinds` (INTEGER_ADD, INTEGER_SUBTRACT, INTEGER_MULTIPLY) + `deps.exactBinaryOps` (engine + independent BigInt path). Test: tests/cortex13ExactOps.test.ts (8 checks).

WHAT IT DOES NOT DO YET (honest limits; each is a later sized job, none is a defect of the return):
- CX-A1 knowledge adapter: the facade takes typed `knowledgeHits`; part 4 (knowledgeNeed.ts, async) is not called by it.
- CX-A2 method and relation adapter: parts 5 and 6 are not called by `decide`.
- CX-A3 Meaning-to-commitment signals: part 10 reads typed signals. No stage yet produces them from words (same finding as CCCS, D84).
- CX-A4 wiring into the orchestrator behind a switch, shadow first (liveSwitches.ts, orchestrator.ts: Director only).
- Replies are not worded here (response stage). Outside-AI proposals carry no data.

MUTANTS D0 RAN (11): caught: independent-path check, ask-for-irreversible, context-answers-it, two-strike counter, two-cycles-without-gain stop, irreversible penalty, task-graph cycle check, plus the generic-op test. SURVIVED: safe-integer check (redundant: success test also refuses), final NEVER guard in the facade (redundant: earlier NEVER checks fire first), a reconcile reason-code label, a knowledge-need trace code (labels only).

OWNER DECISION: ask policy defaults to ONE question per turn (injected parameter `askPolicy`).
