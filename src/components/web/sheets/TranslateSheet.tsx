/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getWebUiService } from '../../../web/ui/webUiService';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';

interface TranslateSheetProps {
  onClose: () => void;
}

const LANGUAGES: readonly { code: string; nativeName: string; englishName: string }[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'pt-BR', nativeName: 'Português', englishName: 'Portuguese (Brazil)' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'ha', nativeName: 'Hausa', englishName: 'Hausa' },
  { code: 'yo', nativeName: 'Yorùbá', englishName: 'Yoruba' },
  { code: 'ig', nativeName: 'Igbo', englishName: 'Igbo' },
  { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili' },
  { code: 'zh-CN', nativeName: '中文', englishName: 'Chinese (Simplified)' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
];

export const TranslateSheet: React.FC<TranslateSheetProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (lang) =>
        lang.nativeName.toLowerCase().includes(q) ||
        lang.englishName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelectLanguage = async (code: string, englishName: string) => {
    const res = await getWebUiService().translatePage(code);
    if (!res.ok) {
      showWebNotice(res.message);
      return;
    }
    onClose();
    showWebNotice(`Translated to ${englishName}`);
  };

  return (
    <WebSheetFrame title="Translate" onClose={onClose}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#141517] border border-white/10 focus-within:border-white/20">
          <Search size={14} className="text-[#7A7C82] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search languages..."
            aria-label="Search languages"
            className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-[#7A7C82] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear language search"
              className="text-[#7A7C82] hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#8E9094]">
            No matching languages
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code, lang.englishName)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#141517] hover:bg-white/5 border border-white/5 flex items-center justify-between gap-3 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_46px]"
              >
                <span className="text-xs font-medium text-[#ECECEC]">
                  {lang.nativeName}
                </span>
                <span className="text-[11px] text-[#7A7C82]">
                  {lang.englishName} &middot; {lang.code}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </WebSheetFrame>
  );
};

export default TranslateSheet;
