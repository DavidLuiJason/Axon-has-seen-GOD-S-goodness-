# AXON Web: D204 port of ChatGPT R4 fixes (2026-11-22)
From D204 (AXON Web engines). Base: newest repo zip (Axon-has-seen-GOD-S-goodness--main), which holds D56's round-3 native bridge.
ChatGPT's whole R4 patch was NOT merged: it did not apply (8 of 32 files conflicted), kept the separate full-screen BrowserActivity, and touched shared files (.nvmrc, tools/run-tests.mjs, build script, a second workflow).

## What this package changes (11 files, nothing deleted, no shared file touched)
1. Stealth vs Incognito (Java): BrowserActivity rejects incognito+stealth together; stealth only on a normal tab (stealth persists, incognito does not). browserController 'tabs.create' rejects the same mix.
2. Cold start (Java + TS): BrowserPlugin.open() reports activityCreated; BrowserActivity accepts a first-tab kind/stealth extra; NativeWebUiService adopts the fresh Activity's single normal tab instead of creating a duplicate.
3. Teardown guard (Java): getState() checks the WebView is not null before canGoBack/canGoForward.
4. Tests: nativeWebUiBridge (cold-start adoption, existing-Activity new tab, stealth stays normal+stealth), plus four ChatGPT test updates for the stealth/incognito contract.

## Measured here (Node 22, strip-types)
13 Web test files: 363 pass, 0 fail. Strict tsc (3 changed TS modules, @capacitor/core stub): exit 0.
NOT RUN: Java compile (brace balance only), full npm test, lint, build, cloud, phone. Read the cloud log text from the top.

## Not in this package (and why)
- D204 round 12 (EmbeddedWeb.java, embeddedWebService.ts, page-behind-the-app layout): NOT in this repo and D204 does not have the files in this chat. Owner: upload AXON_WEB_D204_ROUND12.zip (or tell me where it is) and I rebase it on this repo.
- ChatGPT's second workflow, Node 22.16.0 pin, run-tests change, page-agent JS change, App.tsx change: left out on purpose.
- Brain hookup of the AXON web tools and phone tests: still open.
- AXON Web screen: it already exists in the main interface (Chat / Web / Apps) as src/components/web/*; it talks to getWebUiService(), which on Android returns NativeWebUiService.
