Using a deployment branch for your open-source project is an excellent approach to maintain separation between private and public code. Here's a comprehensive guide to set up and manage this workflow:

## Setting Up a Deployment Branch Workflow

### 1. Initial Repository Setup

```bash
# Clone your private repository
git clone git@github.com:username/private-repo.git
cd private-repo

# Add the public repository as a remote
git remote add public git@github.com:username/public-repo.git

# Create a deployment branch for public releases
git checkout -b public-release
```

### 2. Configuring the Deployment Branch

The deployment branch should only contain code that's safe to release publicly:

```bash
# Start with a clean slate for the public branch
git checkout public-release
git rm -rf .  # Remove all files (they'll still exist in your main branch)
git commit -m "Clear branch for public release"

# Cherry-pick or copy only the files you want to make public
git checkout main -- src/public-component/
git checkout main -- LICENSE README.md
git add .
git commit -m "Add public components for release"
```

### 3. Managing the .gitignore File

Create a specific .gitignore for your public branch to ensure private files don't get included:

```bash
# On your public-release branch
cat > .gitignore << EOF
# Private configuration files
config/private-keys.json
.env.private

# Internal documentation
docs/internal/

# Proprietary code modules
src/proprietary-feature/
EOF

git add .gitignore
git commit -m "Add public branch gitignore"
```

## Ongoing Maintenance Workflow

### 1. Updating the Public Branch

When you want to update your public repository with new changes:

```bash
# Make sure your main branch is up to date
git checkout main
git pull

# Switch to public branch and update it
git checkout public-release

# Option 1: Merge specific changes
git cherry-pick <commit-hash>  # For specific commits

# Option 2: Update specific files/directories
git checkout main -- src/updated-component/
git add .
git commit -m "Update public component"
```

### 2. Pushing to the Public Repository

```bash
# Push your public-release branch to the main branch of your public repository
git push public public-release:main
```

### 3. Creating Public Releases

For version releases:

```bash
# Tag your release in the public branch
git checkout public-release
git tag -a v1.0.0 -m "Version 1.0.0 release"
git push public v1.0.0
```

## Automating the Process

For a more streamlined workflow, consider creating a script to handle the deployment:

```bash
#!/bin/bash
# deploy-public.sh

# Ensure we're up to date
git checkout main
git pull

# Switch to public branch
git checkout public-release

# Update specific directories (customize as needed)
git checkout main -- src/public-components/
git checkout main -- docs/public/
git checkout main -- README.md LICENSE

# Commit changes
git add .
git commit -m "Update public release $(date +%Y-%m-%d)"

# Push to public repository
git push public public-release:main

echo "Public repository updated successfully!"
```

Make the script executable: `chmod +x deploy-public.sh`

## Best Practices

1. **Review before pushing**: Always review changes before pushing to ensure no private code is included
2. **Use descriptive commit messages**: Clearly indicate what changes are being made to the public branch
3. **Maintain clear documentation**: Document which components are public vs. private
4. **Consider CI/CD**: Set up CI/CD pipelines to automatically test your public branch before deployment
5. **Version control strategy**: Follow semantic versioning for your public releases

This deployment branch approach gives you fine-grained control over what gets published while maintaining a clean separation between your private and public code.

Sources
