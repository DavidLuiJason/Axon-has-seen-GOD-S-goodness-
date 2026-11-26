#!/usr/bin/env bash
# Apply AXON Stage 6.1 android-overlay after `npx cap add android`.
# Safe to run twice (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OVERLAY="$ROOT/android-overlay"
ANDROID="$ROOT/android"

if [[ ! -d "$ANDROID/app" ]]; then
  echo "ERROR: android/ not found. Run: npx cap add android"
  exit 1
fi

echo "==> Copying Java sources (background jobs, file saver, screen capture, browser, apps, screen structure, MainActivity)"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/background"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/filesaver"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/screencapture"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/browser"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/apps"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/screenstructure"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/filesaver/FileSaverPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/filesaver/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screencapture/ScreenCapturePlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screencapture/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screencapture/ScreenCaptureService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screencapture/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/browser/BrowserPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/browser/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/browser/BrowserActivity.java" \
      "$ANDROID/app/src/main/java/com/axon/app/browser/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/apps/AppsPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/apps/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screenstructure/AxonAccessibilityService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screenstructure/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screenstructure/ScreenStructurePlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screenstructure/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screenstructure/PictureTextReader.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screenstructure/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/MainActivity.java" \
      "$ANDROID/app/src/main/java/com/axon/app/"

# AXON page agent script (read by the native browser from the app assets).
mkdir -p "$ANDROID/app/src/main/assets"
cp -f "$OVERLAY/app/src/main/assets/axon_page_agent.js" \
      "$ANDROID/app/src/main/assets/"
cp -f "$OVERLAY/app/src/main/assets/axon_page_tools.js" \
      "$ANDROID/app/src/main/assets/"

# Ensure AndroidX WebKit Multi-Profile API dependency is present exactly once.
GRADLE="$ANDROID/app/build.gradle"
if [[ -f "$GRADLE" ]]; then
  if ! grep -Eq "androidx\.webkit:webkit:[0-9.]+" "$GRADLE"; then
    if grep -q '^dependencies[[:space:]]*{' "$GRADLE"; then
      sed -i '/^dependencies[[:space:]]*{/a\    implementation "androidx.webkit:webkit:1.12.1"' "$GRADLE"
    else
      printf '\ndependencies {\n    implementation "androidx.webkit:webkit:1.12.1"\n}\n' >> "$GRADLE"
    fi
  fi
  COUNT=$(grep -Ec 'androidx\.webkit:webkit:' "$GRADLE" || true)
  if [[ "$COUNT" -ne 1 ]]; then
    echo "ERROR: expected exactly one androidx.webkit:webkit dependency, found $COUNT"
    exit 1
  fi
else
  echo "ERROR: $GRADLE missing; cannot install the approved WebKit dependency"
  exit 1
fi

# Ensure the ML Kit on-device text recognition (Latin) dependency is present exactly once (PictureTextReader).
if ! grep -Eq "com\.google\.mlkit:text-recognition:[0-9.]+" "$GRADLE"; then
  if grep -q '^dependencies[[:space:]]*{' "$GRADLE"; then
    sed -i '/^dependencies[[:space:]]*{/a\    implementation "com.google.mlkit:text-recognition:16.0.1"' "$GRADLE"
  else
    printf '\ndependencies {\n    implementation "com.google.mlkit:text-recognition:16.0.1"\n}\n' >> "$GRADLE"
  fi
fi
MLCOUNT=$(grep -Ec 'com\.google\.mlkit:text-recognition:' "$GRADLE" || true)
if [[ "$MLCOUNT" -ne 1 ]]; then
  echo "ERROR: expected exactly one com.google.mlkit:text-recognition dependency, found $MLCOUNT"
  exit 1
fi

echo "==> Copying notification icon"
mkdir -p "$ANDROID/app/src/main/res/drawable"
cp -f "$OVERLAY/app/src/main/res/drawable/ic_notification.xml" \
      "$ANDROID/app/src/main/res/drawable/"

echo "==> Copying accessibility service resources"
mkdir -p "$ANDROID/app/src/main/res/xml" "$ANDROID/app/src/main/res/values"
cp -f "$OVERLAY/app/src/main/res/xml/axon_accessibility_service.xml" \
      "$ANDROID/app/src/main/res/xml/"
cp -f "$OVERLAY/app/src/main/res/values/axon_accessibility_strings.xml" \
      "$ANDROID/app/src/main/res/values/"

MANIFEST="$ANDROID/app/src/main/AndroidManifest.xml"
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: AndroidManifest.xml missing"
  exit 1
fi

echo "==> Patching AndroidManifest.xml permissions (exact set)"
# Ensure each required permission is present exactly once
ensure_perm() {
  local perm="$1"
  if ! grep -q "android.permission.${perm}" "$MANIFEST"; then
    # Insert after <manifest ...> opening tag
    sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.${perm}\" />|" "$MANIFEST"
    echo "    + added permission $perm"
  else
    echo "    = permission $perm already present"
  fi
}

ensure_perm "POST_NOTIFICATIONS"
ensure_perm "FOREGROUND_SERVICE"
ensure_perm "FOREGROUND_SERVICE_SPECIAL_USE"
ensure_perm "FOREGROUND_SERVICE_MEDIA_PROJECTION"
ensure_perm "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
ensure_perm "WAKE_LOCK"
ensure_perm "INTERNET"

if ! grep -q "WRITE_EXTERNAL_STORAGE" "$MANIFEST"; then
  sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.WRITE_EXTERNAL_STORAGE\" android:maxSdkVersion=\"28\" />|" "$MANIFEST"
  echo "    + added permission WRITE_EXTERNAL_STORAGE"
else
  echo "    = permission WRITE_EXTERNAL_STORAGE already present"
fi

echo "==> Ensuring BackgroundJobService declaration"
if ! grep -q "BackgroundJobService" "$MANIFEST"; then
  # Insert service before closing </application>
  SERVICE_XML='        <service
            android:name=".background.BackgroundJobService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Background execution proof: continuous native heartbeat and activity label for reliability measurement. Not media, not data sync." />
        </service>'
  # Use a temp file to insert before </application>
  awk -v svc="$SERVICE_XML" '
    /<\/application>/ { print svc }
    { print }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added BackgroundJobService"
else
  echo "    = BackgroundJobService already present"
fi

echo "==> Ensuring ScreenCaptureService declaration"
if ! grep -q "ScreenCaptureService" "$MANIFEST"; then
  SERVICE_XML='        <service
            android:name=".screencapture.ScreenCaptureService"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />'
  awk -v svc="$SERVICE_XML" '/<\/application>/ { print svc } { print }' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added ScreenCaptureService"
else
  echo "    = ScreenCaptureService already present"
fi

echo "==> Ensuring AXON Web BrowserActivity declaration"
if ! grep -q 'android:name=".browser.BrowserActivity"' "$MANIFEST"; then
  ACTIVITY_XML='        <activity
            android:name=".browser.BrowserActivity"
            android:exported="false"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:label="AXON Web" />'
  awk -v act="$ACTIVITY_XML" '
    BEGIN { in_start=0; done=0 }
    !done && !in_start && /<application([[:space:]>]|$)/ {
      print
      if (index($0, ">")) { print act; done=1 } else { in_start=1 }
      next
    }
    in_start {
      print
      if (index($0, ">")) { print act; in_start=0; done=1 }
      next
    }
    { print }
    END { if (!done) exit 42 }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  grep -q 'android:name=".browser.BrowserActivity"' "$MANIFEST" || { echo "ERROR: BrowserActivity declaration insertion failed"; exit 1; }
  echo "    + added BrowserActivity"
else
  echo "    = BrowserActivity already present"
fi

echo "==> Ensuring AXON screen reader (accessibility service) declaration"
if ! grep -q "AxonAccessibilityService" "$MANIFEST"; then
  SERVICE_XML='        <service
            android:name=".screenstructure.AxonAccessibilityService"
            android:exported="true"
            android:label="AXON screen reader"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/axon_accessibility_service" />
        </service>'
  awk -v svc="$SERVICE_XML" '/<\/application>/ { print svc } { print }' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added AxonAccessibilityService"
else
  echo "    = AxonAccessibilityService already present"
fi

echo "==> Ensuring AXON Apps launcher query (narrow package visibility)"
if ! grep -q "AXON_APPS_QUERY" "$MANIFEST"; then
  QUERY_XML='    <!-- AXON_APPS_QUERY -->
    <queries>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>'
  awk -v q="$QUERY_XML" '/<\/manifest>/ { print q } { print }' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  grep -q "AXON_APPS_QUERY" "$MANIFEST" || { echo "ERROR: launcher query insertion failed"; exit 1; }
  echo "    + added launcher query"
else
  echo "    = launcher query already present"
fi

echo "==> Making Gradle resilient to Maven Central rate limits (HTTP 429, builds #30 and #32)"
# The build failed while downloading build tools from Maven Central ("Received status code 429 ... Too Many Requests").
# That is a rate limit on the shared CI address, not a code error. Two safe, idempotent measures (no new dependency):
#  1. android/gradle.properties: let Gradle retry a failed download more often and wait longer between tries.
#  2. android/build.gradle: try Google's public copy of Maven Central first, then Maven Central itself.
GPROPS="$ANDROID/gradle.properties"
touch "$GPROPS"
if ! grep -q "AXON_GRADLE_RETRY" "$GPROPS"; then
  {
    echo ""
    echo "# AXON_GRADLE_RETRY: survive HTTP 429 from Maven Central"
    echo "systemProp.org.gradle.internal.repository.max.retries=8"
    echo "systemProp.org.gradle.internal.repository.initial.backoff=3000"
    echo "systemProp.org.gradle.internal.http.connectionTimeout=60000"
    echo "systemProp.org.gradle.internal.http.socketTimeout=120000"
  } >> "$GPROPS"
  echo "    + added Gradle download retry settings"
else
  echo "    = Gradle download retry settings already present"
fi
ROOT_GRADLE="$ANDROID/build.gradle"
if [[ -f "$ROOT_GRADLE" ]]; then
  if ! grep -q "AXON_CENTRAL_MIRROR" "$ROOT_GRADLE"; then
    sed -i "s#^\([[:space:]]*\)mavenCentral()#\1maven { url 'https://maven-central.storage-download.googleapis.com/maven2/' } // AXON_CENTRAL_MIRROR\n\1mavenCentral()#" "$ROOT_GRADLE"
    if grep -q "AXON_CENTRAL_MIRROR" "$ROOT_GRADLE"; then echo "    + added Maven Central mirror before mavenCentral()"; else echo "    = no mavenCentral() line in android/build.gradle; mirror not added (retry settings still apply)"; fi
  else
    echo "    = Maven Central mirror already present"
  fi
fi

echo "==> Overlay applied successfully."
echo "Next: npx cap sync android && cd android && ./gradlew assembleDebug"
