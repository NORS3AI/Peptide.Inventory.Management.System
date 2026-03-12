#!/usr/bin/env node

/**
 * Version Bump Script
 * Automatically increments the patch version number
 * Format: 0.0.X-alpha
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../package.json');

try {
  // Read package.json
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

  // Parse current version
  const versionMatch = packageJson.version.match(/^(\d+)\.(\d+)\.(\d+)(-alpha)?$/);

  if (!versionMatch) {
    console.error('❌ Invalid version format:', packageJson.version);
    process.exit(1);
  }

  const [, major, minor, patch, suffix] = versionMatch;
  const newPatch = parseInt(patch, 10) + 1;
  const newVersion = `${major}.${minor}.${newPatch}${suffix || ''}`;

  // Update version
  packageJson.version = newVersion;

  // Write back to package.json with proper formatting
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

  console.log(`✅ Version bumped: ${versionMatch[0]} → ${newVersion}`);
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to bump version:', error.message);
  process.exit(1);
}
