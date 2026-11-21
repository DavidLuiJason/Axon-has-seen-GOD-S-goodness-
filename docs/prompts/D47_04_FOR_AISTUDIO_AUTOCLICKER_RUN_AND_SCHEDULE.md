# D47 PROMPT 4 OF 6: AUTO-CLICKER: RUN, STOP AND SCHEDULE
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): Lets you start an approved routine, watch it, answer its questions, stop it at any moment, and schedule it.

WHAT YOU DO:
1. Do this only after prompt 3 is finished and merged and you have made one approved routine on the phone.
2. Give this prompt to AI Studio exactly as shown between the two lines.
3. Bring the two new files and the two changed files into the repository and run the cloud build.
4. On the phone: run a small routine in an ordinary app (for example scrolling Settings). Check the red STOP button appears over the other app, press it, and tell Director D47 what happened.

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 4 OF 6: AUTO-CLICKER: RUN, STOP AND SCHEDULE
FROM: Director D47. FOR: AI Studio. SIZE: one job, 7 steps, one proof.

JOB: Let the owner RUN an approved routine with a live log and a big STOP button, answer its questions, and set a schedule.

FILES:
- src/components/autoClicker/RunPanel.tsx  (named export RunPanel)
- src/components/autoClicker/ScheduleForm.tsx  (named export ScheduleForm)
- CHANGE src/components/AutoClickerScreen.tsx and src/components/autoClicker/RoutineList.tsx (they were created by prompt 3; change only what the steps say)

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO: the current src/components/AutoClickerScreen.tsx and src/components/autoClicker/RoutineList.tsx (it will change them), plus screenSystem/ApprovalDialog.tsx.

STEPS:
1. Create ScheduleForm.tsx: choose No schedule, Every N minutes (N 1..1440) or Daily at a time (HH:MM, 24-hour) with weekday checkboxes (Sunday=0 .. Saturday=6; none ticked means every day). The Save button calls `await sys.store.setSchedule(id, schedule)` where schedule is { kind:'every', minutes } or { kind:'daily', time:'HH:MM', days?: number[] }, or null for none. Show the engine's errors as given and this note: "Schedules run only while AXON is open. Running in the background is not proven yet."
2. In RoutineList.tsx add a Run button on routines that are Approved (hidden or disabled with the reason "Needs approval" otherwise) and a Schedule button that opens ScheduleForm.
3. Run flow: pressing Run opens a confirmation sheet showing the engine's `sys.runner.preview(routine)` lines, the scope, the repeat and the limits. For an "Other apps" routine add: "This routine acts in other apps. A red STOP button stays on screen while it runs." Only the sheet's own "Start" button starts it: `const r = await sys.runner.run(routine)` (load the routine with `await sys.store.get(id)` first).
4. Create RunPanel.tsx shown while a run is active: it subscribes with `screenSystem.subscribe(...)` to events { type: 'started'|'step'|'needs-approval'|'finished'|'scheduled-start', text?: string, status?: string, question?: string, loop?: number, index?: number } and appends plain lines; it shows a large "STOP" button (min height 64 px) that calls `await sys.runner.stop()`; it polls `await sys.status()` every 2 seconds for { running, stopRequested } and shows "Stop switch pressed on the phone" when stopRequested is true; it unsubscribes and clears its timer on unmount.
5. When run() (or answer()) resolves with status 'needs-approval', show the shared ApprovalDialog with r.question and then call `await sys.runner.answer(answer)`; repeat until the result is final. Never answer for the owner.
6. Show the final summary card: the status and the reason in plain words using the table below, the counts loops, actions and seconds (ms / 1000), and up to the last 10 log lines { at, text, outcome } (never typed text).
7. Add a switch "Run schedules while this screen is open" (off by default, kept only in React state). When on, call `startSchedulerLoop(sys.scheduler)` from '../../axon-autoclicker/routine-scheduler.mjs' (it returns a stop function: call it when the switch is turned off and on unmount).

RESULT SHAPES:
 run(routine) / answer(bool) -> { status: 'finished'|'stopped'|'failed'|'needs-approval'|'not-approved'|'invalid'|'refused'|'busy'|'nothing-pending', reason?: string, loops?: number, actions?: number, ms?: number, log?: Array<{ at: number, text: string, outcome: string }>, question?: string, errors?: string[] }
 Plain words for reason (show these; for any other value show the raw reason after "Stopped: "):
  completed = "Finished all rounds."; owner-stop = "You pressed STOP."; stop-button = "The red STOP button was pressed."; time-limit = "The time limit was reached."; action-limit = "The action limit was reached."; stuck = "The screen stopped changing, so AXON stopped."; left-app = "The app in front changed, so AXON stopped."; three-failures-in-a-row = "Three steps in a row failed."; kill-switch-unavailable = "The phone stop switch is not available, so AXON stopped."; declined = "You said no."; question-timed-out = "The question was not answered in time."; stop-control-unavailable = "The red STOP button could not be shown, so the routine did not start."; names starting with gate-refused: = "AXON's safety rules refused a step."
 status 'not-approved' -> "This routine is not approved, or it was changed after approval." ; 'invalid' -> list r.errors ; 'busy' -> "Another routine is running."
RULES SPECIFIC TO THIS PROMPT: nothing starts without the owner pressing Start on the confirmation sheet; the STOP button must be reachable at all times while running; a routine may only be run from a saved, approved copy (never from unsaved editor content).

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: In a browser (no phone) pressing Run on an approved routine and Start shows the engine's plain refusal (for external routines "The red STOP button could not be shown, so the routine did not start."), the screen never hangs, the STOP button and the live log render, and unmounting the screen leaves no timer or subscription running.

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
