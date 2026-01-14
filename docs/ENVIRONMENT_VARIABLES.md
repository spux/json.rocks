# Environment Variables Reference

Complete reference for all environment variables and configuration options in json.rocks.

## Overview

json.rocks can be configured using:
1. **Environment variables** - Set before starting the server
2. **Command line arguments** - Override environment variables
3. **Configuration files** - API keys and domain allowlists

## Environment Variables

### Server Configuration

#### NODE_ENV

**Description**: Node.js environment mode

**Values**: `development`, `production`, `test`

**Default**: `development`

**Example**:
```bash
NODE_ENV=production
```

**Effects**:
- **Production**: Optimized logging, minimal stack traces, performance optimizations
- **Development**: Verbose logging, detailed error messages, easier debugging
- **Test**: Special handling for test suites

**Recommendation**: Always set to `production` in production deployments

---

### Authentication

#### AUTH_MODE

**Description**: API authentication mode

**Values**: `open`, `optional`, `required`

**Default**: `open`

**Example**:
```bash
AUTH_MODE=optional
```

**Modes**:
- **open**: No authentication required, public API access
- **optional**: Authenticated requests get higher rate limits
- **required**: All requests must include valid API key

**Added in**: v0.0.67 (API Authentication feature)

**See also**: [API_AUTHENTICATION.md](API_AUTHENTICATION.md)

---

#### ADMIN_USER

**Description**: Username for admin endpoints authentication

**Default**: `admin`

**Required**: No (defaults to 'admin')

**Example**:
```bash
ADMIN_USER=myadmin
```

**Used for**:
- `GET /admin/domains` - View allowed domains
- `POST /admin/reload-domains` - Reload domain configuration
- `GET /admin/keys` - View API keys and statistics
- `POST /admin/reload-keys` - Reload API keys

**Security note**: Use a non-default username for better security

---

#### ADMIN_PASS

**Description**: Password for admin endpoints authentication

**Default**: None

**Required**: **Yes** (admin endpoints will be disabled if not set)

**Example**:
```bash
ADMIN_PASS=secure-random-password-here
```

**Security requirements**:
- Minimum 16 characters recommended
- Use cryptographically random password
- Never commit to version control
- Rotate regularly (every 90 days)
- Different password per environment

**Generate secure password**:
```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Impact**: If not set, all admin endpoints will return an error

---

## Command Line Arguments

Command line arguments override environment variables and defaults.

### --port

**Description**: HTTP server port

**Default**: `9980`

**Example**:
```bash
node bin/server.js --port 8080
```

**Environment variable equivalent**: None (command line only)

**Valid range**: 1-65535

**Recommendations**:
- Use ports > 1024 for non-root users
- Common choices: 3000, 8080, 9980
- Production: Use reverse proxy (nginx) on port 80/443

---

### --scheme

**Description**: Server protocol scheme

**Values**: `http`, `https`

**Default**: `http`

**Example**:
```bash
node bin/server.js --scheme https --key /path/to/key.pem --cert /path/to/cert.pem
```

**Notes**:
- Requires `--key` and `--cert` when using `https`
- In production, typically use nginx/Cloudflare for HTTPS termination
- Direct HTTPS mode requires valid SSL certificates

---

### --key

**Description**: Path to SSL private key (for HTTPS mode)

**Default**: `./privkey.pem`

**Example**:
```bash
node bin/server.js --scheme https --key /etc/letsencrypt/live/json.rocks/privkey.pem
```

**Required when**: `--scheme https`

**File permissions**: Recommend 600 (readable only by owner)

**Certificate sources**:
- Let's Encrypt (recommended, free)
- Commercial CA (DigiCert, GlobalSign, etc.)
- Self-signed (development/testing only)

---

### --cert

**Description**: Path to SSL certificate (for HTTPS mode)

**Default**: `./fullchain.pem`

**Example**:
```bash
node bin/server.js --scheme https --cert /etc/letsencrypt/live/json.rocks/fullchain.pem
```

**Required when**: `--scheme https`

**Note**: Should be full chain certificate including intermediates

---

### --filter

**Description**: Content filter (legacy feature)

**Default**: `null`

**Example**:
```bash
node bin/server.js --filter "some-filter"
```

**Status**: Legacy parameter, rarely used

---

### --searx

**Description**: Searx instance URL (legacy feature)

**Default**: `https://search.inetol.net/`

**Example**:
```bash
node bin/server.js --searx https://my-searx-instance.com/
```

**Status**: Legacy parameter, rarely used

---

### --fullhtml

**Description**: Return full HTML content (legacy feature)

**Default**: `false`

**Example**:
```bash
node bin/server.js --fullhtml true
```

**Status**: Legacy parameter, rarely used

---

## Configuration Files

### data/api-keys.json

**Description**: API key configuration for authentication

**Location**: `data/api-keys.json`

**Format**: JSON

**Example**:
```json
{
  "version": "1.0.0",
  "description": "API keys for json.rocks authentication",
  "keys": [
    {
      "key": "jr_live_production_key_abc123xyz",
      "name": "Production App",
      "description": "Main production application",
      "created": "2026-01-14T00:00:00Z",
      "enabled": true,
      "rateLimit": {
        "cached": 1000,
        "uncached": 100,
        "daily": 10000
      },
      "domains": ["*"]
    }
  ]
}
```

**See also**: [API_AUTHENTICATION.md](API_AUTHENTICATION.md)

**Git**: Excluded from version control (use `data/api-keys.example.json` as template)

---

### data/allowed-domains-top1000.json

**Description**: Default domain allowlist (top 1000 domains)

**Location**: `data/allowed-domains-top1000.json`

**Format**: JSON

**Example**:
```json
{
  "version": "1.0.0",
  "description": "Top 1000 domains from Tranco list",
  "source": "https://tranco-list.eu/",
  "lastUpdated": "2026-01-14",
  "domains": [
    "google.com",
    "youtube.com",
    "facebook.com"
  ]
}
```

**See also**: [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md)

**Git**: Committed to version control

---

### data/allowed-domains-custom.json

**Description**: Custom domain allowlist (user-added domains)

**Location**: `data/allowed-domains-custom.json`

**Format**: JSON

**Example**:
```json
{
  "version": "1.0.0",
  "description": "Custom domains for specific use cases",
  "domains": [
    "mycompany.com",
    "partner-site.com"
  ]
}
```

**See also**: [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md)

**Git**: Excluded from version control

---

## Hardcoded Configuration

Some configuration values are currently hardcoded in the source code. These may become configurable in future versions.

### MAX_CONTENT_SIZE

**Current value**: `5 * 1024 * 1024` (5MB)

**Description**: Maximum content size to fetch from target URLs

**Location**: `bin/server.js:59`

**Future**: May become environment variable `MAX_CONTENT_SIZE_MB`

---

### MAX_CONCURRENT_REQUESTS

**Current value**: `5`

**Description**: Maximum concurrent requests per IP address

**Location**: `bin/server.js:60`

**Future**: May become environment variable `MAX_CONCURRENT_REQUESTS_PER_IP`

---

### Cache Configuration

**Memory Cache**:
- **Max items**: `100`
- **TTL**: `1800000` ms (30 minutes)
- **Location**: `bin/server.js:38-42`

**Future**: May become environment variables:
- `CACHE_MEMORY_MAX_ITEMS`
- `CACHE_MEMORY_TTL_SECONDS`

---

### Error Deduplication Cache

**Configuration**:
- **Max errors**: `1000`
- **TTL**: `300000` ms (5 minutes)
- **Location**: `bin/server.js:45-48`

**Future**: May become environment variable `ERROR_DEDUP_TTL_MINUTES`

---

### Rate Limiting (Default)

**Cached requests**: `100` per minute per IP/key

**Uncached requests**: `5` per minute per IP/key

**Window**: `1 minute`

**Location**: `bin/server.js:389-414`

**Note**: Can be overridden per API key in `data/api-keys.json`

**Future**: May become environment variables:
- `RATE_LIMIT_CACHED_DEFAULT`
- `RATE_LIMIT_UNCACHED_DEFAULT`

---

## Configuration Precedence

When multiple configuration sources are available, this is the order of precedence (highest to lowest):

1. **Command line arguments** (e.g., `--port 8080`)
2. **Environment variables** (e.g., `AUTH_MODE=required`)
3. **Configuration files** (e.g., `data/api-keys.json`)
4. **Hardcoded defaults** (in source code)

**Example**:
```bash
# Port will be 8080 (command line overrides default)
node bin/server.js --port 8080

# Port will be 3000 (no command line arg)
PORT=3000 node bin/server.js

# Port will be 9980 (default)
node bin/server.js
```

---

## Environment Variable Best Practices

### Development

**Use .env file** (not committed to git):
```bash
# .env.development
NODE_ENV=development
ADMIN_USER=admin
ADMIN_PASS=dev-password-123
AUTH_MODE=open
```

**Load with dotenv**:
```bash
# Install dotenv
npm install dotenv

# Load and run
node -r dotenv/config bin/server.js
```

---

### Production

**Use system environment**:
```bash
# /etc/environment (system-wide)
NODE_ENV=production
ADMIN_PASS=secure-production-password

# Or in systemd service
[Service]
Environment="NODE_ENV=production"
EnvironmentFile=/etc/json-rocks/environment
```

**Never**:
- ❌ Commit `.env` files with secrets
- ❌ Use weak passwords
- ❌ Share credentials between environments
- ❌ Log environment variables

**Always**:
- ✅ Use strong random passwords
- ✅ Rotate credentials regularly
- ✅ Use different credentials per environment
- ✅ Store secrets in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## Example Configurations

### Minimal Development Setup

```bash
# Start with defaults (open mode, no auth required)
node bin/server.js
```

### Development with Admin Access

```bash
export NODE_ENV=development
export ADMIN_PASS=dev-password
node bin/server.js --port 3000
```

### Production Setup

```bash
export NODE_ENV=production
export ADMIN_USER=admin
export ADMIN_PASS=$(cat /run/secrets/admin-pass)
export AUTH_MODE=optional
node bin/server.js --port 9980
```

### Production with HTTPS

```bash
export NODE_ENV=production
export ADMIN_PASS=$(cat /run/secrets/admin-pass)
export AUTH_MODE=required
node bin/server.js \
  --scheme https \
  --key /etc/letsencrypt/live/json.rocks/privkey.pem \
  --cert /etc/letsencrypt/live/json.rocks/fullchain.pem \
  --port 9443
```

### Docker

```bash
docker run -d \
  -e NODE_ENV=production \
  -e ADMIN_PASS=secure-password \
  -e AUTH_MODE=optional \
  -p 9980:9980 \
  -v $(pwd)/data:/app/data \
  json-rocks:latest
```

### PM2 Ecosystem

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'json-rocks',
    script: './bin/server.js',
    env_production: {
      NODE_ENV: 'production',
      ADMIN_USER: 'admin',
      ADMIN_PASS: process.env.ADMIN_PASS,
      AUTH_MODE: 'optional'
    }
  }]
}
```

---

## Troubleshooting

### "ADMIN_PASS environment variable not set"

**Problem**: Admin endpoints return error

**Solution**:
```bash
export ADMIN_PASS=your-secure-password
```

### Port Already in Use

**Problem**: `EADDRINUSE: address already in use`

**Solution**:
```bash
# Use different port
node bin/server.js --port 8080

# Or kill existing process
lsof -ti:9980 | xargs kill
```

### Invalid SSL Certificate

**Problem**: HTTPS mode fails to start

**Solution**:
- Verify certificate paths are correct
- Check file permissions (readable by user)
- Ensure certificate is valid and not expired
- Use full chain certificate

### Environment Variables Not Loading

**Problem**: Variables seem ignored

**Solution**:
- Verify export: `echo $ADMIN_PASS`
- Check spelling (case-sensitive)
- Restart service after setting variables
- For systemd, use `systemctl daemon-reload`

---

## Future Environment Variables

These variables are planned for future releases:

**Logging**:
- `LOG_LEVEL` - Logging verbosity (trace, debug, info, warn, error)
- `LOG_FORMAT` - Log format (json, pretty)

**Caching**:
- `CACHE_MEMORY_MAX_ITEMS` - Memory cache size
- `CACHE_MEMORY_TTL_SECONDS` - Memory cache TTL
- `CACHE_DISK_ENABLED` - Enable/disable disk cache

**Security**:
- `MAX_CONTENT_SIZE_MB` - Maximum content size
- `MAX_CONCURRENT_REQUESTS_PER_IP` - Concurrent request limit
- `REQUEST_TIMEOUT_SECONDS` - HTTP request timeout

**Rate Limiting**:
- `RATE_LIMIT_CACHED_DEFAULT` - Default cached rate limit
- `RATE_LIMIT_UNCACHED_DEFAULT` - Default uncached rate limit

**Domains**:
- `ALLOWED_DOMAINS_DEFAULT_PATH` - Path to default allowlist
- `ALLOWED_DOMAINS_CUSTOM_PATH` - Path to custom allowlist

---

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [API_AUTHENTICATION.md](API_AUTHENTICATION.md) - API key authentication
- [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) - Domain allowlist configuration
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Production deployment guide
- [ERROR_HANDLING.md](ERROR_HANDLING.md) - Error logging and monitoring

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
