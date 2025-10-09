---
description: Publish a new version of the package to npm and create a GitHub release
tags: [release, npm, publish]
---

# Release Process

Execute the following steps to publish a new version:

## 1. Switch to master branch (if needed)

```bash
git checkout master && git pull
```

## 2. Bump version

Choose the appropriate version bump:

- **Patch** (0.2.0 → 0.2.1): Bug fixes, minor changes
  ```bash
  npm version patch -m "chore: bump version to %s"
  ```

- **Minor** (0.2.0 → 0.3.0): New features, backwards compatible
  ```bash
  npm version minor -m "chore: bump version to %s"
  ```

- **Major** (0.2.0 → 1.0.0): Breaking changes
  ```bash
  npm version major -m "chore: bump version to %s"
  ```

This updates package.json and creates a git tag automatically.

## 3. Push version commit and tags

```bash
git push && git push --tags
```

## 4. Publish to npm 

Ask the user to provide the OTP code or to run the command:

```bash
npm publish --otp=<6-digit-code-from-authenticator>
```

The `prepublishOnly` script runs `npm run build` automatically.

## 5. Create GitHub release

```bash
gh release create v<VERSION> --title "v<VERSION> - <Title>" --notes "<Release notes>"
```

Example:
```bash
gh release create v0.2.0 --title "v0.2.0 - HTTP Header Pass-Through" --notes "## Features

- Add HTTP header pass-through for authentication
- Environment variable expansion support

**Full Changelog**: https://github.com/respawn-app/tool-filter-mcp/compare/v0.1.0...v0.2.0"
```

## Verification

After publishing:

- Check npm: https://www.npmjs.com/package/@respawn-app/tool-filter-mcp
- Check GitHub releases: https://github.com/respawn-app/tool-filter-mcp/releases
- Test installation: `npx @respawn-app/tool-filter-mcp@latest --help`

## Requirements

- npm authentication configured (`npm login`)
- npm 2FA enabled (OTP required)
- GitHub CLI authenticated (`gh auth login`)
- Write access to the repository
