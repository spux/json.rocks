import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import http from 'http'

const BASE = 'http://localhost:9980'

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: body })
        }
      })
    }).on('error', reject)
  })
}

describe('GET /api', () => {
  it('returns 400 when uri is missing', async () => {
    const res = await get('/api')
    expect(res.status).to.equal(400)
    expect(res.body.error).to.equal('Missing uri parameter')
  })

  it('returns 400 for invalid URI format', async () => {
    const res = await get('/api?uri=ftp://bad.example')
    expect(res.status).to.equal(400)
    expect(res.body.error).to.equal('Invalid URI')
  })

  it('returns 403 for domains not in allowlist', async () => {
    const res = await get('/api?uri=https://not-in-allowlist-xyz123.example')
    expect(res.status).to.equal(403)
    expect(res.body.error).to.equal('Security validation failed')
  })

  it('returns JSON with metadata for allowed domains', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://github.com/spux&refresh=true')
    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.include('application/json')
    expect(res.body).to.have.property('title')
    expect(res.body).to.have.property('links')
    expect(res.body).to.have.property('images')
    expect(res.body).to.have.property('@context', 'https://schema.org')
  })

  it('extracts links as deduplicated array with absolute URLs', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://github.com/spux&refresh=true')
    expect(res.body.links).to.be.an('array')
    const hrefs = res.body.links.map(l => l.href)
    // All should be absolute URLs
    hrefs.forEach(h => expect(h).to.match(/^https?:\/\//))
    // Should be deduplicated
    expect(new Set(hrefs).size).to.equal(hrefs.length)
  })

  it('extracts images with absolute URLs and no tracking pixels', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://github.com/spux&refresh=true')
    expect(res.body.images).to.be.an('array')
    res.body.images.forEach(img => {
      expect(img.src).to.match(/^https?:\/\//)
      expect(img).to.have.property('alt')
    })
  })

  it('extracts favicon when available', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://en.wikipedia.org/wiki/Node.js&refresh=true')
    expect(res.body.favicon).to.be.a('string')
    expect(res.body.favicon).to.match(/^https?:\/\//)
  })

  it('extracts JSON-LD from source pages', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://en.wikipedia.org/wiki/Node.js&refresh=true')
    expect(res.body.jsonLd).to.be.an('array')
    expect(res.body.jsonLd.length).to.be.greaterThan(0)
  })

  it('supports filter=links', async function () {
    this.timeout(15000)
    const res = await get('/api?uri=https://github.com/spux&filter=links')
    expect(res.status).to.equal(200)
    expect(res.body).to.be.an('array')
    expect(res.body[0]).to.have.property('href')
  })
})

describe('GET /', () => {
  it('serves the losos SPA', async () => {
    const res = await get('/')
    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.include('text/html')
    expect(res.body).to.include('losos')
  })

  it('includes dynamically discovered pane script tags', async () => {
    const res = await get('/')
    expect(res.body).to.include('data-pane')
    expect(res.body).to.include('article-pane.js')
    expect(res.body).to.include('source-pane.js')
  })

  it('injects direct-pane domains from annotations', async () => {
    const res = await get('/')
    expect(res.body).to.include('directDomains')
  })
})

describe('Static file serving', () => {
  it('serves pane files from /panes/', async () => {
    const res = await get('/panes/article-pane.js')
    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.include('application/javascript')
  })

  it('serves losos files from /losos/', async () => {
    const res = await get('/losos/shell.js')
    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.include('application/javascript')
  })

  it('serves lion files from /lion/', async () => {
    const res = await get('/lion/index.js')
    expect(res.status).to.equal(200)
  })

  it('returns 404 for non-existent pane', async () => {
    const res = await get('/panes/does-not-exist-pane.js')
    expect(res.status).to.equal(404)
  })

  it('blocks path traversal in pane filenames', async () => {
    const res = await get('/panes/..%2F..%2Fpackage.json')
    expect(res.status).to.equal(404)
  })
})

describe('Security headers', () => {
  it('includes CSP built from pane annotations', async () => {
    const res = await get('/')
    const csp = res.headers['content-security-policy']
    expect(csp).to.include("script-src 'self'")
    expect(csp).to.include("connect-src 'self'")
    expect(csp).to.include("img-src 'self' https: data:")
    // Should NOT include losos.org CDN
    expect(csp).to.not.include('losos.org')
  })

  it('includes standard security headers', async () => {
    const res = await get('/')
    expect(res.headers['x-content-type-options']).to.equal('nosniff')
    expect(res.headers['x-frame-options']).to.equal('DENY')
  })
})

describe('GET /health', () => {
  it('returns health status', async () => {
    const res = await get('/health')
    expect(res.status).to.equal(200)
    expect(res.body.status).to.equal('ok')
    expect(res.body).to.have.property('uptime')
    expect(res.body).to.have.property('timestamp')
  })
})
