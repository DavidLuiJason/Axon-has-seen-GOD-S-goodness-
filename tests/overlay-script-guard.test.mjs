// D321 guard: the Android overlay script must keep every line that the overlay needs. Several Directors edit
// scripts/apply-android-overlay.sh, and a whole older copy of it silently dropped lines three times (screen structure,
// WebKit). The cloud only noticed after ten minutes, in the Java compile. This test fails in a second, naming the line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const script = read('scripts/apply-android-overlay.sh');
const overlayMain = join(root, 'android-overlay/app/src/main');

test('the script installs the approved WebKit dependency (Multi-Profile API used by BrowserActivity)', () => {
  assert.ok(script.includes('androidx.webkit:webkit:1.12.1'), 'scripts/apply-android-overlay.sh lost the androidx.webkit:webkit:1.12.1 dependency block; BrowserActivity will not compile');
});

test('every overlay Java file and resource file is named in the script (so it is copied into the build)', () => {
  const files = [...walk(join(overlayMain, 'java')), ...walk(join(overlayMain, 'res'))];
  assert.ok(files.length >= 10, 'the overlay folder is found');
  const missing = files.map((f) => f.split('/').pop()).filter((name) => !script.includes(name));
  assert.deepEqual(missing, [], `scripts/apply-android-overlay.sh never copies: ${missing.join(', ')}`);
});

test('every class MainActivity imports from com.axon.app exists in the overlay', () => {
  const main = read('android-overlay/app/src/main/java/com/axon/app/MainActivity.java');
  const imports = [...main.matchAll(/^import com\.axon\.app\.([a-z]+)\.([A-Za-z]+);/gm)];
  assert.ok(imports.length >= 4, 'MainActivity imports the plugins');
  for (const [, pkg, cls] of imports) {
    assert.ok(existsSync(join(overlayMain, `java/com/axon/app/${pkg}/${cls}.java`)), `MainActivity imports com.axon.app.${pkg}.${cls} but android-overlay has no such file`);
  }
});

test('the ML Kit dependency is installed when the picture text reader exists', () => {
  if (existsSync(join(overlayMain, 'java/com/axon/app/screenstructure/PictureTextReader.java'))) {
    assert.ok(script.includes('com.google.mlkit:text-recognition'), 'the script lost the ML Kit text-recognition dependency');
  }
});

test('the script keeps the Gradle 429 protection (retry settings and the Maven Central mirror), builds #30 and #32', () => {
  assert.ok(script.includes('AXON_GRADLE_RETRY') && script.includes('org.gradle.internal.repository.max.retries'), 'scripts/apply-android-overlay.sh lost the Gradle download retry settings; a Maven Central HTTP 429 will fail the build again');
  assert.ok(script.includes('AXON_CENTRAL_MIRROR') && script.includes('maven-central.storage-download.googleapis.com'), 'scripts/apply-android-overlay.sh lost the Maven Central mirror line');
});
