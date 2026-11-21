# D47 SCREEN PROMPTS: READ ME FIRST
From Director D47, 2026-11-17. For the owner and for the Directors who touch the same files.

## 1. WHAT TO DO NOW (short)
1. Merge AXON-D47-5-PLACEHOLDERS-AND-DOCS-merge.zip. It adds three small placeholder screens (so the menu entries that are already merged open a screen instead of breaking the build) plus these prompts and my notes. It touches no shared file.
2. Run the cloud build. Send Director D47 the result (green, or the error text).
3. Run the Find a file workflow with `ScreenReaderScreen` and with `D47_01`. Both must be found.
4. Then give AI Studio prompt 1 (docs/prompts/D47_01_..., or the AISTUDIO_D47_01 file). Do the prompts IN ORDER, one at a time. Each prompt file tells you exactly what to do, in numbered steps, above the paste block.

## 2. THE SERIES (six small prompts, one job each, at most seven steps, one proof: roadmap Rule 4)
| # | Job | AI Studio writes | Gate before the next one |
|---|-----|------------------|--------------------------|
| 1 | Screen Reader test screen (the phone proof) | replaces ScreenReaderScreen.tsx | GATE A: the self-test report from the phone is PASS (or D47 has fixed what failed) |
| 2 | AXON Apps + the shared Yes/No dialog | AxonAppsScreen.tsx (replaces), ApprovalDialog.tsx, AppRow.tsx | Open works on the phone; a bank app asks first |
| 3 | Auto-Clicker: make and approve routines | AutoClickerScreen.tsx (replaces), RoutineList, RoutineEditor, StepForm | a routine is saved, approved, survives a restart |
| 4 | Auto-Clicker: run, STOP, schedule | RunPanel, ScheduleForm, changes to 2 files from prompt 3 | the red STOP button works on the phone |
| 5 | Auto-Clicker: record | RecorderPanel, changes to 2 files | a recording gives a sensible draft |
| 6 | Screen Reader: activity log and settings | ActivityLog, PolicySettings, change to ScreenReaderScreen.tsx | settings survive a restart; the Test tab still passes |
AI Studio never edits wiring, tests or engines: only the files each prompt lists. Director D47 did all wiring and test updates already (zips 1 to 4, merged by you).

## 3. YOUR QUESTION: WHERE DOES THE AUTO-CLICKER LIVE?
Recommendation (D47): a NEW TOOL inside the EXISTING group "Device and System", beside Background Proof and Device Profile, not a new sector. Reasons: it acts on the phone, like that group's other tools; a new group would add a menu row for three tools; the roadmap's menu is built around groups of what a tool is about. AXON Apps and Screen Reader sit in the same group as their own tools. If you prefer a new sector later, only the group id in toolCatalog.ts and the group list change (one small Director job).

## 4. D47 TOP-VIEW CHECK (roadmap 00.4) FOR THIS SERIES
T1. Layer 5 (Reach), tool screens. Below: the engines (built, tested on a fake phone) and the Android Java (compiled only against stand-in classes) and the phone itself (not proven). Above: chat and brain control of these tools (D471), background running (stage 6.x).
T2. Later additions: brain actions for apps and routines; background ticking of schedules; app-specific know-how; picture recognition beyond reading words. Size: a routine is at most 100 steps; routines are kept in one localStorage key capped at 400,000 characters; the screen tree is capped at 400 nodes; a picture read takes one in-memory screenshot. Time and memory costs per second and per file: NOT MEASURED on a phone.
T3. Yes: tapping the same thing again and again by hand is exactly what the Auto-Clicker replaces; it should be listed in the Repetition Register by the Director who keeps it.
T4. The last two stages taught: shared files get overwritten when a zip carries an older whole copy (NAP N18), and adding a tool touches many tests. So this series uses new files only for AI Studio, and D47 made the wiring with a scripted, test-proven pipeline. Not a third attempt at the same thing.
T5. Rule 12 and 13: the engines use app package names and on-screen labels, not file paths, so they do not depend on today's files. BUT routines and app names are kept in localStorage and are NOT yet part of the Backup and Restore tool: they will not survive a move to a new phone. Open item for the owner (see section 7).
T6. Laws applied: Rule 4 (one job, few steps, one proof), Rule 11 (room for later additions), Rule 12 and 13 (above), FL4 (fewest prompts and owner actions that stay safe), the Placement Law, 7R permissions (reading allowed; typing, switches, paying, sending, deleting, signing in ask), and "screens come from AI Studio, Directors write exact prompts". Only laws D47 knows it applied are listed.
T7. Fewer prompts: six instead of three because Rule 4 caps one job at seven steps; the owner does four actions per prompt. Prompts 5 and 6 can be skipped or merged if you want fewer steps. Wiring was moved out of AI Studio into D47's zips, which removed the riskiest AI Studio steps.

## 5. D47 FOUNDATION CHECK
(1) Layer: tool screens over the screen system. Below it is NOT proven on a phone, so by the Foundation Rule the lower step comes first: that is why prompt 1 is the phone proof and GATE A stops everything else until it passes. You decided on 2026-11-17 that screens go ahead; GATE A keeps that safe.
(2) Carries: one new screen file or a few per prompt (9 to 10 KB prompts); the app has no measured limit on screens; the engines hold routines in localStorage (cap 400,000 characters). Measured: prompt sizes and caps by D47 (MEASURED); phone memory and time (NOT MEASURED).
(3) One job for one builder: yes for each prompt; 6 to 7 steps; the single proof is stated at the end of each prompt.
(4) What could go wrong: AI Studio edits a file it should not; labels in the test area drift so the self-test cannot find them; the build fails on strict types. Cheap tests: reply format asks AI Studio to list every file it touched; prompt 1 spells the labels out exactly; D47 reads the result before the next prompt.
(5) Done means: the build is green, the listed files are the only ones changed, the proof in the prompt works in a browser, and (for prompt 1) the phone report is PASS. D47 can check by file list and by the report.
(6) If it fails: send D47 the build text or the report; the smallest next step is one fix to one file, never a new random fix.
(7) Added later: chat control and background running (no rewrite: the screens only call the shared holder), more apps know-how, Backup of routines.

## 6. WHAT D47 CHANGED IN SHARED FILES (so other Directors know)
In zips 1 to 4 (already merged): src/tools/toolCatalog.ts (three tools in Device and System; now available), src/brain/mind/schema/actionSchemas.ts (three schema rows), tests/fixtures/toolFacts.json and brainGolden.json (new facts and a help line each, "screen only"), src/main.tsx (six register calls), src/App.tsx, src/state/axonState.ts, src/state/storage.ts (three screen ids), src/components/AxonToolsScreen.tsx (icons), and the tests that pin tool counts and names (tools, liveFacts, engineTruth, resolveOptionsRunner, capabilityTruth, needCases, toolRequestAccuracy, brain, brainGolden, meaningA). The brain's help message now lists "Screen Reader: screen only", "AXON Apps: screen only", "Auto-Clicker: screen only". Chat control of these tools is D471's lane.

## 7. OPEN OWNER DECISIONS
Default autonomy (navigate); the money and password app name list; whether routines and app names should join Backup and Restore; the missing Click Assistant features; whether prompts 5 and 6 are wanted now.
