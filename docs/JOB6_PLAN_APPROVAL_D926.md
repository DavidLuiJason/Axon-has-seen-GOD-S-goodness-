# JOB 6 (D926): the owner's yes or no for a held plan step

What it does: when the step gate (Job 7) holds a plan step on an ASK, the plan now waits in chat. The question is the open yes-no question.
- yes: the plan carries on from the held step with that tool approved. Earlier steps are not run again (the plan remembers where it stood).
- no: the plan ends, the held tool is never asked. cancel: same, with the usual cancel reply.
- anything else: the owner moved on; the plan is dropped and never run by a later yes.
- a STOP is final: nothing waits for it and a yes never lifts it. A second risky step asks for its own yes.
- shadow mode holds the step but nothing waits in chat. resetDialogue (a new chat) clears a waiting plan.

Files: planRunner.ts (HELD carries toolId and a resume record; runPlan takes an optional resume), orchestrator.ts (heldPlan, runGated, step 1b of ask(), counters), tests/planApproval.test.ts (20 checks, 4 mutants caught).
Also in this package (lost build fixes): loan and split-bill chat actions, engineTruth proof list, brainGolden ability replies, NOW.txt pointing to DIRECTOR_NAP.txt.
Limit: no code builds a plan from an owner message yet, so only tests start plans.
