/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import type { WebTabKind } from '../../web/ui/webUiTypes';

export type WebSheetId =
  | 'recent-tabs'
  | 'history'
  | 'bookmarks'
  | 'downloads'
  | 'clear-data'
  | 'site-controls'
  | 'translate'
  | 'share'
  | 'help';

interface WebNoticeEvent {
  text: string | null;
  seq: number;
}

interface WebUiPanelState {
  isTabSwitcherOpen: boolean;
  switcherKind: WebTabKind;
  composerFocusSeq: number;
  notice: WebNoticeEvent;
  activeSheet: WebSheetId | null;
  isFindBarOpen: boolean;
}

let state: WebUiPanelState = {
  isTabSwitcherOpen: false,
  switcherKind: 'normal',
  composerFocusSeq: 0,
  notice: { text: null, seq: 0 },
  activeSheet: null,
  isFindBarOpen: false,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWebUiPanelState(): WebUiPanelState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}

export function useIsTabSwitcherOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.isTabSwitcherOpen,
    () => state.isTabSwitcherOpen
  );
}

export function useSwitcherKind(): WebTabKind {
  return useSyncExternalStore(
    subscribe,
    () => state.switcherKind,
    () => state.switcherKind
  );
}

export function useComposerFocusSeq(): number {
  return useSyncExternalStore(
    subscribe,
    () => state.composerFocusSeq,
    () => state.composerFocusSeq
  );
}

export function useWebNoticeEvent(): WebNoticeEvent {
  return useSyncExternalStore(
    subscribe,
    () => state.notice,
    () => state.notice
  );
}

export function useActiveWebSheet(): WebSheetId | null {
  return useSyncExternalStore(
    subscribe,
    () => state.activeSheet,
    () => state.activeSheet
  );
}

export function useIsFindBarOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.isFindBarOpen,
    () => state.isFindBarOpen
  );
}

export function openTabSwitcher(): void {
  if (state.isTabSwitcherOpen) return;
  state = { ...state, isTabSwitcherOpen: true, isFindBarOpen: false };
  emit();
}

export function closeTabSwitcher(): void {
  if (!state.isTabSwitcherOpen) return;
  state = { ...state, isTabSwitcherOpen: false };
  emit();
}

export function toggleTabSwitcher(): void {
  const next = !state.isTabSwitcherOpen;
  state = {
    ...state,
    isTabSwitcherOpen: next,
    isFindBarOpen: next ? false : state.isFindBarOpen,
  };
  emit();
}

export function setSwitcherKind(kind: WebTabKind): void {
  if (state.switcherKind === kind) return;
  state = { ...state, switcherKind: kind };
  emit();
}

export function requestWebComposerFocus(): void {
  state = { ...state, composerFocusSeq: state.composerFocusSeq + 1 };
  emit();
}

export function showWebNotice(text: string): void {
  state = { ...state, notice: { text, seq: state.notice.seq + 1 } };
  emit();
}

export function openWebSheet(sheet: WebSheetId): void {
  if (state.activeSheet === sheet) return;
  state = { ...state, activeSheet: sheet };
  emit();
}

export function closeWebSheet(): void {
  if (state.activeSheet === null) return;
  state = { ...state, activeSheet: null };
  emit();
}

export function openFindBar(): void {
  if (state.isFindBarOpen && !state.isTabSwitcherOpen) return;
  state = { ...state, isFindBarOpen: true, isTabSwitcherOpen: false };
  emit();
}

export function closeFindBar(): void {
  if (!state.isFindBarOpen) return;
  state = { ...state, isFindBarOpen: false };
  emit();
}
