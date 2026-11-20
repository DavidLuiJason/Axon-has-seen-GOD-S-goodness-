/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  getActionDefinition,
  getAllowedActionsForPage,
  QUICK_ACTION_PAGES,
} from './actions';
import { MAX_MENU_ACTIONS } from './defaults';
import { QuickActionIcon } from './QuickActionIcon';
import {
  closeQuickActionSettings,
  moveQuickActionMenuItem,
  resetQuickActionPage,
  setQuickActionGesture,
  toggleQuickActionMenuItem,
  useQuickActionConfig,
  useQuickActionSettingsOpen,
} from './store';
import type { GestureSlot, QuickActionId, QuickActionPage } from './types';

const GESTURE_SLOTS: readonly { id: GestureSlot; label: string }[] = [
  { id: 'tap', label: 'Tap' },
  { id: 'doubleTap', label: 'Double tap' },
  { id: 'tripleTap', label: 'Triple tap' },
  { id: 'menu', label: 'Long-press menu' },
] as const;

export const QuickActionSettingsSheet: React.FC = () => {
  const { isOpen, initialPage } = useQuickActionSettingsOpen();
  const config = useQuickActionConfig();

  const [activePage, setActivePage] = useState<QuickActionPage>('chat');
  const [selectedSlot, setSelectedSlot] = useState<GestureSlot>('tap');
  const [savedVisible, setSavedVisible] = useState(false);

  const pagerRef = useRef<HTMLDivElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreScrollUntilRef = useRef(0);

  const flashSaved = () => {
    setSavedVisible(true);
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => {
      savedTimerRef.current = null;
      setSavedVisible(false);
    }, 1500);
  };

  useEffect(() => {
    if (!isOpen) return;
    const startPage = initialPage ?? 'chat';
    setActivePage(startPage);
    setSelectedSlot('tap');
    setSavedVisible(false);

    // Position the horizontal snap pager at startPage immediately on open
    requestAnimationFrame(() => {
      const el = pagerRef.current;
      if (!el) return;
      const idx = QUICK_ACTION_PAGES.findIndex((p) => p.id === startPage);
      if (idx >= 0) {
        ignoreScrollUntilRef.current = Date.now() + 250;
        el.scrollTo({ left: idx * el.clientWidth, behavior: 'auto' });
      }
    });
  }, [isOpen, initialPage]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickActionSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const pageConfig = config[activePage];

  const selectPage = (page: QuickActionPage) => {
    setActivePage(page);
    const el = pagerRef.current;
    if (!el) return;
    const idx = QUICK_ACTION_PAGES.findIndex((p) => p.id === page);
    if (idx >= 0) {
      ignoreScrollUntilRef.current = Date.now() + 450;
      el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    }
  };

  const handlePagerScroll = () => {
    if (Date.now() < ignoreScrollUntilRef.current) return;
    const el = pagerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const pageDef = QUICK_ACTION_PAGES[idx];
    if (pageDef && pageDef.id !== activePage) {
      setActivePage(pageDef.id);
    }
  };

  const handlePickSingleAction = (actionId: QuickActionId) => {
    if (selectedSlot === 'menu') return;
    setQuickActionGesture(activePage, selectedSlot, actionId);
    flashSaved();
  };

  const handleToggleMenuItem = (actionId: QuickActionId) => {
    const already = pageConfig.menu.includes(actionId);
    if (!already && pageConfig.menu.length >= MAX_MENU_ACTIONS) return;
    toggleQuickActionMenuItem(activePage, actionId);
    flashSaved();
  };

  const handleMoveMenuItem = (actionId: QuickActionId, direction: -1 | 1) => {
    moveQuickActionMenuItem(activePage, actionId, direction);
    flashSaved();
  };

  const handleResetPage = () => {
    resetQuickActionPage(activePage);
    flashSaved();
  };

  const allowedSingleActions = getAllowedActionsForPage(activePage, true);
  const allowedMenuActions = getAllowedActionsForPage(activePage, false);
  const selectedMenuIds = pageConfig.menu;
  const unselectedMenuActions = allowedMenuActions.filter(
    (def) => !selectedMenuIds.includes(def.id)
  );
  const menuAtCap = selectedMenuIds.length >= MAX_MENU_ACTIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        onClick={closeQuickActionSettings}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Full-height sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick action button settings"
        className="relative z-10 w-full max-w-lg h-[92dvh] sm:h-[85vh] bg-[#18191C] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl text-[#ECECEC] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-lg font-semibold tracking-wide text-white">
              Quick action button
            </h2>
            {savedVisible && (
              <span
                role="status"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#232428] border border-white/10 text-[11px] text-[#D0D2D7]"
              >
                <Check size={11} className="text-[#E85A3C]" />
                <span>Saved</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeQuickActionSettings}
            aria-label="Close quick action settings"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A2A7] hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <X size={15} />
          </button>
        </div>

        {/* TOP PART: Gesture segmented row + allowed actions list */}
        <div className="px-5 pt-3.5 pb-2 shrink-0">
          <div
            role="tablist"
            aria-label="Gesture slot"
            className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#141517] border border-white/5"
          >
            {GESTURE_SLOTS.map((slot) => {
              const active = selectedSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedSlot(slot.id)}
                  className={`px-2 py-2 rounded-xl text-[11px] font-medium leading-tight text-center transition-colors ${
                    active
                      ? 'bg-[#26272B] text-white shadow-sm'
                      : 'text-[#9A9B9F] hover:text-white'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action picker list (scrollable middle) */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1.5">
          {selectedSlot !== 'menu' ? (
            allowedSingleActions.map((action) => {
              const isSelected = pageConfig[selectedSlot] === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handlePickSingleAction(action.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 active:scale-[0.99] ${
                    isSelected
                      ? 'bg-[#232428] border-white/15 text-white'
                      : 'bg-[#141517] border-white/5 text-[#D0D2D6] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <QuickActionIcon
                      id={action.id}
                      size={15}
                      className={isSelected ? 'text-[#E85A3C] shrink-0' : 'text-[#9A9B9F] shrink-0'}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{action.label}</div>
                      <div className="text-[11px] text-[#7A7C82] truncate">
                        {action.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={15} className="text-[#E85A3C] shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#8E9094]">
                <span>Selected ({selectedMenuIds.length}/{MAX_MENU_ACTIONS})</span>
                <span>Customize... stays last</span>
              </div>

              {selectedMenuIds.length > 0 && (
                <div className="space-y-1.5">
                  {selectedMenuIds.map((id, idx) => {
                    const def = getActionDefinition(id);
                    if (!def) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#232428] border border-white/15 text-white"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMenuItem(id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span className="w-4 h-4 rounded bg-[#E85A3C]/20 border border-[#E85A3C]/60 flex items-center justify-center shrink-0">
                            <Check size={11} className="text-[#E85A3C]" />
                          </span>
                          <QuickActionIcon id={id} size={14} className="text-[#E85A3C] shrink-0" />
                          <span className="text-xs font-medium truncate">{def.label}</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveMenuItem(id, -1)}
                            disabled={idx === 0}
                            aria-label={`Move ${def.label} up`}
                            className="w-7 h-7 rounded-lg bg-[#18191C] hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-[#D0D2D6] transition-colors"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMenuItem(id, 1)}
                            disabled={idx === selectedMenuIds.length - 1}
                            aria-label={`Move ${def.label} down`}
                            className="w-7 h-7 rounded-lg bg-[#18191C] hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-[#D0D2D6] transition-colors"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {unselectedMenuActions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="px-1 text-[11px] text-[#7A7C82]">Add to menu</div>
                  {unselectedMenuActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={menuAtCap}
                      onClick={() => handleToggleMenuItem(action.id)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-[#141517] border border-white/5 hover:bg-white/5 disabled:opacity-40 text-[#D0D2D6] flex items-center gap-2.5 transition-colors"
                    >
                      <span className="w-4 h-4 rounded border border-white/20 shrink-0" />
                      <QuickActionIcon id={action.id} size={14} className="text-[#9A9B9F] shrink-0" />
                      <span className="text-xs truncate">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM PART: Swipeable page pager (scroll-snap) + dots + Reset */}
        <div className="border-t border-white/5 bg-[#141517] px-5 pt-3 pb-4 shrink-0 space-y-2.5">
          {/* Swipeable scroll-snap track */}
          <div
            ref={pagerRef}
            onScroll={handlePagerScroll}
            aria-label="Page switcher"
            className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl bg-[#1C1D21] border border-white/5"
          >
            {QUICK_ACTION_PAGES.map((page) => {
              const cfg = config[page.id];
              const tapLabel = getActionDefinition(cfg.tap)?.label ?? 'None';
              return (
                <div
                  key={page.id}
                  className="w-full shrink-0 snap-center px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">{page.label}</div>
                    <div className="text-[11px] text-[#7A7C82] truncate">
                      {page.description} &middot; Tap: {tapLabel}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#7A7C82] shrink-0">Swipe</span>
                </div>
              );
            })}
          </div>

          {/* Page label selector + dots + Reset this page */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {QUICK_ACTION_PAGES.map((page) => {
                const isActive = activePage === page.id;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => selectPage(page.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#26272B] text-white'
                        : 'text-[#8E9094] hover:text-white'
                    }`}
                  >
                    {page.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5" aria-hidden="true">
              {QUICK_ACTION_PAGES.map((page) => (
                <span
                  key={page.id}
                  className={`h-1.5 rounded-full transition-all ${
                    activePage === page.id ? 'w-3 bg-[#E85A3C]' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleResetPage}
              className="text-xs text-[#9A9B9F] hover:text-white transition-colors"
            >
              Reset this page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
