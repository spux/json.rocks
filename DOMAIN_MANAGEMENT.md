# Domain Management Guide

Complete guide to managing the domain allowlist in json.rocks for secure web scraping.

---

## Table of Contents

- [Overview](#overview)
- [Security Rationale](#security-rationale)
- [Domain Allowlist System](#domain-allowlist-system)
- [Adding Custom Domains](#adding-custom-domains)
- [Managing the Default List](#managing-the-default-list)
- [Domain Reloading](#domain-reloading)
- [Subdomain Handling](#subdomain-handling)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

json.rocks uses a domain allowlist to control which websites can be scraped. This security measure prevents:

- **SSRF (Server-Side Request Forgery)** attacks
- **Internal network scanning** via the scraping service
- **Abuse of the service** to scrape unauthorized sites
- **Privacy violations** by blocking access to private/internal domains

The allowlist consists of two files:
1. **Default List**: `data/allowed-domains-top1000.json` (1000+ curated domains, committed to git)
2. **Custom List**: `data/allowed-domains-custom.json` (your additions, gitignored)

These lists are automatically merged at startup, giving you 1000+ domains by default plus your custom additions.

---

## Security Rationale

### Why Allowlist vs Blocklist?

**OWASP Recommendation**: Use allowlists (whitelists) instead of blocklists for security-critical operations.

**Allowlist (✅ Recommended)**
- Default deny, explicit allow
- Finite list of known-safe domains
- Easier to audit and maintain
- Prevents zero-day domain exploits
- Clear security boundaries

**Blocklist (❌ Not Recommended)**
- Default allow, explicit deny
- Infinite attack surface
- Easy to bypass (new domains, typos, subdomains)
- Reactive rather than proactive
- Hard to keep comprehensive

### Attack Scenarios Prevented

**Without Allowlist:**
```bash
# Attacker could scan internal network
curl "http://json.rocks/?uri=http://192.168.1.1/admin"
curl "http://json.rocks/?uri=http://localhost:6379"  # Redis
curl "http://json.rocks/?uri=http://169.254.169.254/latest/meta-data"  # AWS metadata

# Result: Internal services exposed, credentials leaked
```

**With Allowlist:**
```bash
# Same requests blocked
HTTP 403: Domain 192.168.1.1 not in allowlist
HTTP 403: Domain localhost not in allowlist
HTTP 403: Domain 169.254.169.254 not in allowlist

# Result: Attack prevented at domain validation layer
```

---

## Domain Allowlist System

### File Locations

```
json.rocks/
├── data/
│   ├── allowed-domains-top1000.json    # Default list (committed)
│   └── allowed-domains-custom.json     # Custom list (gitignored)
```

### Default List (Top 1000)

**File**: `data/allowed-domains-top1000.json`

**Purpose**: Curated list of 1000+ popular domains commonly shared in chat applications.

**Categories Included**:
- Social media (Twitter, Reddit, LinkedIn, Facebook, etc.)
- Development platforms (GitHub, GitLab, Stack Overflow, npm, etc.)
- News sites (NYTimes, BBC, CNN, The Guardian, etc.)
- Cloud providers (AWS, Azure, Vercel, Netlify, etc.)
- Documentation (MDN, React, Node.js, Python, etc.)
- Video platforms (YouTube, Vimeo, Twitch, etc.)
- E-commerce (Amazon, eBay, Shopify, etc.)
- And many more...

**Coverage**: Approximately 80% of URLs shared in typical chat applications.

**Format**:
```json
{
  "version": "1.0.0",
  "description": "Curated top 1000 domains for link preview",
  "updated": "2026-01-14",
  "categories": {
    "social": ["twitter.com", "x.com", "reddit.com", ...],
    "tech": ["github.com", "gitlab.com", ...],
    "news": ["nytimes.com", "bbc.com", ...]
  },
  "domains": [
    "twitter.com",
    "github.com",
    "youtube.com",
    ...
  ]
}
```

**Git Behavior**: This file is committed to git and updated via pull requests.

### Custom List (Your Additions)

**File**: `data/allowed-domains-custom.json`

**Purpose**: Add your own domains without modifying the default list.

**Git Behavior**: This file is gitignored and won't be committed.

**Format (Simple Array)**:
```json
[
  "yourdomain.com",
  "blog.yourcompany.com",
  "docs.myapp.io"
]
```

**Format (Object with Metadata)**:
```json
{
  "version": "1.0.0",
  "description": "Custom domains for MyCompany",
  "domains": [
    "yourdomain.com",
    "blog.yourcompany.com",
    "docs.myapp.io"
  ]
}
```

Both formats are supported and automatically merged with the default list.

---

## Adding Custom Domains

### Step 1: Create Custom Domains File

Create `data/allowed-domains-custom.json`:

```bash
cd /path/to/json.rocks
nano data/allowed-domains-custom.json
```

**Simple Format** (recommended for quick additions):
```json
[
  "mycompany.com",
  "blog.mycompany.com",
  "docs.myapp.io"
]
```

**Detailed Format** (recommended for organization):
```json
{
  "version": "1.0.0",
  "description": "Custom domains for MyCompany chat app",
  "updated": "2026-01-14",
  "domains": [
    "mycompany.com",
    "blog.mycompany.com",
    "docs.myapp.io",
    "status.myapp.io"
  ]
}
```

### Step 2: Validate JSON

Ensure your JSON is valid:

```bash
# Using Node.js
node -e "console.log(JSON.parse(require('fs').readFileSync('data/allowed-domains-custom.json')))"

# Using jq
jq . data/allowed-domains-custom.json

# Using Python
python3 -m json.tool data/allowed-domains-custom.json
```

### Step 3: Restart or Reload

**Option A: Restart the server** (simple):
```bash
# PM2
pm2 restart json.rocks

# Direct
pkill -f server.js && npm start

# Docker
docker restart json-rocks
```

**Option B: Hot reload without restart** (zero downtime):
```bash
# Set admin password if not already set
export ADMIN_PASS=your-admin-password

# Reload domains
curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains
```

### Step 4: Verify

Check that your domains were loaded:

```bash
# View all loaded domains
curl -u admin:$ADMIN_PASS http://localhost:9980/admin/domains

# Test a custom domain
curl "http://localhost:9980/?uri=https://mycompany.com"
```

---

## Managing the Default List

### When to Modify vs Extend

**Use Custom List When**:
- Adding company-specific domains
- Testing new domains temporarily
- Different environments need different domains
- You want to keep your additions private

**Contribute to Default List When**:
- Adding popular public domains (Alexa/Tranco top 10k)
- Adding major platforms used by many chat apps
- Improving coverage for specific categories
- Fixing missing popular sites

### Contributing to Default List

1. Fork the repository
2. Edit `data/allowed-domains-top1000.json`
3. Add domains to appropriate category
4. Update the `domains` array
5. Submit a pull request with justification

**Example PR Description**:
```markdown
## Add Major News Sites

Adding 5 popular news domains:
- apnews.com - Associated Press (Tranco rank: 1,234)
- reuters.com - Reuters (Tranco rank: 2,345)
- bloomberg.com - Bloomberg News (Tranco rank: 3,456)

These are frequently shared in news-focused chat applications.

Coverage increase: +0.5% of typical chat app URLs
```

### Local Modifications (Not Recommended)

If you must modify the default list locally:

```bash
# Edit the default list
nano data/allowed-domains-top1000.json

# This creates a git conflict - you must manage updates manually
git update-index --assume-unchanged data/allowed-domains-top1000.json
```

**Warning**: Local modifications make it hard to pull updates. Use custom list instead.

---

## Domain Reloading

### Hot Reload (Zero Downtime)

Reload domains without restarting the server:

**Prerequisites**:
```bash
# Set admin password
export ADMIN_PASS=your-secure-password
```

**Reload Command**:
```bash
curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains
```

**Response**:
```json
{
  "status": "success",
  "message": "Domains reloaded successfully",
  "count": 823,
  "breakdown": {
    "default": 790,
    "custom": 33
  }
}
```

**What Gets Reloaded**:
- ✅ Both default and custom domain lists
- ✅ Merged and deduplicated automatically
- ✅ Takes effect immediately for new requests
- ❌ Cached requests use old validation (cache expires in 30 min)

**Use Cases**:
- Added new custom domains
- Updated default list via git pull
- Testing domain additions before committing
- Emergency blocking (remove from custom list)

### Full Restart

When hot reload isn't working:

```bash
# PM2
pm2 restart json.rocks

# Systemd
sudo systemctl restart json-rocks

# Docker
docker restart json-rocks

# Direct
pkill -f server.js && npm start
```

---

## Subdomain Handling

### Automatic Subdomain Matching

When you add a domain to the allowlist, **all subdomains are automatically allowed**.

**Example**:
```json
{
  "domains": ["github.com"]
}
```

**Allows**:
- ✅ `github.com`
- ✅ `www.github.com`
- ✅ `api.github.com`
- ✅ `gist.github.com`
- ✅ `raw.githubusercontent.com`
- ✅ `docs.github.com`
- ✅ `any.subdomain.github.com`

**Blocks**:
- ❌ `githubcopilot.com` (different domain)
- ❌ `mygithub.com` (different domain)
- ❌ `github.co.uk` (different TLD)

### Implementation

The server extracts the root domain and checks if it ends with any allowlisted domain:

```javascript
// Simplified logic
function isDomainAllowed(url) {
  const hostname = new URL(url).hostname

  for (const allowedDomain of ALLOWED_DOMAINS) {
    // Exact match or subdomain match
    if (hostname === allowedDomain ||
        hostname.endsWith('.' + allowedDomain)) {
      return true
    }
  }

  return false
}
```

### Wildcard Subdomains

**Not needed** - Subdomain matching is automatic.

**Don't do this**:
```json
{
  "domains": [
    "github.com",
    "*.github.com",      // ❌ Not necessary
    "api.github.com",    // ❌ Redundant
    "gist.github.com"    // ❌ Redundant
  ]
}
```

**Do this instead**:
```json
{
  "domains": [
    "github.com"  // ✅ Covers all subdomains
  ]
}
```

### Multi-Level Subdomains

All subdomain levels are supported:

```json
{
  "domains": ["mycompany.com"]
}
```

**Allows**:
- ✅ `blog.mycompany.com`
- ✅ `api.internal.mycompany.com`
- ✅ `docs.v2.staging.mycompany.com`
- ✅ `a.b.c.d.e.mycompany.com`

---

## Troubleshooting

### Domain Not Working

**Problem**: `HTTP 403: Domain example.com not in allowlist`

**Solutions**:

1. **Check domain format**:
   ```bash
   # Wrong - includes protocol
   "https://example.com"  ❌

   # Wrong - includes path
   "example.com/page"     ❌

   # Correct
   "example.com"          ✅
   ```

2. **Verify domain is loaded**:
   ```bash
   curl -u admin:$ADMIN_PASS http://localhost:9980/admin/domains | grep example.com
   ```

3. **Check JSON syntax**:
   ```bash
   jq . data/allowed-domains-custom.json
   # If error: fix JSON syntax
   ```

4. **Reload domains**:
   ```bash
   curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains
   ```

5. **Check server logs**:
   ```bash
   # PM2
   pm2 logs json.rocks --lines 50

   # Look for:
   # "Loaded X default domains from top1000 list"
   # "Loaded Y custom domains"
   # "Total allowed domains: Z"
   ```

### Custom Domains Not Loading

**Problem**: Custom domains ignored after restart

**Solutions**:

1. **Verify file exists**:
   ```bash
   ls -la data/allowed-domains-custom.json
   ```

2. **Check file permissions**:
   ```bash
   chmod 644 data/allowed-domains-custom.json
   ```

3. **Validate JSON**:
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('data/allowed-domains-custom.json')))"
   ```

4. **Check logs for errors**:
   ```bash
   pm2 logs json.rocks | grep -i "custom"

   # Should see:
   # "Loaded X custom domains"
   ```

5. **Verify file path**:
   ```bash
   # Server looks for:
   # /path/to/json.rocks/data/allowed-domains-custom.json

   # Check working directory
   pwd
   ```

### Subdomain Not Working

**Problem**: `blog.mycompany.com` blocked but `mycompany.com` is in allowlist

**This shouldn't happen** - subdomains are automatically allowed.

**Debug**:
```bash
# Check exact domain in allowlist
curl -u admin:$ADMIN_PASS http://localhost:9980/admin/domains | grep mycompany.com

# Test the URL
curl "http://localhost:9980/?uri=https://blog.mycompany.com"

# Check server logs for the actual error
pm2 logs json.rocks --lines 100 | grep -i "blog.mycompany.com"
```

If still failing, this is a bug - please report it.

### Reload Not Working

**Problem**: Changes to custom list not taking effect after reload

**Solutions**:

1. **Check admin password**:
   ```bash
   # Wrong password = 401 Unauthorized
   curl -u admin:wrong-password -X POST http://localhost:9980/admin/reload-domains
   ```

2. **Verify reload response**:
   ```bash
   curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains

   # Should see:
   # {"status":"success","count":823}
   ```

3. **Clear cache**:
   ```bash
   # Add ?refresh=true to bypass cache
   curl "http://localhost:9980/?uri=https://example.com&refresh=true"
   ```

4. **Full restart** (fallback):
   ```bash
   pm2 restart json.rocks
   ```

### JSON Validation Errors

**Problem**: `Unexpected token } in JSON at position 123`

**Common Issues**:

1. **Trailing comma**:
   ```json
   {
     "domains": [
       "example.com",
       "test.com",    // ❌ Trailing comma
     ]
   }
   ```

   **Fix**: Remove trailing comma

2. **Missing quote**:
   ```json
   {
     "domains": [
       "example.com,   // ❌ Missing closing quote
       "test.com"
     ]
   }
   ```

   **Fix**: Add closing quote

3. **Comments** (not allowed in JSON):
   ```json
   {
     "domains": [
       "example.com"  // ❌ JSON doesn't support comments
     ]
   }
   ```

   **Fix**: Remove comments

**Validation Tools**:
```bash
# Node.js
node -e "JSON.parse(require('fs').readFileSync('data/allowed-domains-custom.json'))"

# jq (shows exact error location)
jq . data/allowed-domains-custom.json

# Online: https://jsonlint.com/
```

---

## Best Practices

### Security

1. **Principle of Least Privilege**
   - Only add domains you actually need
   - Don't add entire TLDs (e.g., `.com`, `.io`)
   - Review custom domains quarterly

2. **Avoid Overly Broad Domains**
   ```json
   // ❌ Bad - too broad
   {
     "domains": [
       "amazonaws.com",     // Allows ALL AWS user content
       "github.io",         // Allows ALL GitHub Pages
       "herokuapp.com"      // Allows ALL Heroku apps
     ]
   }

   // ✅ Good - specific
   {
     "domains": [
       "docs.aws.amazon.com",       // Official AWS docs only
       "yourcompany.github.io",     // Your GitHub Pages
       "yourapp.herokuapp.com"      // Your Heroku app
     ]
   }
   ```

3. **Regular Audits**
   ```bash
   # Review custom domains monthly
   cat data/allowed-domains-custom.json

   # Remove unused domains
   # Add domains as needed
   ```

4. **Use Custom List for Testing**
   ```json
   {
     "description": "Testing domains - remove after validation",
     "domains": [
       "test-domain.com"  // Remove after testing
     ]
   }
   ```

### Performance

1. **Minimize Custom List Size**
   - Large lists slow down domain validation
   - Target: <100 custom domains
   - For 100+ domains, consider contributing to default list

2. **Avoid Duplicates**
   ```json
   // ❌ Bad - duplicates
   {
     "domains": [
       "github.com",
       "github.com",      // Duplicate
       "api.github.com"   // Redundant (subdomain)
     ]
   }

   // ✅ Good - deduplicated
   {
     "domains": [
       "github.com"  // Covers api.github.com
     ]
   }
   ```

3. **Use Reload Instead of Restart**
   - Hot reload: <100ms downtime
   - Full restart: 2-5s downtime
   - Use reload for production

### Organization

1. **Document Your Additions**
   ```json
   {
     "version": "1.0.0",
     "description": "Custom domains for Acme Corp chat application",
     "updated": "2026-01-14",
     "owner": "devops@acmecorp.com",
     "categories": {
       "internal": ["intranet.acmecorp.com", "wiki.acmecorp.com"],
       "partners": ["partnerapi.example.com"],
       "testing": ["staging.acmecorp.com"]
     },
     "domains": [
       "intranet.acmecorp.com",
       "wiki.acmecorp.com",
       "partnerapi.example.com",
       "staging.acmecorp.com"
     ]
   }
   ```

2. **Version Control**
   ```bash
   # Keep a backup outside of git
   cp data/allowed-domains-custom.json data/allowed-domains-custom.backup.json

   # Or use a private git repo
   cd data/
   git init
   git add allowed-domains-custom.json
   git commit -m "Add custom domains"
   git remote add origin git@private-git.com:acme/custom-domains.git
   git push
   ```

3. **Environment-Specific Lists**
   ```bash
   # Development
   cp data/allowed-domains-custom.dev.json data/allowed-domains-custom.json

   # Staging
   cp data/allowed-domains-custom.staging.json data/allowed-domains-custom.json

   # Production
   cp data/allowed-domains-custom.prod.json data/allowed-domains-custom.json
   ```

---

## Examples

### Example 1: Basic Custom Domains

**Scenario**: Add 3 company domains for internal chat app

**File**: `data/allowed-domains-custom.json`
```json
[
  "acmecorp.com",
  "blog.acmecorp.com",
  "docs.acmecorp.com"
]
```

**Commands**:
```bash
# Create file
cat > data/allowed-domains-custom.json <<EOF
[
  "acmecorp.com",
  "blog.acmecorp.com",
  "docs.acmecorp.com"
]
EOF

# Reload
curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains

# Test
curl "http://localhost:9980/?uri=https://blog.acmecorp.com"
```

### Example 2: Organized Custom List

**Scenario**: Multiple categories of domains with documentation

**File**: `data/allowed-domains-custom.json`
```json
{
  "version": "1.0.0",
  "description": "Acme Corp chat application custom domains",
  "owner": "devops@acmecorp.com",
  "updated": "2026-01-14",
  "categories": {
    "internal": [
      "intranet.acmecorp.com",
      "wiki.acmecorp.com",
      "jira.acmecorp.com"
    ],
    "external": [
      "blog.acmecorp.com",
      "help.acmecorp.com"
    ],
    "partners": [
      "api.partner1.com",
      "docs.partner2.io"
    ]
  },
  "domains": [
    "intranet.acmecorp.com",
    "wiki.acmecorp.com",
    "jira.acmecorp.com",
    "blog.acmecorp.com",
    "help.acmecorp.com",
    "api.partner1.com",
    "docs.partner2.io"
  ]
}
```

### Example 3: Development vs Production

**Development**: `data/allowed-domains-custom.dev.json`
```json
{
  "description": "Development environment - includes test domains",
  "domains": [
    "staging.acmecorp.com",
    "dev.acmecorp.com",
    "test.acmecorp.com"
  ]
}
```

**Production**: `data/allowed-domains-custom.prod.json`
```json
{
  "description": "Production environment - public domains only",
  "domains": [
    "acmecorp.com",
    "blog.acmecorp.com",
    "help.acmecorp.com"
  ]
}
```

**Deploy Script**:
```bash
#!/bin/bash
ENV=${1:-production}

if [ "$ENV" = "development" ]; then
  cp data/allowed-domains-custom.dev.json data/allowed-domains-custom.json
elif [ "$ENV" = "production" ]; then
  cp data/allowed-domains-custom.prod.json data/allowed-domains-custom.json
fi

pm2 restart json.rocks
```

### Example 4: Emergency Domain Addition

**Scenario**: Urgent - need to add domain without full restart

```bash
# 1. Add domain to custom list
jq '. += ["urgent-domain.com"]' data/allowed-domains-custom.json > tmp.json
mv tmp.json data/allowed-domains-custom.json

# 2. Hot reload (zero downtime)
curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains

# 3. Verify immediately
curl "http://localhost:9980/?uri=https://urgent-domain.com" | jq .title

# 4. Clear cache if needed
curl "http://localhost:9980/?uri=https://urgent-domain.com&refresh=true" | jq .title
```

---

## Support

### Getting Help

- **Documentation**: See [README.md](README.md) for general usage
- **Issues**: Report bugs at https://github.com/spux/json.rocks/issues

### Contributing

Contributions to the default domain list are welcome! See [README.md](README.md#contributing) for guidelines.

---

**Last Updated**: 2026-01-14
**Version**: 2.0.0
**Maintainer**: Melvin Carvalho
