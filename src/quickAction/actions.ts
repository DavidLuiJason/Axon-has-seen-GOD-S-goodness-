/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  QuickActionDefinition,
  QuickActionId,
  QuickActionPage,
  QuickActionPageDefinition,
} from './types';

export const QUICK_ACTION_PAGES: readonly QuickActionPageDefinition[] = [
  { id: 'chat', label: 'Chat', description: 'Talk with AXON' },
  { id: 'web', label: 'Web', description: 'Browse & search pages' },
  { id: 'apps', label: 'Apps', description: 'Phone apps workspace' },
] as const;

const ALL_PAGES: readonly QuickActionPage[] = ['chat', 'web', 'apps'];

export const QUICK_ACTIONS: readonly QuickActionDefinition[] = [
  {
    id: 'none',
    label: 'None',
    description: 'Do nothing for this gesture',
    allowedPages: ALL_PAGES,
  },
  {
    id: 'toggle-chat-web',
    label: 'Toggle Chat / Web',
    description: 'Switch between Chat and Web',
    allowedPages: ALL_PAGES,
  },
  {
    id: 'switch-chat',
    label: 'Switch to Chat',
    description: 'Open AXON Chat',
    allowedPages: ALL_PAGES,
  },
  {
    id: 'switch-web',
    label: 'Switch to Web',
    description: 'Open AXON Web',
    allowedPages: ALL_PAGES,
  },
  {
    id: 'switch-apps',
    label: 'Switch to Apps',
    description: 'Open AXON Apps',
    allowedPages: ALL_PAGES,
  },
  {
    id: 'new-chat',
    label: 'New chat',
    description: 'Start a fresh conversation',
    allowedPages: ['chat'],
  },
  {
    id: 'scroll-latest',
    label: 'Scroll to latest',
    description: 'Jump to the newest message',
    allowedPages: ['chat'],
  },
  {
    id: 'new-tab',
    label: 'New tab',
    description: 'Open a new browser tab',
    allowedPages: ['web'],
  },
  {
    id: 'tab-switcher',
    label: 'Tab switcher',
    description: 'View open browser tabs',
    allowedPages: ['web'],
  },
  {
    id: 'refresh',
    label: 'Refresh',
    description: 'Reload the current page',
    allowedPages: ['web'],
  },
  {
    id: 'back',
    label: 'Back',
    description: 'Go back to previous page',
    allowedPages: ['web'],
  },
  {
    id: 'find-in-page',
    label: 'Find in page',
    description: 'Search text on the current page',
    allowedPages: ['web'],
  },
  {
    id: 'reader-mode',
    label: 'Reader mode',
    description: 'Toggle distraction-free reading',
    allowedPages: ['web'],
  },
  {
    id: 'desktop-site',
    label: 'Desktop site',
    description: 'Toggle desktop page layout',
    allowedPages: ['web'],
  },
  {
    id: 'bookmark-page',
    label: 'Bookmark page',
    description: 'Save or remove current bookmark',
    allowedPages: ['web'],
  },
  {
    id: 'pane-view',
    label: 'Pane view',
    description: 'Open AXON Foundation & layout inspector',
    allowedPages: ALL_PAGES,
  },
] as const;

const ACTION_MAP = new Map<QuickActionId, QuickActionDefinition>(
  QUICK_ACTIONS.map((action) => [action.id, action])
);

export function getActionDefinition(id: QuickActionId): QuickActionDefinition | undefined {
  return ACTION_MAP.get(id);
}

export function isValidActionId(value: unknown): value is QuickActionId {
  return typeof value === 'string' && ACTION_MAP.has(value as QuickActionId);
}

export function isActionAllowedOnPage(id: QuickActionId, page: QuickActionPage): boolean {
  const def = ACTION_MAP.get(id);
  return def ? def.allowedPages.includes(page) : false;
}

export function getAllowedActionsForPage(
  page: QuickActionPage,
  includeNone: boolean
): readonly QuickActionDefinition[] {
  return QUICK_ACTIONS.filter(
    (action) =>
      (includeNone || action.id !== 'none') && action.allowedPages.includes(page)
  );
}
