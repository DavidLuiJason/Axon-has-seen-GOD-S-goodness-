/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { QuickActionConfigMap, QuickActionPage, QuickActionPageConfig } from './types';

export const QUICK_ACTION_STORAGE_KEY = 'axon.quickAction.v1';
export const QUICK_ACTION_SCHEMA_VERSION = 1 as const;
export const MAX_MENU_ACTIONS = 5;
export const TAP_DISAMBIGUATION_MS = 260;
export const LONG_PRESS_MS = 450;

export const DEFAULT_QUICK_ACTION_CONFIG: QuickActionConfigMap = {
  chat: {
    tap: 'toggle-chat-web',
    doubleTap: 'new-chat',
    tripleTap: 'none',
    menu: ['new-chat', 'scroll-latest', 'switch-web', 'switch-apps'],
  },
  web: {
    tap: 'toggle-chat-web',
    doubleTap: 'refresh',
    tripleTap: 'tab-switcher',
    menu: ['new-tab', 'tab-switcher', 'refresh', 'back'],
  },
  apps: {
    tap: 'switch-chat',
    doubleTap: 'none',
    tripleTap: 'none',
    menu: ['switch-chat', 'switch-web'],
  },
};

export function cloneDefaultPageConfig(page: QuickActionPage): QuickActionPageConfig {
  const def = DEFAULT_QUICK_ACTION_CONFIG[page];
  return {
    tap: def.tap,
    doubleTap: def.doubleTap,
    tripleTap: def.tripleTap,
    menu: [...def.menu],
  };
}

export function cloneDefaultConfig(): QuickActionConfigMap {
  return {
    chat: cloneDefaultPageConfig('chat'),
    web: cloneDefaultPageConfig('web'),
    apps: cloneDefaultPageConfig('apps'),
  };
}
