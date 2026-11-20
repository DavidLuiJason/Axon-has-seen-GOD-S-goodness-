/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Copy, Download, FileText, Share2 } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type { WebShareAction } from '../../../web/ui/webUiTypes';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface ShareSheetProps {
  onClose: () => void;
}

const SHARE_ROWS: readonly {
  id: string;
  label: string;
  subtitle?: string;
  action?: WebShareAction;
  isDownload?: boolean;
  doneMessage: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  {
    id: 'page',
    label: 'Share page',
    subtitle: 'Share address through Android',
    action: 'page',
    doneMessage: 'Done',
    Icon: Share2,
  },
  {
    id: 'shareText',
    label: 'Share text',
    subtitle: 'Share page text through Android',
    action: 'shareText',
    doneMessage: 'Done',
    Icon: Share2,
  },
  {
    id: 'link',
    label: 'Copy link',
    subtitle: 'Copy web address',
    action: 'link',
    doneMessage: 'Done — link copied',
    Icon: Copy,
  },
  {
    id: 'copyText',
    label: 'Copy all text',
    subtitle: 'Copy text from this page',
    action: 'copyText',
    doneMessage: 'Done — text copied',
    Icon: Copy,
  },
  {
    id: 'pdf',
    label: 'Save as PDF',
    subtitle: 'The whole page',
    action: 'pdf',
    doneMessage: 'Done — saved as PDF',
    Icon: FileText,
  },
  {
    id: 'download',
    label: 'Download page',
    subtitle: 'Save offline copy',
    isDownload: true,
    doneMessage: 'Done — page downloaded',
    Icon: Download,
  },
];

export const ShareSheet: React.FC<ShareSheetProps> = ({ onClose }) => {
  const handleRow = async (row: (typeof SHARE_ROWS)[number]) => {
    const service = getWebUiService();
    const res = row.isDownload
      ? await service.downloadPage()
      : await service.share(row.action!);

    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    onClose();
    showWebNotice(row.doneMessage);
  };

  return (
    <WebSheetFrame title="Share" onClose={onClose}>
      <div className="p-4 space-y-1.5">
        {SHARE_ROWS.map((row) => {
          const Icon = row.Icon;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => handleRow(row)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-center gap-3 transition-colors active:scale-[0.99]"
            >
              <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-[#9A9B9F]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#ECECEC]">
                  {row.label}
                </div>
                {row.subtitle && (
                  <div className="text-[11px] text-[#7A7C82]">
                    {row.subtitle}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </WebSheetFrame>
  );
};

export default ShareSheet;
