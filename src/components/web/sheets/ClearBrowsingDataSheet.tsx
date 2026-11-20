/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebClearable } from '../../../web/ui/webUiTypes';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface ClearBrowsingDataSheetProps {
  onClose: () => void;
}

const CLEARABLE_OPTIONS: readonly {
  id: WebClearable;
  label: string;
  description: string;
}[] = [
  {
    id: 'history',
    label: 'Browsing history',
    description: 'Visited pages and addresses',
  },
  {
    id: 'cookies',
    label: 'Cookies and site data',
    description: 'Sign-ins and preferences stored by sites',
  },
  {
    id: 'cache',
    label: 'Cached images and files',
    description: 'Saved page assets on this device',
  },
  {
    id: 'siteData',
    label: 'Site data',
    description: 'Offline storage and site settings',
  },
];

export const ClearBrowsingDataSheet: React.FC<ClearBrowsingDataSheetProps> = ({
  onClose,
}) => {
  const [selected, setSelected] = useState<ReadonlySet<WebClearable>>(
    () => new Set<WebClearable>(['history', 'cookies', 'cache'])
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleItem = (id: WebClearable) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await getWebUiService().clearBrowsingData(Array.from(selected));
      if (!res.ok) {
        showWebNotice(res.message);
        return;
      }
      onClose();
      showWebNotice('Deleted');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <WebSheetFrame
      title="Delete browsing data"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#D0D2D6] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || isDeleting}
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-[#E85A3C] hover:bg-[#F0684B] disabled:opacity-40 text-xs font-medium text-white transition-colors active:scale-95"
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-2">
        {CLEARABLE_OPTIONS.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggleItem(opt.id)}
              className="w-full text-left px-3.5 py-3 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-start gap-3 transition-colors"
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                  checked
                    ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                    : 'border-white/25 bg-transparent'
                }`}
              >
                {checked && <Check size={11} strokeWidth={2.8} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#ECECEC]">
                  {opt.label}
                </div>
                <div className="text-[11px] text-[#7A7C82] mt-0.5">
                  {opt.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </WebSheetFrame>
  );
};

export default ClearBrowsingDataSheet;
