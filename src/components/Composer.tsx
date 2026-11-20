/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Mic,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Code2,
  Globe,
  Paperclip,
  X,
  Check,
} from 'lucide-react';
import { QuickActionButton } from '../quickAction';
import { getWebUiService } from '../web/ui/webUiService';
import { useWebActiveTab } from '../web/ui/useWebUi';
import { getWebKindPresentation } from '../web/ui/webKindStyle';
import {
  WebFindBar,
  WebTabBar,
  closeFindBar,
  closeTabSwitcher,
  useComposerFocusSeq,
  useIsFindBarOpen,
  useWebNoticeEvent,
} from './web';
import type { AxonMode, ChatAttachment } from '../types';

export interface ComposerSendOptions {
  attachments?: ChatAttachment[];
  webGrounding?: boolean;
}

interface ComposerAttachment extends ChatAttachment {
  previewUrl?: string;
}

interface ComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string, options?: ComposerSendOptions) => void;
  onToggleCompactMode: () => void;
  onNewChat?: () => void;
  mode: AxonMode;
  onModeChange: (mode: AxonMode) => void;
  /** True while the chat is scrolled well above its newest message. */
  showScrollDown?: boolean;
  onScrollDown?: () => void;
  disabled?: boolean;
}

const AXON_MODES: { id: AxonMode; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'web', label: 'Web' },
  { id: 'apps', label: 'Apps' },
];

const MODE_PLACEHOLDERS: Record<AxonMode, string> = {
  chat: 'Message AXON...',
  web: 'Web is not available yet',
  apps: 'Apps is not available yet',
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const BAR_WIDTH_PX = 2;
const BAR_GAP_PX = 2;
const BAR_STEP_PX = BAR_WIDTH_PX + BAR_GAP_PX;
const BAR_PUSH_INTERVAL_MS = 55;

function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  onSend,
  onToggleCompactMode,
  onNewChat,
  mode,
  onModeChange,
  showScrollDown = false,
  onScrollDown,
  disabled = false,
}) => {
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [webGrounding, setWebGrounding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWebSearching, setIsWebSearching] = useState(false);

  const activeWebTab = useWebActiveTab();
  const activeWebTabKind = activeWebTab?.kind ?? 'normal';
  const webPresentation = getWebKindPresentation(activeWebTabKind);
  const composerFocusSeq = useComposerFocusSeq();
  const webNoticeEvent = useWebNoticeEvent();
  const isFindBarOpen = useIsFindBarOpen();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownBrainAttachmentNoticeRef = useRef(false);
  const attachmentsRef = useRef<ComposerAttachment[]>(attachments);
  attachmentsRef.current = attachments;

  // Audio & waveform refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeDomainBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = useRef(false);
  const barsRef = useRef<number[]>([]);
  const lastBarPushRef = useRef(0);

  const hasText = input.trim().length > 0;
  const canSend =
    (mode === 'chat' && (hasText || attachments.length > 0)) ||
    (mode === 'web' && hasText);
  const showChipsRow =
    mode === 'chat' &&
    !isRecording &&
    (attachments.length > 0 || webGrounding);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, 3400);
  }, []);

  const prevWebNoticeSeqRef = useRef(webNoticeEvent.seq);
  useEffect(() => {
    if (webNoticeEvent.seq !== prevWebNoticeSeqRef.current) {
      prevWebNoticeSeqRef.current = webNoticeEvent.seq;
      if (webNoticeEvent.text) {
        showNotice(webNoticeEvent.text);
      }
    }
  }, [webNoticeEvent, showNotice]);

  const prevFocusSeqRef = useRef(composerFocusSeq);
  useEffect(() => {
    if (composerFocusSeq !== prevFocusSeqRef.current) {
      prevFocusSeqRef.current = composerFocusSeq;
      if (mode === 'web' && !isRecording) {
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    }
  }, [composerFocusSeq, mode, isRecording]);

  // Cleanup notice timer & object URLs on unmount
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        clearTimeout(noticeTimerRef.current);
      }
      for (const att of attachmentsRef.current) {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      }
    };
  }, []);

  // Close attachment popover when switching away from Chat; close Find bar when leaving Web or tab closes
  useEffect(() => {
    if (mode !== 'chat' && isAttachmentOpen) {
      setIsAttachmentOpen(false);
    }
    if ((mode !== 'web' || !activeWebTab) && isFindBarOpen) {
      getWebUiService().clearFind();
      closeFindBar();
    }
  }, [mode, isAttachmentOpen, activeWebTab, isFindBarOpen]);

  // Auto-resize textarea smoothly without altering container geometry
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(newHeight, 26)}px`;
    }
  }, [input, isRecording]);

  // Click outside to close attachment popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachmentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stopMediaResources = useCallback(() => {
    recordingActiveRef.current = false;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors.
        }
      }
      streamRef.current = null;
    }
    analyserRef.current = null;
    timeDomainBufRef.current = null;
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      ctx.close().catch(() => {});
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopMediaResources();
    setIsRecording(false);
    setMicUnavailable(false);
    setElapsedSeconds(0);
  }, [stopMediaResources]);

  const acceptRecording = useCallback(() => {
    stopMediaResources();
    setIsRecording(false);
    setMicUnavailable(false);
    setElapsedSeconds(0);
    showNotice('Spoken audio engine is staged. The AXON voice pipeline connects in Phase 2.');
  }, [stopMediaResources, showNotice]);

  // Stop recording cleanly on Escape, tab hidden, or unmount
  useEffect(() => {
    if (!isRecording) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cancelRecording();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRecording();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('keydown', onKeyDown);
      stopMediaResources();
    };
  }, [isRecording, cancelRecording, stopMediaResources]);

  // Drive live waveform <canvas> with devicePixelRatio inside rAF
  useEffect(() => {
    if (!isRecording) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    barsRef.current = [];
    lastBarPushRef.current = 0;

    const drawFrame = (now: number) => {
      if (!recordingActiveRef.current) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const cssWidth = canvas.clientWidth || 300;
      const cssHeight = canvas.clientHeight || 36;
      const targetW = Math.max(1, Math.floor(cssWidth * dpr));
      const targetH = Math.max(1, Math.floor(cssHeight * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const maxBars = Math.max(1, Math.floor(cssWidth / BAR_STEP_PX));

      if (now - lastBarPushRef.current >= BAR_PUSH_INTERVAL_MS) {
        lastBarPushRef.current = now;
        let level = 0.05;

        const analyser = analyserRef.current;
        const buf = timeDomainBufRef.current;
        if (analyser && buf) {
          analyser.getByteTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          level = Math.min(1, Math.max(0.06, rms * 3.8));
        }

        barsRef.current.push(level);
        if (barsRef.current.length > maxBars) {
          barsRef.current.splice(0, barsRef.current.length - maxBars);
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const bars = barsRef.current;
      const count = bars.length;
      const startX = cssWidth - count * BAR_STEP_PX;
      const centerY = cssHeight / 2;
      const minBarH = 3;
      const maxBarH = Math.max(minBarH, cssHeight - 6);

      for (let i = 0; i < count; i++) {
        const x = startX + i * BAR_STEP_PX;
        if (x + BAR_WIDTH_PX < 0) continue;

        const progress = count <= 1 ? 1 : i / (count - 1);
        const alpha = 0.14 + 0.82 * progress;
        const h = minBarH + bars[i] * (maxBarH - minBarH);
        const y = centerY - h / 2;

        ctx.fillStyle = `rgba(236, 236, 236, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        const r = BAR_WIDTH_PX / 2;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, BAR_WIDTH_PX, h, r);
        } else {
          ctx.rect(x, y, BAR_WIDTH_PX, h);
        }
        ctx.fill();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (recordingActiveRef.current) return;

    setIsAttachmentOpen(false);
    setMicUnavailable(false);
    setElapsedSeconds(0);
    recordingActiveRef.current = true;
    setIsRecording(true);

    const startedAt = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const next = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds((prev) => (prev === next ? prev : next));
    }, 250);

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setMicUnavailable(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!recordingActiveRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        setMicUnavailable(true);
        return;
      }

      const audioCtx = new AudioCtx();
      if (!recordingActiveRef.current) {
        audioCtx.close().catch(() => {});
        return;
      }
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      analyserRef.current = analyser;
      timeDomainBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {
      if (recordingActiveRef.current) {
        setMicUnavailable(true);
      }
    }
  };

  const handleFilesSelected = (
    fileList: FileList | null,
    kind: 'document' | 'image'
  ) => {
    if (!fileList || fileList.length === 0) return;

    const current = attachmentsRef.current;
    let remaining = MAX_ATTACHMENTS - current.length;
    if (remaining <= 0) {
      showNotice(`You can attach at most ${MAX_ATTACHMENTS} files.`);
      return;
    }

    const added: ComposerAttachment[] = [];
    let tooLarge = false;
    let overCap = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > MAX_ATTACHMENT_BYTES) {
        tooLarge = true;
        continue;
      }
      if (remaining <= 0) {
        overCap = true;
        break;
      }
      remaining -= 1;
      added.push({
        id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        name: file.name,
        size: file.size,
        mimeType: file.type || (kind === 'image' ? 'image/*' : 'application/octet-stream'),
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
      });
    }

    if (added.length > 0) {
      setAttachments((prev) => [...prev, ...added]);
    }

    if (tooLarge) {
      showNotice('Each file must be 10 MB or smaller.');
    } else if (overCap) {
      showNotice(`You can attach at most ${MAX_ATTACHMENTS} files.`);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleInsertCodeSnippet = () => {
    setIsAttachmentOpen(false);
    const el = textareaRef.current;
    const start = el ? el.selectionStart : input.length;
    const end = el ? el.selectionEnd : input.length;
    const needsLeadingNewline = start > 0 && input.charAt(start - 1) !== '\n';
    const prefix = needsLeadingNewline ? '\n' : '';
    const block = `${prefix}\`\`\`\n\n\`\`\``;
    const nextValue = input.slice(0, start) + block + input.slice(end);
    const cursorPos = start + prefix.length + 4;

    setInput(nextValue);
    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleToggleWebGrounding = () => {
    setWebGrounding((prev) => !prev);
    setIsAttachmentOpen(false);
  };

  const handleWebSearch = async () => {
    const query = input.trim();
    if (!query || isWebSearching) return;
    setIsWebSearching(true);
    try {
      const service = getWebUiService();
      if (!service.getState().activeTabId) {
        const created = await service.newTab('normal');
        if (!created.ok) {
          showNotice(created.message);
          return;
        }
      }
      const res = await service.search(query);
      if (!res.ok) {
        showNotice(res.message);
        return;
      }
      setInput('');
      closeTabSwitcher();
      if (textareaRef.current) {
        textareaRef.current.style.height = '26px';
      }
    } finally {
      setIsWebSearching(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSend || disabled) return;

    if (mode === 'web') {
      void handleWebSearch();
      return;
    }

    const textToSend = input.trim();
    const sentAttachments: ChatAttachment[] = attachments.map(
      ({ previewUrl: _previewUrl, ...rest }) => rest
    );

    if (sentAttachments.length > 0 && !shownBrainAttachmentNoticeRef.current) {
      shownBrainAttachmentNoticeRef.current = true;
      showNotice('AXON will read attachments when its brain connects.');
    }

    for (const att of attachments) {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    }

    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '26px';
    }

    onSend(textToSend, {
      ...(sentAttachments.length > 0 ? { attachments: sentAttachments } : {}),
      ...(webGrounding ? { webGrounding: true } : {}),
    });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-4 px-4 sm:px-6">
      <div className="relative max-w-[720px] mx-auto w-full flex flex-col items-end pointer-events-auto">
        {/* Overlaid status toast: positioned above composer so it never shifts the indicator row */}
        {notice && (
          <div
            role="status"
            className="absolute bottom-full left-0 right-0 mb-2 z-30 px-4 py-2 rounded-xl bg-[#232428]/95 border border-[#E85A3C]/30 text-xs text-[#D8DADC] shadow-xl backdrop-blur-md flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#E85A3C] animate-pulse shrink-0" />
              <span className="truncate">{notice}</span>
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-[#9A9B9F] hover:text-white ml-2 text-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Persistent Indicator Pill Above Composer (replaced by WebFindBar when Find in page is open) */}
        {mode === 'web' && !isRecording && isFindBarOpen ? (
          <WebFindBar />
        ) : (
          <div className="relative flex items-center justify-end w-full mb-2 pr-1">
            {/* Scroll-to-bottom arrow: appears only when the chat is scrolled up */}
            {showScrollDown && (
              <button
                type="button"
                onClick={onScrollDown}
                aria-label="Scroll to latest message"
                title="Scroll to latest"
                className="absolute left-1/2 -translate-x-1/2 bottom-7 w-9 h-9 rounded-full bg-[#232427] hover:bg-[#2C2D32] text-[#D0D2D6] hover:text-white border border-white/10 shadow-[0_6px_20px_rgb(0,0,0,0.45)] flex items-center justify-center transition-colors active:scale-95 animate-in fade-in duration-150"
              >
                <ArrowDown size={17} strokeWidth={2.2} />
              </button>
            )}
            <WebTabBar visible={mode === 'web' && !isRecording} />
            <QuickActionButton
              mode={mode}
              onModeChange={onModeChange}
              onNewChat={onNewChat}
              onScrollLatest={onScrollDown}
              onToggleCompactMode={onToggleCompactMode}
              onNotice={showNotice}
            />
          </div>
        )}

        {/* Hidden file pickers */}
        <input
          ref={docInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files, 'document');
            e.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files, 'image');
            e.target.value = '';
          }}
        />

        {/* Persistent Anchored Composer Bubble */}
        <div className="w-full bg-[#1E1F22] rounded-[26px] p-3 border border-white/[0.05] shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-xl transition-all">
          {isRecording ? (
            <>
              {/* Recording Waveform View */}
              <div className="px-1.5 pt-0.5">
                <canvas
                  ref={canvasRef}
                  aria-label="Live audio waveform"
                  className="w-full h-9 block"
                />
                {micUnavailable && (
                  <p className="mt-1 text-[11px] text-[#9A9B9F]">
                    Microphone is not available on this device yet
                  </p>
                )}
              </div>

              {/* Recording Bottom Row */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 px-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E85A3C] animate-pulse" />
                  <span className="text-xs font-medium text-[#E0E2E6] tabular-nums">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    aria-label="Cancel recording"
                    className="w-9 h-9 rounded-full bg-[#2C2D30] hover:bg-[#36373B] text-[#D0D2D6] hover:text-white flex items-center justify-center transition-all active:scale-95"
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={acceptRecording}
                    aria-label="Finish recording"
                    className="w-10 h-10 rounded-full bg-white text-black hover:bg-[#F2F2F2] flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#E85A3C]"
                  >
                    <Check size={19} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Attachments & Web Grounding Chips Row (only present when non-empty) */}
              {showChipsRow && (
                <div className="px-1.5 pb-2 flex flex-wrap items-center gap-2">
                  {attachments.map((att) =>
                    att.kind === 'image' ? (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-1 pr-2 rounded-xl bg-[#25262A] border border-white/10 text-xs text-[#E0E2E6] max-w-[220px]"
                      >
                        {att.previewUrl ? (
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#18191C]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#18191C] flex items-center justify-center shrink-0">
                            <ImageIcon size={16} className="text-[#9A9B9F]" />
                          </div>
                        )}
                        <span className="truncate flex-1">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          aria-label={`Remove ${att.name}`}
                          className="w-5 h-5 rounded-full hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#25262A] border border-white/10 text-xs text-[#E0E2E6] max-w-[220px]"
                      >
                        <Paperclip size={13} className="text-[#9A9B9F] shrink-0" />
                        <span className="truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          aria-label={`Remove ${att.name}`}
                          className="w-4 h-4 rounded-full hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  )}

                  {webGrounding && (
                    <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#25262A] border border-white/10 text-xs text-[#E0E2E6]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E85A3C]" />
                      <span>Web grounding</span>
                      <button
                        type="button"
                        onClick={() => setWebGrounding(false)}
                        aria-label="Turn off Web grounding"
                        className="w-4 h-4 rounded-full hover:bg-white/10 text-[#9A9B9F] hover:text-white flex items-center justify-center transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Top Row: Input Field */}
              <div className="px-1.5 pt-0.5">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (mode === 'web' && e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleWebSearch();
                    }
                  }}
                  enterKeyHint={mode === 'web' ? 'search' : 'enter'}
                  placeholder={
                    mode === 'web'
                      ? webPresentation.searchPlaceholder
                      : MODE_PLACEHOLDERS[mode]
                  }
                  disabled={mode === 'apps' || (mode === 'chat' && disabled)}
                  aria-label={
                    mode === 'web' ? 'Search or type a web address' : 'Message AXON'
                  }
                  className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E9094] text-[15px] font-normal leading-relaxed outline-none resize-none overflow-y-auto max-h-[120px]"
                />
              </div>

              {/* Bottom Row: Persistent Controls */}
              <div className="flex items-center justify-between pt-2">
                {/* Left Controls: Plus Button & Chat / Web / Apps switch */}
                <div className="flex items-center gap-2">
                  {/* Plus Button */}
                  <div className="relative" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (mode !== 'chat') return;
                        setIsAttachmentOpen((prev) => !prev);
                      }}
                      title={mode !== 'chat' ? 'Not used here' : undefined}
                      aria-disabled={mode !== 'chat'}
                      aria-label="Add attachment or action"
                      className={`w-9 h-9 rounded-full bg-[#2C2D30] text-[#D0D2D6] flex items-center justify-center transition-all ${
                        mode !== 'chat'
                          ? 'opacity-40 cursor-default'
                          : 'hover:bg-[#36373B] hover:text-white active:scale-95'
                      }`}
                    >
                      <Plus size={18} strokeWidth={2.2} />
                    </button>

                    {/* Attachment popover */}
                    {isAttachmentOpen && mode === 'chat' && (
                      <div className="absolute bottom-11 left-0 w-48 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentOpen(false);
                            docInputRef.current?.click();
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                        >
                          <Paperclip size={14} className="text-[#9A9B9F]" />
                          <span>Upload Document</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentOpen(false);
                            imageInputRef.current?.click();
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                        >
                          <ImageIcon size={14} className="text-[#9A9B9F]" />
                          <span>Upload Image</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleInsertCodeSnippet}
                          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                        >
                          <Code2 size={14} className="text-[#9A9B9F]" />
                          <span>Code Snippet</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleWebGrounding}
                          className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center justify-between gap-2.5 text-[#E0E2E6]"
                        >
                          <span className="flex items-center gap-2.5">
                            <Globe size={14} className={webGrounding ? 'text-[#E85A3C]' : 'text-[#9A9B9F]'} />
                            <span>Web Grounding</span>
                          </span>
                          {webGrounding && <Check size={14} className="text-[#E85A3C] shrink-0" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chat / Web / Apps switch */}
                  <div role="tablist" aria-label="AXON mode" className="flex items-center">
                    {AXON_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        aria-selected={mode === m.id}
                        onClick={() => onModeChange(m.id)}
                        className={`h-8 px-2.5 rounded-full text-xs font-medium transition-all ${
                          mode === m.id
                            ? 'bg-[#2A2B2E] text-[#ECECEC]'
                            : 'text-[#8E9094] hover:text-[#ECECEC]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Controls: Microphone & Persistent Circular Action Button */}
                <div className="flex items-center gap-1.5">
                  {/* Microphone Button */}
                  <button
                    type="button"
                    onClick={startRecording}
                    aria-label="Spoken microphone input"
                    className="w-9 h-9 rounded-full text-[#9B9DA2] hover:text-white hover:bg-white/5 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Mic size={19} strokeWidth={2} />
                  </button>

                  {/* Persistent Voice / Send Dual-State Circular Button */}
                  {/* Stable geometry: 40px x 40px circle, solid white bg, black icon */}
                  <button
                    type="button"
                    onClick={canSend ? () => handleSubmit() : startRecording}
                    disabled={
                      canSend ? (mode === 'web' ? isWebSearching : disabled) : false
                    }
                    aria-label={
                      canSend
                        ? mode === 'web'
                          ? 'Search web'
                          : 'Send message'
                        : 'Voice conversation'
                    }
                    className="w-10 h-10 rounded-full bg-white text-black hover:bg-[#F2F2F2] flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#E85A3C]"
                  >
                    {canSend ? (
                      // Send State (Arrow Up)
                      <ArrowUp size={19} strokeWidth={2.5} className="animate-in zoom-in-75 duration-150" />
                    ) : (
                      // Voice State (Sound wave bars icon matching reference images)
                      <div className="flex items-center gap-[2.5px] h-4">
                        <span className="w-[2px] h-2 bg-black rounded-full" />
                        <span className="w-[2px] h-3.5 bg-black rounded-full" />
                        <span className="w-[2px] h-4 bg-black rounded-full" />
                        <span className="w-[2px] h-2.5 bg-black rounded-full" />
                        <span className="w-[2px] h-1.5 bg-black rounded-full" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
