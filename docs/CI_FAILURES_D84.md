# CI failures after CORTEX (D84, 2026-11-25/26). Measured on the same repo; "ORIG" = the zip before my edits.
FIXED in the D84 zip (each re-run green):
1. commitments.test.ts + outsideAi.test.ts type errors (tsc).
2. directorNap.test.ts: NOW.txt pointer restored.
3. capabilityTruth + liveAdmission: registerAxonTools.ts now has act.loan-calculator (finance.loan, proof liveBrainLoan passes) and act.split-bill (finance.split). Both tools were switched ON with no registry action.
4. brainGolden: the four ability-list messages (help, what can you do, What can you do?, what tools do you have?) now list the tools that are really available; regenerated on purpose, 79 messages pass. Nothing else in the fixture changed.
5. engineTruth map: added password-generator, loan-calculator, converter, text-compare, find-replace, each pointing at a live proof that passes (6, 6, 6, 6, 20 checks).
STILL RED, NOT FIXED, and why (all fail on the ORIG zip too; none touches CORTEX):
A. liveBrainCalculator, liveBrainPercentage, liveBrainTextCleaner, liveBrainRandomPicker, liveBrainDateCalculator, liveBrainSplitBill: the chat does not understand the verbs. Misses: "compute", "increase/decrease/raise ... by N%", "clean up/tidy", "flip/toss a coin", "add N days to DATE / date difference", "split 90 between 3 people with a 10% tip". These tools are ON but their own proofs fail. Cause is verb coverage in the dictionary, which is the dictionary job (LEX2) in NOW.txt. Because of A, engineTruth still names act.random-picker (I did not list unproven tools as proven).
B. Stale pinned counts, tools lane (D471): liveFacts (64 facts), liveSwitches (pinned ON list), tools (twelve groups), runnerRegistry (20 runners), wireGenerated (live tasks list). The tools work moved on and these pins were not updated.
C. autoclicker-native.test.mjs: axon_accessibility_strings.xml was reworded and no longer says "red STOP button". It is the user-facing accessibility disclosure, so I did not edit it or loosen the test; the owner of the Android overlay decides which one is right.
D. Android build #30: Maven Central answered 429 Too Many Requests while Gradle downloaded plugins. Not code. Re-run the build.
