/**
 * LION — Linked Objects Notation store
 * A minimal JSON-LD store (~3KB) replacing rdflib
 */

export class Store {
  constructor() {
    this.nodes = new Map()
  }

  /** Load a JSON-LD document into the store */
  load(jsonLd) {
    const ctx = jsonLd['@context'] || {}
    this._index(jsonLd, ctx)
    return this
  }

  /** Index a node and its nested objects */
  _index(obj, ctx, parent) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach(o => this._index(o, ctx, parent)); return }

    const id = obj['@id'] || (parent ? parent + '/' + Math.random().toString(36).slice(2, 6) : '#this')
    if (!obj['@id']) obj['@id'] = id
    const node = { '@id': id, ...obj }

    if (node['@type']) {
      node['@type'] = this._expand(node['@type'], ctx)
    }

    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith('@')) continue
      const expanded = this._expand(key, ctx)
      if (expanded !== key) {
        node[expanded] = val
        delete node[key]
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        this._index(val, ctx, id)
      }
      if (Array.isArray(val)) {
        val.forEach(v => {
          if (v && typeof v === 'object') this._index(v, ctx, id)
        })
      }
    }

    this.nodes.set(id, node)
  }

  /** Expand a prefixed term using context */
  _expand(term, ctx) {
    const colon = term.indexOf(':')
    if (colon === -1) return term
    const prefix = term.slice(0, colon)
    const local = term.slice(colon + 1)
    if (ctx[prefix]) return ctx[prefix] + local
    return term
  }

  /** Get a node by @id — also tries fragment-only for absolute URIs */
  get(id) {
    if (!id) return null
    var node = this.nodes.get(id)
    if (node) return node
    var hash = id.indexOf('#')
    if (hash > 0) {
      node = this.nodes.get(id.slice(hash))
      if (node) return node
    }
    return null
  }

  /** Get a property value from a node */
  prop(id, ...keys) {
    const node = typeof id === 'string' ? this.get(id) : id
    if (!node) return undefined
    for (const key of keys) {
      for (const [k, v] of Object.entries(node)) {
        if (k === '@id' || k === '@type' || k === '@context') continue
        if (k.includes(key)) return v
      }
    }
    return undefined
  }

  /** Get all values for a property (always returns array) */
  propAll(id, key) {
    const val = this.prop(id, key)
    if (val === undefined) return []
    return Array.isArray(val) ? val : [val]
  }

  /** Get the @type of a node */
  type(id) {
    const node = typeof id === 'string' ? this.get(id) : id
    return node?.['@type'] || null
  }

  /** Find all nodes matching a predicate function */
  find(fn) {
    const results = []
    for (const node of this.nodes.values()) {
      if (fn(node)) results.push(node)
    }
    return results
  }

  /** rdflib compatibility: match(subject, predicate, object, graph) */
  match(subject, predicate, object, graph) {
    return this.statementsMatching(subject, predicate, object)
  }

  /** rdflib compatibility: any(subject, predicate) — return first matching object */
  any(subject, predicate) {
    var stmts = this.statementsMatching(subject, predicate)
    return stmts.length > 0 ? stmts[0].object : undefined
  }

  /** rdflib compatibility: each(subject, predicate) — return all matching objects */
  each(subject, predicate) {
    return this.statementsMatching(subject, predicate).map(function(st) { return st.object })
  }

  /** rdflib compatibility: holds(subject, predicate, object) — check if triple exists */
  holds(subject, predicate, object) {
    var stmts = this.statementsMatching(subject, predicate, object)
    return stmts.length > 0
  }

  /** Compatibility: mimic rdflib statementsMatching */
  statementsMatching(subject, predicate, object) {
    const node = typeof subject === 'string' ? this.get(subject)
      : subject?.value ? this.get(subject.value) : null
    if (!node) return []

    const predFilter = predicate ? (typeof predicate === 'string' ? predicate : predicate.value) : null
    const objFilter = object ? (typeof object === 'string' ? object : object.value) : null

    const stmts = []
    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith('@') && key !== '@type') continue
      const predUri = key === '@type'
        ? 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' : key

      if (predFilter && predUri !== predFilter && !predUri.includes(predFilter)) continue

      const values = Array.isArray(val) ? val : [val]
      for (const v of values) {
        const obj = typeof v === 'object' && v['@id']
          ? { termType: 'NamedNode', value: v['@id'] }
          : { termType: 'Literal', value: String(v) }

        if (objFilter && obj.value !== objFilter) continue

        stmts.push({
          subject: { termType: 'NamedNode', value: node['@id'] },
          predicate: { termType: 'NamedNode', value: predUri },
          object: obj
        })
      }
    }
    return stmts
  }
}

/** Create a store from a JSON-LD object or script element */
export function createStore(source) {
  const store = new Store()
  if (typeof source === 'string') {
    source = JSON.parse(source)
  }
  store.load(source)
  return store
}
