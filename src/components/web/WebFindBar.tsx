/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { getWebUiService } from '../../web/ui/webUiService';
import { closeFindBar, showWebNotice } from './webUiPanelStore';

export const WebFindBar: React.FC = React.memo(function WebFindBar() {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const focusTimer = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(focusTimer);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      getWebUiService().clearFind();
    };
  }, []);

  const runFind = useCallback(async (text: string, forward: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) {
      getWebUiService().clearFind();
      setMatches(null);
      return;
    }
    const res = await getWebUiService().findInPage(trimmed, forward);
    if (!res.ok) {
      showWebNotice(res.message);
      setMatches(0);
      return;
    }
    setMatches(res.value.matches);
  }, []);

  const handleChange = (nextValue: string) => {
    setQuery(nextValue);
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runFind(nextValue, true);
    }, 150);
  };

  const handleStep = (forward: boolean) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void runFind(query, forward);
  };

  const handleClose = () => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    getWebUiService().clearFind();
    closeFindBar();
  };

  return (
    <div
      role="search"
      aria-label="Find in page"
      className="w-full mb-2 h-8 px-2.5 rounded-[10px] bg-[#232428] border border-white/10 shadow-md flex items-center gap-1.5"
    >
      <Search size={13} className="text-[#9A9B9F] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleStep(!e.shiftKey);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
          }
        }}
        placeholder="Find in page..."
        aria-label="Find in page query"
        className="flex-1 min-w-0 bg-transparent text-xs text-[#ECECEC] placeholder-[#7A7C82] outline-none"
      />
      {matches !== null && query.trim().length > 0 && (
        <span className="text-[11px] tabular-nums text-[#9A9B9F] whitespace-nowrap shrink-0 px-1">
          {matches}
        </span>
      )}
      <button
        type="button"
        onClick={() => handleStep(false)}
        disabled={query.trim().length === 0}
        aria-label="Previous match"
        title="Previous"
        className="w-6 h-6 rounded-md hover:bg-white/10 disabled:opacity-35 text-[#D0D2D6] hover:text-white flex items-center justify-center shrink-0 transition-colors"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => handleStep(true)}
        disabled={query.trim().length === 0}
        aria-label="Next match"
        title="Next"
        className="w-6 h-6 rounded-md hover:bg-white/10 disabled:opacity-35 text-[#D0D2D6] hover:text-white flex items-center justify-center shrink-0 transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close find in page"
        title="Close"
        className="w-6 h-6 rounded-md hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center shrink-0 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
});
