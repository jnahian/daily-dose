#!/usr/bin/env node

/**
 * Pre-version check script
 * Ensures all checks pass before bumping version
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-version checks...\n');

let hasErrors = false;

// Check 1: Ensure we're on main branch
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  if (branch !== 'main') {
    console.error(`❌ Error: Version bumps must be done on 'main' branch`);
    console.error(`   Current branch: ${branch}\n`);
    hasErrors = true;
  } else {
    console.log(`✅ On main branch`);
  }
} catch (error) {
  console.error(`❌ Error checking git branch: ${error.message}\n`);
  hasErrors = true;
}

// Check 2: Ensure working directory is clean
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim() !== '') {
    console.error(`❌ Error: Working directory is not clean`);
    console.error(`   Please commit or stash your changes before versioning\n`);
    hasErrors = true;
  } else {
    console.log(`✅ Working directory is clean`);
  }
} catch (error) {
  console.error(`❌ Error checking git status: ${error.message}\n`);
  hasErrors = true;
}

// Check 3: Ensure we're up to date with remote
try {
  execSync('git fetch origin main', { stdio: 'pipe' });
  const localCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const remoteCommit = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();

  if (localCommit !== remoteCommit) {
    console.error(`❌ Error: Local branch is not up to date with origin/main`);
    console.error(`   Please pull latest changes before versioning\n`);
    hasErrors = true;
  } else {
    console.log(`✅ Up to date with origin/main`);
  }
} catch (error) {
  console.error(`❌ Error checking remote status: ${error.message}\n`);
  hasErrors = true;
}

// Check 4: Verify package.json exists and is valid
try {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  if (!packageJson.version) {
    console.error(`❌ Error: package.json does not contain a version field\n`);
    hasErrors = true;
  } else {
    console.log(`✅ Current version: ${packageJson.version}`);
  }
} catch (error) {
  console.error(`❌ Error reading package.json: ${error.message}\n`);
  hasErrors = true;
}

// Check 5: Verify CHANGELOG.md exists
try {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.warn(`⚠️  Warning: CHANGELOG.md does not exist`);
    console.warn(`   Consider creating one to track version changes\n`);
  } else {
    console.log(`✅ CHANGELOG.md exists`);
  }
} catch (error) {
  console.warn(`⚠️  Warning: Could not check CHANGELOG.md: ${error.message}\n`);
}

// Final result
console.log('');
if (hasErrors) {
  console.error('❌ Pre-version checks failed. Please fix the errors above.\n');
  process.exit(1);
} else {
  console.log('✅ All pre-version checks passed!\n');
  process.exit(0);
}
