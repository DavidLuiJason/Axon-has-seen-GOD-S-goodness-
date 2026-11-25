# CORTEX R1 report — parts 1–3

**Status: ISOLATED-TESTED.** This return contains parts 1–3 only. It is not merged, not wired into chat, and does not establish live AXON behaviour.

## Source and scope

The builder prompt file named `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` was not present in either supplied ZIP inventory. The complete 12-part contract and the D111 placement note were supplied in the owner's message and were used as the specification. The supplied `AXON_ROADMAP_V21_3.md`, BASE repository ZIP and toolchain ZIP were inspected. All prerequisite paths named by the contract were present in the BASE. The existing contracts were read; no existing repository file was edited.

The existing `resolveTypes.ts` does not expose the exact `MeaningRecord` shape required by this job. Part 1 therefore defines a small local structural `MeaningRecord` adaptation in `cortexTypes.ts`, without adding a text field or changing the existing Resolution types.

## AXON top view and placement

The finished AXON is a truthful Android conversational assistant with a staged, typed brain, an English dictionary, tools, media and verification (roadmap section 6). CORTEX sits at layers 3–5, between Resolution and Planning at the “plan ONE step” stage, with Judgment/Council flags supplied as typed inputs. Later breakage could arise if live Resolution, Plan, permission or verification contracts differ from these isolated types. This return deliberately adds no caller and no chat wiring.

## LAW CHECK (FL11)

- **FL1** — CORTEX is placed within the complete brain flow, not treated as a standalone replacement brain.
- **FL2** — only the named existing contracts/guards and the new CORTEX files were inspected or created.
- **FL3** — the types retain clause, capability, objective and trace links needed by later parts and the facade.
- **FL4** — hand-worked tests and named mutants were run; no third fix was attempted after a repeated failure.
- **FL5** — the dictionary and dictionary files are untouched and remain outside this change.
- **FL6** — knowledge hits are typed inputs; this return does not bypass or replace the knowledge-slot interface.
- **FL9** — the work is located at the Resolution-to-Planning decision boundary.
- **FL10** — candidate capability facts are inputs only; no registry, action schema or live capability wiring was changed.
- **FL11** — this law check is included in the report as required.
- **FL12** — no chat route or independent screen/tool response path was added.
- **FL13** — engines consume typed records only; no message-text matching, regex literals or phrase lists were added.
- **FL15** — evidence labels and trace links are explicit; no unsupported confidence score is produced.

## Files created

1. `src/brain/mind/cortex/cortexTypes.ts`
2. `src/brain/mind/cortex/objectiveFrame.ts`
3. `src/brain/mind/cortex/optionGenerator.ts`
4. `tests/cortex01Types.test.ts`
5. `tests/cortex02ObjectiveFrame.test.ts`
6. `tests/cortex03OptionGenerator.test.ts`
7. `docs/reports/CORTEX_R1_REPORT.md`

No existing file was changed. In particular, `package.json`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, `actionSchemas.ts`, `liveSwitches.ts`, `brain/index.ts`, `orchestrator.ts`, the named golden/engine tests and the roadmap were not modified.

## Part 1 — TYPES (`cortexTypes.ts`)

**Contract built:** typed immutable input boundary; objective clauses and success tests; constraints; candidate capabilities with preconditions/effects/slots/reversibility/cost; knowledge hits; commitment references; ALLOW/ASK/NEVER permissions; budget and pending-question state; one-kind decision union; decision record with reason map, rejected options, objective trace, success test, budget used, evidence labels and trace. Bad inputs return a typed `{ ok: false, error, message }` result. Builder records are cloned and deeply frozen. Decision validation rejects hybrid/multi-kind shapes. The local `MeaningRecord` adaptation has no message-text field.

**Hand-worked cases:** 12 — valid input; missing objective; raw text in Meaning record; empty clauses; missing permission; duplicate capability; negative budget; source object unchanged; nested arrays frozen; attempted write blocked; valid one-kind decision; hybrid decision rejected.

**Mutants caught:**
- `M1 TEXT LEAK ACCEPTED` — caught by `cortex01Types.test.ts`, case 03 (Meaning records cannot carry message text).
- `M2 MUTABLE INPUT SNAPSHOT` — caught by case 09 (built records and nested arrays are immutable).
- `M3 MULTI-KIND HYBRID ACCEPTED` — caught by case 12 (a hybrid or multi-kind decision is rejected).

**Cannot prove:** this boundary cannot prove that upstream Meaning/Resolution facts are themselves correct or complete, nor can a TypeScript object freeze prove a security boundary against arbitrary runtime code. It does not execute a capability or authorise an action.

## Part 2 — OBJECTIVE FRAME (`objectiveFrame.ts`)

**Contract built:** one root goal and success test per original clause; original objective retained as an immutable snapshot; derived subgoals require an existing clause, the correct root parent and a target equal to the source target or one of that clause's typed allowed subgoal references. Untraceable or scope-changing proposals are explicitly rejected. Constraint changes require an existing source and preserve target, kind and value; strength may stay the same or increase, never weaken. Every generated/rejected item has trace data.

**Hand-worked cases:** 14 — valid typed input; one root per clause; root success tests; original request retained; immutable frame; allowed child goal; missing source rejected; objective-changing target rejected; wrong parent rejected; HARD constraint weakening rejected; constraint retargeting rejected; SOFT-to-HARD strengthening admitted; unbased constraint rejected; deterministic output.

**Mutants caught:**
- `M4 UNTRACED GOAL SILENTLY DROPPED` — caught by `cortex02ObjectiveFrame.test.ts`, case 07 (a subgoal without an objective clause is rejected and flagged).
- `M5 OBJECTIVE SCOPE EXPANSION ACCEPTED` — caught by case 08 (a goal that changes the objective is not admitted).
- `M6 HARD CONSTRAINT WEAKENING ACCEPTED` — caught by case 10 (a HARD constraint cannot be weakened).

**Cannot prove:** scope validity depends on upstream typed `allowedSubgoalRefs` and target references being sound. The engine checks structure and preservation; it cannot decide whether a human's intended objective was understood correctly.

## Part 3 — OPTION GENERATOR (`optionGenerator.ts`)

**Contract built:** enumerates options only from supplied typed facts. It considers knowledge answers with their existing truth labels, one-capability RUN options, bounded capability chains where prior effects satisfy later preconditions, ASK options for missing inputs/approval/unmet requirements, and honest DECLINE when no usable route remains. Unavailable and NEVER-permission capabilities remain visible as blocked options; NEVER capabilities cannot enter a generated plan. Cycles, depth and step-budget overflows are rejected with trace reasons. Output order is deterministic.

**Hand-worked cases:** 16 — no match; one matching capability; two-capability chain; cycle rejection; unavailable capability; NEVER permission blocked/not chained; missing slot asks; ASK permission requests approval; knowledge answer; DISPUTED knowledge not directly answered; effect satisfies a precondition; unmet effect asks; depth stop; step-budget stop; deterministic output independent of capability input order; duplicate capability rejected.

**Mutants caught:**
- `M7 NEVER PERMISSION RUNNABLE` — caught by `cortex03OptionGenerator.test.ts`, case 06 (NEVER remains blocked and never enters a plan).
- `M8 CAPABILITY CYCLE ACCEPTED` — caught by case 04 (a capability cycle is rejected and traced).
- `M9 MISSING SLOT ASSUMED FILLED` — caught by case 07 (a missing required slot yields an ASK option).

**Cannot prove:** enumeration is only as complete and accurate as the candidate capability, availability, permission, effect, slot and knowledge facts supplied to it. It does not execute options, verify a live registry, contact a knowledge source or grant permission.

## Commands run and output tails

Toolchain: Node `v22.16.0`; TypeScript compiler `5.8.3`; tests executed with the supplied toolchain's bundled `tsx` runner (`sh ../axon-toolchain/run-test.sh ...`).

| Command | Output tail / result |
|---|---|
| `sh ../axon-toolchain/run-test.sh tests/cortex01Types.test.ts` | `CORTEX part 1 type contracts passed: 12 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex02ObjectiveFrame.test.ts` | `CORTEX part 2 objective frame passed: 14 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex03OptionGenerator.test.ts` | `CORTEX part 3 option generator passed: 16 cases` |
| `tsc --strict --noEmit --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck` followed by the three source and three test paths | Exit 0; no diagnostics. |
| `sh ../axon-toolchain/run-test.sh tests/mindPipeline.test.ts` | `B1 mind pipeline tests passed: 240 checks` |
| `sh ../axon-toolchain/run-test.sh tests/meaningNoPhrases.test.ts` | `B03A NO-PHRASES GUARD OK: 108 files scanned, 221 checks` |
| `sh ../axon-toolchain/run-test.sh tests/brainBoundary.test.ts` | `B1 brain boundary passed: 6 allowed importers` (the six existing allow-listed importers printed by the test). |
| `python3 /tmp/run_cortex_mutants.py` | All nine mutations reported `CAUGHT`, each with exit 1 and its designated expected assertion present. Source files were restored after every mutation. |

The test totals are 42 hand-worked cases across parts 1–3. The nine mutant checks were run after the final source changes.

## `test:kernel` line to add

Do not edit `package.json` in this return. Append the following to the existing `test:kernel` command:

```sh
&& tsx tests/cortex01Types.test.ts && tsx tests/cortex02ObjectiveFrame.test.ts && tsx tests/cortex03OptionGenerator.test.ts
```

## NOT RUN

- The full `test:kernel` script (the package script was not changed).
- Full repository test suite, full-repository `tsc --strict`, full build/lint and cloud workflow.
- `node tools/guard.mjs` (the three named brain guards above were run individually).
- Runtime/device/phone behaviour, app installation, source-export equality, live registry integration, chat wiring, execution, or owner-permission-broker behaviour.
- CORTEX parts 4–12 and returns R2–R4.
- Independent Director review and mutation work by the Director.

## Contract deviations and limitations

- The separately named `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` was not included in the attachments. The user-pasted full contract and D111 note were used instead; no unseen prompt-file content is claimed as read.
- `MeaningRecord` is a local typed adaptation because the existing Resolution types do not expose that exact type. Existing files were not changed.
- Parts 4–12 are not included in R1 and are NOT RUN / NOT BUILT.
- No live-behaviour claim is made. R1 is **ISOLATED-TESTED** only.
