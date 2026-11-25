# CI run #29 failures: who owns what (D84, 2026-11-25)
CORTEX merge touched only new cortex files, package.json, NOW.txt, MERGE_TAG.txt, INTAKE_LOG. It cannot cause failures 3 to 9.
FIXED BY D84 (in this zip):
1. tests/commitments.test.ts TS2367 (4 errors): the intent was cast to the single word 'replace'; now cast to all four intents. My own test (CCCS). Test still 3,094 groups, 0 failed.
2. tests/outsideAi.test.ts TS4104: copy of a readonly log; now cast through unknown. 28 checks, 0 failed.
3. directorNap.test.ts: NOW.txt lost the words DIRECTOR_NAP.txt when the CORTEX merge rewrote it. Restored; test passes (7 checks).
NOT D84's LANE (tools wave, D471 / whoever merged the Loan Calculator, Split and Tip and Password Generator screens). Measured here on the same repo:
4. liveAdmission: tool loan-calculator is ON (catalog status available) but has no available chat action.
5. capabilityTruth: kernel action finance.loan (src/tools/loanAction.ts) has no registry action linked to it.
6. engineTruth: act.password-generator is marked available in registerAxonTools.ts but has no proof file in PROVEN_AVAILABLE.
7. brainGolden: the "help" reply now lists more tools than tests/fixtures/brainGolden.json (follows from 4 to 6).
Fix in that lane: either link the chat actions and add proof tests, or set those catalog entries back to coming-soon until they are proven; then regenerate the golden "help" line on purpose.
8. autoclicker-native.test.mjs: strings.xml accessibility description no longer contains "red STOP button" (android-overlay; whoever edited it or the test).
