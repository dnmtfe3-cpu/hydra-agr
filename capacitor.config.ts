import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.hydraagro.app",
  appName: "Hydra Agro",
  webDir: "dist",
  backgroundColor: "#0f3727",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f3727",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      launchFadeOutDuration: 320,
      backgroundColor: "#0f3727",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f8f6ef",
      overlaysWebView: false
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true
    }
  }
};

export default config;
