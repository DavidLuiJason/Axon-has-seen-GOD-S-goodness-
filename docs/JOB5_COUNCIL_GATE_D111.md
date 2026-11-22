# JOB 5 (council) finished by D111 from D926's half-done work, plus the red-build fixes of run #21

Evidence labels: MEASURED = run here on the main zip taken 2026-11-22 08:05 plus this change (jszip is NOT installed in the Director sandbox; a throwaway stub was used only so tool registrations load; it is not in the package). NOT RUN = not executed.

## 1. Job 5: the council
- Before: judgment (judge.ts, the eight seats) ran for EVERY tool answer, even a plain count. Nothing told the owner what it decided.
- NEW `src/brain/mind/orchestrator/councilGate.ts` (pure, no phrases, no regular expressions):
  - `needsCouncil(proposal)`: false only for a plain, reversible read, read clearly (HIGH), evidence not disputed, permission allowed, no missing input. Anything else convenes the council.
  - `NOT_CONVENED`: the verdict a skipped council stands for (PROCEED, no flags). Test C03 proves it equals what the council itself would say.
  - `plainCouncilNote(verdict, tool)`: ASK / STOP / warning become one plain sentence group. A plain PROCEED says nothing. Raw judgment objects are never shown.
- `orchestrator.ts`: skips or convenes the council; in mode `on` and for a non-PROCEED verdict the reply gets "Council note: ..." (the tool already ran, so the answer is kept); a council that throws or refuses is counted (`councilFailed`) and never touches the answer. New counters: councilConvened, councilSkipped, councilFailed, councilNotes. New option `judge` lets tests inject a failing council.
- Admission fact (test C06/C07): every tool switched ON today gets a plain PROCEED, so chat shows no council note today. Converter declares a file write, so it convenes the council and passes (C07b).
- LIMIT (unchanged, honest): the council still judges AFTER the tool ran. A gate BEFORE a tool runs needs Job 7 (planner, a plan-only step).
- `tests/council.test.ts`: 28 checks, 0 failed. D926's draft had one wrong assumption (C07 said every ON tool is a plain read); converter writes a file, so C07 now says "gets PROCEED" and C07b pins that converter convenes it.

## 2. Red-build fixes (run #21, commit a58c99b)
1. TYPE CHECK (new in #21): `tests/situation.test.ts` imported `withOrchestrator` twice (D926's file met D111's import). One line removed. `tsc` over the touched files: clean (the sandbox has no node_modules, so the whole-project run shows only missing-type noise; the touched files show no real error).
2. liveAdmission, capabilityTruth (loan ON without a chat action): added chat actions `act.loan-calculator` (link finance.loan) and `act.split-bill` (link finance.split) in `registerAxonTools.ts`. Examples are messages the brain really answers (taken from liveBrainLoan / liveBrainSplitBill). Both tests now pass (liveAdmission 50 checks). Also fixed `loanAction.ts`: the term question said "in milliseconds"; it now says "in years".
3. brainGolden: only the four ability-list replies changed (they now list Loan calculator and Split a bill); regenerated from the real brain; the other 75 messages are untouched. Passes: 79 messages, 242 field checks.
4. feed2RealSchemas: `irreversible x persistent` (auto-clicker) added to the reviewed kinds. The test's own loops prove that row is never acted on silently. Passes: 21364 checks.
5. engineTruth: the proof list had no entry for 11 available actions; each now names its existing live-brain test. It now stops LATER, at "available catalog tool has a registry entry: axon-apps": the catalog says AXON Apps is available but `src/main.tsx` never calls `registerAxonAppsCapability()` (same note D111 left for D47). That is the Apps Director's decision (it changes what chat lists), so it stays red and is reported.

## 3. NOT fixed, not mine (all fail the same way on the untouched zip, MEASURED)
- `autoclicker-native.test.mjs`: `axon_accessibility_strings.xml` no longer contains "red STOP button" (the accessibility description was reworded). Native/Android lane.
- Pinned-list tests of the tool waves, red on the untouched zip: liveSwitches, liveFacts, runnerRegistry, tools, wireGenerated, liveBrainCalculator, liveBrainDateCalculator, liveBrainPercentage, liveBrainRandomPicker, liveBrainSplitBill, liveBrainTextCleaner. They are stale counts or binder gaps of tool waves 3a/3b. The CI summary only prints the last 25 lines, so it shows fewer reds than exist.
- THE FAILURE OF RUN #21 IS THE ANDROID STEP (log step 9, "Build the Android debug APK", exit code 1, 16 min), not the type check or tests (STRICT_CHECKS is false, so those only warn). The summary does not contain the Gradle error, and no code here touches Android, so the cause is UNKNOWN. Needed: in the run's log, open "9. Build the Android debug APK" and copy the lines around "FAILURE:", "What went wrong:" or "error:". Run #17 built the APK on an earlier commit; other Directors' Android overlay changes landed between.

## 4. Tests run here
council 28/28, situation 18/18, orchestrator 232, orchestratorOnChat 33, orchestratorConnection 39, feed2RealSchemas 21364, liveAdmission 50, brainGolden 79, capabilityTruth OK; 71 brain/tool test files run: 59 pass, 12 red, all 12 red on the untouched zip too. NOT RUN: cloud build, whole-project tsc, phone, full test:all.
