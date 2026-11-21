import { Capacitor } from '@capacitor/core';
import { MockWebUiService } from './mockWebUiService.ts';
import { NativeWebUiService } from './nativeWebUiService.ts';
import { isAndroidBrowserPlatform } from '../axonBrowserPlugin.ts';
import type { WebUiService } from './webUiTypes.ts';

let service: WebUiService | null = null;
let injected: WebUiService | null = null;
let platformOverride: string | null = null;

/**
 * The one place screens get the Web service.
 * Android app: the native browser bridge. Browser preview and every other platform: the in-memory preview.
 * Screens never change; they call getWebUiService().
 */
export function getWebUiService(): WebUiService {
  if (injected) return injected;
  if (!service) {
    const platform = platformOverride ?? Capacitor.getPlatform();
    service = isAndroidBrowserPlatform(platform) ? new NativeWebUiService() : new MockWebUiService();
  }
  return service;
}

/** Test hook: force a platform name ('android', 'web', 'ios') or null to use the real one. */
export function setWebUiPlatformForTesting(platform: string | null): void { platformOverride = platform; service = null; }
/** Test hook: use this service everywhere, or null to go back to platform selection. */
export function setWebUiServiceForTesting(next: WebUiService | null): void { injected = next; service = null; }
