#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting publish process..."

# 1. Clear dist folder
echo "🗑️  Cleaning dist folder..."
rm -rf dist

# 2. Build the project
echo "📦 Building project (minified)..."
npm run build:min

# 3. Get version from package.json
VERSION=$(grep '"version":' package.json | head -n 1 | cut -d'"' -f4)
echo "📝 Detected version: $VERSION"

# 4. Ask for npm token
read -sp "🔐 Enter npm token: " NPM_TOKEN
echo ""
if [ -z "$NPM_TOKEN" ]; then
    echo "❌ Error: Token cannot be empty."
    exit 1
fi

# 5. Publish to npm
echo "🆙 Publishing to npm..."
npm publish --access public --//registry.npmjs.org/:_authToken=$NPM_TOKEN

echo "✅ Successfully published @khanhromvn/elara-server@$VERSION"
