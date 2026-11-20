# BRAIN REVIEW (Director D84, review of my own work), 2026-11-19

NOT independent: I wrote what I reviewed. It lists what I checked, what I found, what is still weak, and what I could not check. A second director should still look.

## What I checked, and how
| Check | Result |
|---|---|
| Hand-derived worked cases written before or with the code, plus seeded random invariants | every brain part; the judgment engines also replay 400 random situations chain by chain against a separate by-hand simulator |
| Deliberate breaks (the tests must fail when the code is broken) | repair, verification, council, planner, reflection, external contract, verifiers (old and new), orchestrator, dialogue helpers, store, adapter, plan runner, prediction journal, and 37 on the judgment engines; every break is caught except a few that are provably equivalent (listed in the test notes: a repeat-step guard that the no-change and seen-state guards already cover) |
| Independent second implementations / real oracles | my private versions of P01, P02, P03 agree with the builder's code on 30000, 40000 and 60000 random inputs; the new verifiers agree with Node's own crypto (MD5 on 3000 byte strings, all SHA sizes on 2000 inputs), with the project's own number-to-words engine on 4000 random numbers (0 differences) and with the project's own case converter on 108000 conversions (0 unrecognised) |
| Repository guards: no regex, no arrays of 3+ string literals, no fixed phrases under src/brain/mind | pass (mindPipeline, meaningNoPhrases, valuesGuard, brainBoundary) |
| Whole repository suite | see the board-lines file for the final count and any parallel-load timeouts |
| Real brain, real tools: shadow mode changes nothing | 31 of 31 messages identical to the plain brain (task numbers and run times ignored) |
| Independent tool re-check false alarms | 0 in 123 end-to-end re-checks (122 PASSED, 1 UNCLEAR: hex encoding has no check), 0 in 400 earlier generated runs |
| Strict type check, erasable syntax only | clean |

## Measured end to end (tests/brainEndToEnd.test.ts, 175 messages through the real brain)
78 tool answers; 123 re-checks (122 PASSED, 1 UNCLEAR, 0 FAILED); repair: 99 kept, 50 repaired, 12 asked first (risky); dialogue: 12 questions asked, 13 answers placed, 1 cancelled, 1 parked; judgment: 123 PROCEED, 0 ASK; 22 learning candidates noted; shadow equals the plain brain on 31 of 31; one real two-step plan reached its goal with both answers verified, and a plan step the brain cannot do ended by asking the owner; look-ahead warned before a delete with no backup.

## Findings from this review (all fixed)
1. Guard tests broken by my merged parts (fixed earlier; repair, council, external, orchestrator, verifiers rewritten without regex or string lists, verifiers moved to src/safety).
2. Tests too weak in 15 places across the work (examples: a flag's next step; "hold" taken as a restart word; negative counts hiding a real count; margin rounding; the exact-15-points drift edge; widening below 0 or above 100; a no-op step; a hypothesis range predicted at its midpoint). Closed with added cases.
3. My first comparison of shadow replies with plain replies failed because the brain's task numbers, run times and taught words are process-wide; fixed by comparing everything else.
4. One of my own test expectations was wrong (F08: an exhausted search is "cannot judge", not "works"); the code was right.

## Weak points I still see (honest list)
1. NOT independent: one author. Hand-derived expectations, real oracles and breaks reduce but do not remove shared-blindspot risk. The judgment engines in particular follow my reading of docs/JUDGMENT_DESIGN.md; the owner or another director should confirm the verdict names, the ranking order (harm-free goal first, then fewer irreversible steps, then cost, then length) and the 15-point drift rule are what the design meant.
2. The judgment engines judge a MODEL of a situation that someone supplies; they do not turn a sentence into a model, and they cannot know what the model leaves out. A wrong model gives a confident wrong verdict. Chances come only from the model's own numbers and the journal.
3. Guidance is structure only. Nothing yet turns it into sentences for the owner (the response part), and the design's "learning from the owner's own pushbacks" is not built.
4. The QR maker has no independent re-check; hex and URL encodings are not re-checked (reported UNCLEAR, never blocked).
5. The tool re-check reads the quoted text (or the one whole number) in the message. If the brain took its input from somewhere else, the check is skipped or could disagree; 0 false alarms so far, only on quoted payloads.
6. A missing-text question accepts ANY next message as the answer unless it resolves as a request of its own, and it expires after 3 turns; an answer with curly quotes is asked for again; the question does not name the tool.
7. The live number tool answers "I do not have a way to do that" for numbers of about 9 digits and more (observed on 645824910); that is the tool lane (another director), not the orchestrator.
8. The planner and plan runner work with the existing loop and with the orchestrated brain, but the seven tools are single steps, so real multi-step use will come with multi-clause requests.
9. The Mind pipeline's own stages still say "not built" for planning and verification in a plain brain; the orchestrator's returned trace shows real notes. stages.ts was not edited (other directors own it and a zip merge would overwrite their changes).
10. No screen calls the brain, so none of this is visible in the app. Switching from shadow to on is the owner's call after looking at `brain.stats()`.
11. Repair's two closed word lists live in repair.ts as keyed lookups, not in closedSets.ts.
12. The orchestrator test takes about 30 seconds and the end-to-end test about 45 seconds.

## What I could not check
Android and cloud builds; behaviour on a real phone and speed on the weakest tier (the half-second target is unmeasured); any D471, D321, D204 work newer than the zip I was given.

## Decisions only the owner can make
Charter tie rule (NEVER beats ASK beats ALLOW); the other-people check in the council; who builds the real AI connections (Axon Web director); when to switch the orchestrator from shadow to on; the creation method for design variants (J5 stays structure-only until then).
