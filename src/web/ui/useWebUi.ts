/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { getWebUiService } from './webUiService';
import type { WebGroup, WebState, WebTab, WebTabKind } from './webUiTypes';

function subscribeWebUi(listener: () => void): () => void {
  return getWebUiService().subscribe(listener);
}

function getWebUiSnapshot(): WebState {
  return getWebUiService().getState();
}

/** Subscribe to the entire WebState via useSyncExternalStore. */
export function useWebUiState(): WebState {
  return useSyncExternalStore(subscribeWebUi, getWebUiSnapshot, getWebUiSnapshot);
}

/**
 * Subscribe to a derived slice of WebState.
 * Only triggers a re-render when `isEqual(prev, next)` returns false.
 */
export function useWebUiSelector<T>(
  selector: (state: WebState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const cachedRef = useRef<{ initialized: boolean; value: T }>({
    initialized: false,
    value: undefined as T,
  });

  const getSelected = useCallback(() => {
    const next = selector(getWebUiSnapshot());
    if (cachedRef.current.initialized && isEqual(cachedRef.current.value, next)) {
      return cachedRef.current.value;
    }
    cachedRef.current = { initialized: true, value: next };
    return next;
  }, [selector, isEqual]);

  return useSyncExternalStore(subscribeWebUi, getSelected, getSelected);
}

function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function useWebActiveTab(): WebTab | null {
  return useWebUiSelector(
    useCallback(
      (s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null,
      []
    )
  );
}

export function useWebTab(tabId: string): WebTab | undefined {
  return useWebUiSelector(
    useCallback((s) => s.tabs.find((t) => t.id === tabId), [tabId])
  );
}

export function useWebTabCount(): number {
  return useWebUiSelector(useCallback((s) => s.tabs.length, []));
}

export interface WebKindCounts {
  normal: number;
  incognito: number;
  stealth: number;
}

export function useWebKindCounts(): WebKindCounts {
  return useWebUiSelector(
    useCallback((s): WebKindCounts => {
      let normal = 0;
      let incognito = 0;
      let stealth = 0;
      for (const tab of s.tabs) {
        if (tab.kind === 'normal') normal += 1;
        else if (tab.kind === 'incognito') incognito += 1;
        else if (tab.kind === 'stealth') stealth += 1;
      }
      return { normal, incognito, stealth };
    }, []),
    useCallback(
      (a, b) =>
        a.normal === b.normal &&
        a.incognito === b.incognito &&
        a.stealth === b.stealth,
      []
    )
  );
}

export function useWebTabsForKind(kind: WebTabKind): readonly WebTab[] {
  return useWebUiSelector(
    useCallback((s) => s.tabs.filter((t) => t.kind === kind), [kind]),
    shallowArrayEqual
  );
}

export function useWebGroupsForKind(kind: WebTabKind): readonly WebGroup[] {
  return useWebUiSelector(
    useCallback((s) => s.groups.filter((g) => g.kind === kind), [kind]),
    shallowArrayEqual
  );
}
