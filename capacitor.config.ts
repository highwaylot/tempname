// Capacitor shell for Bell Theory. `npm run cap:sync` builds dist/ and copies
// it into both native trees. Two things live in the native projects rather
// than here and survive `cap sync` but NOT `cap add` (which regenerates the
// tree from the template): the portrait lock and the usage strings
// (ios/App/App/Info.plist: UISupportedInterfaceOrientations, UIRequiresFullScreen,
// NSPhotoLibraryUsageDescription; android/app/src/main/AndroidManifest.xml:
// android:screenOrientation="portrait", android:enableOnBackInvokedCallback),
// plus ios/App/App/PrivacyInfo.xcprivacy and the AVAudioSession setup in
// AppDelegate.swift. Re-apply them after any `cap add`.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.belltheory.game',
  appName: 'Bell Theory',
  webDir: 'dist',
  backgroundColor: '#0b0d11',
  loggingBehavior: 'production',
  zoomEnabled: false,
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: { style: 'DARK', overlaysWebView: true },
    SystemBars: { style: 'DARK', insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    App: { disableBackButtonHandler: false },
  },
};

export default config;
