// Sekali pakai: menyajikan hasil build (preview) dan dev server lewat backend
// staging lokal di port 3199, bukan port 3000 yang isi DATABASE_URL-nya tidak
// saya ketahui.
import { mergeConfig } from 'vite';
import base from './vite.config';

const proxyStaging = {
  '/api': { target: 'http://localhost:3199', changeOrigin: true },
  '/uploads': { target: 'http://localhost:3199', changeOrigin: true },
};

export default mergeConfig(base, {
  server: { port: 5179, proxy: proxyStaging },
  preview: {
    port: 4179,
    proxy: proxyStaging,
  },
});
