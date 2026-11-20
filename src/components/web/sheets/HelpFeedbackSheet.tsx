/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { getWebKindPresentation } from '../../../web/ui/webKindStyle';
import { WEB_TAB_KINDS } from '../../../web/ui/webUiTypes';
import { WebKindIcon } from '../WebKindIcon';
import { showWebNotice } from '../webUiPanelStore';
import { WebSheetFrame } from './WebSheetFrame';
import {
  readWebFeedbackEntries,
  saveWebFeedbackEntry,
} from './webFeedbackStorage';

interface HelpFeedbackSheetProps {
  onClose: () => void;
}

const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: 'What is a tab group?',
    a: 'A tab group lets you organise tabs of the same kind under a name, collapse them in the tab switcher, and rename or delete the group while keeping your tabs.',
  },
  {
    q: 'How do I move to another kind of tab?',
    a: 'Normal, Incognito, and Stealth tabs stay completely separate so logins, cookies, and history are never shared. Moving an existing tab between kinds is coming soon.',
  },
  {
    q: 'What does Delete browsing data remove?',
    a: 'It removes the items you select from Browsing history, Cookies and site data, Cached images and files, and Site data.',
  },
  {
    q: 'Why does it say Coming soon?',
    a: 'Normal tabs browse right now, while the Incognito and Stealth engines are not online yet. Those screens are ready so nothing surprises you once they turn on.',
  },
  {
    q: 'How do I switch between chatting and searching?',
    a: 'Tap Chat, Web, or Apps in the bottom composer bar, or tap the small quick action button right above the composer.',
  },
];

export const HelpFeedbackSheet: React.FC<HelpFeedbackSheetProps> = ({
  onClose,
}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [savedCount, setSavedCount] = useState(() => readWebFeedbackEntries().length);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    const { saved, entries } = saveWebFeedbackEntry(trimmed);
    if (!saved) {
      showWebNotice('Could not save feedback on this device.');
      return;
    }
    setSavedCount(entries.length);
    setFeedbackText('');
    setSavedNotice(true);
    showWebNotice('Feedback saved on this phone');
  };

  return (
    <WebSheetFrame title="Help & feedback" onClose={onClose}>
      <div className="p-4 space-y-5">
        {/* How AXON Web works */}
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold text-[#E0E2E6]">
            How AXON Web works
          </h3>
          <div className="space-y-2">
            {WEB_TAB_KINDS.map((kind) => {
              const p = getWebKindPresentation(kind);
              return (
                <div
                  key={kind}
                  className="p-3 rounded-xl bg-[#141517] border border-white/5 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#232428] border border-white/10 flex items-center justify-center shrink-0">
                    <WebKindIcon
                      kind={kind}
                      size={15}
                      className={kind === 'stealth' ? 'text-[#E85A3C]' : 'text-[#9A9B9F]'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {p.label}
                      </span>
                      {p.isComingSoon && (
                        <span className="text-[10px] text-[#7A7C82]">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] text-[#9A9B9F] leading-relaxed">
                      {p.emptyDescription}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Short FAQ */}
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold text-[#E0E2E6]">FAQ</h3>
          <div className="space-y-1.5">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl bg-[#141517] border border-white/5 px-3.5 py-2.5 text-xs"
              >
                <summary className="list-none flex items-center justify-between gap-2 cursor-pointer font-medium text-[#ECECEC]">
                  <span>{item.q}</span>
                  <ChevronDown
                    size={14}
                    className="text-[#7A7C82] shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-2 text-[11.5px] text-[#9A9B9F] leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Send feedback (stored locally on phone) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-[#E0E2E6]">
              Send feedback
            </h3>
            {savedCount > 0 && (
              <span className="text-[11px] text-[#7A7C82] tabular-nums">
                {savedCount} saved
              </span>
            )}
          </div>
          <form onSubmit={handleSaveFeedback} className="space-y-2">
            <textarea
              rows={3}
              value={feedbackText}
              onChange={(e) => {
                setSavedNotice(false);
                setFeedbackText(e.target.value);
              }}
              placeholder="Write a note, issue, or suggestion..."
              aria-label="Feedback message"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141517] border border-white/10 text-xs text-white placeholder-[#7A7C82] outline-none focus:border-[#E85A3C] resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#7A7C82] leading-snug">
                Feedback is saved on this phone until AXON can send it.
              </p>
              <button
                type="submit"
                disabled={!feedbackText.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#232428] hover:bg-[#2C2D32] disabled:opacity-40 border border-white/10 text-xs font-medium text-white shrink-0 flex items-center gap-1.5 transition-colors active:scale-95"
              >
                {savedNotice && <Check size={13} className="text-[#E85A3C]" />}
                <span>{savedNotice ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </WebSheetFrame>
  );
};

export default HelpFeedbackSheet;
