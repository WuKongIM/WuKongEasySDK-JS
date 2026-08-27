# GitHub Actions Workflow Setup

## NPM Publishing Workflow

The `publish-npm.yml` workflow automatically publishes your EasyJSSDK package to npm when you push a version tag.

### Setup Instructions

#### 1. Create NPM Token

1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Go to your profile → Access Tokens
3. Click "Generate New Token"
4. Choose "Automation" type (recommended for CI/CD)
5. Copy the generated token

#### 2. Add NPM Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

#### 3. Publishing Process

The workflow triggers when you push a version tag:

```bash
# Update version in package.json first
npm version patch  # or minor, major
git push origin main
git push origin --tags
```

#### 4. Workflow Features

- ✅ **Version Validation**: Ensures package.json version matches the git tag
- ✅ **Dependency Installation**: Uses npm ci for faster, reliable installs
- ✅ **Pinned Publishing Runtime**: Uses npm 11 with Node.js 20 for stable OIDC and provenance support
- ✅ **Build Verification**: Confirms all required files are generated
- ✅ **Test Execution**: Requires the complete test suite to pass before publishing
- ✅ **Automatic Publishing**: Publishes to npm registry
- ✅ **Release Summary**: Creates a summary with installation instructions

#### 5. Pull Request Validation

The separate `ci.yml` workflow runs tests and builds the package for every pull request and push to `main`.

### Troubleshooting

**Common Issues:**

1. **Version Mismatch**: Ensure package.json version matches your git tag
2. **NPM Token Invalid**: Regenerate and update the GitHub secret
3. **Build Failures**: Check TypeScript compilation errors
4. **Permission Denied**: Ensure you have publish rights to the npm package

### Security Notes

- Never commit npm tokens to your repository
- Use GitHub Secrets for sensitive information
- The publishing workflow only runs on version tags for security
- Consider using npm provenance for additional security
