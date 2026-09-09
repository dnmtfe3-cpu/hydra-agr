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
      // A animação de abertura é controlada pelo HTML em index.html.
      // Não mantenha uma segunda splash nativa cobrindo a logo web.
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      backgroundColor: "#0d4d34",
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
    },
    LocalNotifications: {
      smallIcon: "ic_launcher_foreground",
      iconColor: "#174C36"
    }
  }
};

export default config;
