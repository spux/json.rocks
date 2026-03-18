import { html, render } from '/losos/html.js'
export default {
  label: 'JSON', icon: '\u{1F4CB}',
  canHandle(subject, store) { return store.get(subject.value) != null },
  render(subject, store, container) {
    var node = store.get(subject.value); if (!node) return
    var raw = JSON.stringify(node, null, 2)
    render(container, html`
      <div style="padding: 32px; max-width: 700px; margin: 0 auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">\uD83D\uDD0D Raw JSON-LD</h2>
          <button onclick="${function() { navigator.clipboard.writeText(raw); this.textContent = 'Copied \u2713'; setTimeout(function() { this.textContent = 'Copy' }.bind(this), 2000) }}"
            style="background: #667eea; color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font: 500 13px/1 inherit; cursor: pointer;">Copy</button>
        </div>
        <pre style="background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 10px; overflow-x: auto; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${raw}</pre>
      </div>
    `)
  }
}
