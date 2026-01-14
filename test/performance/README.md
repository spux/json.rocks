# Performance Testing and Benchmarks

Comprehensive performance testing suite for json.rocks covering rate limiting, caching, concurrency, response times, and load testing.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Suites](#test-suites)
- [Load Testing](#load-testing)
- [Performance Baselines](#performance-baselines)
- [CI/CD Integration](#cicd-integration)
- [Interpreting Results](#interpreting-results)

## Overview

The performance test suite validates:
- **Rate limiting accuracy** - Ensures limits are enforced correctly
- **Cache performance** - Validates cache hit ratios and response times
- **Concurrent request handling** - Tests per-IP concurrency limits
- **Response time benchmarks** - Measures p50, p95, p99 percentiles
- **Load testing** - Simulates production traffic patterns
- **Baseline regression detection** - Alerts on performance degradation

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Optional: Install load testing tools
npm install -g artillery  # For Artillery load tests
# Install k6 from https://k6.io/docs/getting-started/installation/
```

### Run All Performance Tests

```bash
# Start the server
npm start

# In another terminal, run performance tests
npm run test:performance
```

### Run Specific Test Suites

```bash
# Rate limiting tests
npx mocha test/performance/rate-limit.test.js

# Cache performance tests
npx mocha test/performance/cache.test.js

# Concurrency tests
npx mocha test/performance/concurrency.test.js

# Response time benchmarks
npx mocha test/performance/response-time.test.js
```

## Test Suites

### 1. Rate Limiting Tests

**File**: `test/performance/rate-limit.test.js`

**What it tests**:
- Cached content rate limit (100 req/min per IP)
- Non-cached content rate limit (5 req/min per IP)
- Rate limit accuracy and timing
- Rate limit headers
- Rate limit recovery after window expires
- Per-IP rate limiting isolation
- API key-based rate limits

**Key scenarios**:
```javascript
// Test 1: Should allow 100 cached requests per minute
// Test 2: Should enforce 5 uncached requests per minute
// Test 3: Should reset limits after time window
// Test 4: Should apply different limits for API keys
```

**Run**:
```bash
npx mocha test/performance/rate-limit.test.js --timeout 120000
```

### 2. Cache Performance Tests

**File**: `test/performance/cache.test.js`

**What it tests**:
- Cache hit performance (should be 10x+ faster than uncached)
- Cache refresh functionality
- LRU eviction at capacity (100 items)
- Cache TTL (30 minutes)
- Concurrent cache access
- Cache statistics tracking

**Performance targets**:
- Cached p50 < 5ms
- Cached p95 < 10ms
- Cached p99 < 20ms
- Cache speedup > 5x vs uncached

**Run**:
```bash
npx mocha test/performance/cache.test.js
```

### 3. Concurrency Tests

**File**: `test/performance/concurrency.test.js`

**What it tests**:
- Max 5 concurrent requests per IP enforcement
- Active request tracking
- Request cleanup after completion
- Server throughput (requests/second)
- Mixed workload performance
- Error recovery under load

**Run**:
```bash
npx mocha test/performance/concurrency.test.js
```

### 4. Response Time Benchmarks

**File**: `test/performance/response-time.test.js`

**What it tests**:
- Cached request response times (p50, p95, p99)
- Health check performance
- Static file serving
- Response time consistency
- Performance under sustained load
- Baseline regression detection

**Performance targets**:
```
Cached requests:
  p50: <5ms
  p95: <10ms
  p99: <20ms

Health checks:
  p95: <5ms

Static files:
  p95: <20ms
```

**Run**:
```bash
npx mocha test/performance/response-time.test.js
```

## Load Testing

### Artillery (Recommended)

**File**: `test/performance/artillery-load-test.yml`

**Features**:
- Multiple load phases (warm-up, sustained, burst, cool-down)
- Realistic traffic scenarios (cached 70%, uncached 20%, health 5%, refresh 5%)
- Performance assertions (max error rate, p95, p99)
- HTML report generation

**Run**:
```bash
# Basic run
artillery run test/performance/artillery-load-test.yml

# Against production
artillery run test/performance/artillery-load-test.yml --target https://json.rocks

# Generate HTML report
artillery run --output report.json test/performance/artillery-load-test.yml
artillery report report.json
```

**Test phases**:
1. Warm-up: 30s @ 5 req/s
2. Sustained: 60s @ 10 req/s
3. Burst: 30s @ 50 req/s
4. Cool-down: 20s @ 2 req/s

**Performance thresholds**:
- Max error rate: 5%
- p95: <2000ms
- p99: <5000ms

### k6

**File**: `test/performance/k6-load-test.js`

**Features**:
- Multiple scenarios (cached, uncached, health checks)
- Custom metrics tracking
- Performance thresholds with auto-fail
- Cloud testing support

**Run**:
```bash
# Basic run
k6 run test/performance/k6-load-test.js

# Custom VUs and duration
k6 run --vus 10 --duration 30s test/performance/k6-load-test.js

# Against production
BASE_URL=https://json.rocks k6 run test/performance/k6-load-test.js

# Cloud run
k6 cloud test/performance/k6-load-test.js
```

**Test configuration**:
- Stage 1: Ramp to 10 VUs (30s)
- Stage 2: Hold at 10 VUs (1min)
- Stage 3: Ramp to 50 VUs (30s)
- Stage 4: Hold at 50 VUs (1min)
- Stage 5: Ramp down (30s)

**Performance thresholds**:
- p95: <2000ms
- p99 (cached): <500ms
- Error rate: <5%
- Cache hit rate: >80%

### Apache Bench (Simple)

Quick tests using Apache Bench:

```bash
# Test cached requests (100 requests, 10 concurrent)
ab -n 100 -c 10 "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Test rate limiting (200 requests, 1 concurrent)
ab -n 200 -c 1 "http://localhost:9980/?uri=https://example.com/page1"

# Test health endpoint
ab -n 1000 -c 50 "http://localhost:9980/health"
```

## Performance Baselines

**File**: `test/performance/baseline.json`

Contains expected performance metrics for regression detection.

### Key Metrics

**Cached Requests**:
- p50: 5ms
- p95: 10ms
- p99: 20ms

**Uncached Requests**:
- p50: 500ms
- p95: 2000ms
- p99: 4000ms

**Throughput**:
- Cached content: 100 req/s
- Uncached content: 10 req/s

**Memory Usage**:
- Baseline: 100MB
- With full cache: 200MB
- Under load: 500MB

**Cache Hit Rate**: >80%

**Rate Limiting Accuracy**: >99%

### Regression Thresholds

Performance should not degrade more than:
- Cached p95: +20%
- Uncached p95: +20%
- Cache hit rate: -10%
- Memory usage: +50%
- Throughput: -20%

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [gh-pages]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Start server
        run: |
          npm start &
          npx wait-on http://localhost:9980/health

      - name: Run performance tests
        run: npm run test:performance

      - name: Check baselines
        run: |
          # Compare against baseline.json
          # Fail if regression thresholds exceeded

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: test/performance/results/
```

### Local CI

```bash
#!/bin/bash
# scripts/performance-ci.sh

# Start server
npm start &
SERVER_PID=$!

# Wait for server
npx wait-on http://localhost:9980/health

# Run tests
npm run test:performance
TEST_EXIT=$?

# Cleanup
kill $SERVER_PID

exit $TEST_EXIT
```

## Interpreting Results

### Response Times

**Good**:
```
Cached p95: 8ms
Uncached p95: 1500ms
```

**Warning** (approaching limits):
```
Cached p95: 12ms  ⚠️
Uncached p95: 2200ms  ⚠️
```

**Bad** (regression):
```
Cached p95: 25ms  ❌
Uncached p95: 4000ms  ❌
```

### Cache Performance

**Good**:
```
Cache hit rate: 85%
Cache speedup: 15x
```

**Warning**:
```
Cache hit rate: 75%  ⚠️
Cache speedup: 8x  ⚠️
```

**Bad**:
```
Cache hit rate: 60%  ❌
Cache speedup: 3x  ❌
```

### Rate Limiting

**Good**:
```
Enforced at 100 requests (limit: 100)
Accuracy: 99%
```

**Bad**:
```
Enforced at 120 requests (limit: 100)  ❌
Accuracy: 85%  ❌
```

### Load Test

**Good Artillery results**:
```
Total requests: 1800
Success rate: 96%
p95: 150ms
p99: 500ms
Error rate: 4%
```

**Warning**:
```
Success rate: 91%  ⚠️
p95: 500ms  ⚠️
Error rate: 9%  ⚠️
```

**Bad**:
```
Success rate: 85%  ❌
p95: 3000ms  ❌
Error rate: 15%  ❌
```

## Troubleshooting

### High Response Times

**Symptoms**: p95 > 100ms for cached requests

**Possible causes**:
- Cache not working
- High memory usage (GC pauses)
- Disk I/O bottleneck
- Network latency

**Debug**:
```bash
# Check cache stats
curl "http://localhost:9980/health?stats=true" | jq '.cache'

# Monitor memory
pm2 monit

# Check disk I/O
iostat -x 1
```

### Rate Limit Not Enforcing

**Symptoms**: More than expected requests succeeding

**Possible causes**:
- Rate limit window not working
- IP detection issue
- Cache bypassing rate limit

**Debug**:
```bash
# Check if requests are cached
curl -i "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Look for rate limit headers
# X-RateLimit-Limit, X-RateLimit-Remaining
```

### Low Cache Hit Rate

**Symptoms**: Cache hit rate < 60%

**Possible causes**:
- URLs have query parameters that vary
- Cache size too small (100 items)
- TTL too short (30 minutes)
- High proportion of unique URLs

**Debug**:
```bash
# Check cache size
curl "http://localhost:9980/health?stats=true" | jq '.cache.size'

# Monitor cache behavior
# Add unique URLs and watch cache size
```

### Memory Leak

**Symptoms**: Memory usage grows continuously

**Possible causes**:
- Metascraper memory leak
- Unclosed connections
- Growing error cache

**Debug**:
```bash
# Monitor memory over time
watch -n 1 'curl -s "http://localhost:9980/health?stats=true" | jq "{memory: .memory, cache: .cache.size}"'

# Generate heap snapshot
node --inspect bin/server.js
# Then use Chrome DevTools
```

## Best Practices

1. **Run baseline tests weekly** to detect gradual degradation
2. **Test against production-like hardware** for accurate results
3. **Warm up cache** before benchmarking cached performance
4. **Use multiple test tools** (mocha + Artillery + k6) for validation
5. **Monitor system resources** during tests (CPU, memory, disk, network)
6. **Document performance changes** in PRs that affect critical paths
7. **Set realistic thresholds** based on actual production requirements
8. **Test with production traffic patterns** (70% cached, 30% uncached)

## Related Documentation

- [Test Suite README](../README.md) - Main test documentation
- [Production Deployment](../../docs/PRODUCTION_DEPLOYMENT.md) - Deployment guide
- [Error Handling](../../docs/ERROR_HANDLING.md) - Error logging system
- [Issue #13](https://github.com/spux/json.rocks/issues/13) - Original performance testing requirements

---

**Last Updated**: 2026-01-14
**Version**: 1.0.0
