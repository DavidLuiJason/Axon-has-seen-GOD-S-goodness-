/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auto-Clicker (D47): the screen as a real interface, reached through the currentScreen router.
 */

import { registerInterface } from './registry';

export function registerAutoClickerInterface(): void {
  registerInterface({
    interfaceId: 'iface.auto-clicker',
    displayName: 'Auto-Clicker',
    parentId: null as null,
    kind: 'screen' as const,
    isNavigable: true,
  });
}
