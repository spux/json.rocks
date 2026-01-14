// k6 load testing script for json.rocks
//
// Installation:
//   https://k6.io/docs/getting-started/installation/
//
// Usage:
//   k6 run test/performance/k6-load-test.js
//   k6 run --vus 10 --duration 30s test/performance/k6-load-test.js
//   BASE_URL=https://json.rocks k6 run test/performance/k6-load-test.js
//
// Cloud run:
//   k6 cloud test/performance/k6-load-test.js
//
// See: https://k6.io/docs/

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const cachedRequests = new Counter('cached_requests');
const uncachedRequests = new Counter('uncached_requests');
const errorRate = new Rate('errors');
const cacheHitRate = new Rate('cache_hit_rate');
const responseTimeTrend = new Trend('response_time_ms');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:9980';
const TEST_DOMAIN = __ENV.TEST_DOMAIN || 'https://github.com';

// Test configuration
export const options = {
  // Load stages
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],

  // Performance thresholds
  thresholds: {
    // 95% of requests should complete within 2s
    http_req_duration: ['p(95)<2000'],

    // 99% of requests should complete within 5s
    'http_req_duration{scenario:cached}': ['p(99)<500'],

    // Error rate should be below 5%
    http_req_failed: ['rate<0.05'],

    // Custom thresholds
    errors: ['rate<0.05'],
    cache_hit_rate: ['rate>0.8'],  // 80% cache hit rate
    response_time_ms: ['p(95)<2000', 'p(99)<5000'],
  },

  // Scenarios
  scenarios: {
    // Cached requests (most common)
    cached: {
      executor: 'constant-vus',
      vus: 30,
      duration: '3m',
      exec: 'cachedScenario',
    },

    // Uncached requests
    uncached: {
      executor: 'constant-vus',
      vus: 10,
      duration: '3m',
      exec: 'uncachedScenario',
    },

    // Health checks
    health: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      exec: 'healthScenario',
    },
  },

  // Summary settings
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Setup function - runs once before test
export function setup() {
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Test domain: ${TEST_DOMAIN}`);

  // Warm up cache
  const warmupUrl = `${BASE_URL}/?uri=${TEST_DOMAIN}/spux/json.rocks`;
  http.get(warmupUrl);

  return { baseUrl: BASE_URL, testDomain: TEST_DOMAIN };
}

// Cached request scenario
export function cachedScenario(data) {
  const url = `${data.baseUrl}/?uri=${data.testDomain}/spux/json.rocks`;

  const response = http.get(url, {
    tags: { scenario: 'cached' },
  });

  // Metrics
  cachedRequests.add(1);
  responseTimeTrend.add(response.timings.duration);

  // Checks
  const success = check(response, {
    'status is 200 or 403': (r) => [200, 403].includes(r.status),
    'response time < 100ms': (r) => r.timings.duration < 100,
    'has valid JSON': (r) => {
      try {
        return r.status === 200 ? !!r.json() : true;
      } catch (e) {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
  } else {
    cacheHitRate.add(1);
  }

  sleep(0.5);  // 500ms think time
}

// Uncached request scenario
export function uncachedScenario(data) {
  const randomId = Math.floor(Math.random() * 1000000);
  const url = `${data.baseUrl}/?uri=${data.testDomain}/page/${randomId}`;

  const response = http.get(url, {
    tags: { scenario: 'uncached' },
    timeout: '10s',
  });

  // Metrics
  uncachedRequests.add(1);
  responseTimeTrend.add(response.timings.duration);

  // Checks
  const success = check(response, {
    'status is 200, 403, or 429': (r) => [200, 403, 429].includes(r.status),
    'response time < 10s': (r) => r.timings.duration < 10000,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(1);  // 1s think time
}

// Health check scenario
export function healthScenario(data) {
  const url = `${data.baseUrl}/health`;

  const response = http.get(url, {
    tags: { scenario: 'health' },
  });

  // Checks
  check(response, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 50ms': (r) => r.timings.duration < 50,
    'health has status field': (r) => {
      try {
        return r.json().status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(5);  // Health checks less frequent
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log('Load test completed');
}

// Custom summary
export function handleSummary(data) {
  const summary = {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };

  // Optional: Save JSON results
  if (__ENV.SAVE_RESULTS) {
    summary['summary.json'] = JSON.stringify(data);
  }

  return summary;
}

// Helper function for text summary
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const lines = [];

  lines.push(`${indent}Test Summary:`);
  lines.push(`${indent}  Duration: ${data.state.testRunDurationMs}ms`);
  lines.push(`${indent}  VUs: ${data.metrics.vus?.values.max || 0}`);

  // HTTP metrics
  if (data.metrics.http_reqs) {
    lines.push(`${indent}  HTTP Requests: ${data.metrics.http_reqs.values.count}`);
  }

  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration.values;
    lines.push(`${indent}  Response Time:`);
    lines.push(`${indent}    avg: ${duration.avg?.toFixed(2)}ms`);
    lines.push(`${indent}    min: ${duration.min?.toFixed(2)}ms`);
    lines.push(`${indent}    max: ${duration.max?.toFixed(2)}ms`);
    lines.push(`${indent}    p95: ${duration['p(95)']?.toFixed(2)}ms`);
    lines.push(`${indent}    p99: ${duration['p(99)']?.toFixed(2)}ms`);
  }

  // Custom metrics
  if (data.metrics.cached_requests) {
    lines.push(`${indent}  Cached Requests: ${data.metrics.cached_requests.values.count}`);
  }

  if (data.metrics.uncached_requests) {
    lines.push(`${indent}  Uncached Requests: ${data.metrics.uncached_requests.values.count}`);
  }

  if (data.metrics.cache_hit_rate) {
    const hitRate = (data.metrics.cache_hit_rate.values.rate * 100).toFixed(1);
    lines.push(`${indent}  Cache Hit Rate: ${hitRate}%`);
  }

  if (data.metrics.errors) {
    const errorRate = (data.metrics.errors.values.rate * 100).toFixed(2);
    lines.push(`${indent}  Error Rate: ${errorRate}%`);
  }

  return lines.join('\n');
}
