/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Download,
  FolderPlus,
  Ghost,
  HelpCircle,
  History,
  Languages,
  Monitor,
  Plus,
  RotateCw,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Square,
  Trash2,
  VenetianMask,
} from 'lucide-react';
import { useWebActiveTab, useWebGroupsForKind } from '../../web/ui/useWebUi';
import { getWebUiService } from '../../web/ui/webUiService';
import { WEB_TAB_KINDS, type WebTabKind } from '../../web/ui/webUiTypes';
import {
  resolveMenuItemDimmed,
  dimCacheKey,
  isComingSoonResult,
  type WebMenuDimCache,
  type WebMenuEngineItem,
} from './webMenuDim';
import {
  closeTabSwitcher,
  openFindBar,
  openWebSheet,
  requestWebComposerFocus,
  showWebNotice,
} from './webUiPanelStore';

interface WebMenuProps {
  onClose: () => void;
  onOpenSettings?: () => void;
}

const KIND_LABELS: Record<WebTabKind, string> = {
  normal: 'Normal',
  incognito: 'Incognito',
  stealth: 'Stealth',
};

const SoonTag: React.FC = () => (
  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#7A7C82] shrink-0 leading-none">
    Soon
  </span>
);

export const WebMenu: React.FC<WebMenuProps> = ({ onClose, onOpenSettings }) => {
  const activeTab = useWebActiveTab();
  const activeKind = activeTab?.kind ?? null;
  const groupsOfKind = useWebGroupsForKind(activeTab?.kind ?? 'normal');

  // Cache last coming-soon answer per (kind, item) while this menu instance is open.
  const [dimCache, setDimCache] = useState<WebMenuDimCache>({});
  const [inlineSub, setInlineSub] = useState<'none' | 'new-group' | 'add-group' | 'move-to'>('none');
  const [groupName, setGroupName] = useState('');

  const recordDim = (kind: WebTabKind, item: WebMenuEngineItem, comingSoon: boolean) => {
    const key = dimCacheKey(kind, item);
    setDimCache((prev) => (prev[key] === comingSoon ? prev : { ...prev, [key]: comingSoon }));
  };

  const dimmed = (item: WebMenuEngineItem): boolean =>
    resolveMenuItemDimmed(dimCache, activeKind, item);

  const hasTab = Boolean(activeTab);

  // Group 1 handlers
  const handleBack = async () => {
    if (!activeTab || !activeTab.canGoBack) return;
    const res = await getWebUiService().goBack();
    recordDim(activeTab.kind, 'back', isComingSoonResult(res));
    if (!res.ok) showWebNotice(res.message);
  };

  const handleForward = async () => {
    if (!activeTab || !activeTab.canGoForward) return;
    const res = await getWebUiService().goForward();
    recordDim(activeTab.kind, 'forward', isComingSoonResult(res));
    if (!res.ok) showWebNotice(res.message);
  };

  const handleRefreshOrStop = async () => {
    if (!activeTab) return;
    const res = activeTab.loading
      ? await getWebUiService().stop()
      : await getWebUiService().reload();
    recordDim(activeTab.kind, 'refresh', isComingSoonResult(res));
    if (!res.ok) showWebNotice(res.message);
  };

  const handleBookmark = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().bookmarkPage();
    recordDim(activeTab.kind, 'bookmark', isComingSoonResult(res));
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice(res.value.bookmarked ? 'Page bookmarked' : 'Bookmark removed');
  };

  const handleDownloadPage = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().downloadPage();
    recordDim(activeTab.kind, 'download', isComingSoonResult(res));
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice('Page downloaded');
  };

  // Group 2 handlers
  const handleNewTab = async (kind: WebTabKind) => {
    onClose();
    const res = await getWebUiService().newTab(kind);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
    requestWebComposerFocus();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab) return;
    const fallback = `Group ${groupsOfKind.length + 1}`;
    const res = await getWebUiService().createGroup(groupName.trim() || fallback, [activeTab.id]);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice(`Added to ${groupName.trim() || fallback}`);
    onClose();
  };

  const handleAddToGroup = async (groupId: string, name: string) => {
    if (!activeTab) return;
    onClose();
    const res = await getWebUiService().addToGroup(activeTab.id, groupId);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice(`Added to ${name}`);
  };

  const handleMoveToKind = async (targetKind: WebTabKind) => {
    if (!activeTab) return;
    const res = await getWebUiService().moveTabToKind(activeTab.id, targetKind);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    onClose();
  };

  // Group 4 handlers
  const handleFindInPage = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().findInPage('', true);
    recordDim(activeTab.kind, 'find', isComingSoonResult(res));
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    onClose();
    openFindBar();
  };

  const handleReaderMode = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().toggleReaderMode();
    recordDim(activeTab.kind, 'reader', isComingSoonResult(res));
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice(res.value.enabled ? 'Reader mode enabled' : 'Reader mode disabled');
  };

  const handleDesktopSite = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().toggleDesktopSite();
    recordDim(activeTab.kind, 'desktop', isComingSoonResult(res));
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    showWebNotice(res.value.enabled ? 'Desktop site enabled' : 'Desktop site disabled');
  };

  const handleSiteControls = async () => {
    if (!activeTab) return;
    const res = await getWebUiService().getSiteInfo();
    recordDim(activeTab.kind, 'siteControls', isComingSoonResult(res));
    if (!res.ok && res.reason === 'coming-soon') {
      showWebNotice(res.message);
      return;
    }
    onClose();
    openWebSheet('site-controls');
  };

  const backDisabled = !activeTab || !activeTab.canGoBack;
  const forwardDisabled = !activeTab || !activeTab.canGoForward;
  const pageActionDisabled = !hasTab;

  return (
    <div
      role="menu"
      aria-label="AXON Web menu"
      className="absolute top-11 right-0 w-64 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain py-1.5 pb-2 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs select-none"
    >
      {/* GROUP 1: Compact Icon Row */}
      <div className="grid grid-cols-5 gap-1 px-2 py-1">
        <button
          type="button"
          role="menuitem"
          disabled={backDisabled}
          onClick={handleBack}
          aria-label="Back"
          title={dimmed('back') ? 'Back (coming soon)' : 'Back'}
          className={`h-10 rounded-xl flex items-center justify-center transition-colors ${
            backDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : dimmed('back')
                ? 'opacity-45 hover:bg-white/5 text-[#9A9B9F]'
                : 'hover:bg-white/5 text-[#D0D2D6] hover:text-white active:scale-95'
          }`}
        >
          <ArrowLeft size={16} />
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={forwardDisabled}
          onClick={handleForward}
          aria-label="Forward"
          title={dimmed('forward') ? 'Forward (coming soon)' : 'Forward'}
          className={`h-10 rounded-xl flex items-center justify-center transition-colors ${
            forwardDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : dimmed('forward')
                ? 'opacity-45 hover:bg-white/5 text-[#9A9B9F]'
                : 'hover:bg-white/5 text-[#D0D2D6] hover:text-white active:scale-95'
          }`}
        >
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleRefreshOrStop}
          aria-label={activeTab?.loading ? 'Stop' : 'Refresh'}
          title={
            activeTab?.loading
              ? 'Stop'
              : dimmed('refresh')
                ? 'Refresh (coming soon)'
                : 'Refresh'
          }
          className={`h-10 rounded-xl flex items-center justify-center transition-colors ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : dimmed('refresh')
                ? 'opacity-45 hover:bg-white/5 text-[#9A9B9F]'
                : 'hover:bg-white/5 text-[#D0D2D6] hover:text-white active:scale-95'
          }`}
        >
          {activeTab?.loading ? <Square size={14} /> : <RotateCw size={16} />}
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleBookmark}
          aria-label={activeTab?.bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          title={
            dimmed('bookmark')
              ? 'Bookmark this page (coming soon)'
              : activeTab?.bookmarked
                ? 'Remove bookmark'
                : 'Bookmark this page'
          }
          className={`h-10 rounded-xl flex items-center justify-center transition-colors ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : dimmed('bookmark')
                ? 'opacity-45 hover:bg-white/5 text-[#9A9B9F]'
                : 'hover:bg-white/5 text-[#D0D2D6] hover:text-white active:scale-95'
          }`}
        >
          {activeTab?.bookmarked ? (
            <BookmarkCheck size={16} className="text-[#E85A3C]" />
          ) : (
            <BookmarkPlus size={16} />
          )}
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleDownloadPage}
          aria-label="Download page"
          title={dimmed('download') ? 'Download page (coming soon)' : 'Download page'}
          className={`h-10 rounded-xl flex items-center justify-center transition-colors ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : dimmed('download')
                ? 'opacity-45 hover:bg-white/5 text-[#9A9B9F]'
                : 'hover:bg-white/5 text-[#D0D2D6] hover:text-white active:scale-95'
          }`}
        >
          <Download size={16} />
        </button>
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* GROUP 2: Tab & Group Actions */}
      <div>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleNewTab('normal')}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <Plus size={15} className="text-[#E85A3C] shrink-0" />
          <span>New tab</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => handleNewTab('incognito')}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <VenetianMask size={15} className="text-[#9A9B9F] shrink-0" />
          <span>New incognito tab</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => handleNewTab('stealth')}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <Ghost size={15} className="text-[#9A9B9F] shrink-0" />
          <span>New stealth tab</span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!hasTab}
          onClick={() => {
            if (!activeTab) return;
            if (inlineSub === 'new-group') {
              setInlineSub('none');
            } else {
              setGroupName(`Group ${groupsOfKind.length + 1}`);
              setInlineSub('new-group');
            }
          }}
          className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 ${
            !hasTab
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : 'hover:bg-white/5 text-[#E0E2E6]'
          }`}
        >
          <FolderPlus size={15} className="text-[#9A9B9F] shrink-0" />
          <span>Add tab to new group</span>
        </button>

        {inlineSub === 'new-group' && activeTab && (
          <form onSubmit={handleCreateGroup} className="px-3.5 py-2 bg-[#141517]/70 space-y-2">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={40}
              autoFocus
              aria-label="New group name"
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#121315] border border-white/10 text-xs text-white outline-none focus:border-[#E85A3C]"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setInlineSub('none')}
                className="px-2 py-1 rounded-lg text-[11px] text-[#9A9B9F] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-[#2C2D32] hover:bg-[#36373B] text-[11px] font-medium text-white"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {activeTab && groupsOfKind.length > 0 && (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                setInlineSub((prev) => (prev === 'add-group' ? 'none' : 'add-group'))
              }
              className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2 text-[#E0E2E6]"
            >
              <span className="flex items-center gap-2.5">
                <FolderPlus size={15} className="text-[#9A9B9F] shrink-0" />
                <span>Add to group</span>
              </span>
              <ChevronRight
                size={13}
                className={`text-[#7A7C82] transition-transform ${
                  inlineSub === 'add-group' ? 'rotate-90' : ''
                }`}
              />
            </button>

            {inlineSub === 'add-group' && (
              <div className="bg-[#141517]/70 py-1">
                {groupsOfKind.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleAddToGroup(g.id, g.name)}
                    className="w-full text-left pl-9 pr-3.5 py-1.5 hover:bg-white/5 flex items-center justify-between gap-2 text-[#D0D2D6]"
                  >
                    <span className="truncate">{g.name}</span>
                    {activeTab.groupId === g.id && (
                      <Check size={13} className="text-[#E85A3C] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <button
          type="button"
          role="menuitem"
          disabled={!hasTab}
          onClick={() => {
            if (!activeTab) return;
            setInlineSub((prev) => (prev === 'move-to' ? 'none' : 'move-to'));
          }}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            !hasTab
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : 'hover:bg-white/5 text-[#9A9B9F] opacity-75'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <ArrowRight size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Move tab to</span>
          </span>
          <span className="flex items-center gap-1.5">
            <SoonTag />
            <ChevronRight
              size={13}
              className={`text-[#7A7C82] transition-transform ${
                inlineSub === 'move-to' ? 'rotate-90' : ''
              }`}
            />
          </span>
        </button>

        {inlineSub === 'move-to' && activeTab && (
          <div className="bg-[#141517]/70 py-1">
            {WEB_TAB_KINDS.filter((k) => k !== activeTab.kind).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleMoveToKind(k)}
                className="w-full text-left pl-9 pr-3.5 py-1.5 hover:bg-white/5 flex items-center justify-between text-[#9A9B9F] opacity-75"
              >
                <span>{KIND_LABELS[k]}</span>
                <SoonTag />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* GROUP 3: Collections & Browsing Data */}
      <div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('recent-tabs');
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <Clock size={15} className="text-[#9A9B9F] shrink-0" />
          <span>Recent tabs</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('history');
          }}
          className={`w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2 text-[#E0E2E6] ${
            dimmed('history') ? 'opacity-45' : ''
          }`}
        >
          <span className="flex items-center gap-2.5">
            <History size={15} className="text-[#9A9B9F] shrink-0" />
            <span>History</span>
          </span>
          {dimmed('history') && <SoonTag />}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('bookmarks');
          }}
          className={`w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2 text-[#E0E2E6] ${
            dimmed('bookmarks') ? 'opacity-45' : ''
          }`}
        >
          <span className="flex items-center gap-2.5">
            <BookMarked size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Bookmarks</span>
          </span>
          {dimmed('bookmarks') && <SoonTag />}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('downloads');
          }}
          className={`w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2 text-[#E0E2E6] ${
            dimmed('downloads') ? 'opacity-45' : ''
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Download size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Downloads</span>
          </span>
          {dimmed('downloads') && <SoonTag />}
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('clear-data');
          }}
          className={`w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2 text-[#E0E2E6] ${
            dimmed('clearData') ? 'opacity-45' : ''
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Trash2 size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Delete browsing data</span>
          </span>
          {dimmed('clearData') && <SoonTag />}
        </button>
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* GROUP 4: Page Tools */}
      <div>
        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleFindInPage}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('find') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Search size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Find in page</span>
          </span>
          {hasTab && dimmed('find') && <SoonTag />}
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={() => {
            if (!hasTab) return;
            onClose();
            openWebSheet('translate');
          }}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('translate') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Languages size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Translate</span>
          </span>
          {hasTab && dimmed('translate') && <SoonTag />}
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleReaderMode}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('reader') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Reader mode</span>
          </span>
          <span className="flex items-center gap-1.5">
            {hasTab && dimmed('reader') && <SoonTag />}
            {activeTab?.readerMode && <Check size={14} className="text-[#E85A3C] shrink-0" />}
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleDesktopSite}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('desktop') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Monitor size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Desktop site</span>
          </span>
          <span className="flex items-center gap-1.5">
            {hasTab && dimmed('desktop') && <SoonTag />}
            {activeTab?.desktopSite && <Check size={14} className="text-[#E85A3C] shrink-0" />}
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={handleSiteControls}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('siteControls') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <SlidersHorizontal size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Site controls</span>
          </span>
          {hasTab && dimmed('siteControls') && <SoonTag />}
        </button>
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* GROUP 5: Share */}
      <div>
        <button
          type="button"
          role="menuitem"
          disabled={pageActionDisabled}
          onClick={() => {
            if (!hasTab) return;
            onClose();
            openWebSheet('share');
          }}
          className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 ${
            pageActionDisabled
              ? 'opacity-40 cursor-not-allowed text-[#9A9B9F]'
              : `hover:bg-white/5 text-[#E0E2E6] ${dimmed('share') ? 'opacity-45' : ''}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Share2 size={15} className="text-[#9A9B9F] shrink-0" />
            <span>Share</span>
          </span>
          <span className="flex items-center gap-1.5">
            {hasTab && dimmed('share') && <SoonTag />}
            <ChevronRight size={13} className="text-[#7A7C82]" />
          </span>
        </button>
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* GROUP 6: Settings & Help */}
      <div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenSettings?.();
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <Settings size={15} className="text-[#9A9B9F] shrink-0" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            openWebSheet('help');
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
        >
          <HelpCircle size={15} className="text-[#9A9B9F] shrink-0" />
          <span>Help &amp; feedback</span>
        </button>
      </div>
    </div>
  );
};
