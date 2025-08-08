# GitHub Actions Workflow Setup

## NPM Publishing Workflow

The `publish-npm.yml` workflow automatically publishes your EasyJSSDK package to npm when you create a new release or push a version tag.

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

The workflow triggers when you:

**Option A: Create a GitHub Release**
1. Go to your repository → Releases
2. Click "Create a new release"
3. Create a new tag (e.g., `v1.0.6`)
4. Fill in release title and description
5. Click "Publish release"

**Option B: Push a Version Tag**
```bash
# Update version in package.json first
npm version patch  # or minor, major
git push origin main
git push origin --tags
```

#### 4. Workflow Features

- ✅ **Version Validation**: Ensures package.json version matches the git tag
- ✅ **Dependency Installation**: Uses npm ci for faster, reliable installs
- ✅ **Build Verification**: Confirms all required files are generated
- ✅ **Test Execution**: Runs tests if available (currently shows warning)
- ✅ **Automatic Publishing**: Publishes to npm registry
- ✅ **Release Summary**: Creates a summary with installation instructions

#### 5. Recommended Improvements

Consider adding proper tests to your project:

```json
{
  "scripts": {
    "test": "node test/test.js",
    "test:watch": "npm test -- --watch"
  }
}
```

### Troubleshooting

**Common Issues:**

1. **Version Mismatch**: Ensure package.json version matches your git tag
2. **NPM Token Invalid**: Regenerate and update the GitHub secret
3. **Build Failures**: Check TypeScript compilation errors
4. **Permission Denied**: Ensure you have publish rights to the npm package

### Security Notes

- Never commit npm tokens to your repository
- Use GitHub Secrets for sensitive information
- The workflow only runs on tags/releases for security
- Consider using npm provenance for additional security
