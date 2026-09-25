/// <reference types="@capacitor/cli" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hx.foundacrm",
  appName: "Founda CRM",
  webDir: "out",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: "#0a0918",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0a0918",
  },
  ios: {
    contentInset: "automatic",
    scheme: "App",
    backgroundColor: "#0a0918",
  },
};

export default config;