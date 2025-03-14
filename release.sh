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

# Delete tag if it exists
git push --delete origin ${VERSION} || echo "Remote tag doesn't exist, skipping deletion"
git tag -d ${VERSION} || echo "Local tag doesn't exist, skipping deletion"

# Create and push new tag
git tag ${VERSION}
git push origin ${VERSION}

echo "Tag ${VERSION} created and pushed"