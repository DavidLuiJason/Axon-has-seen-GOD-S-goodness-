import { Capacitor, registerPlugin } from '@capacitor/core';

export type { NativeBrowserState, NativeBrowserTab, BrowserTabGroup, BrowserTabKind, BrowserDefaultMode, BrowserSavedItem, AxonBrowserPlugin } from './browserPluginTypes.ts';
import type { AxonBrowserPlugin } from './browserPluginTypes.ts';

const AxonBrowser = registerPlugin<AxonBrowserPlugin>('AxonBrowser');

/** The current AxonBrowser native plugin is Android-only. Do not report iOS or other
 * native platforms as supported until their native plugin implementations exist. */
export const isAndroidBrowserPlatform = (platform: string): boolean => platform === 'android';
export const isNativeBrowserAvailable = (): boolean => isAndroidBrowserPlatform(Capacitor.getPlatform());
export default AxonBrowser;
