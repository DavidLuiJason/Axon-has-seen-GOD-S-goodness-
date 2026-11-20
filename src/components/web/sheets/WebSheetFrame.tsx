/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface WebSheetFrameProps {
  title: string;
  onClose: () => void;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxHeightClass?: string;
}

export const WebSheetFrame: React.FC<WebSheetFrameProps> = ({
  title,
  onClose,
  headerAction,
  footer,
  children,
  maxHeightClass = 'max-h-[82dvh] sm:max-h-[78vh]',
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      />

      {/* Sheet Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full max-w-md ${maxHeightClass} bg-[#18191C] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl text-[#ECECEC] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3.5 border-b border-white/5 shrink-0">
          <h2 className="font-serif text-lg font-semibold tracking-wide text-white truncate">
            {title}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A2A7] hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>

        {/* Optional Fixed Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-white/5 bg-[#141517] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
