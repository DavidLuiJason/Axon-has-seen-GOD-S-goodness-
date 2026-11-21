# D47 PROMPT 6 OF 6: SCREEN READER: ACTIVITY LOG AND SETTINGS
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): Adds the "what did AXON do" log and the settings that control how careful AXON is, as tabs on the Screen Reader screen.

WHAT YOU DO:
1. Do this only after prompt 5 is finished and merged (or earlier if you want the settings sooner: it does not depend on prompts 3 to 5).
2. Give this prompt to AI Studio exactly as shown between the two lines.
3. Bring the two new files and the changed ScreenReaderScreen.tsx into the repository and run the cloud build.
4. On the phone: open Screen Reader > Settings, change something, save, close and reopen the app to check it stayed; then run the Test tab again to make sure it still passes.

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 6 OF 6: SCREEN READER: ACTIVITY LOG AND SETTINGS
FROM: Director D47. FOR: AI Studio. SIZE: one job, 6 steps, one proof.

JOB: Add two tabs to the Screen Reader screen: a plain-words activity log of what AXON did, and the settings for how careful AXON is.

FILES:
- src/components/screenSystem/ActivityLog.tsx  (named export ActivityLog)
- src/components/screenSystem/PolicySettings.tsx  (named export PolicySettings)
- CHANGE src/components/ScreenReaderScreen.tsx (created by prompt 1): add a tab bar with Test, Activity and Settings; the Test tab keeps EVERYTHING it has now, unchanged

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO: the current src/components/ScreenReaderScreen.tsx (it will change it) and screenSystem/ApprovalDialog.tsx for the style.

STEPS:
1. Create ActivityLog.tsx: calls `sys.controller.log()` on open and on a Refresh button (no timer), shows the newest entries first as plain lines "time | text | outcome" (outcome as a text badge: done, failed, refused, asked, declined, stopped), and an empty state "Nothing yet." It never shows typed text (the engine keeps none).
2. Create PolicySettings.tsx: load `screenSystem.getPolicy()`; show Autonomy as three radio choices with their plain meanings: navigate = "AXON may scroll, go back, open apps and tap ordinary buttons by itself; anything risky, any typing and any switch asks you first. (recommended)"; ask-everything = "AXON asks you before every single action."; read-only = "AXON may only read the screen and never acts."
3. In the same file add two editable lists of package names: "Money and password apps (AXON always asks first)" and "Blocked apps (AXON never reads or acts in them)". Each list has an input with an Add button, a Remove button per entry, and a button "Pick from installed apps" that fills the input from `await sys.controller.listApps()` (a simple list to tap). The built-in money and password app detection stays on in addition to this list; say so.
4. Save button: `const r = await screenSystem.setPolicy({ autonomy, askPackages, blockedPackages })`. Show r.text when r.ok is false (code 'routine-running' means a routine is running: "Stop the running routine before changing these settings."), otherwise "Saved" or, when r.saved is false, "Applied for now, but could not be saved on this device". Add a "Reset to safe defaults" button (navigate, empty lists) that also needs the Save button.
5. Add a status panel on the Settings tab from `await sys.status()`: reader on/off, installed apps count, stop switch ready or not, and whether a routine is running.
6. Change ScreenReaderScreen.tsx: add a tab bar (Test, Activity, Settings) under the header; Test shows the existing content exactly as before (its state, labels and layout must not change, because the self-test reads those labels); Activity renders ActivityLog; Settings renders PolicySettings. Switching tabs must not run anything.

ENGINE SHAPES:
 controller.log() -> Array<{ at: number (ms since 1970), text: string, outcome: string }>
 screenSystem.getPolicy() -> { autonomy: 'navigate'|'ask-everything'|'read-only', askPackages: string[], blockedPackages: string[] }
 screenSystem.setPolicy(next) -> Promise<{ ok: boolean, saved?: boolean, text?: string, code?: string, policy?: object }>
IMPORTANT: the self-test in the Test tab finds its items by their exact labels (see prompt 1). Do not rename, move or hide anything inside the Test tab, and keep the Test tab as the first and default tab.

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: Open the Settings tab, change autonomy, add a package to each list, press Save: it says Saved (or the plain failure), reload the page: the same settings are shown; open the Test tab: it is exactly as before; open Activity: "Nothing yet." in a browser.

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
