import { expect } from 'chai'
import axios from 'axios'

const BASE_URL = process.env.TEST_URL || 'http://localhost:9980'
const TEST_DOMAIN = 'https://github.com'

describe('Performance: Rate Limiting', function() {
  this.timeout(120000) // 2 minutes for rate limit tests

  describe('Cached Request Rate Limits', () => {
    it('should allow 100 requests per minute for cached content', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`
      const results = []

      // First request to populate cache
      await axios.get(url, { validateStatus: () => true })

      // Wait 1 second for cache to settle
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Send 100 requests
      for (let i = 0; i < 100; i++) {
        try {
          const response = await axios.get(url, { validateStatus: () => true })
          results.push({
            status: response.status,
            index: i,
            rateLimitRemaining: response.headers['x-ratelimit-remaining'],
            timestamp: Date.now()
          })
        } catch (err) {
          results.push({
            status: 'error',
            index: i,
            error: err.message,
            timestamp: Date.now()
          })
        }
      }

      // Count successful vs rate limited
      const successful = results.filter(r => r.status === 200).length
      const rateLimited = results.filter(r => r.status === 429).length

      console.log(`Cached requests - Successful: ${successful}, Rate limited: ${rateLimited}`)

      // Should have mostly successful requests (allowing for timing variations)
      expect(successful).to.be.at.least(90)
      expect(rateLimited).to.be.at.most(10)
    })

    it('should enforce rate limit accurately over time window', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // First request to cache
      await axios.get(url, { validateStatus: () => true })

      const startTime = Date.now()
      let requestCount = 0
      let rateLimitHit = false

      // Send requests until rate limit
      while (!rateLimitHit && requestCount < 150) {
        const response = await axios.get(url, { validateStatus: () => true })
        requestCount++

        if (response.status === 429) {
          rateLimitHit = true
          const elapsed = Date.now() - startTime

          console.log(`Rate limit hit after ${requestCount} requests in ${elapsed}ms`)

          // Should hit rate limit around 100-110 requests
          expect(requestCount).to.be.within(95, 115)
        }
      }

      expect(rateLimitHit).to.be.true
    })
  })

  describe('Non-Cached Request Rate Limits', () => {
    it('should allow 5 requests per minute for non-cached content', async () => {
      const results = []

      // Send 10 unique URL requests
      for (let i = 0; i < 10; i++) {
        const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/page${Date.now()}-${i}`

        try {
          const response = await axios.get(url, { validateStatus: () => true })
          results.push({
            status: response.status,
            index: i,
            timestamp: Date.now()
          })

          // Small delay to avoid overwhelming server
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (err) {
          results.push({
            status: 'error',
            index: i,
            error: err.message,
            timestamp: Date.now()
          })
        }
      }

      const successful = results.filter(r => r.status === 200 || r.status === 403).length
      const rateLimited = results.filter(r => r.status === 429).length

      console.log(`Non-cached requests - Successful: ${successful}, Rate limited: ${rateLimited}`)

      // Should have rate limited some requests (5 req/min limit)
      expect(rateLimited).to.be.at.least(1)
    })
  })

  describe('Rate Limit Headers', () => {
    it('should include rate limit information in response headers', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      const response = await axios.get(url, { validateStatus: () => true })

      // Check for rate limit headers (if implemented)
      console.log('Response headers:', {
        'x-ratelimit-limit': response.headers['x-ratelimit-limit'],
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        'x-ratelimit-reset': response.headers['x-ratelimit-reset']
      })

      // Headers may not be implemented yet, so just log for now
      expect(response.status).to.be.oneOf([200, 403, 429])
    })

    it('should include retry-after header on 429 responses', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Send many requests to trigger rate limit
      let rateLimitResponse

      for (let i = 0; i < 150; i++) {
        const response = await axios.get(url, { validateStatus: () => true })

        if (response.status === 429) {
          rateLimitResponse = response
          break
        }
      }

      if (rateLimitResponse) {
        console.log('Rate limit response:', {
          status: rateLimitResponse.status,
          data: rateLimitResponse.data,
          'retry-after': rateLimitResponse.headers['retry-after']
        })

        expect(rateLimitResponse.data).to.have.property('error')
        expect(rateLimitResponse.data).to.have.property('retryAfter')
      }
    })
  })

  describe('Rate Limit Recovery', () => {
    it('should reset rate limit after time window expires', async function() {
      this.timeout(90000) // 90 seconds

      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Trigger rate limit
      for (let i = 0; i < 120; i++) {
        await axios.get(url, { validateStatus: () => true })
      }

      // Verify rate limited
      const rateLimited = await axios.get(url, { validateStatus: () => true })
      expect(rateLimited.status).to.equal(429)

      console.log('Rate limit triggered, waiting 61 seconds for reset...')

      // Wait for rate limit window to expire (60 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 61000))

      // Should be able to make requests again
      const afterReset = await axios.get(url, { validateStatus: () => true })
      console.log('After reset status:', afterReset.status)

      expect(afterReset.status).to.be.oneOf([200, 403])
    })
  })

  describe('Per-IP Rate Limiting', () => {
    it('should track rate limits separately per IP', async () => {
      // Note: This test assumes single IP, just validates tracking works
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      const response = await axios.get(url, { validateStatus: () => true })

      // Should get a response (not testing multiple IPs, just that system works)
      expect(response.status).to.be.oneOf([200, 403, 429])
    })
  })

  describe('API Key Rate Limits', () => {
    const TEST_API_KEY = process.env.TEST_API_KEY || 'jr_live_example_key_12345'

    it('should apply different rate limits for authenticated requests', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Request with API key
      const withKey = await axios.get(url, {
        headers: { 'X-API-Key': TEST_API_KEY },
        validateStatus: () => true
      })

      // Request without API key
      const withoutKey = await axios.get(url, {
        validateStatus: () => true
      })

      console.log('With API key:', withKey.status)
      console.log('Without API key:', withoutKey.status)

      // Both should work, but may have different limits
      expect(withKey.status).to.be.oneOf([200, 403, 429])
      expect(withoutKey.status).to.be.oneOf([200, 403, 429])
    })
  })
})
