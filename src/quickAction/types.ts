/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AxonMode } from '../types';

export type QuickActionPage = AxonMode;

export type QuickActionId =
  | 'none'
  | 'toggle-chat-web'
  | 'switch-chat'
  | 'switch-web'
  | 'switch-apps'
  | 'new-chat'
  | 'scroll-latest'
  | 'new-tab'
  | 'tab-switcher'
  | 'refresh'
  | 'back'
  | 'find-in-page'
  | 'reader-mode'
  | 'desktop-site'
  | 'bookmark-page'
  | 'pane-view';

export type GestureSlot = 'tap' | 'doubleTap' | 'tripleTap' | 'menu';

export interface QuickActionPageConfig {
  tap: QuickActionId;
  doubleTap: QuickActionId;
  tripleTap: QuickActionId;
  menu: QuickActionId[];
}

export interface QuickActionConfigMap {
  chat: QuickActionPageConfig;
  web: QuickActionPageConfig;
  apps: QuickActionPageConfig;
}

export interface PersistedQuickActionPayload {
  version: 1;
  pages: QuickActionConfigMap;
}

export interface QuickActionDefinition {
  id: QuickActionId;
  label: string;
  description: string;
  allowedPages: readonly QuickActionPage[];
}

export interface QuickActionPageDefinition {
  id: QuickActionPage;
  label: string;
  description: string;
}

export interface QuickActionRuntimeContext {
  mode: AxonMode;
  onModeChange: (mode: AxonMode) => void;
  onNewChat?: () => void;
  onScrollLatest?: () => void;
  onOpenPaneView: () => void;
  onNotice?: (message: string) => void;
}
