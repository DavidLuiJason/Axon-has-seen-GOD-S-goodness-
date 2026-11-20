/**
 * Quick Action button unit tests: defaults, validation, store mutations, and executor.
 */
import {
  getAllowedActionsForPage,
  isActionAllowedOnPage,
  QUICK_ACTION_PAGES,
} from '../src/quickAction/actions';
import {
  DEFAULT_QUICK_ACTION_CONFIG,
  MAX_MENU_ACTIONS,
  QUICK_ACTION_SCHEMA_VERSION,
} from '../src/quickAction/defaults';
import {
  getQuickActionConfigSnapshot,
  moveQuickActionMenuItem,
  resetQuickActionPage,
  setQuickActionGesture,
  toggleQuickActionMenuItem,
  validatePersistedQuickAction,
} from '../src/quickAction/store';
import { executeQuickAction } from '../src/quickAction/executor';
import { getWebUiService } from '../src/web/ui/webUiService';
import type { AxonMode } from '../src/types';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

async function run() {
  console.log('=== quick action tests ===');

  assert(QUICK_ACTION_PAGES.length === 3, 'data-driven page list has chat, web, apps');
  assert(
    DEFAULT_QUICK_ACTION_CONFIG.chat.tap === 'toggle-chat-web' &&
      DEFAULT_QUICK_ACTION_CONFIG.chat.doubleTap === 'new-chat' &&
      DEFAULT_QUICK_ACTION_CONFIG.chat.tripleTap === 'none',
    'chat default gestures match spec'
  );
  assert(
    DEFAULT_QUICK_ACTION_CONFIG.web.tap === 'toggle-chat-web' &&
      DEFAULT_QUICK_ACTION_CONFIG.web.doubleTap === 'refresh' &&
      DEFAULT_QUICK_ACTION_CONFIG.web.tripleTap === 'tab-switcher',
    'web default gestures match spec'
  );
  assert(
    DEFAULT_QUICK_ACTION_CONFIG.apps.tap === 'switch-chat' &&
      DEFAULT_QUICK_ACTION_CONFIG.apps.doubleTap === 'none' &&
      DEFAULT_QUICK_ACTION_CONFIG.apps.tripleTap === 'none',
    'apps default gestures match spec'
  );

  assert(isActionAllowedOnPage('new-chat', 'chat'), 'new-chat allowed on chat');
  assert(!isActionAllowedOnPage('new-chat', 'web'), 'new-chat disallowed on web');
  assert(isActionAllowedOnPage('refresh', 'web'), 'refresh allowed on web');
  assert(!isActionAllowedOnPage('refresh', 'chat'), 'refresh disallowed on chat');
  assert(
    getAllowedActionsForPage('apps', true).some((a) => a.id === 'pane-view'),
    'pane-view allowed on apps'
  );

  // Persistence validation rejects bad versions, bad actions, and over-limit menus
  assert(validatePersistedQuickAction(null) === null, 'null payload rejected');
  assert(
    validatePersistedQuickAction({ version: 99, pages: DEFAULT_QUICK_ACTION_CONFIG }) === null,
    'wrong version rejected'
  );
  assert(
    validatePersistedQuickAction({
      version: QUICK_ACTION_SCHEMA_VERSION,
      pages: {
        ...DEFAULT_QUICK_ACTION_CONFIG,
        chat: { ...DEFAULT_QUICK_ACTION_CONFIG.chat, tap: 'refresh' },
      },
    }) === null,
    'disallowed action for page rejected'
  );
  assert(
    validatePersistedQuickAction({
      version: QUICK_ACTION_SCHEMA_VERSION,
      pages: {
        ...DEFAULT_QUICK_ACTION_CONFIG,
        web: {
          ...DEFAULT_QUICK_ACTION_CONFIG.web,
          menu: ['new-tab', 'tab-switcher', 'refresh', 'back', 'find-in-page', 'reader-mode'],
        },
      },
    }) === null,
    'menu > 5 items rejected'
  );
  assert(
    validatePersistedQuickAction({
      version: QUICK_ACTION_SCHEMA_VERSION,
      pages: DEFAULT_QUICK_ACTION_CONFIG,
    }) !== null,
    'valid v1 payload accepted'
  );

  // Store mutations & reset
  setQuickActionGesture('chat', 'tripleTap', 'scroll-latest');
  assert(getQuickActionConfigSnapshot().chat.tripleTap === 'scroll-latest', 'setQuickActionGesture updates snapshot');

  // Toggle menu cap (max 5)
  toggleQuickActionMenuItem('chat', 'pane-view');
  assert(getQuickActionConfigSnapshot().chat.menu.length === MAX_MENU_ACTIONS, 'menu grows to max 5');
  toggleQuickActionMenuItem('chat', 'switch-chat');
  assert(getQuickActionConfigSnapshot().chat.menu.length === MAX_MENU_ACTIONS, 'menu does not exceed max 5');

  moveQuickActionMenuItem('chat', 'pane-view', -1);
  const movedMenu = getQuickActionConfigSnapshot().chat.menu;
  assert(movedMenu[3] === 'pane-view', 'moveQuickActionMenuItem reorders item up');

  resetQuickActionPage('chat');
  assert(
    getQuickActionConfigSnapshot().chat.tripleTap === 'none' &&
      getQuickActionConfigSnapshot().chat.menu.length === 4,
    'resetQuickActionPage restores chat defaults'
  );

  // Executor runtime checks
  const runtime = { mode: 'chat' as AxonMode };
  let paneOpened = false;
  let newChatCalled = false;
  const notices: string[] = [];

  await executeQuickAction('toggle-chat-web', {
    mode: runtime.mode,
    onModeChange: (m) => {
      runtime.mode = m;
    },
    onOpenPaneView: () => {
      paneOpened = true;
    },
  });
  assert(runtime.mode === 'web', 'toggle-chat-web switches chat -> web');

  await executeQuickAction('toggle-chat-web', {
    mode: runtime.mode,
    onModeChange: (m) => {
      runtime.mode = m;
    },
    onOpenPaneView: () => {
      paneOpened = true;
    },
  });
  assert(runtime.mode === 'chat', 'toggle-chat-web switches web -> chat');

  await executeQuickAction('toggle-chat-web', {
    mode: 'apps',
    onModeChange: (m) => {
      runtime.mode = m;
    },
    onOpenPaneView: () => {
      paneOpened = true;
    },
  });
  assert(runtime.mode === 'chat', 'toggle-chat-web switches apps -> chat');

  await executeQuickAction('new-chat', {
    mode: 'chat',
    onModeChange: (m) => {
      runtime.mode = m;
    },
    onNewChat: () => {
      newChatCalled = true;
    },
    onOpenPaneView: () => {},
  });
  assert(newChatCalled, 'new-chat invokes onNewChat');

  await executeQuickAction('pane-view', {
    mode: 'chat',
    onModeChange: () => {},
    onOpenPaneView: () => {
      paneOpened = true;
    },
  });
  assert(paneOpened, 'pane-view invokes onOpenPaneView');

  // Web service integration check
  const beforeTabs = getWebUiService().getState().tabs.length;
  await executeQuickAction('new-tab', {
    mode: 'web',
    onModeChange: () => {},
    onOpenPaneView: () => {},
    onNotice: (n) => notices.push(n),
  });
  assert(getWebUiService().getState().tabs.length === beforeTabs + 1, 'new-tab calls getWebUiService().newTab');
  assert(notices.length === 1, 'new-tab reports calm status notice');

  console.log(`=== quick action tests passed: ${checks} checks ===`);
}

void run();
