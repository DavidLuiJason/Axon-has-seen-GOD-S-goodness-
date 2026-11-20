/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import { isActionAllowedOnPage, isValidActionId, QUICK_ACTION_PAGES } from './actions';
import {
  cloneDefaultConfig,
  cloneDefaultPageConfig,
  MAX_MENU_ACTIONS,
  QUICK_ACTION_SCHEMA_VERSION,
  QUICK_ACTION_STORAGE_KEY,
} from './defaults';
import type {
  PersistedQuickActionPayload,
  QuickActionConfigMap,
  QuickActionId,
  QuickActionPage,
  QuickActionPageConfig,
} from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePageConfig(raw: unknown, page: QuickActionPage): QuickActionPageConfig | null {
  if (!isPlainObject(raw)) return null;

  const isAllowedSingle = (v: unknown): v is QuickActionId =>
    isValidActionId(v) && isActionAllowedOnPage(v, page);

  if (!isAllowedSingle(raw.tap)) return null;
  if (!isAllowedSingle(raw.doubleTap)) return null;
  if (!isAllowedSingle(raw.tripleTap)) return null;
  if (!Array.isArray(raw.menu)) return null;

  const menu: QuickActionId[] = [];
  const seen = new Set<QuickActionId>();
  for (const item of raw.menu) {
    if (!isValidActionId(item) || item === 'none' || !isActionAllowedOnPage(item, page)) {
      return null;
    }
    if (!seen.has(item)) {
      seen.add(item);
      menu.push(item);
    }
  }
  if (menu.length > MAX_MENU_ACTIONS) return null;

  return {
    tap: raw.tap,
    doubleTap: raw.doubleTap,
    tripleTap: raw.tripleTap,
    menu,
  };
}

export function validatePersistedQuickAction(raw: unknown): QuickActionConfigMap | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== QUICK_ACTION_SCHEMA_VERSION) return null;
  if (!isPlainObject(raw.pages)) return null;

  const result = cloneDefaultConfig();
  for (const pageDef of QUICK_ACTION_PAGES) {
    const validated = validatePageConfig(raw.pages[pageDef.id], pageDef.id);
    if (!validated) return null;
    result[pageDef.id] = validated;
  }
  return result;
}

function loadInitialConfig(): QuickActionConfigMap {
  try {
    if (typeof localStorage === 'undefined') return cloneDefaultConfig();
    const raw = localStorage.getItem(QUICK_ACTION_STORAGE_KEY);
    if (!raw) return cloneDefaultConfig();
    const parsed: unknown = JSON.parse(raw);
    return validatePersistedQuickAction(parsed) ?? cloneDefaultConfig();
  } catch {
    return cloneDefaultConfig();
  }
}

let configSnapshot: QuickActionConfigMap = loadInitialConfig();
let sheetStateSnapshot: { isOpen: boolean; initialPage: QuickActionPage | null } = {
  isOpen: false,
  initialPage: null,
};

const configListeners = new Set<() => void>();
const sheetListeners = new Set<() => void>();

let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DEBOUNCE_MS = 250;

function schedulePersist(nextConfig: QuickActionConfigMap): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      if (typeof localStorage === 'undefined') return;
      const payload: PersistedQuickActionPayload = {
        version: QUICK_ACTION_SCHEMA_VERSION,
        pages: nextConfig,
      };
      localStorage.setItem(QUICK_ACTION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota/storage errors so UI never blocks.
    }
  }, WRITE_DEBOUNCE_MS);
}

function updateConfig(updater: (prev: QuickActionConfigMap) => QuickActionConfigMap): void {
  configSnapshot = updater(configSnapshot);
  schedulePersist(configSnapshot);
  for (const listener of configListeners) listener();
}

function subscribeConfig(listener: () => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

function subscribeSheet(listener: () => void): () => void {
  sheetListeners.add(listener);
  return () => {
    sheetListeners.delete(listener);
  };
}

export function getQuickActionConfigSnapshot(): QuickActionConfigMap {
  return configSnapshot;
}

export function useQuickActionConfig(): QuickActionConfigMap {
  return useSyncExternalStore(
    subscribeConfig,
    getQuickActionConfigSnapshot,
    getQuickActionConfigSnapshot
  );
}

export function useQuickActionPageConfig(page: QuickActionPage): QuickActionPageConfig {
  return useSyncExternalStore(
    subscribeConfig,
    () => configSnapshot[page],
    () => configSnapshot[page]
  );
}

export function useQuickActionSettingsOpen(): {
  isOpen: boolean;
  initialPage: QuickActionPage | null;
} {
  return useSyncExternalStore(
    subscribeSheet,
    () => sheetStateSnapshot,
    () => sheetStateSnapshot
  );
}

export function setQuickActionGesture(
  page: QuickActionPage,
  slot: 'tap' | 'doubleTap' | 'tripleTap',
  actionId: QuickActionId
): void {
  if (!isActionAllowedOnPage(actionId, page)) return;
  updateConfig((prev) => ({
    ...prev,
    [page]: {
      ...prev[page],
      [slot]: actionId,
    },
  }));
}

export function toggleQuickActionMenuItem(
  page: QuickActionPage,
  actionId: QuickActionId
): void {
  if (actionId === 'none' || !isActionAllowedOnPage(actionId, page)) return;
  updateConfig((prev) => {
    const currentMenu = prev[page].menu;
    const exists = currentMenu.includes(actionId);
    if (exists) {
      return {
        ...prev,
        [page]: {
          ...prev[page],
          menu: currentMenu.filter((id) => id !== actionId),
        },
      };
    }
    if (currentMenu.length >= MAX_MENU_ACTIONS) return prev;
    return {
      ...prev,
      [page]: {
        ...prev[page],
        menu: [...currentMenu, actionId],
      },
    };
  });
}

export function moveQuickActionMenuItem(
  page: QuickActionPage,
  actionId: QuickActionId,
  direction: -1 | 1
): void {
  updateConfig((prev) => {
    const currentMenu = [...prev[page].menu];
    const index = currentMenu.indexOf(actionId);
    if (index === -1) return prev;
    const target = index + direction;
    if (target < 0 || target >= currentMenu.length) return prev;
    const swapped = currentMenu[target];
    currentMenu[target] = currentMenu[index];
    currentMenu[index] = swapped;
    return {
      ...prev,
      [page]: {
        ...prev[page],
        menu: currentMenu,
      },
    };
  });
}

export function resetQuickActionPage(page: QuickActionPage): void {
  updateConfig((prev) => ({
    ...prev,
    [page]: cloneDefaultPageConfig(page),
  }));
}

export function openQuickActionSettings(initialPage?: QuickActionPage): void {
  sheetStateSnapshot = {
    isOpen: true,
    initialPage: initialPage ?? null,
  };
  for (const listener of sheetListeners) listener();
}

export function closeQuickActionSettings(): void {
  if (!sheetStateSnapshot.isOpen) return;
  sheetStateSnapshot = {
    isOpen: false,
    initialPage: null,
  };
  for (const listener of sheetListeners) listener();
}
