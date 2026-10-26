# Expo SDK 58

Use Node.js 24 LTS (the version selected by `.nvmrc`) before installing dependencies or starting Expo. The system Node.js 20 installation is too old for SDK 58.

```powershell
nvm install 24
nvm use 24
npm ci
npm start -- --go --lan
```

Open Expo Go for SDK 58 on an Android phone connected to the same Wi-Fi network and scan the QR code printed by Metro. A localhost URL is only reachable on the computer running Metro; use the LAN address printed by Expo for a phone.

The upgrade aligns Expo modules, React Native, React, and the Jest tooling with SDK 58. Removed React Native status-bar background props are omitted. Inventory schema, backup format, application ID, and signing identity are unchanged by this upgrade.

For standalone builds, regenerate ignored native projects from the SDK 58 config before building. Preserve the existing private `.signing` directory and public `android-signing.json` when building an update. See [Android build instructions](../ANDROID_BUILD.md).

Validation commands:

```powershell
npx expo install --check
npx expo-doctor
npx tsc --noEmit
npm test -- --runInBand --cacheDirectory .expo/jest-cache
```

References: [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [SDK 58 release notes](https://expo.dev/changelog/sdk-58).
