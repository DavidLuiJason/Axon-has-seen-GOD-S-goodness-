// P08 ORCHESTRATOR (pure wrapper). Puts repair, dialogue questions, the existing brain, an independent re-check of tool answers, judgment
// and reflection around ANY brain that has `askWithTrace`. It edits no existing file. Modes:
//   off    : plain pass-through.
//   shadow : the reply is exactly the brain's reply for the owner's exact words; the orchestrator only RECORDS what it would have done
//            (the default, and the safe way to measure it on real traffic).
//   on     : repair is applied (and said out loud), a risky repair asks first, a tool that was found but is missing its text now ASKS for it
//            and uses the answer, and a tool answer that FAILS its own re-check is held back instead of shown.
import { repairMessage } from '../repair/repair.ts';
import type { RepairResult } from '../repair/repair.ts';
import { verifyOutcome } from '../verify/verify.ts';
import type { VerifyReport } from '../verify/verify.ts';
import { reflect } from '../reflect/reflect.ts';
import type { Candidate, Reflection, StepRecord } from '../reflect/reflect.ts';
import { judgeProposal } from '../judgment/judge.ts';
import type { Judgment } from '../judgment/judge.ts';
import { emptyDialogue, recordTurn, setPending } from '../dialogue/dialogueState.ts';
import { livePending } from '../dialogue/dialogueAnswer.ts';
import { stepDialogue } from '../dialogue/dialogueDriver.ts';
import { verifyToolReplyFull } from '../../../safety/toolVerifiers2.ts';
import { createCandidateStore, loadText, saveText } from './candidateStore.ts';
import type { TextStorage } from './candidateStore.ts';
import { createPredictionJournal } from './predictionJournal.ts';
import { runPlan } from './planRunner.ts';
import type { PlanRun } from './planRunner.ts';
import { validateSituation } from '../foresight/situation.ts';
import { lookAhead } from '../foresight/lookahead.ts';
import { judgeSituation } from '../foresight/verdict.ts';
import type { SituationJudgment } from '../foresight/verdict.ts';
import { calibrationReport, widenForDrift } from '../foresight/calibration.ts';
import type { Bucket } from '../foresight/calibration.ts';
import { guide } from '../foresight/guidance.ts';
import type { GuidanceRecord } from '../foresight/guidance.ts';
import type { Goal, Plan } from '../plan/plan.ts';
import { CANCEL_REPLY, RESEND_REPLY, TEXT_QUESTION, binderAsked, traceReadsAsRequest, withQuotedText, withStageNote } from './dialogueQuestions.ts';

export type OrchestratorMode = 'off' | 'shadow' | 'on';
export type ReplyLike = { readonly content: string; readonly source: string; readonly taskId?: string };
export type BrainLike<T extends ReplyLike = ReplyLike> = {
  askWithTrace(request: { text: string; place: string }): Promise<{ reply: T; trace: unknown }>;
};
export type DialogueAction = 'none' | 'asked' | 'filled' | 'cancelled' | 'parked' | 'would-ask' | 'could-not-use';
export type Orchestration = {
  readonly mode: OrchestratorMode;
  readonly repair: RepairResult | null;
  readonly effectiveText: string;
  readonly dialogue: { readonly action: DialogueAction };
  readonly verification: { readonly toolId: string; readonly report: VerifyReport; readonly note: string } | null;
  readonly judgment: Judgment | null;
  readonly reflection: Reflection | null;
  readonly replyChanged: boolean;
  readonly problems: readonly string[];
};
export type OrchestratorOptions = { readonly mode?: OrchestratorMode; readonly memoryAllowed?: boolean };
type Out = { readonly reply: ReplyLike; readonly trace: unknown };

const ASSUMPTION = 'an independent recheck of the quoted text agrees with the tool';

export function createOrchestrator<T extends ReplyLike>(brain: BrainLike<T>, options: OrchestratorOptions = {}) {
  const mode: OrchestratorMode = options.mode ?? 'shadow';
  const memoryAllowed = options.memoryAllowed === true;
  const store = createCandidateStore();
  const journal = createPredictionJournal();
  const counts = { messages: 0, repaired: 0, repairAsk: 0, dialogueAsked: 0, dialogueFilled: 0, dialogueCancelled: 0, rechecked: 0, recheckPassed: 0, recheckFailed: 0, recheckUnclear: 0, replyChanged: 0, wouldChange: 0, problems: 0 };
  let dialogue = emptyDialogue();
  let pendingOriginal: string | null = null;
  let turn = 0;

  async function ask(request: { text: string; place: string }): Promise<{ reply: ReplyLike; trace: unknown; orchestration: Orchestration }> {
    turn++;
    const problems: string[] = [];
    if (mode === 'off') {
      const out = await brain.askWithTrace(request);
      return { reply: out.reply, trace: out.trace, orchestration: { mode, repair: null, effectiveText: request.text, dialogue: { action: 'none' }, verification: null, judgment: null, reflection: null, replyChanged: false, problems } };
    }
    let action: DialogueAction = 'none';
    let reply: ReplyLike | null = null;
    let trace: unknown = null;
    let probe: Out | null = null;
    let effectiveText = request.text;
    let repair: RepairResult | null = null;
    let replyChanged = false;

    // 1. An open question: does this message answer it, cancel it, or start something new?
    const pending = livePending(dialogue);
    if (mode === 'on' && pending !== null && pending.kind === 'text-slot' && pendingOriginal !== null) {
      probe = await brain.askWithTrace({ text: request.text, place: request.place });
      const step = stepDialogue(dialogue, request.text, traceReadsAsRequest(probe.trace));
      dialogue = step.state;
      if (step.reading.kind === 'cancels') {
        pendingOriginal = null;
        action = 'cancelled';
        reply = { content: CANCEL_REPLY, source: 'orchestrator:dialogue' };
        trace = probe.trace;
        replyChanged = true;
      } else if (step.reading.kind === 'answers' && typeof step.reading.value === 'string') {
        const combined = withQuotedText(pendingOriginal, step.reading.value);
        pendingOriginal = null;
        if (combined === null) {
          action = 'could-not-use';
          reply = { content: RESEND_REPLY, source: 'orchestrator:dialogue' };
          trace = probe.trace;
          replyChanged = true;
        } else {
          effectiveText = combined;
          const out = await brain.askWithTrace({ text: combined, place: request.place });
          reply = out.reply;
          trace = out.trace;
          action = 'filled';
          replyChanged = true;
        }
      } else if (step.parked) action = 'parked';
    }

    // 2. Repair (not on an answer that was just placed into its question).
    if (reply === null) {
      try {
        const r = repairMessage({ text: request.text });
        if (r.ok) repair = r.value; else problems.push('repair refused the input: ' + r.error);
      } catch { problems.push('repair failed'); }
      if (mode === 'on' && repair && repair.verdict === 'ASK' && repair.askQuestion) {
        return await finish(repair, { content: repair.askQuestion, source: 'orchestrator:repair' }, null, request.text, 'none', true, problems);
      }
      const repaired = mode === 'on' && repair !== null && repair.verdict === 'REPAIRED';
      effectiveText = repaired && repair ? repair.reading : request.text;
      const out: Out = probe !== null && !repaired ? probe : await brain.askWithTrace({ text: effectiveText, place: request.place });
      reply = out.reply;
      trace = out.trace;
      if (repaired && repair) { reply = { ...reply, content: 'I read your message as: ' + repair.reading + '\n\n' + reply.content }; replyChanged = true; }
      // 3. A tool was found but its text is missing: ask for it (on) or record that it would (shadow).
      if (binderAsked(out.reply.source, out.trace)) {
        if (mode === 'on') {
          dialogue = setPending(dialogue, { kind: 'text-slot', question: TEXT_QUESTION, slot: 'text', tool: null });
          if (livePending(dialogue) !== null) {
            pendingOriginal = effectiveText;
            reply = { content: TEXT_QUESTION, source: 'orchestrator:dialogue' };
            action = 'asked';
            replyChanged = true;
          }
        } else action = 'would-ask';
      }
    }
    return await finish(repair, reply, trace, effectiveText, action, replyChanged, problems);
  }

  // Everything after the brain has answered: re-check a tool answer, judge it, reflect, remember the turn.
  async function finish(repair: RepairResult | null, shown: ReplyLike, trace: unknown, effectiveText: string, action: DialogueAction, changed: boolean, problems: string[]) {
    let reply = shown;
    let replyChanged = changed;
    // The brain's own answer is the one that is checked (any note put in front of it is stripped first).
    const brainReply = shown;
    const isTool = brainReply.source.startsWith('runner:');
    const toolId = isTool ? brainReply.source.slice('runner:'.length) : '';
    const rawContent = stripNote(brainReply.content);
    let verification: Orchestration['verification'] = null;
    let judgment: Judgment | null = null;
    if (isTool) {
      try {
        const v = await verifyToolReplyFull({ toolId, message: effectiveText, replyContent: rawContent });
        const input = {
          clauses: [{ id: 'c1', required: true }],
          steps: [{ clauseId: 'c1', toolId, assumption: ASSUMPTION, reported: rawContent.includes('COMPLETED') ? ('success' as const) : ('failure' as const), output: v.output, check: v.check }],
          priorFailedAssumptions: [] as string[],
        };
        const r = verifyOutcome(input);
        if (r.ok) verification = { toolId, report: r.value, note: v.note }; else problems.push('verification refused: ' + r.error);
      } catch { problems.push('verification failed'); }
      if (verification) {
        // These tools only read text the owner supplied, so the proposal is a harmless READ; the real permission decision stays with the lane.
        const j = judgeProposal({ id: brainReply.taskId ?? 'turn-' + turn, actionKind: 'READ', reversible: true, affectsOthers: false, interpretation: 'HIGH', evidence: verification.report.clauses[0].evidence, permission: 'ALLOW', departsFromStatedGoal: false, missingInputs: [], undefinedTerms: [], dependenciesMet: true, costOfDoingNothing: 'NONE' });
        if (j.ok) judgment = j.value; else problems.push('judgment refused: ' + j.error);
      }
    }
    if (mode === 'on' && verification && verification.report.overall === 'FAILED' && rawContent.includes('COMPLETED')) {
      reply = { content: 'I ran ' + toolId + ', but my own re-check did not match its answer, so I am not giving you that result. Nothing was changed.', source: 'orchestrator:verify', ...(brainReply.taskId ? { taskId: brainReply.taskId } : {}) };
      replyChanged = true;
    }

    let reflection: Reflection | null = null;
    try {
      const verified = verification !== null && verification.report.mayClaimSuccess;
      const steps: StepRecord[] = isTool ? [{ toolId, ok: rawContent.includes('COMPLETED'), verified, assumption: ASSUMPTION }] : [];
      const failedCheck = verification !== null && verification.report.overall === 'FAILED';
      const status = brainReply.source === 'foundation' ? 'ABANDONED' : isTool && !rawContent.includes('COMPLETED') ? 'FAILED' : 'SUCCESS';
      const r = reflect({ taskId: brainReply.taskId ?? 'turn-' + turn, goal: effectiveText.slice(0, 200) || 'empty request', status, steps, wrongAssumptions: failedCheck ? [ASSUMPTION] : [], ownerCorrections: [], memoryAllowed });
      if (r.ok) { reflection = r.value; store.add(r.value.candidates as readonly Candidate[]); } else problems.push('reflection refused: ' + r.error);
    } catch { problems.push('reflection failed'); }

    dialogue = recordTurn(dialogue, { id: 'turn-' + turn, at: turn, text: effectiveText.slice(0, 500), tool: isTool ? toolId : null, outcome: action === 'asked' ? 'asked' : isTool ? 'answered' : 'none', args: {} });

    let outTrace = trace;
    if (verification) outTrace = withStageNote(outTrace, 'verification', 'orchestrator recheck of ' + toolId + ': ' + verification.report.overall + ' (' + verification.note + ')');
    if (action !== 'none') outTrace = withStageNote(outTrace, 'dialogue', 'orchestrator dialogue: ' + action);
    counts.messages++;
    if (repair && repair.verdict === 'REPAIRED') counts.repaired++;
    if (repair && repair.verdict === 'ASK') counts.repairAsk++;
    if (action === 'asked' || action === 'would-ask') counts.dialogueAsked++;
    if (action === 'filled') counts.dialogueFilled++;
    if (action === 'cancelled') counts.dialogueCancelled++;
    if (verification) { counts.rechecked++; if (verification.report.overall === 'PASSED') counts.recheckPassed++; else if (verification.report.overall === 'FAILED') counts.recheckFailed++; else counts.recheckUnclear++; }
    if (replyChanged) counts.replyChanged++;
    if (problems.length > 0) counts.problems++;
    return { reply, trace: outTrace, orchestration: { mode, repair, effectiveText, dialogue: { action }, verification, judgment, reflection, replyChanged, problems } };
  }

  type Foresight = { readonly ok: true; readonly judgment: SituationJudgment; readonly guidance: GuidanceRecord; readonly chanceShown: { low: number; high: number; widened: boolean } | null; readonly predictionId: string | null } | { readonly ok: false; readonly error: string; readonly message: string };
  let predictions = 0;
  /** Looks ahead on a situation model: what would happen, the best way, one push-back or question if needed, and a chance that is widened if past predictions drifted. */
  function foresee(rawSituation: unknown, proposed?: readonly string[]): Foresight {
    const sit = validateSituation(rawSituation);
    if (!sit.ok) return sit;
    const judged = judgeSituation(sit.value, proposed);
    if (!judged.ok) return judged;
    const guidance = guide(judged.value, lookAhead(sit.value).chains, proposed ?? null);
    let shown: { low: number; high: number; widened: boolean } | null = null;
    let predictionId: string | null = null;
    if (judged.value.chance) {
      const report = calibrationReport(journal.list()) ?? [];
      shown = widenForDrift(judged.value.chance.low, judged.value.chance.high, report);
      predictions++;
      predictionId = 'prediction-' + predictions;
      journal.expect(predictionId, (judged.value.chance.low + judged.value.chance.high) / 2);
    }
    return { ok: true, judgment: judged.value, guidance, chanceShown: shown, predictionId };
  }
  const calibration = (): Bucket[] => calibrationReport(journal.list()) ?? [];
  const KEY_CANDIDATES = 'axon.brain.candidates';
  const KEY_JOURNAL = 'axon.brain.predictions';

  return {
    ask,
    mode,
    candidates: () => store.list(),
    exportCandidates: () => store.exportText(),
    importCandidates: (text: string) => store.importText(text),
    foresee,
    noteOutcome: (predictionId: string, cameTrue: boolean): boolean => journal.outcome(predictionId, cameTrue),
    calibration,
    /** Runs a validated plan; each step's text goes through ask() and counts only when its answer was re-checked and passed. */
    runPlan: (goal: Goal, plan: Plan): Promise<PlanRun> => runPlan(goal, plan, async (text) => {
      const r = await ask({ text, place: 'chat' });
      return { verified: r.orchestration.verification !== null && r.orchestration.verification.report.mayClaimSuccess, source: r.reply.source };
    }),
    /** What the orchestrator has seen so far: the numbers that show whether it is safe to switch from shadow to on. */
    stats: () => ({ ...counts, mode }),
    saveTo: (storage: TextStorage): boolean => { const a = saveText(storage, KEY_CANDIDATES, store.exportText()); const b = saveText(storage, KEY_JOURNAL, journal.exportText()); return a && b; },
    loadFrom: (storage: TextStorage): { candidates: boolean; predictions: boolean } => {
      const c = loadText(storage, KEY_CANDIDATES);
      const p = loadText(storage, KEY_JOURNAL);
      return { candidates: c !== null && store.importText(c), predictions: p !== null && journal.importText(p) };
    },
  };
}

// The note "I read your message as: ..." sits in front of the brain's own text; the re-check looks at the brain's text only.
function stripNote(content: string): string {
  const head = 'I read your message as: ';
  if (!content.startsWith(head)) return content;
  const cut = content.indexOf('\n\n');
  return cut < 0 ? content : content.slice(cut + 2);
}
