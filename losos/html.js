/**
 * LOSOS html — Tagged template → surgical DOM updates
 * ~2KB. No dependencies. No VDOM. No build step.
 *
 * Usage:
 *   import { html, render, onUnmount } from './lib/html.js'
 *   render(container, html`<h1>${title}</h1>`)
 *   // Call render again — only changed values patch
 *   onUnmount(container, cleanup) // called when container is removed from DOM
 */

export function onUnmount(container, fn) {
  var parent = container.parentNode
  if (!parent) return
  new MutationObserver(function(_, obs) {
    if (!container.parentNode) { fn(); obs.disconnect() }
  }).observe(parent, { childList: true })
}

var HOLE = '\u200B\u200C\u200B'  // zero-width chars — survives innerHTML
var cache = new WeakMap()

export function html(strings) {
  var values = []
  for (var i = 1; i < arguments.length; i++) values.push(arguments[i])
  return { strings: strings, values: values }
}

// Ref — grab a DOM element after render
// Usage: var myRef = ref(); html`<input ref="${myRef}" />`; myRef.el.focus()
export function ref() {
  return { el: null }
}

// Keyed list — efficient array rendering with reuse
// Usage: html`${keyed(items, item => item['@id'], item => html`<div>...</div>`)}`
export function keyed(items, keyFn, templateFn) {
  return { _keyed: true, items: items, keyFn: keyFn, templateFn: templateFn }
}

export function render(container, template) {
  if (!template || !template.strings) { container.textContent = ''; return }

  var prev = cache.get(container)

  // Same template shape — patch only the holes
  if (prev && prev.strings === template.strings) {
    patch(prev.parts, prev.values, template.values)
    prev.values = template.values
    return
  }

  // New template — build DOM from scratch
  var markup = ''
  for (var i = 0; i < template.strings.length; i++) {
    markup += template.strings[i]
    if (i < template.values.length) markup += HOLE
  }

  var frag = document.createElement('template')
  frag.innerHTML = markup

  var parts = []
  findParts(frag.content, parts)

  // Insert values into parts
  for (var j = 0; j < parts.length; j++) {
    insertValue(parts[j], template.values[j])
  }

  container.textContent = ''
  container.appendChild(frag.content)

  cache.set(container, {
    strings: template.strings,
    values: template.values,
    parts: parts
  })
}

function findParts(node, parts) {
  if (node.nodeType === 3) {
    // Text node — split on HOLE markers
    var text = node.textContent
    if (text.indexOf(HOLE) === -1) return
    var pieces = text.split(HOLE)
    var parent = node.parentNode
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i]) parent.insertBefore(document.createTextNode(pieces[i]), node)
      if (i < pieces.length - 1) {
        var marker = document.createTextNode('')
        parent.insertBefore(marker, node)
        parts.push({ type: 'text', node: marker })
      }
    }
    parent.removeChild(node)
    return
  }

  if (node.nodeType === 1) {
    // Element — check attributes for holes (collect first, then remove)
    var attrs = node.attributes
    var holeAttrs = []
    for (var a = 0; a < attrs.length; a++) {
      if (attrs[a].value === HOLE) holeAttrs.push(attrs[a].name)
    }
    for (var h = 0; h < holeAttrs.length; h++) {
      parts.push({ type: 'attr', node: node, name: holeAttrs[h] })
      node.removeAttribute(holeAttrs[h])
    }
  }

  // Recurse children (copy list since we modify during iteration)
  var children = Array.prototype.slice.call(node.childNodes)
  for (var c = 0; c < children.length; c++) {
    findParts(children[c], parts)
  }
}

function insertValue(part, value) {
  if (part.type === 'attr') {
    setAttr(part.node, part.name, value)
  } else if (part.type === 'text') {
    replaceContent(part, value)
  }
}

function patch(parts, oldValues, newValues) {
  for (var i = 0; i < parts.length; i++) {
    if (newValues[i] !== oldValues[i]) {
      insertValue(parts[i], newValues[i])
    }
  }
}

function setAttr(el, name, value) {
  // Ref binding
  if (name === 'ref' && value && typeof value === 'object') {
    value.el = el
    return
  }
  // innerHTML — set as property, not attribute
  if (name === 'innerHTML') {
    el.innerHTML = value == null ? '' : value
    return
  }
  // Event handlers: onclick, oninput, etc.
  if (name.startsWith('on')) {
    var event = name.slice(2).toLowerCase()
    el._handlers = el._handlers || {}
    if (el._handlers[event]) el.removeEventListener(event, el._handlers[event])
    el._handlers[event] = value
    if (value) el.addEventListener(event, value)
    return
  }
  // Boolean attributes
  if (value === true) el.setAttribute(name, '')
  else if (value === false || value == null) el.removeAttribute(name)
  // Style object
  else if (name === 'style' && typeof value === 'object') {
    Object.assign(el.style, value)
  }
  else {
    try {
      el.setAttribute(name, value)
    } catch (err) {
      console.warn('[losos] setAttribute failed on <' + el.tagName.toLowerCase() + ' ' + name + '="...">. Every ${} in an opening tag must be attr="${value}" — bare interpolations like <div ${expr}> or class="foo ${expr}" are not supported.', err)
    }
  }
}

function replaceContent(part, value) {
  // Clear previous nodes for this part
  if (part.nodes) {
    part.nodes.forEach(function(n) { n.parentNode && n.parentNode.removeChild(n) })
  }

  var parent = part.node.parentNode
  var after = part.node.nextSibling

  if (value == null || value === false) {
    part.nodes = []
    return
  }

  // Keyed list — diff by key, reuse/move/insert/remove DOM nodes
  if (value && value._keyed) {
    var items = value.items || []
    var keyFn = value.keyFn
    var templateFn = value.templateFn
    var prevKeyed = part._keyedMap || new Map()  // key → { nodes, template }
    var newMap = new Map()
    var newNodes = []

    items.forEach(function(item) {
      var key = keyFn(item)
      var existing = prevKeyed.get(key)
      var tpl = templateFn(item)

      if (existing) {
        // Check if template values changed
        var changed = !existing.values || existing.values.length !== tpl.values.length
        if (!changed) {
          for (var vi = 0; vi < tpl.values.length; vi++) {
            if (tpl.values[vi] !== existing.values[vi]) { changed = true; break }
          }
        }

        if (changed) {
          // Values changed — patch
          var wrap = document.createElement('div')
          existing.nodes.forEach(function(n) { wrap.appendChild(n) })
          render(wrap, tpl)
          var patched = Array.prototype.slice.call(wrap.childNodes)
          patched.forEach(function(n) { parent.insertBefore(n, after) })
          newMap.set(key, { nodes: patched, values: tpl.values })
          patched.forEach(function(n) { newNodes.push(n) })
        } else {
          // Unchanged — just re-insert existing nodes
          existing.nodes.forEach(function(n) { parent.insertBefore(n, after) })
          newMap.set(key, existing)
          existing.nodes.forEach(function(n) { newNodes.push(n) })
        }
        prevKeyed.delete(key)
      } else {
        // New item — create
        var wrap = document.createElement('div')
        render(wrap, tpl)
        var created = Array.prototype.slice.call(wrap.childNodes)
        created.forEach(function(n) { parent.insertBefore(n, after) })
        newMap.set(key, { nodes: created, values: tpl.values })
        created.forEach(function(n) { newNodes.push(n) })
      }
    })

    // Remove old items no longer present
    prevKeyed.forEach(function(entry) {
      entry.nodes.forEach(function(n) { n.parentNode && n.parentNode.removeChild(n) })
    })

    // Clean up previous non-keyed nodes
    if (part.nodes) {
      part.nodes.forEach(function(n) {
        if (!newNodes.includes(n) && n.parentNode) n.parentNode.removeChild(n)
      })
    }

    part._keyedMap = newMap
    part.nodes = newNodes
    return
  }

  // Array of templates
  if (Array.isArray(value)) {
    var nodes = []
    value.forEach(function(item) {
      if (item && item.strings) {
        // Nested template — render into a fragment
        var wrap = document.createElement('template')
        render(wrap, item)
        var children = Array.prototype.slice.call(wrap.childNodes)
        children.forEach(function(child) {
          parent.insertBefore(child, after)
          nodes.push(child)
        })
      } else if (item != null) {
        var tn = document.createTextNode(String(item))
        parent.insertBefore(tn, after)
        nodes.push(tn)
      }
    })
    part.nodes = nodes
    return
  }

  // Nested template
  if (value && value.strings) {
    var wrap = document.createElement('template')
    render(wrap, value)
    var nodes = Array.prototype.slice.call(wrap.childNodes)
    nodes.forEach(function(child) { parent.insertBefore(child, after) })
    part.nodes = nodes
    return
  }

  // Primitive — just set text
  part.node.textContent = String(value)
  part.nodes = []
}
