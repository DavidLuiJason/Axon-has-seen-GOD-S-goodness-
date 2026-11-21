# JOBS 3 + 4 (+ 6a) (D111): the orchestrator is ON in real chat

Evidence labels: MEASURED = run here on main_2 + the Job 0/1 merge + this change (jszip is NOT installed in the Director sandbox; a throwaway stub let the tool registrations load and is not in the package). NOT RUN = not executed.

## 1. What now happens in real chat (mode pinned to 'on' in src/brain/orchestratorMode.ts)
Four things can differ from the plain brain; everything else is the brain's own reply (same object):
1. REPAIR (Job 3). A grammar slip or a doubled request is repaired, SAID OUT LOUD ("I read your message as: ..."), and answered. Text inside quotes is never touched (spaces, line breaks, repeated words, open quote: all MEASURED unchanged). Repair is one pass only: repairing a repaired text changes nothing, so a repair cycle cannot form.
2. RISKY REPAIR ASKS (Job 3 + 6a). "Did you mean: ...?" is now remembered. yes runs the repaired reading, no runs the owner's exact words, cancel drops it, any other message drops the question (it is never asked twice, never resurrected two turns later), a new chat clears it. Before this job the question was a dead end: the owner's "yes" went nowhere.
3. "WHICH TEXT?" (Job 6a; it existed in the orchestrator, now proven in real chat). A tool found without its text asks once; the next message is the text; cancel drops it; a new request is answered instead of swallowed; it expires after 3 turns; a new chat clears it.
4. FAILED RECHECK HELD BACK (Job 4). A tool answer whose independent recheck FAILS is replaced by "I ran X, but my own re-check did not match its answer, so I am not giving you that result. Nothing was changed." An answer with no independent check (UNCLEAR, e.g. hash tool) is shown as the tool said it, never labelled verified.

## 2. Changed files
- src/brain/orchestratorMode.ts: 'shadow' -> 'on'. KILL SWITCH: set it back to 'shadow' (or 'off') and chat is exactly the plain brain. The wrapper also falls back on any orchestrator failure.
- src/brain/mind/orchestrator/orchestrator.ts: new branch "1a" (yes/no repair follow-up) and `pendingRepair` state (cleared by reset, by any other message, and when a text question replaces it).
- tests/orchestratorConnection.test.ts: pins updated (A01 'on', A05, C01).
- NEW tests/orchestratorOnChat.test.ts: 33 checks through `sendQueryToAxonBoundary` (the real door), compared with the plain brain.
- docs: this file; docs/JOB1_ORCHESTRATOR_CONNECTION_D111.md got a pointer line.

## 3. Evidence (MEASURED)
- orchestratorOnChat 33 checks, 0 failed; orchestratorConnection 39, 0 failed; orchestrator 227; brainEndToEnd 187.
- Four deliberate defects, each caught: no yes/no branch (4 checks fail), failed recheck not held back (1), stale repair question survives (2), probe also runs the tool (1). Restored: 0 failed.
- On the 79-message golden transcript 'on' answers identically to the plain brain except one intended "Which text?" question (the other three differences were shared lexicon state in my measuring script, not the orchestrator).
- test:kernel list + the 2 new tests: 158 pass, 7 fail, the SAME 7 that fail on the untouched main_2 (capabilityTruth, liveAdmission, liveFacts, liveSwitches, resolveOptionsRunner, tools, valueEvidenceRunner). 55 further brain-related tests outside the list: 49 pass, 6 fail, all 6 also fail on untouched main_2 (feed2RealSchemas, liveBrainCalculator, liveBrainDateCalculator, liveBrainPercentage, liveBrainRandomPicker, liveBrainTextCleaner). All 13 are tool-wave (wave 3) drift, not caused by this job; NOT fixed here (Job 11 / Job 13).
- NOT RUN: cloud build, whole-project tsc (orchestrator.ts and the new files are strict-clean), phone, the four jszip tests, the rest of the 62 tests outside the list.

## 4. Known issues and limits
1. Verification covers lane answers only (source `runner:*`). Answers from `local-rules`, `english-dictionary`, `foundation` are never rechecked; hash-tool and converter have no independent check (UNCLEAR). Widening this is not done.
2. Legacy handler quirk (found, not fixed): in real chat "sort the lines" and "enumerate the tokens in the quick fox" are answered by the old `local-rules` text counter as a word count of those very words. Belongs to Job 13.
3. Binder gaps remain (Job 13): `calculate "12*3"`, "what is 15% of 80" do not reach their tools; the six liveBrain* tests above are the proof.
4. Judgment inside the orchestrator only sees a harmless READ proposal for tool answers; council, planner, external AI are still not in chat (Jobs 2, 5, 7, 9).
5. The orchestrator keeps its own dialogue state beside the Mind's shadow dialogue; harmless while the Mind's is shadow only.
6. Not measured on a phone. If anything looks wrong in chat, flip the pin and report the message.
