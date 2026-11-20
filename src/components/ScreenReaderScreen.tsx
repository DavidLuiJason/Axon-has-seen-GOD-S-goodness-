/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * D321 stopgap: src/App.tsx imports this screen but the file was missing from
 * the repository, which broke "vite build" (unresolved import). This keeps the
 * build green. If the real Screen Reader screen (D47) exists anywhere, restore
 * it over this file; the props are the same (onLogoClick).
 */

import React from 'react';
import { ScreenHeader } from './ScreenHeader';

interface ScreenReaderScreenProps {
  onLogoClick: () => void;
}

export const ScreenReaderScreen: React.FC<ScreenReaderScreenProps> = ({ onLogoClick }) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#121315] text-[#ECECEC]">
      <ScreenHeader title="Screen Reader" tagline="Reading the screen" onLogoClick={onLogoClick} />
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <p className="text-[15px] text-[#9A9A9E]">
          The Screen Reader screen is not installed in this build yet.
        </p>
      </div>
    </div>
  );
};
