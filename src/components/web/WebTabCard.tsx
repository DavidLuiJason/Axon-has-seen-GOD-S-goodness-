/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Copy,
  FolderMinus,
  FolderPlus,
  Pin,
  PinOff,
  X,
} from 'lucide-react';
import { getWebUiService } from '../../web/ui/webUiService';
import { useWebTab } from '../../web/ui/useWebUi';
import { WEB_TAB_KINDS, type WebGroup, type WebTabKind } from '../../web/ui/webUiTypes';
import { closeTabSwitcher, showWebNotice } from './webUiPanelStore';

interface WebTabCardProps {
  tabId: string;
  isActive: boolean;
  isMenuOpen: boolean;
  alignRight: boolean;
  useContentVisibility: boolean;
  groups: readonly WebGroup[];
  onOpenMenu: (tabId: string) => void;
  onCloseMenu: () => void;
}

const LONG_PRESS_MS = 450;

const KIND_LABELS: Record<WebTabKind, string> = {
  normal: 'Normal',
  incognito: 'Incognito',
  stealth: 'Stealth',
};

function hostOf(url: string): string {
  if (!url) return 'New tab';
  try {
    const u = new URL(url);
    return u.hostname.startsWith('www.') ? u.hostname.slice(4) : u.hostname;
  } catch {
    return url;
  }
}

function initialOf(host: string, title: string): string {
  const source = host && host !== 'New tab' ? host : title || 'A';
  return source.charAt(0).toUpperCase();
}

export const WebTabCard: React.FC<WebTabCardProps> = React.memo(function WebTabCard({
  tabId,
  isActive,
  isMenuOpen,
  alignRight,
  useContentVisibility,
  groups,
  onOpenMenu,
  onCloseMenu,
}) {
  const tab = useWebTab(tabId);
  const [subMenu, setSubMenu] = useState<'none' | 'new-group' | 'add-group' | 'move-to'>('none');
  const [groupName, setGroupName] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const suppressNextClickRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      setSubMenu('none');
      return;
    }
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMenu();
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isMenuOpen, onCloseMenu]);

  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  if (!tab) return null;

  const host = hostOf(tab.url);
  const letter = initialOf(host, tab.title);

  const handleSelectTab = async () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isMenuOpen) return;
    const res = await getWebUiService().switchTab(tab.id);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
  };

  const handleCloseTab = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await getWebUiService().closeTab(tab.id);
    if (!res.ok) showWebNotice(res.message);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-tab-close]')) return;
    suppressNextClickRef.current = false;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressNextClickRef.current = true;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(15);
        }
      } catch {
        // Vibration is best-effort.
      }
      onOpenMenu(tab.id);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current === null) return;
    const dx = e.clientX - startPointRef.current.x;
    const dy = e.clientY - startPointRef.current.y;
    if (Math.hypot(dx, dy) > 10) {
      clearLongPress();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    clearLongPress();
    onOpenMenu(tab.id);
  };

  const handlePinToggle = async () => {
    onCloseMenu();
    const res = await getWebUiService().pinTab(tab.id, !tab.pinned);
    if (!res.ok) showWebNotice(res.message);
  };

  const handleDuplicate = async () => {
    onCloseMenu();
    const res = await getWebUiService().duplicateTab(tab.id);
    if (!res.ok) showWebNotice(res.message);
  };

  const handleOpenNewGroupInput = () => {
    setGroupName(`Group ${groups.length + 1}`);
    setSubMenu('new-group');
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupName.trim() || `Group ${groups.length + 1}`;
    const res = await getWebUiService().createGroup(trimmed, [tab.id]);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    onCloseMenu();
  };

  const handleAddToGroup = async (groupId: string) => {
    onCloseMenu();
    const res = await getWebUiService().addToGroup(tab.id, groupId);
    if (!res.ok) showWebNotice(res.message);
  };

  const handleRemoveFromGroup = async () => {
    onCloseMenu();
    const res = await getWebUiService().removeFromGroup(tab.id);
    if (!res.ok) showWebNotice(res.message);
  };

  const handleMoveToKind = async (targetKind: WebTabKind) => {
    onCloseMenu();
    const res = await getWebUiService().moveTabToKind(tab.id, targetKind);
    if (!res.ok) showWebNotice(res.message);
  };

  const otherGroups = groups.filter((g) => g.id !== tab.groupId);

  return (
    <div
      className={`relative ${
        useContentVisibility ? '[content-visibility:auto] [contain-intrinsic-size:auto_104px]' : ''
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleSelectTab}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void handleSelectTab();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={handleContextMenu}
        aria-label={`${tab.title || 'New tab'} (${host})`}
        className={`w-full text-left rounded-2xl bg-[#1E1F22] hover:bg-[#232428] p-3 transition-colors active:scale-[0.98] cursor-pointer select-none border ${
          isActive
            ? 'ring-1 ring-[#E85A3C] border-[#E85A3C]/50'
            : 'border-white/5 hover:border-white/10'
        }`}
      >
        {/* Top row: Favicon initial, Pin indicator, Close button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-6 h-6 rounded-full bg-[#25262A] border border-white/10 text-[11px] font-semibold text-[#E0E2E6] flex items-center justify-center shrink-0">
              {letter}
            </span>
            {tab.pinned && (
              <Pin size={12} className="text-[#E85A3C] shrink-0" aria-label="Pinned tab" />
            )}
          </div>

          <button
            type="button"
            data-tab-close="true"
            onClick={handleCloseTab}
            aria-label={`Close ${tab.title || 'tab'}`}
            className="w-6 h-6 rounded-full hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center shrink-0 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Title (2 lines) */}
        <div className="text-xs font-medium text-[#ECECEC] leading-snug line-clamp-2 min-h-[2.125rem]">
          {tab.title || 'New tab'}
        </div>

        {/* Host */}
        <div className="mt-1.5 text-[11px] text-[#7A7C82] truncate">{host}</div>
      </div>

      {/* Long-press Popover Menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute top-full mt-1.5 ${
            alignRight ? 'right-0' : 'left-0'
          } w-52 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs`}
        >
          {subMenu === 'new-group' ? (
            <form onSubmit={handleCreateGroup} className="px-3 py-2 space-y-2">
              <div className="text-[11px] text-[#9A9B9F] font-medium">New group name</div>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={40}
                autoFocus
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#141517] border border-white/10 text-xs text-white outline-none focus:border-[#E85A3C]"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubMenu('none')}
                  className="px-2.5 py-1 rounded-lg text-[11px] text-[#9A9B9F] hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-[#2C2D32] hover:bg-[#36373B] text-[11px] text-white font-medium"
                >
                  Create
                </button>
              </div>
            </form>
          ) : subMenu === 'add-group' ? (
            <div>
              <button
                type="button"
                onClick={() => setSubMenu('none')}
                className="w-full text-left px-3.5 py-1.5 text-[11px] text-[#9A9B9F] hover:text-white"
              >
                &larr; Add to group
              </button>
              <div className="my-1 border-t border-white/5" />
              {otherGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleAddToGroup(g.id)}
                  className="w-full text-left px-3.5 py-2 hover:bg-white/5 text-[#E0E2E6] truncate"
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : subMenu === 'move-to' ? (
            <div>
              <button
                type="button"
                onClick={() => setSubMenu('none')}
                className="w-full text-left px-3.5 py-1.5 text-[11px] text-[#9A9B9F] hover:text-white"
              >
                &larr; Move to
              </button>
              <div className="my-1 border-t border-white/5" />
              {WEB_TAB_KINDS.filter((k) => k !== tab.kind).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleMoveToKind(k)}
                  className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between text-[#9A9B9F] opacity-75"
                >
                  <span>{KIND_LABELS[k]}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#7A7C82]">
                    Soon
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={handlePinToggle}
                className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                {tab.pinned ? (
                  <PinOff size={14} className="text-[#9A9B9F]" />
                ) : (
                  <Pin size={14} className="text-[#9A9B9F]" />
                )}
                <span>{tab.pinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleDuplicate}
                className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                <Copy size={14} className="text-[#9A9B9F]" />
                <span>Duplicate</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenNewGroupInput}
                className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                <FolderPlus size={14} className="text-[#9A9B9F]" />
                <span>Add to new group</span>
              </button>

              {otherGroups.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setSubMenu('add-group')}
                  className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between text-[#E0E2E6]"
                >
                  <span className="flex items-center gap-2.5">
                    <FolderPlus size={14} className="text-[#9A9B9F]" />
                    <span>Add to group</span>
                  </span>
                  <ChevronRight size={13} className="text-[#7A7C82]" />
                </button>
              )}

              {tab.groupId !== null && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleRemoveFromGroup}
                  className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                >
                  <FolderMinus size={14} className="text-[#9A9B9F]" />
                  <span>Remove from group</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => setSubMenu('move-to')}
                className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between text-[#9A9B9F] opacity-75"
              >
                <span>Move to</span>
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#7A7C82]">
                    Soon
                  </span>
                  <ChevronRight size={13} className="text-[#7A7C82]" />
                </span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <button
                type="button"
                role="menuitem"
                onClick={handleCloseTab}
                className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E85A3C]"
              >
                <X size={14} />
                <span>Close tab</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
