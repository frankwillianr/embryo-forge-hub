import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.will.gvcity',
  appName: 'Gv City',
  webDir: 'dist',
  server: {
    url: 'https://embryo-forge-hub.lovable.app?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
