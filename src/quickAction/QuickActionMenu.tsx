/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { getActionDefinition } from './actions';
import { QuickActionIcon } from './QuickActionIcon';
import type { QuickActionId } from './types';

interface QuickActionMenuProps {
  menuRef: React.RefObject<HTMLDivElement | null>;
  items: readonly QuickActionId[];
  highlightedId: string | null;
  onSelect: (itemId: string) => void;
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = React.memo(
  function QuickActionMenu({ menuRef, items, highlightedId, onSelect }) {
    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Quick actions"
        className="absolute bottom-full right-0 mb-2 w-56 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs select-none"
      >
        {items.map((id) => {
          const def = getActionDefinition(id);
          if (!def) return null;
          const isHighlighted = highlightedId === id;
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              data-quick-action-id={id}
              onClick={() => onSelect(id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                isHighlighted
                  ? 'bg-white/10 text-white'
                  : 'text-[#E0E2E6] hover:bg-white/5'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-[2.5px] h-4 rounded-full shrink-0 transition-colors ${
                  isHighlighted ? 'bg-[#E85A3C]' : 'bg-transparent'
                }`}
              />
              <QuickActionIcon
                id={id}
                size={14}
                className={isHighlighted ? 'text-white shrink-0' : 'text-[#9A9B9F] shrink-0'}
              />
              <span className="truncate">{def.label}</span>
            </button>
          );
        })}

        {items.length > 0 && <div className="my-1 border-t border-white/5" />}

        <button
          type="button"
          role="menuitem"
          data-quick-action-id="customize"
          onClick={() => onSelect('customize')}
          className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
            highlightedId === 'customize'
              ? 'bg-white/10 text-white'
              : 'text-[#E0E2E6] hover:bg-white/5'
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-[2.5px] h-4 rounded-full shrink-0 transition-colors ${
              highlightedId === 'customize' ? 'bg-[#E85A3C]' : 'bg-transparent'
            }`}
          />
          <QuickActionIcon
            id="customize"
            size={14}
            className={highlightedId === 'customize' ? 'text-white shrink-0' : 'text-[#9A9B9F] shrink-0'}
          />
          <span>Customize...</span>
        </button>
      </div>
    );
  }
);
