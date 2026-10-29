#!/usr/bin/env node
/**
 * AUM ESTATES — Unified Dual Preview Server
 * Simultaneously serves:
 *   - Port 8000: Architectural Grid Explorer (default route) & workspace tree
 *   - Port 8080: Hostinger Production Tree (aumestates.com)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GRID_DIR = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist');
const HOSTINGER_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveFile(req, res, filePath) {
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      if (fs.existsSync(idx)) {
        return serveFile(req, res, idx);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIMES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(`404 Not Found: ${req.url}`);
}

// 1. Architectural Grid Explorer Server (Port 8000)
const server8000 = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  // If root requested, serve Architectural Grid Explorer directly
  if (reqPath === '/' || reqPath === '/index.html') {
    return serveFile(req, res, path.join(GRID_DIR, 'index.html'));
  }

  // If path starts with /aum-grid..., resolve relative to ROOT
  if (reqPath.startsWith('/aum-grid-local-baseline-2026-10-27/dist/')) {
    const sub = reqPath.replace('/aum-grid-local-baseline-2026-10-27/dist/', '');
    return serveFile(req, res, path.join(GRID_DIR, sub));
  }

  // If path starts with /AUM_ESTATES..., resolve relative to ROOT
  if (reqPath.startsWith('/AUM_ESTATES_Website_For_Hostinger/')) {
    const sub = reqPath.replace('/AUM_ESTATES_Website_For_Hostinger/', '');
    return serveFile(req, res, path.join(HOSTINGER_DIR, sub));
  }

  // Default: check inside GRID_DIR first, then ROOT_DIR
  const gridPath = path.join(GRID_DIR, reqPath);
  if (fs.existsSync(gridPath)) {
    return serveFile(req, res, gridPath);
  }

  const rootPath = path.join(ROOT_DIR, reqPath);
  return serveFile(req, res, rootPath);
});

server8000.listen(8000, () => {
  console.log('✓ [PORT 8000] Architectural Grid Explorer: http://localhost:8000/');
});

server8000.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn('! [PORT 8000] Already in use, assuming active.');
  } else {
    console.error('! [PORT 8000] Error:', err.message);
  }
});

// 2. Hostinger Website Server (Port 8080)
const server8080 = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];
  const hostingerPath = path.join(HOSTINGER_DIR, reqPath);
  serveFile(req, res, hostingerPath);
});

server8080.listen(8080, () => {
  console.log('✓ [PORT 8080] Hostinger Production Website: http://localhost:8080/');
});

server8080.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn('! [PORT 8080] Already in use, assuming active.');
  } else {
    console.error('! [PORT 8080] Error:', err.message);
  }
});
