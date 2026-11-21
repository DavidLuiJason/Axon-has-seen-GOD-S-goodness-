/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Apps: PLACEHOLDER screen (Director D47). The engines behind it are built and tested; the real screen is
 * written by AI Studio from docs/prompts and REPLACES this file (same file name, same named export, same props).
 */

import React from 'react';
import { ScreenHeader } from './ScreenHeader';

interface AxonAppsScreenProps {
  onLogoClick: () => void;
}

export const AxonAppsScreen: React.FC<AxonAppsScreenProps> = ({ onLogoClick }) => {
  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      <ScreenHeader title="AXON Apps" tagline="AXON APPS" onLogoClick={onLogoClick} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4">
          <div className="text-[12px] uppercase tracking-wider text-[#68696E] mb-1">Not built yet</div>
          <div className="text-[14px] text-[#EDEDED]">
            This screen is being built. It will give you your installed apps, with AXON able to open them.
          </div>
        </div>
      </div>
    </div>
  );
};
