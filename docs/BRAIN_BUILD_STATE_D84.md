# BRAIN BUILD STATE (Director D84), 2026-11-19

Pure modules with their own tests. "Wired" means a screen or the app calls it. No screen calls the brain yet, so everything new is reachable only through the orchestrator (`src/brain/mind/orchestrator/orchestrator.ts`).

| Part | What | State |
|---|---|---|
| Reading, meaning, resolution, tools, loop, dialogue state, budget, charter store, learning gate, mistake ledger | existing brain | already in the repository (other directors' work) |
| P01 Repair | repeats, "wait"/"oops", "how much" to "how many" | DONE |
| P02 Verification | clause status, evidence labels, REDESIGN on second failure | DONE |
| P03 Council | 8 seats, no voting | DONE |
| P04 Goal and Planner | success test, one step at a time, no third blind retry; adapter drives the existing step loop | DONE |
| P05 Dialogue questions | a tool found but text missing: ask, take the answer, cancel, park, expire | DONE (orchestrator, using the existing dialogue state) |
| P06 Reflection, candidate store, saving | candidates only; saved and restored as text through any storage with getItem/setItem | DONE |
| P07 External-AI contract | permissions, secrets, untrusted output, agreement is never proof | DONE (contract only) |
| P08 Orchestrator | modes off / shadow (default) / on; stats; saveTo/loadFrom; runPlan; foresee | DONE |
| P09 End-to-end tests | 175 real messages, a real two-step plan and look-ahead, with measured numbers | DONE |
| P10 Per-tool re-checks | text counter, sort lines, base64, hash (SHA-1/256/384/512, MD5), number to words, case converter | DONE for 6 of 7 live tools; the QR maker has no independent check |
| Judgment J0 situations | typed model: items, step effects, follow-on rules, goal, harms | DONE |
| Judgment J1 look-ahead | plays chains of steps forward within a depth and node budget and ranks them | DONE |
| Judgment J2 verdicts and chances | WORKS / WORKS_BUT_DIFFERENTLY / WORKS_ONLY_IF / WILL_NOT_WORK / CANNOT_JUDGE; chance ranges with basis; calibration journal; widening when predictions drift | DONE |
| Judgment J3 pace and effort | critical path, pace, margin, effort ranges, when more effort stops paying | DONE |
| Judgment J4 guidance | options, push-back, the one question; no sentences (wording belongs to the response part) | DONE (structure) |
| Judgment J5 brief | what a good design brief needs, what is given, what is defaulted, the one question to ask | DONE (structure; no pictures, no creation method) |

## Not built (see docs/BRAIN_REVIEW_D84.md)
Screens that call the brain; the real AI connections (Axon Web director); an independent re-check for the QR maker; the response part turning guidance records into sentences; owner decisions listed below; a second director's independent review.

## How to use the orchestrator
`const brain = createOrchestrator(createAxonBrain({ lane: true, slot }), { mode: 'shadow' });`
- `await brain.ask({ text, place: 'chat' })` gives `{ reply, trace, orchestration }`.
- `brain.stats()` shows what shadow mode has seen; switch to `'on'` only after the owner has looked at those numbers.
- `brain.foresee(situation, proposedSteps?)` looks ahead on a situation model and returns the judgment, the guidance record and the chance to show.
- `brain.noteOutcome(predictionId, cameTrue)` and `brain.calibration()` keep predictions honest.
- `await brain.runPlan(goal, plan)` runs a validated plan through the brain; a step counts only when its answer was re-checked.
- `brain.saveTo(storage)` and `brain.loadFrom(storage)` keep and restore the learning candidates and the prediction journal.

## Not decided by the owner yet
Charter tie rule (NEVER beats ASK beats ALLOW), the other-people check in the council, who builds the real AI connections, when to switch from shadow to on, and the design-creation method that J5 variants would need.
