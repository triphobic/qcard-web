# QCard Web - Production Deployment Guide

This guide covers deploying the QCard Next.js web application to production using Docker, Dokploy, or other container platforms.

## Prerequisites

- Node.js 18+ (for building locally)
- Docker and Docker Compose
- Supabase project configured
- API Gateway/Backend services running
- Custom domain (recommended)

## Quick Start - Docker

### 1. Create Production Environment

```bash
cp .env.example .env.production.local
```

Edit `.env.production.local`:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Backend API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
# OR for development:
# NEXT_PUBLIC_API_URL=http://localhost:10000

# Application Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# OR for development:
# NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### 2. Build Docker Image

```bash
docker build -t qcard-web:latest .
```

The multi-stage Dockerfile:
1. **Deps Stage**: Installs production dependencies
2. **Builder Stage**: Builds Next.js application
3. **Runner Stage**: Runs production-optimized app

### 3. Run Container Locally

```bash
docker run -p 3002:3002 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e NEXT_PUBLIC_API_URL=http://localhost:10000 \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3002 \
  qcard-web:latest
```

Visit http://localhost:3002

## Production Deployment

### Option 1: Dokploy Deployment

1. **Create Application in Dokploy**
   - Type: Docker Image
   - Image: qcard-web:latest (or push to registry)

2. **Set Environment Variables** in Dokploy UI:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NODE_ENV=production
   ```

3. **Configure Domain**
   - Add domain in Dokploy settings
   - Enable SSL/TLS (automatic with Let's Encrypt)

4. **Deploy**
   - Dokploy will pull image and start container
   - Access via your domain

### Option 2: Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  web:
    image: qcard-web:latest
    container_name: qcard-web
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - PORT=3002
      - NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
      - NEXT_PUBLIC_APP_URL=https://yourdomain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Deploy:
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Option 3: Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel UI
4. Vercel handles builds and deployment automatically

## Environment Variables

### Required Variables

```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (from Supabase Settings > API)

# API Configuration (REQUIRED)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com (backend API endpoint)

# Application Configuration (RECOMMENDED)
NEXT_PUBLIC_APP_URL=https://yourdomain.com (your web domain)

# Runtime Configuration
NODE_ENV=production
PORT=3002
```

### Optional Variables

```bash
# Next.js Telemetry (disable in production for privacy)
NEXT_TELEMETRY_DISABLED=1
```

## Architecture

```
┌──────────────────────────────┐
│    User Browser (HTTPS)      │
└────────────┬─────────────────┘
             │
      ┌──────▼──────┐
      │Load Balancer│ (optional)
      └──────┬──────┘
             │
      ┌──────▼──────────────────┐
      │  Next.js Web Container  │
      │  (Node.js server)       │
      │  Port 3002              │
      ├─────────────────────────┤
      │ Static Assets (.next)   │
      │ Server-side Rendering   │
      │ API Routes              │
      │ Middleware              │
      └──────┬──────────────────┘
             │
      ┌──────┴──────────────────┐
      │                         │
   ┌──▼────┐          ┌────────▼─┐
   │Supabase│          │ Backend  │
   │(Auth)  │          │ API      │
   └────────┘          │(Port     │
                       │ 10000)   │
                       └──────────┘
```

## Build & Optimization

### Build Size

The multi-stage build in `Dockerfile` produces optimized images:
- Production dependencies only (no devDependencies)
- Next.js standalone mode
- Non-root user (nextjs:nodejs)
- Alpine Linux base (lean image)

### Typical Image Sizes

- Builder stage: ~1.2 GB (includes devDependencies)
- Final image: ~400-500 MB (production only)

### Image Registry

For production, push to Docker registry:

```bash
# Build and tag
docker build -t your-registry/qcard-web:latest .

# Push to registry
docker push your-registry/qcard-web:latest

# Pull in production
docker pull your-registry/qcard-web:latest
```

## Health Checks

### Health Endpoint

The application includes a health check endpoint:

```bash
curl http://localhost:3002/api/health
```

Expected response (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2024-11-28T12:00:00Z"
}
```

### Container Health

Health checks are configured in the Dockerfile:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start period**: 40 seconds

Container automatically restarts if unhealthy.

## SSL/TLS Configuration

### Dokploy (Automatic)

Dokploy handles SSL automatically:
1. Detects domain
2. Generates certificate with Let's Encrypt
3. Auto-renews before expiration

### Manual SSL (nginx/Apache)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Headers

The application is configured with security best practices:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

Managed in Next.js `next.config.js`.

## Performance Optimization

### Caching

```nginx
# Cache static assets
expires 1y;
add_header Cache-Control "public, immutable";
```

### Compression

Gzip compression enabled by default in Next.js.

### Image Optimization

Next.js `<Image>` component automatically:
- Resizes images
- Serves in modern formats (WebP)
- Lazy loads
- Caches optimized versions

### Database Connection

Connections to Supabase are cached and reused.

## Monitoring & Logging

### Container Logs

```bash
# Real-time logs
docker logs -f qcard-web

# Last 100 lines
docker logs --tail=100 qcard-web

# Specific time range
docker logs --since 5m qcard-web
```

### Logging Configuration

Logs use JSON driver with rotation:
- Max file size: 10 MB
- Max files: 3 (rotated)
- Prevents disk space issues

### Error Tracking (Optional)

Consider adding error tracking:
- **Sentry**: Automatic error reporting
- **LogRocket**: Session replay
- **Datadog**: Full observability

## Scaling

### Horizontal Scaling

Multiple instances behind load balancer:

```bash
# Start 3 instances
docker-compose up -d --scale web=3
```

Each instance can handle ~1000 concurrent connections.

### Vertical Scaling

Increase resources in container platform:
- Increase CPU allocation
- Increase memory allocation
- Use faster disk storage

### Caching Layer

Add Redis/Memcached for session caching:

```yaml
redis:
  image: redis:7-alpine
  container_name: qcard-redis
  ports:
    - "6379:6379"
  restart: unless-stopped
```

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker build -t qcard-web:latest .

# Restart container
docker-compose -f docker-compose.production.yml up -d --build
```

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Update package.json and rebuild
npm upgrade
docker build -t qcard-web:latest .
```

### Database Migrations

If needed, run migrations:

```bash
# Inside container
docker-compose exec web npx prisma migrate deploy
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs qcard-web

# Check environment variables
docker inspect qcard-web | grep -A 20 Env

# Check resource availability
docker stats qcard-web
```

### Health check failing

```bash
# Test health endpoint
curl http://localhost:3002/api/health

# Check logs for errors
docker logs qcard-web --tail=50
```

### Connection to backend failing

```bash
# Verify API URL is correct
echo $NEXT_PUBLIC_API_URL

# Test backend connectivity
curl $NEXT_PUBLIC_API_URL/health

# Check network connectivity
docker network inspect bridge
```

### Out of memory

```bash
# Check memory usage
docker stats qcard-web

# Increase limit in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G

# Restart container
docker-compose restart web
```

## Backup & Recovery

### Database

Supabase handles backups automatically. No action needed.

### Static Content

If using S3 for uploads:
1. Enable versioning in S3 bucket
2. Configure lifecycle policies
3. Cross-region replication (optional)

## Next Steps

1. ✅ Set up environment variables
2. ✅ Build Docker image locally
3. ✅ Test health checks
4. ✅ Deploy to production platform
5. ✅ Configure domain and SSL
6. ✅ Set up monitoring
7. ✅ Configure backups
8. ✅ Test end-to-end flows

## Support

For issues:
- Check logs: `docker logs qcard-web`
- Verify environment variables
- Test endpoints: `curl http://localhost:3002/api/health`
- Review this guide

---

**Last Updated**: November 28, 2024
**Status**: Production-Ready
