/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WEB_FEATURES } from './webFeatureFlags';
import type { WebTabKind } from './webUiTypes';

export interface WebKindPresentation {
  kind: WebTabKind;
  label: string;
  showChip: boolean;
  topLineClass: string | null;
  surfaceBgClass: string;
  chipClass: string;
  iconClass: string;
  searchPlaceholder: string;
  emptyDescription: string;
  isComingSoon: boolean;
}

export function getWebKindPresentation(kind: WebTabKind): WebKindPresentation {
  switch (kind) {
    case 'normal':
      return {
        kind: 'normal',
        label: 'Normal',
        showChip: false,
        topLineClass: null,
        surfaceBgClass: 'bg-[#121315]',
        chipClass: 'bg-[#232428]/90 border-white/10 text-[#E0E2E6]',
        iconClass: 'text-[#9A9B9F]',
        searchPlaceholder: 'Search or type a web address',
        emptyDescription:
          'Your usual browsing. Logins are shared between normal tabs, like Chrome.',
        isComingSoon: false,
      };
    case 'incognito': {
      const comingSoon = !WEB_FEATURES.incognito;
      return {
        kind: 'incognito',
        label: 'Incognito',
        showChip: true,
        topLineClass: 'bg-[#9A9B9F]',
        surfaceBgClass: 'bg-[#0F1012]',
        chipClass: 'bg-[#0F1012]/90 border-white/15 text-[#E0E2E6]',
        iconClass: 'text-[#9A9B9F]',
        searchPlaceholder: comingSoon
          ? 'Search privately (coming soon)'
          : 'Search privately',
        emptyDescription:
          'Private tabs, kept apart from normal tabs. They disappear when you remove AXON from your recent apps.',
        isComingSoon: comingSoon,
      };
    }
    case 'stealth': {
      const comingSoon = !WEB_FEATURES.stealth;
      return {
        kind: 'stealth',
        label: 'Stealth',
        showChip: true,
        topLineClass: 'bg-[#E85A3C]/60',
        surfaceBgClass: 'bg-[#121315]',
        chipClass: 'bg-[#141517]/90 border-[#E85A3C]/25 text-[#E0E2E6]',
        iconClass: 'text-[#E85A3C]',
        searchPlaceholder: comingSoon
          ? 'Search with a new identity (coming soon)'
          : 'Search with a new identity',
        emptyDescription:
          'Full privacy protection. Every stealth tab looks like a brand new person. Stealth tabs stay saved when you remove AXON from your recent apps.',
        isComingSoon: comingSoon,
      };
    }
  }
}
