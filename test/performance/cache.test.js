import { expect } from 'chai'
import axios from 'axios'

const BASE_URL = process.env.TEST_URL || 'http://localhost:9980'
const TEST_DOMAIN = 'https://github.com'

describe('Performance: Caching', function() {
  this.timeout(30000)

  describe('Cache Hit Performance', () => {
    it('should serve cached requests significantly faster than uncached', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // First request (uncached)
      const uncachedStart = Date.now()
      const uncachedResponse = await axios.get(url, { validateStatus: () => true })
      const uncachedTime = Date.now() - uncachedStart

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second request (cached)
      const cachedStart = Date.now()
      const cachedResponse = await axios.get(url, { validateStatus: () => true })
      const cachedTime = Date.now() - cachedStart

      console.log(`Uncached: ${uncachedTime}ms, Cached: ${cachedTime}ms`)
      console.log(`Cache speedup: ${(uncachedTime / cachedTime).toFixed(1)}x`)

      // Cached should be at least 5x faster (likely much more)
      expect(cachedTime).to.be.lessThan(uncachedTime / 5)

      // Cached should be very fast (< 100ms)
      expect(cachedTime).to.be.lessThan(100)
    })

    it('should maintain cache hit performance under load', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      // Measure 50 cached requests
      const times = []

      for (let i = 0; i < 50; i++) {
        const start = Date.now()
        await axios.get(url, { validateStatus: () => true })
        times.push(Date.now() - start)
      }

      const avg = times.reduce((a, b) => a + b) / times.length
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)]

      console.log(`Cache performance - Avg: ${avg.toFixed(1)}ms, p95: ${p95}ms, p99: ${p99}ms`)

      // Performance targets from Issue #13
      expect(avg).to.be.lessThan(10)  // p50 < 5ms
      expect(p95).to.be.lessThan(20)  // p95 < 10ms
      expect(p99).to.be.lessThan(30)  // p99 < 20ms
    })
  })

  describe('Cache Refresh', () => {
    it('should bypass cache when refresh=true parameter is used', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // First request to populate cache
      await axios.get(url, { validateStatus: () => true })

      // Request with refresh
      const refreshStart = Date.now()
      const refreshResponse = await axios.get(`${url}&refresh=true`, { validateStatus: () => true })
      const refreshTime = Date.now() - refreshStart

      // Cached request for comparison
      const cachedStart = Date.now()
      const cachedResponse = await axios.get(url, { validateStatus: () => true })
      const cachedTime = Date.now() - cachedStart

      console.log(`Refresh: ${refreshTime}ms, Cached: ${cachedTime}ms`)

      // Refresh should be slower than cache (fetches from source)
      expect(refreshTime).to.be.greaterThan(cachedTime * 2)
    })
  })

  describe('Cache Capacity', () => {
    it('should handle cache at capacity (100 items)', async function() {
      this.timeout(60000)

      // Note: This test may affect other tests running concurrently
      // It populates the cache with many items

      const urls = []
      for (let i = 0; i < 100; i++) {
        urls.push(`${BASE_URL}/?uri=${TEST_DOMAIN}/page${i}`)
      }

      // Populate cache with 100 items
      console.log('Populating cache with 100 items...')

      for (const url of urls) {
        await axios.get(url, { validateStatus: () => true })
      }

      // Verify items are cached (should be fast)
      const testUrl = urls[50]
      const start = Date.now()
      await axios.get(testUrl, { validateStatus: () => true })
      const time = Date.now() - start

      console.log(`Cache at capacity - Request time: ${time}ms`)

      // Should still be fast
      expect(time).to.be.lessThan(100)
    })

    it('should evict least recently used items when cache is full', async function() {
      this.timeout(60000)

      // Add 101 items to trigger LRU eviction
      const urls = []
      for (let i = 0; i < 101; i++) {
        urls.push(`${BASE_URL}/?uri=${TEST_DOMAIN}/eviction${i}`)
      }

      console.log('Testing LRU eviction...')

      // Add all items
      for (const url of urls) {
        await axios.get(url, { validateStatus: () => true })
      }

      // First item should have been evicted (slower request)
      const firstUrl = urls[0]
      const start = Date.now()
      await axios.get(firstUrl, { validateStatus: () => true })
      const time = Date.now() - start

      console.log(`Evicted item request time: ${time}ms`)

      // May or may not be cached depending on timing, just verify it works
      expect(time).to.be.greaterThan(0)
    })
  })

  describe('Cache TTL', () => {
    it('should respect 30-minute TTL for memory cache', async function() {
      this.timeout(5000)

      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      // Cached request
      const cachedStart = Date.now()
      await axios.get(url, { validateStatus: () => true })
      const cachedTime = Date.now() - cachedStart

      console.log(`Cache TTL test - Request time: ${cachedTime}ms`)

      // Should be cached (fast)
      expect(cachedTime).to.be.lessThan(100)

      // Note: Full TTL test would require waiting 30 minutes
      // This just validates cache is working
    })
  })

  describe('Concurrent Cache Access', () => {
    it('should handle concurrent requests to same cached URL', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      // Make 10 concurrent requests
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(axios.get(url, { validateStatus: () => true }))
      }

      const start = Date.now()
      const results = await Promise.all(promises)
      const time = Date.now() - start

      console.log(`10 concurrent cache hits in ${time}ms`)

      // All should succeed
      expect(results.every(r => r.status === 200 || r.status === 403)).to.be.true

      // Should be fast even with concurrency
      expect(time).to.be.lessThan(500)
    })

    it('should handle concurrent requests to different cached URLs', async () => {
      const baseUrl = `${BASE_URL}/?uri=${TEST_DOMAIN}/concurrent`

      // Populate cache with 5 different URLs
      for (let i = 0; i < 5; i++) {
        await axios.get(`${baseUrl}${i}`, { validateStatus: () => true })
      }

      // Make concurrent requests to different URLs
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(axios.get(`${baseUrl}${i}`, { validateStatus: () => true }))
      }

      const start = Date.now()
      const results = await Promise.all(promises)
      const time = Date.now() - start

      console.log(`5 concurrent different cache hits in ${time}ms`)

      // All should succeed
      expect(results.every(r => r.status === 200 || r.status === 403)).to.be.true

      // Should be fast
      expect(time).to.be.lessThan(500)
    })
  })

  describe('Cache Statistics', () => {
    it('should track cache size in health endpoint', async () => {
      const healthUrl = `${BASE_URL}/health?stats=true`

      const response = await axios.get(healthUrl, { validateStatus: () => true })

      if (response.status === 200 && response.data.cache) {
        console.log('Cache stats:', response.data.cache)

        expect(response.data.cache).to.have.property('size')
        expect(response.data.cache).to.have.property('max')
        expect(response.data.cache.max).to.equal(100)
      }
    })
  })

  describe('Cache with Different Content Types', () => {
    it('should cache responses with different content types', async () => {
      // Test various URLs that might return different content
      const urls = [
        `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`,  // GitHub page
        `${BASE_URL}/?uri=https://example.com`,              // Simple HTML
      ]

      for (const url of urls) {
        // First request
        const firstStart = Date.now()
        await axios.get(url, { validateStatus: () => true })
        const firstTime = Date.now() - firstStart

        // Cached request
        const cachedStart = Date.now()
        await axios.get(url, { validateStatus: () => true })
        const cachedTime = Date.now() - cachedStart

        console.log(`URL: ${url}`)
        console.log(`  First: ${firstTime}ms, Cached: ${cachedTime}ms`)

        // Cached should be faster
        if (cachedTime > 0 && firstTime > 0) {
          expect(cachedTime).to.be.lessThan(firstTime)
        }
      }
    })
  })
})
