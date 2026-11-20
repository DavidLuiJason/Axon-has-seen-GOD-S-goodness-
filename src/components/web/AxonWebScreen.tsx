/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Globe, Lock, ShieldAlert } from 'lucide-react';
import { useWebActiveTab } from '../../web/ui/useWebUi';
import { getWebKindPresentation } from '../../web/ui/webKindStyle';
import { getWebUiService } from '../../web/ui/webUiService';
import type { WebViewportRect } from '../../web/ui/webUiTypes';
import { WebKindIcon } from './WebKindIcon';
import { WebTabSwitcher } from './WebTabSwitcher';
import {
  closeTabSwitcher,
  openFindBar,
  requestWebComposerFocus,
  toggleTabSwitcher,
  useIsTabSwitcherOpen,
} from './webUiPanelStore';

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.startsWith('www.') ? u.hostname.slice(4) : u.hostname;
  } catch {
    return url;
  }
}

function rectsEqual(a: WebViewportRect | null, b: WebViewportRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}

export const AxonWebScreen: React.FC = () => {
  const activeTab = useWebActiveTab();
  const isTabSwitcherOpen = useIsTabSwitcherOpen();
  const pageAreaRef = useRef<HTMLDivElement>(null);
  const lastReportedRectRef = useRef<WebViewportRect | null>(null);

  const isNative = Capacitor.isNativePlatform();
  const hasLoadedPage = Boolean(activeTab && activeTab.url);
  const isNativeLivePage = isNative && hasLoadedPage && !isTabSwitcherOpen;

  // Connect Quick Action Web commands ('tab-switcher', 'find-in-page', 'new-tab')
  useEffect(() => {
    const handleWebUiAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === 'tab-switcher') {
        toggleTabSwitcher();
      } else if (detail?.action === 'find-in-page') {
        openFindBar();
      } else if (detail?.action === 'new-tab') {
        closeTabSwitcher();
        requestWebComposerFocus();
      }
    };
    window.addEventListener('axon:web-ui-action', handleWebUiAction);
    return () => {
      window.removeEventListener('axon:web-ui-action', handleWebUiAction);
    };
  }, []);

  // Make document root/body transparent only while the native page is drawn behind the screen
  useEffect(() => {
    if (!isNativeLivePage) return;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, [isNativeLivePage]);

  // Report page area CSS rectangle (relative to window) to the engine while visible with an open tab
  useEffect(() => {
    const service = getWebUiService();

    if (isTabSwitcherOpen || !activeTab) {
      if (lastReportedRectRef.current !== null) {
        lastReportedRectRef.current = null;
        service.setViewportRect(null);
      }
      return;
    }

    const el = pageAreaRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const measureAndReport = () => {
      rafId = null;
      const node = pageAreaRef.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      const nextRect: WebViewportRect | null =
        width > 0 && height > 0
          ? {
              x: Math.round(box.left),
              y: Math.round(box.top),
              width,
              height,
            }
          : null;

      if (!rectsEqual(lastReportedRectRef.current, nextRect)) {
        lastReportedRectRef.current = nextRect;
        service.setViewportRect(nextRect);
      }
    };

    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(measureAndReport);
    };

    measureAndReport();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleMeasure);
      observer.observe(el);
    }

    window.addEventListener('resize', scheduleMeasure);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    vv?.addEventListener('resize', scheduleMeasure);
    vv?.addEventListener('scroll', scheduleMeasure);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      vv?.removeEventListener('resize', scheduleMeasure);
      vv?.removeEventListener('scroll', scheduleMeasure);
      if (lastReportedRectRef.current !== null) {
        lastReportedRectRef.current = null;
        service.setViewportRect(null);
      }
    };
  }, [isTabSwitcherOpen, activeTab]);

  if (isTabSwitcherOpen) {
    return <WebTabSwitcher />;
  }

  const presentation = activeTab ? getWebKindPresentation(activeTab.kind) : null;

  return (
    <div
      ref={pageAreaRef}
      data-web-viewport="true"
      className={`relative flex-1 w-full flex flex-col overflow-hidden ${
        isNativeLivePage
          ? 'bg-transparent'
          : presentation
            ? presentation.surfaceBgClass
            : 'bg-[#121315]'
      }`}
    >
      {/* Top 2px loading or kind line */}
      {activeTab && (activeTab.loading || presentation?.topLineClass) && (
        <div
          aria-hidden="true"
          className={`absolute top-0 left-0 right-0 h-[2px] z-10 pointer-events-none ${
            activeTab.loading
              ? 'bg-[#E85A3C] animate-pulse'
              : presentation?.topLineClass ?? ''
          }`}
        />
      )}

      {/* Small top-left kind chip (Incognito / Stealth only) */}
      {activeTab && presentation?.showChip && (
        <div className="absolute top-3 left-4 z-10 pointer-events-none">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-medium backdrop-blur-md shadow-sm ${presentation.chipClass}`}
          >
            <WebKindIcon
              kind={activeTab.kind}
              size={12}
              className={presentation.iconClass}
            />
            <span>{presentation.label}</span>
          </div>
        </div>
      )}

      {/* Page Body */}
      {isNativeLivePage ? (
        // Native Android engine draws the web page natively behind this transparent area
        <div className="flex-1 w-full bg-transparent" />
      ) : !activeTab ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#1E1F22] border border-white/10 flex items-center justify-center mb-3">
            <Globe size={22} className="text-[#9A9B9F]" />
          </div>
          <p className="text-sm font-medium text-[#ECECEC]">No tabs open</p>
          <p className="mt-1.5 text-xs text-[#8E9094] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85A3C] shrink-0" />
            <span>Open a tab with + or search below</span>
          </p>
        </div>
      ) : !activeTab.url ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-3 ${
              activeTab.kind === 'incognito'
                ? 'bg-[#0F1012] border-white/15'
                : activeTab.kind === 'stealth'
                  ? 'bg-[#1E1F22] border-[#E85A3C]/25'
                  : 'bg-[#1E1F22] border-white/10'
            }`}
          >
            <WebKindIcon
              kind={activeTab.kind}
              size={22}
              className={
                activeTab.kind === 'stealth' ? 'text-[#E85A3C]' : 'text-[#D0D2D6]'
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#ECECEC]">
              {activeTab.kind === 'normal'
                ? 'New tab'
                : `${presentation?.label ?? ''} tab`}
            </p>
            {presentation?.isComingSoon && (
              <span className="px-2 py-0.5 rounded-md bg-[#232428] border border-white/10 text-[10px] font-medium text-[#9A9B9F]">
                Coming soon
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => requestWebComposerFocus()}
            className="mt-2 text-xs text-[#8E9094] hover:text-[#E0E2E6] transition-colors"
          >
            Search or type a web address below
          </button>
        </div>
      ) : (
        /* Browser / Desktop Preview Card (shown only when running outside Android native shell) */
        <div className="flex-1 w-full max-w-[720px] mx-auto px-4 pt-12 pb-4 flex flex-col">
          <div className="flex-1 rounded-2xl bg-[#18191D] border border-white/10 p-5 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="px-2 py-0.5 rounded-md bg-[#232428] border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-[#9A9B9F]">
                  Page preview
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-[#7A7C82]">
                  {activeTab.readerMode && (
                    <span className="px-2 py-0.5 rounded-md bg-[#232428] text-[#D0D2D6]">
                      Reader
                    </span>
                  )}
                  {activeTab.desktopSite && (
                    <span className="px-2 py-0.5 rounded-md bg-[#232428] text-[#D0D2D6]">
                      Desktop
                    </span>
                  )}
                  {activeTab.secure ? (
                    <Lock size={12} className="text-[#9A9B9F]" aria-label="Secure connection" />
                  ) : (
                    <ShieldAlert size={12} className="text-[#E85A3C]" aria-label="Not secure" />
                  )}
                </div>
              </div>

              <h2 className="text-lg font-medium text-[#ECECEC] truncate">
                {activeTab.title || hostOf(activeTab.url)}
              </h2>
              <p className="mt-1 text-xs text-[#8E9094] truncate">
                {hostOf(activeTab.url)}
              </p>

              {/* Calm grey preview skeleton lines */}
              <div className="mt-6 space-y-2.5" aria-hidden="true">
                <div className="h-3 w-4/5 rounded-md bg-white/[0.06]" />
                <div className="h-3 w-full rounded-md bg-white/[0.04]" />
                <div className="h-3 w-11/12 rounded-md bg-white/[0.04]" />
                <div className="h-3 w-3/5 rounded-md bg-white/[0.04]" />
              </div>
            </div>

            <p className="text-[11px] text-[#7A7C82]">
              The live web page renders behind this area on Android.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
