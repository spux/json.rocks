import { expect } from 'chai'
import axios from 'axios'

const BASE_URL = process.env.TEST_URL || 'http://localhost:9980'
const TEST_DOMAIN = 'https://github.com'

describe('Performance: Concurrency', function() {
  this.timeout(30000)

  describe('Concurrent Request Limits', () => {
    it('should enforce max 5 concurrent requests per IP', async () => {
      // Create 10 slow requests that will overlap
      const urls = []
      for (let i = 0; i < 10; i++) {
        urls.push(`${BASE_URL}/?uri=${TEST_DOMAIN}/slow${i}`)
      }

      const start = Date.now()
      const promises = urls.map(url =>
        axios.get(url, {
          validateStatus: () => true,
          timeout: 10000
        })
      )

      const results = await Promise.allSettled(promises)
      const time = Date.now() - start

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200)
      const tooMany = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429 &&
        r.value.data.error === 'Too many concurrent requests'
      )
      const rejected = results.filter(r => r.status === 'rejected')

      console.log(`Concurrent requests test:`)
      console.log(`  Successful: ${successful.length}`)
      console.log(`  Too many concurrent: ${tooMany.length}`)
      console.log(`  Rejected: ${rejected.length}`)
      console.log(`  Total time: ${time}ms`)

      // Should have some requests succeed and some blocked
      expect(successful.length + tooMany.length + rejected.length).to.equal(10)

      // At least some should be blocked due to concurrency limit
      expect(tooMany.length + rejected.length).to.be.greaterThan(0)
    })
  })

  describe('Concurrent Request Tracking', () => {
    it('should track active requests per IP', async () => {
      // Make 3 concurrent requests
      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(
          axios.get(`${BASE_URL}/?uri=${TEST_DOMAIN}/track${i}`, {
            validateStatus: () => true
          })
        )
      }

      const results = await Promise.all(promises)

      // All should complete
      expect(results.length).to.equal(3)

      // Check if any returned 429 for concurrent limit
      const tooMany = results.filter(r =>
        r.status === 429 && r.data.error === 'Too many concurrent requests'
      )

      console.log(`Concurrent tracking - Too many: ${tooMany.length}`)

      // With only 3 requests, should not hit limit (max is 5)
      expect(tooMany.length).to.equal(0)
    })
  })

  describe('Cleanup After Request Completion', () => {
    it('should properly cleanup after requests complete', async () => {
      // Send 5 requests sequentially
      for (let i = 0; i < 5; i++) {
        const response = await axios.get(`${BASE_URL}/?uri=${TEST_DOMAIN}/cleanup${i}`, {
          validateStatus: () => true
        })

        console.log(`Request ${i + 1}: ${response.status}`)

        // All should succeed (not hitting concurrent limit)
        expect(response.status).to.not.equal(429)
      }
    })
  })

  describe('Server Throughput', () => {
    it('should handle sustained request load', async function() {
      this.timeout(60000)

      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache first
      await axios.get(url, { validateStatus: () => true })

      // Send 100 requests over 10 seconds (10 req/s)
      const results = []
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        const reqStart = Date.now()

        try {
          const response = await axios.get(url, { validateStatus: () => true })
          const reqTime = Date.now() - reqStart

          results.push({
            status: response.status,
            time: reqTime,
            index: i
          })
        } catch (err) {
          results.push({
            status: 'error',
            error: err.message,
            index: i
          })
        }

        // Small delay to spread load
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const totalTime = Date.now() - startTime
      const successful = results.filter(r => r.status === 200).length
      const avgTime = results
        .filter(r => r.time)
        .reduce((sum, r) => sum + r.time, 0) / successful

      console.log(`Sustained load test:`)
      console.log(`  Total requests: 100`)
      console.log(`  Successful: ${successful}`)
      console.log(`  Total time: ${totalTime}ms`)
      console.log(`  Throughput: ${(100 / (totalTime / 1000)).toFixed(2)} req/s`)
      console.log(`  Average response time: ${avgTime.toFixed(1)}ms`)

      // Should handle most requests successfully
      expect(successful).to.be.at.least(80)

      // Average response time should be reasonable
      expect(avgTime).to.be.lessThan(100)
    })

    it('should measure peak throughput with cached content', async function() {
      this.timeout(30000)

      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      // Send 50 requests as fast as possible
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(axios.get(url, { validateStatus: () => true }))
      }

      const start = Date.now()
      const results = await Promise.allSettled(promises)
      const time = Date.now() - start

      const successful = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      ).length

      const throughput = (successful / (time / 1000)).toFixed(2)

      console.log(`Peak throughput test:`)
      console.log(`  Requests: 50`)
      console.log(`  Successful: ${successful}`)
      console.log(`  Time: ${time}ms`)
      console.log(`  Throughput: ${throughput} req/s`)

      // Should handle high throughput
      expect(successful).to.be.at.least(40)
    })
  })

  describe('Mixed Workload', () => {
    it('should handle mix of fast and slow requests', async () => {
      const fastUrl = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`  // Cached
      const slowUrl = `${BASE_URL}/?uri=${TEST_DOMAIN}/new${Date.now()}`  // Uncached

      // Populate cache for fast URL
      await axios.get(fastUrl, { validateStatus: () => true })

      // Mix of 5 fast and 5 slow requests
      const promises = []

      for (let i = 0; i < 5; i++) {
        promises.push(axios.get(fastUrl, { validateStatus: () => true }))
        promises.push(axios.get(`${slowUrl}${i}`, { validateStatus: () => true }))
      }

      const start = Date.now()
      const results = await Promise.allSettled(promises)
      const time = Date.now() - start

      const successful = results.filter(r =>
        r.status === 'fulfilled' && [200, 403, 429].includes(r.value.status)
      ).length

      console.log(`Mixed workload:`)
      console.log(`  Total requests: 10`)
      console.log(`  Successful: ${successful}`)
      console.log(`  Time: ${time}ms`)

      // Should handle mixed workload
      expect(successful).to.be.at.least(5)
    })
  })

  describe('Connection Management', () => {
    it('should handle rapid sequential requests', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      const results = []

      // 20 rapid sequential requests
      for (let i = 0; i < 20; i++) {
        const start = Date.now()
        const response = await axios.get(url, { validateStatus: () => true })
        const time = Date.now() - start

        results.push({
          status: response.status,
          time
        })
      }

      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length
      const successful = results.filter(r => r.status === 200).length

      console.log(`Rapid sequential requests:`)
      console.log(`  Successful: ${successful}/20`)
      console.log(`  Average time: ${avgTime.toFixed(1)}ms`)

      // All should succeed
      expect(successful).to.equal(20)

      // Should be consistently fast
      expect(avgTime).to.be.lessThan(50)
    })
  })

  describe('Error Recovery Under Load', () => {
    it('should recover from concurrent limit errors', async () => {
      // Trigger concurrent limit
      const overloadPromises = []
      for (let i = 0; i < 10; i++) {
        overloadPromises.push(
          axios.get(`${BASE_URL}/?uri=${TEST_DOMAIN}/overload${i}`, {
            validateStatus: () => true
          })
        )
      }

      await Promise.allSettled(overloadPromises)

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Should be able to make requests again
      const recovery = await axios.get(`${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`, {
        validateStatus: () => true
      })

      console.log(`Recovery after overload: ${recovery.status}`)

      expect(recovery.status).to.be.oneOf([200, 403, 429])
    })
  })

  describe('Performance Under Concurrency', () => {
    it('should maintain response times under concurrent load', async () => {
      const url = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`

      // Populate cache
      await axios.get(url, { validateStatus: () => true })

      // 20 concurrent requests with timing
      const promises = []
      const timings = []

      for (let i = 0; i < 20; i++) {
        const promise = (async () => {
          const start = Date.now()
          const response = await axios.get(url, { validateStatus: () => true })
          const time = Date.now() - start

          if (response.status === 200) {
            timings.push(time)
          }

          return response
        })()

        promises.push(promise)
      }

      await Promise.all(promises)

      if (timings.length > 0) {
        const avg = timings.reduce((a, b) => a + b) / timings.length
        const max = Math.max(...timings)
        const min = Math.min(...timings)

        console.log(`Performance under concurrency:`)
        console.log(`  Min: ${min}ms`)
        console.log(`  Avg: ${avg.toFixed(1)}ms`)
        console.log(`  Max: ${max}ms`)

        // Average should still be good
        expect(avg).to.be.lessThan(100)
      }
    })
  })
})
