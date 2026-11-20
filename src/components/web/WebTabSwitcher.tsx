/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useWebActiveTab,
  useWebGroupsForKind,
  useWebKindCounts,
  useWebTabsForKind,
} from '../../web/ui/useWebUi';
import { getWebKindPresentation } from '../../web/ui/webKindStyle';
import { getWebUiService } from '../../web/ui/webUiService';
import {
  WEB_TAB_KINDS,
  type WebGroup,
  type WebTab,
} from '../../web/ui/webUiTypes';
import { WebKindIcon } from './WebKindIcon';
import { WebTabCard } from './WebTabCard';
import {
  closeTabSwitcher,
  requestWebComposerFocus,
  setSwitcherKind,
  showWebNotice,
  useSwitcherKind,
} from './webUiPanelStore';

function sortPinnedFirst(tabs: readonly WebTab[]): WebTab[] {
  if (tabs.length <= 1) return [...tabs];
  const pinned: WebTab[] = [];
  const regular: WebTab[] = [];
  for (const tab of tabs) {
    if (tab.pinned) pinned.push(tab);
    else regular.push(tab);
  }
  return [...pinned, ...regular];
}

export const WebTabSwitcher: React.FC = () => {
  const switcherKind = useSwitcherKind();
  const activeTab = useWebActiveTab();
  const counts = useWebKindCounts();
  const tabsOfKind = useWebTabsForKind(switcherKind);
  const groupsOfKind = useWebGroupsForKind(switcherKind);

  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Readonly<Record<string, boolean>>>({});
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const headerMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const presentation = getWebKindPresentation(switcherKind);
  const useContentVisibility = tabsOfKind.length > 30;

  // Close transient menus when switching kinds
  useEffect(() => {
    setOpenCardMenuId(null);
    setIsHeaderMenuOpen(false);
    setOpenGroupMenuId(null);
    setRenamingGroupId(null);
  }, [switcherKind]);

  // Outside click / Escape for header overflow menu
  useEffect(() => {
    if (!isHeaderMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isHeaderMenuOpen]);

  // Outside click / Escape for group menu
  useEffect(() => {
    if (!openGroupMenuId) return;
    const handleOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setOpenGroupMenuId(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroupMenuId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openGroupMenuId]);

  const { groupedSections, ungroupedTabs } = useMemo(() => {
    const validGroupIds = new Set(groupsOfKind.map((g) => g.id));
    const byGroup = new Map<string, WebTab[]>();
    for (const group of groupsOfKind) {
      byGroup.set(group.id, []);
    }
    const ungrouped: WebTab[] = [];
    for (const tab of tabsOfKind) {
      if (tab.groupId && validGroupIds.has(tab.groupId)) {
        byGroup.get(tab.groupId)!.push(tab);
      } else {
        ungrouped.push(tab);
      }
    }
    const sections: Array<{ group: WebGroup; tabs: WebTab[] }> = groupsOfKind.map(
      (group) => ({
        group,
        tabs: sortPinnedFirst(byGroup.get(group.id) ?? []),
      })
    );
    return {
      groupedSections: sections,
      ungroupedTabs: sortPinnedFirst(ungrouped),
    };
  }, [groupsOfKind, tabsOfKind]);

  const handleOpenCardMenu = useCallback((tabId: string) => {
    setIsHeaderMenuOpen(false);
    setOpenGroupMenuId(null);
    setOpenCardMenuId(tabId);
  }, []);

  const handleCloseCardMenu = useCallback(() => {
    setOpenCardMenuId(null);
  }, []);

  const handleNewTabInKind = async () => {
    const res = await getWebUiService().newTab(switcherKind);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
    requestWebComposerFocus();
  };

  const handleCloseAllForKind = async () => {
    setIsHeaderMenuOpen(false);
    if (tabsOfKind.length === 0) return;
    const res = await getWebUiService().closeAllTabs(switcherKind);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    const label = presentation.label.toLowerCase();
    showWebNotice(
      res.value.closed === 1
        ? `Closed 1 ${label} tab`
        : `Closed ${res.value.closed} ${label} tabs`
    );
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const startRenameGroup = (group: WebGroup) => {
    setOpenGroupMenuId(null);
    setRenamingGroupId(group.id);
    setRenameValue(group.name);
  };

  const submitRenameGroup = async (e: React.FormEvent, groupId: string) => {
    e.preventDefault();
    const res = await getWebUiService().renameGroup(groupId, renameValue);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    setRenamingGroupId(null);
  };

  const handleDeleteGroup = async (groupId: string) => {
    setOpenGroupMenuId(null);
    const res = await getWebUiService().deleteGroup(groupId);
    if (!res.ok) showWebNotice(res.message);
  };

  return (
    <div
      role="region"
      aria-label="Tab switcher"
      className="flex-1 w-full max-w-[720px] mx-auto flex flex-col min-h-0 bg-[#121315] select-none"
    >
      {/* Top Bar: Segmented Kind Switch + Overflow Menu */}
      <div className="px-4 pt-2 pb-3 flex items-center gap-2 shrink-0">
        <div
          role="tablist"
          aria-label="Tab kinds"
          className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#18191C] border border-white/5"
        >
          {WEB_TAB_KINDS.map((kind) => {
            const p = getWebKindPresentation(kind);
            const selected = switcherKind === kind;
            const count = counts[kind];
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSwitcherKind(kind)}
                className={`relative px-2 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-[0.98] ${
                  selected
                    ? kind === 'incognito'
                      ? 'bg-[#0F1012] text-white border border-white/15 shadow-sm'
                      : kind === 'stealth'
                        ? 'bg-[#232428] text-white border border-[#E85A3C]/30 shadow-sm'
                        : 'bg-[#2A2B2E] text-white border border-white/10 shadow-sm'
                    : 'text-[#8E9094] hover:text-[#E0E2E6] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium leading-none">
                  <WebKindIcon
                    kind={kind}
                    size={13}
                    className={
                      selected
                        ? kind === 'stealth'
                          ? 'text-[#E85A3C]'
                          : 'text-[#ECECEC]'
                        : p.iconClass
                    }
                  />
                  <span>{p.label}</span>
                  <span className="text-[11px] tabular-nums text-[#9A9B9F]">
                    {count}
                  </span>
                </span>
                {p.isComingSoon && (
                  <span className="text-[9px] leading-tight text-[#7A7C82]">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Section overflow menu */}
        <div className="relative shrink-0" ref={headerMenuRef}>
          <button
            type="button"
            onClick={() => {
              setOpenCardMenuId(null);
              setOpenGroupMenuId(null);
              setIsHeaderMenuOpen((prev) => !prev);
            }}
            aria-expanded={isHeaderMenuOpen}
            aria-label={`${presentation.label} tab options`}
            className="w-9 h-9 rounded-full bg-[#232428] hover:bg-[#2C2D32] border border-white/5 text-[#D0D2D6] hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <MoreVertical size={17} />
          </button>

          {isHeaderMenuOpen && (
            <div
              role="menu"
              className="absolute top-10 right-0 w-52 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs"
            >
              <button
                type="button"
                role="menuitem"
                disabled={tabsOfKind.length === 0}
                onClick={handleCloseAllForKind}
                className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 ${
                  tabsOfKind.length === 0
                    ? 'text-[#7A7C82] cursor-not-allowed'
                    : 'text-[#E85A3C] hover:bg-white/5'
                }`}
              >
                <Trash2 size={14} />
                <span>Close all {presentation.label.toLowerCase()} tabs</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Tabs & Groups Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {tabsOfKind.length === 0 ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 ${
                switcherKind === 'incognito'
                  ? 'bg-[#0F1012] border-white/15'
                  : switcherKind === 'stealth'
                    ? 'bg-[#1E1F22] border-[#E85A3C]/25'
                    : 'bg-[#1E1F22] border-white/10'
              }`}
            >
              <WebKindIcon
                kind={switcherKind}
                size={22}
                className={
                  switcherKind === 'stealth' ? 'text-[#E85A3C]' : 'text-[#D0D2D6]'
                }
              />
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-base font-medium text-[#ECECEC]">
                No {presentation.label.toLowerCase()} tabs
              </h2>
              {presentation.isComingSoon && (
                <span className="px-2 py-0.5 rounded-md bg-[#232428] border border-white/10 text-[10px] font-medium text-[#9A9B9F]">
                  Coming soon
                </span>
              )}
            </div>

            <p className="text-xs text-[#8E9094] max-w-xs leading-relaxed mb-4">
              {presentation.emptyDescription}
            </p>

            <button
              type="button"
              onClick={handleNewTabInKind}
              className="px-4 py-2 rounded-xl bg-[#232428] hover:bg-[#2C2D32] border border-white/10 text-xs font-medium text-[#ECECEC] flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <Plus size={14} className="text-[#E85A3C]" />
              <span>New {presentation.label.toLowerCase()} tab</span>
            </button>
          </div>
        ) : (
          <>
            {/* Tab Groups */}
            {groupedSections.map(({ group, tabs }) => {
              const isCollapsed = Boolean(collapsedGroupIds[group.id]);
              const isRenaming = renamingGroupId === group.id;
              const isGroupMenuOpen = openGroupMenuId === group.id;

              return (
                <section
                  key={group.id}
                  aria-label={`Tab group ${group.name}`}
                  className="rounded-2xl bg-[#18191C] border border-white/10 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => submitRenameGroup(e, group.id)}
                        className="flex-1 flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          maxLength={40}
                          autoFocus
                          aria-label="Group name"
                          className="flex-1 min-w-0 px-2.5 py-1 rounded-xl bg-[#121315] border border-white/15 text-xs text-white outline-none focus:border-[#E85A3C]"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded-lg bg-[#2C2D32] hover:bg-[#36373B] text-[11px] font-medium text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingGroupId(null)}
                          className="px-2 py-1 rounded-lg text-[11px] text-[#9A9B9F] hover:text-white"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapsed(group.id)}
                        aria-expanded={!isCollapsed}
                        className="flex-1 min-w-0 flex items-center gap-1.5 text-left py-0.5 text-xs font-medium text-[#E0E2E6] hover:text-white"
                      >
                        {isCollapsed ? (
                          <ChevronRight size={14} className="text-[#9A9B9F] shrink-0" />
                        ) : (
                          <ChevronDown size={14} className="text-[#9A9B9F] shrink-0" />
                        )}
                        <span className="truncate">{group.name}</span>
                        <span className="text-[11px] text-[#7A7C82] tabular-nums shrink-0">
                          ({tabs.length})
                        </span>
                      </button>
                    )}

                    {!isRenaming && (
                      <div
                        className="relative shrink-0"
                        ref={isGroupMenuOpen ? groupMenuRef : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenCardMenuId(null);
                            setIsHeaderMenuOpen(false);
                            setOpenGroupMenuId((prev) =>
                              prev === group.id ? null : group.id
                            );
                          }}
                          aria-expanded={isGroupMenuOpen}
                          aria-label={`Options for group ${group.name}`}
                          className="w-7 h-7 rounded-full hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {isGroupMenuOpen && (
                          <div
                            role="menu"
                            className="absolute top-8 right-0 w-44 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => startRenameGroup(group)}
                              className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                            >
                              <Pencil size={13} className="text-[#9A9B9F]" />
                              <span>Rename group</span>
                            </button>
                            <div className="my-1 border-t border-white/5" />
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleDeleteGroup(group.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E85A3C]"
                            >
                              <Trash2 size={13} />
                              <span>Delete group</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    tabs.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        {tabs.map((tab, idx) => (
                          <WebTabCard
                            key={tab.id}
                            tabId={tab.id}
                            isActive={tab.id === activeTab?.id}
                            isMenuOpen={openCardMenuId === tab.id}
                            alignRight={idx % 2 === 1}
                            useContentVisibility={useContentVisibility}
                            groups={groupsOfKind}
                            onOpenMenu={handleOpenCardMenu}
                            onCloseMenu={handleCloseCardMenu}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-[11px] text-[#7A7C82]">
                        No tabs in this group yet
                      </div>
                    )
                  )}
                </section>
              );
            })}

            {/* Ungrouped Tabs */}
            {ungroupedTabs.length > 0 && (
              <div>
                {groupedSections.length > 0 && (
                  <div className="px-1 pb-2 text-[11px] font-medium text-[#7A7C82]">
                    Other tabs
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {ungroupedTabs.map((tab, idx) => (
                    <WebTabCard
                      key={tab.id}
                      tabId={tab.id}
                      isActive={tab.id === activeTab?.id}
                      isMenuOpen={openCardMenuId === tab.id}
                      alignRight={idx % 2 === 1}
                      useContentVisibility={useContentVisibility}
                      groups={groupsOfKind}
                      onOpenMenu={handleOpenCardMenu}
                      onCloseMenu={handleCloseCardMenu}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
