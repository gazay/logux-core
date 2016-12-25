var NanoEvents = require('nanoevents')

/**
 * Log is main idea in Logux to store actions with time marks.
 *
 * @param {object} opts Options.
 * @param {Store} opts.store Store for log.
 * @param {Timer} opts.timer Timer to mark actions.
 *
 * @example
 * import Log from 'logux-core'
 * const log = new Log({
 *   store: new MemoryStore(),
 *   timer: createTestTimer()
 * })
 *
 * log.on('add', beeper)
 * log.add({ type: 'beep' })
 *
 * @class
 */
function Log (opts) {
  if (!opts) opts = { }

  if (typeof opts.timer !== 'function') {
    throw new Error('Expected log timer to be a function')
  }
  /**
   * Timer used in this log.
   * @type {Timer}
   *
   * @example
   * const id = log.timer()
   */
  this.timer = opts.timer
  /**
   * Latest used `added` number.
   * All actions in this log have less or same `added` time.
   * @type {number}
   *
   * @example
   * sync() {
   *   sendActionslog)
   *   this.synced = log.lastAdded
   * }
   */
  this.lastAdded = 0

  if (typeof opts.store === 'undefined') {
    throw new Error('Expected log store to be a object')
  }
  this.store = opts.store

  this.emitter = new NanoEvents()
}

Log.prototype = {

  /**
   * Subscribe for log events. It implements nanoevents API. Supported events:
   *
   * * `add`: when new entry was added to log.
   * * `clean`: before log run keepers and remove outdated entries.
   *
   * @param {"add"|"clean"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * const unbind = log.on('add', (action, meta) => {
   *   if (action.type === 'beep') beep()
   * })
   * function disableBeeps () {
   *   unbind()
   * }
   */
  on: function (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Add one-time listener for log events.
   * See {@link Log#on} for supported events.
   *
   * @param {"add"|"clean"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * log.once('clean', () => {
   *   console.log('Autocleaning works')
   * })
   */
  once: function (event, listener) {
    return this.emitter.once(event, listener)
  },

  /**
   * Add action to log.
   *
   * It will set id` (if it missed) and `added` property to `meta`
   * and call all listeners.
   *
   * @param {Action} action The new action.
   * @param {object} [meta] Open structure for action metadata.
   * @param {Time} [meta.id] Unique action ID.
   * @return {Promise} Promise with `false` if action was already in log
   *
   * @example
   * removeButton.addEventListener('click', () => {
   *   log.add({ type: 'users:remove', user: id })
   * })
   */
  add: function add (action, meta) {
    if (typeof action.type === 'undefined') {
      throw new Error('Expected "type" property in action')
    }

    if (!meta) meta = { }
    if (typeof meta.id === 'undefined') meta.id = this.timer()
    if (typeof meta.time === 'undefined') meta.time = meta.id[0]
    this.lastAdded += 1
    meta.added = this.lastAdded

    var emitter = this.emitter
    return this.store.add(action, meta).then(function (wasAdded) {
      if (wasAdded) emitter.emit('add', action, meta)
      return wasAdded
    })
  },

  /**
   * Remove all outdated actions. Actions could be kept by {@link Log#keep}.
   *
   * @return {Promise} When cleaning will be finished.
   *
   * @example
   * let sinceClean = 0
   * log.on('add', () => {
   *   sinceClean += 1
   *   if (sinceClean > 100) {
   *     sinceClean = 0
   *     log.clean()
   *   }
   * })
   */
  clean: function clean () {
    this.emitter.emit('clean')
    var self = this
    return this.each(function (action, meta) {
      var keepers = self.emitter.events.keep || []
      var keep = keepers.some(function (keeper) {
        return keeper.fn(action, meta)
      })
      if (!keep) self.store.remove(meta.id)
    })
  },

  /**
   * Add function to keep actions from cleaning.
   *
   * @param {keeper} keeper Return true for actions to keep.
   * @return {function} Remove keeper from log.
   *
   * @example
   * const unkeep = log.keep((action, meta) => {
   *   return compareTime(meta.id, lastBeep) > 0
   * })
   * function uninstallPlugin () {
   *   unkeep()
   * }
   */
  keep: function keep (keeper) {
    return this.emitter.on('keep', keeper)
  },

  /**
   * Iterates through all actions, from last to first.
   *
   * Return false from callback if you want to stop iteration.
   *
   * @param {object} [opts] Iterator options.
   * @param {'added'|'created'} opts.order Sort entries by created time or when
   *                                       they was added to current log.
   *                                       Default is `'created'`.
   * @param {iterator} callback Function will be executed on every action.
   * @return {Promise} When iteration will be finished
   *                   by iterator or end of actions.
   *
   * @example
   * log.each((action, meta) => {
   *   if (compareTime(meta.id, lastBeep) <= 0) {
   *     return false;
   *   } else if (action.type === 'beep') {
   *     beep()
   *     lastBeep = meta.id
   *     return false;
   *   }
   * })
   */
  each: function each (opts, callback) {
    if (!callback) {
      callback = opts
      opts = { }
    }

    var store = this.store
    return new Promise(function (resolve) {
      function nextPage (get) {
        get().then(function (page) {
          var result
          for (var i = 0; i < page.entries.length; i++) {
            var entry = page.entries[i]
            result = callback(entry[0], entry[1])
            if (result === false) break
          }

          if (result === false || !page.next) {
            resolve()
          } else {
            nextPage(page.next)
          }
        })
      }

      nextPage(store.get.bind(store, opts.order || 'created'))
    })
  }
}

module.exports = Log

/**
 * @callback listener
 * @param {Action} action New action.
 * @param {Meta} meta The action’s metadata.
 */

/**
 * @callback iterator
 * @param {Action} action Next action.
 * @param {Meta} meta Next action’s metadata.
 * @return {boolean} returning `false` will stop iteration.
 */

/**
 * @callback keeper
 * @param {Action} action Next action.
 * @param {Meta} meta Next action’s metadata.
 * @return {boolean} true If action should be kept from cleaning.
 */
