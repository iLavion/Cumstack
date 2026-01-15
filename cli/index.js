#!/usr/bin/env bun

/**
 * cumstack CLI
 * command-line interface for cumstack framework
 */

const commands = {
  dev: "./dev.js",
  build: "./build.js",
  create: "./create.js",
};

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

function frameHeader(text) {
  const lines = text.split("\n").map((line) => line.trim());
  const maxLength = Math.max(...lines.map((l) => l.length));
  const top = "╔" + "═".repeat(maxLength + 2) + "╗";
  const bottom = "╚" + "═".repeat(maxLength + 2) + "╝";
  const framedLines = lines.map((line) => `╟ ${line.padEnd(maxLength, " ")} ╢`);
  return [top, ...framedLines, bottom].join("\n");
}

// usage/help text
function printUsage(error) {
  const header = frameHeader("cumstack Framework CLI");
  console.log(error ? `${colors.red}${header}${colors.reset}` : `${colors.cyan}${header}${colors.reset}`);
  console.log(`${colors.yellow}Usage:${colors.reset}
  cum <command> [options]

  ${colors.cyan}Commands:${colors.reset}
  ${colors.green}  dev${colors.reset}     → Start development server with HMR
  ${colors.green}  build${colors.reset}   → Build for production
  ${colors.green}  create${colors.reset}  → Create a new cumstack project

  ${colors.cyan}Examples:${colors.reset}
  ${colors.green}  cum dev
  ${colors.green}  cum build
  ${colors.green}  cum create my-app
  `);

  process.exit(error ? 1 : 0);
}

const command = process.argv[2];
if (!command) printUsage();
if (!commands[command]) printUsage(`Unknown command "${command}"`);
try {
  const commandModule = await import(commands[command]);
  if (typeof commandModule.default !== "function") throw new Error(`Command module "${command}" does not export a default function`);
  await commandModule.default();
} catch (err) {
  console.error(`${colors.red}\nFailed to execute "${command}": ${err.message}${colors.reset}`);
  if (err.stack) console.error(`${colors.red}${err.stack}${colors.reset}`);
  process.exit(1);
}
