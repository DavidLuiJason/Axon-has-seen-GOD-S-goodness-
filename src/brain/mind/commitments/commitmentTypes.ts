/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * COMMITMENTS (CCCS, D84 review of ChatGPT's CCCS v0.4): the CONTRACT.
 *
 * WHAT IT IS: what the owner has ESTABLISHED in a conversation (a law, a constraint, a decision, a preference, a goal, a fact, a conditional exception),
 * kept apart from the raw words that were said. A newer sentence is EVIDENCE of a possible change; it is never by itself a change.
 * Everything here is pure data in, new data out (no clock, no storage, no screen): the caller gives `now` and a sha256.
 *
 * REUSED FROM AXON (nothing invented): `Origin` (owner, axon, tool, external) and `OwnerApproval` / `Sha256` are the Charter's own types
 * (src/mind/charter). A protected change needs the same kind of approval the Charter needs: owner-made, bound by hash to the exact change, expiring, single use.
 * The owner's yes to a question is a recorded OWNER EVENT in the log (the same yes-no the dialogue already asks), never a boolean a caller passes in.
 *
 * LAWS: (1) only an owner event can establish or change anything; axon, tool and external text can only be PROPOSED, never obeyed.
 * (2) A law or a constraint is PROTECTED: any change that touches one (old or new) needs a valid OwnerApproval for that exact change.
 * (3) No intent, no change: the engine never guesses replace, correct, override or exception from words; the reading layer must say which, with evidence.
 * (4) Any failure leaves the ledger exactly as it was. (5) The ledger is NOT saved on the phone unless memory is allowed (it quotes the owner's words).
 * (6) No word lists and no regular expressions here (B03A guard): only closed LABELS of the data format.
 */
import type { Origin } from '../../../mind/charter/broker.ts';
import type { OwnerApproval } from '../../../mind/charter/change.ts';
import type { Sha256 } from '../../../mind/charter/charter.ts';

export type { Origin, OwnerApproval, Sha256 };

export const COMMITMENTS_VERSION = 1;
export const KIND_LABELS = 'law constraint decision preference goal fact exception';
export const SCOPE_LABELS = 'user project chat task';
export const STATUS_LABELS = 'proposed active superseded revoked declined';
export const INTENT_LABELS = 'replace correct override exception';
export const ORIGIN_LABELS = 'owner axon tool external';

/** law and constraint are PROTECTED. exception only exists as a child of an active base item. */
export type Kind = 'law' | 'constraint' | 'decision' | 'preference' | 'goal' | 'fact' | 'exception';
/** Widest to narrowest: user, project, chat, task. project and task items can only be changed with a grant from a real registry (none exists yet). */
export type Scope = 'user' | 'project' | 'chat' | 'task';
export type Status = 'proposed' | 'active' | 'superseded' | 'revoked' | 'declined';
export type IntentKind = 'replace' | 'correct' | 'override' | 'exception';

export const LIMITS = {
  maxEvents: 3000, maxItems: 1000, maxEventText: 4000, maxSubject: 120, maxValue: 500, maxCondition: 200,
  maxId: 120, maxTokens: 2000, maxApprovalMs: 86400000, contextDefault: 8, contextMax: 20, contextAlwaysRules: 4, maxSerialized: 4000000,
} as const;

/** One thing someone said or produced, exactly as it was. `seq` counts per chat. */
export interface CEvent {
  readonly id: string;
  readonly chat: string;
  readonly seq: number;
  /** Who made the words. Only 'owner' can establish or change a commitment. */
  readonly origin: Origin;
  /** The caller's own id for the message (a retry with the same id and the same words is the same event). */
  readonly messageId: string;
  readonly text: string;
  /** true when the words were longer than the limit and were cut. */
  readonly clipped: boolean;
  readonly at: number;
}

export interface Item {
  readonly id: string;
  readonly kind: Kind;
  readonly subject: string;
  readonly value: string;
  readonly scope: Scope;
  /** user: 'owner'. chat: the chat id. project and task: the registry id. */
  readonly scopeId: string;
  /** owner only after the owner's recorded yes. Everything proposed is 'inferred'. */
  readonly authority: 'owner' | 'inferred';
  readonly status: Status;
  /** The event the words came from. */
  readonly sourceEvent: string;
  /** The OWNER event that said yes. null until then. */
  readonly confirmedBy: string | null;
  /** The OwnerApproval token that allowed a protected change. null when none was needed. */
  readonly approvalToken: string | null;
  /** For an exception: the base item it narrows. */
  readonly parent: string | null;
  /** For an exception: when it applies. Required. */
  readonly condition: string | null;
  readonly expiresAt: number | null;
  /** The item this one replaced, corrected or overrode. */
  readonly supersedes: string | null;
  readonly why: string | null;
  readonly created: number;
  readonly changed: number;
}

export interface UsedToken { readonly token: string; readonly expires: number }
export interface Ledger {
  readonly version: 1;
  /** Counts every successful change; the store uses it to refuse a stale save. */
  readonly rev: number;
  readonly nextItem: number;
  readonly events: readonly CEvent[];
  readonly items: readonly Item[];
  readonly usedTokens: readonly UsedToken[];
}

export interface EventInput { readonly chat: string; readonly messageId: string; readonly origin: Origin; readonly text: string }
export interface ItemInput {
  readonly kind: Kind; readonly subject: string; readonly value: string; readonly scope: Scope; readonly scopeId: string;
  readonly condition?: string | null; readonly expiresAt?: number | null;
}
/** What the reading layer says the owner meant, with the owner event that shows it. The engine never works this out from words. */
export interface Intent { readonly kind: IntentKind; readonly evidence: string }
/** A scope the caller has VERIFIED the current chat may touch (from a real registry). */
export interface Grant { readonly scope: Scope; readonly scopeId: string }
export interface Context { readonly now: number; readonly sha256?: Sha256; readonly grants?: readonly Grant[] }

export type Refusal =
  | 'bad-input' | 'too-long' | 'unknown-origin' | 'message-id-reused' | 'event-log-full' | 'ledger-full'
  | 'not-found' | 'wrong-state' | 'duplicate' | 'exception-needs-change' | 'scope-unverified' | 'scope-mismatch'
  | 'evidence-not-owner' | 'evidence-not-found' | 'confirmation-not-owner' | 'confirmation-not-found' | 'confirmation-not-after-evidence' | 'confirmation-other-chat'
  | 'conflicts-with-active' | 'already-active' | 'not-visible' | 'expired' | 'unrelated-target' | 'same-value'
  | 'replace-not-allowed-on-protected' | 'kind-must-stay' | 'exception-not-narrower' | 'exception-needs-condition' | 'exception-needs-exception-kind'
  | 'approval-required' | 'approval-mismatch' | 'approval-bad-time' | 'approval-expired' | 'approval-replayed';

export type Result<T> = ({ readonly ok: true; readonly ledger: Ledger; readonly changed: boolean } & T) | { readonly ok: false; readonly reason: Refusal };

export interface ContextEntry {
  readonly id: string; readonly kind: Kind; readonly subject: string; readonly value: string; readonly scope: Scope; readonly scopeId: string;
  readonly condition: string | null; readonly protected: boolean;
  /** Where it came from, so the Mind can show the owner WHY. */
  readonly source: { readonly event: string; readonly origin: Origin; readonly confirmedBy: string | null };
}
export interface UnconfirmedEntry { readonly id: string; readonly kind: Kind; readonly subject: string; readonly value: string; readonly sourceOrigin: Origin; readonly note: string }
/** `rules` are what the owner established (obey them). `unconfirmed` are proposals nobody confirmed (never obey them; at most ask about them). */
export interface ContextView { readonly rules: readonly ContextEntry[]; readonly unconfirmed: readonly UnconfirmedEntry[]; readonly omitted: number }
