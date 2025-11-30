# Apollo Integration Deployment Guide

## 📋 Prerequisites

### Required Services
- **Redis** (6.0+) - For caching and queue management
- **Supabase** - PostgreSQL database
- **Apollo.io Account** - With API access
- **OpenAI API Key** (Optional) - For AI-powered lead scoring
- **Clerk** - Authentication configured

### Environment Requirements
- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Git** for version control

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Configure Environment Variables
Create a `.env.production` file or set in Vercel dashboard:

```env
# Apollo Configuration
APOLLO_API_KEY=your_apollo_api_key
APOLLO_WEBHOOK_SECRET=your_webhook_secret

# Redis Configuration (Use Upstash Redis for Vercel)
REDIS_HOST=your-redis-instance.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_TLS=true

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_ALLOWED_ORG_ID=your_org_id
```

#### 3. Deploy to Vercel
```bash
# Deploy to production
vercel --prod

# Or connect GitHub repo for automatic deployments
vercel link
```

#### 4. Set Up Redis (Upstash)
1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy connection details to environment variables
4. Enable eviction policy: `allkeys-lru`

#### 5. Configure Webhooks
In your Apollo.io account:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://your-domain.vercel.app/api/apollo/webhooks`
3. Select events to subscribe to
4. Copy webhook secret to `APOLLO_WEBHOOK_SECRET`

### Option 2: Self-Hosted (VPS/Docker)

#### 1. Server Requirements
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 22.04 LTS or similar

#### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 for process management
npm install -g pm2

# Install nginx for reverse proxy
sudo apt install nginx -y
```

#### 3. Clone and Build Application
```bash
# Clone repository
git clone https://github.com/your-repo/chimera.git
cd chimera

# Install dependencies
npm install --legacy-peer-deps

# Build application
npm run build

# Run database migrations
npx supabase db push
```

#### 4. Configure PM2 Ecosystem File
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'chimera-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'chimera-workers',
      script: './scripts/workers.ts',
      interpreter: 'tsx',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
```

#### 5. Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

#### 6. Configure Nginx
Create `/etc/nginx/sites-available/chimera`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook endpoint with larger body size
    location /api/apollo/webhooks {
        proxy_pass http://localhost:3000/api/apollo/webhooks;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 10M;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/chimera /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. Set Up SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### Option 3: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps --only=production

# Copy application files
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - redis
    restart: unless-stopped

  workers:
    build: .
    command: npm run workers:start
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

#### 3. Deploy with Docker
```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## 🔧 Post-Deployment Configuration

### 1. Database Setup
```bash
# Run migrations
npx supabase db push

# Seed initial data (optional)
npm run seed
```

### 2. Queue Worker Management

#### Start Workers
```bash
npm run workers:start
```

#### Check Worker Status
```bash
npm run workers:status
```

#### Monitor Queue Metrics
```bash
npm run workers:metrics
```

### 3. Monitoring Setup

#### Application Monitoring
- Set up application monitoring with services like:
  - **Sentry** for error tracking
  - **LogRocket** for session replay
  - **DataDog** or **New Relic** for APM

#### Queue Monitoring Dashboard
Access the built-in monitoring dashboard at:
```
https://your-domain.com/dashboard/prospecting
```

Navigate to the "Monitoring" tab to view:
- System health status
- Queue metrics
- API usage statistics
- Playbook execution logs

### 4. Configure Webhooks

#### Apollo Webhooks
1. Log into Apollo.io
2. Navigate to Settings → Integrations → Webhooks
3. Add webhook endpoint: `https://your-domain.com/api/apollo/webhooks`
4. Subscribe to events:
   - Person Updated
   - Company Updated
   - List Member Added
   - List Member Removed

### 5. Set Up Cron Jobs

#### Scheduled Tasks
Add to crontab for scheduled operations:

```bash
# Daily cache cleanup (2 AM)
0 2 * * * curl -X POST https://your-domain.com/api/apollo/cache/cleanup

# Weekly metrics report (Monday 9 AM)
0 9 * * 1 curl -X GET https://your-domain.com/api/apollo/metrics/weekly

# Hourly health check
0 * * * * curl -X GET https://your-domain.com/api/apollo/health
```

## 📊 Performance Optimization

### 1. Redis Configuration
Edit `/etc/redis/redis.conf`:

```conf
# Set max memory
maxmemory 2gb

# Set eviction policy
maxmemory-policy allkeys-lru

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Enable AOF
appendonly yes
appendfsync everysec
```

### 2. Node.js Optimization
Set environment variables:

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable cluster mode
WEB_CONCURRENCY=4
```

### 3. Database Optimization

#### Create Indexes
```sql
-- Speed up lead queries
CREATE INDEX idx_leads_organization_score ON leads(organization_id, score DESC);
CREATE INDEX idx_leads_email ON leads(email);

-- Speed up Apollo data queries
CREATE INDEX idx_apollo_people_email ON apollo_people(email);
CREATE INDEX idx_apollo_companies_domain ON apollo_companies(domain);

-- Speed up queue operations
CREATE INDEX idx_enrichment_queue_status ON lead_enrichment_queue(status, priority);
```

### 4. CDN Configuration
For static assets, configure a CDN:

```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['cdn.your-domain.com'],
  },
  assetPrefix: process.env.NODE_ENV === 'production'
    ? 'https://cdn.your-domain.com'
    : '',
};
```

## 🔒 Security Checklist

### Environment Variables
- [ ] All sensitive keys are in environment variables
- [ ] `.env` files are in `.gitignore`
- [ ] Production uses different keys than development
- [ ] Webhook secrets are randomly generated

### API Security
- [ ] Rate limiting is configured
- [ ] API keys are rotated regularly
- [ ] Webhook signatures are validated
- [ ] CORS is properly configured

### Infrastructure
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Database connections use SSL
- [ ] Redis requires authentication
- [ ] Regular security updates applied

## 🚨 Troubleshooting

### Common Issues

#### 1. Workers Not Processing Jobs
```bash
# Check worker status
npm run workers:status

# Restart workers
pm2 restart chimera-workers

# Check Redis connection
redis-cli ping
```

#### 2. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 restart chimera-app --max-memory-restart 1G

# Clear Redis cache
redis-cli FLUSHDB
```

#### 3. Webhook Failures
```bash
# Check webhook logs
pm2 logs chimera-app --lines 100 | grep webhook

# Test webhook endpoint
curl -X POST https://your-domain.com/api/apollo/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Apollo-Signature: test" \
  -d '{"event":"test","data":{}}'
```

#### 4. Database Connection Issues
```bash
# Test Supabase connection
npx supabase db remote status

# Check connection pool
pm2 logs chimera-app | grep "database"
```

## 📈 Scaling Guidelines

### Horizontal Scaling
- Add more worker instances for queue processing
- Use Redis Cluster for distributed caching
- Implement database read replicas
- Use load balancer for multiple app instances

### Vertical Scaling
- Increase server resources as needed:
  - CPU: Add cores for more concurrent processing
  - RAM: Increase for larger cache and more workers
  - Storage: Expand for logs and temporary files

### Performance Targets
- **API Response Time**: < 200ms average
- **Queue Processing**: < 5s per job
- **Cache Hit Rate**: > 60%
- **Uptime**: > 99.9%

## 📝 Maintenance Tasks

### Daily
- Monitor queue status
- Check error logs
- Review API usage

### Weekly
- Analyze performance metrics
- Clean up old cache entries
- Review failed jobs

### Monthly
- Rotate API keys
- Update dependencies
- Backup database
- Review and optimize slow queries

## 🆘 Support

### Logs Location
- **Application Logs**: `~/.pm2/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **Redis Logs**: `/var/log/redis/`

### Monitoring Commands
```bash
# View application logs
pm2 logs chimera-app

# View worker logs
pm2 logs chimera-workers

# Monitor all processes
pm2 monit

# Check system resources
htop
```

### Health Check Endpoints
- **Application Health**: `GET /api/apollo/health`
- **Queue Status**: `GET /api/apollo/queues/status`
- **Cache Stats**: `GET /api/apollo/cache/stats`

---

## Quick Start Commands

```bash
# Development
npm run dev
npm run workers:start

# Production (PM2)
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Production (Docker)
docker-compose up -d

# Monitoring
npm run workers:status
npm run workers:metrics
pm2 monit
```

For additional support, consult the [Apollo API Documentation](./APOLLO_API_DOCUMENTATION.md) and [Testing Guide](./APOLLO_TESTING_GUIDE.md).