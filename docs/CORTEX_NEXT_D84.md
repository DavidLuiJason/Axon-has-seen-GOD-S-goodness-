# CORTEX next steps (D84, 2026-11-25)
BUILT NOW (CX-A4, shadow): orchestrator.ts calls src/brain/mind/orchestrator/cortexTap.ts on every tool turn and every "tool found, text missing" turn (modes shadow and on). CORTEX gets the turn's typed facts, returns a decision; it is recorded in orchestration.cortex and counted (cortexTapped / cortexAgree / cortexDisagree / cortexFailed). The reply is never changed. Mode off never taps.
HONEST LIMIT: the facts come from the brain's own resolution (tool found, text missing, recheck, council verdict), so CORTEX mostly agrees today. This is the wiring and the measuring device, not better reasoning yet.
WHAT MAKES AXON REASON BETTER (in order):
1. CX-A1..A3 (ChatGPT, one job, prompt: docs/prompts/CX_A1_A3_BUILDER_PROMPT.md): CORTEX fetches its own knowledge need, method and relations, and reads typed commitment signals. Then the tap can feed it real knowledge hits, several candidate tools and commitments, and DISAGREEMENTS become informative.
2. D84 wires the A1..A3 outputs into cortexTap.ts (small, hot file).
3. Read the disagreement counters over a real conversation set. Only then the owner decides CORTEX "on" for ASK vs RUN (owner decision).
MUTANTS (D0 ran 11, 4 survived): 2 are redundant second guards (safe-integer check, final NEVER guard): harmless, behaviour identical, not worth code. 2 change a label only (reconcile reason code, knowledge-need trace code): they matter only if a later part reads that code; the A1 and A2 prompt requires a test that pins both labels.
