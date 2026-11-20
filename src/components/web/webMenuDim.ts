/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WEB_FEATURES } from '../../web/ui/webFeatureFlags';
import type { WebResult, WebTabKind } from '../../web/ui/webUiTypes';

export type WebMenuEngineItem =
  | 'back'
  | 'forward'
  | 'refresh'
  | 'bookmark'
  | 'download'
  | 'history'
  | 'bookmarks'
  | 'downloads'
  | 'clearData'
  | 'find'
  | 'translate'
  | 'reader'
  | 'desktop'
  | 'siteControls'
  | 'share';

export type WebMenuDimCache = Readonly<Record<string, boolean>>;

export function dimCacheKey(kind: WebTabKind, item: WebMenuEngineItem): string {
  return `${kind}:${item}`;
}

export function isKindFeatureDisabled(kind: WebTabKind): boolean {
  if (kind === 'normal') return false;
  return !WEB_FEATURES[kind];
}

/**
 * Resolve whether an engine/page menu item should paint dimmed for `kind`:
 * - Uses the cached result from a real service call for `(kind, item)` while the menu is open.
 * - Falls back to `!WEB_FEATURES[kind]` for the first paint so flipping a flag removes dimming with zero UI edits.
 */
export function resolveMenuItemDimmed(
  cache: WebMenuDimCache,
  kind: WebTabKind | null,
  item: WebMenuEngineItem
): boolean {
  if (!kind) return false;
  const key = dimCacheKey(kind, item);
  if (Object.prototype.hasOwnProperty.call(cache, key)) {
    return Boolean(cache[key]);
  }
  return isKindFeatureDisabled(kind);
}

export function isComingSoonResult<T>(result: WebResult<T>): boolean {
  return !result.ok && result.reason === 'coming-soon';
}
