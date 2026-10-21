// DIAGNOSTIK SEMENTARA — akan dihapus setelah penyebab 500 ditemukan.
const express = require('express');

let app = null;
let loadError = null;
let runtimeError = null;

process.on('unhandledRejection', (reason) => {
  runtimeError = reason;
  console.error('[vercel-diag] unhandledRejection:', reason);
});

process.on('uncaughtException', (error) => {
  runtimeError = error;
  console.error('[vercel-diag] uncaughtException:', error);
});

try {
  app = require('../../dist/app').default;
} catch (error) {
  loadError = error;
  console.error('[vercel-diag] require dist/app failed:', error);
}

const describe = (error) => ({
  name: error && error.name,
  message: error && error.message,
  code: error && error.code,
  stack: error && typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 8) : undefined,
});

if (!app) {
  app = express();
  app.all('*', (_req, res) => {
    res.status(500).json({ message: 'APP_NOT_LOADED' });
  });
}

module.exports = (req, res) => {
  if (loadError || runtimeError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message: 'DIAGNOSTIC',
        phase: loadError ? 'load' : 'runtime',
        error: describe(loadError || runtimeError),
      })
    );
    return;
  }
  return app(req, res);
};
