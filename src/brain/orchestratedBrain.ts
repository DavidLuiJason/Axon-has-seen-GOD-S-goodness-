/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JOB 1 (D111): the connection between the real chat brain (Mind) and the P08 orchestrator. This is the ONLY place in src that builds an orchestrator.
 *
 * It returns the same surface as the Mind (ask, askWithTrace, sources, resetDialogue, dialogueSnapshot), so the chat boundary does not change.
 * Laws kept here:
 *   - ONE execution: the Mind is asked by the orchestrator, never a second time by this wrapper, unless the orchestrator failed BEFORE asking it.
 *     A reply the Mind already produced is reused, so a tool never runs twice for one message.
 *   - shadow: the owner gets the Mind's own reply and trace (the same objects). Orchestrator trouble can never change or break the reply.
 *   - shadow: once the Mind has answered, the orchestrator gets `settleMs` to finish; after that the reply goes out anyway (chat never waits on it).
 *   - on: the orchestrator's reply is used only when it says it changed the reply; a failure falls back to the Mind's reply.
 *   - off: the orchestrator is not built at all.
 *   - memory is bounded: only the last `keep` orchestrations are held, in memory, never saved.
 */
import type { BrainReply, BrainRequest } from './types';
import type { Mind } from './mind';
import { createOrchestrator } from './mind/orchestrator/orchestrator';
import type { Orchestration, OrchestratorMode, ReplyLike } from './mind/orchestrator/orchestrator';

type Out = { reply: BrainReply; trace: Awaited<ReturnType<Mind['askWithTrace']>>['trace'] };
type OrchestratorLike = {
  ask(request: { text: string; place: string }): Promise<{ reply: ReplyLike; trace: unknown; orchestration: Orchestration }>;
  stats(): Record<string, unknown>;
  resetDialogue(): void;
};
type BrainLike = { askWithTrace(request: { text: string; place: string }): Promise<{ reply: ReplyLike; trace: unknown }> };

export type OrchestratedOptions = {
  readonly mode: OrchestratorMode;
  /** How long (ms) a shadow orchestrator may keep going after the Mind has answered. */
  readonly settleMs?: number;
  /** How many recent orchestrations are kept in memory. */
  readonly keep?: number;
  /** Test hook: build the orchestrator yourself. */
  readonly create?: (brain: BrainLike) => OrchestratorLike;
};

export type OrchestratorStatus = {
  readonly mode: OrchestratorMode;
  /** Messages that went through the wrapper. */
  readonly messages: number;
  /** The orchestrator threw, or did not return a usable result. */
  readonly failures: number;
  /** Shadow orchestrator was still running after settleMs; the reply went out without it. */
  readonly timeouts: number;
  /** The orchestrator failed before the Mind answered, so the Mind was asked once directly. */
  readonly fallbacks: number;
  /** Orchestrator replies that reached the owner (always 0 in shadow). */
  readonly orchestratorReplies: number;
  /** The orchestrator's own counters (repairs, rechecks, dialogue), or null when it is off. */
  readonly stats: Record<string, unknown> | null;
};

export type OrchestratedBrain = Mind & {
  orchestratorStatus(): OrchestratorStatus;
  recentOrchestrations(): readonly Orchestration[];
};

const TIMED_OUT = Symbol('timed-out');

export function withOrchestrator(mind: Mind, options: OrchestratedOptions): OrchestratedBrain {
  const mode = options.mode;
  const settleMs = options.settleMs ?? 1500;
  const keep = Math.max(1, options.keep ?? 50);
  const recent: Orchestration[] = [];
  const tally = { messages: 0, failures: 0, timeouts: 0, fallbacks: 0, orchestratorReplies: 0 };

  let current: { calls: Out[]; answered: () => void } | null = null;
  const counted: BrainLike = {
    async askWithTrace(request) {
      const slot = current;
      try {
        const out = (await mind.askWithTrace(request as BrainRequest)) as Out;
        slot?.calls.push(out);
        return out;
      } finally {
        slot?.answered();
      }
    },
  };

  let orchestrator: OrchestratorLike | null = null;
  if (mode !== 'off') {
    try {
      orchestrator = options.create ? options.create(counted) : (createOrchestrator(counted as never, { mode }) as unknown as OrchestratorLike);
    } catch {
      orchestrator = null;
      tally.failures++;
    }
  }

  const status = (): OrchestratorStatus => {
    let stats: Record<string, unknown> | null = null;
    try { stats = orchestrator ? orchestrator.stats() : null; } catch { stats = null; }
    return { mode, ...tally, stats };
  };

  async function run(request: BrainRequest): Promise<Out> {
    tally.messages++;
    if (orchestrator === null) return (await mind.askWithTrace(request)) as Out;
    const calls: Out[] = [];
    let release: () => void = () => {};
    const answered = new Promise<void>((resolve) => { release = resolve; });
    current = { calls, answered: release };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const orchestration = orchestrator.ask({ text: request.text, place: request.place }).then((value) => ({ ok: true as const, value }), () => ({ ok: false as const }));
    // Shadow only: after the Mind has answered, the orchestrator gets settleMs. (In 'on' it may legitimately call the Mind twice, so it is awaited.)
    const guard = mode === 'shadow'
      ? answered.then(() => new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), settleMs); }))
      : new Promise<never>(() => {});
    const result = await Promise.race([orchestration, guard]);
    if (timer !== undefined) clearTimeout(timer);
    current = null;
    const base = calls.length > 0 ? calls[calls.length - 1] : null;

    if (result === TIMED_OUT) { tally.timeouts++; return base as Out; }
    if (!result.ok) {
      tally.failures++;
      if (base !== null) return base;
      tally.fallbacks++;
      return (await mind.askWithTrace(request)) as Out;
    }
    const { reply, trace, orchestration: seen } = result.value;
    recent.push(seen);
    while (recent.length > keep) recent.shift();
    if (mode === 'shadow' && base !== null) return base;
    if (mode === 'shadow') { tally.failures++; tally.fallbacks++; return (await mind.askWithTrace(request)) as Out; }
    // mode 'on'
    if (!seen.replyChanged && base !== null) return base;
    tally.orchestratorReplies++;
    const own = reply.source.startsWith('orchestrator:');
    const shaped: BrainReply = own || base === null
      ? { content: reply.content, source: reply.source, ...(reply.taskId ? { taskId: reply.taskId } : {}) }
      : { ...base.reply, content: reply.content, source: reply.source, ...(reply.taskId ? { taskId: reply.taskId } : {}) };
    return { reply: shaped, trace: (trace ?? base?.trace) as Out['trace'] };
  }

  // One message at a time, as in the chat: keeps the per-message bookkeeping exact.
  let chain: Promise<unknown> = Promise.resolve();
  const queued = (request: BrainRequest): Promise<Out> => {
    const next = chain.then(() => run(request), () => run(request));
    chain = next.catch(() => undefined);
    return next;
  };

  return {
    ask: async (request: BrainRequest) => (await queued(request)).reply,
    askWithTrace: (request: BrainRequest) => queued(request),
    sources: () => mind.sources(),
    resetDialogue: () => {
      mind.resetDialogue();
      try { orchestrator?.resetDialogue(); } catch { /* a reset is a convenience; the chat must keep working */ }
    },
    dialogueSnapshot: () => mind.dialogueSnapshot(),
    orchestratorStatus: status,
    recentOrchestrations: () => [...recent],
  };
}
