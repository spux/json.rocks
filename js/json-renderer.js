// Modern JSON Renderer - Dependency-free, lush UI
// Renders JSON-LD data into beautiful, interactive interface

class JSONRenderer {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    // Wait for DOM and external scripts to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.render());
    } else {
      this.render();
    }
  }

  render() {
    this.extractData();
    if (!this.data) return;
    
    this.injectStyles();
    this.createInterface();
    this.highlightJSON();
  }

  extractData() {
    const dataScript = document.getElementById('data');
    if (dataScript) {
      try {
        this.data = JSON.parse(dataScript.textContent);
      } catch (e) {
        console.warn('Failed to parse JSON data:', e);
      }
    }
  }

  injectStyles() {
    const styles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
      }

      .json-container {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        overflow: hidden;
        margin: 20px 0;
      }

      .header {
        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
        color: white;
        padding: 30px;
        text-align: center;
      }

      .header h1 {
        margin: 0;
        font-size: 2.2em;
        font-weight: 300;
      }

      .header .url {
        opacity: 0.9;
        font-size: 0.9em;
        margin-top: 10px;
        word-break: break-all;
      }

      .content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        padding: 40px;
      }

      .metadata {
        space-y: 25px;
      }

      .metadata-item {
        margin-bottom: 25px;
      }

      .metadata-item h3 {
        color: #2c3e50;
        margin: 0 0 10px 0;
        font-size: 1.1em;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .metadata-item p {
        margin: 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }

      .links-grid {
        display: grid;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
      }

      .link-item {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        background: #f8f9fa;
        border-radius: 6px;
        text-decoration: none;
        color: #2c3e50;
        border-left: 3px solid #3498db;
        transition: all 0.2s ease;
      }

      .link-item:hover {
        background: #e9ecef;
        transform: translateX(3px);
      }

      .link-icon {
        width: 16px;
        height: 16px;
        margin-right: 8px;
        opacity: 0.7;
      }

      .json-display {
        position: relative;
      }

      .json-display h3 {
        color: #2c3e50;
        margin: 0 0 15px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .copy-btn {
        background: #667eea;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8em;
        transition: background 0.2s ease;
      }

      .copy-btn:hover {
        background: #5a67d8;
      }

      .json-code {
        background: #2d3748;
        color: #e2e8f0;
        padding: 20px;
        border-radius: 8px;
        overflow-x: auto;
        overflow-y: auto;
        max-height: 600px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 0.9em;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
      }

      .json-key {
        color: #81e6d9;
      }

      .json-string {
        color: #f6e05e;
      }

      .json-number {
        color: #fc8181;
      }

      .json-boolean {
        color: #90cdf4;
      }

      .json-null {
        color: #a0aec0;
      }

      .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
        max-height: 400px;
        overflow-y: auto;
      }

      .image-item {
        border-radius: 8px;
        overflow: hidden;
        background: #f8f9fa;
        transition: transform 0.2s ease;
      }

      .image-item:hover {
        transform: scale(1.02);
      }

      .image-item img {
        width: 100%;
        height: 120px;
        object-fit: cover;
      }

      .image-caption {
        padding: 8px;
        font-size: 0.8em;
        color: #666;
      }

      .stats {
        display: flex;
        justify-content: space-around;
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 25px;
      }

      .stat-item {
        text-align: center;
      }

      .stat-number {
        font-size: 2em;
        font-weight: bold;
        color: #667eea;
        display: block;
      }

      .stat-label {
        font-size: 0.9em;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      @media (max-width: 768px) {
        .content {
          grid-template-columns: 1fr;
          padding: 20px;
        }
        
        body {
          padding: 10px;
        }
      }

      .fade-in {
        animation: fadeIn 0.6s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  createInterface() {
    const container = document.createElement('div');
    container.className = 'json-container fade-in';
    
    container.innerHTML = `
      <div class="header">
        <h1>${this.escapeHtml(this.data.title || 'Untitled')}</h1>
        <div class="url">${this.escapeHtml(this.data.url || window.location.href)}</div>
      </div>
      
      <div class="content">
        <div class="metadata">
          ${this.renderStats()}
          ${this.renderMetadata()}
          ${this.renderLinks()}
          ${this.renderImages()}
        </div>
        
        <div class="json-display">
          <h3>
            🔍 Raw Data 
            <button class="copy-btn" onclick="jsonRenderer.copyJSON()">Copy JSON</button>
          </h3>
          <pre class="json-code" id="json-code"></pre>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    
    // Expose for copy function
    window.jsonRenderer = this;
  }

  renderStats() {
    const stats = [
      { label: 'Links', value: (this.data.links || []).length },
      { label: 'Images', value: (this.data.images || []).length },
      { label: 'Videos', value: (this.data.videos || []).length }
    ];

    return `
      <div class="stats">
        ${stats.map(stat => `
          <div class="stat-item">
            <span class="stat-number">${stat.value}</span>
            <span class="stat-label">${stat.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderMetadata() {
    const items = [
      { icon: '📝', title: 'Description', value: this.data.description },
      { icon: '👤', title: 'Author', value: Array.isArray(this.data.author) ? this.data.author.join(', ') : this.data.author },
      { icon: '📅', title: 'Date', value: this.data.date },
      { icon: '🏢', title: 'Publisher', value: this.data.publisher },
      { icon: '📄', title: 'Text Preview', value: this.data.text ? this.data.text.substring(0, 200) + '...' : null }
    ].filter(item => item.value);

    return items.map(item => `
      <div class="metadata-item">
        <h3>${item.icon} ${item.title}</h3>
        <p>${this.escapeHtml(item.value)}</p>
      </div>
    `).join('');
  }

  renderLinks() {
    const links = this.data.links || [];
    if (!links.length) return '';

    return `
      <div class="metadata-item">
        <h3>🔗 Links (${links.length})</h3>
        <div class="links-grid">
          ${links.slice(0, 10).map(link => `
            <a href="${this.escapeHtml(link.href || '#')}" class="link-item" target="_blank" rel="noopener">
              <svg class="link-icon" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
                <path d="M5 5a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-2a1 1 0 10-2 0v2H5V7h2a1 1 0 000-2H5z"></path>
              </svg>
              ${this.escapeHtml((link.text || link.href || 'Link').substring(0, 50))}
            </a>
          `).join('')}
          ${links.length > 10 ? `<div class="link-item">... and ${links.length - 10} more</div>` : ''}
        </div>
      </div>
    `;
  }

  renderImages() {
    const images = this.data.images || [];
    if (!images.length) return '';

    return `
      <div class="metadata-item">
        <h3>🖼️ Images (${images.length})</h3>
        <div class="images-grid">
          ${images.slice(0, 8).map(img => `
            <div class="image-item">
              <img src="${this.escapeHtml(img.src || img.href)}" 
                   alt="${this.escapeHtml(img.alt || 'Image')}"
                   onerror="this.parentElement.style.display='none'">
              <div class="image-caption">${this.escapeHtml((img.alt || img.title || '').substring(0, 30))}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  highlightJSON() {
    const codeElement = document.getElementById('json-code');
    if (codeElement) {
      const formatted = this.syntaxHighlight(JSON.stringify(this.data, null, 2));
      codeElement.innerHTML = formatted;
    }
  }

  syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  }

  copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(this.data, null, 2))
      .then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied ✓';
        btn.style.background = '#48bb78';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      })
      .catch(err => console.log('Copy failed:', err));
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when script loads
new JSONRenderer();