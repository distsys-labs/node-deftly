const _ = require('fauxdash')
const reserved = [ 'next', 'cb', 'callback', 'continue', 'done' ]

function getArgumentsFor (...parameters) {
  const functions = _.map(parameters, _.parseFunction)
  return functions.reduce((acc, fn) => {
    const functionArgs = fn.arguments.slice(1)
    const args = _.without(functionArgs, reserved.concat(acc.arguments))
    const callbacks = _.intersection(functionArgs, reserved)
    acc.arguments = acc.arguments.concat(args)
    acc.callbacks = _.uniq(acc.callbacks.concat(callbacks))
    return acc
  }, { arguments: [ 'envelope' ], callbacks: [] })
}

module.exports = {
  getArgumentsFor: getArgumentsFor
}
