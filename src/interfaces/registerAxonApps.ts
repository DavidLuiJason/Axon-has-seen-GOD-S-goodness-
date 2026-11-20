/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Apps (D47): the screen as a real interface, reached through the currentScreen router.
 */

import { registerInterface } from './registry';

export function registerAxonAppsInterface(): void {
  registerInterface({
    interfaceId: 'iface.axon-apps',
    displayName: 'AXON Apps',
    parentId: null as null,
    kind: 'screen' as const,
    isNavigable: true,
  });
}
