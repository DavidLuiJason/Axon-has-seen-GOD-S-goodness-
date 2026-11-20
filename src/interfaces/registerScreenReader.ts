/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Screen Reader (D47): the screen as a real interface, reached through the currentScreen router.
 */

import { registerInterface } from './registry';

export function registerScreenReaderInterface(): void {
  registerInterface({
    interfaceId: 'iface.screen-reader',
    displayName: 'Screen Reader',
    parentId: null as null,
    kind: 'screen' as const,
    isNavigable: true,
  });
}
