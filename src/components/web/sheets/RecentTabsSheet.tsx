/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebClosedTab } from '../../../web/ui/webUiTypes';
import { WebKindIcon } from '../WebKindIcon';
import { closeTabSwitcher, showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface RecentTabsSheetProps {
  onClose: () => void;
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.startsWith('www.') ? u.hostname.slice(4) : u.hostname;
  } catch {
    return url;
  }
}

export const RecentTabsSheet: React.FC<RecentTabsSheetProps> = ({ onClose }) => {
  const [items, setItems] = useState<readonly WebClosedTab[]>(() =>
    getWebUiService().recentlyClosed()
  );

  const handleReopen = async (index: number) => {
    const res = await getWebUiService().reopenClosedTab(index);
    if (!res.ok) {
      showWebNotice(res.message);
      setItems(getWebUiService().recentlyClosed());
      return;
    }
    closeTabSwitcher();
    onClose();
  };

  return (
    <WebSheetFrame title="Recent tabs" onClose={onClose}>
      <div className="p-4">
        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8E9094]">
            No recently closed tabs
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <button
                key={`${item.url}-${idx}`}
                type="button"
                onClick={() => handleReopen(idx)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-center gap-3 transition-colors active:scale-[0.99] [content-visibility:auto] [contain-intrinsic-size:auto_52px]"
              >
                <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                  <WebKindIcon kind={item.kind} size={15} className="text-[#9A9B9F]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#ECECEC] truncate">
                    {item.title || 'Untitled'}
                  </div>
                  <div className="text-[11px] text-[#7A7C82] truncate">
                    {hostOf(item.url)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default RecentTabsSheet;
