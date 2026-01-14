# Error Handling and Logging

Comprehensive error handling and logging system for json.rocks.

## Overview

The error handling system provides:
- **Deduplicated logging** - Prevents log spam from repeated errors
- **Structured logging** - Consistent format with context
- **Error statistics** - Track error rates and patterns
- **Category-based tracking** - Separate stats for different error types

## Error Categories

### 1. Metascraper Errors (`metascraper`)

**Description**: Errors when metascraper fails to extract metadata from HTML.

**Common Causes**:
- Invalid HTML structure
- Missing required meta tags
- Incompatible content formats
- Plugin-specific failures

**Behavior**:
- Falls back to basic extraction (unfluff)
- Logs warning (not error) since fallback exists
- Error is deduplicated per domain

**Example Log**:
```json
{
  "level": "warn",
  "errorType": "metascraper",
  "message": "Cannot create property 'pkgName' on string '<'",
  "url": "https://example.com/page",
  "domain": "example.com",
  "fallback": "basic_extraction",
  "reqId": "req-123",
  "timestamp": "2026-01-14T08:00:00.000Z"
}
```

### 2. Unfluff Errors (`unfluff`)

**Description**: Errors when unfluff extractor fails.

**Common Causes**:
- Severely malformed HTML
- Empty response body
- Non-HTML content
- Encoding issues

**Behavior**:
- Falls back to minimal extraction (empty fields)
- Logs warning with context
- Error is deduplicated per domain

**Example Log**:
```json
{
  "level": "warn",
  "errorType": "unfluff",
  "message": "Cannot read property 'text' of undefined",
  "url": "https://example.com/page",
  "domain": "example.com",
  "fallback": "basic_extraction",
  "reqId": "req-124"
}
```

### 3. Network Errors (`network`)

**Description**: Errors during HTTP requests.

**Common Causes**:
- DNS resolution failures (ENOTFOUND)
- Connection refused (ECONNREFUSED)
- Timeouts (ETIMEDOUT)
- SSL/TLS errors
- Content size limit exceeded

**Behavior**:
- Returns appropriate HTTP error code to client
- Logs error with network error code
- Error is deduplicated per domain

**Example Log**:
```json
{
  "level": "warn",
  "errorType": "network",
  "message": "getaddrinfo ENOTFOUND invalid-domain.com",
  "url": "https://invalid-domain.com",
  "domain": "invalid-domain.com",
  "errorCode": "ENOTFOUND",
  "reqId": "req-125"
}
```

### 4. Validation Errors (`validation`)

**Description**: Security validation failures.

**Common Causes**:
- Domain not in allowlist
- Blocked IP addresses
- Null byte injection attempts
- Control characters in URL
- Invalid protocols

**Behavior**:
- Returns 403 Forbidden
- Logs validation failure reason
- Error is deduplicated per domain

**Example Log**:
```json
{
  "level": "warn",
  "errorType": "validation",
  "message": "Domain not-allowed.com not in allowlist",
  "url": "https://not-allowed.com",
  "domain": "not-allowed.com",
  "validationType": "security",
  "reqId": "req-126"
}
```

## Error Deduplication

### How It Works

1. **Error Key Generation**: Combines error type, domain, and message
   ```javascript
   const errorKey = `${errorType}:${domain}:${message}`
   ```

2. **Recent Error Cache**: LRU cache with 5-minute TTL
   - Max 1000 unique errors tracked
   - Automatic cleanup after 5 minutes
   - Per-domain deduplication

3. **Suppression Counting**:
   - First occurrence: Logged with full context
   - Subsequent occurrences: Suppressed, counter incremented
   - Summary logged when TTL expires

### Example

**First Error** (logged):
```
[metascraper] Error occurred: Cannot create property 'pkgName' on string '<'
Domain: github.com
```

**Next 50 identical errors** (suppressed):
```
(suppressed, count: 50)
```

**After 5 minutes** (summary):
```
[metascraper] Summary: 50 similar errors suppressed for github.com
```

## Error Statistics

### Tracking

Error counts are tracked globally for each category:

```javascript
const errorStats = {
  metascraper: { count: 1234, lastError: "..." },
  unfluff: { count: 45, lastError: "..." },
  network: { count: 678, lastError: "..." },
  validation: { count: 90, lastError: "..." }
}
```

### Viewing Statistics

**Via Health Endpoint**:
```bash
curl "http://localhost:9980/health?stats=true"
```

**Response**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-01-14T08:00:00.000Z",
  "errorStats": {
    "metascraper": {
      "total": 1234,
      "lastError": "Cannot create property 'pkgName' on string '<'"
    },
    "unfluff": {
      "total": 45,
      "lastError": "Cannot read property 'text' of undefined"
    },
    "network": {
      "total": 678,
      "lastError": "getaddrinfo ENOTFOUND invalid-domain.com"
    },
    "validation": {
      "total": 90,
      "lastError": "Domain not-allowed.com not in allowlist"
    }
  },
  "cache": {
    "size": 42,
    "max": 100,
    "recentErrorsTracked": 156
  }
}
```

## Logging Levels

### When to Use Each Level

**DEBUG**: Detailed diagnostic information
- Not currently used (can be added for development)

**INFO**: Normal operational messages
- Server startup
- Configuration loading
- Successful requests (via Fastify)

**WARN**: Something unexpected but handled
- Metascraper failures (has fallback)
- Unfluff failures (has fallback)
- Network errors (user informed)
- Validation failures (expected behavior)

**ERROR**: Serious problems requiring attention
- File system failures
- Unhandled exceptions
- Internal logic errors

### Current Usage

Most errors are logged as **WARN** because:
- They have fallback mechanisms
- They don't prevent service operation
- They're expected in normal operation
- Users receive appropriate error responses

## Configuration

### Environment Variables

**LOG_LEVEL** (future):
```bash
LOG_LEVEL=debug   # Show all logs
LOG_LEVEL=info    # Normal operation (default)
LOG_LEVEL=warn    # Only warnings and errors
LOG_LEVEL=error   # Only errors
```

**LOG_FORMAT** (future):
```bash
LOG_FORMAT=json   # Structured JSON (production)
LOG_FORMAT=pretty # Human-readable (development)
```

### Error Deduplication TTL

Currently hardcoded to 5 minutes:
```javascript
const recentErrors = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
})
```

**Future**: Make configurable via environment variable
```bash
ERROR_DEDUP_TTL_MINUTES=5
```

## Best Practices

### 1. Context-Rich Logging

Always include:
- URL being processed
- Domain (for deduplication)
- Request ID (for tracing)
- Error type/category
- Fallback strategy used

**Good**:
```javascript
logDedupedError(fastify.log, 'metascraper', err.message, {
  url: uri,
  domain: extractDomain(uri),
  fallback: 'basic_extraction',
  reqId: request.id
})
```

**Bad**:
```javascript
console.log('Error:', err.message)
```

### 2. Appropriate Error Levels

**Use WARN when**:
- Error has a fallback
- Service can continue
- User gets valid response
- Error is expected occasionally

**Use ERROR when**:
- No fallback available
- Service degraded
- Requires immediate attention
- Unexpected condition

### 3. Deduplicate Similar Errors

**Deduplicate**: Same error from same domain
**Don't deduplicate**: Different errors or different domains

### 4. Provide User-Friendly Messages

**To User** (via API response):
```json
{
  "error": "Request timeout",
  "message": "The request took too long to complete"
}
```

**In Logs** (technical details):
```json
{
  "errorType": "network",
  "message": "ETIMEDOUT: socket hang up",
  "url": "https://slow-site.com",
  "errorCode": "ETIMEDOUT"
}
```

## Monitoring and Alerts

### Recommended Monitoring

1. **Error Rate Thresholds**:
   - Alert if metascraper errors > 50% of requests
   - Alert if network errors > 20% of requests
   - Alert if validation errors spike suddenly

2. **Error Pattern Detection**:
   - Same error from many domains = code bug
   - Same error from one domain = site-specific issue
   - Sudden increase in specific error = external issue

3. **Health Check Integration**:
   ```bash
   # Monitor error rates
   curl "http://localhost:9980/health?stats=true" | jq '.errorStats'

   # Alert if metascraper errors > 1000
   if [ $(curl -s "http://localhost:9980/health?stats=true" | jq '.errorStats.metascraper.total') -gt 1000 ]; then
     echo "High metascraper error rate"
   fi
   ```

## Troubleshooting

### High Metascraper Error Rate

**Symptoms**: Many "Cannot create property" errors

**Causes**:
- Metascraper plugin bug
- Site HTML structure changed
- New content type not supported

**Solutions**:
1. Check if errors are from specific domains
2. Update metascraper plugins
3. Add domain to exclude list (use unfluff only)
4. Report bug to metascraper project

### High Network Error Rate

**Symptoms**: Many ENOTFOUND, ETIMEDOUT, ECONNREFUSED errors

**Causes**:
- DNS issues
- Target sites down
- Firewall blocking
- Rate limiting by target sites

**Solutions**:
1. Check DNS resolution
2. Verify network connectivity
3. Check firewall rules
4. Implement retry logic with exponential backoff

### High Validation Error Rate

**Symptoms**: Many "Domain not in allowlist" errors

**Causes**:
- Users requesting non-allowed domains
- New popular domain not added
- Misconfiguration

**Solutions**:
1. Review requested domains
2. Add popular domains to allowlist
3. Communicate allowlist policy to users
4. Provide self-service domain request process

## Performance Impact

### Deduplication Cache

**Memory**: ~1MB for 1000 unique errors
**CPU**: Negligible (hash lookups are O(1))
**Benefit**: Reduced log volume (can save 90%+ in high-error scenarios)

### Structured Logging

**Overhead**: ~1-5ms per log entry
**Benefit**: Easier parsing, better monitoring, contextual debugging

### Error Statistics

**Memory**: ~500 bytes
**CPU**: Negligible (simple counter increments)
**Benefit**: Real-time error rate monitoring without log analysis

## Future Enhancements

1. **Configurable Log Levels**:
   - Environment variable support
   - Per-category log levels
   - Runtime log level changes

2. **Error Aggregation**:
   - Hourly error summaries
   - Top 10 failing domains
   - Error trend analysis

3. **External Logging**:
   - Sentry integration
   - CloudWatch logs
   - Elasticsearch/Kibana

4. **Smart Error Recovery**:
   - Automatic retry with exponential backoff
   - Per-domain extractor selection
   - Adaptive timeout adjustment

5. **Alert Integration**:
   - Webhook notifications
   - Email alerts
   - Slack integration

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) - Domain configuration
- [test/README.md](../test/README.md) - Test suite documentation

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
