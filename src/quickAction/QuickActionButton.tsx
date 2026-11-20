/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef } from 'react';
import type { AxonMode } from '../types';
import { executeQuickAction } from './executor';
import { QuickActionMenu } from './QuickActionMenu';
import { openQuickActionSettings, useQuickActionPageConfig } from './store';
import type { QuickActionId } from './types';
import { useQuickActionGesture } from './useQuickActionGesture';

interface QuickActionButtonProps {
  mode: AxonMode;
  onModeChange: (mode: AxonMode) => void;
  onNewChat?: () => void;
  onScrollLatest?: () => void;
  onToggleCompactMode: () => void;
  onNotice?: (message: string) => void;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = React.memo(
  function QuickActionButton({
    mode,
    onModeChange,
    onNewChat,
    onScrollLatest,
    onToggleCompactMode,
    onNotice,
  }) {
    const pageConfig = useQuickActionPageConfig(mode);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const runtimeRef = useRef({
      mode,
      onModeChange,
      onNewChat,
      onScrollLatest,
      onOpenPaneView: onToggleCompactMode,
      onNotice,
    });
    runtimeRef.current = {
      mode,
      onModeChange,
      onNewChat,
      onScrollLatest,
      onOpenPaneView: onToggleCompactMode,
      onNotice,
    };

    const handleRunAction = useCallback((actionId: QuickActionId) => {
      void executeQuickAction(actionId, runtimeRef.current);
    }, []);

    const handleCustomize = useCallback(() => {
      openQuickActionSettings(runtimeRef.current.mode);
    }, []);

    const { menuOpen, highlightedId, triggerMenuItem, handlers } = useQuickActionGesture({
      config: pageConfig,
      buttonRef,
      menuRef,
      onRunAction: handleRunAction,
      onCustomize: handleCustomize,
    });

    return (
      <div className="relative flex items-center">
        {menuOpen && (
          <QuickActionMenu
            menuRef={menuRef}
            items={pageConfig.menu}
            highlightedId={highlightedId}
            onSelect={triggerMenuItem}
          />
        )}

        <button
          ref={buttonRef}
          type="button"
          title="Quick action button"
          aria-label="Quick action button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onContextMenu={(e) => e.preventDefault()}
          {...handlers}
          className="group flex items-center justify-center w-7 h-5 rounded-[5px] bg-[#232428] hover:bg-[#2C2D32] border border-white/10 transition-colors shadow-sm focus-visible:ring-1 focus-visible:ring-white/30 touch-none select-none"
        >
          {/* Split pane / sidebar toggle glyph matching reference images */}
          <div className="w-3.5 h-2.5 rounded-[2px] border border-[#A0A2A7] group-hover:border-white flex overflow-hidden pointer-events-none">
            <div className="h-full transition-all w-1.5 bg-[#A0A2A7] group-hover:bg-white" />
            <div className="flex-1 h-full bg-transparent" />
          </div>
        </button>
      </div>
    );
  }
);
