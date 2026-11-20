/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { getWebUiService } from '../../web/ui/webUiService';
import { useWebTabCount } from '../../web/ui/useWebUi';
import {
  closeTabSwitcher,
  openTabSwitcher,
  requestWebComposerFocus,
  showWebNotice,
  useIsTabSwitcherOpen,
  useSwitcherKind,
} from './webUiPanelStore';

interface WebTabBarProps {
  visible: boolean;
}

function formatTabCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

export const WebTabBar: React.FC<WebTabBarProps> = React.memo(function WebTabBar({
  visible,
}) {
  const tabCount = useWebTabCount();
  const isSwitcherOpen = useIsTabSwitcherOpen();
  const switcherKind = useSwitcherKind();

  const handleCreateTab = useCallback(async () => {
    const res = await getWebUiService().newTab(switcherKind);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
    requestWebComposerFocus();
  }, [switcherKind]);

  const handleLeftControl = useCallback(() => {
    if (isSwitcherOpen) {
      closeTabSwitcher();
    } else {
      void handleCreateTab();
    }
  }, [isSwitcherOpen, handleCreateTab]);

  const handleRightControl = useCallback(() => {
    if (isSwitcherOpen) {
      void handleCreateTab();
    } else {
      openTabSwitcher();
    }
  }, [isSwitcherOpen, handleCreateTab]);

  return (
    <div
      aria-hidden={!visible}
      className={`flex items-center mr-3 transition-[opacity,transform] duration-150 ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-1 pointer-events-none'
      }`}
    >
      {/* Left control: + (new tab) or ChevronDown (close switcher) */}
      <button
        type="button"
        onClick={handleLeftControl}
        tabIndex={visible ? 0 : -1}
        aria-label={isSwitcherOpen ? 'Close tab switcher' : `New ${switcherKind} tab`}
        title={isSwitcherOpen ? 'Close tab switcher' : `New ${switcherKind} tab`}
        className="group relative min-w-[44px] h-11 -my-3 -mr-2 flex items-center justify-center focus-visible:outline-none"
      >
        <span className="relative w-6 h-5 rounded-[5px] bg-[#232428] group-hover:bg-[#2C2D32] border border-white/10 shadow-sm flex items-center justify-center transition-colors group-active:scale-95 group-focus-visible:ring-1 group-focus-visible:ring-white/30">
          <Plus
            size={13}
            strokeWidth={2.4}
            className={`absolute text-[#D0D2D6] group-hover:text-white transition-[opacity,transform] duration-150 ${
              isSwitcherOpen
                ? 'opacity-0 scale-75 rotate-45'
                : 'opacity-100 scale-100 rotate-0'
            }`}
          />
          <ChevronDown
            size={13}
            strokeWidth={2.4}
            className={`absolute text-[#D0D2D6] group-hover:text-white transition-[opacity,transform] duration-150 ${
              isSwitcherOpen
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-75 -translate-y-0.5'
            }`}
          />
        </span>
      </button>

      {/* Right control: Tab count box or + (add new tab) when switcher is open */}
      <button
        type="button"
        onClick={handleRightControl}
        tabIndex={visible ? 0 : -1}
        aria-label={
          isSwitcherOpen
            ? `New ${switcherKind} tab`
            : `Open tab switcher (${tabCount} ${tabCount === 1 ? 'tab' : 'tabs'})`
        }
        title={isSwitcherOpen ? `New ${switcherKind} tab` : 'Tab switcher'}
        className="group relative min-w-[44px] h-11 -my-3 -ml-1 flex items-center justify-center focus-visible:outline-none"
      >
        <span className="relative min-w-[24px] h-5 px-1.5 rounded-[5px] bg-[#232428] group-hover:bg-[#2C2D32] border border-white/10 shadow-sm flex items-center justify-center transition-colors group-active:scale-95 group-focus-visible:ring-1 group-focus-visible:ring-white/30">
          <span
            className={`text-[11px] font-semibold leading-none tabular-nums text-[#D0D2D6] group-hover:text-white transition-[opacity,transform] duration-150 ${
              isSwitcherOpen ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            {formatTabCount(tabCount)}
          </span>
          <Plus
            size={13}
            strokeWidth={2.4}
            className={`absolute text-[#D0D2D6] group-hover:text-white transition-[opacity,transform] duration-150 ${
              isSwitcherOpen
                ? 'opacity-100 scale-100 rotate-0'
                : 'opacity-0 scale-75 -rotate-45'
            }`}
          />
        </span>
      </button>
    </div>
  );
});
