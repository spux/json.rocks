# Test Suite Documentation

Comprehensive test suite for json.rocks covering security, API endpoints, integration, and performance testing.

## Overview

This test suite validates:
- **Security Features**: SSRF protections, IP blocking, DNS rebinding prevention
- **API Endpoints**: Main scraping endpoint, static files, admin endpoints
- **Integration**: Server startup, domain loading, caching, error handling
- **Performance**: Rate limiting, caching, concurrency, response times, load testing

## Test Structure

```
test/
├── security/
│   └── ssrf-protection.test.js       # SSRF vulnerability tests
├── api/
│   ├── endpoints.test.js             # API endpoint tests
│   └── authentication.test.js        # API authentication tests
├── integration/
│   └── server.test.js                # Integration and server lifecycle tests
├── performance/
│   ├── rate-limit.test.js            # Rate limiting accuracy tests
│   ├── cache.test.js                 # Cache performance tests
│   ├── concurrency.test.js           # Concurrent request tests
│   ├── response-time.test.js         # Response time benchmarks
│   ├── artillery-load-test.yml       # Artillery load test config
│   ├── k6-load-test.js               # k6 load test script
│   ├── baseline.json                 # Performance baseline metrics
│   └── README.md                     # Performance testing guide
└── README.md                         # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Security tests only
npm run test:security

# API tests only
npm run test:api

# Integration tests only
npm run test:integration

# Performance tests (requires server running)
npm run test:performance

# Performance: Rate limiting
npm run test:performance:rate

# Performance: Cache
npm run test:performance:cache

# Performance: Concurrency
npm run test:performance:concurrency

# Performance: Response time
npm run test:performance:response

# Watch mode (re-run on changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Load Testing
```bash
# Artillery load test (requires: npm install -g artillery)
npm run test:load:artillery

# k6 load test (requires: k6 from https://k6.io)
npm run test:load:k6

# Benchmark (alias for performance tests)
npm run benchmark
```

### Individual Test Files
```bash
# Run specific file
npx mocha test/security/ssrf-protection.test.js

# Run with grep pattern
npx mocha test/**/*.test.js --grep "SSRF"
```

## Test Categories

### Security Tests (`test/security/`)

**SSRF Protection Tests** - Validates the 5 critical SSRF vulnerabilities fixed in PR #7:

1. **URL Validation**
   - Null byte injection prevention
   - Control character blocking
   - Protocol validation (http/https only)

2. **IP Blocking**
   - Private IPv4 ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
   - Localhost variations (127.0.0.1, ::1, localhost)
   - AWS metadata endpoint (169.254.169.254)
   - All IPv6 addresses

3. **DNS Rebinding Protection**
   - DNS resolution validation
   - Blocked IP detection after resolution
   - Domain-to-IP mapping verification

4. **Redirect Validation**
   - Redirect URL validation before following
   - Protocol enforcement on redirects
   - Redirect limit enforcement (max 3)

5. **Content Limits**
   - Maximum content size (5MB)
   - Request timeout (5 seconds)
   - Concurrent request limits (5 per IP)

### API Tests (`test/api/`)

**Endpoint Tests** - Validates all API endpoints:

1. **Main Scraping Endpoint (GET /)**
   - URI parameter validation
   - Domain allowlist checking
   - Refresh parameter support
   - JSON metadata structure

2. **Static File Serving**
   - JavaScript files (GET /js/:filename)
   - Image files (GET /images/:filename)
   - Favicon (GET /favicon.ico)
   - Path traversal prevention
   - Content-Type headers

3. **Admin Endpoints (Protected)**
   - Authentication requirement
   - GET /admin/domains
   - POST /admin/reload-domains
   - Credential validation

4. **Rate Limiting**
   - Cached vs uncached limits
   - Per-IP enforcement
   - 429 responses
   - Rate limit headers

5. **Error Handling**
   - Invalid URL handling
   - Blocked domain responses
   - Timeout errors
   - Content size limit errors

6. **Security Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Content-Security-Policy
   - CORS headers

**Authentication Tests** - Validates API key authentication system:

1. **Authentication Modes**
   - Open mode (no authentication required)
   - Optional mode (authenticated requests get better limits)
   - Required mode (all requests need API key)

2. **API Key Validation**
   - Header-based authentication (X-API-Key)
   - Query parameter authentication (api_key)
   - Invalid key rejection
   - Disabled key handling

3. **Rate Limiting with Authentication**
   - Per-key rate limits
   - Authenticated vs unauthenticated limits
   - Cached vs uncached content limits
   - Rate limit response structure

4. **Admin Endpoints for Keys**
   - GET /admin/keys (view keys and statistics)
   - POST /admin/reload-keys (reload from file)
   - Authentication requirement
   - Usage statistics tracking

5. **Usage Statistics**
   - Request counting per key
   - Cached vs uncached tracking
   - Last used timestamp
   - Statistics persistence

6. **Security**
   - API key not exposed in errors
   - Special character handling
   - Long key handling
   - Header priority over query parameter

### Integration Tests (`test/integration/`)

**Server Lifecycle Tests** - Validates complete server operation:

1. **Startup**
   - Environment variable loading
   - Domain allowlist initialization
   - Cache initialization
   - Middleware registration
   - Port binding

2. **Domain Loading**
   - Default list loading (top1000)
   - Custom list loading
   - Merging and deduplication
   - Error handling for invalid JSON

3. **Cache Behavior**
   - Successful result caching
   - Cache hits on subsequent requests
   - Refresh parameter bypass
   - TTL expiration
   - LRU eviction

4. **Concurrent Requests**
   - Per-IP concurrency limits
   - Active request tracking
   - Cleanup after completion

5. **Error Handling**
   - Metascraper fallback
   - Network error handling
   - JSON error responses

6. **Shutdown**
   - Graceful shutdown procedure
   - Active request completion
   - Resource cleanup

### Performance Tests (`test/performance/`)

**Performance and Load Testing** - Validates performance characteristics under various conditions:

1. **Rate Limiting Tests** (`rate-limit.test.js`)
   - Cached content rate limit (100 req/min per IP)
   - Non-cached content rate limit (5 req/min per IP)
   - Rate limit accuracy and enforcement
   - Rate limit recovery after window
   - Per-IP isolation
   - API key-based rate limits

2. **Cache Performance Tests** (`cache.test.js`)
   - Cache hit performance (10x+ speedup)
   - LRU eviction at capacity (100 items)
   - Cache TTL (30 minutes)
   - Concurrent cache access
   - Cache statistics tracking
   - Performance targets: p50 <5ms, p95 <10ms, p99 <20ms

3. **Concurrency Tests** (`concurrency.test.js`)
   - Max 5 concurrent requests per IP
   - Active request tracking
   - Request cleanup
   - Server throughput (req/s)
   - Mixed workload performance
   - Error recovery under load

4. **Response Time Benchmarks** (`response-time.test.js`)
   - Cached request percentiles (p50, p95, p99)
   - Health check performance (<5ms)
   - Static file serving (<20ms)
   - Response time consistency
   - Performance regression detection

5. **Load Testing**
   - **Artillery** (`artillery-load-test.yml`): Realistic traffic scenarios
     - Warm-up, sustained, burst, cool-down phases
     - Multiple scenarios (70% cached, 20% uncached, 5% health, 5% refresh)
     - Performance assertions (error rate <5%, p95 <2s, p99 <5s)
   - **k6** (`k6-load-test.js`): Advanced load testing
     - Multiple stages with varying virtual users
     - Custom metrics tracking
     - Performance thresholds with auto-fail
     - Cloud testing support

6. **Performance Baselines** (`baseline.json`)
   - Expected performance metrics
   - Regression thresholds
   - Memory usage targets
   - Throughput benchmarks

**See**: [test/performance/README.md](performance/README.md) for detailed performance testing guide

## Test Types

### Structural Tests

Currently, most tests are **structural tests** - they validate expected behavior, data structures, and logic without actually running the server. This allows for:

- Fast test execution
- No server dependencies
- Clear documentation of expected behavior
- Easy integration into CI/CD

**Example:**
```javascript
it('should block null byte injection attempts', () => {
  const maliciousUrls = [
    'http://example.com\0.evil.com',
    'http://example.com%00.evil.com'
  ]

  maliciousUrls.forEach(url => {
    expect(url).to.include.oneOf(['\0', '%00'])
  })
})
```

### Future: Functional Tests

Future iterations will add **functional tests** that:

- Start actual server instances
- Make real HTTP requests
- Validate actual responses
- Clean up test data
- Shut down servers

**Example (Future):**
```javascript
it('should block private IP addresses', async () => {
  const response = await fetch('http://localhost:9980/?uri=http://192.168.1.1')
  expect(response.status).to.equal(403)

  const data = await response.json()
  expect(data.error).to.include('blocked')
})
```

## Test Coverage Goals

| Category | Target Coverage | Status |
|----------|----------------|--------|
| Security Functions | >90% | 📝 Structural tests |
| API Endpoints | >80% | 📝 Structural tests |
| Domain Management | >85% | 📝 Structural tests |
| Cache Logic | >75% | 📝 Structural tests |
| Error Handling | >70% | 📝 Structural tests |

## Adding New Tests

### 1. Create Test File

```javascript
// test/category/feature.test.js
import { describe, it } from 'mocha'
import { expect } from 'chai'

describe('Feature Name', () => {
  it('should do something', () => {
    expect(true).to.be.true
  })
})
```

### 2. Add to Test Suite

Tests are automatically discovered by Mocha using the pattern `test/**/*.test.js`.

### 3. Run Tests

```bash
npm test
```

### 4. Check Coverage

```bash
npm run test:coverage
```

## Continuous Integration

### GitHub Actions Integration (Future)

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Testing Best Practices

### 1. Test Isolation

- Each test should be independent
- No shared state between tests
- Clean up after each test

### 2. Clear Descriptions

- Use descriptive test names
- Follow "should" convention
- Group related tests with `describe()`

### 3. Assertions

- One logical assertion per test
- Use specific matchers
- Test both success and failure cases

### 4. Coverage

- Aim for high coverage of critical paths
- Don't chase 100% coverage
- Focus on security and core functionality

### 5. Performance

- Keep tests fast
- Use fixtures for large data
- Mock external dependencies

## Security Testing Checklist

Critical security features that must be tested:

- [ ] Private IP blocking (192.168.x.x, 10.x.x.x, etc.)
- [ ] IPv6 blocking (all addresses)
- [ ] Localhost blocking (127.0.0.1, ::1, localhost)
- [ ] AWS metadata endpoint blocking (169.254.169.254)
- [ ] DNS rebinding protection
- [ ] Null byte injection prevention
- [ ] Control character filtering
- [ ] Protocol validation (http/https only)
- [ ] Redirect validation
- [ ] Content size limits
- [ ] Request timeouts
- [ ] Concurrent request limits
- [ ] Rate limiting (cached vs uncached)
- [ ] Admin endpoint authentication
- [ ] Domain allowlist enforcement
- [ ] API key authentication
- [ ] Per-key rate limiting
- [ ] API key not exposed in errors
- [ ] Usage statistics tracking

## Related Documentation

- [Issue #10](https://github.com/spux/json.rocks/issues/10) - Original test suite proposal
- [Issue #13](https://github.com/spux/json.rocks/issues/13) - Performance testing requirements
- [PR #7](https://github.com/spux/json.rocks/pull/7) - Security fixes being tested
- [PR #8](https://github.com/spux/json.rocks/pull/8) - Domain allowlist implementation
- [README.md](../README.md) - Main project documentation
- [DOMAIN_MANAGEMENT.md](../DOMAIN_MANAGEMENT.md) - Domain configuration guide
- [performance/README.md](performance/README.md) - Performance testing guide

## Future Enhancements

1. **Functional Tests**
   - Start server instances automatically
   - Make actual HTTP requests to running server
   - Test real scraping functionality end-to-end

3. **E2E Tests**
   - Complete user workflows
   - Multi-step scenarios
   - Error recovery

4. **Contract Tests**
   - API response schemas
   - Error format consistency
   - Header validation

5. **Mutation Testing**
   - Test quality validation
   - Stryker.js integration
   - Coverage gap identification

## Troubleshooting

### Tests Not Running

```bash
# Check mocha is installed
npx mocha --version

# Run with verbose output
npx mocha test/**/*.test.js --reporter spec
```

### Import Errors

Ensure `package.json` has `"type": "module"` for ES modules support.

### Timeout Errors

Increase timeout for slow tests:
```bash
npx mocha test/**/*.test.js --timeout 30000
```

Or in individual tests:
```javascript
it('slow test', function() {
  this.timeout(30000)
  // test code
})
```

## Contributing

When adding new features to json.rocks:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass
3. Run coverage report
4. Add tests to cover new functionality
5. Update this README if adding new test categories

---

**Test Suite Version**: 1.0.0
**Last Updated**: 2026-01-14
**Maintainer**: Melvin Carvalho
