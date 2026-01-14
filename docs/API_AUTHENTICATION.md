# API Authentication

Comprehensive guide for API key authentication and authorization in json.rocks.

## Overview

The API authentication system provides:
- **Flexible authentication modes** - Open, optional, or required
- **Per-key rate limiting** - Custom limits for each API key
- **Usage tracking** - Monitor requests per key
- **Admin management** - Endpoints for key inspection and reload
- **Secure storage** - Keys stored in JSON configuration file

## Authentication Modes

Configure via `AUTH_MODE` environment variable:

### 1. Open Mode (default)

**Behavior**: No authentication required, everyone can access the API.

**Use cases**:
- Public services
- Development/testing
- Low-security environments

**Configuration**:
```bash
AUTH_MODE=open
```

**Rate limits**:
- Cached requests: 100/minute per IP
- Non-cached requests: 5/minute per IP

### 2. Optional Mode

**Behavior**: Authentication is optional. Authenticated requests get higher rate limits.

**Use cases**:
- Public API with premium tier
- Migration from open to required mode
- Mixed public/private usage

**Configuration**:
```bash
AUTH_MODE=optional
```

**Benefits of authentication**:
- Custom rate limits per key
- Usage tracking
- Per-key caching namespace
- Priority processing

**Rate limits**:
- **Unauthenticated**: Same as open mode (100 cached / 5 non-cached per IP)
- **Authenticated**: Custom limits defined in API key configuration

### 3. Required Mode

**Behavior**: All requests must include a valid API key.

**Use cases**:
- Private APIs
- Production environments
- Paid services
- Enterprise deployments

**Configuration**:
```bash
AUTH_MODE=required
```

**Without API key**: 401 Unauthorized
**Invalid API key**: 403 Forbidden

## API Key Configuration

### File Location

API keys are stored in `data/api-keys.json`:

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

### Configuration Fields

#### Required Fields

**key** (string):
- Unique API key identifier
- Recommended format: `jr_live_<environment>_<identifier>`
- Example: `jr_live_production_app1_abc123`
- Min length: 32 characters recommended
- Must be unique across all keys

**name** (string):
- Human-readable name for the key
- Used in admin interface and logs
- Example: "Production Chat App", "Development Testing"

#### Optional Fields

**description** (string):
- Detailed description of key purpose
- Example: "Used by main chat application for link previews"
- Default: empty string

**created** (string, ISO 8601):
- Timestamp when key was created
- Format: "2026-01-14T08:30:00Z"
- Default: current timestamp

**enabled** (boolean):
- Whether the key is active
- Set to `false` to disable without deleting
- Default: `true`

**rateLimit** (object):
- Custom rate limits for this key
- Overrides default limits
- Fields:
  - `cached` (number): Requests/minute for cached content
  - `uncached` (number): Requests/minute for non-cached content
  - `daily` (number): Total requests per day (future use)
- Default: Uses system defaults (100 cached / 5 non-cached)

**domains** (array):
- Allowed domains for this key (future use)
- Use `["*"]` for all domains
- Example: `["example.com", "test.com"]`
- Default: `["*"]`

### Example Configurations

#### High-Traffic Production Key
```json
{
  "key": "jr_live_prod_main_xyz789",
  "name": "Production Main App",
  "description": "Primary production deployment",
  "created": "2026-01-10T00:00:00Z",
  "enabled": true,
  "rateLimit": {
    "cached": 10000,
    "uncached": 1000,
    "daily": 100000
  },
  "domains": ["*"]
}
```

#### Development/Testing Key
```json
{
  "key": "jr_test_development_abc123",
  "name": "Development Environment",
  "description": "For testing and development",
  "created": "2026-01-14T00:00:00Z",
  "enabled": true,
  "rateLimit": {
    "cached": 100,
    "uncached": 20,
    "daily": 5000
  },
  "domains": ["*"]
}
```

#### Disabled Key (Temporarily Suspended)
```json
{
  "key": "jr_live_suspended_def456",
  "name": "Suspended App",
  "description": "Temporarily disabled for policy violation",
  "created": "2026-01-01T00:00:00Z",
  "enabled": false,
  "rateLimit": {
    "cached": 1000,
    "uncached": 100,
    "daily": 10000
  },
  "domains": ["*"]
}
```

## Using API Keys

### Method 1: HTTP Header (Recommended)

Add the `X-API-Key` header to your requests:

```bash
curl -H "X-API-Key: jr_live_production_key_abc123xyz" \
  "https://json.rocks/?uri=https://example.com"
```

**Advantages**:
- More secure (not logged in URL)
- Cleaner URLs
- Standard practice for APIs
- Not cached by browsers

### Method 2: Query Parameter

Add the `api_key` parameter to the URL:

```bash
curl "https://json.rocks/?uri=https://example.com&api_key=jr_live_production_key_abc123xyz"
```

**Advantages**:
- Works without custom headers
- Easy to test in browser
- Simple for quick testing

**Disadvantages**:
- Key visible in URL
- May be logged by proxies/servers
- Less secure

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios')

const response = await axios.get('https://json.rocks/', {
  params: {
    uri: 'https://github.com/spux/json.rocks'
  },
  headers: {
    'X-API-Key': 'jr_live_production_key_abc123xyz'
  }
})

console.log(response.data)
```

### Python

```python
import requests

response = requests.get('https://json.rocks/',
  params={'uri': 'https://github.com/spux/json.rocks'},
  headers={'X-API-Key': 'jr_live_production_key_abc123xyz'}
)

print(response.json())
```

### cURL

```bash
# Using header (recommended)
curl -H "X-API-Key: jr_live_production_key_abc123xyz" \
  "https://json.rocks/?uri=https://example.com"

# Using query parameter
curl "https://json.rocks/?uri=https://example.com&api_key=jr_live_production_key_abc123xyz"
```

## Admin Management

Admin endpoints require HTTP Basic Authentication.

### Environment Variables

```bash
ADMIN_USER=admin                    # Admin username (default: admin)
ADMIN_PASS=your_secure_password     # Admin password (required)
```

### View All API Keys

**Endpoint**: `GET /admin/keys`

**Authentication**: HTTP Basic Auth

**Response**:
```json
{
  "count": 2,
  "authMode": "optional",
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
      "domains": ["*"],
      "usage": {
        "totalRequests": 12847,
        "cachedRequests": 11203,
        "uncachedRequests": 1644,
        "lastUsed": "2026-01-14T08:45:23Z"
      }
    }
  ],
  "configFile": "data/api-keys.json"
}
```

**Usage**:
```bash
curl -u admin:password "https://json.rocks/admin/keys"
```

### Reload API Keys

**Endpoint**: `POST /admin/reload-keys`

**Authentication**: HTTP Basic Auth

**Use case**: Reload keys after editing `data/api-keys.json` without restarting server

**Response**:
```json
{
  "success": true,
  "message": "Reloaded 5 API keys",
  "count": 5,
  "authMode": "optional"
}
```

**Usage**:
```bash
curl -X POST -u admin:password "https://json.rocks/admin/reload-keys"
```

## Usage Statistics

### Per-Key Metrics

The system tracks usage per API key:

**Metrics tracked**:
- `totalRequests`: Total requests made with this key
- `cachedRequests`: Requests served from cache
- `uncachedRequests`: Requests requiring fetch
- `lastUsed`: ISO 8601 timestamp of last request

**Storage**: In-memory (resets on server restart)

**Access**: Via `GET /admin/keys` endpoint

### Viewing Statistics

```bash
# View all keys with usage statistics
curl -u admin:password "https://json.rocks/admin/keys" | jq '.keys[] | {name, usage}'
```

**Example output**:
```json
{
  "name": "Production App",
  "usage": {
    "totalRequests": 12847,
    "cachedRequests": 11203,
    "uncachedRequests": 1644,
    "lastUsed": "2026-01-14T08:45:23Z"
  }
}
```

## Rate Limiting

### How It Works

Rate limiting is based on:
1. **Authentication status**: Authenticated vs anonymous
2. **Cache status**: Cached vs non-cached content
3. **Key configuration**: Per-key custom limits

### Rate Limit Hierarchy

**Priority order** (highest to lowest):

1. **Authenticated with custom limits**: Use key's `rateLimit` configuration
2. **Authenticated without custom limits**: Use default limits (100 cached / 5 non-cached)
3. **Unauthenticated**: Use default limits (100 cached / 5 non-cached)

### Key Generator

Rate limits are tracked per:
- **Authenticated**: `key:<api_key>` - Each API key tracked separately
- **Unauthenticated**: `ip:<ip_address>` - Each IP address tracked separately

This means:
- Different API keys don't share rate limits
- Different IPs don't share rate limits
- Same key from different IPs shares the key's limit

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 100 per 1 minute (cached)",
  "retryAfter": 45000,
  "type": "cached",
  "authenticated": true
}
```

**Fields**:
- `error`: Error type
- `message`: Human-readable message
- `retryAfter`: Milliseconds until rate limit resets
- `type`: "cached" or "non-cached"
- `authenticated`: Whether request was authenticated

## Security Best Practices

### Key Generation

**Recommended key format**:
```
jr_live_<environment>_<identifier>_<random>
```

**Examples**:
- `jr_live_production_app1_a8f3e2c9b1d4`
- `jr_test_development_xyz_9d2e1f8a4c3b`

**Requirements**:
- Minimum 32 characters
- Use cryptographically secure random generation
- Include environment indicator
- Avoid sequential or predictable patterns

**Generate secure keys**:
```bash
# Using openssl (recommended)
echo "jr_live_production_$(openssl rand -hex 16)"

# Using Node.js
node -e "console.log('jr_live_production_' + require('crypto').randomBytes(16).toString('hex'))"
```

### Key Storage

**DO**:
- ✅ Store keys in `data/api-keys.json` (excluded from git)
- ✅ Use environment variables for server admin password
- ✅ Keep backup of keys in secure location
- ✅ Use different keys for different environments
- ✅ Rotate keys periodically

**DON'T**:
- ❌ Commit keys to git repositories
- ❌ Share keys in public channels
- ❌ Use same key across environments
- ❌ Hardcode keys in application code
- ❌ Send keys over unencrypted channels

### Key Management

**Key lifecycle**:

1. **Creation**: Generate secure random key
2. **Configuration**: Add to `data/api-keys.json`
3. **Deployment**: Reload keys via admin endpoint
4. **Monitoring**: Track usage via admin endpoint
5. **Suspension**: Set `enabled: false` if needed
6. **Rotation**: Generate new key, update clients, disable old key
7. **Deletion**: Remove from configuration file

**Key rotation schedule**:
- Production keys: Every 90 days
- Development keys: Every 180 days
- Compromised keys: Immediately

### Secure Transmission

**HTTPS Only**:
- Always use HTTPS in production
- API keys transmitted over HTTP are vulnerable
- Configure SSL/TLS certificates properly

**Header vs Query Parameter**:
- Use `X-API-Key` header (more secure)
- Avoid query parameter in production
- Query parameters may be logged

## Troubleshooting

### 401 Unauthorized

**Error**:
```json
{
  "error": "Authentication required",
  "message": "API key required. Provide via X-API-Key header or api_key query parameter"
}
```

**Causes**:
- `AUTH_MODE=required` but no API key provided
- API key not sent in request

**Solutions**:
1. Add `X-API-Key` header to request
2. Add `api_key` query parameter
3. Change `AUTH_MODE` to `optional` or `open`

### 403 Forbidden

**Error**:
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is invalid or disabled"
}
```

**Causes**:
- API key doesn't exist in configuration
- API key is disabled (`enabled: false`)
- Typo in API key

**Solutions**:
1. Check key in `data/api-keys.json`
2. Verify key is enabled
3. Reload keys: `POST /admin/reload-keys`
4. Verify no whitespace/newlines in key

### Keys Not Loading

**Symptoms**:
- Server shows "Loaded 0 API keys"
- All requests treated as unauthenticated

**Causes**:
- `data/api-keys.json` doesn't exist
- JSON syntax error in file
- File permissions issue

**Solutions**:
1. Check file exists: `ls -la data/api-keys.json`
2. Validate JSON: `cat data/api-keys.json | jq .`
3. Check permissions: `chmod 644 data/api-keys.json`
4. Check server logs for errors
5. Reload: `POST /admin/reload-keys`

### Rate Limits Not Applied

**Symptoms**:
- Custom rate limits ignored
- Getting default limits instead

**Causes**:
- Rate limit configuration missing from key
- Configuration syntax error
- Server not reloaded after config change

**Solutions**:
1. Verify `rateLimit` object in key configuration
2. Reload keys: `POST /admin/reload-keys`
3. Check server logs for errors
4. Test with `GET /admin/keys` to see loaded config

### Statistics Not Updating

**Symptoms**:
- Usage stats show 0 requests
- Stats reset unexpectedly

**Causes**:
- Statistics stored in memory (reset on restart)
- Using different API key than expected
- Requests not authenticated

**Solutions**:
- Check exact key used in requests
- Verify requests are authenticated: check response headers
- Remember: Stats reset on server restart (in-memory only)

## Migration Guide

### From Open to Optional

**Step 1**: Add API keys to `data/api-keys.json`

**Step 2**: Test authenticated requests
```bash
curl -H "X-API-Key: your_key" "https://json.rocks/?uri=https://example.com"
```

**Step 3**: Change mode
```bash
AUTH_MODE=optional
```

**Step 4**: Restart server

**Step 5**: Monitor usage via `/admin/keys`

**Result**: Both authenticated and unauthenticated requests work

### From Optional to Required

**Step 1**: Ensure all clients have API keys

**Step 2**: Monitor usage to verify all traffic is authenticated
```bash
curl -u admin:password "https://json.rocks/admin/keys"
```

**Step 3**: Change mode
```bash
AUTH_MODE=required
```

**Step 4**: Restart server

**Step 5**: Test that unauthenticated requests fail
```bash
curl "https://json.rocks/?uri=https://example.com"
# Should return 401 Unauthorized
```

**Result**: Only authenticated requests work

### From Required to Optional

**Step 1**: Change mode
```bash
AUTH_MODE=optional
```

**Step 2**: Restart server

**Step 3**: Test unauthenticated access
```bash
curl "https://json.rocks/?uri=https://example.com"
# Should work with default rate limits
```

**Result**: Both modes work, authenticated requests get better limits

## Environment Configuration

### Required Environment Variables

None required for basic operation.

### Optional Environment Variables

**AUTH_MODE**:
- Values: `open`, `optional`, `required`
- Default: `open`
- Example: `AUTH_MODE=required`

**ADMIN_USER**:
- Default: `admin`
- Used for admin endpoint authentication
- Example: `ADMIN_USER=superadmin`

**ADMIN_PASS**:
- Required for admin endpoints
- No default (admin endpoints disabled if not set)
- Example: `ADMIN_PASS=your_secure_password_here`

### Example .env File

```bash
# Server configuration
PORT=9980

# Authentication
AUTH_MODE=optional

# Admin access
ADMIN_USER=admin
ADMIN_PASS=super_secure_password_change_me

# Other settings
MAX_CONTENT_SIZE=5242880
MAX_CONCURRENT_REQUESTS=5
```

## Performance Considerations

### Memory Usage

**Per API key**:
- Configuration: ~500 bytes
- Usage stats: ~200 bytes
- Total: ~700 bytes per key

**100 keys**: ~70 KB
**1000 keys**: ~700 KB

### CPU Overhead

**Per request**:
- Key validation: ~0.1ms
- Stats update: ~0.01ms
- Total overhead: ~0.11ms

**Impact**: Negligible (<1% for typical requests)

### Caching Impact

**With API keys**:
- Cache namespace per key
- Different keys don't share cache
- Same key shares cache across IPs

**Example**:
- IP1 with key1: Cache hit
- IP2 with key1: Cache hit (shared)
- IP3 with key2: Cache miss (different namespace)

## Future Enhancements

Planned features:

1. **Daily rate limits**: Enforce `rateLimit.daily` configuration
2. **Domain restrictions**: Enforce `domains` array per key
3. **Key expiration**: Add `expires` field for automatic key expiration
4. **Webhook notifications**: Notify on high usage or rate limit hits
5. **Usage analytics**: Detailed analytics per key
6. **Key scopes**: Different permissions per key (read-only, admin, etc.)
7. **Team management**: Multiple users per organization
8. **Billing integration**: Usage-based billing

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [DOMAIN_MANAGEMENT.md](DOMAIN_MANAGEMENT.md) - Domain allowlist configuration
- [ERROR_HANDLING.md](ERROR_HANDLING.md) - Error logging and monitoring
- [test/README.md](../test/README.md) - Test suite documentation

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
