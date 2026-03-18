/**
 * LOSOS Shell — Linked Objects OS
 * Minimal pane loader + chrome
 */

import { createStore } from '../lion/index.js'
import defaultRegistry from './registry.js'

// Module-level state — available to resolvePane after boot
var _panes = []
var _registry = Object.assign({}, defaultRegistry)
var _paneCache = new Map()  // url → pane module

/** Load all registered panes from data-pane script tags */
async function loadPanes() {
  const panes = []
  for (const el of document.querySelectorAll('script[data-pane]')) {
    try {
      const mod = await import(el.src)
      if (mod.default?.render) panes.push(mod.default)
    } catch (err) {
      console.warn('[losos] Failed to load pane:', el.src, err)
    }
  }
  return panes
}

/** Parse JSON-LD data islands into a store, return { store, rawData } */
async function loadData() {
  var rawData = null
  var uriParam = new URLSearchParams(window.location.search).get('uri')

  // If ?uri= is provided, fetch that document
  if (uriParam) {
    try {
      var res = await fetch(uriParam.replace(/#.*$/, ''), { headers: { 'Accept': 'application/ld+json' } })
      var parsed = await res.json()
      rawData = parsed
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      if (dataEl) { dataEl.__jsonLd = parsed; dataEl.textContent = JSON.stringify(parsed) }
    } catch (err) {
      console.warn('[losos] Failed to fetch ?uri=:', uriParam, err)
    }
  }

  for (const el of document.querySelectorAll('script[type="application/ld+json"][src]')) {
    try {
      const res = await fetch(el.src + '?t=' + Date.now(), { cache: 'no-store' })
      const text = await res.text()
      el.__jsonLd = JSON.parse(text)
      el.textContent = text
    } catch (err) {
      console.warn('[losos] Failed to fetch data:', el.src, err)
    }
  }

  const dataEls = document.querySelectorAll('script[type="application/ld+json"]')
  const store = new (await import('../lion/index.js')).Store()

  for (const el of dataEls) {
    try {
      // Prefer parsed JS property (safe from </script> corruption), fall back to textContent
      var parsed = el.__jsonLd || (el.textContent.trim() ? JSON.parse(el.textContent) : null)
      if (!parsed) continue
      store.load(parsed)
      if (!rawData) rawData = parsed
    } catch (err) {
      console.warn('[losos] Failed to parse data island:', err)
    }
  }

  // Resolve base URL for absolute URI resolution
  var dataEl = document.querySelector('script[type="application/ld+json"]')
  var baseUrl = ''
  if (dataEl && dataEl.getAttribute('src')) {
    baseUrl = new URL(dataEl.getAttribute('src'), window.location.href).href
  } else {
    baseUrl = window.location.href.replace(/[?#].*$/, '')
  }

  return { store, rawData, baseUrl }
}

/** Create a rdflib-compatible NamedNode */
function namedNode(value, baseUrl) {
  if (baseUrl && value.startsWith('#')) {
    value = baseUrl + value
  }
  var docUri = value.replace(/#.*$/, '') || value
  return {
    termType: 'NamedNode',
    value: value,
    uri: value,
    doc: function() { return namedNode(docUri) },
    toString: function() { return value }
  }
}

/** Find the primary subject (@id or #this) */
function findSubject(store, baseUrl) {
  // Check ?uri= fragment first
  var uriParam = new URLSearchParams(window.location.search).get('uri')
  if (uriParam) {
    var hash = uriParam.indexOf('#')
    var fragId = hash >= 0 ? uriParam.slice(hash) : '#this'
    var node = store.get(fragId)
    if (node) return namedNode(fragId, baseUrl)
  }

  const hashThis = store.get('#this')
  if (hashThis) return namedNode('#this', baseUrl)

  for (const [id, node] of store.nodes) {
    if (node['@type']) return namedNode(id, baseUrl)
  }

  return null
}

/** Render pane tabs with built-in persistence */
function renderTabs(panes, container, subject, store, rawData, opts) {
  var maxWidth = opts.maxWidth || '960px'
  var tabColor = opts.tabColor || 'rgba(255,255,255,0.5)'
  var tabActiveColor = opts.tabActiveColor || 'rgba(255,255,255,0.9)'

  const tabBar = document.createElement('div')
  tabBar.id = 'pane-tabs'
  tabBar.style.cssText = 'display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);overflow-x:auto;max-width:' + maxWidth + ';margin:0 auto'

  const content = document.createElement('div')
  content.id = 'pane-container'
  content.style.cssText = 'max-width:' + maxWidth + ';margin:0 auto'

  const selectPane = (pane, tab) => {
    content.innerHTML = ''
    for (const t of tabBar.children) {
      t.setAttribute('aria-selected', 'false')
      t.style.borderBottomColor = 'transparent'
      t.style.color = tabColor
    }
    tab.setAttribute('aria-selected', 'true')
    tab.style.borderBottomColor = opts.accentColor || '#7c3aed'
    tab.style.color = tabActiveColor

    try {
      pane.render(subject, store, content, rawData)
    } catch (err) {
      console.warn('[losos] Pane render failed:', pane.label, err)
      content.innerHTML = '<p style="padding:2em;color:#c44">' + pane.label + ' failed to render. Check console.</p>'
    }
  }

  let first = null
  const tabs = []
  for (const pane of panes) {
    try {
      if (!pane.canHandle(subject, store)) continue
    } catch (err) {
      console.warn('[losos] canHandle failed:', pane.label, err)
      continue
    }

    const tab = document.createElement('button')
    tab.className = 'pane-tab'
    tab.setAttribute('aria-selected', 'false')
    tab.style.cssText = 'border:none;background:none;padding:10px 18px;cursor:pointer;font:600 0.85em/1.4 -apple-system,sans-serif;color:' + tabColor + ';border-bottom:2px solid transparent;white-space:nowrap'
    tab.textContent = (pane.icon ? pane.icon + ' ' : '') + pane.label
    tab.addEventListener('click', () => {
      selectPane(pane, tab)
      // Persist active tab
      try { localStorage.setItem('losos-tab:' + location.pathname, pane.label) } catch (e) {}
    })
    tabBar.appendChild(tab)
    tabs.push({ pane, tab })
    if (!first) first = { pane, tab }
  }

  if (opts.tabs === false) tabBar.style.display = 'none'
  container.appendChild(tabBar)
  container.appendChild(content)

  // Restore saved tab, or use first
  var savedLabel = null
  try { savedLabel = localStorage.getItem('losos-tab:' + location.pathname) } catch (e) {}

  var restored = false
  if (savedLabel) {
    for (const t of tabs) {
      if (t.pane.label === savedLabel) {
        selectPane(t.pane, t.tab)
        restored = true
        break
      }
    }
  }
  if (!restored && first) selectPane(first.pane, first.tab)
}

/**
 * Resolve and render a pane for a node into a container.
 * Checks three sources in order:
 *   1. Local panes (loaded via <script data-pane>) — canHandle match
 *   2. ui:view on the node itself — data declares its own view
 *   3. Registry — @type → pane URL mapping
 *
 * @param {Object} node - a JSON-LD node (must have @id and @type)
 * @param {Object} store - LION store
 * @param {Element} container - DOM element to render into
 * @param {Object} rawData - raw JSON-LD (passed to pane.render as 4th arg)
 * @param {Object} opts - optional { registry: {}, panes: [] }
 */
export async function resolvePane(node, store, container, rawData, opts) {
  opts = opts || {}
  var panes = opts.panes || _panes
  var registry = opts.registry || _registry
  var baseUrl = window.location.href.replace(/[?#].*$/, '')
  var dataEl = document.querySelector('script[type="application/ld+json"]')
  if (dataEl && dataEl.getAttribute('src')) baseUrl = new URL(dataEl.getAttribute('src'), window.location.href).href
  var subject = namedNode(node['@id'] || '#this', baseUrl)

  // 1. Local panes — first canHandle match
  for (var pane of panes) {
    try {
      if (pane.canHandle(subject, store)) {
        pane.render(subject, store, container, rawData)
        return pane
      }
    } catch (err) {
      console.warn('[losos] resolvePane canHandle failed:', pane.label, err)
    }
  }

  // 2. ui:view on the node — data declares its view
  var viewUrl = node['ui:view'] || node['http://www.w3.org/ns/ui#view']
  if (viewUrl) {
    if (typeof viewUrl === 'object' && viewUrl['@id']) viewUrl = viewUrl['@id']
    try {
      var mod = _paneCache.get(viewUrl)
      if (!mod) {
        mod = await import(viewUrl)
        _paneCache.set(viewUrl, mod)
      }
      if (mod.default && mod.default.render) {
        mod.default.render(subject, store, container, rawData)
        return mod.default
      }
    } catch (err) {
      console.warn('[losos] resolvePane ui:view failed:', viewUrl, err)
    }
  }

  // 3. Registry — @type → pane URL
  var type = node['@type']
  if (type && registry[type]) {
    var regUrl = registry[type]
    try {
      var mod = _paneCache.get(regUrl)
      if (!mod) {
        mod = await import(regUrl)
        _paneCache.set(regUrl, mod)
      }
      if (mod.default && mod.default.render) {
        mod.default.render(subject, store, container, rawData)
        return mod.default
      }
    } catch (err) {
      console.warn('[losos] resolvePane registry failed:', type, regUrl, err)
    }
  }

  console.warn('[losos] resolvePane: no pane found for', node['@id'], node['@type'])
  return null
}

/** Boot the shell
 * @param {Element|string} el - container element or selector
 * @param {Object} opts - { maxWidth: '100%', accentColor: '#7c3aed' }
 */
export async function boot(el, opts) {
  opts = opts || {}
  const root = typeof el === 'string' ? document.querySelector(el)
    : el || document.getElementById('solid') || document.getElementById('losos') || document.getElementById('mashlib') || document.getElementById('app') || document.body

  const { store, rawData } = await Promise.all([loadPanes(), loadData()])
    .then(([panes, dataResult]) => {
      const subject = findSubject(dataResult.store, dataResult.baseUrl)
      if (!subject) {
        root.innerHTML = '<p style="padding:2em;color:#888">No data found.</p>'
        return { panes: [], store: null, rawData: null, subject: null }
      }
      _panes = panes
      root.innerHTML = ''
      renderTabs(panes, root, subject, dataResult.store, dataResult.rawData, opts)
      return dataResult
    })
}

/** Access/extend the registry */
export { _registry as registry }

// Auto-boot if a known container exists
if (document.getElementById('solid') || document.getElementById('losos') || document.getElementById('mashlib') || document.getElementById('app')) {
  boot()
}
