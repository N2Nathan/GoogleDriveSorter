# Publishing Guide

This guide explains how to build and publish the Google Drive Organizer packages.

## Package Versions

- **Frontend**: v1.0.0 (`frontend/package.json`)
- **Backend**: v1.0.0 (`backend/package.json`)
- **Repository**: v1.0.0 (Git tag)

## Building Production Versions

### Frontend Production Build

```bash
cd frontend
npm install
npm run build
```

This creates an optimized production bundle in `frontend/dist/` directory:
- `index.html` - Main HTML entry point
- `assets/` - JavaScript and CSS bundles (minified and optimized)

The build output:
- Minified JavaScript (~192 KB)
- Optimized CSS (~4.4 KB)
- Gzip-compressed for faster loading

### Backend Production

The backend runs directly from source using Node.js:

```bash
cd backend
npm install --production
NODE_ENV=production node src/server.js
```

## Docker Images

### Building Docker Images Locally

```bash
# Build backend image
docker build -t google-drive-organizer-backend:1.0.0 -f backend/Dockerfile .

# Build frontend image
docker build -t google-drive-organizer-frontend:1.0.0 -f frontend/Dockerfile .

# Or build both using docker-compose
docker-compose build
```

### Publishing to Docker Hub (Optional)

If you want to publish to Docker Hub:

```bash
# Tag images with your Docker Hub username
docker tag google-drive-organizer-backend:1.0.0 YOUR_USERNAME/google-drive-organizer-backend:1.0.0
docker tag google-drive-organizer-frontend:1.0.0 YOUR_USERNAME/google-drive-organizer-frontend:1.0.0

# Push to Docker Hub
docker push YOUR_USERNAME/google-drive-organizer-backend:1.0.0
docker push YOUR_USERNAME/google-drive-organizer-frontend:1.0.0

# Tag as latest
docker tag YOUR_USERNAME/google-drive-organizer-backend:1.0.0 YOUR_USERNAME/google-drive-organizer-backend:latest
docker tag YOUR_USERNAME/google-drive-organizer-frontend:1.0.0 YOUR_USERNAME/google-drive-organizer-frontend:latest

docker push YOUR_USERNAME/google-drive-organizer-backend:latest
docker push YOUR_USERNAME/google-drive-organizer-frontend:latest
```

### Using Published Docker Images

Update `docker-compose.yml` to use published images:

```yaml
services:
  backend:
    image: YOUR_USERNAME/google-drive-organizer-backend:1.0.0
    # Remove 'build' directive

  frontend:
    image: YOUR_USERNAME/google-drive-organizer-frontend:1.0.0
    # Remove 'build' directive
```

## GitHub Release

A Git tag `v1.0.0` has been created with the release.

To create a GitHub Release:

1. Go to: https://github.com/N2Nathan/GoogleDriveSorter/releases/new
2. Select tag: `v1.0.0`
3. Release title: `v1.0.0 - Google Drive Organizer`
4. Description:

```markdown
## Google Drive Organizer v1.0.0

First stable release of the Google Drive Organizer - an intelligent file organization tool with OCR, AI-powered naming, and client detection.

### Features

✅ **Google Drive Authentication** - Secure OAuth2 multi-user support
✅ **Intelligent File Analysis** - OCR and AI-powered file naming
✅ **Client Detection** - Automatically detects and organizes files by client/project
✅ **Folder Suggestions** - Smart folder recommendations based on file content
✅ **Batch Operations** - Move multiple files with undo capability
✅ **Move History** - Complete logging of all file operations
✅ **Docker Support** - Full containerization for easy deployment
✅ **Unraid Optimized** - Ready for Unraid deployment
✅ **Local LLM Support** - Works with vLLM, LocalAI, and Ollama

### Quick Start

**Using Docker Compose:**
```bash
git clone https://github.com/N2Nathan/GoogleDriveSorter.git
cd GoogleDriveSorter
cp .env.example .env
# Edit .env with your credentials
docker-compose up -d
```

**On Unraid:**
See [UNRAID_DEPLOYMENT.md](UNRAID_DEPLOYMENT.md) for detailed instructions.

### Documentation

- [README.md](README.md) - Main documentation
- [DOCKER_README.md](DOCKER_README.md) - Docker deployment guide
- [UNRAID_DEPLOYMENT.md](UNRAID_DEPLOYMENT.md) - Unraid-specific guide
- [PUBLISHING.md](PUBLISHING.md) - Build and publishing instructions

### Requirements

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Google Cloud project with Drive API enabled
- OpenAI API key (optional, or use local LLM)
```

5. Publish the release

## NPM Publishing (Not Recommended)

This is an application, not a library, so publishing to npm is not recommended. However, if you want to make the packages installable via npm:

### Backend

```bash
cd backend
npm login
npm publish
```

### Frontend

```bash
cd frontend
npm login
npm publish
```

**Note:** You'll need to update the package names in `package.json` to unique names on npm registry, as `google-drive-sorter-backend` and `google-drive-sorter-frontend` may already be taken.

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version (1.x.x) - Incompatible API changes
- **MINOR** version (x.1.x) - New features, backward compatible
- **PATCH** version (x.x.1) - Bug fixes, backward compatible

### Releasing New Versions

1. Update version in `package.json` files:
   ```bash
   cd backend && npm version patch  # or minor, or major
   cd ../frontend && npm version patch
   ```

2. Commit changes:
   ```bash
   git add .
   git commit -m "Bump version to 1.0.1"
   ```

3. Create new tag:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   ```

4. Push to GitHub:
   ```bash
   git push origin branch-name
   git push origin v1.0.1
   ```

5. Build and publish Docker images with new version tag

## Distribution Methods

Users can access the Google Drive Organizer through:

1. **GitHub Repository** - Clone and run locally
2. **Docker Hub** - Pull pre-built images (if published)
3. **Unraid Community Applications** - One-click install (if submitted)
4. **Manual Download** - Download release ZIP from GitHub

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/N2Nathan/GoogleDriveSorter/issues
