#!/bin/bash

# Uncomment when needing to delete a specific tag
# git push --delete origin v1.0.0
# git tag -d v1.0.0

# Check if version was provided
if [ -z "$1" ]; then
  echo "Error: Version number is required"
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

VERSION=$1

# Normalize version (remove v prefix if present)
NORMALIZED_VERSION=${VERSION#v}

# Update package.json version
if which jq >/dev/null 2>&1; then
  # Using npm version which handles package.json and package-lock.json properly
  npm version $NORMALIZED_VERSION --no-git-tag-version
  
  # Ensure publishConfig exists and is set to public
  if ! jq -e '.publishConfig' package.json >/dev/null 2>&1; then
    TMP_FILE=$(mktemp)
    jq '. + {"publishConfig": {"access": "public"}}' package.json > "$TMP_FILE" && mv "$TMP_FILE" package.json
    echo "Added publishConfig to package.json"
  fi
else
  # Fallback using npm version (works without jq)
  npm version $NORMALIZED_VERSION --no-git-tag-version
  echo "Updated version to $NORMALIZED_VERSION using npm version"
fi

echo "Updated package.json version to $NORMALIZED_VERSION"

# Create release directory if it doesn't exist
mkdir -p releases

# Generate the release file locally
echo "# TaskBoardAI ${VERSION} Release Notes" > releases/${VERSION}.md
echo "" >> releases/${VERSION}.md
echo "## Changes in this release" >> releases/${VERSION}.md
echo "" >> releases/${VERSION}.md

# Get the latest commits (up to 10)
git log -n 10 --pretty=format:"- %s" >> releases/${VERSION}.md
echo "" >> releases/${VERSION}.md
echo "" >> releases/${VERSION}.md
echo "## Getting Started" >> releases/${VERSION}.md
echo "See the [README.md](../README.md) for installation and usage instructions." >> releases/${VERSION}.md

echo "Release notes created: releases/${VERSION}.md"

# Commit the package.json changes
git add package.json
git commit -m "chore: bump version to ${NORMALIZED_VERSION} for release" || echo "No changes to commit"

# Delete tag if it exists
git push --delete origin ${VERSION} || echo "Remote tag doesn't exist, skipping deletion"
git tag -d ${VERSION} || echo "Local tag doesn't exist, skipping deletion"

# Create and push new tag
git tag ${VERSION}
git push origin ${VERSION}

# Push the version commit
git push origin HEAD

echo "Version updated, tag ${VERSION} created and pushed"