# Unraid Deployment Guide

This guide explains how to deploy Google Drive Organizer on Unraid using Docker.

## Prerequisites

- Unraid 6.9+ with Docker enabled
- Community Applications plugin (recommended)
- Google Cloud Project with OAuth credentials
- OpenAI API key (optional) OR local LLM

## Method 1: Using Docker Compose (Recommended)

### Step 1: Install Docker Compose Plugin

1. Go to **Apps** in Unraid
2. Search for "Compose Manager" or "Docker Compose Manager"
3. Install the plugin

### Step 2: Create Compose Stack

1. Go to **Docker** tab → **Compose** (if using Compose Manager)
2. Click **Add New Stack**
3. Name it: `google-drive-organizer`
4. Set the compose file path: `/mnt/user/appdata/google-drive-organizer/`

5. Create the compose file at `/mnt/user/appdata/google-drive-organizer/docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/n2nathan/googledrivesortir-backend:latest
    container_name: GoogleDriveOrganizer-Backend
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=http://${HOST_IP}:3001/auth/google/callback
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - FRONTEND_URL=http://${HOST_IP}:3000
    volumes:
      - /mnt/user/appdata/google-drive-organizer/data:/app/data
    restart: unless-stopped
    networks:
      - organizer-network

  frontend:
    image: ghcr.io/n2nathan/googledrivesortir-frontend:latest
    container_name: GoogleDriveOrganizer-Frontend
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://${HOST_IP}:3001
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - organizer-network

networks:
  organizer-network:
    driver: bridge
```

6. Create environment file at `/mnt/user/appdata/google-drive-organizer/.env`:

```bash
# Get your Unraid server IP
HOST_IP=192.168.1.100

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Session Secret (REQUIRED)
SESSION_SECRET=your_generated_secret_here

# OpenAI (OPTIONAL)
OPENAI_API_KEY=your_openai_key_or_leave_empty
OPENAI_BASE_URL=
```

7. Click **Compose Up** to start the stack

## Method 2: Manual Docker Container Setup

### Step 1: Create appdata Directory

SSH into Unraid or use the terminal:

```bash
mkdir -p /mnt/user/appdata/google-drive-organizer/data
```

### Step 2: Add Docker Container via Unraid UI

#### Backend Container

1. Go to **Docker** tab → **Add Container**
2. Fill in the following:

**Basic Settings:**
- Name: `GoogleDriveOrganizer-Backend`
- Repository: `ghcr.io/n2nathan/googledrivesortir-backend:latest` (or build from source)
- Network Type: `bridge`
- Console shell command: `shell`

**Port Mappings:**
- Container Port: `3001`
- Host Port: `3001`
- Protocol: `tcp`

**Volume Mappings:**
- Container Path: `/app/data`
- Host Path: `/mnt/user/appdata/google-drive-organizer/data`
- Access Mode: `Read/Write`

**Environment Variables:**
Add each of these:

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `production` | Environment mode |
| `GOOGLE_CLIENT_ID` | `your-client-id` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `your-secret` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://UNRAID-IP:3001/auth/google/callback` | Replace UNRAID-IP with your server IP |
| `SESSION_SECRET` | `random-secret-key` | Generate with: `openssl rand -base64 32` |
| `FRONTEND_URL` | `http://UNRAID-IP:3000` | Replace with your Unraid IP |
| `OPENAI_API_KEY` | `sk-...` or leave empty | Optional |
| `OPENAI_BASE_URL` | Leave empty or set | Optional |

**Advanced Settings:**
- Extra Parameters: `--restart=unless-stopped`

3. Click **Apply**

#### Frontend Container

1. Go to **Docker** tab → **Add Container**
2. Fill in the following:

**Basic Settings:**
- Name: `GoogleDriveOrganizer-Frontend`
- Repository: `ghcr.io/n2nathan/googledrivesortir-frontend:latest` (or build from source)
- Network Type: `bridge`

**Port Mappings:**
- Container Port: `80`
- Host Port: `3000`
- Protocol: `tcp`

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `http://UNRAID-IP:3001` |

**Advanced Settings:**
- Extra Parameters: `--restart=unless-stopped`

3. Click **Apply**

## Method 3: Build from Source (for latest features)

If you want to build from the GitHub repository:

### Step 1: Clone Repository

SSH into Unraid:

```bash
cd /mnt/user/appdata
git clone https://github.com/N2Nathan/GoogleDriveSorter.git google-drive-organizer
cd google-drive-organizer
```

### Step 2: Create Environment File

```bash
cp .env.example .env
nano .env
```

Fill in your credentials:
```bash
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://YOUR_UNRAID_IP:3001/auth/google/callback
SESSION_SECRET=$(openssl rand -base64 32)
OPENAI_API_KEY=your_key_or_empty
FRONTEND_URL=http://YOUR_UNRAID_IP:3000
VITE_API_URL=http://YOUR_UNRAID_IP:3001
```

### Step 3: Build and Run

```bash
docker-compose up -d --build
```

## Configuration for Unraid

### Setting Your Unraid IP

Find your Unraid server IP:
1. Go to **Settings** → **Network Settings**
2. Note your IP address (e.g., `192.168.1.100`)
3. Use this IP in all `UNRAID-IP` placeholders

### Port Configuration

Default ports:
- **Frontend**: `3000` - Access the web UI here
- **Backend**: `3001` - API server

If these ports conflict, change them in:
- Docker container port mappings
- Environment variables (`GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `VITE_API_URL`)

### Google OAuth Setup

**Important**: When setting up Google OAuth credentials:

1. Authorized redirect URIs must include:
   ```
   http://YOUR_UNRAID_IP:3001/auth/google/callback
   ```

2. If using a custom domain or reverse proxy:
   ```
   https://your-domain.com/auth/google/callback
   ```

### Using with Reverse Proxy (Nginx Proxy Manager, Swag, etc.)

If you're using a reverse proxy:

1. **Frontend Proxy**:
   - Subdomain: `drive-organizer.yourdomain.com`
   - Forward to: `http://UNRAID-IP:3000`

2. **Backend Proxy**:
   - Subdomain: `drive-api.yourdomain.com`
   - Forward to: `http://UNRAID-IP:3001`

3. **Update Environment Variables**:
   ```bash
   FRONTEND_URL=https://drive-organizer.yourdomain.com
   VITE_API_URL=https://drive-api.yourdomain.com
   GOOGLE_REDIRECT_URI=https://drive-api.yourdomain.com/auth/google/callback
   ```

4. **Update Google OAuth**:
   - Add `https://drive-api.yourdomain.com/auth/google/callback` to redirect URIs

## Local LLM Integration on Unraid

### Using vLLM Container

1. Add vLLM container in Unraid Docker
2. Note the container IP or use host network
3. Set environment variables:
   ```bash
   OPENAI_API_KEY=dummy-key
   OPENAI_BASE_URL=http://VLLM_CONTAINER_IP:8000/v1
   ```

### Using Ollama on Unraid

If you have Ollama running on Unraid:

```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://UNRAID_IP:11434/v1
```

### Using LocalAI on Unraid

If you have LocalAI running:

```bash
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=http://UNRAID_IP:8080/v1
```

## Accessing the Application

Once containers are running:

1. Open browser: `http://UNRAID-IP:3000`
2. Click "Connect Google Drive"
3. Authorize with your Google account
4. Start organizing!

## Updating

### Method 1: Docker Compose
```bash
cd /mnt/user/appdata/google-drive-organizer
docker-compose pull
docker-compose up -d
```

### Method 2: Unraid UI
1. Go to **Docker** tab
2. Click **Check for Updates**
3. Update containers if available

### Method 3: Rebuild from Source
```bash
cd /mnt/user/appdata/google-drive-organizer
git pull
docker-compose up -d --build
```

## Backup

### Important Data Locations

**SQLite Database:**
```
/mnt/user/appdata/google-drive-organizer/data/organizer.db
```

**Environment Configuration:**
```
/mnt/user/appdata/google-drive-organizer/.env
```

### Backup Script

Add to Unraid user scripts:

```bash
#!/bin/bash
# Backup Google Drive Organizer data

BACKUP_DIR="/mnt/user/backups/google-drive-organizer"
APP_DIR="/mnt/user/appdata/google-drive-organizer"

mkdir -p "$BACKUP_DIR"
cp "$APP_DIR/data/organizer.db" "$BACKUP_DIR/organizer-$(date +%Y%m%d).db"
cp "$APP_DIR/.env" "$BACKUP_DIR/.env-$(date +%Y%m%d)"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name ".env-*" -mtime +30 -delete
```

## Troubleshooting

### Containers Won't Start

Check logs:
```bash
docker logs GoogleDriveOrganizer-Backend
docker logs GoogleDriveOrganizer-Frontend
```

### Can't Access Web UI

1. Check if containers are running in Unraid Docker tab
2. Verify ports aren't in use: `netstat -tulpn | grep -E '3000|3001'`
3. Check firewall rules
4. Verify `VITE_API_URL` matches your backend URL

### OAuth Redirect Errors

1. Verify `GOOGLE_REDIRECT_URI` matches exactly what's in Google Cloud Console
2. Check that backend is accessible at the redirect URI
3. Ensure no trailing slashes in URLs

### Database Locked

If you see "database is locked":
```bash
docker restart GoogleDriveOrganizer-Backend
```

### Network Issues

Ensure both containers are on the same network:
```bash
docker network inspect bridge
```

## Unraid Community Applications Template

If you want to submit this to Community Applications, here's the template format:

Save as `/mnt/user/appdata/google-drive-organizer/template.xml`:

```xml
<?xml version="1.0"?>
<Container version="2">
  <Name>GoogleDriveOrganizer</Name>
  <Repository>ghcr.io/n2nathan/googledrivesortir-backend:latest</Repository>
  <Registry>https://ghcr.io/</Registry>
  <Network>bridge</Network>
  <MyIP/>
  <Shell>sh</Shell>
  <Privileged>false</Privileged>
  <Support>https://github.com/N2Nathan/GoogleDriveSorter/issues</Support>
  <Project>https://github.com/N2Nathan/GoogleDriveSorter</Project>
  <Overview>Intelligent Google Drive file organizer with OCR, AI-powered naming, and client detection. Automatically organizes unorganized files into smart folder structures.</Overview>
  <Category>Cloud: Productivity: Tools:</Category>
  <WebUI>http://[IP]:[PORT:3000]</WebUI>
  <TemplateURL/>
  <Icon>https://raw.githubusercontent.com/N2Nathan/GoogleDriveSorter/main/icon.png</Icon>
  <ExtraParams>--restart=unless-stopped</ExtraParams>
  <PostArgs/>
  <CPUset/>
  <DateInstalled></DateInstalled>
  <DonateText/>
  <DonateLink/>
  <Requires/>
  <Config Name="Backend Port" Target="3001" Default="3001" Mode="tcp" Description="Backend API port" Type="Port" Display="always" Required="true" Mask="false">3001</Config>
  <Config Name="Frontend Port" Target="3000" Default="3000" Mode="tcp" Description="Web UI port" Type="Port" Display="always" Required="true" Mask="false">3000</Config>
  <Config Name="AppData" Target="/app/data" Default="/mnt/user/appdata/google-drive-organizer/data" Mode="rw" Description="Database storage" Type="Path" Display="advanced" Required="true" Mask="false">/mnt/user/appdata/google-drive-organizer/data</Config>
  <Config Name="Google Client ID" Target="GOOGLE_CLIENT_ID" Default="" Mode="" Description="Google OAuth Client ID from Cloud Console" Type="Variable" Display="always" Required="true" Mask="false"></Config>
  <Config Name="Google Client Secret" Target="GOOGLE_CLIENT_SECRET" Default="" Mode="" Description="Google OAuth Client Secret" Type="Variable" Display="always" Required="true" Mask="true"></Config>
  <Config Name="Session Secret" Target="SESSION_SECRET" Default="" Mode="" Description="Random secret for sessions (generate with: openssl rand -base64 32)" Type="Variable" Display="always" Required="true" Mask="true"></Config>
  <Config Name="Google Redirect URI" Target="GOOGLE_REDIRECT_URI" Default="http://[IP]:3001/auth/google/callback" Mode="" Description="OAuth callback URL (replace [IP] with your Unraid IP)" Type="Variable" Display="always" Required="true" Mask="false">http://[IP]:3001/auth/google/callback</Config>
  <Config Name="Frontend URL" Target="FRONTEND_URL" Default="http://[IP]:3000" Mode="" Description="Frontend URL for CORS" Type="Variable" Display="advanced" Required="true" Mask="false">http://[IP]:3000</Config>
  <Config Name="OpenAI API Key" Target="OPENAI_API_KEY" Default="" Mode="" Description="OpenAI API key (optional, for AI features)" Type="Variable" Display="advanced" Required="false" Mask="true"></Config>
  <Config Name="OpenAI Base URL" Target="OPENAI_BASE_URL" Default="" Mode="" Description="Custom OpenAI endpoint for local LLMs (optional)" Type="Variable" Display="advanced" Required="false" Mask="false"></Config>
</Container>
```

## Security Recommendations for Unraid

1. **Use VPN**: Access via VPN instead of exposing to internet
2. **Reverse Proxy with SSL**: Use Nginx Proxy Manager or Swag with Let's Encrypt
3. **Strong Secrets**: Always generate `SESSION_SECRET` with `openssl rand -base64 32`
4. **Regular Updates**: Keep containers updated
5. **Firewall**: Configure Unraid firewall to restrict access
6. **Backup**: Regular backups of appdata

## Support

- **GitHub Issues**: https://github.com/N2Nathan/GoogleDriveSorter/issues
- **Unraid Forums**: Post in Docker Support
- **Logs**: Always include container logs when reporting issues

## Performance Tips

1. **SSD Cache**: Store appdata on SSD cache drive for better performance
2. **Docker Image Location**: Keep Docker image on cache drive
3. **Database Maintenance**: Periodically vacuum the SQLite database:
   ```bash
   docker exec GoogleDriveOrganizer-Backend sqlite3 /app/data/organizer.db "VACUUM;"
   ```

## Additional Resources

- **Unraid Docker Docs**: https://wiki.unraid.net/Docker
- **Google OAuth Setup**: See main README.md
- **Local LLM Guide**: See DOCKER_README.md
