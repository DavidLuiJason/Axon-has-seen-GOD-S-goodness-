import AxonBrowser, { isNativeBrowserAvailable } from '../axonBrowserPlugin.ts';
import type { AxonBrowserPlugin, NativeBrowserState } from '../browserPluginTypes.ts';
import { MockWebUiService } from './mockWebUiService.ts';
import type { WebResult, WebTabKind } from './webUiTypes.ts';
import { invalidNativeNavigation, resolveNativeNavigationTarget } from './nativeNavigation.ts';

const NATIVE_HOME = 'https://www.google.com';
const ACTIVITY_START_ATTEMPTS = 30;
const ACTIVITY_START_DELAY_MS = 50;

/**
 * Android production bridge for the owner-facing Web screen.
 *
 * The Android host is still a dedicated BrowserActivity rather than an embedded WebView.
 * This adapter synchronizes the operations it owns (open/search/new/switch/close/back/
 * forward/reload/stop) with that Activity. The React model remains a limited preview model;
 * browser events caused outside this adapter and the wider bookmarks/history/downloads UI
 * are not yet fully synchronized. Those limitations are deliberately reported rather than
 * represented as complete browser integration.
 */
export class NativeWebUiService extends MockWebUiService {
  private readonly plugin: AxonBrowserPlugin;
  private nativeActivityOpen = false;
  /** Index of the Activity's own first normal tab, set only right after THIS service started the Activity. */
  private bootstrapIndex: number | null = null;
  /** Maps this service's stable local tab IDs to the native Activity's current tab indexes. */
  private readonly nativeIndexes = new Map<string, number>();

  constructor(plugin: AxonBrowserPlugin = AxonBrowser) {
    super();
    this.plugin = plugin;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private assertState(value: NativeBrowserState | null | undefined): NativeBrowserState {
    if (!value || value.available !== true || !Array.isArray(value.tabs) || !Number.isInteger(value.activeIndex)) {
      throw new Error('The native browser did not return a valid browser state.');
    }
    return value;
  }

  /**
   * Query the Activity instead of trusting a JS boolean that can become stale when Android
   * destroys or recreates the Activity while the app is in the background.
   */
  private async readNativeState(): Promise<NativeBrowserState> {
    return this.assertState(await this.plugin.getState());
  }

  private async ensureOpen(): Promise<{ ok: true; state: NativeBrowserState } | { ok: false; message: string }> {
    try {
      // First check the actual native host. This also recovers when the Activity was already
      // opened by the native browser UI before this service instance was created.
      try {
        const existing = await this.readNativeState();
        this.nativeActivityOpen = true;
        this.bootstrapIndex = null;
        return { ok: true, state: existing };
      } catch {
        this.nativeActivityOpen = false;
      }

      const opened = await this.plugin.open({ url: NATIVE_HOME });
      if (!opened || opened.opened !== true || opened.url !== NATIVE_HOME) {
        return { ok: false, message: 'The native browser did not confirm that it opened the requested home URL.' };
      }

      const createdNow = opened.activityCreated === true;

      // BrowserPlugin.open resolves after startActivity(), which can happen before onCreate()
      // has assigned BrowserActivity.instance. Wait for the actual plugin host before issuing
      // a subsequent native tab/control operation; do not race newTab() against Activity startup.
      let lastError: unknown;
      for (let attempt = 0; attempt < ACTIVITY_START_ATTEMPTS; attempt += 1) {
        try {
          const state = await this.readNativeState();
          this.nativeActivityOpen = true;
          // A freshly created Activity holds exactly one normal tab of its own (D204/R4 fix:
          // adopt it for the first normal UI tab instead of creating a duplicate).
          const only = state.tabs.length === 1 ? state.tabs[0] : null;
          this.bootstrapIndex = createdNow && only && only.kind === 'normal' && only.stealth === false ? only.index : null;
          return { ok: true, state };
        } catch (error) {
          lastError = error;
          await this.delay(ACTIVITY_START_DELAY_MS);
        }
      }
      throw new Error(`AXON Web Activity did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'no state returned')}`);
    } catch (error) {
      this.nativeActivityOpen = false;
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private fail(message: string): WebResult {
    return { ok: false, reason: 'failed', message };
  }

  private notAvailable(message: string): WebResult {
    return { ok: false, reason: 'not-available', message };
  }

  private nativeKind(kind: WebTabKind): { kind: 'normal' | 'incognito'; stealth: boolean } {
    // Owner decision (NAP N20): Stealth is a SAVED separate identity per tab, Incognito disappears.
    // So Stealth is a normal tab with the stealth flag; it must never become an incognito tab.
    return kind === 'stealth'
      ? { kind: 'normal', stealth: true }
      : { kind, stealth: false };
  }

  private nativeTabIndex(state: NativeBrowserState, kind: WebTabKind): number {
    const index = state.activeIndex;
    const nativeTab = state.tabs.find((item) => item.index === index);
    if (!nativeTab) throw new Error('The native browser did not identify its active tab.');
    const expected = this.nativeKind(kind);
    if (nativeTab.kind !== expected.kind || nativeTab.stealth !== expected.stealth) {
      throw new Error(`Native browser created the wrong tab profile for ${kind}.`);
    }
    return index;
  }

  private async ensureAndRead(): Promise<{ ok: true; state: NativeBrowserState } | { ok: false; message: string }> {
    // Always re-check the native Activity. A cached JS flag is not proof that Android
    // has kept the Activity alive through backgrounding or process recreation.
    return this.ensureOpen();
  }

  private verifyActiveTab(state: NativeBrowserState, index: number): void {
    if (state.activeIndex !== index || !state.tabs.some((tab) => tab.index === index)) {
      throw new Error('The native browser did not confirm the requested tab as active.');
    }
  }

  override async search(text: string): Promise<WebResult> {
    const state = this.getState();
    const tab = state.tabs.find((item) => item.id === state.activeTabId);
    if (!tab) return this.notAvailable('Open a tab before navigating.');

    const target = resolveNativeNavigationTarget(text);
    if (!target.ok) return invalidNativeNavigation(target);
    const url = target.url;

    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return this.fail(ensured.message);

      const knownIndex = this.nativeIndexes.get(tab.id);
      let native: NativeBrowserState;
      if (knownIndex !== undefined) {
        const selected = this.assertState(await this.plugin.switchTab({ index: knownIndex }));
        this.verifyActiveTab(selected, knownIndex);
        native = this.assertState(await this.plugin.navigate({ url }));
        this.verifyActiveTab(native, knownIndex);
      } else {
        // A local tab without a native mapping must be created as a native tab of the same
        // profile. Never route a private tab through the normal profile.
        native = this.assertState(await this.plugin.newTab({ url, ...this.nativeKind(tab.kind) }));
        const index = this.nativeTabIndex(native, tab.kind);
        this.nativeIndexes.set(tab.id, index);
      }

      // Record the accepted URL in the local model, then adopt the authoritative native
      // title/loading/navigation flags returned by BrowserActivity.
      const recorded = this.recordSuccessfulNavigation(tab.id, url);
      if (!recorded.ok) return recorded;
      const active = native.tabs.find((item) => item.index === native.activeIndex);
      if (!active) throw new Error('The native browser did not return its active tab after navigation.');
      return this.syncNativeTabState(tab.id, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('MULTI_PROFILE') || msg.includes('multi-profile') || msg.includes('Incognito and stealth')) {
        return this.notAvailable(
          'Incognito/Stealth isolation requires Android System WebView MULTI_PROFILE support on this device. ' +
            'No shared-cookie fallback is allowed. ' + msg
        );
      }
      this.nativeActivityOpen = false;
      return this.fail(msg);
    }
  }

  override async newTab(kind: WebTabKind): Promise<WebResult<{ tabId: string }>> {
    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return { ok: false, reason: 'failed', message: ensured.message };

      const adopt = kind === 'normal' && this.bootstrapIndex !== null && ensured.state.tabs.length === 1;
      const adoptedIndex = adopt ? this.bootstrapIndex : null;
      this.bootstrapIndex = null;
      const native = adoptedIndex !== null
        ? ensured.state
        : this.assertState(await this.plugin.newTab({ url: NATIVE_HOME, ...this.nativeKind(kind) }));
      const nativeIndex = adoptedIndex !== null ? adoptedIndex : this.nativeTabIndex(native, kind);
      const local = await super.newTab(kind);
      if (!local.ok) {
        // Roll back the native tab only if this call created it; an adopted bootstrap tab stays.
        if (adoptedIndex === null) await this.plugin.closeTab({ index: nativeIndex });
        return local;
      }
      this.nativeIndexes.set(local.value.tabId, nativeIndex);
      const active = native.tabs.find((item) => item.index === nativeIndex);
      if (active) this.syncNativeTabState(local.value.tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
      return local;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('MULTI_PROFILE') || msg.includes('multi-profile') || msg.includes('Incognito and stealth')) {
        return {
          ok: false,
          reason: 'not-available',
          message: 'Native Incognito/Stealth tabs require Android System WebView MULTI_PROFILE. No shared-cookie fallback is allowed. ' + msg,
        };
      }
      this.nativeActivityOpen = false;
      return { ok: false, reason: 'failed', message: msg };
    }
  }

  override async switchTab(tabId: string): Promise<WebResult> {
    const index = this.nativeIndexes.get(tabId);
    if (index === undefined) return this.notAvailable('This tab has no verified native browser mapping.');
    try {
      const native = this.assertState(await this.plugin.switchTab({ index }));
      this.verifyActiveTab(native, index);
      const local = await super.switchTab(tabId);
      if (!local.ok) return local;
      const active = native.tabs.find((item) => item.index === index);
      if (active) return this.syncNativeTabState(tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
      return local;
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  override async closeTab(tabId: string): Promise<WebResult> {
    const index = this.nativeIndexes.get(tabId);
    if (index === undefined) return this.notAvailable('This tab has no verified native browser mapping; it was not closed locally.');
    try {
      const native = this.assertState(await this.plugin.closeTab({ index }));
      this.nativeIndexes.delete(tabId);
      // Native indexes compact after close. Shift our remaining mappings to match.
      for (const [id, current] of this.nativeIndexes) {
        if (current > index) this.nativeIndexes.set(id, current - 1);
      }
      const local = await super.closeTab(tabId);
      if (local.ok && this.getState().tabs.length === 0 && native.tabs.length > 0) {
        // BrowserActivity deliberately keeps one native tab alive. Mirror that replacement
        // tab so the owner UI does not claim that the native tab list is empty.
        const replacement = await super.newTab('normal');
        if (replacement.ok) this.nativeIndexes.set(replacement.value.tabId, native.activeIndex);
      }
      return local;
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  override async goBack(): Promise<WebResult> {
    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return this.fail(ensured.message);
      const before = this.getState();
      const tabId = before.activeTabId;
      if (!tabId) return this.notAvailable('No active tab is open.');
      const native = this.assertState(await this.plugin.back());
      const active = native.tabs.find((item) => item.index === native.activeIndex);
      if (!active) throw new Error('The native browser did not return its active tab.');
      return this.syncNativeTabState(tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  override async goForward(): Promise<WebResult> {
    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return this.fail(ensured.message);
      const before = this.getState();
      const tabId = before.activeTabId;
      if (!tabId) return this.notAvailable('No active tab is open.');
      const native = this.assertState(await this.plugin.forward());
      const active = native.tabs.find((item) => item.index === native.activeIndex);
      if (!active) throw new Error('The native browser did not return its active tab.');
      return this.syncNativeTabState(tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  override async reload(): Promise<WebResult> {
    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return this.fail(ensured.message);
      const tabId = this.getState().activeTabId;
      if (!tabId) return this.notAvailable('No active tab is open.');
      const native = this.assertState(await this.plugin.reload());
      const active = native.tabs.find((item) => item.index === native.activeIndex);
      if (!active) throw new Error('The native browser did not return its active tab after reload.');
      return this.syncNativeTabState(tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  override async stop(): Promise<WebResult> {
    try {
      const ensured = await this.ensureAndRead();
      if (!ensured.ok) return this.fail(ensured.message);
      const tabId = this.getState().activeTabId;
      if (!tabId) return this.notAvailable('No active tab is open.');
      const native = this.assertState(await this.plugin.stop());
      const active = native.tabs.find((item) => item.index === native.activeIndex);
      if (!active) throw new Error('The native browser did not return its active tab after stop.');
      return this.syncNativeTabState(tabId, {
        url: active.url, title: active.title, loading: native.loading,
        canGoBack: native.canGoBack, canGoForward: native.canGoForward,
      });
    } catch (error) {
      this.nativeActivityOpen = false;
      return this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  static isSupported(): boolean {
    return isNativeBrowserAvailable();
  }
}
