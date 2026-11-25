# CORTEX R4 report — parts 10–12

**Status: ISOLATED-TESTED.** This return contains parts 10–12 only. It is not merged, not wired into chat or the orchestrator, and does not establish live AXON behaviour. All twelve parts have hand-worked tests; the Director must independently review and rerun them before any merge.

## AXON top view and placement

The finished AXON is a truthful Android conversational assistant with a staged, typed brain, an English dictionary, tools, media and verification (roadmap section 6). CORTEX sits at layers 3–5, between Resolution and Planning, recommending one typed decision from already-read records. Later breakage could arise if live Meaning, Resolution, registry, KnowledgeSlot, Judgment, permission-broker, Plan, loop or verification adapters differ from the isolated interfaces. No chat, execution, screen or outside-AI wiring is part of this return.

## LAW CHECK (FL11)

- **FL1** — reconciliation, verification and the facade remain inside the staged brain flow.
- **FL2** — only the named commitment, loop, verification, Plan and CORTEX contracts were used; existing contracts were not edited.
- **FL3** — decisions and recovery outcomes preserve typed traces and explicit reasons for later stages.
- **FL4** — hand-worked cases and named mutants were run; two-strike recovery is enforced and no third blind retry is permitted.
- **FL5** — the dictionary and its files are untouched.
- **FL6** — knowledge remains a typed input / KnowledgeSlot concern; this return does not replace the slot boundary.
- **FL9** — CORTEX remains at the Resolution-to-Planning decision boundary.
- **FL10** — the facade proposes a RUN or PLAN only from supplied capability facts; it neither registers nor executes a capability.
- **FL11** — this visible law check is repeated in the report.
- **FL12** — no chat, orchestrator, screen or independent tool/provider answer path is wired.
- **FL13** — reconciliation consumes typed Meaning signals only; message text is neither accepted nor inspected.
- **FL15** — verification uses the success test and typed observations; unknown, disputed or conflicting results are not silently called verified.

## Files created

1. `src/brain/mind/cortex/reconcile.ts`
2. `src/brain/mind/cortex/verifyRecover.ts`
3. `src/brain/mind/cortex/cortex.ts`
4. `tests/cortex10Reconcile.test.ts`
5. `tests/cortex11VerifyRecover.test.ts`
6. `tests/cortex12Facade.test.ts`
7. `docs/reports/CORTEX_R4_REPORT.md`

No pre-existing repository file was changed. In particular, `package.json`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, `actionSchemas.ts`, `liveSwitches.ts`, `brain/index.ts`, `orchestrator.ts`, the protected golden/engine tests, and the roadmap remain untouched. The only R2 follow-up since its first package is the object-map-only validation correction documented in `CORTEX_R2_REPORT.md`; it is included in the refreshed R2 ZIP, not this R4 delta.

## Part 10 — DECISION RECONCILIATION (`reconcile.ts`)

**Contract built:** consumes a typed `ReconciliationSignal` carrying statement kind, scope, target prior commitment, intent, explicit change cue, source event, time and trace. It does not accept or inspect message text. It produces exactly one of ADD, REFINE, SUPERSEDE, RETRACT, COEXIST, HOLD or ASK. Musing, proposal, preference, hypothetical and conditional signals do not silently become owner decisions. Recency and repetition counts are not sufficient by themselves. An unanchored correction or reversal asks rather than inventing a commitment. Replacements preserve a copy of the old item and a `[replaced DATE by what: replacementRef]` marker. Protected law/constraint changes require the supplied approval/broker check; the engine only creates a proposed draft and never writes to the commitment store.

**Hand-worked cases:** 22 — musing held; proposal held; decision can add when the scope/authority facts permit; musing then decision; explicit deliberate reversal; later accidental mistake does not replace; repetition alone does not replace; target and intent required; missing explicit cue asks; general rule and exception coexist; irreversible conflict asks; hypothetical held; conditional held; project/task grant required; protected law change without approval asks; protected constraint with verified approval is still only proposed; old item preserved; replacement date marker; unanchored correction asks; unknown target asks; invalid approval rejected; deterministic output and trace retained.

**Mutants caught:**
- `M28 EXPLICIT CHANGE CUE CHECK REMOVED` — caught by `cortex10Reconcile.test.ts`, case 09 (an unmarked later statement cannot silently replace the prior item).
- `M29 MUSING TREATED AS A DECISION` — caught by case 04 (a musing is held, not committed).
- `M30 REPLACED DATE EVIDENCE DROPPED` — caught by case 11 (the prior item and its replacement marker are retained).

**Cannot prove:** this engine cannot determine whether the upstream Meaning stage classified a speech act correctly, whether the supplied grants or approval result are authentic, or whether the owner actually confirmed a proposal. It cannot append, supersede or retract a live commitment. The stored commitment remains unchanged until the later authority/commitment path acts.

## Part 11 — VERIFY AND RECOVER (`verifyRecover.ts`)

**Contract built:** compares a typed primary observation with the part-2 success test by calling the existing `verifyOutcome` contract. It uses an injected independent observation only when that check is available and LOW cost. A primary success with independent conflict is not accepted; unknown outcomes are checked before any retry and either resolved by an agreeing independent path or sent to ASK_OWNER. A failed check may request one budgeted replan. Step budget is decremented on REPLAN only. Owner decision pending, exhausted budget, two cycles without gain or two strikes stop recovery. The result maps to the existing `LoopStatus` vocabulary and records primary/independent reports, trace, strikes, remaining budget and whether retry is permitted.

**Hand-worked cases:** 18 — primary success; independent second-path success; primary unknown resolved by independent success; unknown without usable second path asks; primary/independent disagreement asks; independent path unavailable; high-cost independent path skipped; failure replans once; budget decremented only on replan; zero budget abstains; owner decision pending asks; two strikes abstain; two cycles without gain abstain; third retry blocked; false success rejected by success test; unknown is checked before retry; loop status mapping; invalid counters/typed input return EngineResult error.

**Mutants caught:**
- `M31 INDEPENDENT PATH CONFLICT IGNORED` — caught by `cortex11VerifyRecover.test.ts`, case 10 (conflicting paths cannot be labelled verified success).
- `M32 THIRD BLIND RETRY ALLOWED` — caught by case 08 (two strikes stop further retry).
- `M33 UNKNOWN OUTCOME ACCEPTED WITHOUT CHECK` — caught by case 05 (unknown without a resolving independent check requires owner attention).

**Cannot prove:** the engine cannot prove that an external action really happened, that an injected observation is honest, or that a nominally independent path is truly independent. It compares typed observations against the supplied success test and existing verifier. It does not itself rerun an external action, schedule a loop, or grant retry permission to an executor.

## Part 12 — FACADE AND PROOF (`cortex.ts`)

**Contract built:** `createCortex(deps).decide(input)` validates a typed record and composes objective framing, option generation, evaluation, ask policy, reconciliation, bounded task-graph/Plan creation, and exact integer addition with an injected engine plus an independent BigInt check. It returns one `DecisionRecord`, its trace and the intermediate typed results. Every option not chosen is retained with a rejection reason. The facade independently checks that no RUN or PLAN contains a NEVER-permission capability. `toOrchestratorPlan` adapts only a PLAN and reruns the existing `validatePlan`; it never executes it. An outside-AI result is proposal-only and has no input data references. No message text, secrets, credential references, live broker, orchestrator or chat calls are used.

**End-to-end proof set:** 60 hand-worked `CortexInput` records were passed through the facade. Required scenarios are covered: greeting; 17 plus 25 using the exact engine and a second path; word meaning with a dictionary hit; two clauses with ordered work; vague request asking one question; unavailable capability declined honestly; NEVER-permission capability blocked; multi-part project converted to a Plan; contradiction presented to the typed reconciliation adapter; and outside-AI proposal with no secret references. The remaining inputs cover additional knowledge answers, reversible RUN candidates, unavailable capability declines, NEVER candidates and clarification cases. Seven further boundary checks cover deterministic repeat decisions, NEVER RUN/PLAN suppression, raw text rejection, Plan adapter success, no non-PLAN adaptation, changed/tampered Plan rejection and retained rejected-option reasons.

**Hand-worked cases:** 67 checks total (60 distinct end-to-end `CortexInput` records plus 7 additional boundary assertions).

**Mutants caught:**
- `M34 OUTSIDE-AI PROPOSAL LEAKS INPUT/SECRET REFERENCES` — caught by `cortex12Facade.test.ts`, case 10 (outside-AI proposal carries no data references).
- `M35 ORCHESTRATOR PLAN ADAPTER SKIPS VALIDATION` — caught by the tampered-Plan boundary test (the existing `validatePlan` must reject the altered Plan).
- `M36 REJECTED OPTION REASONS OMITTED` — caught by the tie/rejected-alternative boundary test (the losing option and its reason remain in the DecisionRecord).

**Cannot prove:** the facade cannot prove that Meaning or Resolution understood the original human request correctly, that capability facts or permissions are live, that KnowledgeHits are admitted or complete, or that Judgment/Council and the broker will return the same signals at runtime. It does not wire the result into chat or execute RUN/PLAN. It cannot prove real outside-AI behaviour, natural-language reply wording or owner approval.

## Commands run and output tails

Toolchain: Node `v22.16.0`; TypeScript compiler `5.8.3`; tests executed with the supplied toolchain's bundled `tsx` runner (`sh ../axon-toolchain/run-test.sh ...`).

| Command | Output tail / result |
|---|---|
| `sh ../axon-toolchain/run-test.sh tests/cortex10Reconcile.test.ts` | `CORTEX part 10 passed: 22 checks` |
| `sh ../axon-toolchain/run-test.sh tests/cortex11VerifyRecover.test.ts` | `CORTEX part 11 passed: 18 checks` |
| `sh ../axon-toolchain/run-test.sh tests/cortex12Facade.test.ts` | `CORTEX part 12 passed: 67 checks (60 end-to-end inputs plus boundary checks)` |
| Rerun of all `cortex01Types.test.ts` through `cortex12Facade.test.ts` | All 12 passed; output counts 12, 14, 16, 14, 27, 16, 21, 16, 15, 22, 18 and 67 respectively: **258 hand-worked checks**. |
| Combined `tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions` over all 12 CORTEX source files and all 12 CORTEX test files | `CORTEX combined tsc --strict: PASS (no diagnostics)` |
| `sh ../axon-toolchain/run-test.sh tests/mindPipeline.test.ts` | `B1 mind pipeline tests passed: 258 checks` |
| `sh ../axon-toolchain/run-test.sh tests/meaningNoPhrases.test.ts` | `B03A NO-PHRASES GUARD OK: 117 files scanned, 239 checks` |
| `sh ../axon-toolchain/run-test.sh tests/brainBoundary.test.ts` | `B1 brain boundary passed: 6 allowed importers` (the existing six importer paths were printed). |
| TypeScript AST source-rule audit over `src/brain/mind/cortex/*.ts` | `CORTEX STATIC GUARDS: no regex literals; no arrays of 3+ string literals (12 files scanned).` |
| Deliberate R4 mutation checks `M28`–`M36` | All nine mutants were caught by their designated tests; the production source was restored before final test reruns. |

The R4 total is 107 checks (22 + 18 + 67); the total across all four returns is 258. All three required existing brain guards were rerun against the final source tree after the R2 object-map correction.

## `test:kernel` line to add

Do not edit `package.json` in this return. Append the following after the R1–R3 additions:

```sh
&& tsx tests/cortex10Reconcile.test.ts && tsx tests/cortex11VerifyRecover.test.ts && tsx tests/cortex12Facade.test.ts
```

## NOT RUN

- The full `test:kernel` script and full repository test suite.
- Full-repository `tsc --strict`, lint, build, cloud workflow, APK build/install and phone/device testing.
- `node tools/guard.mjs` as a single command; the three named brain guard tests were run individually.
- Production chat/orchestrator wiring, live capability registry, permission broker, real tool execution, real KnowledgeSlot/archive providers, live Judgment/Council/Foresight adapters and real outside-AI senders.
- Full end-to-end action recovery against a running execution loop; verification was tested with injected observations.
- Director's independent rerun, review and ACCEPTED/NOT ACCEPTED verdict.

## Contract deviations and limitations

- The standalone `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` named in the intake line was not included in the supplied attachments. The full 12-part contract and D111 placement note pasted by the owner were used as the specification; no unseen prompt-file content is claimed as read.
- The facade accepts already-typed `knowledgeHits`; it does not call the asynchronous KnowledgeSlot in its synchronous `decide` path. Part 4 (`knowledgeNeed.ts`) is a separate async engine and must be connected by a later adapter.
- The facade does not automatically invoke the Part 5 method selector or Part 6 relation traversal. Those are separately implemented, isolated reasoning engines; later typed adapters must decide when to call them and pass their outputs into the decision pipeline.
- Reconciliation returns a proposal only. It does not commit, alter or delete the stored commitment; the existing authority and owner-confirmation path remains decisive.
- Part 11 checks the injected primary/independent observations; it does not invoke real outside actions or independently collect the second observation.
- This return is **ISOLATED-TESTED** only. No live behaviour, integration, runtime readiness or Director acceptance is claimed.
