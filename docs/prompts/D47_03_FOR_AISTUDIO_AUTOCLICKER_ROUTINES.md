# D47 PROMPT 3 OF 6: AUTO-CLICKER: MAKE AND APPROVE ROUTINES
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): The Auto-Clicker tool: make, preview, save and approve routines. Running them comes next.

WHAT YOU DO:
1. Do this only after prompt 2 is finished and merged. (The Auto-Clicker tool is already in the menu.)
2. Give this prompt to AI Studio exactly as shown between the two lines.
3. Bring the four files (three new, one replaced) into the repository and run the cloud build.
4. Then on the phone open Tools > Device and System > Auto-Clicker and create, preview, save and approve a small routine.

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 3 OF 6: AUTO-CLICKER: MAKE AND APPROVE ROUTINES
FROM: Director D47. FOR: AI Studio. SIZE: one job, 7 steps, one proof.

JOB: Build the "Auto-Clicker" tool screen where the owner makes routines (named lists of taps, swipes, typing and waits), previews them in plain words, saves them and approves them. Running comes in prompt 4.

FILES:
- src/components/AutoClickerScreen.tsx  (a placeholder exists: REPLACE its content; named export AutoClickerScreen; owns the view state list | edit)
- src/components/autoClicker/RoutineList.tsx
- src/components/autoClicker/RoutineEditor.tsx
- src/components/autoClicker/StepForm.tsx

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO: BackgroundProofScreen.tsx, ScreenHeader.tsx, ScreenReaderScreen.tsx, AxonAppsScreen.tsx, screenSystem/ApprovalDialog.tsx (style and dialog references) and the placeholder AutoClickerScreen.tsx.

STEPS:
1. Read BackgroundProofScreen.tsx, ScreenHeader.tsx and the finished ApprovalDialog.tsx for the look and the dialog style.
2. Create RoutineList.tsx: on open call `await sys.store.list()`; show one card per routine with the name, "Inside AXON" or "Other apps" (text), "Approved" or "Needs approval" (text), the number of steps, the schedule in words (or "No schedule") and the last run time (or "Never run"); buttons Edit and Delete (Delete asks "Delete this routine?" first and calls `sys.store.remove(id)`); a New routine button and a clear empty state.
3. Create StepForm.tsx: one step editor covering every step kind with the fields in the table below; show only the fields that kind needs.
4. Create RoutineEditor.tsx: name, scope choice, optional app package (other apps only), repeat controls, limits (inside a collapsed "Safety limits" section), the ordered steps (add, remove, move up, move down), a Preview button, a Save button and an Approve button.
5. Preview calls `sys.runner.preview(routine)`: show the engine's lines (numbered) with scope, repeat and limits when ok, otherwise show EVERY error string as given. Save calls `await sys.store.save(routine)` and shows errors the same way; after a successful save keep the returned routine.id.
6. Approve: enabled only when the last Preview was ok, the routine was saved, and nothing was edited since. It explains "Approving locks this exact routine. Any change cancels the approval." and calls `await sys.store.approve(id)`. Any edit after that visibly returns the routine to "Needs approval" (track a dirty flag).
7. Replace the placeholder AutoClickerScreen.tsx with a screen that switches between RoutineList and RoutineEditor and passes onLogoClick to the header. No Run button yet.

ROUTINE JSON (the engine validates it; build exactly this):
 { id?: string, name: string (1-60 chars), scope: 'internal' | 'external', packageName?: string (external only, optional),
   steps: Step[] (1-100), repeat: { count: number (1..100000) } | { forever: true }  plus intervalMs (>= 150, default 1000) and jitterMs (0..half the interval, default 0),
   limits: { maxRuntimeMs (default 600000), maxActions (default 500), stuckAfter (default 5) }, preapprove: number[] (step indexes, 0-based) }
 Step = { kind, delayAfterMs?: number (0..60000), optional?: boolean, ... } with these kinds and fields:
  tap | long-press | toggle : target
  type                      : target (a text field) and text (1..500 chars)
  scroll                    : direction 'up'|'down'|'left'|'right', optional target
  swipe                     : from {fx,fy}, to {fx,fy} (fractions 0..1 of the screen), durationMs (100..3000)
  tap-point | long-press-point : at {fx,fy}
  back | home               : nothing
  open                      : app (a name or package; NOT allowed in an "Inside AXON" routine)
  wait                      : ms (0..60000)
  wait-for                  : until { text? | textGone? | package? | idleMs? } and timeoutMs (500..120000)
 target = { label?: string, aliases?: string[], meaning?: string (owner's own words about what the button does), role?: 'button'|'input'|'text', fallbackPoint?: {fx,fy} } and needs at least one of label, aliases, meaning or fallbackPoint.
Engine shapes:
 store.list() -> Array<{ id, name, scope, approved: boolean, steps: number, schedule: object | null, lastRun: number | null }>
 store.get(id) -> routine | null     store.save(routine) -> { ok, routine?, approved?, errors?: string[] }     store.approve(id) -> { ok, errors? }     store.remove(id) -> { ok }
 runner.preview(routine) -> { ok: true, scope, repeat: string, everyMs: number, limits: object, lines: string[] } | { ok: false, errors: string[] }
Form rules:
 - Typing text is entered in a masked field with a "Show" toggle and is NEVER echoed in the preview, the list or any message (the engine already hides it).
 - On type and switch steps add the checkbox "Do not ask me when this step runs" (this fills preapprove). Explain beside it: "Anything that pays, sends, deletes or signs in, and money or password apps, always ask, whatever you tick." Do NOT offer it on any other step kind.
 - Explain scope in one line each: "Inside AXON: the routine only touches AXON's own screens." and "Other apps: the routine acts in other apps. A red STOP button will stay on screen while it runs."
 - Every validation message comes from the engine; do not invent your own.

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: Create a routine called Demo with one tap step labelled "AXON test button", press Preview (see numbered lines), Save, Approve: the list shows "Approved"; change one step: the list and editor show "Needs approval"; reload the page: the routine is still there (it is kept by the engine).

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
