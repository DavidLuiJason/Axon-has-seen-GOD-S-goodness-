# D47 PROMPT 1 OF 6: SCREEN READER TEST SCREEN
FOR THE OWNER (not part of the prompt)

WHAT THIS PROMPT DOES (plain words): One new screen that checks whether AXON can see and act on the phone, with a built-in test area. It is the proof for all the screen-reading work.

WHAT YOU DO:
1. Give this prompt to AI Studio exactly as shown between the two lines.
2. Bring the changed file src/components/ScreenReaderScreen.tsx into the repository the way you normally do (it replaces the placeholder and must be the ONLY file). Run the cloud build.
3. The tool is already in the menu (the slots and activation zips are merged), so nothing else is needed. On the phone: install, turn on "AXON screen reader" in Accessibility settings, open Tools > Device and System > Screen Reader, tick the typing box, press Run self-test, press Copy report and paste it to Director D47.

=====PASTE INTO AI STUDIO FROM THE NEXT LINE=====
### 00.6 The Standard Prompt Preamble (the Director pastes it, unchanged, at the top of EVERY prompt for Grok, AI Studio or any other tool)
"Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix."

---------------------------------------------------------------------
D47 PROMPT 1 OF 6: SCREEN READER TEST SCREEN
FROM: Director D47. FOR: AI Studio. SIZE: one job, 7 steps, one proof.

JOB: Build ONE new screen, "Screen Reader", that shows whether AXON can read the phone screen and runs the phone self-test. This screen is also the proof for everything D47 built, so its labels must be EXACT.

FILES:
- src/components/ScreenReaderScreen.tsx  (a placeholder exists: REPLACE its content; named export ScreenReaderScreen)

WHAT ALREADY EXISTS (built and tested by Director D47; do NOT edit any of it):
- src/axon-system/screen-system-singleton.ts exports `screenSystem`, the ONE shared screen system for the whole app. Use it like this:
    import { screenSystem } from '../axon-system/screen-system-singleton';   (path from src/components/X.tsx; use '../../axon-system/...' from a sub-folder)
    const sys = screenSystem.get();                 // the shared system (never build your own)
    const off = screenSystem.subscribe((event) => { ... });   // routine events; call off() when the screen closes
    screenSystem.getPolicy();  await screenSystem.setPolicy(next);  await screenSystem.saveProfiles();
- The engines are plain JavaScript (.mjs) with no types. Treat every engine result as `unknown`, declare small local interfaces for the fields you use (they are listed below), and cast ONCE at the engine boundary. Never edit src/screen-intelligence, src/axon-apps, src/axon-autoclicker, src/axon-system or android-overlay.
- Everything works on a plain browser too: without the Android app every call returns a safe "not available" result (for example { ok:false, code:'no-native-plugin' }). The screen must show that in plain words and must never crash or hang.

FILES TO SHOW AI STUDIO (attach or paste): src/components/BackgroundProofScreen.tsx, src/components/TextCounterScreen.tsx, src/components/ScreenHeader.tsx and the placeholder src/components/ScreenReaderScreen.tsx. Nothing else is needed.

STEPS:
1. Read src/components/BackgroundProofScreen.tsx, src/components/TextCounterScreen.tsx and src/components/ScreenHeader.tsx and copy their page frame, header use and card pattern.
2. Replace the placeholder src/components/ScreenReaderScreen.tsx with the real screen: export const ScreenReaderScreen: React.FC<{ onLogoClick: () => void }>.
3. On open (and after every run) call `await sys.status()` and show three plain lines: "Screen reader: ON" or "Screen reader: OFF"; "Installed apps: N" (or "not available" when appCount is null); "Stop switch: ready" or "Stop switch: not available". Add a button "Open Accessibility settings" that calls `await sys.screen.openSettings()`.
4. Build the CONTROL ROW then the TEST AREA exactly as specified below (checkbox, Run button, then the Test area card).
5. The Run button calls `await sys.selfTest({ approveTyping })` once per press, is disabled and reads "Running..." while it runs, and never runs by itself.
6. Below the Test area show the result: the summary line, then one row per line with a TEXT badge PASS, FAIL or SKIP, the step name and its text. Add a button "Copy report" that copies "STATUS | step | text" lines plus the summary to the clipboard (try navigator.clipboard; if it fails show the same text in a selectable read-only box).
7. In a plain browser the screen must still open, show "Screen reader: OFF", and the Run button must show the engine's FAIL row and its help text.

EXACT LAYOUT (top to bottom). The self-test finds items by their labels and can only use items that are fully on the visible screen, so keep the Control row and the whole Test area inside ONE phone screen at 360 x 640 (results go BELOW, not above):
 A. Header, one short intro paragraph: "This test makes AXON read this very screen, read the words in a picture, and tap a button for you. First turn on AXON screen reader in Android Settings > Accessibility."
 B. Status lines and the "Open Accessibility settings" button.
 C. CONTROL ROW: checkbox with the label "I approve the typing test", then the button "Run self-test".
 D. TEST AREA card containing EXACTLY these real DOM elements (no canvas), with EXACTLY this wording:
    - a text element whose whole text is `Test taps: 0` (React state number inside the same text node: {`Test taps: ${taps}`})
    - a button with the visible text `AXON test button` that adds 1 to the counter
    - a button with the visible text `Delete test item` that only shows the message "Nothing was deleted. This button is only a test." (it must never delete anything)
    - a text input with placeholder="AXON test field" and aria-label="AXON test field"
    - a password input (type="password") with placeholder="AXON test password" and aria-label="AXON test password"
    - an <img> with alt="AXON test picture", about 300 x 120 CSS px, src = an inline SVG data URL: white background and the words AXON READ 47 in large plain black sans-serif letters (no decoration)
 E. RESULTS (summary, rows, Copy report) below the Test area.
Engine shapes you may rely on:
 status -> { readerOn: boolean, canAct: boolean, appCount: number | null, appsCode: string | null, stopRequested: boolean, killSwitchAvailable: boolean, running: boolean }
 selfTest -> { passed: boolean, summary: string, lines: Array<{ step: string, status: 'PASS' | 'FAIL' | 'SKIP', text: string }> }

RULES FOR EVERY FILE YOU WRITE:
1. Create or change ONLY the files listed under FILES. Three screen files already exist as small placeholders (src/components/ScreenReaderScreen.tsx, src/components/AxonAppsScreen.tsx, src/components/AutoClickerScreen.tsx): when a prompt lists one of them, REPLACE its whole content with the real screen, keeping the same file name, the same named export and the same props. Wiring (App.tsx, the tool catalog, tests, capabilities, the menu) is already done by Director D47: do NOT add or touch it.
2. Look and layout: copy the page frame and cards of src/components/BackgroundProofScreen.tsx and use the shared header exactly as src/components/TextCounterScreen.tsx does: `import { ScreenHeader } from './ScreenHeader';` with title, tagline and onLogoClick. Reuse the Tailwind classes and colours already used in those two files. No new colours, no new fonts, no new design tokens.
3. TypeScript is STRICT in the cloud build: no implicit any, no unused imports or variables, typed event handlers and props, no non-null assertions on engine results.
4. Only React and lucide-react. No new packages, no network calls, no localStorage of your own, no setInterval that keeps running after the screen closes (clean up in useEffect).
5. Status is shown as TEXT, never by colour alone. Touch targets at least 44 px. Works at 360 px wide.
6. Never display, log or store typed text or passwords. Show the engine's own words for questions, refusals and errors; do not rewrite or soften them.
7. Opening a screen only READS status. Nothing acts, taps, types or runs until the owner presses a button.
8. Named export exactly as given, props exactly `{ onLogoClick: () => void }` for a top-level screen.

ONE PROOF: Open the screen in a browser: it renders without errors, shows "Screen reader: OFF", the Test area shows the six items with the exact labels, pressing "Run self-test" shows a FAIL row for "Screen reader is on" with its help text, and nothing crashes.

WHEN YOU FINISH, reply with: (a) the list of files you created or changed, (b) anything in this prompt you could not do or did differently, and why. Do not claim it was tested on a phone.
=====PASTE INTO AI STUDIO UNTIL THE LINE ABOVE=====
