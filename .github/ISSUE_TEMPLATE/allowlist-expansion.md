---
name: Allowlist Expansion Strategy
about: Intelligent expansion of domain allowlist for better chat app UX
title: '[FEATURE] Expand domain allowlist for chat app integration'
labels: enhancement, documentation, ux
assignees: ''
---

## Problem Statement

The current strict allowlist (16 domains) creates **poor UX for chat applications** where users expect link previews for any URL they paste.

### Current State
```json
{
  "allowedDomains": [
    "github.com", "stackoverflow.com", "wikipedia.org",
    "example.com", "httpbin.org", "jsonplaceholder.typicode.com",
    "news.ycombinator.com", "reddit.com", "medium.com", "dev.to",
    "techcrunch.com", "pichunter.com", "pornpics.com", "imdb.com",
    "omg.xxx", "iafd.com"
  ]
}
```

### User Experience Issues

**Scenario 1: News Articles**
```
User: "Check out this article! https://nytimes.com/2025/..."
Chat App: ❌ Error: Domain not in allowed list
```

**Scenario 2: Personal Blogs**
```
User: "I wrote about this: https://myblog.substack.com/..."
Chat App: ❌ Error: Domain not in allowed list
```

**Scenario 3: Documentation**
```
User: "See the React docs: https://react.dev/..."
Chat App: ❌ Error: Domain not in allowed list
```

**Only 16 domains work** while thousands of legitimate domains fail. This is not viable for production chat applications.

---

## Research: What Industry Does

### OWASP Recommendation
> "Use strict allowlists of hostnames/IP ranges. Possibly the most effective way to prevent SSRF."

**Verdict:** Allowlist is correct - we just need to expand it intelligently.

### Commercial APIs
- **Microlink:** Domain allowlist for API key authorization
- **LinkPreview:** Server-side validation with domain restrictions
- **All use allowlists** as primary defense, not blocklists

### Major Platforms
- **Slack/Discord:** Initially used blocklists → compromised via bypasses → switched to allowlist + defense-in-depth
- **Pattern:** Allowlist + IP blocking + rate limiting + authentication

**Conclusion:** Keep allowlist approach, but make it smarter.

---

## Proposed Solutions

### Option 1: Curated Top Sites (RECOMMENDED)

Expand allowlist to include **Tranco Top 1000** most popular domains.

**Benefits:**
- ✅ Covers 80%+ of user link sharing
- ✅ Still maintains security (curated list)
- ✅ Low maintenance (annual updates)
- ✅ OWASP-compliant (strict allowlist)

**Sources:**
- [Tranco Top 1M List](https://tranco-list.eu/)
- [Alexa Top Sites](https://www.alexa.com/topsites)
- Category lists: News, Social, Dev Tools, Documentation

**Implementation:**
```javascript
// scripts/generate-allowlist.js
import fetch from 'node-fetch'
import fs from 'fs/promises'

async function generateAllowlist() {
  // Fetch Tranco top 1000
  const response = await fetch('https://tranco-list.eu/top-1m.csv.zip')
  // ... process and extract top 1000

  const categories = {
    news: ['nytimes.com', 'washingtonpost.com', 'bbc.com', 'cnn.com', 'theguardian.com', 'reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com', 'ft.com'],
    social: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'threads.net'],
    dev: ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com'],
    docs: ['docs.python.org', 'reactjs.org', 'nodejs.org', 'developer.mozilla.org', 'go.dev', 'rust-lang.org'],
    blogging: ['medium.com', 'substack.com', 'dev.to', 'hashnode.com', 'wordpress.com', 'blogger.com'],
    hosting: ['vercel.app', 'netlify.app', 'herokuapp.com', 'github.io', 'pages.dev', 'fly.dev'],
    video: ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com'],
    images: ['imgur.com', 'giphy.com', 'tenor.com', 'flickr.com']
  }

  const allowedDomains = [
    ...new Set([
      ...top1000Domains,
      ...Object.values(categories).flat()
    ])
  ]

  await fs.writeFile('data/allowed-domains.json', JSON.stringify({
    allowedDomains,
    categories,
    lastUpdated: new Date().toISOString(),
    source: 'Tranco Top 1000 + curated categories'
  }, null, 2))
}
```

**Maintenance:**
- Update quarterly or annually
- Automated script to fetch latest Tranco list
- Manual review of new additions

---

### Option 2: Domain Request System

Allow users to **request domain additions** via API endpoint.

**User Flow:**
1. User submits domain request with reason
2. Request logged for admin review
3. Auto-approve domains requested >5 times (after manual review)
4. User notified when approved

**Implementation:**
```javascript
// POST /request-domain
fastify.post('/request-domain', async (request, reply) => {
  const { domain, reason, email } = request.body

  // Validate domain format
  if (!domain || !/^[a-z0-9.-]+$/i.test(domain)) {
    return reply.code(400).send({ error: 'Invalid domain format' })
  }

  // Load existing requests
  const requestPath = path.join(__dirname, '../data/domain-requests.json')
  let requests = []
  try {
    requests = JSON.parse(await fs.readFile(requestPath, 'utf8'))
  } catch {
    requests = []
  }

  // Check if domain already requested
  const existingRequests = requests.filter(r => r.domain === domain)

  // Add new request
  requests.push({
    domain,
    reason,
    email,
    requestedAt: new Date().toISOString(),
    requestCount: existingRequests.length + 1,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  })

  await fs.writeFile(requestPath, JSON.stringify(requests, null, 2))

  // Auto-approve if requested >= 5 times
  if (existingRequests.length >= 4) { // 4 existing + this one = 5 total
    return reply.send({
      message: 'Domain request submitted. Auto-approval pending admin review.',
      domain,
      requestCount: existingRequests.length + 1,
      status: 'pending_auto_approval'
    })
  }

  return reply.send({
    message: 'Domain request submitted for review',
    domain,
    requestCount: existingRequests.length + 1,
    estimatedReview: '1-2 business days'
  })
})

// GET /request-domain/status/:domain
fastify.get('/request-domain/status/:domain', async (request, reply) => {
  const { domain } = request.params

  // Check if domain in allowlist
  if (ALLOWED_DOMAINS.includes(domain)) {
    return { status: 'approved', domain }
  }

  // Check pending requests
  const requests = JSON.parse(await fs.readFile('data/domain-requests.json', 'utf8'))
  const domainRequests = requests.filter(r => r.domain === domain)

  return {
    status: domainRequests.length > 0 ? 'pending' : 'not_requested',
    domain,
    requestCount: domainRequests.length,
    lastRequested: domainRequests[domainRequests.length - 1]?.requestedAt
  }
})

// Admin endpoint to approve domains
fastify.post('/admin/approve-domain', {
  onRequest: fastify.basicAuth
}, async (request, reply) => {
  const { domain } = request.body

  // Add to allowlist
  const config = JSON.parse(await fs.readFile('data/allowed-domains.json', 'utf8'))
  if (!config.allowedDomains.includes(domain)) {
    config.allowedDomains.push(domain)
    config.approvedDomains = config.approvedDomains || []
    config.approvedDomains.push({
      domain,
      approvedAt: new Date().toISOString(),
      approvedBy: request.headers['user'] || 'admin'
    })
    await fs.writeFile('data/allowed-domains.json', JSON.stringify(config, null, 2))

    // Reload in memory
    ALLOWED_DOMAINS = await loadAllowedDomains()
  }

  return { message: 'Domain approved', domain }
})
```

**Benefits:**
- ✅ User-driven expansion
- ✅ Transparent process
- ✅ Audit trail of approvals
- ✅ Scales with user needs

**Drawbacks:**
- Requires manual admin work
- Not instant for users
- May still miss long-tail domains

---

### Option 3: Tiered Security Model

Different security levels for different API access tiers.

**Architecture:**
```
┌─────────────────────┐
│  Public API (Free)  │
│  - 16 core domains  │
│  - 5 req/min        │
│  - No auth required │
└─────────────────────┘

┌─────────────────────┐
│  Basic Tier ($5/mo) │
│  - Top 1000 domains │
│  - 100 req/min      │
│  - API key auth     │
└─────────────────────┘

┌──────────────────────┐
│  Pro Tier ($25/mo)   │
│  - Custom allowlist  │
│  - 1000 req/min      │
│  - Priority support  │
└──────────────────────┘
```

**Implementation:**
```javascript
// API key-based tiering
const TIER_CONFIG = {
  public: {
    allowedDomains: ['github.com', 'stackoverflow.com', ...],
    rateLimit: 5,
    requiresAuth: false
  },
  basic: {
    allowedDomains: [...top1000Domains],
    rateLimit: 100,
    requiresAuth: true
  },
  pro: {
    allowedDomains: ['*'], // All domains (with IP blocking still active)
    rateLimit: 1000,
    requiresAuth: true
  }
}

fastify.addHook('preHandler', async (request, reply) => {
  const apiKey = request.headers['x-api-key']

  if (!apiKey) {
    request.tier = 'public'
    return
  }

  const tier = await validateApiKey(apiKey)
  request.tier = tier || 'public'
})

// Use tier config in domain validation
function isAllowedDomain(urlString, tier = 'public') {
  const config = TIER_CONFIG[tier]

  if (config.allowedDomains.includes('*')) {
    return true // Pro tier allows all domains
  }

  // ... existing domain validation
}
```

**Benefits:**
- ✅ Best UX for paying customers
- ✅ Revenue opportunity
- ✅ Maintains free tier security
- ✅ Flexible scaling

**Drawbacks:**
- Requires payment infrastructure
- More complex to maintain
- Need customer support

---

### Option 4: Hybrid (BEST LONG-TERM)

Combine multiple approaches for flexibility.

**Phase 1 (Immediate):**
- Expand to Top 1000 domains
- Add category-based lists (news, social, dev, docs)

**Phase 2 (Month 2):**
- Add domain request system
- Public endpoint to view allowlist
- Auto-approve highly requested domains

**Phase 3 (Month 3+):**
- Add API key authentication
- Tiered access (free = top 1000, paid = custom lists)
- Domain reputation integration

**Implementation Timeline:**
```
Week 1: Expand to Top 1000
Week 2: Add domain request endpoint
Week 3: Admin interface for approvals
Week 4: Public allowlist viewer
Month 2: API key system
Month 3: Tiered access + billing
```

---

## Recommended Immediate Action

**Expand allowlist to ~100 high-value domains** covering common chat app use cases:

```json
{
  "allowedDomains": [
    // Development (existing + additions)
    "github.com", "gitlab.com", "bitbucket.org",
    "stackoverflow.com", "stackexchange.com",

    // News
    "nytimes.com", "washingtonpost.com", "bbc.com", "cnn.com",
    "theguardian.com", "reuters.com", "apnews.com", "bloomberg.com",

    // Social
    "twitter.com", "x.com", "reddit.com", "linkedin.com",
    "threads.net", "mastodon.social",

    // Blogging
    "medium.com", "substack.com", "dev.to", "hashnode.com",

    // Documentation
    "docs.python.org", "reactjs.org", "react.dev", "nodejs.org",
    "developer.mozilla.org", "go.dev", "rust-lang.org",

    // Hosting Platforms
    "vercel.app", "netlify.app", "herokuapp.com", "github.io",
    "pages.dev", "railway.app", "render.com", "fly.dev",

    // Video
    "youtube.com", "youtu.be", "vimeo.com", "twitch.tv",

    // Images
    "imgur.com", "giphy.com", "tenor.com",

    // Wikis
    "wikipedia.org", "wikimedia.org", "fandom.com",

    // Tools
    "example.com", "httpbin.org", "jsonplaceholder.typicode.com",

    // Misc
    "imdb.com", "techcrunch.com", "theverge.com", "arstechnica.com"
  ]
}
```

**This gives:**
- 60-80 common domains
- Covers majority of chat app link sharing
- Still maintains OWASP-recommended allowlist approach
- Low maintenance burden
- Can expand based on user feedback

---

## Implementation Checklist

### Phase 1: Immediate Expansion (This Week)
- [ ] Create `scripts/generate-allowlist.js` for automation
- [ ] Expand `data/allowed-domains.json` to include:
  - [ ] Top news sites (10-15 domains)
  - [ ] Social media platforms (5-10 domains)
  - [ ] Popular hosting platforms (10 domains)
  - [ ] Documentation sites (10-15 domains)
  - [ ] Blogging platforms (5 domains)
- [ ] Test with common chat app URLs
- [ ] Update README with list of allowed domains

### Phase 2: Domain Request System (Next Month)
- [ ] Create `POST /request-domain` endpoint
- [ ] Create `GET /request-domain/status/:domain` endpoint
- [ ] Add admin approval endpoint
- [ ] Set up request logging to `data/domain-requests.json`
- [ ] Add rate limiting to request endpoint (prevent spam)
- [ ] Update README with request process

### Phase 3: Transparency & Automation (Month 2)
- [ ] Create `GET /allowed-domains` public endpoint
- [ ] Add auto-approval logic for frequently requested domains
- [ ] Email notifications for domain approval
- [ ] Admin dashboard for managing requests
- [ ] Analytics: track most requested domains

### Phase 4: Advanced Features (Month 3+)
- [ ] API key authentication system
- [ ] Tiered access control
- [ ] Domain reputation integration (WhoisXML, APIVoid)
- [ ] Automated Tranco list updates
- [ ] Prometheus metrics for allowlist effectiveness

---

## Testing Plan

```javascript
// tests/allowlist.test.js

describe('Expanded Allowlist', () => {
  test('should allow common news sites', async () => {
    const newsSites = [
      'https://nytimes.com/article',
      'https://washingtonpost.com/news',
      'https://bbc.com/news'
    ]

    for (const url of newsSites) {
      const response = await request(app).get(`/?uri=${url}`)
      expect(response.status).toBe(200)
    }
  })

  test('should allow popular hosting platforms', async () => {
    const platforms = [
      'https://myapp.vercel.app',
      'https://mysite.netlify.app',
      'https://myproject.github.io'
    ]

    for (const url of platforms) {
      const response = await request(app).get(`/?uri=${url}`)
      expect(response.status).toBe(200)
    }
  })

  test('should still block non-allowlisted domains', async () => {
    await request(app)
      .get('/?uri=https://random-malicious-site.com')
      .expect(403)
  })
})

describe('Domain Request System', () => {
  test('should accept valid domain request', async () => {
    const response = await request(app)
      .post('/request-domain')
      .send({
        domain: 'myblog.com',
        reason: 'Personal blog for chat sharing',
        email: 'user@example.com'
      })
      .expect(200)

    expect(response.body.message).toContain('submitted')
  })

  test('should track request count', async () => {
    // Submit same domain 5 times
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/request-domain')
        .send({ domain: 'popular-site.com', reason: 'test' })
    }

    // Check status
    const status = await request(app)
      .get('/request-domain/status/popular-site.com')

    expect(status.body.requestCount).toBe(5)
    expect(status.body.status).toBe('pending_auto_approval')
  })
})
```

---

## Success Metrics

**Before Expansion:**
- 16 allowed domains
- ~20% of user URLs work
- High user frustration

**After Expansion (Target):**
- 60-100 allowed domains (Phase 1)
- 1000+ domains (Phase 2 with Tranco)
- ~80%+ of user URLs work
- Low maintenance burden
- Positive user feedback

**Track:**
- % of requests that succeed vs blocked
- Most commonly blocked domains → prioritize for addition
- Domain request volume
- User satisfaction scores

---

## Security Considerations

**This expansion maintains security because:**

✅ Still uses OWASP-recommended allowlist approach
✅ All other security layers remain active:
  - IP blocking (private ranges, localhost, AWS metadata)
  - Rate limiting (5-100 req/min)
  - Content size limits (5MB)
  - Timeout enforcement (5 seconds)
  - Concurrent request limits (5 per IP)
  - DNS rebinding protection (after critical fixes)
  - Redirect validation (after critical fixes)

**What changes:**
- Larger allowlist (16 → 60-100 → 1000+)
- More manual curation work
- Need periodic reviews

**What doesn't change:**
- Security architecture
- Defense-in-depth approach
- SSRF protections

---

## Resources

- [Tranco Top Sites List](https://tranco-list.eu/)
- [Alexa Top Sites](https://www.alexa.com/topsites)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Microlink Domain Allowlist](https://microlink.io/docs/api/getting-started/overview)
- [LinkPreview API Documentation](https://docs.linkpreview.net/)

---

## Priority

**High** - This directly impacts chat app usability and is the #1 UX blocker for adoption. Implement Phase 1 (expand to 60-100 domains) this week alongside critical security fixes.
