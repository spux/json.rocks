#!/usr/bin/env node

// IMPORTS
import extractor from 'unfluff'
import axios from 'axios'
import fs from 'fs-extra'
import url from 'url'
import dns from 'dns/promises'

// const scrapex = require('scrapex')
import * as cheerio from 'cheerio'
import metascraper from 'metascraper'
import metaAuthor from 'metascraper-author'
import metaDate from 'metascraper-date'
import metaDescription from 'metascraper-description'
import metaImage from 'metascraper-image'
import metaLogo from 'metascraper-logo'
import metaClearbit from 'metascraper-clearbit'
import metaPublisher from 'metascraper-publisher'
import metaTitle from 'metascraper-title'
import metaSpotify from 'metascraper-spotify'
import metaVideo from 'metascraper-video'
import metaYoutube from 'metascraper-youtube'
import metaAmazon from 'metascraper-amazon'
import metaUrl from 'metascraper-url'
import minimist from 'minimist'
import https from 'https'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { LRUCache } from 'lru-cache'
import { isIP } from 'net'
import basicAuth from '@fastify/basic-auth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize LRU cache for URL caching (max 100 items, 30 min TTL)
const cache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 30 // 30 min TTL
})

// Error deduplication cache (max 1000 errors, 5 min TTL)
const recentErrors = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minute TTL
})

// Error statistics tracking
const errorStats = {
  metascraper: { count: 0, lastError: null },
  unfluff: { count: 0, lastError: null },
  network: { count: 0, lastError: null },
  validation: { count: 0, lastError: null }
}

// Security configuration
const MAX_CONTENT_SIZE = 5 * 1024 * 1024 // 5MB limit
const MAX_CONCURRENT_REQUESTS = 5
const activeRequests = new Map()

// Authentication configuration
const AUTH_MODE = process.env.AUTH_MODE || 'open' // open, optional, required
let API_KEYS = []
const keyUsageStats = new Map() // Track usage per key

// Load allowed domains from configuration files
let ALLOWED_DOMAINS = []

function loadAllowedDomains() {
  const defaultListPath = path.join(__dirname, '../data/allowed-domains-top1000.json')
  const customListPath = path.join(__dirname, '../data/allowed-domains-custom.json')

  let defaultDomains = []
  let customDomains = []

  try {
    // Load default top 1000 domains
    if (fs.existsSync(defaultListPath)) {
      const defaultConfig = JSON.parse(fs.readFileSync(defaultListPath, 'utf8'))
      defaultDomains = defaultConfig.domains || []
      console.log(`Loaded ${defaultDomains.length} default domains from top1000 list`)
    } else {
      console.warn('Default domain list not found, using minimal fallback')
      defaultDomains = ['github.com', 'stackoverflow.com', 'wikipedia.org', 'example.com', 'httpbin.org']
    }

    // Load custom domains (optional)
    if (fs.existsSync(customListPath)) {
      const customConfig = JSON.parse(fs.readFileSync(customListPath, 'utf8'))
      customDomains = Array.isArray(customConfig) ? customConfig : (customConfig.domains || [])
      console.log(`Loaded ${customDomains.length} custom domains`)
    } else {
      console.log('No custom domains file found (this is optional)')
    }

    // Merge and deduplicate
    ALLOWED_DOMAINS = [...new Set([...defaultDomains, ...customDomains])]
    console.log(`Total allowed domains: ${ALLOWED_DOMAINS.length}`)

  } catch (err) {
    console.error('Error loading allowed domains:', err.message)
    console.log('Using fallback allowlist')
    ALLOWED_DOMAINS = ['github.com', 'stackoverflow.com', 'wikipedia.org', 'example.com', 'httpbin.org']
  }
}

// Load allowed domains on startup
loadAllowedDomains()

// Load API keys from configuration file
function loadApiKeys() {
  const apiKeysPath = path.join(__dirname, '../data/api-keys.json')

  try {
    if (fs.existsSync(apiKeysPath)) {
      const apiKeysConfig = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'))
      API_KEYS = apiKeysConfig.keys || []
      console.log(`Loaded ${API_KEYS.length} API keys`)

      // Initialize usage stats for each key
      API_KEYS.forEach(keyConfig => {
        if (!keyUsageStats.has(keyConfig.key)) {
          keyUsageStats.set(keyConfig.key, {
            requests: 0,
            cached: 0,
            uncached: 0,
            lastUsed: null,
            created: keyConfig.created || new Date().toISOString()
          })
        }
      })
    } else {
      console.log('No API keys file found (authentication disabled)')
      API_KEYS = []
    }
  } catch (err) {
    console.error('Error loading API keys:', err.message)
    API_KEYS = []
  }
}

// Validate API key and return key configuration
function validateApiKey(apiKey) {
  if (!apiKey) return null

  const keyConfig = API_KEYS.find(k => k.key === apiKey && k.enabled !== false)
  return keyConfig || null
}

// Check if request is authenticated
function checkAuthentication(request) {
  // Extract API key from header or query parameter
  const apiKey = request.headers['x-api-key'] || request.query.api_key

  if (!apiKey) {
    return { authenticated: false, key: null, keyConfig: null }
  }

  const keyConfig = validateApiKey(apiKey)

  if (!keyConfig) {
    return { authenticated: false, key: apiKey, keyConfig: null, invalid: true }
  }

  // Update usage stats
  const stats = keyUsageStats.get(apiKey)
  if (stats) {
    stats.lastUsed = new Date().toISOString()
    stats.requests++
  }

  return { authenticated: true, key: apiKey, keyConfig }
}

// Get rate limit for request (based on API key or default)
function getRateLimitForRequest(request, isCached) {
  const auth = checkAuthentication(request)

  // Check if request is from localhost
  const ip = request.ip || request.raw.socket.remoteAddress
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'

  // Localhost gets much higher rate limits for development/testing
  if (isLocalhost) {
    return isCached ? 10000 : 1000
  }

  if (auth.authenticated && auth.keyConfig && auth.keyConfig.rateLimit) {
    // Use per-key rate limits
    return isCached ? auth.keyConfig.rateLimit.cached : auth.keyConfig.rateLimit.uncached
  }

  // Use default rate limits (increased for better usability with domain allowlist protection)
  return isCached ? 300 : 30
}

// Load API keys on startup
loadApiKeys()

// Blocked IP ranges (RFC 1918 private networks, localhost, metadata endpoints)
const BLOCKED_IP_RANGES = [
  // IPv4 private ranges
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  // Localhost
  { start: '127.0.0.0', end: '127.255.255.255' },
  // Link-local (AWS metadata, etc)
  { start: '169.254.0.0', end: '169.254.255.255' },
  // Multicast
  { start: '224.0.0.0', end: '239.255.255.255' }
]

// Security validation functions
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isAllowedDomain(urlString) {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname.toLowerCase()
    
    // Check exact match or subdomain match
    return ALLOWED_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain)
    })
  } catch {
    return false
  }
}

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
}

function isBlockedIP(urlString) {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname.toLowerCase()

    // SECURITY FIX: Block ALL IPv6 addresses (prevents Slack-style bypasses)
    // IPv6 addresses contain colons
    if (hostname.includes(':')) {
      console.log('Blocked IPv6 address:', hostname)
      return true
    }

    // Block IPv6 localhost variations
    if (hostname === '[::1]' ||
        hostname === '[::ffff:127.0.0.1]' ||
        hostname === '[0:0:0:0:0:0:0:1]' ||
        hostname.startsWith('[::ffff:')) {
      console.log('Blocked IPv6 localhost:', hostname)
      return true
    }

    // Check if it's an IPv4 address
    if (isIP(hostname)) {
      const ipNum = ipToNumber(hostname)

      return BLOCKED_IP_RANGES.some(range => {
        const startNum = ipToNumber(range.start)
        const endNum = ipToNumber(range.end)
        return ipNum >= startNum && ipNum <= endNum
      })
    }

    // Check for localhost hostnames
    const blockedHostnames = ['localhost', 'metadata.google.internal']
    return blockedHostnames.includes(hostname.toLowerCase())
  } catch {
    return true // Block invalid URLs
  }
}

function validateSecureUrl(urlString) {
  // SECURITY FIX: Check for null bytes and control characters
  if (urlString.includes('\0') || urlString.includes('%00')) {
    throw new Error('URL contains null bytes')
  }

  // Check for other control characters
  if (/[\x00-\x1f\x7f]/.test(urlString)) {
    throw new Error('URL contains control characters')
  }

  if (!isValidUrl(urlString)) {
    throw new Error('Invalid URL format')
  }

  if (!isAllowedDomain(urlString)) {
    throw new Error('Domain not in allowlist. Contact admin to add trusted domains.')
  }

  if (isBlockedIP(urlString)) {
    throw new Error('Access to private networks and localhost is blocked for security')
  }

  return true
}

// SECURITY FIX: DNS rebinding protection
async function validateUrlWithDNS(urlString) {
  const url = new URL(urlString)
  const hostname = url.hostname

  // Skip DNS check for pure IP addresses (they're already validated)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return isBlockedIP(urlString) ? false : true
  }

  try {
    // Resolve all A records
    const addresses = await dns.resolve4(hostname)

    // Validate each resolved IP against blocklist
    for (const ip of addresses) {
      const testUrl = new URL(urlString)
      testUrl.hostname = ip

      if (isBlockedIP(testUrl.href)) {
        throw new Error(`Domain ${hostname} resolves to blocked IP address ${ip}`)
      }
    }

    return true
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      throw new Error('Domain could not be resolved')
    }
    throw err
  }
}

const argv = minimist(process.argv.slice(2))
const meta = metascraper([
  metaAuthor(),
  metaDate(),
  metaDescription(),
  metaImage(),
  metaLogo(),
  metaClearbit(),
  metaPublisher(),
  metaTitle(),
  metaSpotify(),
  metaVideo(),
  metaYoutube(),
  metaAmazon(),
  metaUrl()
])

// MODEL
globalThis.data = {
  port: 9980,
  key: './privkey.pem',
  cert: './fullchain.pem',
  scheme: 'http',
  fullhtml: false,
  searx: 'https://search.inetol.net/',
  filter: null
}

// INIT
data.port = argv.port || data.port
data.key = argv.key || data.key
data.cert = argv.cert || data.cert
data.scheme = argv.scheme || data.scheme
data.filter = argv.filter || data.filter
var searx = argv.searx || data.searx
var fullhtml = argv.fullhtml || data.fullhtml
var root = './data'

console.log('data', data)

if (data.scheme === 'http') {
  var fastify = (await import('fastify')).default({
    logger: true
  })
} else {
  var fastify = (await import('fastify')).default({
    https: {
      key: fs.readFileSync(path.join(__dirname, data.key)),
      cert: fs.readFileSync(path.join(__dirname, data.cert))
    }
  })
}

// Register middleware plugins
await fastify.register((await import('fastify-compress')).default, { global: true })
await fastify.register((await import('fastify-rate-limit')).default, {
  max: (req, key) => {
    // Check if the request URI is in cache
    const uri = req.query?.uri
    const isCached = uri && cache.has(uri)
    return getRateLimitForRequest(req, isCached)
  },
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    // Use API key if authenticated, otherwise IP address
    const auth = checkAuthentication(req)
    return auth.authenticated ? `key:${auth.key}` : `ip:${req.ip}`
  },
  skipOnError: false,
  errorResponseBuilder: (req, context) => {
    const uri = req.query?.uri
    const isCached = uri && cache.has(uri)
    const auth = checkAuthentication(req)
    return {
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${context.max} per ${context.after}${isCached ? ' (cached)' : ' (non-cached)'}`,
      retryAfter: context.ttl,
      type: isCached ? 'cached' : 'non-cached',
      authenticated: auth.authenticated
    }
  }
})
await fastify.register((await import('fastify-cors')).default, {
  origin: true
})

// SECURITY FIX: Register basic auth for admin endpoints
await fastify.register(basicAuth, {
  validate: async (username, password, req, reply) => {
    const validUser = process.env.ADMIN_USER || 'admin'
    const validPass = process.env.ADMIN_PASS

    if (!validPass) {
      throw new Error('ADMIN_PASS environment variable not set - admin endpoints protected')
    }

    if (username !== validUser || password !== validPass) {
      return new Error('Unauthorized')
    }
  },
  authenticate: { realm: 'json.rocks Admin' }
})

const user_agent_desktop =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'

const headers = { 'User-Agent': user_agent_desktop }

// FUNCTIONS
function escapeHtml(unsafe) {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Extract domain from URL for logging
function extractDomain(urlString) {
  try {
    const url = new URL(urlString)
    return url.hostname
  } catch {
    return 'unknown'
  }
}

// Deduplicated error logging with structured context
function logDedupedError(logger, errorType, errorMessage, context = {}) {
  const errorKey = `${errorType}:${context.domain || ''}:${errorMessage}`

  // Check if we've logged this error recently
  if (recentErrors.has(errorKey)) {
    // Error already logged, increment suppressed count
    const existing = recentErrors.get(errorKey)
    existing.suppressedCount = (existing.suppressedCount || 0) + 1
    recentErrors.set(errorKey, existing)
    return false // Indicate error was suppressed
  }

  // Log the error with full context
  const logData = {
    errorType,
    message: errorMessage,
    ...context,
    timestamp: new Date().toISOString()
  }

  if (logger && logger.warn) {
    logger.warn(logData, `${errorType} error occurred`)
  } else {
    console.warn(`[${errorType}]`, errorMessage, context)
  }

  // Track this error
  recentErrors.set(errorKey, { ...logData, suppressedCount: 0 })

  // Update error statistics
  if (errorStats[errorType]) {
    errorStats[errorType].count++
    errorStats[errorType].lastError = errorMessage
  }

  return true // Indicate error was logged
}

function mapURI (parsed, root, origin) {
  var mapped = root + '/' + origin + parsed.pathname

  if (mapped.slice(-1) === '/') mapped = mapped + 'index.html'
  return mapped
}

// Serve static JS files
fastify.get('/js/:filename', async (request, reply) => {
  const filename = request.params.filename
  const allowedFiles = ['json-renderer.js']

  if (!allowedFiles.includes(filename)) {
    return reply.code(404).send({ error: 'File not found' })
  }

  try {
    const filePath = path.join(__dirname, '../js', filename)
    const fileContent = await fs.readFile(filePath, 'utf8')

    reply
      .code(200)
      .header('Content-Type', 'application/javascript')
      .header('Cache-Control', 'public, max-age=86400') // 24 hour cache
      .send(fileContent)
  } catch (err) {
    reply.code(404).send({ error: 'File not found' })
  }
})

// Serve losos pane files
fastify.get('/panes/:filename', async (request, reply) => {
  const filename = request.params.filename

  // Security: only allow safe filenames
  if (!/^[a-zA-Z0-9_\-\.]+\.js$/.test(filename)) {
    return reply.code(404).send({ error: 'File not found' })
  }

  try {
    const filePath = path.join(__dirname, '../panes', filename)

    if (!await fs.pathExists(filePath)) {
      return reply.code(404).send({ error: 'File not found' })
    }

    const fileContent = await fs.readFile(filePath, 'utf8')

    reply
      .code(200)
      .header('Content-Type', 'application/javascript')
      .header('Cache-Control', 'public, max-age=86400')
      .send(fileContent)
  } catch (err) {
    reply.code(404).send({ error: 'File not found' })
  }
})

// Serve static image files
fastify.get('/images/:filename', async (request, reply) => {
  const filename = request.params.filename

  // Security: only allow safe filenames (alphanumeric, dash, underscore, dot)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
    return reply.code(404).send({ error: 'File not found' })
  }

  try {
    const filePath = path.join(__dirname, '../images', filename)

    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return reply.code(404).send({ error: 'File not found' })
    }

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'

    if (ext === '.svg') {
      contentType = 'image/svg+xml'
    } else if (ext === '.png') {
      contentType = 'image/png'
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg'
    } else if (ext === '.gif') {
      contentType = 'image/gif'
    } else if (ext === '.webp') {
      contentType = 'image/webp'
    } else if (ext === '.ico') {
      contentType = 'image/x-icon'
    }

    const fileContent = await fs.readFile(filePath)

    reply
      .code(200)
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=86400') // 24 hour cache
      .send(fileContent)
  } catch (err) {
    reply.code(404).send({ error: 'File not found' })
  }
})

// Serve favicon
fastify.get('/favicon.ico', async (request, reply) => {
  try {
    const filePath = path.join(__dirname, '../favicon.ico')
    const fileContent = await fs.readFile(filePath)

    reply
      .code(200)
      .header('Content-Type', 'image/x-icon')
      .header('Cache-Control', 'public, max-age=86400') // 24 hour cache
      .send(fileContent)
  } catch (err) {
    reply.code(404).send({ error: 'Favicon not found' })
  }
})

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const includeStats = request.query.stats === 'true'

  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }

  // Include error statistics if requested
  if (includeStats) {
    health.errorStats = {
      metascraper: {
        total: errorStats.metascraper.count,
        lastError: errorStats.metascraper.lastError
      },
      unfluff: {
        total: errorStats.unfluff.count,
        lastError: errorStats.unfluff.lastError
      },
      network: {
        total: errorStats.network.count,
        lastError: errorStats.network.lastError
      },
      validation: {
        total: errorStats.validation.count,
        lastError: errorStats.validation.lastError
      }
    }
    health.cache = {
      size: cache.size,
      max: 100,
      recentErrorsTracked: recentErrors.size
    }
  }

  return health
})

// JSON API endpoint — returns scraped data as JSON
fastify.get('/api', async (request, reply) => {
  var uri = request.query.uri
  var refresh = request.query.refresh

  // Check authentication if required
  const auth = checkAuthentication(request)

  if (AUTH_MODE === 'required' && !auth.authenticated) {
    return reply.code(401).send({
      error: 'Authentication required',
      message: 'API key required. Provide via X-API-Key header or api_key query parameter'
    })
  }

  if (auth.invalid) {
    return reply.code(403).send({
      error: 'Invalid API key',
      message: 'The provided API key is invalid or disabled'
    })
  }

  if (!uri) {
    return reply.code(400).send({ error: 'Missing uri parameter' })
  }

  // Update usage stats if authenticated
  if (auth.authenticated && auth.keyConfig) {
    const stats = keyUsageStats.get(auth.key)
    const isCached = uri && cache.has(uri)
    if (stats) {
      if (isCached) {
        stats.cached++
      } else {
        stats.uncached++
      }
    }
  }

  // Check concurrent request limit
  const clientIP = request.ip
  const activeCount = activeRequests.get(clientIP) || 0

  if (activeCount >= MAX_CONCURRENT_REQUESTS) {
    return reply.code(429).send({
      error: 'Too many concurrent requests',
      message: `Maximum ${MAX_CONCURRENT_REQUESTS} concurrent requests per IP`,
      activeRequests: activeCount
    })
  }

  // Track active request
  activeRequests.set(clientIP, activeCount + 1)

  const cleanup = () => {
    const current = activeRequests.get(clientIP) || 0
    if (current <= 1) {
      activeRequests.delete(clientIP)
    } else {
      activeRequests.set(clientIP, current - 1)
    }
  }

  try {
    // Validate URI
    if (!uri.match(/^[a-zA-Z ]*$/)) {
      if (!/^https?:\/\/.+/.test(uri)) {
        return reply.code(400).send({
          error: 'Invalid URI',
          message: 'URI must be a valid HTTP or HTTPS URL'
        })
      }

      try {
        validateSecureUrl(uri)
      } catch (securityError) {
        logDedupedError(fastify.log, 'validation', securityError.message, {
          url: uri,
          domain: extractDomain(uri),
          validationType: 'security',
          reqId: request.id
        })
        return reply.code(403).send({
          error: 'Security validation failed',
          message: securityError.message
        })
      }
    }

    // Text search
    if (uri.match(/^[a-zA-Z ]*$/)) {
      var mapped = mapURI({ pathname: uri }, root, 'q/')
      var apiData
      try {
        if (fs.existsSync(mapped) && !refresh) {
          apiData = JSON.parse(await fs.readFile(mapped, 'utf8'))
        } else {
          var html = await axios.get(
            searx + `/?q=${uri}&categories=general&language=en-US&format=json`,
            { headers: headers }
          )
          apiData = html.data
          await fs.outputFile(mapped, JSON.stringify(apiData, null, 2))
        }
      } catch (err) {
        console.error(err)
        return reply.code(500).send({ error: 'Search failed' })
      }
      return reply.code(200).header('Content-Type', 'application/json').send(apiData)
    }

    // URL scraping
    if (!uri.match(/^http/)) {
      uri = 'https://' + uri
    }

    var parsed = url.parse(uri)
    var origin = parsed.hostname
    var mapped = mapURI(parsed, root, origin)
    var apiData

    try {
      if (cache.has(uri) && !refresh) {
        apiData = cache.get(uri)
      } else if (fs.existsSync(mapped) && !refresh) {
        apiData = JSON.parse(await fs.readFile(mapped, 'utf8'))
        cache.set(uri, apiData)
      } else {
        await validateUrlWithDNS(uri)

        var html = await axios.get(uri, {
          headers: {
            'User-Agent': user_agent_desktop,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 5000,
          maxRedirects: 3,
          maxContentLength: MAX_CONTENT_SIZE,
          maxBodyLength: MAX_CONTENT_SIZE,
          validateStatus: (status) => status < 500,
          beforeRedirect: (options, responseDetails) => {
            const redirectUrl = options.href
            if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
              throw new Error(`Invalid redirect protocol: ${redirectUrl}`)
            }
            if (isBlockedIP(redirectUrl)) {
              throw new Error(`Redirect to blocked IP address: ${redirectUrl}`)
            }
          }
        })

        try {
          apiData = extractor(html.data)
        } catch (extractorErr) {
          logDedupedError(fastify.log, 'unfluff', extractorErr.message, {
            url: uri, domain: extractDomain(uri), fallback: 'basic_extraction', reqId: request.id
          })
          apiData = { title: '', text: '', url: uri, image: '', description: '' }
        }

        try {
          const metadata = await metascraper({ html: html.data, url: uri })
          apiData = { ...apiData, ...metadata }
        } catch (metascraperErr) {
          logDedupedError(fastify.log, 'metascraper', metascraperErr.message, {
            url: uri, domain: extractDomain(uri), fallback: 'basic_extraction', reqId: request.id
          })
        }

        apiData['@context'] = 'https://schema.org'
        if (!apiData.videos) apiData.videos = []
        if (!apiData.links) apiData.links = []

        const $ = cheerio.load(html.data)

        $('video').each(function (i, link) {
          apiData.videos.push({ text: $(link).text() || 'video', href: $(link).attr('src') })
        })
        $('iframe').each(function (i, link) {
          apiData.links.push({ text: $(link).text() || 'iframe', href: $(link).attr('src') })
        })
        $('a').each(function (i, link) {
          apiData.links.push({ text: $(link).text(), href: $(link).attr('href') })
        })

        if (!apiData.images) apiData.images = []
        $('img').each(function (i, img) {
          var imgData = { src: $(img).attr('src'), alt: $(img).attr('alt') || '', title: $(img).attr('title') || '' }
          if (imgData.src) apiData.images.push(imgData)
        })

        cache.set(uri, apiData)
        var file = mapURI(parsed, root, origin)
        fs.outputFile(file, JSON.stringify(apiData, null, 2)).catch(err => {
          console.error('Failed to write cache file:', err)
        })
      }
    } catch (err) {
      logDedupedError(fastify.log, 'network', err.message, {
        url: uri, domain: extractDomain(uri), errorCode: err.code, reqId: request.id
      })
      if (err.code === 'ENOTFOUND') {
        return reply.code(404).send({ error: 'URL not found', message: 'The requested URL could not be resolved' })
      } else if (err.code === 'ECONNREFUSED') {
        return reply.code(503).send({ error: 'Connection refused', message: 'Could not connect to the target server' })
      } else if (err.code === 'ETIMEDOUT') {
        return reply.code(408).send({ error: 'Request timeout', message: 'The request took too long to complete' })
      } else {
        return reply.code(500).send({ error: 'Failed to process URL', message: 'Internal server error occurred' })
      }
    }

    // Apply filters if requested
    var filter = request.query.filter
    if (filter === 'links') {
      apiData = apiData.links
    } else if (filter === 'image') {
      const imageLinks = apiData.links?.filter(obj => {
        const href = obj?.href?.toLowerCase()
        return href && (href.endsWith('.jpg') || href.endsWith('.jpeg') || href.endsWith('.png') || href.endsWith('.gif') || href.endsWith('.webp') || href.endsWith('.svg') || href.endsWith('.bmp') || href.endsWith('.ico'))
      }) || []
      const imageElements = apiData.images || []
      apiData = [...imageLinks, ...imageElements]
    }

    return reply.code(200).header('Content-Type', 'application/json').send(apiData)
  } finally {
    cleanup()
  }
})

// Scan panes directory — extract script tags, CSP needs, and direct-pane domains
function scanPanes() {
  const panesDir = path.join(__dirname, '../panes')
  const result = {
    scriptTags: '',
    connectSrc: new Set(),
    scriptSrc: new Set(),
    directDomains: []
  }

  try {
    const files = fs.readdirSync(panesDir)
      .filter(f => f.endsWith('-pane.js'))
      .sort()

    result.scriptTags = files.map(f => `<script type="module" data-pane src="/panes/${f}"></script>`).join('\n')

    // Parse annotations from each pane file
    for (const file of files) {
      const content = fs.readFileSync(path.join(panesDir, file), 'utf8')
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        // Stop parsing at first non-comment line
        if (!trimmed.startsWith('//')) break

        const connectMatch = trimmed.match(/^\/\/\s*@connect\s+(.+)/)
        if (connectMatch) result.connectSrc.add('https://' + connectMatch[1].trim())

        const scriptMatch = trimmed.match(/^\/\/\s*@script\s+(.+)/)
        if (scriptMatch) result.scriptSrc.add('https://' + scriptMatch[1].trim())

        const directMatch = trimmed.match(/^\/\/\s*@direct\s+(.+)/)
        if (directMatch) result.directDomains.push(directMatch[1].trim())
      }
    }
  } catch (err) {
    console.warn('Could not read panes directory:', err.message)
  }

  return result
}

// Build CSP header from base policy + pane annotations
function buildCSP(paneData) {
  const scriptSrc = ["'self'", "'unsafe-inline'", 'https://losos.org', 'https://cdnjs.cloudflare.com', ...paneData.scriptSrc].join(' ')
  const connectSrc = ["'self'", 'https://www.google.com', ...paneData.connectSrc].join(' ')
  return `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; connect-src ${connectSrc}; img-src 'self' https: data:; font-src 'self'`
}

// MAIN — serves the losos-powered SPA with dynamically discovered panes
fastify.get('/', async (request, reply) => {
  var index = fs.readFileSync('./index.html', 'utf8')
  var paneData = scanPanes()

  // Inject discovered panes and direct-pane domains
  index = index.replace('<!-- PANES -->', paneData.scriptTags)
  index = index.replace('"DIRECT_DOMAINS"', JSON.stringify(paneData.directDomains))

  reply.code(200).header('Content-Type', 'text/html; charset=UTF-8')
  return index
})

// Build CSP once at startup from pane annotations
const _startupPaneData = scanPanes()
const _cspHeader = buildCSP(_startupPaneData)
console.log('CSP built from pane annotations:', _cspHeader)

// Add security headers middleware
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('X-XSS-Protection', '1; mode=block')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('Content-Security-Policy', _cspHeader)
  return payload
})

// Add graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully')
  fastify.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// SECURITY FIX: Admin endpoints now protected with basic auth
fastify.post('/admin/reload-domains', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  try {
    loadAllowedDomains()
    return {
      success: true,
      message: `Reloaded ${ALLOWED_DOMAINS.length} allowed domains`,
      domains: ALLOWED_DOMAINS
    }
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})

// SECURITY FIX: Admin endpoint protected with basic auth
fastify.get('/admin/domains', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  return {
    allowedDomains: ALLOWED_DOMAINS,
    count: ALLOWED_DOMAINS.length,
    configFile: 'data/allowed-domains.json'
  }
})

// Admin endpoint: Get all API keys with usage statistics
fastify.get('/admin/keys', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  const keysWithStats = API_KEYS.map(keyConfig => {
    const stats = keyUsageStats.get(keyConfig.key) || {
      requests: 0,
      cached: 0,
      uncached: 0,
      lastUsed: null,
      created: keyConfig.created || 'unknown'
    }

    return {
      key: keyConfig.key,
      name: keyConfig.name,
      description: keyConfig.description,
      created: keyConfig.created,
      enabled: keyConfig.enabled !== false,
      rateLimit: keyConfig.rateLimit,
      domains: keyConfig.domains,
      usage: {
        totalRequests: stats.requests,
        cachedRequests: stats.cached,
        uncachedRequests: stats.uncached,
        lastUsed: stats.lastUsed
      }
    }
  })

  return {
    count: API_KEYS.length,
    authMode: AUTH_MODE,
    keys: keysWithStats,
    configFile: 'data/api-keys.json'
  }
})

// Admin endpoint: Reload API keys from file
fastify.post('/admin/reload-keys', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  try {
    loadApiKeys()
    return {
      success: true,
      message: `Reloaded ${API_KEYS.length} API keys`,
      count: API_KEYS.length,
      authMode: AUTH_MODE
    }
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})

// Admin endpoint: Clear memory cache
fastify.post('/admin/clear-cache', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  try {
    const memCacheSize = cache.size
    const errorCacheSize = recentErrors.size

    cache.clear()
    recentErrors.clear()

    return {
      success: true,
      message: 'Memory caches cleared',
      cleared: {
        urlCache: memCacheSize,
        errorCache: errorCacheSize
      }
    }
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})

// Admin endpoint: Clear file cache
fastify.post('/admin/clear-file-cache', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  try {
    const dataDir = path.join(__dirname, '../data')
    const entries = await fs.readdir(dataDir)

    // Only remove directories (cached domains), keep JSON config files
    const cacheDirectories = []
    for (const entry of entries) {
      const entryPath = path.join(dataDir, entry)
      const stat = await fs.stat(entryPath)
      if (stat.isDirectory()) {
        await fs.remove(entryPath)
        cacheDirectories.push(entry)
      }
    }

    return {
      success: true,
      message: 'File cache cleared',
      cleared: {
        directories: cacheDirectories.length,
        domains: cacheDirectories
      }
    }
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})

// Admin endpoint: Clear all caches (memory + file)
fastify.post('/admin/clear-all-caches', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  try {
    // Clear memory caches
    const memCacheSize = cache.size
    const errorCacheSize = recentErrors.size
    cache.clear()
    recentErrors.clear()

    // Clear file caches
    const dataDir = path.join(__dirname, '../data')
    const entries = await fs.readdir(dataDir)
    const cacheDirectories = []
    for (const entry of entries) {
      const entryPath = path.join(dataDir, entry)
      const stat = await fs.stat(entryPath)
      if (stat.isDirectory()) {
        await fs.remove(entryPath)
        cacheDirectories.push(entry)
      }
    }

    return {
      success: true,
      message: 'All caches cleared',
      cleared: {
        memory: {
          urlCache: memCacheSize,
          errorCache: errorCacheSize
        },
        files: {
          directories: cacheDirectories.length,
          domains: cacheDirectories
        }
      }
    }
  } catch (err) {
    return reply.code(500).send({
      success: false,
      error: err.message
    })
  }
})

// RUN SERVER HTTP
fastify.listen(data.port, '0.0.0.0', (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
  console.log('Security measures active:')
  console.log('- Rate limiting: 30 requests/minute per IP (non-cached), 300 requests/minute (cached)')
  console.log('- Rate limiting (localhost): 1000 requests/minute (non-cached), 10000 requests/minute (cached)')
  console.log('- Domain allowlist:', ALLOWED_DOMAINS.length, 'domains loaded')
  console.log('- Private IP blocking enabled')
  console.log('- Content size limit:', MAX_CONTENT_SIZE / 1024 / 1024 + 'MB')
  console.log('- Max concurrent requests per IP:', MAX_CONCURRENT_REQUESTS)
  console.log('')
  console.log('Authentication:')
  console.log('- Mode:', AUTH_MODE)
  console.log('- API keys loaded:', API_KEYS.length)
  if (API_KEYS.length > 0) {
    console.log('- Per-key rate limits enabled')
  }
  console.log('')
  console.log('Admin endpoints:')
  console.log('- GET /admin/domains - View allowed domains')
  console.log('- POST /admin/reload-domains - Reload domains from file')
  console.log('- GET /admin/keys - View API keys and usage statistics')
  console.log('- POST /admin/reload-keys - Reload API keys from file')
  console.log('- POST /admin/clear-cache - Clear memory cache')
  console.log('- POST /admin/clear-file-cache - Clear file cache')
  console.log('- POST /admin/clear-all-caches - Clear all caches')
})
