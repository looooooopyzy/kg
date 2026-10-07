#!/usr/bin/env node
// Start the existing Wrangler site and the local-only personal bank API.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
let closing = false;

function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => {
    console.error(error);
    shutdown(1);
  });
  child.on('exit', code => {
    if (!closing) shutdown(code || 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else child.kill();
  }
  process.exitCode = code;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
start(['scripts/personal-bank-server.mjs']);
start([
  '--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js',
  'dev', '--config', 'dist/server/wrangler.json', '--local',
  '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--inspector-port', '0',
]);
