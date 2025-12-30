# Docker Setup for Google Drive Organizer

This guide explains how to run the Google Drive Organizer using Docker.

## Prerequisites

- Docker and Docker Compose installed on your system
- Google Cloud Project with Drive API enabled and OAuth credentials
- OpenAI API key (optional but recommended)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GoogleDriveSorter
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
OPENAI_API_KEY=your_openai_api_key_here
SESSION_SECRET=your_random_session_secret_here
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001
```

**Important**: Generate a strong random string for `SESSION_SECRET`:
```bash
openssl rand -base64 32
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

## Docker Architecture

### Services

**Backend (`backend`)**
- Node.js Express API
- Port: 3001
- Volume: `backend-data` for SQLite database persistence
- Environment: Production mode

**Frontend (`frontend`)**
- React app built with Vite
- Served by Nginx
- Port: 3000 (mapped to container port 80)

### Volumes

- `backend-data`: Persists the SQLite database across container restarts

### Network

- `app-network`: Bridge network connecting frontend and backend

## Development vs Production

### Development (without Docker)

```bash
# Install dependencies
npm run install:all

# Run both services
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Production (with Docker)

```bash
docker-compose up -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Multi-User Support

The application now supports multiple users simultaneously:

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

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |
| `VITE_API_URL` | Backend API URL for frontend | Yes |
| `PORT` | Backend port (default: 3001) | No |
| `NODE_ENV` | Environment (production/development) | No |

## Troubleshooting

### Port Already in Use

If ports 3000 or 3001 are already in use, modify `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Change host port
  frontend:
    ports:
      - "8080:80"    # Change host port
```

Update `GOOGLE_REDIRECT_URI` and `VITE_API_URL` accordingly.

### Database Issues

If you encounter database errors:

```bash
# Stop containers
docker-compose down

# Remove volume
docker volume rm googledrivesort er_backend-data

# Restart
docker-compose up --build
```

### CORS Errors

Ensure `FRONTEND_URL` in `.env` matches your frontend URL exactly.

### Session/Cookie Issues

- Check that `SESSION_SECRET` is set
- Verify `axios.defaults.withCredentials = true` in frontend
- Ensure CORS is configured with `credentials: true`

## Logs

View logs for debugging:

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

## Data Persistence

The SQLite database is stored in the Docker volume `backend-data`. To backup:

```bash
# Find the volume location
docker volume inspect googledrive sorter_backend-data

# Copy the database
docker cp <container_id>:/app/data/organizer.db ./backup.db
```

## Security Best Practices

1. **Never commit `.env` file** - It contains secrets
2. **Use strong SESSION_SECRET** - Generate with `openssl rand -base64 32`
3. **Enable HTTPS in production** - Use reverse proxy (Nginx/Caddy)
4. **Regularly update dependencies** - Check for security updates
5. **Limit Google OAuth scopes** - Only request necessary permissions

## Production Deployment

For production deployment:

1. Use HTTPS (configure reverse proxy)
2. Set `NODE_ENV=production`
3. Use strong `SESSION_SECRET`
4. Configure proper CORS origins
5. Enable `secure` cookies in session configuration
6. Use environment-specific `.env` files
7. Set up proper logging and monitoring

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
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Verify environment variables
- Ensure Google OAuth is configured correctly
- Review GitHub issues
