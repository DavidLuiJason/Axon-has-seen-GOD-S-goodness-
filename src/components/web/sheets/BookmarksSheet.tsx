/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BookMarked, X } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebBookmark } from '../../../web/ui/webUiTypes';
import { closeTabSwitcher, showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface BookmarksSheetProps {
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

export const BookmarksSheet: React.FC<BookmarksSheetProps> = ({ onClose }) => {
  const [items, setItems] = useState<readonly WebBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = async () => {
    try {
      const list = await getWebUiService().listBookmarks();
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBookmarks();
  }, []);

  const handleOpen = async (id: string) => {
    const service = getWebUiService();
    if (!service.getState().activeTabId) {
      const created = await service.newTab('normal');
      if (!created.ok) {
        showWebNotice(created.message);
        return;
      }
    }
    const res = await service.openBookmark(id);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
    onClose();
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await getWebUiService().removeBookmark(id);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    setItems((prev) => prev.filter((bm) => bm.id !== id));
    showWebNotice('Bookmark removed');
  };

  return (
    <WebSheetFrame title="Bookmarks" onClose={onClose}>
      <div className="p-4">
        {loading ? (
          <div className="py-10 text-center text-xs text-[#7A7C82]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8E9094]">
            No bookmarks yet
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((bm) => (
              <div
                key={bm.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpen(bm.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleOpen(bm.id);
                  }
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-center justify-between gap-3 cursor-pointer transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_52px]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                    <BookMarked size={14} className="text-[#9A9B9F]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[#ECECEC] truncate">
                      {bm.title || 'Untitled'}
                    </div>
                    <div className="text-[11px] text-[#7A7C82] truncate">
                      {hostOf(bm.url)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleRemove(e, bm.id)}
                  aria-label={`Remove ${bm.title || 'bookmark'}`}
                  className="w-7 h-7 rounded-full hover:bg-white/10 text-[#8E9094] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default BookmarksSheet;
