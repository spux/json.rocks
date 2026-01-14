# Troubleshooting Guide

Common issues, solutions, and debugging techniques for json.rocks.

## Table of Contents

- [Server Issues](#server-issues)
- [Authentication Issues](#authentication-issues)
- [Domain and Security Issues](#domain-and-security-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Debugging Techniques](#debugging-techniques)

---

## Server Issues

### Port Already in Use

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:9980
```

**Causes**:
- Another instance of json.rocks is running
- Different application using port 9980
- Previous instance didn't shut down cleanly

**Solutions**:

```bash
# Check what's using the port
lsof -i:9980
# or
netstat -tulpn | grep 9980

# Kill the process
kill -9 <PID>

# Or use a different port
node bin/server.js --port 8080
# or
PORT=8080 node bin/server.js
```

**Prevention**:
- Use process managers (PM2, systemd) for clean shutdown
- Configure automatic port selection in development

---

### Server Crashes on Startup

**Symptoms**:
- Server starts then immediately exits
- No error message visible
- PM2 shows constant restarts

**Common Causes & Solutions**:

**1. Missing Dependencies**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**2. Corrupt Cache**
```bash
# Clear npm cache
npm cache clean --force
npm install
```

**3. Node Version Mismatch**
```bash
# Check Node version
node --version

# json.rocks requires Node.js 14+
# Update Node.js if needed
nvm install 18
nvm use 18
```

**4. Permission Issues**
```bash
# Check file permissions
ls -la bin/server.js

# Make executable
chmod +x bin/server.js

# Check data directory
mkdir -p data logs
chmod 755 data logs
```

---

### Out of Memory Errors

**Symptoms**:
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
```

**Causes**:
- Memory leak in metascraper
- Too many concurrent requests
- Large response caching

**Solutions**:

```bash
# Increase Node.js heap size
node --max-old-space-size=2048 bin/server.js

# Monitor memory usage
pm2 monit
# or
docker stats json-rocks

# Restart service to clear memory
pm2 restart json-rocks
```

**Prevention**:
- Set `max_memory_restart` in PM2 config
- Monitor memory trends
- Reduce cache size if needed
- Check for memory leaks with `node --inspect`

---

## Authentication Issues

### Admin Endpoints Return Error

**Symptoms**:
```json
{
  "error": "ADMIN_PASS environment variable not set - admin endpoints protected"
}
```

**Cause**: `ADMIN_PASS` environment variable not configured

**Solutions**:

```bash
# Set environment variable
export ADMIN_PASS=your-secure-password

# Restart service
pm2 restart json-rocks

# Or for systemd
echo "ADMIN_PASS=your-secure-password" | sudo tee -a /etc/json-rocks/environment
sudo systemctl restart json-rocks

# Verify it's set
echo $ADMIN_PASS
```

**For Docker**:
```bash
docker run -e ADMIN_PASS=your-password json-rocks:latest
```

---

### 401 Unauthorized on Admin Endpoints

**Symptoms**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized"
}
```

**Causes**:
- Wrong username or password
- Missing basic auth credentials
- Incorrect auth header format

**Solutions**:

```bash
# Test with correct credentials
curl -u admin:your-password http://localhost:9980/admin/domains

# Check ADMIN_USER and ADMIN_PASS settings
echo $ADMIN_USER $ADMIN_PASS

# Verify basic auth format (base64 encoded)
echo -n "admin:your-password" | base64
# Should match: Authorization: Basic <base64>
```

---

### API Key Not Working

**Symptoms**:
- 403 Forbidden with valid API key
- 401 Unauthorized in required mode

**Diagnostic Steps**:

```bash
# 1. Check API keys file exists
ls -la data/api-keys.json

# 2. Validate JSON format
cat data/api-keys.json | jq .

# 3. Check if key is enabled
cat data/api-keys.json | jq '.keys[] | select(.key=="your-key") | .enabled'

# 4. Reload keys
curl -X POST -u admin:password http://localhost:9980/admin/reload-keys

# 5. Check server logs
pm2 logs json-rocks | grep "Loaded.*API keys"
```

**Common Issues**:

**Key is disabled**:
```json
{
  "key": "jr_live_key_123",
  "enabled": false  // Change to true
}
```

**Invalid JSON**:
```bash
# Validate JSON
cat data/api-keys.json | jq .
# If error, fix JSON syntax
```

**Whitespace in key**:
```bash
# Don't include spaces
# Wrong: "X-API-Key:  jr_live_key_123  "
# Right: "X-API-Key: jr_live_key_123"
```

---

## Domain and Security Issues

### Domain Not in Allowlist

**Symptoms**:
```json
{
  "error": "Access denied",
  "message": "Domain example.com not in allowlist"
}
```

**Solutions**:

**Option 1: Add to custom allowlist**
```bash
# Edit custom domains file
nano data/allowed-domains-custom.json

# Add your domain
{
  "version": "1.0.0",
  "domains": [
    "example.com",
    "your-domain.com"
  ]
}

# Reload domains
curl -X POST -u admin:password http://localhost:9980/admin/reload-domains
```

**Option 2: Check current allowlist**
```bash
# View loaded domains
curl -u admin:password http://localhost:9980/admin/domains

# Search for specific domain
curl -u admin:password http://localhost:9980/admin/domains | jq '.allowedDomains[] | select(. | contains("example"))'
```

**See**: [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) for detailed guide

---

### Private IP / Localhost Blocked

**Symptoms**:
```json
{
  "error": "Access denied",
  "message": "Access to private IP addresses is not allowed"
}
```

**Cause**: SSRF protection blocking private IPs

**This is expected behavior** - The service blocks:
- Private IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Localhost (127.0.0.1, ::1)
- AWS metadata (169.254.169.254)
- All IPv6 addresses

**Why**: Prevents Server-Side Request Forgery (SSRF) attacks

**Workaround**: Not recommended to disable in production
- For testing: Use public URLs or deployed test servers
- For development: Deploy test content to public server

**See**: Security fixes in PR #7

---

### SSL Certificate Errors

**Symptoms**:
```
Error: unable to get local issuer certificate
Error: certificate has expired
Error: Hostname/IP does not match certificate
```

**Solutions**:

**For outgoing requests (fetching URLs)**:
```bash
# Not recommended for production
NODE_TLS_REJECT_UNAUTHORIZED=0 node bin/server.js

# Better: Update CA certificates
sudo apt update
sudo apt install --reinstall ca-certificates

# Or for specific site with self-signed cert
# Consider adding to exception list (future feature)
```

**For incoming HTTPS**:
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/json.rocks/fullchain.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew

# Reload server after renewal
pm2 restart json-rocks
```

---

## Performance Issues

### Slow Response Times

**Symptoms**:
- Requests take > 5 seconds
- Timeouts occurring
- Users reporting slowness

**Diagnostic Steps**:

**1. Check if it's cached**
```bash
# First request (slow - fetches from source)
time curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Second request (fast - from cache)
time curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"
```

**2. Check cache hit rate**
```bash
# Get cache stats
curl "http://localhost:9980/health?stats=true" | jq '.cache'
```

**3. Check target site performance**
```bash
# Test target site directly
time curl -I https://target-site.com

# Use refresh to bypass cache
curl "http://localhost:9980/?uri=https://target-site.com&refresh=true"
```

**4. Check server load**
```bash
# System resources
top
htop

# Node.js specific
pm2 monit
```

**Solutions**:

**Target site is slow**:
- This is expected - json.rocks can't be faster than the source
- Consider caching results on your end
- Use `?refresh=false` to serve cached content

**Server is overloaded**:
```bash
# Scale horizontally (add more instances)
pm2 scale json-rocks +2

# Or optimize cache settings
# Increase cache size in bin/server.js
```

**Network issues**:
```bash
# Check DNS resolution
dig target-site.com

# Check network latency
ping target-site.com
traceroute target-site.com
```

---

### Rate Limit Hit Too Often

**Symptoms**:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 5 per 1 minute (non-cached)"
}
```

**Understanding Rate Limits**:
- **Cached content**: 100 requests/minute per IP (or per API key)
- **Non-cached content**: 5 requests/minute per IP (or per API key)

**Solutions**:

**1. Use caching**
```bash
# Same URL gets cached automatically
# Subsequent requests count towards cached limit (100/min)
curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"
curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"  # From cache
```

**2. Use API key with higher limits**
```json
// data/api-keys.json
{
  "keys": [{
    "key": "jr_live_key_123",
    "rateLimit": {
      "cached": 1000,     // Increase from 100
      "uncached": 100      // Increase from 5
    }
  }]
}
```

**3. Reduce request frequency**
```javascript
// Add delay between requests
async function fetchWithDelay(urls) {
  for (const url of urls) {
    await fetch(`https://json.rocks/?uri=${url}`)
    await new Promise(r => setTimeout(r, 12000)) // 12s delay (5/min)
  }
}
```

**4. Batch requests over longer timeframe**
- Spread requests across minutes
- Use queue system
- Implement exponential backoff on 429 errors

---

### High Memory Usage

**Symptoms**:
- Memory usage growing over time
- Eventually crashes with OOM
- PM2 auto-restarts frequently

**Diagnostic Steps**:

```bash
# Monitor memory over time
pm2 monit

# Check heap usage
node --inspect bin/server.js
# Then open chrome://inspect

# Generate heap snapshot
kill -USR2 <pid>
```

**Common Causes**:

**1. Cache size too large**
```javascript
// Check cache size
curl "http://localhost:9980/health?stats=true" | jq '.cache.size'

// Current limit: 100 items
// Consider reducing if memory is an issue
```

**2. Memory leak in metascraper**
```bash
# Check error stats
curl "http://localhost:9980/health?stats=true" | jq '.errorStats'

# High metascraper errors may indicate issue
# Restart service to clear
pm2 restart json-rocks
```

**3. Too many concurrent requests**
```bash
# Current limit: 5 per IP
# Check if being exceeded
# Review logs for 429 errors
pm2 logs json-rocks | grep "concurrent"
```

**Solutions**:

```bash
# Set memory limit with auto-restart
# ecosystem.config.js
max_memory_restart: '500M'

# Increase heap size
node --max-old-space-size=1024 bin/server.js

# Regular restarts
pm2 start json-rocks --cron-restart="0 2 * * *"  # Daily at 2 AM
```

---

## Deployment Issues

### PM2 Process Not Starting

**Symptoms**:
- `pm2 start` exits immediately
- Process shows as "errored" in `pm2 list`
- No logs visible

**Diagnostic Steps**:

```bash
# Check PM2 logs
pm2 logs json-rocks --err

# Try running directly to see error
node bin/server.js

# Check PM2 configuration
cat ecosystem.config.js

# Verify environment
pm2 env json-rocks
```

**Common Issues**:

**1. Environment variable missing**
```javascript
// ecosystem.config.js - Wrong
env_production: {
  ADMIN_PASS: process.env.ADMIN_PASS  // Undefined!
}

// Right
env_production: {
  ADMIN_PASS: 'actual-password-here'
}
```

**2. Working directory incorrect**
```bash
# PM2 must be started from correct directory
cd /opt/json-rocks
pm2 start ecosystem.config.js
```

**3. Permission issues**
```bash
# Check file ownership
ls -la bin/server.js

# Fix permissions
chmod +x bin/server.js
chown -R $USER:$USER .
```

---

### Docker Container Exits Immediately

**Symptoms**:
- Container starts then stops
- `docker ps` shows container not running
- Exit code 1

**Diagnostic Steps**:

```bash
# Check container logs
docker logs json-rocks

# Run interactively to debug
docker run -it --entrypoint /bin/sh json-rocks:latest

# Check if port is exposed
docker ps -a
docker port json-rocks
```

**Common Issues**:

**1. Missing environment variables**
```bash
# Provide all required env vars
docker run -e ADMIN_PASS=password json-rocks:latest
```

**2. Volume permission issues**
```bash
# Fix permissions on host
chmod 755 data logs
chown -R 1000:1000 data logs  # node user UID
```

**3. Health check failing**
```bash
# Disable health check temporarily
docker run --no-healthcheck json-rocks:latest

# Or fix the health check URL
```

---

### systemd Service Fails to Start

**Symptoms**:
```
Job for json-rocks.service failed
```

**Diagnostic Steps**:

```bash
# Check service status
sudo systemctl status json-rocks

# View detailed logs
sudo journalctl -xeu json-rocks

# Test service file syntax
sudo systemd-analyze verify json-rocks.service
```

**Common Issues**:

**1. Environment file missing**
```bash
# Check if exists
ls -la /etc/json-rocks/environment

# Create if missing
sudo mkdir -p /etc/json-rocks
echo "ADMIN_PASS=password" | sudo tee /etc/json-rocks/environment
```

**2. User doesn't exist**
```bash
# Create service user
sudo useradd -r -s /bin/false jsonrocks
```

**3. File paths wrong**
```ini
# Double-check paths in service file
[Service]
WorkingDirectory=/opt/json-rocks  # Must exist
ExecStart=/usr/bin/node /opt/json-rocks/bin/server.js  # Must exist
```

---

## Debugging Techniques

### Enable Verbose Logging

```bash
# Fastify logs all requests
# Check PM2 logs
pm2 logs json-rocks --lines 200

# Or systemd
sudo journalctl -u json-rocks -n 200

# Docker
docker logs json-rocks --tail 200
```

### Test Individual Components

**Test domain loading**:
```bash
# Check what domains are loaded
curl -u admin:password http://localhost:9980/admin/domains | jq '.count'
```

**Test API authentication**:
```bash
# With valid key
curl -H "X-API-Key: jr_live_key_123" "http://localhost:9980/?uri=https://github.com"

# Without key (should work in open mode)
curl "http://localhost:9980/?uri=https://github.com"
```

**Test rate limiting**:
```bash
# Send multiple requests
for i in {1..10}; do
  curl "http://localhost:9980/?uri=https://github.com/page$i"
  echo "Request $i"
done
```

**Test caching**:
```bash
# First request (slow)
time curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Second request (fast)
time curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Force refresh
curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks&refresh=true"
```

### Use Node.js Debugger

```bash
# Start with debugger
node --inspect bin/server.js

# Or with PM2
pm2 start bin/server.js --node-args="--inspect"

# Connect Chrome DevTools
# Open chrome://inspect
```

### Check System Resources

```bash
# Overall system
top
htop

# Disk usage
df -h
du -sh /opt/json-rocks/data/*

# Network connections
netstat -tulpn | grep node

# Open files
lsof -p $(pgrep node)
```

---

## Getting Help

If you can't solve the issue:

1. **Check existing issues**: https://github.com/spux/json.rocks/issues
2. **Gather information**:
   - Error messages (full stack trace)
   - Configuration files (redact secrets)
   - System info (OS, Node version, deployment method)
   - Steps to reproduce
3. **Create issue**: https://github.com/spux/json.rocks/issues/new

**Include**:
```bash
# Node version
node --version

# npm version
npm --version

# OS info
uname -a
cat /etc/os-release

# Service status
pm2 status
# or
sudo systemctl status json-rocks
# or
docker ps -a

# Recent logs
pm2 logs json-rocks --lines 50
```

---

## Related Documentation

- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Configuration reference
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Deployment guides
- [API_AUTHENTICATION.md](API_AUTHENTICATION.md) - Authentication setup
- [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) - Domain configuration
- [ERROR_HANDLING.md](ERROR_HANDLING.md) - Error logging system

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
