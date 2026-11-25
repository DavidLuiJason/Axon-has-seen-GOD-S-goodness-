import type { TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { CortexOption } from '../src/brain/mind/cortex/optionGenerator.ts';
import { evaluateOptions, type OptionEvaluationCandidate, type OptionEvaluationFactors } from '../src/brain/mind/cortex/optionEvaluator.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'EVALUATION_INPUT', sourceRef: id, evidence: 'OBSERVED' }; }
function option(id: string, kind: 'ANSWER' | 'RUN' = 'ANSWER'): CortexOption {
  if (kind === 'RUN') return { id, kind: 'RUN', clauseId: 'clause-1', capabilityId: `cap-${id}`, inputRefs: [], state: 'READY', blockReasonCode: null, permission: 'ALLOW', trace: trace(`option-${id}`) };
  return { id, kind: 'ANSWER', clauseId: 'clause-1', answerRef: `answer-${id}`, sourceId: 'dictionary', evidence: 'VERIFIED', trace: trace(`option-${id}`) };
}
function factors(overrides: Partial<OptionEvaluationFactors> = {}): OptionEvaluationFactors {
  return {
    evidence: 'VERIFIED', reversibility: 'REVERSIBLE', costClass: 'LOW', risk: 'LOW', resourceFit: 'FIT', actionKind: 'READ', permission: 'ALLOW',
    councilFlags: [], judgment: { verdict: 'PROCEED', flags: [], trace: trace('judgment-signal') }, uncertain: false, trace: trace('factor-signal'), ...overrides,
  };
}
function candidate(id: string, overrides: Partial<OptionEvaluationFactors> = {}, kind: 'ANSWER' | 'RUN' = 'ANSWER'): OptionEvaluationCandidate {
  return { option: option(id, kind), factors: factors(overrides) };
}
function answerWithEvidence(id: string, evidence: 'VERIFIED' | 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'UNKNOWN' | 'DISPUTED', supplied: 'VERIFIED' | 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'UNKNOWN' | 'DISPUTED'): OptionEvaluationCandidate {
  return { option: { id: `answer-${id}`, kind: 'ANSWER', clauseId: 'clause-1', answerRef: `answer-${id}`, sourceId: 'dictionary', evidence, trace: trace(`option-${id}`) }, factors: factors({ evidence: supplied }) };
}
function flag(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING') {
  return { flag: { seat: 'CRITIC' as const, concern: 'risk signal', part: 'typed-factor', reason: `severity-${severity}`, severity, evidence: 'INFERRED' as const,
    unknown: '', resolvable: severity !== 'BLOCKING', next: severity === 'BLOCKING' ? 'STOP' as const : 'ASK' as const }, trace: trace(`flag-${severity}`) };
}
function evaluate(candidates: OptionEvaluationCandidate[], currentDepth: 'DIRECT' | 'STRUCTURED' | 'ADVANCED' | 'DEEP_DIVE' = 'DIRECT') {
  return evaluateOptions({ currentDepth, candidates, trace: trace('evaluation-request') });
}

function main(): void {
  const basic = evaluate([candidate('best'), candidate('weaker', { evidence: 'INFERRED' })]);
  assert(basic.ok && basic.value.outcome === 'SELECTED' && basic.value.selectedOptionId === 'best', '01 a higher evidence and resource-fit option wins');

  const evidence = evaluate([candidate('inferred', { evidence: 'INFERRED' }), candidate('verified', { evidence: 'VERIFIED' })]);
  assert(evidence.ok && evidence.value.selectedOptionId === 'verified', '02 VERIFIED evidence outranks INFERRED evidence when other factors match');

  const reversible = evaluate([candidate('irreversible', { reversibility: 'IRREVERSIBLE' }), candidate('reversible')]);
  assert(reversible.ok && reversible.value.selectedOptionId === 'reversible' && reversible.value.rejected.some((item) => item.optionId === 'irreversible' && item.reasonCode === 'ASK_NOT_SELECTED_WHILE_SAFE_OPTION_EXISTS'), '03 a safe reversible option is preferred over an irreversible ASK option');

  const send = evaluate([candidate('send', { actionKind: 'SEND' })]);
  assert(send.ok && send.value.outcome === 'ASK' && send.value.selectedOptionId === 'send', '04 sending starts with ASK');

  const deleteAction = evaluate([candidate('delete', { actionKind: 'DELETE' })]);
  assert(deleteAction.ok && deleteAction.value.outcome === 'ASK', '05 deleting starts with ASK');

  const money = evaluate([candidate('money', { actionKind: 'MONEY' })]);
  assert(money.ok && money.value.outcome === 'ASK', '06 money-related action starts with ASK');

  const risk = evaluate([candidate('high-risk', { risk: 'HIGH' }), candidate('low-risk')]);
  assert(risk.ok && risk.value.selectedOptionId === 'low-risk', '07 high risk is penalised in deterministic scoring');

  const resources = evaluate([candidate('no-resource', { resourceFit: 'BLOCKED' }), candidate('fits')]);
  assert(resources.ok && resources.value.selectedOptionId === 'fits' && resources.value.rejected.some((item) => item.reasonCode === 'RESOURCE_BLOCKED'), '08 resource-blocked options are rejected with a reason');

  const council = evaluate([candidate('vetoed', { councilFlags: [flag('BLOCKING')] }), candidate('clear')]);
  assert(council.ok && council.value.selectedOptionId === 'clear' && council.value.rejected.some((item) => item.reasonCode === 'COUNCIL_OR_JUDGMENT_VETO'), '09 a blocking Council flag vetoes that option');

  const judgmentStop = evaluate([candidate('judgment-stop', { judgment: { verdict: 'STOP', flags: [], trace: trace('judgment-stop') } }), candidate('proceed')]);
  assert(judgmentStop.ok && judgmentStop.value.selectedOptionId === 'proceed' && judgmentStop.value.rejected.some((item) => item.reasonCode === 'JUDGMENT_STOP'), '10 a Judgment STOP flag vetoes that option');

  const never = evaluate([candidate('never', { permission: 'NEVER' }, 'RUN')]);
  assert(never.ok && never.value.outcome === 'ALL_BLOCKED' && never.value.rejected[0]?.reasonCode === 'PERMISSION_NEVER', '11 NEVER permission cannot be selected');

  const allBlocked = evaluate([candidate('blocked-risk', { risk: 'BLOCKING' }), candidate('blocked-resource', { resourceFit: 'BLOCKED' })]);
  assert(allBlocked.ok && allBlocked.value.outcome === 'ALL_BLOCKED' && allBlocked.value.selectedOptionId === null && allBlocked.value.rejected.length === 2, '12 all blocked options produce ALL_BLOCKED with reasons');

  const noProbability = evaluate([candidate('score-only')]);
  assert(noProbability.ok && typeof noProbability.value.ranked[0]?.score === 'number' && !Object.prototype.hasOwnProperty.call(noProbability.value.ranked[0]!, 'probability'), '13 scores are deterministic factors, not invented probabilities');

  const tie = evaluate([candidate('tie-z'), candidate('tie-a')]);
  assert(tie.ok && tie.value.tieBreakUsed && tie.value.tieBreakRule === 'EVIDENCE_THEN_REVERSIBILITY_THEN_COST_THEN_ID' && tie.value.selectedOptionId === 'tie-a', '14 score ties use the written evidence/reversibility/cost/id rule');

  const escalated = evaluate([candidate('unsure', { uncertain: true })], 'DIRECT');
  assert(escalated.ok && escalated.value.escalated && escalated.value.recommendedDepth === 'STRUCTURED', '15 uncertainty moves treatment up from DIRECT to STRUCTURED');

  const maxDepth = evaluate([candidate('unsure-deep', { uncertain: true })], 'DEEP_DIVE');
  assert(maxDepth.ok && maxDepth.value.recommendedDepth === 'DEEP_DIVE', '16 uncertainty at DEEP_DIVE never moves depth down');

  const sameDepth = evaluate([candidate('certain-advanced')], 'ADVANCED');
  assert(sameDepth.ok && sameDepth.value.recommendedDepth === 'ADVANCED', '17 a certain option does not downshift the requested depth');

  const approvalRun: CortexOption = { id: 'approval-run', kind: 'RUN', clauseId: 'clause-1', capabilityId: 'cap-approval-run', inputRefs: [], state: 'BLOCKED', blockReasonCode: 'APPROVAL_REQUIRED', permission: 'ASK', trace: trace('approval-run') };
  const approvalCandidate: OptionEvaluationCandidate = { option: approvalRun, factors: factors({ permission: 'ASK' }) };
  const approval = evaluate([approvalCandidate]);
  assert(approval.ok && approval.value.outcome === 'ASK', '18 an ASK-permission runner is turned into an approval question, not a blocked dead end');

  const rejectedAll = evaluate([candidate('chosen'), candidate('second'), candidate('third')]);
  assert(rejectedAll.ok && rejectedAll.value.rejected.length === 2 && rejectedAll.value.rejected.every((item) => item.reasonCode === 'LOWER_RANKED'), '19 every non-selected eligible option gets an explicit rejection reason');

  const conservativeEvidence = evaluate([answerWithEvidence('answer-reported', 'REPORTED', 'VERIFIED'), candidate('answer-verified')]);
  assert(conservativeEvidence.ok && conservativeEvidence.value.ranked.find((item) => item.optionId === 'answer-answer-reported')?.evidence === 'REPORTED' && conservativeEvidence.value.selectedOptionId === 'answer-verified', '20 an answer hit cannot be upgraded by a stronger external evaluation label');

  const disputedEvidence = evaluate([answerWithEvidence('answer-disputed', 'DISPUTED', 'VERIFIED')]);
  assert(disputedEvidence.ok && disputedEvidence.value.ranked.find((item) => item.optionId === 'answer-answer-disputed')?.evidence === 'DISPUTED' && disputedEvidence.value.recommendedDepth === 'STRUCTURED', '21 disputed answer evidence stays disputed and escalates treatment');

  console.log(`CORTEX part 7 option evaluator passed: ${checks} cases`);
}
main();
