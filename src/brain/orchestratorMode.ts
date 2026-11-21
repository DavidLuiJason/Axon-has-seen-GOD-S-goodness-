/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JOB 1 (D111): the ONE pinned switch for the orchestrator in the real chat.
 *   'off'    : chat behaves exactly as before the connection (the orchestrator is not even built).
 *   'shadow' : the owner's reply is EXACTLY the brain's reply; the orchestrator only records what it would have done. Shipped default.
 *   'on'     : repair / questions / held-back failed rechecks reach the owner. NOT shipped: flipping this needs the activation job, its
 *              measured shadow numbers (`getOrchestratorStatus()`) and a new pin in tests/orchestratorConnection.test.ts.
 * Changing this line is a decision, never an accident: the test pins it.
 */
import type { OrchestratorMode } from './mind/orchestrator/orchestrator';

export const ORCHESTRATOR_MODE: OrchestratorMode = 'shadow';
