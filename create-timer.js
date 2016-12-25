/**
 * Create base timer.
 *
 * Shareable logs is very sensitive for good time. Just `Date.now()`
 * is not enough. Some actions could be created in same millisecond.
 * Actions created in same time on different machine may have different order.
 *
 * This is why Logux use more smarter timer. To solve this problems this timer
 * store time as 3 variables: current milliseconds, node name
 * and sequence number in this millisecond.
 *
 * @param {string|number} nodeId Unique current node name.
 * @return {Timer} Timer function.
 *
 * @example
 * import { createTimer } from 'logux-core'
 *
 * const timer = createTimer('server')
 * timer() //=> [1473564435318, 'server', 0]
 * timer() //=> [1473564435318, 'server', 1]
 * timer() //=> [1473564435319, 'server', 0]
 */
function createTimer (nodeId) {
  if (typeof nodeId === 'string' && nodeId.indexOf('\t') !== -1) {
    throw new Error('Tab symbol is prohibited in Logux node ID')
  }

  var lastTime = 0
  var sequence = 0
  return function () {
    var now = Date.now()
    if (now === lastTime) {
      sequence += 1
    } else {
      lastTime = now
      sequence = 0
    }
    return [now, nodeId, sequence]
  }
}

module.exports = createTimer
