/**
 * LOSOS Registry — default @type → pane URL mappings
 *
 * Override or extend in your app:
 *   import registry from './losos/registry.js'
 *   registry['schema:Person'] = './panes/person-pane.js'
 */

export default {
  'wf:Tracker':    '../panes/todo-pane.js',
  'ical:Vtodo':    '../panes/todo-pane.js'
}
