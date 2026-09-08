# GitHub Actions Workflow Setup

## NPM Publishing Workflow

The `publish-npm.yml` workflow automatically publishes your EasyJSSDK package to npm when you push a version tag.

### Setup Instructions

#### 1. Configure npm Trusted Publishing

In the `easyjssdk` package settings on [npmjs.com](https://www.npmjs.com/),
configure a GitHub Actions trusted publisher for:

- organization or user: `WuKongIM`
- repository: `WuKongEasySDK-JS`
- workflow: `publish-npm.yml`

The workflow exchanges GitHub's OIDC identity for short-lived npm credentials.
It does not use or require an `NPM_TOKEN` repository secret.

#### 3. Publishing Process

The workflow triggers when you push a version tag:

```bash
# After the reviewed version commit is merged and main CI succeeds:
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin vX.Y.Z
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

CI covers Node 20, 22.12.0, and 24.3.0. A bounded real TCP regression additionally
checks native WebSocket on Node 22/24 and the optional `ws` transport on all three.
It owns only loopback listeners and temporary clients, with no external service.

### Troubleshooting

**Common Issues:**

1. **Version Mismatch**: Ensure package.json version matches your git tag
2. **OIDC Authentication Failed**: Verify the npm trusted publisher matches this repository and `publish-npm.yml`
3. **Build Failures**: Check TypeScript compilation errors
4. **Permission Denied**: Ensure you have publish rights to the npm package

### Security Notes

- Do not add a long-lived npm token when trusted publishing is available
- Keep the workflow's `id-token: write` permission scoped to the publish job
- The publishing workflow only runs on version tags for security
- Consider using npm provenance for additional security
