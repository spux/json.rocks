![JSON Rocks](images/logo.svg)

# json.rocks

**A web scraping service that converts any webpage into structured JSON data - perfect for generating rich link previews in chat applications.**

Turn any URL into clean, structured metadata including title, description, images, videos, and more. Ideal for Slack-style link unfurling, Discord embeds, WhatsApp previews, and any chat application that needs rich link previews.

[![npm version](https://badge.fury.io/js/jsonrocks.svg)](https://www.npmjs.com/package/jsonrocks)

---

## 🎯 Use Case: Chat Link Previews

When users paste URLs in your chat app, json.rocks automatically extracts:

- **Title** - Page title for the preview card
- **Description** - Meta description or article excerpt
- **Image** - Open Graph image, featured image, or thumbnail
- **Logo** - Site favicon or publisher logo
- **Author** - Article author name
- **Publisher** - Site/publication name
- **Videos** - Embedded videos (YouTube, Vimeo, etc.)
- **Date** - Publication date
- **URL** - Canonical URL

Perfect for building chat features like:
- Slack-style link unfurling
- Discord rich embeds
- WhatsApp link previews
- iMessage link bubbles
- Telegram instant view

---

## 🚀 Quick Start

### Installation

```bash
npm install -g jsonrocks
```

### Run the Server

```bash
# Start on default port 9980
jsonrocks

# Or run directly from source
./bin/server.js

# Custom port
./bin/server.js --port 8080

# HTTPS mode (requires SSL certificates)
./bin/server.js --https --key ./privkey.pem --cert ./fullchain.pem
```

### Test the API

```bash
# Extract metadata from a URL
curl "http://localhost:9980/?uri=https://github.com/spux/json.rocks"

# Search the web (returns JSON results)
curl "http://localhost:9980/?uri=chat+applications"
```

---

## 📖 API Reference

### Main Endpoint: `GET /`

Extract structured JSON metadata from any URL.

**Parameters:**
- `uri` (required) - The URL to scrape OR a search query
- `refresh` (optional) - Set to `true` to bypass cache

**Example Request:**

```javascript
// Fetch link preview data
const response = await fetch('http://localhost:9980/?uri=https://example.com/article')
const data = await response.json()
```

**Example Response:**

```json
{
  "title": "Amazing Article Title",
  "description": "A compelling description of the article content that will appear in your chat preview.",
  "image": "https://example.com/images/featured.jpg",
  "logo": "https://example.com/favicon.ico",
  "author": "Jane Doe",
  "publisher": "Example News",
  "date": "2025-01-13T10:30:00.000Z",
  "url": "https://example.com/article",
  "lang": "en",
  "videos": [
    {
      "url": "https://youtube.com/watch?v=...",
      "width": 1280,
      "height": 720
    }
  ],
  "images": [
    {
      "src": "https://example.com/image1.jpg",
      "alt": "Image description"
    }
  ],
  "links": [
    {
      "href": "https://example.com/related",
      "text": "Related Article"
    }
  ]
}
```

### Health Check: `GET /health`

Returns server status.

```bash
curl http://localhost:9980/health
# Response: { "status": "ok" }
```

### Admin Endpoints

**View allowed domains:**
```bash
curl http://localhost:9980/admin/domains
```

**Reload domain configuration:**
```bash
curl -X POST http://localhost:9980/admin/reload-domains
```

---

## 💬 Chat App Integration Examples

### Basic Link Preview

```javascript
async function generateLinkPreview(url) {
  const response = await fetch(
    `http://localhost:9980/?uri=${encodeURIComponent(url)}`
  )
  const data = await response.json()

  return {
    title: data.title,
    description: data.description,
    thumbnail: data.image,
    favicon: data.logo,
    siteName: data.publisher,
    author: data.author,
    publishedAt: data.date
  }
}

// Usage in your chat app
const preview = await generateLinkPreview('https://github.com/spux/json.rocks')
console.log(preview)
```

### React Component Example

```jsx
import { useState, useEffect } from 'react'

function LinkPreview({ url }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`http://localhost:9980/?uri=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        setPreview(data)
        setLoading(false)
      })
  }, [url])

  if (loading) return <div>Loading preview...</div>

  return (
    <div className="link-preview">
      {preview.image && <img src={preview.image} alt={preview.title} />}
      <h3>{preview.title}</h3>
      <p>{preview.description}</p>
      <span className="source">{preview.publisher}</span>
    </div>
  )
}
```

### Node.js Backend Integration

```javascript
import express from 'express'
import fetch from 'node-fetch'

const app = express()

// API endpoint for your chat app to request link previews
app.get('/api/preview', async (req, res) => {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'URL required' })
  }

  try {
    const response = await fetch(
      `http://localhost:9980/?uri=${encodeURIComponent(url)}`
    )
    const data = await response.json()

    // Transform to your chat app's format
    res.json({
      title: data.title,
      description: data.description,
      image: data.image,
      siteName: data.publisher,
      url: data.url
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})

app.listen(3000)
```

### Python/Flask Integration

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/api/preview')
def get_preview():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL required'}), 400

    try:
        response = requests.get(f'http://localhost:9980/?uri={url}')
        data = response.json()

        return jsonify({
            'title': data.get('title'),
            'description': data.get('description'),
            'image': data.get('image'),
            'siteName': data.get('publisher'),
            'url': data.get('url')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)
```

---

## ⚙️ Configuration

### Domain Allowlist

For security, only whitelisted domains can be scraped. json.rocks includes **1000+ popular domains** by default, covering:

- Social media (Twitter, Reddit, LinkedIn, etc.)
- Development platforms (GitHub, GitLab, npm, etc.)
- News sites (NYTimes, BBC, CNN, etc.)
- Cloud providers (AWS, Azure, Vercel, Netlify, etc.)
- Documentation sites (MDN, React, Node.js, etc.)
- And many more...

**Default domains:** Loaded from `data/allowed-domains-top1000.json` (committed to git)

#### Adding Custom Domains

To add your own domains without modifying the default list:

1. Create `data/allowed-domains-custom.json`:
   ```json
   [
     "yourdomain.com",
     "blog.yourdomain.com",
     "mycompany.com"
   ]
   ```

2. Restart the server - custom domains are automatically merged with defaults

3. Or reload without restart:
   ```bash
   export ADMIN_PASS=your-password
   curl -u admin:$ADMIN_PASS -X POST http://localhost:9980/admin/reload-domains
   ```

**Note:** Subdomains are automatically included (e.g., `github.com` allows `api.github.com`, `gist.github.com`)

**Total domains:** Default (1000+) + Custom (your additions) = Automatically merged and deduplicated

See [DOMAIN_MANAGEMENT.md](DOMAIN_MANAGEMENT.md) for detailed configuration guide.

### Rate Limiting

Default limits:
- **Cached requests:** 100 requests/minute per IP
- **Non-cached requests:** 5 requests/minute per IP

Configured in `bin/server.js` (lines 229-251).

### Caching

Two-tier caching strategy:
- **Memory cache:** LRU cache (100 items, 30-minute TTL)
- **Disk cache:** JSON files in `data/` directory organized by domain

**Bypass cache:**
```bash
curl "http://localhost:9980/?uri=https://example.com&refresh=true"
```

---

## 🔒 Security Features

- **Domain allowlist** - Only whitelisted domains can be scraped
- **IP blocking** - Blocks private IP ranges, localhost, AWS metadata endpoints
- **Rate limiting** - Prevents abuse with per-IP limits
- **Content size limits** - Max 5MB per request
- **Concurrent request limits** - Max 5 concurrent requests per IP
- **Request timeout** - 5-second timeout with 3 redirect limit
- **XSS protection** - HTML escaping throughout
- **SSRF protection** - URL validation and private IP blocking
- **Security headers** - CSP, X-Frame-Options, X-Content-Type-Options

---

## 🏗️ Architecture

```
┌─────────────┐
│  Chat App   │
└──────┬──────┘
       │ HTTP GET /?uri=...
       ▼
┌─────────────────┐
│  json.rocks     │
│  (Port 9980)    │
├─────────────────┤
│ • Rate Limiter  │
│ • Domain Check  │
│ • IP Validator  │
└──────┬──────────┘
       │
       ├─→ Memory Cache (LRU)
       │   └─→ Return if cached
       │
       ├─→ Disk Cache
       │   └─→ Return if cached
       │
       └─→ Web Scraper
           ├─→ Fetch HTML (axios)
           ├─→ Extract Content (unfluff)
           ├─→ Extract Metadata (metascraper)
           └─→ Return JSON
```

**Tech Stack:**
- **Fastify** - Web framework
- **Axios** - HTTP client
- **Unfluff** - Content extraction
- **Metascraper** - Metadata extraction with platform-specific plugins
- **Cheerio** - HTML parsing
- **LRU-Cache** - In-memory caching

---

## 📦 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 9980

CMD ["node", "bin/server.js"]
```

```bash
# Build and run
docker build -t json-rocks .
docker run -p 9980:9980 json-rocks
```

### Docker Compose

```yaml
version: '3.8'
services:
  json-rocks:
    build: .
    ports:
      - "9980:9980"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Production Deployment

**Using PM2:**
```bash
npm install -g pm2
pm2 start bin/server.js --name json-rocks
pm2 save
pm2 startup
```

**Nginx reverse proxy:**
```nginx
server {
    listen 80;
    server_name json.rocks;

    location / {
        proxy_pass http://localhost:9980;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 🛠️ Development

### Requirements
- Node.js 14+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/spux/json.rocks.git
cd json.rocks

# Install dependencies
npm install

# Start development server
npm start
```

### Project Structure

```
json.rocks/
├── bin/
│   └── server.js           # Main server (738 lines)
├── js/
│   ├── jr.js              # Utility library
│   └── json-renderer.js   # Frontend JSON renderer
├── data/
│   ├── allowed-domains.json  # Security domain allowlist
│   └── [cached data]/        # Disk cache organized by domain
├── images/                 # UI assets
├── index.html             # Landing page (search interface)
├── package.json
└── README.md
```

---

## 🎨 Features

### Automatic Content Extraction

- **Article text** - Main content extraction
- **Metadata** - Title, description, author, date
- **Media** - Images with alt text, videos, iframes
- **Links** - All hyperlinks extracted
- **Schema.org** - Structured data with JSON-LD

### Platform-Specific Extractors

- **Amazon** - Product info
- **Spotify** - Track/album metadata
- **YouTube** - Video details
- **Twitter** - Tweet embeds
- **Generic fallback** - Works on any webpage

### Search Functionality

```bash
# Search the web for JSON content
curl "http://localhost:9980/?uri=best+javascript+frameworks"
```

Returns search results in structured JSON format.

---

## 📊 Response Examples

### GitHub Repository

```json
{
  "title": "spux/json.rocks: Search the web of JSON",
  "description": "A web scraping service that converts any webpage into structured JSON data",
  "image": "https://opengraph.githubassets.com/...",
  "publisher": "GitHub",
  "author": "spux",
  "url": "https://github.com/spux/json.rocks"
}
```

### News Article

```json
{
  "title": "Breaking News: Important Event Occurs",
  "description": "Detailed coverage of the significant event...",
  "image": "https://news.example.com/images/featured.jpg",
  "author": "Jane Reporter",
  "publisher": "News Network",
  "date": "2025-01-13T15:30:00.000Z",
  "lang": "en"
}
```

### YouTube Video

```json
{
  "title": "Amazing Video Title",
  "description": "Video description and details",
  "image": "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg",
  "publisher": "YouTube",
  "videos": [{
    "url": "https://www.youtube.com/embed/VIDEO_ID",
    "width": 1280,
    "height": 720
  }]
}
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

ISC License - See package.json for details

---

## 🔗 Links

- **NPM Package:** https://www.npmjs.com/package/jsonrocks
- **GitHub:** https://github.com/spux/json.rocks
- **Live Demo:** https://json.rocks

---

## 💡 FAQ

### Q: Can I use this for my chat application?
**A:** Yes! That's exactly what it's designed for. See the integration examples above.

### Q: How do I add support for more domains?
**A:** Edit `data/allowed-domains.json` and add your domains. See [DOMAIN_MANAGEMENT.md](DOMAIN_MANAGEMENT.md).

### Q: Is there a hosted version?
**A:** Yes, available at https://json.rocks (GitHub Pages deployment).

### Q: What about rate limiting?
**A:** Default limits are 5 req/min uncached, 100 req/min cached per IP. Configure in server.js.

### Q: Does it support authentication?
**A:** Currently no. Add authentication middleware for production use.

### Q: Can I self-host?
**A:** Absolutely! See the deployment section above.

---

## ⚠️ Known Limitations

- Domain allowlist required for security (not all sites allowed by default)
- Rate limits apply (5 req/min uncached)
- File-based disk cache (consider Redis for production)
- No built-in authentication (add your own middleware)
- Admin endpoints are public (secure before production)

---

## 🗺️ Roadmap

- [ ] Add authentication support
- [ ] Redis cache option
- [ ] GraphQL API
- [ ] Webhook support
- [ ] Batch URL processing
- [ ] Screenshot capture
- [ ] PDF generation
- [ ] Custom extraction rules

---

**Built with ❤️ for the chat app community**
