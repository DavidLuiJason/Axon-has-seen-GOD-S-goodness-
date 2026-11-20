/**
 * AXON Web UI tests: kind styling, order, MockWebUiService flows, panel store, menu dimming, and sheets logic.
 */
import { WEB_TAB_KINDS } from '../src/web/ui/webUiTypes';
import { WEB_FEATURES } from '../src/web/ui/webFeatureFlags';
import { getWebUiService } from '../src/web/ui/webUiService';
import { getWebKindPresentation } from '../src/web/ui/webKindStyle';
import {
  closeFindBar,
  closeTabSwitcher,
  closeWebSheet,
  openFindBar,
  openTabSwitcher,
  openWebSheet,
  requestWebComposerFocus,
  setSwitcherKind,
  showWebNotice,
  toggleTabSwitcher,
} from '../src/components/web/webUiPanelStore';
import {
  dimCacheKey,
  isComingSoonResult,
  resolveMenuItemDimmed,
} from '../src/components/web/webMenuDim';
import {
  MAX_WEB_FEEDBACK_ENTRIES,
  WEB_FEEDBACK_STORAGE_KEY,
  readWebFeedbackEntries,
  saveWebFeedbackEntry,
  type StorageLike,
} from '../src/components/web/sheets/webFeedbackStorage';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

async function run() {
  console.log('=== web ui tests ===');

  assert(
    WEB_TAB_KINDS[0] === 'normal' &&
      WEB_TAB_KINDS[1] === 'incognito' &&
      WEB_TAB_KINDS[2] === 'stealth',
    'kind order is strictly normal, incognito, stealth'
  );

  const normalP = getWebKindPresentation('normal');
  const incognitoP = getWebKindPresentation('incognito');
  const stealthP = getWebKindPresentation('stealth');

  assert(
    normalP.showChip === false &&
      normalP.topLineClass === null &&
      normalP.searchPlaceholder === 'Search or type a web address',
    'normal presentation matches contract'
  );
  assert(
    incognitoP.showChip === true &&
      incognitoP.topLineClass === 'bg-[#9A9B9F]' &&
      incognitoP.surfaceBgClass === 'bg-[#0F1012]' &&
      incognitoP.isComingSoon === !WEB_FEATURES.incognito,
    'incognito presentation uses darker slate surface and silver accent'
  );
  assert(
    stealthP.showChip === true &&
      stealthP.topLineClass === 'bg-[#E85A3C]/60' &&
      stealthP.iconClass === 'text-[#E85A3C]' &&
      stealthP.isComingSoon === !WEB_FEATURES.stealth,
    'stealth presentation uses coral accent icon and line'
  );

  // Menu dimming rule checks
  assert(
    resolveMenuItemDimmed({}, 'normal', 'history') === false,
    'normal engine items are never dimmed on first paint'
  );
  assert(
    resolveMenuItemDimmed({}, 'incognito', 'history') === !WEB_FEATURES.incognito,
    'incognito first-paint dim tracks WEB_FEATURES.incognito'
  );
  assert(
    resolveMenuItemDimmed(
      { [dimCacheKey('incognito', 'refresh')]: false },
      'incognito',
      'refresh'
    ) === false,
    'cached non-coming-soon answer removes dimming without screen change'
  );
  assert(
    resolveMenuItemDimmed(
      { [dimCacheKey('stealth', 'bookmark')]: true },
      'stealth',
      'bookmark'
    ) === true,
    'cached coming-soon answer preserves dimming'
  );

  const service = getWebUiService();
  // Start clean across all kinds
  await service.closeAllTabs('normal');
  await service.closeAllTabs('incognito');
  await service.closeAllTabs('stealth');
  assert(service.getState().tabs.length === 0, 'starts with zero tabs');

  // Create normal tab & search twice to populate back stack and history
  const n1 = await service.newTab('normal');
  assert(n1.ok, 'newTab(normal) succeeds');
  const s1 = await service.search('example.com');
  assert(s1.ok, 'search in normal tab succeeds');
  const activeAfterSearch = service.getState().tabs.find((t) => t.id === service.getState().activeTabId);
  assert(activeAfterSearch?.url === 'https://example.com', 'search resolves domain URL');

  const s2 = await service.search('openai.com');
  assert(s2.ok, 'second navigation succeeds');
  const activeAfterSecond = service.getState().tabs.find((t) => t.id === service.getState().activeTabId);
  assert(activeAfterSecond?.canGoBack === true, 'canGoBack becomes true after second visit');
  const backRes = await service.goBack();
  assert(backRes.ok, 'goBack returns to prior page');
  const fwdRes = await service.goForward();
  assert(fwdRes.ok, 'goForward advances again');

  // Bookmarks, downloads, site info, find, translate, share, reader, desktop
  const bmToggle = await service.bookmarkPage();
  assert(bmToggle.ok && bmToggle.value.bookmarked === true, 'bookmarkPage bookmarks current page');
  const bms = await service.listBookmarks();
  assert(bms.length >= 1, 'listBookmarks contains saved bookmark');
  const dlRes = await service.downloadPage();
  assert(dlRes.ok, 'downloadPage succeeds');
  assert((await service.listDownloads()).length >= 1, 'listDownloads contains download');

  const readerRes = await service.toggleReaderMode();
  assert(readerRes.ok && readerRes.value.enabled === true, 'toggleReaderMode toggles on');
  const desktopRes = await service.toggleDesktopSite();
  assert(desktopRes.ok && desktopRes.value.enabled === true, 'toggleDesktopSite toggles on');

  const findRes = await service.findInPage('example', true);
  assert(findRes.ok && findRes.value.matches > 0, 'findInPage returns match count');
  service.clearFind();

  const trRes = await service.translatePage('fr');
  assert(trRes.ok, 'translatePage succeeds on normal tab');
  const shRes = await service.share('pdf');
  assert(shRes.ok, 'share(pdf) succeeds on normal tab');

  const siteRes = await service.getSiteInfo();
  assert(siteRes.ok, 'getSiteInfo succeeds on loaded normal tab');
  const permRes = await service.setSitePermission('camera', 'allow');
  assert(permRes.ok, 'setSitePermission updates permission');

  const histBefore = await service.listHistory('openai');
  assert(histBefore.length >= 1, 'listHistory filters by query');
  const clearRes = await service.clearBrowsingData(['history']);
  assert(clearRes.ok && (await service.listHistory()).length === 0, 'clearBrowsingData clears history');

  // Closing loaded normal tab populates recentlyClosed and can be reopened
  if (n1.ok) {
    await service.closeTab(n1.value.tabId);
    const closedList = service.recentlyClosed();
    assert(closedList.length >= 1, 'closing loaded normal tab records recentlyClosed');
    const reopened = await service.reopenClosedTab(0);
    assert(reopened.ok, 'reopenClosedTab restores closed tab');
  }

  // Create incognito & stealth tabs (always allowed), verify page engine actions return coming-soon
  const inc1 = await service.newTab('incognito');
  assert(inc1.ok, 'newTab(incognito) succeeds');
  const sInc = await service.search('privacy');
  assert(isComingSoonResult(sInc), 'incognito search returns coming-soon');
  const siteInc = await service.getSiteInfo();
  assert(isComingSoonResult(siteInc), 'incognito getSiteInfo returns coming-soon');

  const st1 = await service.newTab('stealth');
  assert(st1.ok, 'newTab(stealth) succeeds');
  const sSt = await service.search('ghost');
  assert(isComingSoonResult(sSt), 'stealth search returns coming-soon');
  const shSt = await service.share('link');
  assert(isComingSoonResult(shSt), 'stealth share returns coming-soon');

  // Tab & Group management
  const n2 = await service.newTab('normal');
  if (n2.ok) {
    const mv = await service.moveTabToKind(n2.value.tabId, 'stealth');
    assert(isComingSoonResult(mv), 'moveTabToKind returns coming-soon');

    const pinRes = await service.pinTab(n2.value.tabId, true);
    assert(pinRes.ok, 'pinTab succeeds');
    const dupRes = await service.duplicateTab(n2.value.tabId);
    assert(dupRes.ok, 'duplicateTab succeeds');

    const grpRes = await service.createGroup('Work', [n2.value.tabId]);
    assert(grpRes.ok, 'createGroup succeeds');
    if (grpRes.ok) {
      const renRes = await service.renameGroup(grpRes.value.groupId, 'Research');
      assert(renRes.ok, 'renameGroup succeeds');
      if (dupRes.ok) {
        const addRes = await service.addToGroup(dupRes.value.tabId, grpRes.value.groupId);
        assert(addRes.ok, 'addToGroup succeeds');
        const remRes = await service.removeFromGroup(dupRes.value.tabId);
        assert(remRes.ok, 'removeFromGroup succeeds');
      }
      const delRes = await service.deleteGroup(grpRes.value.groupId);
      assert(delRes.ok, 'deleteGroup succeeds while keeping tabs');
    }
  }

  // Close only incognito tabs; normal and stealth remain
  const closeInc = await service.closeAllTabs('incognito');
  assert(closeInc.ok && closeInc.value.closed === 1, 'closeAllTabs closes only selected kind');
  assert(
    service.getState().tabs.filter((t) => t.kind === 'stealth').length === 1 &&
      service.getState().tabs.filter((t) => t.kind === 'normal').length >= 2,
    'other kinds remain isolated'
  );

  // Viewport reporting round-trip
  service.setViewportRect({ x: 0, y: 64, width: 390, height: 600 });
  service.setViewportRect(null);
  assert(true, 'setViewportRect accepts rect and null cleanly');

  // Panel store transitions (sheets + find bar + switcher)
  openWebSheet('history');
  closeWebSheet();
  openFindBar();
  closeFindBar();
  openTabSwitcher();
  toggleTabSwitcher();
  closeTabSwitcher();
  setSwitcherKind('stealth');
  setSwitcherKind('normal');
  requestWebComposerFocus();
  showWebNotice('Stealth browsing is coming soon.');
  assert(true, 'webUiPanelStore sheet and find bar transitions execute cleanly');

  // Feedback local storage helper checks (key axon.webFeedback.v1, max 20)
  const backing = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => {
      backing.set(k, v);
    },
  };
  const emptySave = saveWebFeedbackEntry('   ', mockStorage);
  assert(!emptySave.saved, 'blank feedback is rejected');
  for (let i = 1; i <= 25; i++) {
    saveWebFeedbackEntry(`Feedback item ${i}`, mockStorage);
  }
  const stored = readWebFeedbackEntries(mockStorage);
  assert(
    stored.length === MAX_WEB_FEEDBACK_ENTRIES &&
      backing.has(WEB_FEEDBACK_STORAGE_KEY) &&
      stored[0].text === 'Feedback item 25',
    'feedback persists under axon.webFeedback.v1 capped at 20 newest-first entries'
  );

  console.log(`=== web ui tests passed: ${checks} checks ===`);
}

void run();
