# Docker Setup for Google Drive Organizer

This guide explains how to run the Google Drive Organizer using Docker.

## Prerequisites

- Docker and Docker Compose installed on your system
- Google Cloud Project with Drive API enabled and OAuth credentials
- OpenAI API key (optional) OR local LLM setup (vLLM, LocalAI, Ollama)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/N2Nathan/GoogleDriveSorter.git
cd GoogleDriveSorter
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# OpenAI (OPTIONAL - for AI features)
OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_BASE_URL=https://api.openai.com/v1  # Default, can be omitted

# Session Secret (REQUIRED)
SESSION_SECRET=your_random_session_secret_here

# URLs
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001
```

**Important**: Generate a strong random string for `SESSION_SECRET`:
```bash
openssl rand -base64 32
```

**Using Local LLMs** (vLLM, LocalAI, Ollama, etc.):

Instead of OpenAI, you can use a local LLM:

```env
# For vLLM
OPENAI_API_KEY=dummy-key-not-used-for-local
OPENAI_BASE_URL=http://localhost:8000/v1

# For LocalAI
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=http://localhost:8080/v1

# For Ollama with OpenAI compatibility
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
```

### 3. Build and Run

```bash
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 4. Stop the Application

```bash
docker-compose down
```

To also remove the data volume:
```bash
docker-compose down -v
```

## Setting Environment Variables in Docker

### Method 1: Using .env File (Recommended)

The `.env` file in the project root is automatically loaded by docker-compose:

```bash
# Edit .env file
nano .env

# Start with .env values
docker-compose up
```

### Method 2: Inline Environment Variables

Override specific variables when starting:

```bash
docker-compose up \
  -e GOOGLE_CLIENT_ID="your-client-id" \
  -e GOOGLE_CLIENT_SECRET="your-secret" \
  -e SESSION_SECRET="$(openssl rand -base64 32)"
```

### Method 3: Export Environment Variables

Export variables in your shell:

```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-secret"
export SESSION_SECRET="$(openssl rand -base64 32)"

docker-compose up
```

### Method 4: Separate .env File for Docker

Create a docker-specific environment file:

```bash
# Create docker.env
cat > docker.env <<EOF
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
SESSION_SECRET=$(openssl rand -base64 32)
OPENAI_API_KEY=sk-...
EOF

# Use with docker-compose
docker-compose --env-file docker.env up
```

### Method 5: Docker Compose Override

Create `docker-compose.override.yml` for local customization:

```yaml
version: '3.8'

services:
  backend:
    environment:
      - OPENAI_BASE_URL=http://my-local-llm:8000/v1
      - OPENAI_API_KEY=my-custom-key
    ports:
      - "8080:3001"  # Custom port mapping

  frontend:
    ports:
      - "8000:80"  # Custom port mapping
```

This file is automatically merged with `docker-compose.yml` and ignored by git.

## Local LLM Integration

### Using vLLM

1. Start vLLM server:
```bash
docker run -d \
  --gpus all \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-2-7b-chat-hf
```

2. Configure environment:
```env
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=http://localhost:8000/v1
```

3. If vLLM is in a Docker network:
```env
OPENAI_BASE_URL=http://vllm:8000/v1
```

Update `docker-compose.yml` to add vLLM to the network:
```yaml
services:
  backend:
    extra_hosts:
      - "vllm:host-gateway"
```

### Using LocalAI

1. Start LocalAI:
```bash
docker run -d \
  -p 8080:8080 \
  -v $PWD/models:/models \
  localai/localai:latest
```

2. Configure environment:
```env
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=http://localhost:8080/v1
```

### Using Ollama

1. Start Ollama with OpenAI compatibility:
```bash
docker run -d \
  -p 11434:11434 \
  ollama/ollama

# Pull a model
docker exec -it <container-id> ollama pull llama2
```

2. Configure environment:
```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
```

### Network Configuration for Local LLMs

If your LLM is running in another Docker container:

**Option 1: Use host.docker.internal (Mac/Windows)**
```env
OPENAI_BASE_URL=http://host.docker.internal:8000/v1
```

**Option 2: Use same Docker network**

Update `docker-compose.yml`:
```yaml
services:
  backend:
    networks:
      - app-network
      - llm-network

networks:
  app-network:
    driver: bridge
  llm-network:
    external: true  # Your LLM's network
```

Then reference by service name:
```env
OPENAI_BASE_URL=http://vllm-service:8000/v1
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz` |
| `SESSION_SECRET` | Secret for session encryption | Generate with `openssl rand -base64 32` |

### Optional Variables (with defaults)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `http://localhost:3001/auth/google/callback` | Your custom callback |
| `OPENAI_API_KEY` | OpenAI or local LLM API key | None (AI features disabled) | `sk-...` or `dummy-key` |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible API endpoint | `https://api.openai.com/v1` | `http://localhost:8000/v1` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` | `https://yourdomain.com` |
| `VITE_API_URL` | Backend API URL for frontend | `http://localhost:3001` | `https://api.yourdomain.com` |
| `PORT` | Backend port | `3001` | `8080` |
| `BACKEND_PORT` | Host port mapping for backend | `3001` | `8080` |
| `FRONTEND_PORT` | Host port mapping for frontend | `3000` | `80` |
| `NODE_ENV` | Node environment | `production` | `development` |

## Docker Architecture

### Services

**Backend (`backend`)**
- Node.js Express API
- Port: 3001 (customizable with `BACKEND_PORT`)
- Volume: `backend-data` for SQLite database persistence
- Environment: Production mode
- Health checks: Enabled

**Frontend (`frontend`)**
- React app built with Vite
- Served by Nginx
- Port: 3000 (customizable with `FRONTEND_PORT`)
- Health checks: Enabled

### Volumes

- `backend-data`: Persists the SQLite database across container restarts

### Network

- `app-network`: Bridge network connecting frontend and backend

## Multi-User Support

The application supports multiple users simultaneously:

- Each user authenticates with their own Google account
- Session-based authentication with secure HTTP-only cookies
- User-specific file analysis cache
- User-specific move history
- Isolated Drive access per user

### Session Configuration

Sessions are configured in `backend/src/server.js`:
- **Session Secret**: Used to sign session cookies (set in `.env`)
- **Cookie MaxAge**: 24 hours (configurable)
- **Secure Cookies**: Enabled in production mode
- **HTTP Only**: Prevents XSS attacks

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback`
   - Copy Client ID and Client Secret to `.env`

## Custom Port Configuration

Change the ports by setting environment variables:

```bash
# Use custom ports
BACKEND_PORT=8080 FRONTEND_PORT=9000 docker-compose up
```

Or in `.env`:
```env
BACKEND_PORT=8080
FRONTEND_PORT=9000
```

Don't forget to update your Google OAuth redirect URI if you change the backend port!

## Troubleshooting

### Port Already in Use

If ports are in use, set custom ports:

```env
BACKEND_PORT=3002
FRONTEND_PORT=8080
```

Update `GOOGLE_REDIRECT_URI` and `VITE_API_URL` accordingly.

### Database Issues

Reset the database:

```bash
docker-compose down -v
docker-compose up --build
```

### CORS Errors

Ensure `FRONTEND_URL` matches your frontend URL exactly.

### Session/Cookie Issues

- Verify `SESSION_SECRET` is set
- Check `axios.defaults.withCredentials = true` in frontend
- Ensure CORS allows credentials

### Local LLM Connection Issues

**Cannot connect to localhost from Docker**:
- Use `host.docker.internal` (Mac/Windows)
- Use `172.17.0.1` (Linux)
- Add container to same network

**Test LLM connectivity**:
```bash
# From inside backend container
docker-compose exec backend sh
wget -O- http://host.docker.internal:8000/v1/models
```

## Logs

View logs for debugging:

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## Data Persistence

The SQLite database is stored in the Docker volume `backend-data`. To backup:

```bash
# Backup database
docker-compose exec backend cat /app/data/organizer.db > backup.db

# Restore database
docker-compose cp backup.db backend:/app/data/organizer.db
```

## Security Best Practices

1. **Never commit `.env` file** - It contains secrets
2. **Use strong SESSION_SECRET** - Generate with `openssl rand -base64 32`
3. **Enable HTTPS in production** - Use reverse proxy (Nginx/Caddy)
4. **Regularly update dependencies** - Check for security updates
5. **Limit Google OAuth scopes** - Only request necessary permissions
6. **Validate LLM responses** - Don't trust AI output blindly
7. **Use read-only volumes** - Where possible in production

## Production Deployment

For production deployment:

```env
# .env for production
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
VITE_API_URL=https://api.yourdomain.com
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/google/callback
SESSION_SECRET=<strong-random-secret>

# Use HTTPS
BACKEND_PORT=443
FRONTEND_PORT=443
```

Recommended setup:
1. Use reverse proxy (Nginx/Caddy) with SSL
2. Set `NODE_ENV=production`
3. Use strong `SESSION_SECRET`
4. Configure proper CORS origins
5. Enable secure cookies
6. Set up logging and monitoring
7. Regular database backups
8. Use secrets management (Docker secrets, Vault)

## Docker Commands Reference

```bash
# Build and start
docker-compose up --build

# Start in background
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Rebuild specific service
docker-compose up --build backend

# Remove everything including volumes
docker-compose down -v

# Shell into backend container
docker-compose exec backend sh

# Shell into frontend container
docker-compose exec frontend sh

# Check service health
docker-compose ps

# Restart single service
docker-compose restart backend

# View resource usage
docker stats
```

## Examples

### Example 1: OpenAI with Custom Ports

```bash
# .env
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xyz
SESSION_SECRET=$(openssl rand -base64 32)
OPENAI_API_KEY=sk-proj-...
BACKEND_PORT=8080
FRONTEND_PORT=3000
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback
VITE_API_URL=http://localhost:8080
```

### Example 2: Local vLLM

```bash
# .env
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xyz
SESSION_SECRET=$(openssl rand -base64 32)
OPENAI_API_KEY=not-needed
OPENAI_BASE_URL=http://host.docker.internal:8000/v1
```

### Example 3: Production with Reverse Proxy

```bash
# .env
NODE_ENV=production
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xyz
SESSION_SECRET=<strong-secret-from-vault>
OPENAI_API_KEY=sk-proj-...
FRONTEND_URL=https://drive-organizer.com
VITE_API_URL=https://api.drive-organizer.com
GOOGLE_REDIRECT_URI=https://api.drive-organizer.com/auth/google/callback
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Verify environment variables: `docker-compose config`
- Test health: `curl http://localhost:3001/health`
- Review GitHub issues
- Check Docker network: `docker network inspect googledrivesortir_app-network`
