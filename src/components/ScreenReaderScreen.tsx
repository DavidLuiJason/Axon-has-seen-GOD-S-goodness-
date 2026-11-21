/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Screen Reader: PLACEHOLDER screen (Director D47). The engines behind it are built and tested; the real screen is
 * written by AI Studio from docs/prompts and REPLACES this file (same file name, same named export, same props).
 */

import React from 'react';
import { ScreenHeader } from './ScreenHeader';

interface ScreenReaderScreenProps {
  onLogoClick: () => void;
}

export const ScreenReaderScreen: React.FC<ScreenReaderScreenProps> = ({ onLogoClick }) => {
  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      <ScreenHeader title="Screen Reader" tagline="SCREEN READER" onLogoClick={onLogoClick} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4">
          <div className="text-[12px] uppercase tracking-wider text-[#68696E] mb-1">Not built yet</div>
          <div className="text-[14px] text-[#EDEDED]">
            This screen is being built. It will give you a self-test that proves AXON can read and act on the phone screen.
          </div>
        </div>
      </div>
    </div>
  );
};
