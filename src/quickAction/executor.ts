/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getWebUiService } from '../web/ui/webUiService';
import type { QuickActionId, QuickActionRuntimeContext } from './types';

function emitWebUiAction(action: 'tab-switcher' | 'find-in-page' | 'new-tab'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('axon:web-ui-action', { detail: { action } }));
}

export async function executeQuickAction(
  actionId: QuickActionId,
  context: QuickActionRuntimeContext
): Promise<void> {
  switch (actionId) {
    case 'none':
      return;
    case 'toggle-chat-web':
      context.onModeChange(context.mode === 'chat' ? 'web' : 'chat');
      return;
    case 'switch-chat':
      context.onModeChange('chat');
      return;
    case 'switch-web':
      context.onModeChange('web');
      return;
    case 'switch-apps':
      context.onModeChange('apps');
      return;
    case 'new-chat':
      context.onNewChat?.();
      context.onModeChange('chat');
      return;
    case 'scroll-latest':
      context.onScrollLatest?.();
      return;
    case 'pane-view':
      context.onOpenPaneView();
      return;
    case 'new-tab': {
      const res = await getWebUiService().newTab('normal');
      if (res.ok) emitWebUiAction('new-tab');
      context.onNotice?.(res.ok ? 'Opened a new tab' : res.message);
      return;
    }
    case 'tab-switcher': {
      emitWebUiAction('tab-switcher');
      return;
    }
    case 'refresh': {
      const res = await getWebUiService().reload();
      if (!res.ok) context.onNotice?.(res.message);
      return;
    }
    case 'back': {
      const res = await getWebUiService().goBack();
      if (!res.ok) context.onNotice?.(res.message);
      return;
    }
    case 'find-in-page': {
      const res = await getWebUiService().findInPage('', true);
      if (res.ok) {
        emitWebUiAction('find-in-page');
      } else {
        context.onNotice?.(res.message);
      }
      return;
    }
    case 'reader-mode': {
      const res = await getWebUiService().toggleReaderMode();
      context.onNotice?.(
        res.ok
          ? res.value.enabled
            ? 'Reader mode enabled'
            : 'Reader mode disabled'
          : res.message
      );
      return;
    }
    case 'desktop-site': {
      const res = await getWebUiService().toggleDesktopSite();
      context.onNotice?.(
        res.ok
          ? res.value.enabled
            ? 'Desktop site enabled'
            : 'Desktop site disabled'
          : res.message
      );
      return;
    }
    case 'bookmark-page': {
      const res = await getWebUiService().bookmarkPage();
      context.onNotice?.(
        res.ok
          ? res.value.bookmarked
            ? 'Page bookmarked'
            : 'Bookmark removed'
          : res.message
      );
      return;
    }
  }
}
