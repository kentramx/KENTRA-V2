import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mx.com.kentra.app',
  appName: 'Kentra',
  webDir: 'dist',
  
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#4a5d23',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#4a5d23',
    },
  },
  
  ios: {
    contentInset: 'automatic',
    scheme: 'kentra',
  },
  
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
