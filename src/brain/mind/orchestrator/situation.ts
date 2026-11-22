/**
 * JOB 2 (D926): THE SITUATION BUILDER. Judgment (judge.ts / council.ts) takes a structured Proposal. Until now the orchestrator
 * wrote one by hand ("a harmless READ") for every tool. This builds the Proposal from facts the brain really has about THIS turn:
 * the tool's declared action schema (effects, undo, preconditions), how the message was read (repair), and what the recheck found.
 * Pure: no clock, no storage, no dictionary. No phrases, no regular expressions: it reads declared labels, never the owner's words.
 * `basis` says where every field came from, so a verdict can always be explained.
 */
import { getSchema } from '../schema/actionSchemas.ts';
import type { ActionSchema } from '../schema/schemaTypes.ts';
import type { ActionKind, EvidenceLabel, Permission, Proposal } from '../judgment/council.ts';

export type SituationInput = {
  readonly id: string;
  /** The tool the turn ran (or was rechecked as). Empty when no tool is involved. */
  readonly toolId: string;
  /** How the repair stage read the message. NONE when it did not run. */
  readonly repairVerdict: 'KEEP' | 'REPAIRED' | 'ASK' | 'NONE';
  /** The recheck's evidence label for the answer, or UNKNOWN when it was not rechecked. */
  readonly evidence: EvidenceLabel;
  /** Inputs the tool still needs from the owner (for example the text). */
  readonly missingInputs: readonly string[];
};
export type Situation = { readonly proposal: Proposal; readonly basis: readonly string[] };

const kindOf = (schema: ActionSchema): ActionKind => {
  const has = (effect: string): boolean => (schema.effects as readonly string[]).includes(effect);
  if (has('deletes')) return 'DELETE';
  if (has('sends')) return 'SEND';
  if (has('spends')) return 'SPEND';
  if (has('writes-file') || has('stores-note') || has('changes-setting')) return 'WRITE';
  return 'READ';
};

export function buildSituation(input: SituationInput): Situation {
  const basis: string[] = [];
  const schema = input.toolId === '' ? null : getSchema(input.toolId);
  let actionKind: ActionKind = 'RUN';
  let reversible = true;
  let affectsOthers = false;
  let permission: Permission = 'ALLOW';
  let dependenciesMet = true;
  if (schema === null) {
    basis.push(input.toolId === '' ? 'no tool involved: treated as RUN' : 'no action schema for ' + input.toolId + ': treated as RUN, reversible');
  } else {
    actionKind = kindOf(schema);
    reversible = schema.undo !== 'irreversible';
    affectsOthers = (schema.effects as readonly string[]).includes('sends');
    const needs = schema.preconditions as readonly string[];
    if (needs.includes('owner-approval') || needs.includes('permission')) permission = 'ASK';
    // A device or network precondition is declared but its live state is not known here, so it is not claimed as met.
    if (needs.includes('device-capable') || needs.includes('network-on')) dependenciesMet = false;
    basis.push('schema ' + schema.tool + ': effects ' + schema.effects.join(' ') + '; undo ' + schema.undo + '; needs ' + (needs.length === 0 ? 'nothing' : needs.join(' ')));
  }
  let interpretation: Proposal['interpretation'] = 'HIGH';
  if (input.repairVerdict === 'REPAIRED') { interpretation = 'MEDIUM'; basis.push('the message was repaired before it was read'); }
  else if (input.repairVerdict === 'ASK') { interpretation = 'LOW'; basis.push('the repair stage could not settle the reading'); }
  if (input.missingInputs.length > 0) basis.push('missing: ' + input.missingInputs.join(', '));
  basis.push('evidence ' + input.evidence);
  return {
    proposal: {
      id: input.id, actionKind, reversible, affectsOthers, interpretation, evidence: input.evidence, permission,
      departsFromStatedGoal: false, missingInputs: input.missingInputs, undefinedTerms: [], dependenciesMet, costOfDoingNothing: 'NONE',
    },
    basis,
  };
}
