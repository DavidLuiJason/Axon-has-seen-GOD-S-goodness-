import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// Native address normalization tests run against the pure production resolver.
const { resolveNativeNavigationTarget } = await import('../src/web/ui/nativeNavigation.ts');
const addressCases = [
  ['https URL', 'https://example.com', 'https://example.com/'],
  ['http URL', 'http://example.com', 'http://example.com/'],
  ['uppercase scheme', 'HTTPS://EXAMPLE.COM/path', 'https://example.com/path'],
  ['host only', 'example.com', 'https://example.com/'],
  ['host with port', 'example.com:8443', 'https://example.com:8443/'],
  ['host path', 'example.com/path', 'https://example.com/path'],
  ['host query', 'example.com?q=1', 'https://example.com/?q=1'],
  ['host hash', 'example.com#section', 'https://example.com/#section'],
  ['search phrase', 'hello world', 'https://www.google.com/search?q=hello%20world'],
  ['search plus sign', 'C++ browser', 'https://www.google.com/search?q=C%2B%2B%20browser'],
  ['search ampersand', 'cats & dogs', 'https://www.google.com/search?q=cats%20%26%20dogs'],
  ['search unicode', 'café', 'https://www.google.com/search?q=caf%C3%A9'],
  ['search slash', 'what is 2/3', 'https://www.google.com/search?q=what%20is%202%2F3'],
  ['search colon phrase', 'price: phone', 'https://www.google.com/search?q=price%3A%20phone'],
  ['localhost is search text under host heuristic', 'localhost', 'https://www.google.com/search?q=localhost'],
  ['IP address with port', '127.0.0.1:8080', 'https://127.0.0.1:8080/'],
];
for (const [label, input, expected] of addressCases) {
  test(`native navigation target resolves correctly: ${label}`, () => {
    const result = resolveNativeNavigationTarget(input);
    assert.equal(result.ok, true);
    assert.equal(result.url, expected);
  });
}
const rejectedAddresses = [
  ['empty', ''], ['spaces', '   '], ['javascript scheme', 'javascript:alert(1)'],
  ['data scheme', 'data:text/html,evil'], ['file scheme', 'file:///etc/passwd'],
  ['intent scheme', 'intent://evil'], ['content scheme', 'content://private/item'],
  ['ftp scheme', 'ftp://example.com/file'], ['mailto scheme', 'mailto:test@example.com'],
  ['invalid HTTP URL', 'https://'], ['credentials in URL', 'https://user:password@example.com'],
  ['malformed dotted address', 'example..com'],
];
for (const [label, input] of rejectedAddresses) {
  test(`native navigation refuses unsafe or invalid target: ${label}`, () => {
    const result = resolveNativeNavigationTarget(input);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid');
  });
}

// In an extracted source package, the Capacitor runtime package may not be installed.
// This test-only stub enables direct execution of the real TypeScript bridge under Node's
// type-strip mode. It is never included in the source or Director ZIPs.
const capacitorPackage = path.join(root, 'node_modules/@capacitor/core');
const createdCapacitorStub = !fs.existsSync(path.join(capacitorPackage, 'package.json'));
if (createdCapacitorStub) {
  fs.mkdirSync(capacitorPackage, { recursive: true });
  fs.writeFileSync(path.join(capacitorPackage, 'package.json'), JSON.stringify({ name: '@capacitor/core', version: '0.0.0-test', type: 'module', exports: './index.js' }));
  fs.writeFileSync(path.join(capacitorPackage, 'index.js'), `
    export const Capacitor = {
      getPlatform() { return 'web'; },
      isNativePlatform() { return false; }
    };
    export function registerPlugin() {
      return { open: async () => ({ opened: false, url: '' }) };
    }
  `);
}
const { NativeWebUiService } = await import('../src/web/ui/nativeWebUiService.ts');
const { isAndroidBrowserPlatform } = await import('../src/web/axonBrowserPlugin.ts');

async function makeNativeService(kind = 'normal', options = {}) {
  const calls = [];
  const state = { available: false, tabCount: 0, activeIndex: -1, url: '', title: '', loading: false,
    canGoBack: false, canGoForward: false, engine: 'android-system-webview', incognito: false,
    defaultMode: 'normal', tabs: [], groups: [] };
  const active = () => state.tabs.find((t) => t.index === state.activeIndex);
  const snapshot = () => ({ ...state, tabs: state.tabs.map((t) => ({ ...t })) });
  const plugin = {
    async getState() { calls.push({ method: 'getState' }); if (!state.available) throw new Error('AXON Web is not open'); return snapshot(); },
    async open(input) {
      calls.push({ method: 'open', ...input });
      const response = options.openImpl ? await options.openImpl(input) : { opened: true, url: input.url };
      if (response.opened) {
        state.available = true;
        if (state.tabs.length === 0) state.tabs.push({ index: 0, url: input.url, title: 'Home', groupId: null, kind: 'normal', stealth: false });
        state.activeIndex = Math.max(0, state.tabs.length - 1); state.tabCount = state.tabs.length; state.url = active()?.url ?? '';
      }
      return response;
    },
    async newTab(input = {}) {
      calls.push({ method: 'newTab', ...input });
      if (options.newTabError) throw new Error(options.newTabError);
      const index = state.tabs.length;
      state.tabs.push({ index, url: input.url ?? 'https://www.google.com', title: 'New tab', groupId: null, kind: input.kind ?? 'normal', stealth: input.stealth ?? false });
      state.activeIndex = index; state.tabCount = state.tabs.length; state.url = active().url;
      return snapshot();
    },
    async navigate(input) { calls.push({ method: 'navigate', ...input }); if (options.navigateError) throw new Error(options.navigateError); active().url = input.url; state.url = input.url; return snapshot(); },
    async switchTab({ index }) { calls.push({ method: 'switchTab', index }); state.activeIndex = index; state.url = active().url; return snapshot(); },
    async closeTab({ index }) { calls.push({ method: 'closeTab', index }); state.tabs.splice(index, 1); state.tabs.forEach((t, i) => { t.index = i; }); if (!state.tabs.length) state.tabs.push({ index: 0, url: 'https://www.google.com', title: 'Home', groupId: null, kind: 'normal', stealth: false }); state.activeIndex = Math.min(index, state.tabs.length - 1); state.tabCount = state.tabs.length; state.url = active().url; return snapshot(); },
    async back() { calls.push({ method: 'back' }); return snapshot(); },
    async forward() { calls.push({ method: 'forward' }); return snapshot(); },
    async reload() { calls.push({ method: 'reload' }); return snapshot(); },
    async stop() { calls.push({ method: 'stop' }); return snapshot(); },
  };
  const service = new NativeWebUiService(plugin);
  const created = await service.newTab(kind);
  return { service, calls, plugin, created };
}

test('native service opens the native Activity and navigates the mapped tab', async () => {
  const { service, calls, created } = await makeNativeService();
  assert.equal(created.ok, true);
  const result = await service.search('example.com/path');
  assert.equal(result.ok, true);
  assert.ok(calls.some((c) => c.method === 'navigate' && c.url === 'https://example.com/path'));
  const tab = service.getState().tabs.find((item) => item.id === service.getState().activeTabId);
  assert.equal(tab.url, 'https://example.com/path');
  assert.equal(tab.title, 'example.com');
});

test('native service sends encoded search queries to the native browser', async () => {
  const { service, calls, created } = await makeNativeService();
  assert.equal(created.ok, true);
  const result = await service.search('AXON browser tests');
  assert.equal(result.ok, true);
  assert.ok(calls.some((c) => c.method === 'navigate' && c.url === 'https://www.google.com/search?q=AXON%20browser%20tests'));
});

test('native service refuses non-HTTP schemes without issuing navigation', async () => {
  const { service, calls, created } = await makeNativeService();
  assert.equal(created.ok, true);
  const before = calls.length;
  const result = await service.search('javascript:alert(1)');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid');
  assert.equal(calls.length, before);
});

test('native service refuses an empty address without issuing navigation', async () => {
  const { service, calls, created } = await makeNativeService();
  assert.equal(created.ok, true);
  const before = calls.length;
  const result = await service.search('  ');
  assert.equal(result.ok, false);
  assert.equal(calls.length, before);
});

test('native service refuses navigation when no local tab is open', async () => {
  const calls = [];
  const service = new NativeWebUiService({ getState: async () => { calls.push('getState'); throw new Error('closed'); }, open: async () => { calls.push('open'); return { opened: true, url: 'https://www.google.com' }; } });
  const result = await service.search('example.com');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-available');
  assert.deepEqual(calls, []);
});

test('native service routes Incognito and Stealth to their separate native profile flags', async () => {
  for (const [kind, expectedKind, stealth] of [['incognito', 'incognito', false], ['stealth', 'normal', true]]) {
    const { service, calls, created } = await makeNativeService(kind);
    assert.equal(created.ok, true);
    const result = await service.search('example.com');
    assert.equal(result.ok, true);
    assert.ok(calls.some((c) => c.method === 'newTab' && c.kind === expectedKind && c.stealth === stealth));
  }
});

test('native service does not create a local tab when native MULTI_PROFILE creation fails', async () => {
  const { service, created } = await makeNativeService('incognito', { newTabError: 'MULTI_PROFILE unavailable' });
  assert.equal(created.ok, false);
  assert.equal(service.getState().tabs.length, 0);
});

test('native service does not report success when Android returns opened=false', async () => {
  const { service, created } = await makeNativeService('normal', { openImpl: async (input) => ({ opened: false, url: input.url }) });
  assert.equal(created.ok, false);
  assert.equal(service.getState().tabs.length, 0);
});

test('native service reports native navigation exceptions without changing preview URL', async () => {
  const { service, created } = await makeNativeService('normal', { navigateError: 'activity unavailable' });
  assert.equal(created.ok, true);
  const result = await service.search('example.com');
  assert.equal(result.ok, false);
  assert.match(result.message, /activity unavailable/);
  const tab = service.getState().tabs.find((item) => item.id === service.getState().activeTabId);
  assert.equal(tab.url, 'https://www.google.com');
});

test('native service rejects a mismatched native open response URL', async () => {
  const { service, created } = await makeNativeService('normal', { openImpl: async () => ({ opened: true, url: 'https://unexpected.test/' }) });
  assert.equal(created.ok, false);
  assert.equal(service.getState().tabs.length, 0);
});

test('native close and switch commands are sent to the corresponding native tab indexes', async () => {
  const { service, calls, created } = await makeNativeService();
  assert.equal(created.ok, true);
  const second = await service.newTab('normal');
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const firstId = service.getState().tabs[0].id;
  assert.equal((await service.switchTab(firstId)).ok, true);
  assert.ok(calls.some((c) => c.method === 'switchTab' && c.index === 1));
  assert.equal((await service.closeTab(second.value.tabId)).ok, true);
  assert.ok(calls.some((c) => c.method === 'closeTab' && c.index === 2));
});

test('Android browser availability is platform-specific', async () => {
  assert.equal(isAndroidBrowserPlatform('android'), true);
  assert.equal(isAndroidBrowserPlatform('web'), false);
  assert.equal(isAndroidBrowserPlatform('ios'), false);
});

const webUiModule = await import('../src/web/ui/webUiService.ts');
const { MockWebUiService } = await import('../src/web/ui/mockWebUiService.ts');
if (createdCapacitorStub) {
  fs.rmSync(capacitorPackage, { recursive: true, force: true });
  const capacitorParent = path.dirname(capacitorPackage);
  if (fs.existsSync(capacitorParent) && fs.readdirSync(capacitorParent).length === 0) fs.rmdirSync(capacitorParent);
}
test('Android platform selects the native browser adapter', () => {
  webUiModule.setWebUiPlatformForTesting('android');
  assert.equal(webUiModule.getWebUiService() instanceof NativeWebUiService, true);
  webUiModule.setWebUiPlatformForTesting(null);
});
test('browser preview platform selects the deterministic mock adapter', () => {
  webUiModule.setWebUiPlatformForTesting('web');
  assert.equal(webUiModule.getWebUiService() instanceof MockWebUiService, true);
  assert.equal(webUiModule.getWebUiService() instanceof NativeWebUiService, false);
  webUiModule.setWebUiPlatformForTesting(null);
});
test('service test injection overrides platform selection and can reset cleanly', () => {
  const injected = new MockWebUiService();
  webUiModule.setWebUiPlatformForTesting('android');
  webUiModule.setWebUiServiceForTesting(injected);
  assert.equal(webUiModule.getWebUiService(), injected);
  webUiModule.setWebUiServiceForTesting(null);
  assert.equal(webUiModule.getWebUiService() instanceof NativeWebUiService, true);
  webUiModule.setWebUiPlatformForTesting(null);
});
test('native browser platform selection does not claim support on iOS', () => {
  webUiModule.setWebUiPlatformForTesting('ios');
  assert.equal(webUiModule.getWebUiService() instanceof NativeWebUiService, false);
});


