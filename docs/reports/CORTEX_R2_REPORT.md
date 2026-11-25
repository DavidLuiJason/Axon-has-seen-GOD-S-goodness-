# CORTEX R2 report — parts 4–6

**Status: ISOLATED-TESTED.** This return contains parts 4–6 only. It adds no caller, chat wiring, screen, storage, clock or permission authority. R1 types are dependencies and are not duplicated in this delta.

## Source and scope

The standalone `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` was not included in the supplied attachments. The complete 12-part contract and D111 placement note pasted by the owner were used as the specification. The roadmap and named BASE contracts were inspected in the intake. R2 opens only the existing knowledge-slot boundary and the named Judgment/Foresight contracts needed to set adapter shape. Existing repository files were not edited.

The source interface in `src/brain/knowledge/slot.ts` is asynchronous. Part 4 therefore uses an asynchronous engine and calls only its injected `KnowledgeSlot.status()` and `KnowledgeSlot.lookup()` methods; it does not reach into a backend or storage implementation. The slot result contains no independent truth assessment, so a returned hit is conservatively labelled `REPORTED`, never `VERIFIED` by this engine.

## AXON top view and placement

The finished AXON is a truthful Android conversational assistant with a staged, typed brain, an English dictionary, tools, media and verification (roadmap section 6). CORTEX remains at the layers 3–5 boundary, after Resolution and before Planning, with Judgment and Foresight used only through injected adapters. Later breakage could occur if the live source registry, Judgment/Foresight adapters, exact-engine contracts or relation archive return different shapes or evidence guarantees. No live integration is claimed.

## LAW CHECK (FL11)

- **FL1** — knowledge, methods and relations are located in the complete brain flow, not made independent answer paths.
- **FL2** — only the named existing slot/Judgment/Foresight contracts and new R2 files were opened or created.
- **FL3** — outputs preserve typed traces and adapter boundaries needed by later evaluation, graph and facade parts.
- **FL4** — hand-worked cases and three named mutants per part were run; no unchanged failed fix was retried.
- **FL5** — dictionary files remain untouched; dictionary access stays behind the existing KnowledgeSlot.
- **FL6** — each source is queried through the KnowledgeSlot interface; duplicate source ids count as one source for independence.
- **FL9** — these engines are placed inside CORTEX's Resolution-to-Planning reasoning boundary.
- **FL10** — methods and relation candidates do not call live tools or claim a capability registry match.
- **FL11** — this law check is recorded in the report.
- **FL12** — no chat, screen or independent tool/provider response path was added.
- **FL13** — all selection uses typed feature records and relation facts; no phrase matching or regex was added.
- **FL15** — knowledge hits remain REPORTED, analogies remain CANDIDATES, correlation is not cause, and no probability is invented.

## Files created

1. `src/brain/mind/cortex/knowledgeNeed.ts`
2. `src/brain/mind/cortex/methods.ts`
3. `src/brain/mind/cortex/relationReasoner.ts`
4. `tests/cortex04KnowledgeNeed.test.ts`
5. `tests/cortex05Methods.test.ts`
6. `tests/cortex06RelationReasoner.test.ts`
7. `docs/reports/CORTEX_R2_REPORT.md`

No BASE/repository file was changed. After delivery, a source-rule audit found that the R2-generated `relationReasoner.ts` budget validator used a four-key string array. This R2-generated file was corrected to use the required object-map form; the validation behaviour is unchanged. `package.json`, `tools/files.lock`, `tools/guard.mjs`, `.github`, `public/dictionary`, `actionSchemas.ts`, `liveSwitches.ts`, `brain/index.ts`, `orchestrator.ts`, the protected tests and the roadmap remain untouched.

## Part 4 — KNOWLEDGE NEED (`knowledgeNeed.ts`)

**Contract built:** typed clause features select the dictionary, notes and archive source kinds. Each selected source is called through the injected KnowledgeSlot interface only. Source ids are deduplicated before lookup; a repeated source is one source for independence. Returned senses retain source id/name/version and a truth label. A found slot result is `REPORTED` because the slot contract does not independently certify truth. A not-found result yields `NO_SOURCE_HOLDS_IT`; a missing or unready required slot yields `SOURCE_UNAVAILABLE`, not a guessed answer. No selected source yields `NO_SOURCE_SELECTED`.

**Hand-worked cases:** 14 — dictionary selected; notes selected; archive selected; all requested kinds queried; no source selected when unneeded; all-not-found returns no source holds it; missing source unavailable; non-ready slot not queried; duplicate source counted once; source and REPORTED label included; source metadata retained; partial source success preserved while missing source is shown; untyped message text rejected; empty lookup key rejected.

**Mutants caught:**
- `M10 UNVERIFIED KNOWLEDGE PROMOTED` — caught by `cortex04KnowledgeNeed.test.ts`, case 10 (a hit remains REPORTED).
- `M11 DUPLICATE SOURCE COUNTED TWICE` — caught by case 09 (the same source repeated twice is counted once).
- `M12 NOT-FOUND GUESSED AS HIT` — caught by case 06 (a not-found response returns no source holds it).

**Cannot prove:** the engine cannot prove a source's licence, completeness, admission status or truth; it only preserves metadata and labels the slot's return as REPORTED. It does not load or verify archive blocks and does not decide whether the requested source kinds were correctly identified upstream.

## Part 5 — METHOD REGISTRY (`methods.ts`)

**Contract built:** six typed method descriptors each declare purpose, inputs, assumptions, validity, output, limits and verifier. A selector reads only the closed typed feature record and uses a written deterministic priority: exact computation, counterfactual, causal chain, analogy, constraint satisfaction, then rule deduction. Unknown methods and extra text keys are rejected. Rule deduction requires a VERIFIED rule and VERIFIED premises. Constraint satisfaction reports failed or uncertain constraints rather than treating disputed/unknown evidence as satisfied. Causal chains delegate to an injected Judgment adapter; counterfactuals delegate to an injected Foresight lookahead adapter; exact work delegates to an injected exact engine. An analogy always returns `CANDIDATE`, including its mapping, differences and required validation-test reference; it never claims transferability. Other method outputs are passed to an injected verifier and remain unverified when it says so.

**Hand-worked cases:** 27 — complete descriptor declarations; method delegate declarations; selection of each of the six methods; deterministic exact-operation priority; no-method outcome; wrong-method refusal; VERIFIED-only deduction; typed constraint result; message-text feature rejection; unverified premise rejection; disputed-constraint refusal; analogy candidate-only result; Judgment adapter invocation; Foresight adapter invocation; exact-engine invocation; verifier failure retained as UNKNOWN/not verified; Judgment failure propagated.

**Mutants caught:**
- `M13 EXACT PRIORITY REMOVED` — caught by `cortex05Methods.test.ts`, case 13 (typed exact-operation feature selects exact computation).
- `M14 ANALOGY CLAIMS TRANSFERABILITY` — caught by case 22 (analogy remains a candidate and does not establish transferability).
- `M15 WRONG METHOD ALLOWED` — caught by case 16 (a method that disagrees with the selector is refused).

**Cannot prove:** the adapters are supplied by a later integration and are not wired here. This part cannot prove Judgment, lookahead, exact-engine or verifier correctness. Rule/constraint results are only as sound as their typed premises, rules and observed state. A candidate analogy is not validated by producing it.

## Part 6 — RELATIONS (`relationReasoner.ts`)

**Contract built:** bounded traversal over an injected typed relation source. It records the task stage, requires a typed task-to-category relation, expands candidate links, deterministically ranks them, and records why search stopped. Supported relation types include hypernym, hyponym, part-of, similar, cause, antonym, domain, group and a separate correlation type. Each candidate contains its relation type, full edge path, weakest evidence label, deterministic score/rank, trace and explicit limits. Similarity is never treated as transferability. Correlation is never treated as cause. Search is bounded by injected depth, breadth, node and result limits. The rank score is an ordinal evidence/depth score, not a probability or confidence percentage.

**Ranking rule:** evidence rank is VERIFIED 5, OBSERVED 4, REPORTED 3, INFERRED 2, UNKNOWN 1, DISPUTED 0; score is `evidence rank × 10 − path depth`. Ties are broken by candidate reference, then path id.

**Hand-worked cases:** 16 — typed task/category/candidate traversal; task trace; category trace; candidate expansion trace; ranking trace; exhausted stop trace; candidate filter; depth bound; breadth bound; node bound; VERIFIED ahead of INFERRED; deterministic tie; similarity not transferable; correlation not cause; unlinked category stop; source exception returns EngineResult error.

**Mutants caught:**
- `M16 SIMILARITY TRANSFER ACCEPTED` — caught by `cortex06RelationReasoner.test.ts`, case 13 (similarity does not establish transferability).
- `M17 CORRELATION CALLED CAUSE` — caught by case 14 (correlation is not reported as cause).
- `M18 DEPTH BUDGET IGNORED` — caught by case 08 (depth budget stops deeper relation traversal).

**Cannot prove:** relation quality, source admission or real-world causal truth. A typed `CAUSE` edge is preserved as source relation evidence only; the result format does not turn relation traversal into a verified causal conclusion. The search may miss candidates beyond its injected bounds.

## Commands run and output tails

Toolchain: Node `v22.16.0`; TypeScript compiler `5.8.3`; tests executed with the supplied toolchain's bundled `tsx` runner (`sh ../axon-toolchain/run-test.sh ...`).

| Command | Output tail / result |
|---|---|
| `sh ../axon-toolchain/run-test.sh tests/cortex04KnowledgeNeed.test.ts` | `CORTEX part 4 knowledge need passed: 14 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex05Methods.test.ts` | `CORTEX part 5 methods passed: 27 cases` |
| `sh ../axon-toolchain/run-test.sh tests/cortex06RelationReasoner.test.ts` | `CORTEX part 6 relation reasoner passed: 16 cases` (rerun after object-map correction) |
| Combined R1+R2 `tsc --strict --noEmit --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck` over all six CORTEX source and six test files | Exit 0; no diagnostics. |
| `sh ../axon-toolchain/run-test.sh tests/mindPipeline.test.ts` | `B1 mind pipeline tests passed: 246 checks` |
| `sh ../axon-toolchain/run-test.sh tests/meaningNoPhrases.test.ts` | `B03A NO-PHRASES GUARD OK: 111 files scanned, 227 checks` |
| `sh ../axon-toolchain/run-test.sh tests/brainBoundary.test.ts` | `B1 brain boundary passed: 6 allowed importers` (the six existing allow-listed importers printed by the test). |
| `python3 /tmp/run_cortex_r2_mutants.py` | All nine mutations `M10`–`M18` reported `CAUGHT`; each designated test exited 1 and its expected assertion was present. Mutated source was restored after each run. |
| TypeScript AST source-rule scan over `src/brain/mind/cortex/*.ts` | After correction: `CORTEX STATIC GUARDS: no regex literals; no arrays of 3+ string literals.` |
| R2 strict TypeScript rerun after correction | Exit 0; no diagnostics. |

The R2 hand-worked total is 57 cases (14 + 27 + 16). Nine deliberate mutants were caught. The post-delivery correction changes only the budget-key validation representation, not the contract or test oracle.

## `test:kernel` line to add

Do not edit `package.json` in this return. Append the following to the existing `test:kernel` command, after the R1 test additions:

```sh
&& tsx tests/cortex04KnowledgeNeed.test.ts && tsx tests/cortex05Methods.test.ts && tsx tests/cortex06RelationReasoner.test.ts
```

## NOT RUN

- The full `test:kernel` script and full repository test suite.
- Full-repository `tsc --strict`, build/lint and cloud workflow.
- `node tools/guard.mjs` (the three named brain guards were run individually).
- Live knowledge-source/archive admission, licence verification, source integrity, device/phone behaviour or chat wiring.
- Real Judgment, Foresight or exact-engine execution through production adapters; no real relation archive was queried.
- CORTEX parts 7–12 and returns R3–R4.
- Independent Director review and Director mutation testing.

## Contract deviations and limitations

- The standalone `CORTEX_FOR_CHATGPT_REASONING_SYSTEM.md` was absent from the attachments; the full pasted contract and D111 note were used instead.
- Part 4 uses the existing asynchronous KnowledgeSlot interface as-is; hits are labelled REPORTED because no independent verification signal is provided by that interface.
- Part 5 uses injected Judgment, Foresight, exact-engine and verifier adapters. Their implementations are not called or wired in this isolated return.
- Part 6 includes `CORRELATION` as its own typed relation so that it can be distinguished explicitly from `CAUSE`; it never converts correlation to cause.
- No live-behaviour claim is made. R2 is **ISOLATED-TESTED** only.
