/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LONG_PRESS_MS, TAP_DISAMBIGUATION_MS } from './defaults';
import type { QuickActionId, QuickActionPageConfig } from './types';

function safeVibrate(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Vibration is best-effort on supported devices.
  }
}

function findHitMenuId(x: number, y: number): string | null {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
    return null;
  }
  const el = document.elementFromPoint(x, y);
  const target = el?.closest?.('[data-quick-action-id]') as HTMLElement | null;
  return target?.getAttribute('data-quick-action-id') ?? null;
}

export interface UseQuickActionGestureOptions {
  config: QuickActionPageConfig;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onRunAction: (actionId: QuickActionId) => void;
  onCustomize: () => void;
}

export function useQuickActionGesture({
  config,
  buttonRef,
  menuRef,
  onRunAction,
  onCustomize,
}: UseQuickActionGestureOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;

  const highlightedRef = useRef<string | null>(null);
  highlightedRef.current = highlightedId;

  const configRef = useRef(config);
  configRef.current = config;

  const onRunActionRef = useRef(onRunAction);
  onRunActionRef.current = onRunAction;

  const onCustomizeRef = useRef(onCustomize);
  onCustomizeRef.current = onCustomize;

  const activePointerIdRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const openPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const latestPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const movedBeforeLongPressRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const didSlideDuringLongPressRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearTapTimer = useCallback(() => {
    if (tapTimerRef.current !== null) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  }, []);

  const cancelRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setHighlightedId(null);
    highlightedRef.current = null;
  }, []);

  const triggerMenuItem = useCallback(
    (itemId: string) => {
      closeMenu();
      if (itemId === 'customize') {
        onCustomizeRef.current();
      } else {
        onRunActionRef.current(itemId as QuickActionId);
      }
    },
    [closeMenu]
  );

  // Close sticky menu on outside tap or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, buttonRef, menuRef, closeMenu]);

  // Cleanup all timers and rAF on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
      clearTapTimer();
      cancelRaf();
    };
  }, [clearLongPressTimer, clearTapTimer, cancelRaf]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      if (menuOpenRef.current) {
        closeMenu();
        return;
      }

      activePointerIdRef.current = e.pointerId;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      latestPointRef.current = { x: e.clientX, y: e.clientY };
      movedBeforeLongPressRef.current = false;
      longPressTriggeredRef.current = false;
      didSlideDuringLongPressRef.current = false;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable.
      }

      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (movedBeforeLongPressRef.current) return;

        clearTapTimer();
        tapCountRef.current = 0;

        longPressTriggeredRef.current = true;
        openPointRef.current = { ...latestPointRef.current };
        setMenuOpen(true);
        setHighlightedId(null);
        highlightedRef.current = null;
        safeVibrate(15);
      }, LONG_PRESS_MS);
    },
    [clearLongPressTimer, clearTapTimer, closeMenu]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== e.pointerId) return;

      latestPointRef.current = { x: e.clientX, y: e.clientY };

      if (!longPressTriggeredRef.current) {
        const dx = e.clientX - startPointRef.current.x;
        const dy = e.clientY - startPointRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
          movedBeforeLongPressRef.current = true;
          clearLongPressTimer();
        }
        return;
      }

      const slideDx = e.clientX - openPointRef.current.x;
      const slideDy = e.clientY - openPointRef.current.y;
      if (Math.hypot(slideDx, slideDy) > 6) {
        didSlideDuringLongPressRef.current = true;
      }

      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const { x, y } = latestPointRef.current;
        const nextId = findHitMenuId(x, y);
        if (nextId !== highlightedRef.current) {
          highlightedRef.current = nextId;
          setHighlightedId(nextId);
          if (nextId !== null) {
            safeVibrate(8);
          }
        }
      });
    },
    [clearLongPressTimer]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;

      clearLongPressTimer();
      cancelRaf();

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore release errors.
      }

      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        const hitId = findHitMenuId(e.clientX, e.clientY) ?? highlightedRef.current;

        if (hitId !== null) {
          triggerMenuItem(hitId);
        } else if (didSlideDuringLongPressRef.current) {
          closeMenu();
        }
        // Otherwise finger lifted without moving: keep menu open for direct tapping.
        return;
      }

      if (movedBeforeLongPressRef.current) return;

      const cfg = configRef.current;
      const hasDouble = cfg.doubleTap !== 'none';
      const hasTriple = cfg.tripleTap !== 'none';

      // Fast path: fire single tap immediately when no multi-tap actions are configured.
      if (!hasDouble && !hasTriple) {
        clearTapTimer();
        tapCountRef.current = 0;
        onRunActionRef.current(cfg.tap);
        return;
      }

      tapCountRef.current += 1;
      clearTapTimer();

      if (tapCountRef.current >= 3) {
        tapCountRef.current = 0;
        const action = cfg.tripleTap !== 'none' ? cfg.tripleTap : cfg.doubleTap;
        onRunActionRef.current(action);
        return;
      }

      if (tapCountRef.current === 2 && !hasTriple) {
        tapCountRef.current = 0;
        onRunActionRef.current(cfg.doubleTap);
        return;
      }

      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        const count = tapCountRef.current;
        tapCountRef.current = 0;
        const latest = configRef.current;
        if (count === 1) {
          onRunActionRef.current(latest.tap);
        } else if (count === 2) {
          onRunActionRef.current(latest.doubleTap);
        } else if (count >= 3) {
          onRunActionRef.current(latest.tripleTap);
        }
      }, TAP_DISAMBIGUATION_MS);
    },
    [clearLongPressTimer, clearTapTimer, cancelRaf, closeMenu, triggerMenuItem]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      clearLongPressTimer();
      cancelRaf();
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        closeMenu();
      }
    },
    [clearLongPressTimer, cancelRaf, closeMenu]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRunActionRef.current(configRef.current.tap);
      } else if (e.key === 'Escape' && menuOpenRef.current) {
        e.preventDefault();
        closeMenu();
      }
    },
    [closeMenu]
  );

  return {
    menuOpen,
    highlightedId,
    closeMenu,
    triggerMenuItem,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
    },
  };
}
