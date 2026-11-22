# JOB 7 (planner gate) by D111: judgment now speaks BEFORE a planned step runs

Evidence labels: MEASURED = run here on the main zip of 2026-11-22 plus Job 5 plus this change (jszip stubbed in the sandbox only, not shipped). NOT RUN = not executed.

## What was true before
- The planner (`plan/plan.ts`) and runner (`orchestrator/planRunner.ts`) existed and were tested, and `orchestrator.runPlan` ran each step through `ask()`. But judgment/council spoke only AFTER a tool ran (Job 5 note), so a risky planned step would already have run.

## What this job adds
- NEW `orchestrator/stepGate.ts` (pure apart from the injected judge): `makeStepGate(judge, {approvedTools, onHeld, onFailed})`. Before each step it builds the situation from the tool's declared schema (situation.ts), skips the council for a plain read (councilGate.ts) and otherwise convenes it.
  - PROCEED: runs. PROCEED_WITH_WARNING: runs, with a caution. ASK: the step is HELD and the owner gets one plain question ("Before I run X I need your approval. ..."). STOP: HELD with a refusal ("I will not run X. ...").
  - `approvedTools`: the owner's yes lifts an ASK for that tool in this plan. A STOP is never lifted (test G08).
  - A council that throws or refuses HOLDS a step that needed it (asking is safe, running unjudged is not); a plain read never needs the council, so a broken council cannot stop it (P08).
  - Evidence label is OBSERVED: what is judged is the declared schema; no claim about a result is made (UNKNOWN would make every write ask forever; MEASURED: converter UNKNOWN -> ASK, OBSERVED -> PROCEED).
- `planRunner.ts`: `runPlan(goal, plan, answerStep, gate?)`. New status `HELD` {stepId, verdict, question}. With no gate it behaves exactly as before (P05).
- `orchestrator.ts`: `runPlan(goal, plan, approvedTools = [])` always passes the gate; new counter `stepsHeld`; a failed council is counted in `councilFailed`.

## Proof (MEASURED here)
- `tests/stepGate.test.ts`: 18 checks, 0 failed. A held step is never sent to the brain (1 request, not 2; a risky first step sends none). Every tool switched ON today passes the gate. Mutants: gate removed (7 checks fail), approval lifting a STOP (1 fails), failed council allowed through (1 fails): all caught.
- Regression: planRunner 10, orchestrator 232, council 28, situation 18, orchestratorOnChat 33, orchestratorConnection 39: all pass. tsc on the touched files: no real error (sandbox has no node_modules, so only missing-type noise appears elsewhere).

## Honest limits
- The gate covers PLANNED steps only. A single chat message still goes to the Mind in one call, and no risky tool is live in chat, so nothing risky can run there today. Gating a single message needs the Mind to offer a plan-only step: a later job, not done here.
- No caller builds plans from chat yet (nothing turns an owner message into a Goal/Plan). That is a separate piece; until then `runPlan` is exercised by tests only. NOT RUN: cloud build, phone.
- The ASK is returned to the caller as HELD; carrying the owner's yes back into chat (dialogue state) belongs with Job 6.
