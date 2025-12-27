/**
 * cumstack Build Command
 * builds application for production
 */
import { buildApp } from './builder.js';

const appRoot = process.cwd();

export default async function build() {
  console.log('[cumstack] Building cumstack application for production...\n');

  try {
    await buildApp(appRoot, false);
    console.log('[cumstack] Build complete!');
  } catch (error) {
    console.error('[cumstack] Build failed:', error.message);
    throw error;
  }
}
