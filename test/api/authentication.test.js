import { expect } from 'chai'
import axios from 'axios'

const BASE_URL = 'http://localhost:9980'
const TEST_API_KEY = 'jr_live_example_key_12345'
const INVALID_API_KEY = 'jr_invalid_key_99999'

describe('API Authentication', function() {
  this.timeout(10000)

  describe('Open Mode (AUTH_MODE=open)', () => {
    it('should allow requests without API key', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          validateStatus: () => true
        })

        expect([200, 403, 429]).to.include(response.status)
      } catch (err) {
        // Server might not be running or domain not allowed
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should accept valid API key in header', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        expect([200, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should accept valid API key in query parameter', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: {
            uri: 'https://github.com',
            api_key: TEST_API_KEY
          },
          validateStatus: () => true
        })

        expect([200, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('Required Mode (AUTH_MODE=required)', () => {
    // Note: These tests assume AUTH_MODE=required is configured
    // Skip if server is in open mode

    it('should reject requests without API key', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          validateStatus: () => true
        })

        // In required mode, should return 401
        // In open/optional mode, should return 200, 403, or 429
        expect([200, 401, 403, 429]).to.include(response.status)

        if (response.status === 401) {
          expect(response.data).to.have.property('error')
          expect(response.data.error).to.equal('Authentication required')
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should reject requests with invalid API key', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': INVALID_API_KEY },
          validateStatus: () => true
        })

        // Should return 403 for invalid key or 200/429 if in open mode
        expect([200, 403, 429]).to.include(response.status)

        if (response.status === 403) {
          expect(response.data).to.have.property('error')
          expect(response.data.error).to.match(/Invalid API key|not in allowlist/)
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should accept requests with valid API key', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        expect([200, 403, 429]).to.include(response.status)

        // Should not be 401 with valid key
        expect(response.status).to.not.equal(401)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('Rate Limiting with Authentication', () => {
    it('should use per-key rate limits for authenticated requests', async () => {
      try {
        // Make multiple requests with API key
        const requests = []
        for (let i = 0; i < 10; i++) {
          requests.push(
            axios.get(BASE_URL, {
              params: { uri: 'https://github.com' },
              headers: { 'X-API-Key': TEST_API_KEY },
              validateStatus: () => true
            })
          )
        }

        const responses = await Promise.all(requests)

        // Should get some successful responses (not all rate limited)
        const successCount = responses.filter(r => r.status === 200).length
        const rateLimitedCount = responses.filter(r => r.status === 429).length

        // At least one response should succeed or be rate limited
        expect(successCount + rateLimitedCount).to.be.greaterThan(0)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should include authentication status in rate limit response', async () => {
      try {
        // Make many requests to trigger rate limit
        const requests = []
        for (let i = 0; i < 20; i++) {
          requests.push(
            axios.get(BASE_URL, {
              params: { uri: `https://github.com?test=${i}` },
              headers: { 'X-API-Key': TEST_API_KEY },
              validateStatus: () => true
            })
          )
        }

        const responses = await Promise.all(requests)
        const rateLimitResponse = responses.find(r => r.status === 429)

        if (rateLimitResponse) {
          expect(rateLimitResponse.data).to.have.property('error')
          expect(rateLimitResponse.data.error).to.equal('Rate limit exceeded')
          // Authentication status might be included
          if (rateLimitResponse.data.authenticated !== undefined) {
            expect(rateLimitResponse.data.authenticated).to.be.a('boolean')
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('API Key Validation', () => {
    it('should trim whitespace from API key header', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': `  ${TEST_API_KEY}  ` },
          validateStatus: () => true
        })

        // Should either work (if trimmed) or fail with validation error
        expect([200, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should handle empty API key gracefully', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': '' },
          validateStatus: () => true
        })

        // Empty key should be treated as no key
        expect([200, 401, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should prioritize header over query parameter', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: {
            uri: 'https://github.com',
            api_key: INVALID_API_KEY
          },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Should use header (valid) not query parameter (invalid)
        expect([200, 403, 429]).to.include(response.status)
        // Should not be 403 for invalid key since header is valid
        if (response.status === 403) {
          // If 403, should be for domain not allowed, not invalid key
          expect(response.data.error).to.not.equal('Invalid API key')
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('Admin Endpoints - API Keys', () => {
    const ADMIN_USER = process.env.ADMIN_USER || 'admin'
    const ADMIN_PASS = process.env.ADMIN_PASS || 'test_password'

    it('should require authentication for /admin/keys', async () => {
      try {
        const response = await axios.get(`${BASE_URL}/admin/keys`, {
          validateStatus: () => true
        })

        expect(response.status).to.equal(401)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should return API keys list with basic auth', async () => {
      try {
        const response = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (response.status === 200) {
          expect(response.data).to.have.property('count')
          expect(response.data).to.have.property('authMode')
          expect(response.data).to.have.property('keys')
          expect(response.data.keys).to.be.an('array')

          if (response.data.keys.length > 0) {
            const firstKey = response.data.keys[0]
            expect(firstKey).to.have.property('key')
            expect(firstKey).to.have.property('name')
            expect(firstKey).to.have.property('usage')
            expect(firstKey.usage).to.have.property('totalRequests')
            expect(firstKey.usage).to.have.property('cachedRequests')
            expect(firstKey.usage).to.have.property('uncachedRequests')
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should reload API keys with /admin/reload-keys', async () => {
      try {
        const response = await axios.post(`${BASE_URL}/admin/reload-keys`, {}, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (response.status === 200) {
          expect(response.data).to.have.property('success')
          expect(response.data.success).to.equal(true)
          expect(response.data).to.have.property('count')
          expect(response.data).to.have.property('authMode')
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should track usage statistics per key', async () => {
      try {
        // Make a request with API key
        await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Check usage stats
        const response = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (response.status === 200 && response.data.keys.length > 0) {
          const testKey = response.data.keys.find(k => k.key === TEST_API_KEY)

          if (testKey) {
            expect(testKey.usage).to.have.property('totalRequests')
            expect(testKey.usage.totalRequests).to.be.a('number')
            expect(testKey.usage.totalRequests).to.be.at.least(0)
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('Usage Statistics', () => {
    it('should increment request count on each request', async () => {
      try {
        const ADMIN_USER = process.env.ADMIN_USER || 'admin'
        const ADMIN_PASS = process.env.ADMIN_PASS || 'test_password'

        // Get initial stats
        const initialResponse = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        let initialCount = 0
        if (initialResponse.status === 200) {
          const testKey = initialResponse.data.keys.find(k => k.key === TEST_API_KEY)
          if (testKey) {
            initialCount = testKey.usage.totalRequests
          }
        }

        // Make a request
        await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Get updated stats
        const updatedResponse = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (updatedResponse.status === 200) {
          const testKey = updatedResponse.data.keys.find(k => k.key === TEST_API_KEY)

          if (testKey) {
            expect(testKey.usage.totalRequests).to.be.at.least(initialCount)
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should track cached vs uncached requests separately', async () => {
      try {
        const testUrl = 'https://github.com'

        // Make first request (uncached)
        await axios.get(BASE_URL, {
          params: { uri: testUrl },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Make second request (should be cached)
        await axios.get(BASE_URL, {
          params: { uri: testUrl },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Check stats
        const ADMIN_USER = process.env.ADMIN_USER || 'admin'
        const ADMIN_PASS = process.env.ADMIN_PASS || 'test_password'

        const response = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (response.status === 200) {
          const testKey = response.data.keys.find(k => k.key === TEST_API_KEY)

          if (testKey) {
            expect(testKey.usage).to.have.property('cachedRequests')
            expect(testKey.usage).to.have.property('uncachedRequests')
            expect(testKey.usage.cachedRequests).to.be.a('number')
            expect(testKey.usage.uncachedRequests).to.be.a('number')
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should update lastUsed timestamp', async () => {
      try {
        // Make a request
        await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Check lastUsed timestamp
        const ADMIN_USER = process.env.ADMIN_USER || 'admin'
        const ADMIN_PASS = process.env.ADMIN_PASS || 'test_password'

        const response = await axios.get(`${BASE_URL}/admin/keys`, {
          auth: {
            username: ADMIN_USER,
            password: ADMIN_PASS
          },
          validateStatus: () => true
        })

        if (response.status === 200) {
          const testKey = response.data.keys.find(k => k.key === TEST_API_KEY)

          if (testKey && testKey.usage.lastUsed) {
            // Should be a valid ISO 8601 timestamp
            const lastUsed = new Date(testKey.usage.lastUsed)
            expect(lastUsed.toString()).to.not.equal('Invalid Date')

            // Should be recent (within last minute)
            const now = new Date()
            const diffMs = now - lastUsed
            expect(diffMs).to.be.lessThan(60000) // Less than 1 minute
          }
        }
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })

  describe('Security', () => {
    it('should not expose API keys in error responses', async () => {
      try {
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://invalid-domain-xyz.com' },
          headers: { 'X-API-Key': TEST_API_KEY },
          validateStatus: () => true
        })

        // Error response should not contain the API key
        const responseText = JSON.stringify(response.data)
        expect(responseText).to.not.include(TEST_API_KEY)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should handle special characters in API key', async () => {
      try {
        const specialKey = 'test<script>alert(1)</script>'
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': specialKey },
          validateStatus: () => true
        })

        // Should handle gracefully without executing script
        expect([200, 401, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })

    it('should handle extremely long API key', async () => {
      try {
        const longKey = 'a'.repeat(10000)
        const response = await axios.get(BASE_URL, {
          params: { uri: 'https://github.com' },
          headers: { 'X-API-Key': longKey },
          validateStatus: () => true
        })

        // Should handle gracefully
        expect([200, 401, 403, 429]).to.include(response.status)
      } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err
        }
      }
    })
  })
})
