#!/usr/bin/env node
/**
 * AUM ESTATES — Contained Loopback Preview Server
 * Binds strictly to 127.0.0.1 by default (override via AUM_HOST) and enforces
 * realpath directory containment so workspace internals (.git, private_master_store,
 * backups, parent directories) are never exposed over HTTP.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GRID_DIR = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist');
const HOSTINGER_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');
const V16_DIR = path.join(ROOT_DIR, 'AUM_Estates_Brand_Study_v16_Local', 'dist');
const BIND_HOST = process.env.AUM_HOST || '127.0.0.1';

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
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache'
};

function resolveContainedFile(baseDir, relUrlPath) {
  if (!fs.existsSync(baseDir)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(relUrlPath || '/');
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const segments = decoded.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return null;
    if (seg.startsWith('.')) return null;
    if (seg.toLowerCase() === 'backups' || seg.toLowerCase() === 'private_master_store') return null;
    if (/\.(?:bak|backup|md|txt|jsonl|sqlite|db)$/i.test(seg)) return null;
  }

  const realBase = fs.realpathSync(baseDir);
  let candidate = path.resolve(realBase, segments.join(path.sep));
  if (candidate !== realBase && !candidate.startsWith(realBase + path.sep)) return null;
  if (!fs.existsSync(candidate)) return null;

  const st = fs.statSync(candidate);
  if (st.isDirectory()) {
    candidate = path.join(candidate, 'index.html');
    if (!fs.existsSync(candidate)) return null;
  }

  const realCandidate = fs.realpathSync(candidate);
  if (realCandidate !== realBase && !realCandidate.startsWith(realBase + path.sep)) return null;
  if (!fs.statSync(realCandidate).isFile()) return null;
  return realCandidate;
}

function sendStatic(res, resolvedPath) {
  if (!resolvedPath) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  const ext = path.extname(resolvedPath).toLowerCase();
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIMES[ext] || 'application/octet-stream'
  });
  fs.createReadStream(resolvedPath).pipe(res);
}

// 1. Architectural Grid Explorer Server (Port 8000, strictly contained)
const server8000 = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];

  if (reqPath.startsWith('/v16/')) {
    return sendStatic(res, resolveContainedFile(V16_DIR, reqPath.slice('/v16/'.length)));
  }
  if (reqPath.startsWith('/aum-grid-local-baseline-2026-10-27/dist/')) {
    return sendStatic(res, resolveContainedFile(GRID_DIR, reqPath.slice('/aum-grid-local-baseline-2026-10-27/dist/'.length)));
  }
  if (reqPath.startsWith('/AUM_ESTATES_Website_For_Hostinger/')) {
    return sendStatic(res, resolveContainedFile(HOSTINGER_DIR, reqPath.slice('/AUM_ESTATES_Website_For_Hostinger/'.length)));
  }
  if (reqPath.startsWith('/assets/') || reqPath.startsWith('/properties/')) {
    const inGrid = resolveContainedFile(GRID_DIR, reqPath);
    if (inGrid) return sendStatic(res, inGrid);
    return sendStatic(res, resolveContainedFile(HOSTINGER_DIR, reqPath));
  }

  return sendStatic(res, resolveContainedFile(GRID_DIR, reqPath === '/' ? 'index.html' : reqPath));
});

server8000.listen(8000, BIND_HOST, () => {
  console.log(`✓ [PORT 8000] Architectural Grid Explorer: http://${BIND_HOST}:8000/`);
});

server8000.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('! [PORT 8000] Already in use, assuming active.');
  } else {
    console.error('! [PORT 8000] Error:', err.message);
  }
});

// 2. Hostinger Production Website Server (Port 8080, strictly contained)
const server8080 = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  return sendStatic(res, resolveContainedFile(HOSTINGER_DIR, reqPath === '/' ? 'index.html' : reqPath));
});

server8080.listen(8080, BIND_HOST, () => {
  console.log(`✓ [PORT 8080] Hostinger Production Website: http://${BIND_HOST}:8080/`);
});

server8080.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('! [PORT 8080] Already in use, assuming active.');
  } else {
    console.error('! [PORT 8080] Error:', err.message);
  }
});
