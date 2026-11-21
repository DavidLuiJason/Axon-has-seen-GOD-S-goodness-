# JOB 0 + JOB 1 (D111): green baseline and the orchestrator connected to real chat

UPDATE: Job 3+4 (docs/JOB3_4_ORCHESTRATOR_ON_D111.md) switched the pinned mode from 'shadow' to 'on'. Wherever this file says shadow is shipped, read it as the Job 1 state.

Evidence labels: MEASURED = run here on main_2 plus this change (jszip is NOT installed in the Director sandbox; a throwaway stub was used only to let the tool registrations load, it is not in the package). NOT RUN = not executed.

## 1. What was true before (MEASURED by reading and running)
- Real chat: screen -> `sendQueryToAxonBoundary` (src/services/axonBrainInterface.ts) -> `getAxonBrain().ask` (src/brain/index.ts) -> `createMind` (src/brain/mind/pipeline.ts) with the direct lane.
- The P08 orchestrator (src/brain/mind/orchestrator/orchestrator.ts) was imported ONLY by tests. Repair, verify, judgment, council, plan, external, reflect, foresight had no caller in src outside the orchestrator; the council and external contract are not even inside the orchestrator.
- Red tests on main_2: brainGolden, mindPipeline, meaningNoPhrases, valuesGuard (+7 more, section 4).

## 2. Job 0 (baseline) - what changed
1. `src/brain/mind/orchestrator/toolVerifiers.ts` was a second, never-imported copy of `src/safety/toolVerifiers.ts` holding regex literals that the mind folder forbids. It broke THREE guard tests at once (mindPipeline, meaningNoPhrases, valuesGuard). It is now a four-line re-export of the one engine (FL14). Nothing imported it.
2. `tests/fixtures/brainGolden.json`: the four ability-list replies ("help", "what can you do", "What can you do?", "what tools do you have?") were stale: nine tools went live after the fixture was made, and one line ("AXON Apps: screen only") is expected but `registerAxonAppsCapability` is never called by `src/main.tsx`, so the real app does not list it. Only those four replies were regenerated from the current registrations; the other 75 messages are untouched.
   - FOR D47: if AXON Apps should be listed in chat, call `registerAxonAppsCapability()` in main.tsx and in the golden test, then regenerate.

## 3. Job 1 (connection) - what changed
- NEW `src/brain/orchestratedBrain.ts`: `withOrchestrator(mind, {mode})`. The ONLY place in src that builds an orchestrator (a test pins this). Same surface as the Mind, so the chat boundary did not change.
- NEW `src/brain/orchestratorMode.ts`: `ORCHESTRATOR_MODE = 'shadow'` (pinned by the test).
- `src/brain/index.ts`: `getAxonBrain()` now returns the wrapped Mind; if the wrapper cannot be built the plain Mind is used. `getOrchestratorStatus()` reads the shadow numbers. `rebuildChatBrainForTests(slot)` is a test hook (the app's own dictionary slot needs Vite's `import.meta.env`, which Node lacks). `createAxonBrain` is unchanged, so the older proof tests still compare the plain brain.
- `orchestrator.ts`: one method added, `resetDialogue()` (a new or other chat must clear the orchestrator's open question too). `resetAxonDialogue` now reaches both.
- Behaviour:
  - shadow (shipped): the owner gets the Mind's own reply and trace objects. The orchestrator records (repair verdict, tool recheck, judgment, reflection). One Mind call per message.
  - Duplicate execution: the wrapper never asks the Mind a second time unless the orchestrator failed BEFORE the Mind was asked; a reply the Mind already made is reused. Tested for both shadow and on.
  - Fallback: orchestrator build error, throw, or stuck -> chat unaffected. In shadow, after the Mind has answered the orchestrator has `settleMs` (1500) to finish; then the reply goes out.
  - Memory: last 50 orchestrations only, in memory, never saved. Messages are served one at a time.
  - `'on'` is built and tested (repair question, held-back failed recheck, "I read your message as", reply fields kept) but NOT shipped.

## 4. Test evidence (MEASURED)
- `tests/orchestratorConnection.test.ts`: 39 checks, 0 failed. A: pins and audit of who builds the orchestrator. B: 25 wrapper laws with a counting fake Mind. C: the real pathway (`sendQueryToAxonBoundary`, real dictionary, real lane): one message reaches the orchestrator once; reply equals the plain brain's; the tool answer is independently rechecked (PASSED); no failure/timeout/fallback.
- Three deliberate defects (no wrapping; second Mind run after a failure; shadow leaking orchestrator replies) were each caught (1, 2 and 7 failed checks), then restored.
- Also pass now: mindPipeline 220, meaningNoPhrases 98 files, valuesGuard 98 files, brainGolden 79 messages, orchestrator 227, brainEndToEnd 175 messages, directorNap, roadmapSize, toolVerifiers, toolVerifiers2.
- The whole `test:kernel` list (163 files) plus the new test: 156 pass, 8 failed in a parallel run. `valuesRunner` passes alone (205,656 checks, 9 s; it failed once under load: treat as a timing flake, NOT investigated). The other 7 fail IDENTICALLY on the untouched main_2 and are not caused by this change: capabilityTruth ("kernel action finance.loan has a registry action"), liveAdmission ("loan-calculator is ON and lacks: no-available-chat-action"), liveSwitches (pinned ON list), liveFacts, resolveOptionsRunner, tools, valueEvidenceRunner (counts: groups, facts, statuses). Cause: wave 3a switched the loan calculator on without its registry chat action, and count fixtures lag. NOT fixed here (tool waves belong to Job 11 / D471); fixing it is the first task of Job 11.
- NOT RUN: cloud build, `tsc` on the whole project (the two new files and index.ts are strict-clean except one pre-existing `import.meta.env` typing line in dictionaryAccess.ts), the phone, the four jszip tests, the 62 test files outside `test:kernel`.

## 5. Facts found that the next jobs need
1. The orchestrator's recheck fires only when the reply source starts with `runner:`. In real chat that means lane answers (verified live: encoder-decoder, sort-lines, case-converter, number-to-words, text-counter PASSED; hash-tool and converter UNCLEAR: no independent check yet). Answers from `local-rules`, `english-dictionary`, `foundation` are never rechecked. Job 4 must widen this deliberately.
2. Binder gaps are real in chat: `calculate "12*3"` answered "That sounds like: Calculate a hash..." (foundation); "what is 15% of 80" and "hello" fall to foundation. This is Job 13.
3. In `'on'` mode the orchestrator keeps its OWN dialogue state, beside the Mind's shadow dialogue; the on-mode text-slot question calls the Mind once as a "probe" before the combined text (a tool could run twice). Both must be resolved before flipping to `'on'` (activation job).
4. Council and external AI are not in the orchestrator; judgment inside it only sees a harmless READ proposal for tool answers (no situation builder yet).

## 6. How to flip it on later
Change the one line in `src/brain/orchestratorMode.ts`, update the pin A01 in `tests/orchestratorConnection.test.ts`, and only after `getOrchestratorStatus()` shows shadow numbers on the phone (failures 0, timeouts 0) and facts 3 above are resolved.

## 7. Not done / known issues
Shadow numbers on a real phone (NOT RUN). The 7 wave-3a red tests. `valuesRunner` timing flake. Roadmap text (7R/7E "Council design only") is stale versus the code; the roadmap is the owner's/Director's file and was not edited.
