# CCCS (Conversation Context and Commitment System): D84's review of ChatGPT's v0.4 and the integration plan

DECISION IN ONE LINE: the CCCS IDEA is approved; the ChatGPT PACKAGE is not merged. Its core was rebuilt in TypeScript on AXON's own parts (`src/brain/mind/commitments/`, isolated, NO caller). That engine is safe to merge. CCCS is NOT integrated into the brain: it does not yet make AXON a better reasoner, and nothing may say it does.

## 1. What I checked myself
- Re-ran the package suite: 3,531 groups, 0 failed (reproduced). 3,200 of them are generated variations of the same rules, as the package itself says.
- Mutation-tested its safety rules (broke each rule on purpose): evidence from non-owner, missing confirmation, missing protected authorization, replace on protected, intent guessed, expiry, hard-true gates: all caught. One survived (cross-chat evidence check): redundant with another check, not a hole. The tests are real, for what they cover.
- Re-ran its real-AXON simulation against the CURRENT repo (not the snapshot): all 9 replies and all 9 ten-stage traces are identical to the snapshot. `planning` and `verification` are still `not-built`. Orchestrator ON, 0 failures. The snapshot was still current for those probes.
- Read the live boundary: `BrainRequest` is `{text, place}`; `sendQueryToAxonBoundary(userInput)` drops its options; `createMind` builds a fresh context per message; the dialogue keeps 8 turns and is reset on every chat switch. CCCS's central finding is TRUE: nothing reaches the Mind.

## 2. Findings
REJECT as shipped: (a) plain JavaScript in a TypeScript/Vite repo, and a Node-only loader; (b) the permission gates are `true/false` options and callbacks, and a boolean is not a security control; (c) in-memory only; (d) it would be a second, parallel system next to parts AXON already has.
WHAT AXON ALREADY HAS (reused, not rebuilt): `Origin` and `OwnerApproval` (hash-bound, expiring, single-use) in `src/mind/charter`; owner consent and correction in Memory Notes (`memory/notes`); the yes/no pending question in the dialogue and the held-question pattern in the orchestrator (`heldPlan`, `heldOutside`); `TextStorage` and the refuse-whole saving of `candidateStore`.
WHAT IS GENUINELY NEW (kept): evidence kept apart from state; a protected hierarchy (law, constraint); conditional exceptions tied to a base and revoked with it; scopes; "no stated intent, no change"; context built from owner-confirmed state only.
REDESIGNED: the owner's yes is an OWNER EVENT in the log, after the evidence and in the same chat (the same message can never ask and approve). A protected change needs a Charter-style OwnerApproval bound by hash to the exact change (`transitionHash`), unexpired (max one day), single use. A change that PROMOTES something to a law needs approval too. The ledger quotes owner words, so it is saved on the phone only when memory is allowed (same rule as D84's Job 8).
STILL MISSING (decides what is possible): nothing in AXON produces "replace / correct / override / exception" from an owner's words. The engine refuses to guess it, correctly. Until the Meaning layer emits it (card CC4), no commitment can be created from chat on its own.

## 3. What is in the merge zip (card CC1, done)
`commitmentTypes.ts` (contract), `commitments.ts` (events, propose, adopt, change, revoke, sweep, context, validation), `commitmentStore.ts` (versioned save/restore, refuse-whole, stale-write refusal, memory rule), `tests/commitments.test.ts`. No existing source file is changed. Guards (no phrases, no regular expressions, values) scan and pass the new files.
Proof: 3,094 groups (34 named scenarios + 3,060 generated: 1,152 matrix groups checked against a separate oracle table, 1,500 seeded random operation sequences with invariants checked after every step, 336 corruption and 72 isolation groups), 129,592 assertions, 0 failed. I broke the engine in 21 places: 20 caught, 1 survived and is a redundant check (not a hole). NOT RUN: full suite, Vite build, Capacitor, phone.

## 4. Remaining cards (each small, each with its own test; one at a time)
- CC2 BOUNDARY IDENTITY: `BrainRequest` gets optional `chatId` and `messageId`; `App.tsx` passes the active chat id and the user message id through `sendQueryToAxonBoundary`. Accept: with no ids every reply is byte-identical (golden); with ids the trace shows them.
- CC3 RECORDER (shadow, labelled as shadow): `orchestratedBrain` records the owner message and AXON's reply (origin `axon`) in the in-memory ledger. Accept: replies unchanged, a failure never changes a reply, a retry adds nothing.
- CC4 INTENT PRODUCER (design job first; needs the owner's examples): Meaning emits closed labels (replace, correct, override, exception, confirm, unrelated) with the source span. Accept: a hand-labelled set; assistant, tool and quoted text never produce an owner intent.
- CC5 OWNER YES: a held-transition question in the orchestrator like `heldOutside`: yes applies once, no or cancel never, moving on drops it, a new chat clears it; the yes message is recorded as the owner event the engine checks.
- CC6 OWNER APPROVAL ISSUER: who creates an `OwnerApproval` (screen and owner identity). Until it exists every protected change is refused; that is the safe default.
- CC7 CONTEXT INTO THE MIND: a read-only `ContextView` on the Mind's context (NOT in the request text); only `rules` are obeyed, `unconfirmed` is only ever asked about; a protected rule must be able to stop a tool (council and step gate). Accept: empty ledger leaves every golden unchanged.
- CC8 PERSISTENCE WIRING: `loadLedger`/`saveLedger` in `index.ts`, only when memory is allowed; stale writes handled; migration hook for version 2.
- CC9 OWNER VIEW: list rules with who, when, why, and undo; joins the Library/Notes (7E). Notes stays the owner-facing store; do not merge the two.
OWNER DECISIONS: is memory allowed (without it nothing is kept after a restart)? Who issues owner approvals? Keep Notes and Commitments as two stores (my advice)?

## 5. Known limits of the engine
Replay is by validated state, not by re-running a journal (card later if wanted). Project and task scopes cannot be adopted or changed until a real registry supplies a `Grant`. Retrieval is word overlap (words of 4+ letters), not meaning. Approval tokens are checked as objects: whoever can run code in the app can build one, exactly as with the Charter; the owner-facing issuer (CC6) is what makes it real.

## 6. Side findings from the simulation (not CCCS, not changed)
"Count the words in this sentence: one two three." is answered with FIVE words (the whole message is counted, not the quoted part). "What is 17 plus 25?" falls back to "I do not have a way to do that". Both are outside this card.
