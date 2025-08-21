# Domain Allowlist Management

## Overview
The json.rocks server uses a configurable domain allowlist stored in `/data/allowed-domains.json` for security. This file is ignored by git, so each deployment can have its own trusted domains.

## Configuration File Location
```
/data/allowed-domains.json
```

## File Format
```json
{
  "domains": [
    "github.com",
    "stackoverflow.com",
    "wikipedia.org",
    "example.com"
  ],
  "comments": [
    "Add trusted domains here for scraping.",
    "Subdomains are automatically included",
    "This file is in .gitignore for per-deployment customization"
  ],
  "lastUpdated": "2025-08-21T08:00:00.000Z"
}
```

## Adding New Domains

### Method 1: Edit the file directly
1. Edit `/data/allowed-domains.json`
2. Add new domains to the `domains` array
3. Restart the server OR use the reload endpoint

### Method 2: Use admin API (requires server restart or reload)
```bash
# View current allowed domains
curl http://your-server:9980/admin/domains

# Reload domains from file (after editing)
curl -X POST http://your-server:9980/admin/reload-domains
```

## Domain Matching Rules

### ✅ Automatic Subdomain Support
When you add a domain, all subdomains are automatically allowed:
- `github.com` allows:
  - `github.com` ✅
  - `api.github.com` ✅
  - `raw.githubusercontent.com` ✅
  - `docs.github.com` ✅

### ❌ Parent Domain Restrictions
Adding a subdomain does NOT allow the parent domain:
- `api.github.com` allows:
  - `api.github.com` ✅
  - `github.com` ❌ (must be explicitly added)

## Example Configurations

### Development Environment
```json
{
  "domains": [
    "localhost",
    "127.0.0.1",
    "httpbin.org",
    "jsonplaceholder.typicode.com",
    "example.com"
  ]
}
```
**Note:** localhost/127.0.0.1 are normally blocked for security, but the allowlist overrides IP blocking.

### Production News Scraper
```json
{
  "domains": [
    "news.ycombinator.com",
    "reddit.com",
    "medium.com",
    "dev.to",
    "stackoverflow.com",
    "github.com"
  ]
}
```

### Enterprise Internal
```json
{
  "domains": [
    "internal.company.com",
    "wiki.company.com",
    "docs.company.com",
    "github.company.com"
  ]
}
```

## Security Considerations

### ⚠️ Be Careful With:
- **Wildcards:** Not supported - you must list each domain explicitly
- **IP addresses:** Use sparingly as they bypass network security
- **Unknown domains:** Only add domains you trust completely
- **CDN domains:** May allow access to many different sites

### 🛡️ Best Practices:
1. **Principle of least privilege:** Only add domains you actually need
2. **Regular reviews:** Periodically review and remove unused domains
3. **Documentation:** Keep comments explaining why each domain is needed
4. **Monitoring:** Watch logs for requests to non-allowed domains

## Testing Domain Access

```bash
# Test if a domain is allowed (should return 200)
curl "http://your-server:9980/?uri=http://github.com"

# Test blocked domain (should return 403)
curl "http://your-server:9980/?uri=http://malicious.com"
```

## Common Domain Additions

### Social Media
```json
"domains": [
  "twitter.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com"
]
```

### News & Content
```json
"domains": [
  "cnn.com",
  "bbc.com", 
  "reuters.com",
  "techcrunch.com",
  "arstechnica.com"
]
```

### Developer Resources
```json
"domains": [
  "github.com",
  "gitlab.com",
  "stackoverflow.com",
  "docs.microsoft.com",
  "developer.mozilla.org"
]
```

### E-commerce
```json
"domains": [
  "amazon.com",
  "ebay.com",
  "shopify.com",
  "etsy.com"
]
```

## Troubleshooting

### Domain Not Working?
1. **Check spelling** in allowed-domains.json
2. **Reload domains**: `curl -X POST http://your-server:9980/admin/reload-domains`
3. **Check logs** for security validation errors
4. **Test subdomain**: Maybe you need the parent domain

### File Not Found?
The server will create a default file on startup if none exists.

### Permissions Issues?
Ensure the `data/` directory is writable by the server process.

### Invalid JSON?
Check your JSON syntax - use a validator if needed. The server will fall back to defaults if JSON is invalid.

## File Management Tips

### Backup Your Configuration
```bash
cp data/allowed-domains.json data/allowed-domains.json.backup
```

### Version Control (if needed)
While the file is git-ignored, you might want to track changes:
```bash
# Create a template version
cp data/allowed-domains.json allowed-domains.template.json
git add allowed-domains.template.json
```

### Automated Updates
```bash
#!/bin/bash
# Script to add a domain and reload
echo "Adding $1 to allowed domains..."
jq '.domains += ["'$1'"] | .lastUpdated = now' data/allowed-domains.json > tmp.json
mv tmp.json data/allowed-domains.json
curl -X POST http://localhost:9980/admin/reload-domains
```

## API Reference

### GET /admin/domains
Returns current allowed domains configuration.

**Response:**
```json
{
  "allowedDomains": ["github.com", "example.com"],
  "count": 2,
  "configFile": "data/allowed-domains.json"
}
```

### POST /admin/reload-domains  
Reloads domains from the configuration file without restarting.

**Response:**
```json
{
  "success": true,
  "message": "Reloaded 5 allowed domains",
  "domains": ["github.com", "stackoverflow.com", ...]
}
```

This system provides flexible, secure domain management while maintaining the security benefits of an allowlist approach.