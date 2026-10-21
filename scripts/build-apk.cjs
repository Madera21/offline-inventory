const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
process.chdir(root);
const env = { ...process.env, NODE_ENV: 'production' };
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || path.join(root, '.android-sdk');
env.ANDROID_HOME = sdk;
env.ANDROID_SDK_ROOT = sdk;
const windows = process.platform === 'win32';
const buildTools = path.join(sdk, 'build-tools', '36.0.0');
const signer = path.join(buildTools, windows ? 'apksigner.bat' : 'apksigner');
if (!fs.existsSync(signer)) throw new Error('Android SDK build-tools 36.0.0 are required. See ANDROID_BUILD.md.');

function run(command, args, cwd = root, capture = false) {
  const batch = windows && /\.(bat|cmd)$/i.test(command);
  const result = spawnSync(batch ? `"${command}"` : command, args, {
    cwd, env, shell: batch, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed: ${result.error?.message || result.stderr || result.status}`);
  return result.stdout || '';
}

const signingDir = path.join(root, '.signing');
const credentialsPath = path.join(signingDir, 'credentials.json');
const keystore = path.join(signingDir, 'release.jks');
const identityPath = path.join(root, 'android-signing.json');
fs.mkdirSync(signingDir, { recursive: true });
if (!fs.existsSync(credentialsPath)) {
  if (fs.existsSync(keystore) || fs.existsSync(identityPath)) throw new Error('Signing credentials are missing. Restore the original .signing folder; do not replace the existing signing key.');
  const password = crypto.randomBytes(32).toString('hex');
  const credentials = { keyAlias: 'offline-inventory', storePassword: password, keyPassword: password };
  env.INVENTORY_STORE_PASSWORD = password;
  env.INVENTORY_KEY_PASSWORD = password;
  run('keytool', ['-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12', '-alias', credentials.keyAlias,
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
    '-storepass:env', 'INVENTORY_STORE_PASSWORD', '-keypass:env', 'INVENTORY_KEY_PASSWORD',
    '-dname', 'CN=Offline Inventory, O=Offline Inventory, C=PH']);
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
} else if (!fs.existsSync(keystore)) {
  throw new Error('The release keystore is missing. Restore .signing/release.jks to preserve update compatibility.');
}
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
env.INVENTORY_STORE_PASSWORD = credentials.storePassword;
env.INVENTORY_KEY_PASSWORD = credentials.keyPassword;
const publicCertificate = run('keytool', ['-exportcert', '-rfc', '-keystore', keystore,
  '-alias', credentials.keyAlias, '-storepass:env', 'INVENTORY_STORE_PASSWORD'], root, true);
const fingerprint = new crypto.X509Certificate(publicCertificate).fingerprint256.replaceAll(':', '').toLowerCase();
if (fs.existsSync(identityPath)) {
  const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  if (identity.certificateSha256 !== fingerprint) throw new Error('Release signing key changed. Restore the original .signing folder before building an update.');
} else {
  fs.writeFileSync(identityPath, JSON.stringify({ package: 'com.offlineinventory.app', certificateSha256: fingerprint }, null, 2) + '\n');
}

const appPath = path.join(root, 'app.json');
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
if (app.expo.android.package !== 'com.offlineinventory.app') throw new Error('Keep the existing Android package ID for compatible updates.');
const statePath = path.join(signingDir, 'last-build.json');
const lastBuild = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
const versionCode = Math.max(app.expo.android.versionCode || 1, (lastBuild?.versionCode || 0) + 1);
app.expo.android.versionCode = versionCode;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

run(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install']);
const localGradle = path.join(sdk, 'gradle', 'gradle-9.3.1', 'bin', windows ? 'gradle.bat' : 'gradle');
const gradle = fs.existsSync(localGradle) ? localGradle : path.join(root, 'android', windows ? 'gradlew.bat' : 'gradlew');
const jdk17Dir = path.join(sdk, 'jdk17');
const jdk17 = fs.existsSync(jdk17Dir) ? fs.readdirSync(jdk17Dir).map((name) => path.join(jdk17Dir, name))
  .find((location) => fs.existsSync(path.join(location, 'bin', windows ? 'java.exe' : 'java'))) : null;
run(gradle, [
  ':app:assembleRelease', '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a', '--no-daemon', '--max-workers=4', '--console=plain',
  ...(jdk17 ? [`-Porg.gradle.java.installations.paths=${jdk17}`, '-Porg.gradle.java.installations.auto-download=false'] : []),
], path.join(root, 'android'));

const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
const apk = path.join(artifactDir, `offline-inventory-${app.expo.version}-${versionCode}.apk`);
// Replace the template's debug signature with our permanent private release key.
run(signer, ['sign', '--ks', keystore, '--ks-key-alias', credentials.keyAlias,
  '--ks-pass', 'env:INVENTORY_STORE_PASSWORD', '--key-pass', 'env:INVENTORY_KEY_PASSWORD',
  '--out', apk, path.join(root, 'android/app/build/outputs/apk/release/app-release.apk')]);
const certificate = run(signer, ['verify', '--verbose', '--print-certs', apk], root, true);
if (!certificate.includes(fingerprint)) {
  throw new Error('Signing certificate changed. Do not distribute this APK as an update. Restore the original .signing folder.');
}
const metadata = {
  package: app.expo.android.package, version: app.expo.version, versionCode,
  certificateSha256: certificate.match(/certificate SHA-256 digest: (\w+)/)?.[1],
  sha256: crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),
  createdAt: new Date().toISOString(),
};
if (!metadata.certificateSha256) throw new Error('Could not verify the APK signing certificate.');
fs.writeFileSync(statePath, JSON.stringify(metadata, null, 2) + '\n');
fs.writeFileSync(`${apk}.json`, JSON.stringify(metadata, null, 2) + '\n');
console.log(certificate);
console.log(`APK ready: ${apk}`);
console.log('Back up the entire .signing folder privately. Future APK updates must use the same key.');
