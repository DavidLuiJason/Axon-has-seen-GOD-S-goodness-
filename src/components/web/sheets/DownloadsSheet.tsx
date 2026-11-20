/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebDownload } from '../../../web/ui/webUiTypes';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface DownloadsSheetProps {
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

export const DownloadsSheet: React.FC<DownloadsSheetProps> = ({ onClose }) => {
  const [items, setItems] = useState<readonly WebDownload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getWebUiService()
      .listDownloads()
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
  }, []);

  const handleCancel = async (id: string) => {
    const res = await getWebUiService().cancelDownload(id);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    setItems((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <WebSheetFrame title="Downloads" onClose={onClose}>
      <div className="p-4">
        {loading ? (
          <div className="py-10 text-center text-xs text-[#7A7C82]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8E9094]">
            No downloads yet
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((dl) => {
              const pct = Math.max(0, Math.min(100, Math.round(dl.progress * 100)));
              return (
                <div
                  key={dl.id}
                  className="px-3.5 py-2.5 rounded-xl bg-[#141517] border border-white/5 space-y-2 [content-visibility:auto] [contain-intrinsic-size:auto_60px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                        <Download size={14} className="text-[#9A9B9F]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#ECECEC] truncate">
                          {dl.title}
                        </div>
                        <div className="text-[11px] text-[#7A7C82] truncate">
                          {hostOf(dl.url)} &middot;{' '}
                          {dl.status === 'running'
                            ? `${pct}%`
                            : dl.status === 'failed'
                              ? 'Failed'
                              : 'Done'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancel(dl.id)}
                      aria-label={
                        dl.status === 'running'
                          ? `Cancel ${dl.title}`
                          : `Remove ${dl.title}`
                      }
                      className="w-7 h-7 rounded-full hover:bg-white/10 text-[#8E9094] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {dl.status === 'running' && (
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#E85A3C] rounded-full transition-[width] duration-150"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default DownloadsSheet;
