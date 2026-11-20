/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auto-Clicker (D47): the screen as a real capability. Declarative only; chat control arrives with the brain wiring.
 */

import { registerCapability } from './registry';

export function registerAutoClickerCapability(): void {
  registerCapability({
    id: 'cap.auto-clicker',
    displayName: 'Auto-Clicker',
    contractVersion: '1.0.0',
    implementationVersion: '1.0.0',
    noChatAction: 'screen only',
  });
}
