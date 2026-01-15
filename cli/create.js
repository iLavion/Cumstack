#!/usr/bin/env bun

/**
 * cumstack Create Command
 * Creates a new cumstack project from template
 */

import { existsSync } from "fs";
import { mkdir, cp } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function create() {
  const projectName = process.argv[3];
  if (!projectName) {
    console.error("Error: Please provide a project name");
    console.log("Usage: cum create <project-name>");
    process.exit(1);
  }
  const targetDir = path.resolve(projectName);
  if (existsSync(targetDir)) {
    console.error(`Error: Directory "${projectName}" already exists`);
    process.exit(1);
  }
  console.log(`Creating new cumstack project: ${projectName}`);
  await mkdir(targetDir, { recursive: true });
  const templateDir = path.join(__dirname, "../templates/monorepo");
  await cp(templateDir, targetDir, { recursive: true });
  console.log(`Project created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${projectName}`);
  console.log(`  bun install`);
  console.log(`  bun run dev`);
}
