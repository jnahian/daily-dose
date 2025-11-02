# Versioning Guide

This document describes the versioning strategy and release process for Daily Dose.

## Semantic Versioning (SemVer)

Daily Dose follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers use the format `MAJOR.MINOR.PATCH`:

```
v1.2.3
│ │ │
│ │ └─ PATCH: Bug fixes, minor improvements
│ └─── MINOR: New features, backwards-compatible changes
└───── MAJOR: Breaking changes, incompatible API changes
```

### When to Bump Each Version

#### PATCH (1.0.X)
Bug fixes and minor improvements that don't affect the public API:
- Bug fixes
- Security patches
- Performance improvements
- Documentation updates
- Internal refactoring
- Dependency updates (non-breaking)

**Example**: `1.0.0` → `1.0.1`

#### MINOR (1.X.0)
New features that are backwards-compatible:
- New slash commands
- New features added to existing commands
- Optional new parameters
- New configuration options
- Non-breaking enhancements
- Deprecation warnings (without removal)

**Example**: `1.0.0` → `1.1.0`

#### MAJOR (X.0.0)
Breaking changes that affect existing functionality:
- Removing commands or features
- Changing command syntax in incompatible ways
- Required parameter changes
- Database schema changes requiring migration
- Major architectural changes
- Removing deprecated features

**Example**: `1.0.0` → `2.0.0`

---

## Release Process

### Prerequisites

Before creating a release:

1. **All changes merged to `main`**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Working directory is clean**
   ```bash
   git status
   # Should show: nothing to commit, working tree clean
   ```

3. **CHANGELOG.md is updated**
   - Add changes under `[Unreleased]` section
   - Categorize changes (Added, Changed, Fixed, etc.)

### Step-by-Step Release

#### 1. Update CHANGELOG.md

Edit `CHANGELOG.md` and move changes from `[Unreleased]` to a new version section:

```markdown
## [Unreleased]

## [1.2.0] - 2025-11-03

### Added
- New feature description

### Fixed
- Bug fix description
```

#### 2. Choose Version Bump Type

Determine which version component to bump based on your changes:

- **Patch Release** (bug fixes):
  ```bash
  npm run version:patch
  ```

- **Minor Release** (new features):
  ```bash
  npm run version:minor
  ```

- **Major Release** (breaking changes):
  ```bash
  npm run version:major
  ```

#### 3. Automated Actions

The version script will automatically:

1. ✅ Run pre-version checks:
   - Verify on `main` branch
   - Check working directory is clean
   - Confirm up-to-date with remote
   - Validate package.json

2. 📝 Update `package.json` version

3. 🏷️ Create git commit: `🔖 Release vX.Y.Z`

4. 🏷️ Create git tag: `vX.Y.Z`

5. 🚀 Push commit and tag to remote

6. ⚡ Trigger GitHub Actions deployment workflow

#### 4. Monitor Deployment

Watch the deployment progress:

1. Go to GitHub Actions: `https://github.com/jnahian/daily-dose/actions`

2. Find the "Deploy Version Release" workflow

3. Monitor job progress:
   - **Validate**: Checks tag format and version match
   - **Deploy**: Deploys to production VPS
   - **Health Check**: Verifies application is running
   - **Create Release**: Creates GitHub release with notes
   - **Notify**: Sends deployment summary

#### 5. Verify Deployment

After successful deployment:

```bash
# Check application health
curl http://YOUR_VPS_HOST:APP_PORT/health

# Verify version in logs
ssh YOUR_VPS_USER@YOUR_VPS_HOST
pm2 logs daily-dose --lines 50
```

---

## Version Management Scripts

### Available Commands

```bash
# Check version and git status
npm run version:check

# Bump patch version (1.0.0 → 1.0.1)
npm run version:patch

# Bump minor version (1.0.0 → 1.1.0)
npm run version:minor

# Bump major version (1.0.0 → 2.0.0)
npm run version:major
```

### Pre-version Checks

Run automatically before version bump:

```bash
npm run version:check
```

Verifies:
- ✅ On `main` branch
- ✅ Working directory clean
- ✅ Up-to-date with `origin/main`
- ✅ Valid `package.json`
- ⚠️ `CHANGELOG.md` exists (warning only)

### Post-version Actions

Run automatically after version bump:

```bash
npm run postversion
```

Executes:
- Push commit to remote: `git push`
- Push tags to remote: `git push --tags`

---

## GitHub Actions Workflows

### Deploy Version Release

**Trigger**: Push tag matching `v*.*.*` (e.g., `v1.2.3`)

**Jobs**:

1. **Validate** (runs first)
   - Validates SemVer tag format
   - Verifies package.json version matches tag
   - Runs dependency install and Prisma generation

2. **Deploy** (after validate)
   - SSHs into production VPS
   - Checks out the tagged version
   - Installs production dependencies
   - Generates Prisma client
   - Runs database migrations
   - Restarts application via PM2

3. **Health Check** (after deploy)
   - Waits 30 seconds for startup
   - Verifies `/health` endpoint returns 200

4. **Create Release** (after health check)
   - Creates GitHub Release
   - Extracts changelog for version
   - Attaches release notes

5. **Notify** (always runs)
   - Provides deployment summary
   - Shows job results

### Deploy to Hetzner VPS

**Trigger**: Push to `main` branch or manual dispatch

**Purpose**: Continuous deployment for non-version pushes

---

## Best Practices

### 1. Always Update CHANGELOG.md

Before bumping version, document changes:

```markdown
## [Unreleased]

### Added
- New `/dd-team-archive` command for archiving teams

### Fixed
- Fixed timezone issue in standup scheduling
```

### 2. Commit All Changes First

Version bumps require a clean working directory:

```bash
git add .
git commit -m "feat: add team archiving feature"
git push origin main
```

### 3. Use Conventional Commit Messages

Follow convention for better changelog generation:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: restructure code
test: add tests
chore: update dependencies
```

### 4. Test Before Versioning

Ensure all changes are tested:

```bash
# Run manual tests
npm run dev

# Test commands in Slack workspace
# Verify scheduler behavior
npm run debug:scheduler
```

### 5. Version from `main` Branch Only

Never bump versions from feature branches:

```bash
# ❌ Wrong
git checkout feature-branch
npm run version:minor

# ✅ Correct
git checkout main
git pull origin main
npm run version:minor
```

### 6. One Version Bump per Logical Release

Group related changes into single releases:

```bash
# ❌ Wrong - multiple version bumps for same feature
npm run version:patch  # Add feature part 1
npm run version:patch  # Add feature part 2

# ✅ Correct - one version for complete feature
git commit -m "feat: complete team archiving"
npm run version:minor
```

---

## Rollback Process

If a deployment fails or introduces critical bugs:

### Option 1: Quick Hotfix

1. Fix the bug on `main`
2. Bump patch version:
   ```bash
   npm run version:patch
   ```

### Option 2: Revert to Previous Version

1. Find previous working version:
   ```bash
   git tag --list
   ```

2. SSH into VPS and checkout previous version:
   ```bash
   ssh your-vps-user@your-vps-host
   cd /var/www/html/daily-dose/
   git fetch --all --tags
   git checkout tags/v1.0.0
   npm ci --production
   npx prisma generate
   pm2 restart daily-dose
   ```

3. Create revert commit and new version:
   ```bash
   git revert <bad-commit-hash>
   npm run version:patch
   ```

---

## Troubleshooting

### Version Check Fails

**Issue**: `npm run version:patch` fails pre-version checks

**Solutions**:

```bash
# Uncommitted changes
git status
git add .
git commit -m "your message"

# Not on main branch
git checkout main

# Not up to date
git pull origin main

# Dirty working directory
git stash
git pull origin main
git stash pop
```

### Tag Already Exists

**Issue**: Tag `v1.2.3` already exists

**Solution**:

```bash
# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Create version again
npm run version:patch
```

### Deployment Workflow Fails

**Issue**: GitHub Actions deployment fails

**Debugging**:

1. Check workflow logs in GitHub Actions
2. Verify secrets are configured:
   - `VPS_HOST`
   - `VPS_USERNAME`
   - `VPS_SSH_KEY`
   - `VPS_PORT`
   - `APP_PORT`
3. Manually SSH into VPS to check logs:
   ```bash
   ssh your-user@your-host
   pm2 logs daily-dose
   ```

---

## Version History

View all releases:

```bash
# List all tags
git tag --list

# View tag details
git show v1.2.3

# View commits between versions
git log v1.0.0..v1.1.0 --oneline
```

Online:
- Releases: `https://github.com/jnahian/daily-dose/releases`
- Tags: `https://github.com/jnahian/daily-dose/tags`
- CHANGELOG: See `CHANGELOG.md` in repository root

---

## Questions?

- **Documentation**: See `/docs` directory
- **Issues**: Create GitHub issue
- **Slack**: Ask in `#daily-dose-support` channel

---

*Last updated: 2025-11-02*
*Generated with Claude Code*
