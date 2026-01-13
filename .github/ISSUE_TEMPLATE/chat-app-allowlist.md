## Problem

**The domain allowlist creates a major UX issue for chat applications.**

### Current Behavior

json.rocks only scrapes URLs from domains in `data/allowed-domains.json` (currently 16 domains). Any other URL returns:

```json
{
  "error": "Domain not in allowed domains list",
  "status": 403
}
```

### Why This Breaks Chat Apps

Chat applications need to generate link previews for **any URL** users paste:
- News sites (thousands of domains)
- Personal blogs
- Company websites
- Social media posts
- Documentation sites
- E-commerce stores

**Users expect previews for ALL links**, not just 16 whitelisted domains.

### Example User Experience

```
User: Check out this article! https://techcrunch.com/article
Chat App: ❌ No preview available (domain not allowed)

User: Here's my blog post https://myblog.com/post
Chat App: ❌ No preview available (domain not allowed)

User: GitHub repo https://github.com/user/repo
Chat App: ✅ Preview shown (domain allowed)
```

This creates an inconsistent, frustrating experience.

---

## Proposed Solutions

### Option 1: Wildcard Mode (Recommended for Chat Apps)

Add a configuration option to **allow all domains** with SSRF protections still active:

```javascript
// data/allowed-domains.json
{
  "mode": "wildcard",  // or "allowlist"
  "allowedDomains": ["*"],
  "blockedDomains": [
    // Explicit blocklist for dangerous domains
    "malware-site.com",
    "phishing-example.com"
  ]
}
```

**Security maintained through:**
- ✅ IP blocking (private ranges, localhost, AWS metadata)
- ✅ Rate limiting (5 req/min uncached)
- ✅ Content size limits (5MB max)
- ✅ Timeout enforcement (5 seconds)
- ✅ Concurrent request limits (5 per IP)
- ✅ SSRF protection (private IP validation)

**Pros:**
- Works for any URL
- Perfect chat app UX
- Security still enforced via other mechanisms

**Cons:**
- Higher server load (no pre-filtering by domain)
- Potential abuse without authentication

---

### Option 2: Dynamic Allowlist per API Key

Allow different API keys to have different domain permissions:

```javascript
// config/api-keys.json
{
  "chat-app-key-123": {
    "allowedDomains": ["*"],
    "rateLimit": 1000,  // Higher limit for paid users
    "features": ["wildcard"]
  },
  "public-key-456": {
    "allowedDomains": ["github.com", "stackoverflow.com"],
    "rateLimit": 100
  }
}
```

**Request with API key:**
```bash
curl -H "X-API-Key: chat-app-key-123" \
  "http://localhost:9980/?uri=https://any-domain.com"
```

**Pros:**
- Flexible per-customer configuration
- Revenue opportunity (paid API keys for wildcard)
- Audit trail per API key

**Cons:**
- Requires authentication system
- More complex configuration

---

### Option 3: Category-Based Allowlists

Pre-defined category allowlists for common use cases:

```json
{
  "categories": {
    "news": ["techcrunch.com", "theverge.com", "nytimes.com", ...],
    "social": ["twitter.com", "reddit.com", "linkedin.com", ...],
    "dev": ["github.com", "stackoverflow.com", "dev.to", ...],
    "all": ["*"]
  },
  "activeCategories": ["news", "social", "dev"]
}
```

**Pros:**
- Balance between security and flexibility
- Easy to enable/disable categories
- Curated lists for common use cases

**Cons:**
- Maintenance burden (keeping lists updated)
- Still won't cover long-tail domains

---

### Option 4: On-Demand Domain Approval

Allow chat app admins to approve domains via admin endpoint:

```bash
# Add domain without restarting
curl -X POST http://localhost:9980/admin/domains/add \
  -d '{"domain": "newsite.com", "approvedBy": "admin@chat.com"}'
```

**Pros:**
- Controlled expansion of allowlist
- Audit trail of approvals
- No server restart needed

**Cons:**
- Manual process
- Doesn't scale for thousands of unique domains

---

## Recommended Approach for Chat Apps

**Hybrid: Wildcard Mode + Authentication + Rate Limiting**

```javascript
// bin/server.js configuration

const config = {
  security: {
    mode: process.env.SECURITY_MODE || 'allowlist',  // 'allowlist' | 'wildcard'

    // IP-based protections (always active)
    blockPrivateIPs: true,
    blockCloudMetadata: true,

    // Rate limiting
    rateLimit: {
      wildcard: 100,   // req/min for wildcard mode
      allowlist: 1000  // req/min for allowlisted domains
    },

    // Authentication
    requireApiKey: process.env.REQUIRE_API_KEY === 'true',

    // Domain controls
    allowedDomains: loadAllowedDomains(),
    blockedDomains: [
      // Known malicious domains
    ]
  }
}
```

**Usage for chat app:**

1. **Development:** Run in wildcard mode without auth
   ```bash
   SECURITY_MODE=wildcard ./bin/server.js
   ```

2. **Production:** Enable authentication + wildcard
   ```bash
   SECURITY_MODE=wildcard REQUIRE_API_KEY=true ./bin/server.js
   ```

3. **Public API:** Keep allowlist mode
   ```bash
   SECURITY_MODE=allowlist ./bin/server.js
   ```

---

## Implementation Example

```javascript
// Modify domain check in bin/server.js (around line 250)

function isDomainAllowed(url, config) {
  const domain = extractDomain(url)

  // Check blocklist first
  if (config.blockedDomains.includes(domain)) {
    return false
  }

  // Wildcard mode: allow everything except blocklist
  if (config.mode === 'wildcard') {
    return true
  }

  // Allowlist mode: check against allowed domains
  return config.allowedDomains.some(allowed => {
    if (allowed === '*') return true
    if (allowed.startsWith('*.')) {
      return domain.endsWith(allowed.slice(2))
    }
    return domain === allowed || domain.endsWith('.' + allowed)
  })
}
```

---

## Migration Path

1. **Add mode configuration** to `data/allowed-domains.json`
2. **Update README** with wildcard mode documentation
3. **Add environment variable** `SECURITY_MODE=wildcard|allowlist`
4. **Implement blocklist** for known bad actors
5. **Add authentication** (optional but recommended)
6. **Document rate limiting** implications

---

## Security Considerations

**Wildcard mode is safe IF:**

✅ IP blocking is active (prevents SSRF)
✅ Rate limiting is enforced (prevents abuse)
✅ Content size limits prevent memory exhaustion
✅ Timeout enforcement prevents hanging requests
✅ Concurrent limits prevent resource exhaustion
✅ Authentication prevents unauthorized access (recommended)

**All of these are already implemented** in json.rocks!

---

## Expected Impact

**Current State (Allowlist Only):**
- ❌ Works for 16 domains only
- ❌ Poor chat app UX
- ❌ Requires constant allowlist updates

**With Wildcard Mode:**
- ✅ Works for any URL
- ✅ Perfect chat app UX
- ✅ No allowlist maintenance
- ✅ Security maintained via IP/rate controls

---

## Acceptance Criteria

- [ ] Add `mode` field to `allowed-domains.json`
- [ ] Add `blockedDomains` array
- [ ] Implement wildcard mode logic
- [ ] Add `SECURITY_MODE` environment variable
- [ ] Update domain checking function
- [ ] Document in README
- [ ] Add tests for both modes
- [ ] Add admin endpoint to switch modes
- [ ] Add metrics for wildcard mode usage

## Priority

**High** - This is the primary blocker for chat app adoption.

---

## Alternative: Separate Deployments

If wildcard mode is too risky for public API:

- **Public API:** `json.rocks` - allowlist mode
- **Chat App Instance:** `chat-preview.internal` - wildcard mode + auth

This gives best of both worlds: secure public API + flexible internal service.
