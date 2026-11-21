# D47 PROMPT 2 OF 6: AXON APPS SCREEN AND APPROVAL DIALOG
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): The screen where you see your installed apps, search them, ask AXON to open one, and give apps your own names. It also adds the Yes/No question box that the next screens reuse.

WHAT YOU DO:
1. Make sure prompt 1 is finished and the Screen Reader self-test has passed on your phone (or Director D47 has fixed what failed). Do not start this prompt before that.
2. Give this prompt to AI Studio exactly as shown between the two lines.
3. Bring the three files (two new, one replaced) into the repository and run the cloud build.
4. Then open Tools > Device and System > AXON Apps on the phone and try: search, Open on Settings, Open on a bank app (it must ask first).

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 2 OF 6: AXON APPS SCREEN AND APPROVAL DIALOG
FROM: Director D47. FOR: AI Studio. SIZE: one job, 7 steps, one proof.

JOB: Build the "AXON Apps" screen: the list of installed apps, search, open an app, the owner's own names for apps, and ONE shared dialog that asks the owner a question and waits for Yes or No.

FILES:
- src/components/AxonAppsScreen.tsx  (a placeholder exists: REPLACE its content; named export AxonAppsScreen)
- src/components/screenSystem/ApprovalDialog.tsx  (named export ApprovalDialog, used by this and later screens)
- src/components/screenSystem/AppRow.tsx  (named export AppRow)

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO: src/components/BackgroundProofScreen.tsx, ScreenHeader.tsx, the finished ScreenReaderScreen.tsx (style reference from prompt 1) and the placeholder AxonAppsScreen.tsx.

STEPS:
1. Read src/components/BackgroundProofScreen.tsx, TextCounterScreen.tsx and ScreenHeader.tsx for the look (the placeholder AxonAppsScreen.tsx shows the frame).
2. Create ApprovalDialog.tsx: props { question: string; summary?: string; reason?: string; seconds?: number; onAnswer: (approved: boolean) => void }. It is a modal sheet showing the question, the summary and the reason as given, a Yes and a No button, and a visible countdown from `seconds` (default 60). When the countdown reaches 0 it calls onAnswer(false) once. It never shows typed text.
3. Create AppRow.tsx: one app row with the icon (or a letter circle), the name, the package name in small text, a text tag "System" when system is true, a text tag "Money or password app: asks first" when the app is flagged, and three actions: Open, App settings, Name it.
4. Replace the placeholder AxonAppsScreen.tsx with the real screen: on open call `await sys.controller.listApps()`; show a search box that calls `listApps(query)` as the owner types (wait 250 ms after the last key); show the rows; show plain empty and error states (see the code table below).
5. Open: call `await sys.controller.open(app.packageName)`. Handle every status: done (show "Opened", plus the package now showing when r.screen exists), opened-not-seen (show r.text), needs-approval (show ApprovalDialog with r.question, r.proposal?.summary and r.reason; on the answer call `await sys.controller.approve(answer)` and handle the new result the same way), ambiguous, not-found and failed (show r.text, never raw codes alone).
6. Name it: a small inline field "Your name for this app" calling `sys.profiles.setAlias(name, app.packageName)` then `await screenSystem.saveProfiles()`; a saved name is shown under the app name with a Remove link (`sys.profiles.removeAlias(name)` then saveProfiles()).
7. Icons: load lazily for rows on screen with `await sys.apps.getAppIcon(app.packageName, 96)`, keep them in one in-memory Map so a row never asks twice, and fall back to the letter circle when it returns { ok:false }.

ENGINE SHAPES:
 listApps(query?) -> { ok: boolean, apps: Array<{ packageName: string, label: string, system: boolean, self: boolean, category: string | null, versionName: string | null }>, code?: string }
 open(query) -> { ok: boolean, status: 'done'|'opened-not-seen'|'needs-approval'|'ambiguous'|'not-found'|'failed'|'refused', text?: string, code?: string, question?: string, proposal?: { summary: string, reason?: string }, screen?: { packageName: string }, candidates?: Array<{ label: string, packageName: string }> }
 approve(bool) -> the same shape as open().
 getAppIcon(pkg, size) -> { ok: boolean, png?: string }   (png is base64: use src={`data:image/png;base64,${png}`})
 openAppSettings(pkg) -> { ok: boolean, code?: string }
 Flag for "Money or password app": import { sensitiveApps } from '../axon-apps/app-catalog.mjs' and call sensitiveApps(apps) to get the flagged apps (match by packageName). The same function is used by the engine's gate.
 Plain words for list codes: 'no-native-plugin' -> "The app list works inside the Android app only."; any other code -> "AXON could not read the app list (" + code + ").".
 The engine's refusal and question wording must be shown as given.

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: In a browser the screen opens, shows "The app list works inside the Android app only.", the search box and Name it do not crash; with a test double for the system (screenSystem.override with a fake that returns two apps) a Money or password app row shows its tag and pressing Open on it shows the ApprovalDialog.

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
