# D47 PROMPT 5 OF 6: AUTO-CLICKER: RECORD A ROUTINE
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): Lets you record your own taps and scrolls into a draft routine instead of building it step by step.

WHAT YOU DO:
1. Do this only after prompt 4 is finished and merged.
2. Give this prompt to AI Studio exactly as shown between the two lines.
3. Bring the new file and the two changed files into the repository and run the cloud build.
4. On the phone: record three taps in Settings, come back, press Stop, open the draft, preview it and tell Director D47 whether the steps match what you did.

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 5 OF 6: AUTO-CLICKER: RECORD A ROUTINE
FROM: Director D47. FOR: AI Studio. SIZE: one job, 7 steps, one proof.

JOB: Let the owner record what they do (taps, long taps, scrolls and app changes) in AXON or other apps and turn it into a DRAFT routine they can edit and approve.

FILES:
- src/components/autoClicker/RecorderPanel.tsx  (named export RecorderPanel)
- CHANGE src/components/AutoClickerScreen.tsx and src/components/autoClicker/RoutineEditor.tsx (created by prompt 3; change only what the steps say)

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO: the current src/components/AutoClickerScreen.tsx and src/components/autoClicker/RoutineEditor.tsx (it will change them).

STEPS:
1. Create RecorderPanel.tsx with props { onDraft: (routine: unknown) => void; onClose: () => void }.
2. Explain on screen, in plain words: what IS recorded (taps, long taps, scrolls, app changes, by button name), what is NOT recorded (anything typed, passwords, money or password apps), and that a recording never runs by itself and must be reviewed and approved.
3. Scope choice: "Record in other apps" or "Record inside AXON". Before starting, load the installed apps with `await sys.controller.listApps()` and compute the money and password apps with sensitiveApps(apps) from '../../axon-apps/app-catalog.mjs'; pass their package names as blockedPackages.
4. Start recording calls `await sys.recorder.start({ blockedPackages })`; show "Recording..." with a Stop button and this instruction: "Leave AXON, do the things you want recorded, come back here and press Stop." If start returns { ok:false } show the code in plain words ("The AXON screen reader is not switched on." for accessibility-service-off, "Recording works inside the Android app only." for no-native-plugin).
5. Stop recording calls `await sys.recorder.stop({ name, scope })` (name from a field defaulting to "Recorded routine"). On { ok:true } show eventCount, the number of draft steps, the engine's notes (as given) and whether it was cut at 100 steps; on { ok:false } show the code in plain words.
6. Button "Edit and approve" calls onDraft(result.routine). In AutoClickerScreen.tsx add a "Record" button next to New routine that shows RecorderPanel, and pass the draft into RoutineEditor as an initial, UNSAVED routine (add an optional prop `initial?: unknown` to RoutineEditor; with it the editor starts filled in and marked "Not saved yet; needs approval").
7. A draft is never saved or approved automatically: the owner must Preview, Save and Approve as in prompt 3.

ENGINE SHAPES:
 recorder.start({ blockedPackages: string[] }) -> { ok: boolean, code?: string }
 recorder.stop({ name?: string, scope?: 'internal'|'external' }) -> { ok: true, eventCount: number, routine: unknown, notes: string[], truncated: boolean } | { ok: false, code: string }   (code 'not-recording' means start was never pressed)
 sensitiveApps(apps) -> the apps that are money, wallet or password apps (same function as prompt 2).
RULES SPECIFIC TO THIS PROMPT: never display recorded labels from blocked apps (the engine already drops them); never auto-start a recording; the Stop button must stay reachable.

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: In a browser, Start shows "Recording works inside the Android app only."; with a fake system (screenSystem.override) whose recorder.stop returns a two-step draft, "Edit and approve" opens the editor with those two steps filled in and the banner "Not saved yet; needs approval".

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
