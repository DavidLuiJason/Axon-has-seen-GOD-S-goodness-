/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Screen Reader (D47): the screen as a real capability. Declarative only; chat control arrives with the brain wiring.
 */

import { registerCapability } from './registry';

export function registerScreenReaderCapability(): void {
  registerCapability({
    id: 'cap.screen-reader',
    displayName: 'Screen Reader',
    contractVersion: '1.0.0',
    implementationVersion: '1.0.0',
    noChatAction: 'screen only',
  });
}
