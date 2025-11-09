#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./publish.sh <version>"
  echo "Example: ./publish.sh 0.5.0"
  exit 1
fi

echo "Publishing version $VERSION..."

npm run lint
npm run build
npm test -- --run

npm version $VERSION --no-git-tag-version

jq --arg v "$VERSION" '.version = $v | .packages[0].version = $v' server.json > tmp && mv tmp server.json

git add package.json package-lock.json server.json
git commit -m "Bump version to $VERSION"

npm publish

git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin master
git push origin "v$VERSION"

if ! mcp-publisher login github 2>/dev/null; then
  echo "Logging into MCP registry..."
  mcp-publisher login github
fi

mcp-publisher publish

echo "✓ Published $VERSION successfully"
