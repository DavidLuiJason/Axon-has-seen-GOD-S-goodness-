/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JOB 9 (D926, rebuilt and checked by D84): THE BRAIN'S DOOR TO OUTSIDE AI SERVICES.
 * It wraps the pure contract in external/external.ts (rules only: it never sends anything) with the one thing the contract leaves out: the sending itself,
 * which is INJECTED (`send`). With no `send` nothing is connected and this says so; it never pretends. What an outside AI says is returned as what it said:
 * UNTRUSTED, evidence REPORTED, never an order to AXON, never a fact. A service the owner must approve is asked about first, naming what would be shared.
 * Every attempt is kept in a bounded log with the exact parts, so the owner can see what was sent. A failure or a timeout is isolated: it becomes a plain sentence.
 * The real transport (keys, HTTP status handling, size and turn limits) is the sender's job: src/web/outsideAiGate.ts (redactSecrets, classifyReply, gateRequest) belongs THERE.
 * Pure apart from the injected `send` and a timer. No phrases, no regular expressions.
 */
import { prepareRequest, receiveResponse } from '../external/external.ts';
import type { AiPart, AiRequest, AiResult, AiServiceEntry, PreparedRequest } from '../external/external.ts';

export type OutsideSend = (prepared: PreparedRequest) => Promise<string>;
export type OutsideOutcome =
  | { readonly kind: 'NOT_CONNECTED'; readonly say: string }
  | { readonly kind: 'NEEDS_APPROVAL'; readonly say: string; readonly provider: string }
  | { readonly kind: 'REFUSED'; readonly say: string; readonly error: string }
  | { readonly kind: 'FAILED'; readonly say: string }
  | { readonly kind: 'ANSWERED'; readonly say: string; readonly provider: string; readonly result: AiResult };
export type OutsideLogEntry = { readonly serviceId: string; readonly provider: string; readonly purpose: string; readonly parts: readonly AiPart[]; readonly outcome: OutsideOutcome['kind'] };
export type OutsideAiOptions = { readonly registry: readonly AiServiceEntry[]; readonly secrets: readonly string[]; readonly send: OutsideSend | null; readonly timeoutMs?: number };

export const LOG_LIMIT = 50;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    work.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export function createOutsideAi(options: OutsideAiOptions) {
  const log: OutsideLogEntry[] = [];
  const timeoutMs = options.timeoutMs ?? 20000;
  const keep = (entry: OutsideLogEntry): void => { log.push(entry); while (log.length > LOG_LIMIT) log.shift(); };

  async function ask(request: AiRequest, approved: boolean): Promise<OutsideOutcome> {
    const send = options.send;
    if (send === null || options.registry.length === 0) return { kind: 'NOT_CONNECTED', say: 'No outside AI is connected, so I did not send anything.' };
    const service = options.registry.find((e) => e.id === request.serviceId);
    const provider = service?.provider ?? 'that service';
    const prepared = prepareRequest(options.registry, request, options.secrets, approved);
    if (!prepared.ok) {
      if (prepared.error === 'unknown-service' || prepared.error === 'unavailable') return { kind: 'NOT_CONNECTED', say: provider + ' is not connected or not ready, so I did not send anything.' };
      if (prepared.error === 'needs-approval') {
        const labels = request.parts.map((p) => p.label).join(', ');
        return { kind: 'NEEDS_APPROVAL', provider, say: 'Before I send anything to ' + provider + ' I need your approval. It would receive: ' + labels + '. Shall I go ahead?' };
      }
      return { kind: 'REFUSED', error: prepared.error, say: 'I did not send anything to ' + provider + '. ' + prepared.message };
    }
    const outcome = async (): Promise<OutsideOutcome> => {
      let raw: string;
      try { raw = await withTimeout(send(prepared.value), timeoutMs); } catch { return { kind: 'FAILED', say: 'I could not get an answer from ' + provider + '. Nothing was changed.' }; }
      const got = receiveResponse(prepared.value.serviceId, raw);
      if (!got.ok) return { kind: 'FAILED', say: 'The answer from ' + provider + ' could not be used: ' + got.message + ' Nothing was changed.' };
      return { kind: 'ANSWERED', provider, result: got.value, say: provider + ' answered. I have not checked this, so treat it as unverified:\n\n' + got.value.content };
    };
    const done = await outcome();
    keep({ serviceId: prepared.value.serviceId, provider, purpose: request.purpose, parts: prepared.value.parts.map((p) => ({ ...p })), outcome: done.kind });
    return done;
  }

  return { ask, log: (): readonly OutsideLogEntry[] => log.map((e) => ({ ...e, parts: e.parts.map((p) => ({ ...p })) })) };
}
export type OutsideAi = ReturnType<typeof createOutsideAi>;
