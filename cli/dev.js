/**
 * cumstack Dev Command
 * Starts development environment with build, wrangler, and HMR
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { buildApp } from './builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = process.cwd();
const HMR_PORT = 8790;
const DEBOUNCE_MS = 100;

export default async function dev() {
  console.log('[cumstack] Starting cumstack development environment');
  console.log(`[cumstack] App root: ${appRoot}`);
  console.log('[cumstack] Building application...');
  await runBuild();
  // start HMR WebSocket server
  const wss = new WebSocketServer({ port: HMR_PORT });
  const clients = new Set();
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[cumstack] HMR Client connected');
    ws.on('close', () => {
      clients.delete(ws);
      console.log('[cumstack] HMR Client disconnected');
    });
  });
  console.log(`[cumstack] HMR WebSocket server running on port ${HMR_PORT}`);
  // start file watcher
  let rebuildTimeout;
  let isRebuilding = false;
  const triggerRebuild = async (filePath) => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      if (isRebuilding) return;
      isRebuilding = true;
      const relativePath = path.relative(appRoot, filePath);
      console.log(`[cumstack] HMR File changed: ${relativePath}`);
      console.log('[cumstack] Rebuilding...');
      try {
        await runBuild();
        const ext = path.extname(relativePath);
        let updateType = 'js-update';
        if (ext === '.css') {
          updateType = 'css-update';
          console.log('[cumstack] Build successful, hot swapping styles...');
        } else if (['.js', '.jsx'].includes(ext) && relativePath.includes('/client/')) {
          updateType = 'js-update';
          console.log('[cumstack] Build successful, hot swapping modules...');
        } else {
          updateType = 'server-update';
          console.log('[cumstack] Build successful, patching DOM...');
        }
        clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: updateType,
                path: relativePath,
                timestamp: Date.now(),
              })
            );
          }
        });
      } catch (error) {
        console.error('[cumstack] Build failed:', error.message);
      } finally {
        isRebuilding = false;
      }
    }, DEBOUNCE_MS);
  };
  const srcDir = path.join(appRoot, 'src');
  watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const ext = path.extname(filename);
    if (['.js', '.jsx', '.ts', '.tsx', '.css', '.json'].includes(ext)) triggerRebuild(path.join(srcDir, filename));
  });
  console.log(`[cumstack] HMR Watching ${path.relative(appRoot, srcDir)}/`);
  console.log('[cumstack] Starting Wrangler dev server...');
  const wrangler = spawn('wrangler', ['dev', '--env', 'dev'], {
    cwd: appRoot,
    stdio: 'inherit',
    shell: true,
  });
  // handle exit
  wrangler.on('exit', (code) => {
    console.log('[cumstack] Shutting down cumstack dev server...');
    wss.close();
    process.exit(code);
  });
  // cleanup
  process.on('SIGINT', () => {
    console.log('[cumstack] Shutting down cumstack dev server...');
    wrangler.kill();
    wss.close();
    process.exit(0);
  });
}
// run build process
async function runBuild() {
  const timestamp = Date.now();
  await buildApp(appRoot, true, timestamp);
}
