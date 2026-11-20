/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Apps (D47): the screen as a real capability. Declarative only; chat control arrives with the brain wiring.
 */

import { registerCapability } from './registry';

export function registerAxonAppsCapability(): void {
  registerCapability({
    id: 'cap.axon-apps',
    displayName: 'AXON Apps',
    contractVersion: '1.0.0',
    implementationVersion: '1.0.0',
    noChatAction: 'screen only',
  });
}
