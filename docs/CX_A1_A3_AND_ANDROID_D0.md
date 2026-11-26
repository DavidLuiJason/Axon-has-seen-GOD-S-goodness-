# CX-A1..A3 verification and Android build #30/#32 fix (D0, continuing D84)

## Android build failure (#30, #32)
Cause: Maven Central answered HTTP 429 (Too Many Requests) to the shared CI address while Gradle fetched build tools. Not a code error.
Fix (scripts/apply-android-overlay.sh, idempotent, no new dependency):
1. android/gradle.properties: more download retries and longer backoff.
2. android/build.gradle: Google's public Maven Central copy tried before mavenCentral() (buildscript and allprojects).
The 2001-file snapshot limit (build #30) is already 3000 in the repository; AXON-fix-limit-3000.zip is identical, no change needed.
If it still fails with 429: re-run the build later; the workflow file cannot ship in a zip, so a cache step for ~/.gradle is a later edit in the workflow itself.

## CX-A1..A3 (ChatGPT) review
Own tests, guards and strict tsc passed. Defects found and fixed:
- A1: calling gatherKnowledge twice added the same hit twice. Fixed (skip an id already present).
- cortex.ts: the adapter hook was an untyped cast and did not re-check the adapter output. Now typed on CortexDependencies; output re-validated; failure code 'bad-adapter-output'.
- ChatGPT's tests killed only 8 of 17 mutants. tests/cortexAdaptersD84.test.ts (58 checks) pins the rest: now 17 of 17.
Wired into cortexTap.ts as optional typed feeds (knowledgeHits, commitments, ownerEvents, adapters). With none given, behaviour is as before. Still SHADOW; replies never change.

## Known, not fixed
- scripts/test-apply-overlay.sh: 13 assertions fail on the ORIGINAL repo too (mock fixture is stale against the current script). Not caused by this merge.
- D84's list of other red tests (tools lane) stands: docs/CI_FAILURES_D84.md.
- Nothing yet produces real knowledge hits or owner events in a live turn; the feeds are plumbing. Next: a Meaning-stage job to turn words into typed events, and a real source binding for A1.
