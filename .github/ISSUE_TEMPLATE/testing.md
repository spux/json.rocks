## Problem

Currently, the project has **zero test coverage** which prevents production deployment and makes refactoring risky.

From recent codebase analysis:
- No test files exist
- Package.json has: `"test": "echo \"Error: no test specified\" && exit 1"`
- No Jest, Mocha, or testing framework installed
- No CI/CD pipeline

This is the **#1 critical gap** preventing production readiness (currently rated 10/100 for testing).

## Proposed Solution

Add comprehensive test coverage using **Jest + Supertest**:

### Phase 1: Core Functionality (Target: 50% coverage)

```javascript
// tests/server.test.js

describe('GET /', () => {
  test('should extract metadata from allowed domain', async () => {
    const response = await request(app)
      .get('/?uri=https://github.com/spux/json.rocks')
      .expect(200)
      .expect('Content-Type', /json/)

    expect(response.body).toHaveProperty('title')
    expect(response.body).toHaveProperty('description')
    expect(response.body).toHaveProperty('image')
  })

  test('should reject non-allowlisted domain', async () => {
    const response = await request(app)
      .get('/?uri=https://malicious-site.com')
      .expect(403)

    expect(response.body.error).toContain('not in allowed domains')
  })

  test('should block private IP addresses (SSRF protection)', async () => {
    const response = await request(app)
      .get('/?uri=http://127.0.0.1')
      .expect(403)
  })

  test('should return cached data on second request', async () => {
    const url = 'https://github.com/spux/json.rocks'
    await request(app).get(`/?uri=${url}`)

    const start = Date.now()
    await request(app).get(`/?uri=${url}`)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100) // Cached should be fast
  })

  test('should respect cache bypass with refresh parameter', async () => {
    const response = await request(app)
      .get('/?uri=https://github.com/spux/json.rocks&refresh=true')
      .expect(200)
  })

  test('should enforce rate limiting', async () => {
    const url = 'https://example.com/test'

    // Make 6 requests (limit is 5/min for non-cached)
    for (let i = 0; i < 6; i++) {
      const response = await request(app).get(`/?uri=${url}${i}`)
      if (i < 5) {
        expect(response.status).toBe(200)
      } else {
        expect(response.status).toBe(429) // Too Many Requests
      }
    }
  })
})

describe('GET /health', () => {
  test('should return OK status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body).toEqual({ status: 'ok' })
  })
})

describe('Security', () => {
  test('should block AWS metadata endpoint', async () => {
    await request(app)
      .get('/?uri=http://169.254.169.254/latest/meta-data/')
      .expect(403)
  })

  test('should enforce max content size', async () => {
    // Test with URL that returns > 5MB
    const response = await request(app)
      .get('/?uri=https://example.com/huge-file')

    expect([413, 503]).toContain(response.status)
  })

  test('should timeout after 5 seconds', async () => {
    const start = Date.now()
    await request(app).get('/?uri=https://httpbin.org/delay/10')
    const duration = Date.now() - start

    expect(duration).toBeLessThan(6000)
  })
})
```

### Phase 2: Integration Tests

- Test metascraper extraction accuracy
- Test platform-specific extractors (YouTube, GitHub, etc.)
- Test search functionality via Searx
- Test admin endpoints

### Phase 3: CI/CD

```yaml
# .github/workflows/test.yml
name: Tests

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

## Implementation Steps

1. **Install dependencies:**
   ```bash
   npm install --save-dev jest supertest
   ```

2. **Update package.json:**
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage"
     },
     "jest": {
       "testEnvironment": "node",
       "coverageThreshold": {
         "global": {
           "branches": 50,
           "functions": 50,
           "lines": 50,
           "statements": 50
         }
       }
     }
   }
   ```

3. **Create test files:**
   - `tests/server.test.js` - Main endpoint tests
   - `tests/security.test.js` - Security feature tests
   - `tests/cache.test.js` - Caching behavior tests
   - `tests/extraction.test.js` - Content extraction tests

4. **Add CI/CD:** GitHub Actions workflow

5. **Add coverage reporting:** Codecov or Coveralls integration

## Expected Impact

- Testing score: 10/100 → 60/100 (+50 points)
- Overall score: 68/100 → 75.5/100 (+7.5 points)
- **Status: Production-ready**

## Acceptance Criteria

- [ ] At least 50% code coverage
- [ ] All security features tested (domain allowlist, IP blocking, rate limiting, SSRF protection)
- [ ] Core endpoint functionality tested
- [ ] Caching behavior verified
- [ ] CI/CD pipeline passing
- [ ] Coverage badge in README

## Priority

**Critical** - This is the #1 remaining gap preventing production deployment.

---

Related: Once testing is in place, refactoring the 738-line server.js becomes much safer.
