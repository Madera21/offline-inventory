# Android APK Builds

Run `npm run apk` from the project root with Node.js 24 LTS (`.nvmrc`) and JDK 21 available on `PATH`. Expo SDK 58 requires Node.js 22.13+ or 24.3+ on supported LTS lines. No Expo account or running Metro server is needed for the installed release app.

## Android SDK

Set `ANDROID_HOME` to an installed SDK, or put the SDK in the ignored `.android-sdk/` directory. Install these packages using Google's command-line tools:

```powershell
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```

Accept the SDK licenses when prompted. The first build downloads Gradle and native dependencies. The APK supports ARM64 and ARMv7 Android devices.

React Native's Gradle plugin also needs JDK 17. Install it normally, or extract it under `.android-sdk/jdk17/`; the build script detects a JDK there. A verified local Gradle 9.3.1 distribution under `.android-sdk/gradle/gradle-9.3.1/` is used when available, otherwise the generated Gradle wrapper is used.

## Signing and Updates

The first build creates a private release keystore and credentials in `.signing/`. Subsequent builds reuse that key, keep the package ID `com.offlineinventory.app`, and increase `android.versionCode` beyond the last successful build. Commit the updated version code with each release.

**Back up the entire `.signing/` folder to a private, secure location.** It contains the key, passwords, and last successful version code. It is excluded from Git. Losing the signing key prevents future APKs from updating this installation; do not regenerate it for later releases. Never publish this folder or its credentials.

Commit `android-signing.json` with the build script. It contains only the public certificate fingerprint and package ID. The script checks this identity before building and refuses to generate a replacement key when the original credentials are missing.

The signed APK and public verification metadata are written to `artifacts/`. Install the APK on the phone. For later releases, run the same build command and install the newer APK over the existing app, without uninstalling. Normal upgrades retain local inventory and sales; keep a separate data backup before upgrading.

Expo Go data belongs to Expo Go's sandbox and is separate from the standalone app. Export a backup from Expo Go before switching to the APK. The current restore screen only reads backup files already in app storage; importing an external backup needs a file picker.

These are APK replacement updates. Automatic over-the-air updates and Play Store publishing are not configured.
