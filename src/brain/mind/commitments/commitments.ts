/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * COMMITMENTS engine (pure). Contract: commitmentTypes.ts. Rebuilt in TypeScript from ChatGPT's CCCS v0.4 core by D84, with the prototype's
 * true/false permission gates replaced by AXON's own mechanisms: an OWNER EVENT in the log for the owner's yes, and the Charter's OwnerApproval for a protected change.
 * No caller exists yet (see docs/CCCS_INTEGRATION_D84.md): this is the isolated engine, NOT an integration.
 */
import { KIND_LABELS, LIMITS, ORIGIN_LABELS, SCOPE_LABELS, STATUS_LABELS } from './commitmentTypes.ts';
import type {
  CEvent, Context, ContextEntry, ContextView, EventInput, Grant, Intent, Item, ItemInput, Kind, Ledger, OwnerApproval, Refusal, Result, Scope, Sha256, UnconfirmedEntry,
} from './commitmentTypes.ts';

const KINDS = KIND_LABELS.split(' ');
const SCOPES = SCOPE_LABELS.split(' ');
const STATUSES = STATUS_LABELS.split(' ');
const ORIGINS = ORIGIN_LABELS.split(' ');
const RANK: Record<Scope, number> = { user: 0, project: 1, chat: 2, task: 3 };

export const emptyLedger = (): Ledger => ({ version: 1, rev: 0, nextItem: 1, events: [], items: [], usedTokens: [] });
export const isProtectedKind = (kind: string): boolean => kind === 'law' || kind === 'constraint';

const fail = (reason: Refusal): { readonly ok: false; readonly reason: Refusal } => ({ ok: false, reason });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bump = (l: Ledger, patch: Partial<Ledger>): Ledger => ({ ...l, ...patch, rev: l.rev + 1 });

/** Lower case, words joined by one space. No regular expression. */
export function norm(text: string): string {
  const out: string[] = [];
  let word = '';
  for (const ch of text.toLowerCase()) {
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') { if (word !== '') { out.push(word); word = ''; } } else word += ch;
  }
  if (word !== '') out.push(word);
  return out.join(' ');
}
const targetKey = (i: { subject: string; scope: string; scopeId: string }): string => norm(i.subject) + '|' + i.scope + '|' + i.scopeId;

/** Words of 4 or more letters or digits (shorter ones carry no meaning on their own, and no stop-word list is needed). */
export function wordsOf(text: string): string[] {
  const out: string[] = [];
  let word = '';
  const flush = (): void => { if (word.length >= 4 && !out.includes(word)) out.push(word); word = ''; };
  for (const ch of text.toLowerCase()) {
    const letter = ch.toLowerCase() !== ch.toUpperCase();
    const digit = ch >= '0' && ch <= '9';
    if (letter || digit) word += ch; else flush();
  }
  flush();
  return out;
}

// ---------- events ----------
export function recordEvent(l: Ledger, input: EventInput, now: number): Result<{ event: CEvent }> {
  if (!isObj(input) || !str(input.chat, LIMITS.maxId) || !str(input.messageId, LIMITS.maxId) || typeof input.text !== 'string' || !finite(now)) return fail('bad-input');
  if (!ORIGINS.includes(input.origin as string)) return fail('unknown-origin');
  const clipped = input.text.length > LIMITS.maxEventText;
  const text = clipped ? input.text.slice(0, LIMITS.maxEventText) : input.text;
  const same = l.events.find((e) => e.chat === input.chat && e.messageId === input.messageId);
  if (same) return same.origin === input.origin && same.text === text ? { ok: true, ledger: l, changed: false, event: same } : fail('message-id-reused');
  let events = l.events;
  if (events.length >= LIMITS.maxEvents) {
    const used = new Set<string>();
    for (const i of l.items) { used.add(i.sourceEvent); if (i.confirmedBy !== null) used.add(i.confirmedBy); }
    const drop = events.findIndex((e) => !used.has(e.id));
    if (drop < 0) return fail('event-log-full');
    events = events.filter((_, k) => k !== drop);
  }
  let seq = 0;
  for (const e of l.events) if (e.chat === input.chat && e.seq > seq) seq = e.seq;
  const event: CEvent = { id: input.chat + '#' + (seq + 1), chat: input.chat, seq: seq + 1, origin: input.origin, messageId: input.messageId, text, clipped, at: now };
  return { ok: true, ledger: bump(l, { events: [...events, event] }), changed: true, event };
}
const eventOf = (l: Ledger, id: string): CEvent | undefined => l.events.find((e) => e.id === id);

// ---------- helpers ----------
function checkItemInput(x: unknown): x is ItemInput {
  if (!isObj(x) || !KINDS.includes(x.kind as string) || !SCOPES.includes(x.scope as string)) return false;
  if (!str(x.subject, LIMITS.maxSubject) || !str(x.value, LIMITS.maxValue) || !str(x.scopeId, LIMITS.maxId)) return false;
  if (x.condition !== undefined && x.condition !== null && !str(x.condition, LIMITS.maxCondition)) return false;
  if (x.expiresAt !== undefined && x.expiresAt !== null && !finite(x.expiresAt)) return false;
  return true;
}
const visible = (i: { scope: Scope; scopeId: string }, chat: string, grants: readonly Grant[] | undefined): boolean =>
  i.scope === 'user' || (i.scope === 'chat' && i.scopeId === chat) || (grants ?? []).some((g) => g.scope === i.scope && g.scopeId === i.scopeId);
const live = (i: Item, now: number): boolean => i.status === 'active' && (i.expiresAt === null || i.expiresAt > now);

/** Revokes every child exception of `id` (and theirs). A removed base never leaves its exceptions behind. */
function cascade(items: readonly Item[], id: string, why: string, now: number): Item[] {
  let out = items.slice();
  const kids = out.filter((i) => i.parent === id && (i.status === 'active' || i.status === 'proposed'));
  for (const k of kids) {
    out = out.map((i) => (i.id === k.id ? { ...i, status: 'revoked' as const, why, changed: now } : i));
    out = cascade(out, k.id, why, now);
  }
  return out;
}

function canon(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
export type TransitionDescription = { readonly op: string; readonly target: string | null; readonly next: ItemInput | null; readonly evidence: string | null; readonly confirm: string };
/** What an owner approval is bound to. The approval screen (not built yet) must show this to the owner and hash exactly this. */
export const transitionHash = (d: TransitionDescription, sha256: Sha256): string => {
  try {
    const next = d.next === null ? null : { kind: d.next.kind, subject: d.next.subject, value: d.next.value, scope: d.next.scope, scopeId: d.next.scopeId, condition: d.next.condition ?? null, expiresAt: d.next.expiresAt ?? null };
    return sha256(canon({ op: d.op, target: d.target, next, evidence: d.evidence, confirm: d.confirm }));
  } catch { return ''; }
};

function checkApproval(l: Ledger, a: OwnerApproval | null | undefined, hash: string, now: number): Refusal | null {
  if (!isObj(a) || a.by !== 'owner' || typeof a.token !== 'string' || a.token === '' || hash === '') return 'approval-required';
  if (a.actionHash !== hash) return 'approval-mismatch';
  const from = Date.parse(a.issuedAt);
  const to = Date.parse(a.expiresAt);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from > LIMITS.maxApprovalMs) return 'approval-bad-time';
  if (now < from || now >= to) return 'approval-expired';
  if (l.usedTokens.some((t) => t.token === a.token && t.expires > now)) return 'approval-replayed';
  return null;
}
const spend = (l: Ledger, a: OwnerApproval, now: number): UsedToken[] => [...l.usedTokens.filter((t) => t.expires > now), { token: a.token, expires: Date.parse(a.expiresAt) }];
type UsedToken = Ledger['usedTokens'][number];

/** The owner's yes: an OWNER event in the same chat as the evidence and AFTER it (the same message can never ask and approve). */
function confirmation(l: Ledger, confirmId: string, after: CEvent | null, chat: string | null): { ok: true; event: CEvent } | { ok: false; reason: Refusal } {
  const c = eventOf(l, confirmId);
  if (!c) return fail('confirmation-not-found');
  if (c.origin !== 'owner') return fail('confirmation-not-owner');
  if (after !== null && (c.chat !== after.chat || c.seq <= after.seq)) return fail(c.chat !== after.chat ? 'confirmation-other-chat' : 'confirmation-not-after-evidence');
  if (chat !== null && c.chat !== chat) return fail('confirmation-other-chat');
  return { ok: true, event: c };
}
function ownerEvidence(l: Ledger, id: string): { ok: true; event: CEvent } | { ok: false; reason: Refusal } {
  const e = eventOf(l, id);
  if (!e) return fail('evidence-not-found');
  if (e.origin !== 'owner') return fail('evidence-not-owner');
  return { ok: true, event: e };
}

// ---------- propose ----------
/** Anything can be PROPOSED (an owner sentence, an AXON reading, a tool note, an outside AI). A proposal is never active and never obeyed. */
export function propose(l: Ledger, input: ItemInput, sourceEvent: string, now: number): Result<{ item: Item }> {
  if (!checkItemInput(input) || !str(sourceEvent, LIMITS.maxId) || !finite(now)) return fail('bad-input');
  if (input.kind === 'exception') return fail('exception-needs-change');
  const src = eventOf(l, sourceEvent);
  if (!src) return fail('evidence-not-found');
  if (input.scope === 'chat' && input.scopeId !== src.chat) return fail('scope-mismatch');
  if (input.scope === 'user' && input.scopeId !== 'owner') return fail('scope-mismatch');
  if (l.items.length >= LIMITS.maxItems) return fail('ledger-full');
  const dup = l.items.find((i) => (i.status === 'proposed' || i.status === 'active') && i.kind === input.kind && targetKey(i) === targetKey(input) && norm(i.value) === norm(input.value));
  if (dup) return { ok: true, ledger: l, changed: false, item: dup };
  const item: Item = {
    id: 'c' + l.nextItem, kind: input.kind, subject: input.subject.trim(), value: input.value.trim(), scope: input.scope, scopeId: input.scopeId,
    authority: 'inferred', status: 'proposed', sourceEvent, confirmedBy: null, approvalToken: null, parent: null, condition: input.condition ?? null,
    expiresAt: input.expiresAt ?? null, supersedes: null, why: null, created: now, changed: now,
  };
  return { ok: true, ledger: bump(l, { nextItem: l.nextItem + 1, items: [...l.items, item] }), changed: true, item };
}

export function decline(l: Ledger, itemId: string, confirmEvent: string, now: number): Result<{ item: Item }> {
  const it = l.items.find((i) => i.id === itemId);
  if (!it) return fail('not-found');
  if (it.status !== 'proposed') return fail('wrong-state');
  const c = confirmation(l, confirmEvent, eventOf(l, it.sourceEvent) ?? null, null);
  if (!c.ok) return c;
  const next: Item = { ...it, status: 'declined', why: 'declined by the owner', changed: now };
  return { ok: true, ledger: bump(l, { items: l.items.map((i) => (i.id === itemId ? next : i)) }), changed: true, item: next };
}

// ---------- adopt: a proposal becomes an owner commitment ----------
export function adopt(l: Ledger, itemId: string, confirmEvent: string, ctx: Context, approval?: OwnerApproval | null): Result<{ item: Item }> {
  if (!isObj(ctx) || !finite(ctx.now)) return fail('bad-input');
  const it = l.items.find((i) => i.id === itemId);
  if (!it) return fail('not-found');
  if (it.status !== 'proposed') return fail('wrong-state');
  if (it.expiresAt !== null && it.expiresAt <= ctx.now) return fail('expired');
  const src = eventOf(l, it.sourceEvent);
  if (!src) return fail('evidence-not-found');
  const c = confirmation(l, confirmEvent, src, src.chat);
  if (!c.ok) return c;
  if (it.scope === 'chat' && it.scopeId !== c.event.chat) return fail('scope-mismatch');
  if (!visible(it, c.event.chat, ctx.grants)) return fail('scope-unverified');
  const clash = l.items.find((i) => i.status === 'active' && i.kind !== 'exception' && targetKey(i) === targetKey(it));
  if (clash) return norm(clash.value) === norm(it.value) && clash.kind === it.kind ? fail('already-active') : fail('conflicts-with-active');
  let spent = l.usedTokens;
  let token: string | null = null;
  if (isProtectedKind(it.kind)) {
    const hash = ctx.sha256 ? transitionHash({ op: 'adopt', target: it.id, next: it, evidence: it.sourceEvent, confirm: confirmEvent }, ctx.sha256) : '';
    const bad = checkApproval(l, approval, hash, ctx.now);
    if (bad !== null) return fail(bad);
    token = (approval as OwnerApproval).token;
    spent = spend(l, approval as OwnerApproval, ctx.now);
  }
  const next: Item = { ...it, authority: 'owner', status: 'active', confirmedBy: confirmEvent, approvalToken: token, changed: ctx.now };
  return { ok: true, ledger: bump(l, { items: l.items.map((i) => (i.id === itemId ? next : i)), usedTokens: spent }), changed: true, item: next };
}

// ---------- change: replace, correct, override, exception ----------
export function change(l: Ledger, oldId: string, intent: Intent, nextInput: ItemInput, confirmEvent: string, ctx: Context, approval?: OwnerApproval | null): Result<{ item: Item }> {
  if (!isObj(ctx) || !finite(ctx.now) || !isObj(intent) || !str(intent.evidence, LIMITS.maxId) || !checkItemInput(nextInput)) return fail('bad-input');
  if (!'replace correct override exception'.split(' ').includes(intent.kind)) return fail('bad-input');
  const old = l.items.find((i) => i.id === oldId);
  if (!old) return fail('not-found');
  // an exception is never changed in place: it is withdrawn with revoke() and, if wanted, a new one is made
  if (old.status !== 'active' || old.kind === 'exception') return fail('wrong-state');
  if (old.expiresAt !== null && old.expiresAt <= ctx.now) return fail('expired');
  if (nextInput.expiresAt !== undefined && nextInput.expiresAt !== null && nextInput.expiresAt <= ctx.now) return fail('expired');
  const ev = ownerEvidence(l, intent.evidence);
  if (!ev.ok) return ev;
  const c = confirmation(l, confirmEvent, ev.event, ev.event.chat);
  if (!c.ok) return c;
  if (!visible(old, ev.event.chat, ctx.grants)) return fail('not-visible');
  if (nextInput.scope === 'chat' && nextInput.scopeId !== ev.event.chat) return fail('scope-mismatch');
  if (nextInput.scope === 'user' && nextInput.scopeId !== 'owner') return fail('scope-mismatch');
  if (!visible(nextInput, ev.event.chat, ctx.grants)) return fail('scope-unverified');
  if (norm(nextInput.subject) !== norm(old.subject)) return fail('unrelated-target');
  const isException = intent.kind === 'exception';
  if (isException) {
    if (nextInput.kind !== 'exception') return fail('exception-needs-exception-kind');
    if (nextInput.condition === undefined || nextInput.condition === null) return fail('exception-needs-condition');
    if (RANK[nextInput.scope] <= RANK[old.scope]) return fail('exception-not-narrower');
  } else {
    if (nextInput.kind === 'exception') return fail('exception-needs-change');
    if (targetKey(nextInput) !== targetKey(old)) return fail('unrelated-target');
    if (norm(nextInput.value) === norm(old.value) && nextInput.kind === old.kind) return fail('same-value');
    if (intent.kind !== 'override' && nextInput.kind !== old.kind) return fail('kind-must-stay');
    if (intent.kind === 'replace' && isProtectedKind(old.kind)) return fail('replace-not-allowed-on-protected');
  }
  const touchesProtected = isProtectedKind(old.kind) || isProtectedKind(nextInput.kind);
  let spent = l.usedTokens;
  let token: string | null = null;
  if (touchesProtected) {
    const hash = ctx.sha256 ? transitionHash({ op: intent.kind, target: oldId, next: nextInput, evidence: intent.evidence, confirm: confirmEvent }, ctx.sha256) : '';
    const bad = checkApproval(l, approval, hash, ctx.now);
    if (bad !== null) return fail(bad);
    token = (approval as OwnerApproval).token;
    spent = spend(l, approval as OwnerApproval, ctx.now);
  }
  if (l.items.length >= LIMITS.maxItems) return fail('ledger-full');
  const next: Item = {
    id: 'c' + l.nextItem, kind: nextInput.kind, subject: nextInput.subject.trim(), value: nextInput.value.trim(), scope: nextInput.scope, scopeId: nextInput.scopeId,
    authority: 'owner', status: 'active', sourceEvent: intent.evidence, confirmedBy: confirmEvent, approvalToken: token,
    parent: isException ? old.id : null, condition: nextInput.condition ?? null, expiresAt: nextInput.expiresAt ?? null,
    supersedes: isException ? null : old.id, why: intent.kind, created: ctx.now, changed: ctx.now,
  };
  let items = l.items.slice();
  if (!isException) {
    items = items.map((i) => (i.id === old.id ? { ...i, status: 'superseded' as const, why: 'superseded by ' + next.id + ' (' + intent.kind + ')', changed: ctx.now } : i));
    items = cascade(items, old.id, 'its base ' + old.id + ' was changed', ctx.now);
  }
  items.push(next);
  return { ok: true, ledger: bump(l, { nextItem: l.nextItem + 1, items, usedTokens: spent }), changed: true, item: next };
}

// ---------- revoke / expire ----------
export function revoke(l: Ledger, itemId: string, evidenceEvent: string, confirmEvent: string, ctx: Context, approval?: OwnerApproval | null): Result<{ item: Item }> {
  if (!isObj(ctx) || !finite(ctx.now)) return fail('bad-input');
  const it = l.items.find((i) => i.id === itemId);
  if (!it) return fail('not-found');
  if (it.status !== 'active') return fail('wrong-state');
  const ev = ownerEvidence(l, evidenceEvent);
  if (!ev.ok) return ev;
  const c = confirmation(l, confirmEvent, ev.event, ev.event.chat);
  if (!c.ok) return c;
  if (!visible(it, ev.event.chat, ctx.grants)) return fail('not-visible');
  let spent = l.usedTokens;
  if (isProtectedKind(it.kind)) {
    const hash = ctx.sha256 ? transitionHash({ op: 'revoke', target: itemId, next: null, evidence: evidenceEvent, confirm: confirmEvent }, ctx.sha256) : '';
    const bad = checkApproval(l, approval, hash, ctx.now);
    if (bad !== null) return fail(bad);
    spent = spend(l, approval as OwnerApproval, ctx.now);
  }
  const next: Item = { ...it, status: 'revoked', why: 'withdrawn by the owner', changed: ctx.now };
  const items = cascade(l.items.map((i) => (i.id === itemId ? next : i)), itemId, 'its base ' + itemId + ' was withdrawn', ctx.now);
  return { ok: true, ledger: bump(l, { items, usedTokens: spent }), changed: true, item: next };
}

/** Time passing is not a change of mind: an item whose time ran out is marked revoked (with its exceptions). Safe to call any time. */
export function sweepExpired(l: Ledger, now: number): { readonly ledger: Ledger; readonly expired: number } {
  let items = l.items.slice();
  let count = 0;
  for (const it of l.items) {
    if ((it.status === 'active' || it.status === 'proposed') && it.expiresAt !== null && it.expiresAt <= now) {
      items = items.map((i) => (i.id === it.id ? { ...i, status: 'revoked' as const, why: 'expired', changed: now } : i));
      items = cascade(items, it.id, 'its base ' + it.id + ' expired', now);
      count++;
    }
  }
  return count === 0 ? { ledger: l, expired: 0 } : { ledger: bump(l, { items }), expired: count };
}

// ---------- context ----------
function overlap(query: string[], i: Item): number {
  const own = wordsOf(i.subject + ' ' + i.value + ' ' + (i.condition ?? ''));
  let n = 0;
  for (const w of own) if (query.includes(w)) n++;
  return n;
}
/**
 * What the Mind may be shown for one message in one chat. Read-only, bounded. Chat-scope items of other chats are never shown;
 * project and task items only with a verified grant. Always-on: the owner's user-wide laws and constraints (a few). Proposals are listed apart and labelled.
 */
export function contextFor(l: Ledger, options: { chat: string; text: string; now: number; limit?: number; grants?: readonly Grant[] }): ContextView {
  const limit = Math.max(1, Math.min(LIMITS.contextMax, options.limit ?? LIMITS.contextDefault));
  const query = wordsOf(options.text);
  const seen = l.items.filter((i) => visible(i, options.chat, options.grants));
  const active = seen.filter((i) => live(i, options.now) && (i.parent === null || seen.some((p) => p.id === i.parent && live(p, options.now))));
  const scored = active.map((i, k) => ({ i, k, hits: overlap(query, i), always: i.scope === 'user' && isProtectedKind(i.kind) }));
  const chosen = scored.filter((s) => s.hits > 0 || s.always).sort((a, b) => (b.hits + (isProtectedKind(b.i.kind) ? 0.5 : 0)) - (a.hits + (isProtectedKind(a.i.kind) ? 0.5 : 0)) || b.k - a.k);
  const rules: ContextEntry[] = [];
  let always = 0;
  for (const s of chosen) {
    if (rules.length >= limit) break;
    if (s.hits === 0) { if (always >= LIMITS.contextAlwaysRules) continue; always++; }
    const src = eventOf(l, s.i.sourceEvent);
    rules.push({ id: s.i.id, kind: s.i.kind, subject: s.i.subject, value: s.i.value, scope: s.i.scope, scopeId: s.i.scopeId, condition: s.i.condition, protected: isProtectedKind(s.i.kind), source: { event: s.i.sourceEvent, origin: src ? src.origin : 'external', confirmedBy: s.i.confirmedBy } });
  }
  const unconfirmed: UnconfirmedEntry[] = [];
  for (const i of seen.filter((x) => x.status === 'proposed' && (x.expiresAt === null || x.expiresAt > options.now))) {
    if (overlap(query, i) === 0 || unconfirmed.length >= 3) continue;
    const src = eventOf(l, i.sourceEvent);
    unconfirmed.push({ id: i.id, kind: i.kind, subject: i.subject, value: i.value, sourceOrigin: src ? src.origin : 'external', note: 'unconfirmed: the owner has not said yes; never an instruction' });
  }
  return { rules, unconfirmed, omitted: Math.max(0, chosen.length - rules.length) };
}

// ---------- validation ----------
/** Every invariant the engine promises. A ledger that fails any is refused whole by the store. */
export function validateLedger(x: unknown): string[] {
  const errors: string[] = [];
  const bad = (m: string): void => { if (errors.length < 20) errors.push(m); };
  if (!isObj(x) || x.version !== 1 || !Number.isInteger(x.rev) || (x.rev as number) < 0 || !Number.isInteger(x.nextItem) || (x.nextItem as number) < 1) return ['not a ledger'];
  if (!Array.isArray(x.events) || !Array.isArray(x.items) || !Array.isArray(x.usedTokens)) return ['not a ledger'];
  if (x.events.length > LIMITS.maxEvents || x.items.length > LIMITS.maxItems || x.usedTokens.length > LIMITS.maxTokens) return ['too large'];
  const events = new Map<string, CEvent>();
  const seqs = new Set<string>();
  const msgs = new Set<string>();
  for (const e of x.events as unknown[]) {
    if (!isObj(e) || !str(e.id, LIMITS.maxId) || !str(e.chat, LIMITS.maxId) || !str(e.messageId, LIMITS.maxId) || typeof e.text !== 'string' || e.text.length > LIMITS.maxEventText) { bad('event shape'); continue; }
    if (!ORIGINS.includes(e.origin as string) || !Number.isInteger(e.seq) || (e.seq as number) < 1 || typeof e.clipped !== 'boolean' || !finite(e.at)) { bad('event fields ' + e.id); continue; }
    if (e.id !== e.chat + '#' + e.seq) bad('event id does not match chat and seq ' + e.id);
    if (events.has(e.id) || seqs.has(e.chat + '|' + e.seq) || msgs.has(e.chat + '|' + e.messageId)) bad('duplicate event ' + e.id);
    events.set(e.id, e as unknown as CEvent); seqs.add(e.chat + '|' + e.seq); msgs.add(e.chat + '|' + e.messageId);
  }
  const items = new Map<string, Item>();
  for (const i of x.items as unknown[]) {
    if (!isObj(i) || !str(i.id, LIMITS.maxId) || !KINDS.includes(i.kind as string) || !SCOPES.includes(i.scope as string) || !STATUSES.includes(i.status as string)) { bad('item shape'); continue; }
    if (!str(i.subject, LIMITS.maxSubject) || !str(i.value, LIMITS.maxValue) || !str(i.scopeId, LIMITS.maxId) || !str(i.sourceEvent, LIMITS.maxId) || !finite(i.created) || !finite(i.changed)) { bad('item fields ' + i.id); continue; }
    if ((i.condition !== null && !str(i.condition, LIMITS.maxCondition)) || (i.expiresAt !== null && !finite(i.expiresAt)) || (i.parent !== null && typeof i.parent !== 'string') || (i.supersedes !== null && typeof i.supersedes !== 'string')) { bad('item optional fields ' + i.id); continue; }
    if (items.has(i.id)) { bad('duplicate item ' + i.id); continue; }
    items.set(i.id, i as unknown as Item);
  }
  const activeTargets = new Set<string>();
  for (const i of items.values()) {
    const src = events.get(i.sourceEvent);
    if (!src) bad('item ' + i.id + ' has no source event');
    if (i.scope === 'chat' && src && i.scopeId !== src.chat) bad('chat item ' + i.id + ' is not from its own chat');
    if (i.scope === 'user' && i.scopeId !== 'owner') bad('user item ' + i.id + ' has a wrong scope id');
    if (i.supersedes !== null && !items.has(i.supersedes)) bad('item ' + i.id + ' supersedes nothing');
    if (i.parent !== null && !items.has(i.parent)) bad('item ' + i.id + ' has no parent');
    if (i.kind === 'exception' && (i.parent === null || i.condition === null)) bad('exception ' + i.id + ' lacks parent or condition');
    if (i.kind !== 'exception' && i.parent !== null) bad('only an exception has a parent ' + i.id);
    if (i.status === 'proposed' || i.status === 'declined') {
      if (i.authority !== 'inferred' || i.approvalToken !== null) bad('item ' + i.id + ' is ' + i.status + ' but claims authority');
      if (i.status === 'proposed' && i.confirmedBy !== null) bad('proposed item ' + i.id + ' has a confirmation');
      if (i.kind === 'exception') bad('a proposal cannot be an exception ' + i.id);
    }
    if (i.status === 'active' || i.status === 'superseded') {
      if (i.authority !== 'owner') bad('item ' + i.id + ' is ' + i.status + ' without owner authority');
      const c = i.confirmedBy === null ? undefined : events.get(i.confirmedBy);
      if (!c || c.origin !== 'owner') bad('item ' + i.id + ' has no owner confirmation');
      if (src && i.supersedes !== null && src.origin !== 'owner') bad('item ' + i.id + ' changed something on non-owner evidence');
      if (src && c && i.scope === 'chat' && c.chat !== i.scopeId) bad('item ' + i.id + ' confirmed in another chat');
      if (isProtectedKind(i.kind) && i.approvalToken === null) bad('protected item ' + i.id + ' has no owner approval');
    }
    if (i.status === 'active') {
      if (i.kind !== 'exception') { const k = targetKey(i); if (activeTargets.has(k)) bad('two active items for one target ' + i.id); activeTargets.add(k); }
      if (i.kind === 'exception' && i.parent !== null) {
        const p = items.get(i.parent);
        if (!p || p.status !== 'active') bad('active exception ' + i.id + ' under an inactive base');
        else if (RANK[i.scope] <= RANK[p.scope]) bad('exception ' + i.id + ' is not narrower than its base');
      }
    }
  }
  for (const t of x.usedTokens as unknown[]) if (!isObj(t) || !str(t.token, LIMITS.maxId) || !finite(t.expires)) bad('used token shape');
  return errors;
}
