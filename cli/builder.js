#!/usr/bin/env bun

/**
 * cumstack Build Engine
 * Core build logic for cumstack applications
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extension resolution hierarchy: jsx > tsx > js > ts
const EXTENSION_HIERARCHY = ['.jsx', '.tsx', '.js', '.ts'];

/**
 * Resolve file path with optional extension
 * Tries exact path first, then extensions in hierarchy order
 */
function resolveWithExtension(basePath) {
  const ext = path.extname(basePath);
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext) && existsSync(basePath)) return basePath;
  if (existsSync(basePath)) return basePath;
  for (const extension of EXTENSION_HIERARCHY) {
    const pathWithExt = basePath + extension;
    if (existsSync(pathWithExt)) return pathWithExt;
  }
  return basePath;
}

export async function buildApp(appRoot, isDev = false, buildTimestamp = Date.now()) {
  const outDir = isDev ? 'dist/dev' : 'dist/live';
  console.log(`[cumstack] Building cumstack app for ${isDev ? 'development' : 'production'}...`);
  console.log(`[cumstack] Output: ${outDir}`);
  console.log(`[cumstack] App root: ${appRoot}`);
  console.log(`[cumstack] Entry point: ${path.join(appRoot, 'src/entry.server.jsx')}`);
  globalThis.__BUILD_TIMESTAMP__ = buildTimestamp;
  let serverBuild;
  console.log('[cumstack] Starting server build...');
  try {
    serverBuild = await Bun.build({
      entrypoints: [path.join(appRoot, 'src/entry.server.jsx')],
      outdir: path.join(appRoot, outDir, 'server'),
      target: 'bun',
      format: 'esm',
      minify: !isDev,
      sourcemap: isDev ? 'inline' : 'external',
      external: ['hono', 'cloudflare:*'],
      naming: '[dir]/main.server.js',
      jsx: {
        runtime: 'automatic',
        importSource: 'hono/jsx',
      },
      // resolve @cumstack imports to framework package
      plugins: [
        {
          name: 'resolve-cumstack',
          setup(build) {
            build.onResolve({ filter: /^@cumstack\/app/ }, (args) => {
              let subpath = args.path.replace('@cumstack/app', '');
              if (subpath === '/server') subpath = '/app/server/index.js';
              else if (subpath === '/client') subpath = '/app/client/index.js';
              else if (subpath === '/client/Lust') subpath = '/app/client/Lust.js';
              else if (subpath === '/shared/i18n') subpath = '/app/shared/i18n.js';
              else if (subpath === '/shared/reactivity') subpath = '/app/shared/reactivity.js';
              else if (subpath === '/shared/router') subpath = '/app/shared/router.js';
              else if (subpath === '/shared/utils') subpath = '/app/shared/utils.js';
              else if (subpath === '/shared/language-codes') subpath = '/app/shared/language-codes.js';
              else if (!subpath.endsWith('.js')) subpath += '.js';
              return {
                path: path.join(__dirname, '..', 'src', subpath),
                external: false,
              };
            });
            // resolve ~ alias to src directory
            build.onResolve({ filter: /^~\// }, (args) => {
              const subpath = args.path.replace('~', 'src');
              const basePath = path.join(appRoot, subpath);
              const resolvedPath = resolveWithExtension(basePath);
              return {
                path: resolvedPath,
                external: false,
              };
            });
          },
        },
      ],
    });
  } catch (error) {
    console.error('[cumstack] Server build threw an exception:');
    console.error('[cumstack] Error message:', error.message);
    console.error('[cumstack] Error stack:', error.stack);
    console.error('[cumstack] Full error:', error);
    throw new Error(`Server build failed: ${error.message}`);
  }
  if (!serverBuild.success) {
    console.error('[cumstack] Server build failed:');
    console.error('[cumstack] Build logs count:', serverBuild.logs.length);
    for (const log of serverBuild.logs) console.error(`  [${log.level}] ${log.message}`);
    throw new Error('Server build failed');
  }

  // build client entry
  const clientBuild = await Bun.build({
    entrypoints: [path.join(appRoot, 'src/entry.client.jsx')],
    outdir: path.join(appRoot, outDir, 'client'),
    target: 'browser',
    format: 'esm',
    minify: !isDev,
    sourcemap: isDev ? 'inline' : 'external',
    naming: '[dir]/main.client.js',
    jsx: {
      runtime: 'automatic',
      importSource: 'hono/jsx',
    },
    // resolve @cumstack imports to framework package
    plugins: [
      {
        name: 'resolve-cumstack',
        setup(build) {
          build.onResolve({ filter: /^@cumstack\/app/ }, (args) => {
            let subpath = args.path.replace('@cumstack/app', '');
            if (subpath === '/server') subpath = '/app/server/index.js';
            else if (subpath === '/client') subpath = '/app/client/index.js';
            else if (subpath === '/shared/i18n') subpath = '/app/shared/i18n.js';
            else if (subpath === '/shared/reactivity') subpath = '/app/shared/reactivity.js';
            else if (subpath === '/shared/router') subpath = '/app/shared/router.js';
            else if (subpath === '/shared/utils') subpath = '/app/shared/utils.js';
            else if (subpath === '/shared/language-codes') subpath = '/app/shared/language-codes.js';
            else if (subpath === '/client/Lust') subpath = '/app/client/Lust.js';
            else if (!subpath.endsWith('.js')) subpath += '.js';
            return {
              path: path.join(__dirname, '..', 'src', subpath),
              external: false,
            };
          });
          // resolve ~ alias to src directory
          build.onResolve({ filter: /^~\// }, (args) => {
            const subpath = args.path.replace('~', 'src');
            const basePath = path.join(appRoot, subpath);
            const resolvedPath = resolveWithExtension(basePath);
            return {
              path: resolvedPath,
              external: false,
            };
          });
        },
      },
    ],
  });

  if (!clientBuild.success) {
    console.error('[cumstack] Client build failed:');
    for (const log of clientBuild.logs) console.error(`  ${log.level}: ${log.message}`);
    throw new Error('Client build failed');
  }
  // process CSS through PostCSS (tailwindcss)
  try {
    const postcss = await import('postcss');
    const tailwindcss = await import('@tailwindcss/postcss');
    const cssPath = path.join(appRoot, 'src/main.css');
    console.log(`[cumstack] Processing CSS from: ${cssPath}`);
    console.log(`[cumstack] Tailwind base: ${appRoot}`);
    console.log(`[cumstack] Tailwind content: ${path.join(appRoot, 'src/**/*.{js,jsx,ts,tsx}')}`);
    const css = await Bun.file(cssPath).text();
    const result = await postcss
      .default([
        tailwindcss.default({
          base: appRoot,
          content: [path.join(appRoot, 'src/**/*.{js,jsx,ts,tsx}')],
        }),
      ])
      .process(css, {
        from: cssPath,
        to: path.join(appRoot, outDir, 'client/main.css'),
        map: isDev ? { inline: true } : false,
      });
    await Bun.write(path.join(appRoot, outDir, 'client/main.css'), result.css);
    console.log('[cumstack] CSS processed with Tailwind');
  } catch (error) {
    console.error('[cumstack] PostCSS processing failed:');
    console.error('[cumstack] Error:', error);
    console.error('[cumstack] Stack:', error.stack);
    const cssPath = path.join(appRoot, 'src/main.css');
    await Bun.write(path.join(appRoot, outDir, 'client/main.css'), await Bun.file(cssPath).text());
  }
  console.log('[cumstack] Build complete!');
}
