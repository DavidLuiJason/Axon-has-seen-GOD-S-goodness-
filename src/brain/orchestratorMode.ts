/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JOB 1 (D111): the ONE pinned switch for the orchestrator in the real chat.
 *   'off'    : chat behaves exactly as before the connection (the orchestrator is not even built).
 *   'shadow' : the owner's reply is EXACTLY the brain's reply; the orchestrator only records what it would have done (Job 1 default).
 *   'on'     : repair (said out loud; a risky one asks first, and yes / no / cancel / expiry are handled), the "which text?" question for a tool
 *              found without its text, and a tool answer that FAILS its own independent recheck is held back instead of shown (Jobs 3, 4, 6a).
 *              SHIPPED by Job 3+4 (D111). KILL SWITCH: set this line back to 'shadow' (or 'off') and chat is exactly the plain brain.
 * Changing this line is a decision, never an accident: tests/orchestratorConnection.test.ts pins it.
 */
import type { OrchestratorMode } from './mind/orchestrator/orchestrator';

export const ORCHESTRATOR_MODE: OrchestratorMode = 'on';
