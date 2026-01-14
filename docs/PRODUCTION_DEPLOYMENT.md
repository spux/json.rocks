# Production Deployment Guide

Comprehensive guide for deploying json.rocks in production environments.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Methods](#deployment-methods)
- [Security Hardening](#security-hardening)
- [Monitoring & Observability](#monitoring--observability)
- [Backup & Recovery](#backup--recovery)
- [Scaling](#scaling)
- [Performance Tuning](#performance-tuning)

## Pre-Deployment Checklist

Before deploying to production, ensure you have completed these steps:

### Security

- [ ] Set strong `ADMIN_PASS` environment variable (min 16 chars, random)
- [ ] Configure `AUTH_MODE` (`optional` or `required` recommended for production)
- [ ] Set up API keys in `data/api-keys.json` (if using authentication)
- [ ] Review and customize domain allowlist in `data/allowed-domains-custom.json`
- [ ] Configure HTTPS (via reverse proxy or direct)
- [ ] Set `NODE_ENV=production`
- [ ] Review rate limiting configuration
- [ ] Configure firewall rules (allow only necessary ports)
- [ ] Disable unnecessary services on server
- [ ] Set up fail2ban or similar intrusion prevention

### Configuration

- [ ] Choose deployment method (PM2/Docker/systemd/Kubernetes)
- [ ] Prepare configuration files (ecosystem.config.js, docker-compose.yml, etc.)
- [ ] Set up reverse proxy (nginx/Cloudflare/AWS ALB)
- [ ] Configure SSL/TLS certificates (Let's Encrypt recommended)
- [ ] Set up domain DNS records
- [ ] Configure logging destination
- [ ] Set up log rotation
- [ ] Test all admin endpoints
- [ ] Verify domain allowlist works correctly

### Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure application monitoring (PM2, DataDog, New Relic, etc.)
- [ ] Set up error tracking (Sentry, Rollbar, etc.)
- [ ] Configure alerts for critical failures
- [ ] Set up log aggregation (if using multiple instances)
- [ ] Create monitoring dashboard

### Backup

- [ ] Configure automated backups for `data/` directory
- [ ] Test backup restoration procedure
- [ ] Set up backup retention policy
- [ ] Document recovery procedures
- [ ] Store backups in separate location/region

---

## Deployment Methods

### Method 1: PM2 Process Manager (Recommended for Single Server)

PM2 is a production process manager for Node.js with built-in load balancer, monitoring, and auto-restart.

#### Installation

```bash
# Install PM2 globally
npm install -g pm2

# Install json.rocks dependencies
cd /opt/json-rocks
npm install --production
```

#### Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'json-rocks',
    script: './bin/server.js',
    instances: 1,
    exec_mode: 'fork',

    // Production environment
    env_production: {
      NODE_ENV: 'production',
      ADMIN_USER: 'admin',
      ADMIN_PASS: process.env.ADMIN_PASS,
      AUTH_MODE: 'optional'
    },

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Resource limits
    max_memory_restart: '500M',

    // Auto-restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,

    // Disable watch in production
    watch: false
  }]
}
```

#### Start Application

```bash
# Start with ecosystem file
pm2 start ecosystem.config.js --env production

# Or start directly
export ADMIN_PASS=your-secure-password
pm2 start bin/server.js --name json-rocks

# Save PM2 process list for auto-restart on reboot
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided by pm2 startup command
```

#### Management Commands

```bash
# Status
pm2 status
pm2 show json-rocks

# Logs
pm2 logs json-rocks
pm2 logs json-rocks --lines 100

# Restart
pm2 restart json-rocks

# Stop
pm2 stop json-rocks

# Delete
pm2 delete json-rocks

# Monitor
pm2 monit
```

#### PM2 Monitoring

```bash
# Enable PM2 Plus (optional, free tier available)
pm2 link <secret_key> <public_key>

# View monitoring dashboard
pm2 web
```

---

### Method 2: Docker

Docker provides containerization for consistent deployments across environments.

#### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data /app/logs

# Expose port
EXPOSE 9980

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9980/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Run as non-root user
USER node

# Start application
CMD ["node", "bin/server.js"]
```

#### Docker Compose (Production)

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  json-rocks:
    build: .
    container_name: json-rocks
    restart: unless-stopped
    ports:
      - "9980:9980"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - ADMIN_USER=admin
      - ADMIN_PASS=${ADMIN_PASS}
      - AUTH_MODE=optional
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9980/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - json-rocks-net
    labels:
      - "com.json-rocks.service=api"
      - "com.json-rocks.environment=production"

networks:
  json-rocks-net:
    driver: bridge
```

#### Build and Run

```bash
# Build image
docker build -t json-rocks:latest .

# Run with docker-compose
export ADMIN_PASS=your-secure-password
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Restart
docker-compose -f docker-compose.production.yml restart

# Stop
docker-compose -f docker-compose.production.yml down
```

#### Docker Management

```bash
# View running containers
docker ps

# View logs
docker logs json-rocks -f

# Execute command in container
docker exec -it json-rocks sh

# View resource usage
docker stats json-rocks

# Prune unused images (cleanup)
docker image prune -a
```

---

### Method 3: systemd Service

systemd is the standard init system for most Linux distributions.

#### Create Service File

Create `/etc/systemd/system/json-rocks.service`:

```ini
[Unit]
Description=json.rocks - JSON metadata extraction service
Documentation=https://github.com/spux/json.rocks
After=network.target

[Service]
Type=simple
User=jsonrocks
Group=jsonrocks
WorkingDirectory=/opt/json-rocks
ExecStart=/usr/bin/node /opt/json-rocks/bin/server.js
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/etc/json-rocks/environment

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=json-rocks

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/json-rocks/data /opt/json-rocks/logs

# Resource limits
LimitNOFILE=4096
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

#### Environment File

Create `/etc/json-rocks/environment`:

```bash
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
AUTH_MODE=optional
```

#### Setup

```bash
# Create user
sudo useradd -r -s /bin/false jsonrocks

# Create directories
sudo mkdir -p /opt/json-rocks /etc/json-rocks
sudo chown -R jsonrocks:jsonrocks /opt/json-rocks

# Copy files
sudo cp -r /path/to/json.rocks/* /opt/json-rocks/
cd /opt/json-rocks
sudo -u jsonrocks npm install --production

# Set environment file permissions
sudo chmod 600 /etc/json-rocks/environment
sudo chown root:root /etc/json-rocks/environment

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable json-rocks
sudo systemctl start json-rocks
```

#### Management Commands

```bash
# Status
sudo systemctl status json-rocks

# Logs
sudo journalctl -u json-rocks -f

# Restart
sudo systemctl restart json-rocks

# Stop
sudo systemctl stop json-rocks

# Reload configuration
sudo systemctl daemon-reload
sudo systemctl restart json-rocks
```

---

### Method 4: Kubernetes

Kubernetes provides container orchestration for scalable deployments.

#### Deployment Manifest

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: json-rocks
  labels:
    app: json-rocks
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: json-rocks
  template:
    metadata:
      labels:
        app: json-rocks
        version: v1
    spec:
      containers:
      - name: json-rocks
        image: json-rocks:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 9980
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: ADMIN_USER
          value: "admin"
        - name: ADMIN_PASS
          valueFrom:
            secretKeyRef:
              name: json-rocks-secrets
              key: admin-password
        - name: AUTH_MODE
          value: "optional"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 9980
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 9980
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: config
          mountPath: /app/data/allowed-domains-custom.json
          subPath: allowed-domains-custom.json
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: json-rocks-data
      - name: config
        configMap:
          name: json-rocks-config
---
apiVersion: v1
kind: Service
metadata:
  name: json-rocks
  labels:
    app: json-rocks
spec:
  type: LoadBalancer
  selector:
    app: json-rocks
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9980
    name: http
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: json-rocks-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Secret
metadata:
  name: json-rocks-secrets
type: Opaque
stringData:
  admin-password: your-secure-password-here
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: json-rocks-config
data:
  allowed-domains-custom.json: |
    {
      "version": "1.0.0",
      "description": "Custom allowed domains",
      "domains": []
    }
```

#### Deploy

```bash
# Create secret with actual password
kubectl create secret generic json-rocks-secrets \
  --from-literal=admin-password=your-secure-password

# Apply manifests
kubectl apply -f k8s/deployment.yaml

# Check deployment
kubectl get pods -l app=json-rocks
kubectl get svc json-rocks

# View logs
kubectl logs -l app=json-rocks -f

# Scale
kubectl scale deployment json-rocks --replicas=5
```

---

## Security Hardening

### Reverse Proxy (nginx)

Using nginx as a reverse proxy provides additional security and performance.

#### Installation

```bash
sudo apt update
sudo apt install nginx
```

#### Configuration

Create `/etc/nginx/sites-available/json-rocks`:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;

# Upstream backend
upstream json_rocks_backend {
    server localhost:9980;
    keepalive 64;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name json.rocks www.json.rocks;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name json.rocks www.json.rocks;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/json.rocks/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/json.rocks/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/json.rocks/chain.pem;

    # SSL protocols and ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval';" always;

    # Logging
    access_log /var/log/nginx/json-rocks-access.log combined;
    error_log /var/log/nginx/json-rocks-error.log warn;

    # Main API endpoints
    location / {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://json_rocks_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Admin endpoints - IP whitelist
    location /admin/ {
        limit_req zone=admin_limit burst=5 nodelay;

        # Allow only specific IPs (update with your IP range)
        allow 192.168.1.0/24;  # Your office/home network
        allow 10.0.0.0/8;       # Private network
        deny all;

        proxy_pass http://json_rocks_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for admin operations
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://json_rocks_backend;
        access_log off;

        # Allow from monitoring services
        allow all;
    }

    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://json_rocks_backend;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Enable Site

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/json-rocks /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d json.rocks -d www.json.rocks

# Auto-renewal (already setup by certbot)
sudo certbot renew --dry-run
```

---

### Firewall Configuration

#### UFW (Ubuntu/Debian)

```bash
# Reset firewall
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

#### iptables

```bash
# Flush existing rules
sudo iptables -F
sudo iptables -X

# Default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

---

### fail2ban Configuration

Protect against brute force attacks.

```bash
# Install fail2ban
sudo apt install fail2ban

# Create jail for json.rocks
sudo tee /etc/fail2ban/jail.d/json-rocks.conf << EOF
[json-rocks-admin]
enabled = true
port = 80,443
filter = json-rocks-admin
logpath = /var/log/nginx/json-rocks-access.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

# Create filter
sudo tee /etc/fail2ban/filter.d/json-rocks-admin.conf << EOF
[Definition]
failregex = ^<HOST> - .* "(GET|POST) /admin/.* HTTP/.*" 401
            ^<HOST> - .* "(GET|POST) /admin/.* HTTP/.*" 403
ignoreregex =
EOF

# Restart fail2ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status json-rocks-admin
```

---

## Monitoring & Observability

### Health Checks

```bash
# Simple health check
curl http://localhost:9980/health

# With statistics
curl "http://localhost:9980/health?stats=true"

# Monitoring script
#!/bin/bash
HEALTH_URL="http://localhost:9980/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" -eq 200 ]; then
  echo "Service is healthy"
  exit 0
else
  echo "Service is unhealthy (HTTP $RESPONSE)"
  exit 1
fi
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web-based dashboard
pm2 web

# Generate report
pm2 report
```

### Application Logs

```bash
# PM2 logs
pm2 logs json-rocks --lines 100
pm2 logs json-rocks --err
pm2 logs json-rocks --out

# systemd logs
sudo journalctl -u json-rocks -f
sudo journalctl -u json-rocks --since "1 hour ago"
sudo journalctl -u json-rocks -p err

# Docker logs
docker logs json-rocks -f --tail 100
```

### Log Rotation

For PM2, create `/etc/logrotate.d/json-rocks`:

```
/opt/json-rocks/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    copytruncate
}
```

---

## Backup & Recovery

### Backup Strategy

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backups/json-rocks"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/json-rocks_$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup data directory
tar -czf $BACKUP_FILE \
  /opt/json-rocks/data/allowed-domains-custom.json \
  /opt/json-rocks/data/api-keys.json

# Keep only last 30 backups
ls -t $BACKUP_DIR/json-rocks_*.tar.gz | tail -n +31 | xargs -r rm

echo "Backup created: $BACKUP_FILE"
```

### Automated Backups (cron)

```bash
# Add to crontab
crontab -e

# Run backup daily at 2 AM
0 2 * * * /opt/json-rocks/scripts/backup.sh
```

### Restoration

```bash
# Stop service
pm2 stop json-rocks

# Restore from backup
tar -xzf /backups/json-rocks/json-rocks_20260114_020000.tar.gz -C /

# Restart service
pm2 restart json-rocks
```

---

## Scaling

### Horizontal Scaling

For high-traffic deployments, run multiple instances behind a load balancer.

#### Load Balancer (nginx)

```nginx
upstream json_rocks_cluster {
    least_conn;  # Load balancing method

    server 10.0.1.10:9980 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:9980 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:9980 max_fails=3 fail_timeout=30s;

    keepalive 32;
}

server {
    listen 80;

    location / {
        proxy_pass http://json_rocks_cluster;
        # ... other proxy settings
    }
}
```

#### Shared Cache (Redis)

For shared caching across instances, consider integrating Redis (future enhancement).

---

## Performance Tuning

### Node.js Optimization

```bash
# Increase max old space size
node --max-old-space-size=2048 bin/server.js

# Use production mode
NODE_ENV=production node bin/server.js
```

### OS Tuning

```bash
# Increase file descriptors
ulimit -n 65536

# Or permanently in /etc/security/limits.conf
jsonrocks soft nofile 65536
jsonrocks hard nofile 65536

# Increase max connections
echo "net.core.somaxconn=65536" >> /etc/sysctl.conf
sysctl -p
```

---

## Related Documentation

- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Configuration reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [API_AUTHENTICATION.md](API_AUTHENTICATION.md) - API key setup
- [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) - Domain configuration

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
