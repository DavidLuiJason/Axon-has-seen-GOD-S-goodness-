/**
 * JOB 5 (D926, finished by D111): WHEN THE COUNCIL SITS, AND WHAT ITS DECISION MEANS TO THE OWNER.
 * The council (the eight seats in judgment/council.ts, synthesised into a verdict by judge.ts) is not convened for a simple request:
 * a plain, reversible read, read clearly, with its answer not in dispute, has nothing for eight seats to review. Anything else convenes it.
 * `plainCouncilNote` turns the verdict into one owner-readable sentence group; raw judgment objects are never shown to the owner.
 * Pure. No phrases, no regular expressions: it reads the council's own declared flags.
 */
import type { Proposal } from '../judgment/council.ts';
import type { Judgment } from '../judgment/judge.ts';

/** The judgment a council that was not convened stands for: nothing to review. */
export const NOT_CONVENED: Judgment = Object.freeze({ verdict: 'PROCEED', urgent: false, flags: Object.freeze([]) as readonly never[] });

export function needsCouncil(p: Proposal): boolean {
  if (p.actionKind !== 'READ') return true;
  if (!p.reversible || p.affectsOthers) return true;
  if (p.interpretation !== 'HIGH') return true;
  if (p.evidence === 'DISPUTED') return true;
  if (p.permission !== 'ALLOW') return true;
  if (p.departsFromStatedGoal || !p.dependenciesMet) return true;
  return p.missingInputs.length > 0 || p.undefinedTerms.length > 0;
}

/** One short owner-readable note for a verdict that is not a plain PROCEED, or null when there is nothing to say. */
export function plainCouncilNote(j: Judgment, toolName: string): string | null {
  if (j.verdict === 'PROCEED') return null;
  const concerns: string[] = [];
  for (const flag of j.flags) { if (flag.severity !== 'LOW' && !concerns.includes(flag.concern)) concerns.push(flag.concern); }
  const why = concerns.slice(0, 3).join(' ');
  if (j.verdict === 'STOP') return 'I should not have run ' + toolName + ' without your say-so. ' + why;
  if (j.verdict === 'ASK') return 'I should have checked with you before running ' + toolName + '. ' + why;
  return 'A caution about ' + toolName + ': ' + why;
}
