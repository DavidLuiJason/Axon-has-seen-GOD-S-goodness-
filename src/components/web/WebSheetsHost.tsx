/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { closeWebSheet, useActiveWebSheet } from './webUiPanelStore';

const RecentTabsSheet = lazy(() => import('./sheets/RecentTabsSheet'));
const HistorySheet = lazy(() => import('./sheets/HistorySheet'));
const BookmarksSheet = lazy(() => import('./sheets/BookmarksSheet'));
const DownloadsSheet = lazy(() => import('./sheets/DownloadsSheet'));
const ClearBrowsingDataSheet = lazy(() => import('./sheets/ClearBrowsingDataSheet'));
const SiteControlsSheet = lazy(() => import('./sheets/SiteControlsSheet'));
const TranslateSheet = lazy(() => import('./sheets/TranslateSheet'));
const ShareSheet = lazy(() => import('./sheets/ShareSheet'));
const HelpFeedbackSheet = lazy(() => import('./sheets/HelpFeedbackSheet'));

export const WebSheetsHost: React.FC = () => {
  const activeSheet = useActiveWebSheet();
  if (!activeSheet) return null;

  return (
    <Suspense fallback={null}>
      {activeSheet === 'recent-tabs' ? (
        <RecentTabsSheet onClose={closeWebSheet} />
      ) : activeSheet === 'history' ? (
        <HistorySheet onClose={closeWebSheet} />
      ) : activeSheet === 'bookmarks' ? (
        <BookmarksSheet onClose={closeWebSheet} />
      ) : activeSheet === 'downloads' ? (
        <DownloadsSheet onClose={closeWebSheet} />
      ) : activeSheet === 'clear-data' ? (
        <ClearBrowsingDataSheet onClose={closeWebSheet} />
      ) : activeSheet === 'site-controls' ? (
        <SiteControlsSheet onClose={closeWebSheet} />
      ) : activeSheet === 'translate' ? (
        <TranslateSheet onClose={closeWebSheet} />
      ) : activeSheet === 'share' ? (
        <ShareSheet onClose={closeWebSheet} />
      ) : activeSheet === 'help' ? (
        <HelpFeedbackSheet onClose={closeWebSheet} />
      ) : null}
    </Suspense>
  );
};
