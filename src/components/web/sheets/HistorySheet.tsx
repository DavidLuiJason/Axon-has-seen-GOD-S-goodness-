/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Search, X } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebHistoryItem } from '../../../web/ui/webUiTypes';
import { closeTabSwitcher, showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface HistorySheetProps {
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

function dayLabelOf(visitedAt: number, nowMs: number): string {
  // MockWebUiService uses monotonic counters for visitedAt when < 1e11; real engine uses epoch ms.
  if (!Number.isFinite(visitedAt) || visitedAt < 1e11) {
    return 'Today';
  }
  const visitDate = new Date(visitedAt);
  const today = new Date(nowMs);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfVisit = new Date(
    visitDate.getFullYear(),
    visitDate.getMonth(),
    visitDate.getDate()
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfVisit) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return visitDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const HistorySheet: React.FC<HistorySheetProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<readonly WebHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  // Debounce search query by 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getWebUiService()
      .listHistory(debouncedQuery)
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const groupedByDay = useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, WebHistoryItem[]>();
    for (const item of items) {
      const label = dayLabelOf(item.visitedAt, now);
      const bucket = groups.get(label);
      if (bucket) bucket.push(item);
      else groups.set(label, [item]);
    }
    return Array.from(groups.entries());
  }, [items]);

  const handleOpenItem = async (id: string) => {
    const service = getWebUiService();
    if (!service.getState().activeTabId) {
      const created = await service.newTab('normal');
      if (!created.ok) {
        showWebNotice(created.message);
        return;
      }
    }
    const res = await service.openHistoryItem(id);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    closeTabSwitcher();
    onClose();
  };

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    const res = await getWebUiService().clearBrowsingData(['history']);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    setItems([]);
    showWebNotice('History cleared');
  };

  return (
    <WebSheetFrame
      title="History"
      onClose={onClose}
      headerAction={
        items.length > 0 || confirmClear ? (
          <button
            type="button"
            onClick={handleClearHistory}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              confirmClear
                ? 'bg-[#E85A3C]/20 text-[#E85A3C] border border-[#E85A3C]/40'
                : 'text-[#9A9B9F] hover:text-white'
            }`}
          >
            {confirmClear ? 'Tap again to clear' : 'Clear history'}
          </button>
        ) : undefined
      }
    >
      <div className="p-4 space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#141517] border border-white/10 focus-within:border-white/20">
          <Search size={14} className="text-[#7A7C82] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setConfirmClear(false);
              setQuery(e.target.value);
            }}
            placeholder="Search history..."
            aria-label="Search history"
            className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-[#7A7C82] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-[#7A7C82] hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-[#7A7C82]">Loading...</div>
        ) : groupedByDay.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#8E9094]">
            {query.trim() ? 'No matching history entries' : 'No browsing history yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDay.map(([day, dayItems]) => (
              <div key={day} className="space-y-1.5">
                <div className="px-1 text-[11px] font-medium text-[#7A7C82]">
                  {day}
                </div>
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenItem(item.id)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-center gap-3 transition-colors active:scale-[0.99] [content-visibility:auto] [contain-intrinsic-size:auto_52px]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                      <Globe size={14} className="text-[#9A9B9F]" />
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
            ))}
          </div>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default HistorySheet;
