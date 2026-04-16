import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL?.trim();

const serverConfig =
  serverUrl && serverUrl.length > 0
    ? {
        url: serverUrl,
        // Necessario apenas para testes HTTP local; em producao use HTTPS.
        cleartext: serverUrl.startsWith('http://'),
      }
    : undefined;

const config: CapacitorConfig = {
  appId: 'com.will.gvcity',
  appName: 'Gv City',
  webDir: 'dist',
  server: serverConfig,
};

export default config;
