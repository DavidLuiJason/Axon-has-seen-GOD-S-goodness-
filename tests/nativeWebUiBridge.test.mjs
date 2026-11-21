/**
 * Behavioural tests for the real NativeWebUiService implementation.
 * A fake Capacitor plugin stands in for the Android bridge; the production service
 * itself is imported and exercised. These are adapter-level tests, not device tests.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const capacitorPackage = join(root, 'node_modules/@capacitor/core');
const madeStub = !existsSync(join(capacitorPackage, 'package.json'));
if (madeStub) {
  mkdirSync(capacitorPackage, { recursive: true });
  writeFileSync(join(capacitorPackage, 'package.json'), JSON.stringify({
    name: '@capacitor/core', version: '0.0.0-test', type: 'module', exports: './index.js',
  }));
  writeFileSync(join(capacitorPackage, 'index.js'), `
    export const Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true };
    export const registerPlugin = () => ({});
  `);
}

const { NativeWebUiService } = await import('../src/web/ui/nativeWebUiService.ts');
const { isAndroidBrowserPlatform, isNativeBrowserAvailable } = await import('../src/web/axonBrowserPlugin.ts');

function makePlugin(options = {}) {
  const calls = [];
  const state = {
    available: false, tabCount: 0, activeIndex: -1, url: '', title: '', loading: false,
    canGoBack: false, canGoForward: false, engine: 'android-system-webview',
    incognito: false, defaultMode: 'normal', tabs: [], groups: [],
  };
  let startFailures = options.startFailures ?? 0;
  const snapshot = () => ({ ...state, tabs: state.tabs.map((tab) => ({ ...tab })) });
  const active = () => state.tabs.find((tab) => tab.index === state.activeIndex);
  return {
    calls,
    state,
    async getState() {
      calls.push(['getState']);
      if (!state.available || startFailures > 0) {
        if (startFailures > 0) startFailures -= 1;
        throw new Error('AXON Web is not open');
      }
      return snapshot();
    },
    async open({ url } = {}) {
      calls.push(['open', url]);
      if (options.openResult) return options.openResult;
      if (options.openError) throw new Error(options.openError);
      state.available = true;
      if (state.tabs.length === 0) {
        state.tabs.push({ index: 0, url, title: 'Home', groupId: null, kind: 'normal', stealth: false });
        state.activeIndex = 0;
      } else if (url) {
        const tab = active(); tab.url = url;
      }
      state.tabCount = state.tabs.length;
      state.url = active()?.url ?? '';
      return { opened: true, url };
    },
    async newTab({ url = 'https://www.google.com', kind = 'normal', stealth = false } = {}) {
      calls.push(['newTab', { url, kind, stealth }]);
      if (options.newTabError) throw new Error(options.newTabError);
      const index = state.tabs.length;
      state.tabs.push({ index, url, title: 'New tab', groupId: null, kind, stealth });
      state.activeIndex = index; state.tabCount = state.tabs.length;
      state.url = url; state.incognito = kind === 'incognito';
      return snapshot();
    },
    async navigate({ url }) {
      calls.push(['navigate', url]);
      if (options.navigateError) throw new Error(options.navigateError);
      const tab = active(); if (!tab) throw new Error('No active native tab');
      tab.url = url; state.url = url; return snapshot();
    },
    async switchTab({ index }) {
      calls.push(['switchTab', index]);
      if (!state.tabs.some((tab) => tab.index === index)) throw new Error('No such native tab');
      state.activeIndex = index; state.url = active().url; return snapshot();
    },
    async closeTab({ index }) {
      calls.push(['closeTab', index]);
      if (!state.tabs.some((tab) => tab.index === index)) throw new Error('No such native tab');
      state.tabs.splice(index, 1);
      state.tabs.forEach((tab, next) => { tab.index = next; });
      if (state.tabs.length === 0) {
        state.tabs.push({ index: 0, url: 'https://www.google.com', title: 'Home', groupId: null, kind: 'normal', stealth: false });
      }
      state.activeIndex = Math.min(index, state.tabs.length - 1);
      state.tabCount = state.tabs.length; state.url = active().url;
      return snapshot();
    },
    async back() { calls.push(['back']); return snapshot(); },
    async forward() { calls.push(['forward']); return snapshot(); },
    async reload() { calls.push(['reload']); return snapshot(); },
    async stop() { calls.push(['stop']); return snapshot(); },
  };
}

let platformModule;
before(async () => {
  platformModule = await import('../src/web/axonBrowserPlugin.ts');
});
after(async () => {
  if (madeStub) {
    rmSync(capacitorPackage, { recursive: true, force: true });
    const parent = dirname(capacitorPackage);
    if (existsSync(parent) && (await import('node:fs')).readdirSync(parent).length === 0) rmSync(parent, { recursive: true, force: true });
  }
});

describe('NativeWebUiService uses the production adapter', () => {
  it('opens the native host, creates a native normal tab, and navigates the mapped tab', async () => {
    const plugin = makePlugin();
    const service = new NativeWebUiService(plugin);
    const created = await service.newTab('normal');
    assert.equal(created.ok, true);
    const searched = await service.search('example.com/path');
    assert.equal(searched.ok, true);
    assert.ok(plugin.calls.some(([name, url]) => name === 'navigate' && url === 'https://example.com/path'));
    assert.equal(plugin.calls.filter(([name]) => name === 'newTab').length, 1);
    assert.equal(service.getState().tabs.find((tab) => tab.id === service.getState().activeTabId)?.url, 'https://example.com/path');
  });

  it('waits for BrowserActivity readiness after startActivity returns', async () => {
    const plugin = makePlugin({ startFailures: 2 });
    const service = new NativeWebUiService(plugin);
    const created = await service.newTab('normal');
    assert.equal(created.ok, true);
    assert.ok(plugin.calls.filter(([name]) => name === 'getState').length >= 3);
  });

  it('routes incognito and stealth through distinct native profile options', async () => {
    for (const [kind, expected] of [
      ['incognito', { kind: 'incognito', stealth: false }],
      ['stealth', { kind: 'normal', stealth: true }],
    ]) {
      const plugin = makePlugin();
      const service = new NativeWebUiService(plugin);
      const created = await service.newTab(kind);
      assert.equal(created.ok, true);
      const request = plugin.calls.find(([name]) => name === 'newTab')?.[1];
      assert.equal(request.kind, expected.kind);
      assert.equal(request.stealth, expected.stealth);
      await service.search('private.example');
      assert.equal(plugin.calls.filter(([name]) => name === 'newTab').length, 1,
        'searching again in the same private tab must navigate it, not create a new native tab');
      assert.ok(plugin.calls.some(([name, url]) => name === 'navigate' && url === 'https://private.example/'));
    }
  });

  it('does not create a local private tab when native MULTI_PROFILE creation fails', async () => {
    const plugin = makePlugin({ newTabError: 'MULTI_PROFILE unavailable' });
    const service = new NativeWebUiService(plugin);
    const result = await service.newTab('incognito');
    assert.equal(result.ok, false);
    assert.equal(service.getState().tabs.length, 0);
  });

  it('switches and closes the matching native tab before changing local state', async () => {
    const plugin = makePlugin();
    const service = new NativeWebUiService(plugin);
    const first = await service.newTab('normal');
    const second = await service.newTab('normal');
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal((await service.switchTab(first.value.tabId)).ok, true);
    assert.ok(plugin.calls.some(([name, index]) => name === 'switchTab' && index === 1));
    assert.equal((await service.closeTab(second.value.tabId)).ok, true);
    assert.ok(plugin.calls.some(([name, index]) => name === 'closeTab' && index === 2));
    assert.equal(service.getState().tabs.some((tab) => tab.id === second.value.tabId), false);
  });

  it('adopts the native URL, title and navigation flags after browser controls', async () => {
    const plugin = makePlugin();
    const service = new NativeWebUiService(plugin);
    const created = await service.newTab('normal');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const tabId = created.value.tabId;
    plugin.state.url = 'https://previous.example/';
    plugin.state.title = 'Previous page';
    plugin.state.canGoBack = false;
    plugin.state.canGoForward = true;
    const active = plugin.state.tabs.find((tab) => tab.index === plugin.state.activeIndex);
    active.url = plugin.state.url;
    active.title = plugin.state.title;
    const result = await service.goBack();
    assert.equal(result.ok, true);
    const tab = service.getState().tabs.find((item) => item.id === tabId);
    assert.equal(tab.url, 'https://previous.example/');
    assert.equal(tab.title, 'Previous page');
    assert.equal(tab.canGoBack, false);
    assert.equal(tab.canGoForward, true);
  });

  it('does not report successful open when the native plugin confirms a different URL', async () => {
    const plugin = makePlugin({ openResult: { opened: true, url: 'https://wrong.example/' } });
    const service = new NativeWebUiService(plugin);
    const result = await service.newTab('normal');
    assert.equal(result.ok, false);
    assert.equal(service.getState().tabs.length, 0);
  });
});

describe('Android-only native platform declaration', () => {
  it('reports support only on Android', () => {
    assert.equal(isAndroidBrowserPlatform('android'), true);
    assert.equal(isAndroidBrowserPlatform('ios'), false);
    assert.equal(isAndroidBrowserPlatform('web'), false);
    assert.equal(isNativeBrowserAvailable(), true, 'test Capacitor stub reports Android');
  });
});
