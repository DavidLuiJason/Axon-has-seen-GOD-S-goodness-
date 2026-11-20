/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Bell, Camera, Lock, MapPin, Mic, ShieldAlert } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import type {
  WebPermission,
  WebPermissionDecision,
  WebSiteInfo,
} from '../../../web/ui/webUiTypes';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface SiteControlsSheetProps {
  onClose: () => void;
}

const PERMISSION_ROWS: readonly {
  id: WebPermission;
  label: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  { id: 'camera', label: 'Camera', Icon: Camera },
  { id: 'microphone', label: 'Microphone', Icon: Mic },
  { id: 'location', label: 'Location', Icon: MapPin },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
];

const DECISIONS: readonly { id: WebPermissionDecision; label: string }[] = [
  { id: 'allow', label: 'Allow' },
  { id: 'block', label: 'Block' },
  { id: 'ask', label: 'Ask' },
];

export const SiteControlsSheet: React.FC<SiteControlsSheetProps> = ({ onClose }) => {
  const [info, setInfo] = useState<WebSiteInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getWebUiService()
      .getSiteInfo()
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(res.message);
          setInfo(null);
        } else {
          setInfo(res.value);
          setErrorMessage(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Could not load site controls.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetPermission = async (
    permission: WebPermission,
    decision: WebPermissionDecision
  ) => {
    if (!info || info.permissions[permission] === decision) return;
    const res = await getWebUiService().setSitePermission(permission, decision);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    setInfo((prev) =>
      prev
        ? {
            ...prev,
            permissions: {
              ...prev.permissions,
              [permission]: decision,
            },
          }
        : prev
    );
  };

  return (
    <WebSheetFrame title="Site controls" onClose={onClose}>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="py-10 text-center text-xs text-[#7A7C82]">Loading...</div>
        ) : errorMessage || !info ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-xs text-[#9A9B9F] leading-relaxed">
              {errorMessage ?? 'No page is open.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#232428] hover:bg-[#2C2D32] text-xs font-medium text-[#ECECEC] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Site host + connection status */}
            <div className="px-3.5 py-3 rounded-2xl bg-[#141517] border border-white/5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                {info.secure ? (
                  <Lock size={15} className="text-[#D0D2D6]" />
                ) : (
                  <ShieldAlert size={15} className="text-[#E85A3C]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">
                  {info.host}
                </div>
                <div className="text-[11px] text-[#8E9094]">
                  {info.secure ? 'Connection is secure' : 'Connection is not secure'}
                </div>
              </div>
            </div>

            {/* Four permission rows */}
            <div className="space-y-2">
              {PERMISSION_ROWS.map(({ id, label, Icon }) => {
                const current = info.permissions[id];
                return (
                  <div
                    key={id}
                    className="px-3.5 py-2.5 rounded-xl bg-[#141517] border border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className="text-[#9A9B9F] shrink-0" />
                      <span className="text-xs font-medium text-[#E0E2E6] truncate">
                        {label}
                      </span>
                    </div>

                    <div
                      role="group"
                      aria-label={`${label} permission`}
                      className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-[#1C1D21] border border-white/5 shrink-0"
                    >
                      {DECISIONS.map((d) => {
                        const active = current === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleSetPermission(id, d.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              active
                                ? 'bg-[#2A2B2E] text-white'
                                : 'text-[#8E9094] hover:text-white'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="px-1 text-[11px] text-[#7A7C82] leading-relaxed">
              Some permissions stay blocked until AXON asks Android for them.
            </p>
          </>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default SiteControlsSheet;
