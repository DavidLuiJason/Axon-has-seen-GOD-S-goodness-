# CORTEX R3 report — parts 7–9

**Status: ISOLATED-TESTED.** This return contains parts 7–9 only. It adds no caller, chat wiring, screen, storage, clock, permission broker or execution authority. R1 and R2 types/engines are dependencies and are not duplicated in this delta.

## AXON top view and placement

The finished AXON is a truthful Android conversational assistant with a staged, typed brain, an English dictionary, tools, media and verification (roadmap section 6). CORTEX is placed at layers 3–5, after Resolution and before Planning, where it evaluates options, creates a bounded task graph and applies the question-necessity policy. Later breakage could arise if live Judgment/Council flags, capability reversibility, resource budgets or the existing Plan contract differ from the typed adapters used here. This return is not wired into chat and does not authorise actions.

## LAW CHECK (FL11)

- **FL1** — the evaluator, task graph and ask policy remain in the complete staged brain flow.
- **FL2** — only the named CORTEX/Plan/Judgment contracts and new R3 files were used.
- **FL3** — each output keeps the typed traces and interfaces needed by reconciliation, verification and the facade.
- **FL4** — hand-worked cases and three named mutants per part were run; the two-strike limit was observed.
- **FL5** — the dictionary and all dictionary files remain untouched.
- **FL6** — the knowledge boundary remains the one slot interface; R3 does not add a parallel store.
- **FL9** — all three engines stay at the Resolution-to-Planning decision stage.
- **FL10** — evaluation consumes registry-derived options; it does not declare or invoke a capability.
- **FL11** — this law check is recorded in the report.
- **FL12** — no chat, screen or independent tool/provider response path was added.
- **FL13** — inputs are typed records; no message text, regex or phrase lists were added.
- **FL15** — scores are deterministic factor scores, not probabilities; weak/disputed evidence is not upgraded; all decisions retain traces.

## Files created

1. `src/brain/mind/cortex/optionEvaluator.ts`
2. `src/brain/mind/cortex/taskGraph.ts`
3. `src/brain/mind/cortex/askPolicy.ts`
4. `tests/cortex07OptionEvaluator.test.ts`
5. `tests/cortex08TaskGraph.test.ts`
6. `tests/cortex09AskPolicy.test.ts`
7. `docs/reports/CORTEX_R3_REPORT.md`

No existing repository file was changed. In particular, `package.json`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, `actionSchemas.ts`, `liveSwitches.ts`, `brain/index.ts`, `orchestrator.ts`, protected tests and the roadmap remain untouched.

## Part 7 — OPTION EVALUATION (`optionEvaluator.ts`)

**Contract built:** evaluates typed candidates against evidence, reversibility, cost class, risk, resource fit, permission, Council flags and Judgment signals. It deterministically returns SELECTED, ASK or ALL_BLOCKED with ranked options and a reason for every rejected option. A BLOCKING Council/Judgment flag, NEVER permission, blocking risk/resource or Judgment STOP vetoes an option. Irreversible actions and SEND/DELETE/MONEY begin with ASK. An eligible safe reversible option outranks an ASK-only option. Uncertainty, UNKNOWN/DISPUTED evidence, high risk and warning/veto signals can move treatment one rung deeper; depth never moves down. Ties use the declared `EVIDENCE_THEN_REVERSIBILITY_THEN_COST_THEN_ID` rule. No probabilities are created.

The effective evidence label for an ANSWER option is the weaker of its source-hit label and the evaluator-supplied label. This prevents a later evaluation record from promoting an unverified knowledge hit.

**Hand-worked cases:** 21 — higher evidence/resource fit; VERIFIED over INFERRED; reversible over irreversible; SEND asks; DELETE asks; MONEY asks; high risk penalty; blocked resource rejection; Council veto; Judgment STOP; NEVER cannot be selected; all blocked; no probability; deterministic tie; uncertainty escalates; no downshift at maximum depth; no downshift when certain; ASK-permission runner becomes approval question; every unselected option receives a rejection reason; stronger evaluator label cannot upgrade an ANSWER hit; DISPUTED answer evidence remains DISPUTED and escalates.

**Mutants caught:**
- `M19 EVIDENCE RANK PROMOTES WEAK EVIDENCE` — `cortex07OptionEvaluator.test.ts`, case 02 (VERIFIED must outrank INFERRED).
- `M20 IRREVERSIBLE/SEND ACTION NO LONGER REQUIRES ASK` — case 03 (safe reversible option must beat the irreversible ASK option).
- `M21 BLOCKING COUNCIL/JUDGMENT VETO IGNORED` — case 09 (the blocking option carries the veto rejection reason).

**Cannot prove:** the evidence supplied to it is genuine or admitted, and it cannot prove the calibration of any numeric score. The score is only an ordinal deterministic ranking from explicit typed factors. It cannot prove live permission state or resource availability. It recommends; it never authorises or runs an option.

## Part 8 — TASK GRAPH (`taskGraph.ts`)

**Contract built:** turns clause-linked work proposals into nested work items with parents, inputs, outputs, dependencies, acceptance tests, capability ids, reversibility, state and trace. It detects self, dependency and parent cycles; rejects unknown references, duplicated ids, premature completion and tasks that do not trace to an objective clause. Foundation-first ordering is deterministic (parent/dependency readiness, then foundation rank, then id). Safe-parallel marks only independent, reversible root work with disjoint outputs. Progress is returned as the six required state counts (`not_started`, `ready`, `in_progress`, `blocked`, `done`, `verified`), not a percentage. A parent is not completed merely because its children are verified. The adapter creates a Goal/Plan using the existing `plan.ts` types and calls `validatePlan` before returning it.

**Hand-worked cases:** 16 — multi-part graph; parent retained; dependencies retained; foundation first; dependency cycle; parent cycle; safe parallel independent roots; irreversible excluded from safe parallel; all six explicit state counts; blocked dependent; parent remains NOT_STARTED when children are VERIFIED; emitted Plan accepted by `validatePlan`; missing objective-success producer rejected by the explicit guard; duplicate id rejected; unknown dependency rejected; existing planner step ceiling enforced.

**Mutants caught:**
- `M22 PARENT-LINK CYCLE DETECTION DISABLED` — `cortex08TaskGraph.test.ts`, case 06 (parent-link cycle is rejected).
- `M23 PARENT AUTO-COMPLETED WHEN CHILDREN VERIFY` — case 11 (parent remains NOT_STARTED).
- `M24 OBJECTIVE-SUCCESS PRODUCER GUARD REMOVED` — case 13 (the explicit `missing-objective-success` error is required).

**Cannot prove:** the proposed work decomposition is the best possible decomposition, that the listed capabilities are live, or that a capability's acceptance test is truthfully measured. Safe-parallel is a conservative structural mark, not a concurrency scheduler. The current `plan.ts` adapter requires a non-null scalar goal success value; unsupported success shapes are refused rather than guessed. The planner and any execution loop are not called beyond `validatePlan`.

## Part 9 — ASK POLICY (`askPolicy.ts`)

**Contract built:** evaluates the necessity of each typed question. Existing pending questions retain priority and original order. A question is not asked when context can answer, a calculation can answer, a safe reversible step can answer, or the answer would not change the result. Irreversible actions and explicit approval requirements still require ASK even when context contains information. Options remain attached to the question. The number allowed per turn is injected, defaults to one and is bounded; remaining necessary questions are queued in order. Duplicate question ids are refused. The engine emits references and typed reasons, not reply sentences.

**Hand-worked cases:** 15 — context resolution; calculate first; reversible action first; no-change means no question; unresolved answer asks; irreversible beats context; approval beats a reversible path; default one question; options attached first; remainder queued in order; injected count two; old pending order preserved; resolved pending item removed; duplicate ids rejected; invalid count rejected.

**Mutants caught:**
- `M25 CONTEXT ANSWER NOT CONSIDERED` — `cortex09AskPolicy.test.ts`, case 01 (context resolves without asking).
- `M26 IRREVERSIBLE ACTION CHECK MOVED AFTER CONTEXT` — case 06 (irreversible still asks for approval when context is available).
- `M27 DEFAULT QUESTION COUNT CHANGED TO TWO` — case 08 (one question is the default).

**Cannot prove:** that the upstream context/calculation/reversible-step facts are complete or correct. It does not generate natural-language questions, decide the final conversational wording, or interpret a user reply. It does not implement multi-question owner policy beyond the injected count.

## Commands run and output tails

Toolchain: Node `v22.16.0`; TypeScript compiler `5.8.3`; tests executed with the supplied toolchain's bundled `tsx` runner using `sh ../axon-toolchain/run-test.sh ...`.

| Command | Output tail / result |
|---|---|
| `sh ../axon-toolchain/run-test.sh tests/cortex07OptionEvaluator.test.ts` | `CORTEX part 7 option evaluator passed: 21 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex08TaskGraph.test.ts` | `CORTEX part 8 task graph passed: 16 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex09AskPolicy.test.ts` | `CORTEX part 9 ask policy passed: 15 cases` |
| Rerun of `cortex01Types` through `cortex09AskPolicy` test files | All nine outputs passed: 12, 14, 16, 14, 27, 16, 21, 16 and 15 cases respectively (151 cases total across R1–R3). |
| `tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions` plus all nine CORTEX source and all nine CORTEX test paths | Exit 0; no diagnostics. |
| `sh ../axon-toolchain/run-test.sh tests/mindPipeline.test.ts` | `B1 mind pipeline tests passed: 252 checks` |
| `sh ../axon-toolchain/run-test.sh tests/meaningNoPhrases.test.ts` | `B03A NO-PHRASES GUARD OK: 114 files scanned, 233 checks` |
| `sh ../axon-toolchain/run-test.sh tests/brainBoundary.test.ts` | `B1 brain boundary passed: 6 allowed importers` (all six existing allow-listed importers printed). |
| R3 mutation checks `M19`–`M27` | All nine mutations were caught by their named assertions. Each mutated file was restored before the next check. |

## `test:kernel` line to add

Do not edit `package.json` in this return. Append the following to the existing `test:kernel` command:

```sh
&& tsx tests/cortex07OptionEvaluator.test.ts && tsx tests/cortex08TaskGraph.test.ts && tsx tests/cortex09AskPolicy.test.ts
```

## NOT RUN

- The full `test:kernel` script and full repository test suite.
- Full-repository `tsc --strict`, lint, build, cloud workflow and APK build.
- `node tools/guard.mjs` (the three named brain guard tests above were run individually).
- Runtime/device/phone behaviour, app installation, source-export equality, registry integration, chat wiring, action execution or permission-broker behaviour.
- CORTEX parts 10–12 and return R4.
- Independent Director review and Director-run mutation/proof pass.

## Contract deviations and limitations

- The separately named `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` was not included in the supplied attachments. The pasted 12-part contract and D111 placement note were used as the specification; no unseen file content is claimed as read.
- The graph-to-Plan adapter is constrained by the existing `plan.ts` scalar success shape. It returns an EngineResult error for unsupported or null success values; existing planner files were not modified.
- Existing Council/Judgment signals are injected data; R3 does not create additional seats or invoke live Judgment/Council.
- R3 is **ISOLATED-TESTED** only. No live-behaviour claim is made.
