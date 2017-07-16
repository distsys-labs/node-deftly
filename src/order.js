var _ = require('lodash')

function append (config, step) {
  config.middlewareStack.push(step)
}

function insertAfter (config, target, step) {
  var index = _.indexOf(config.middlewareStack, target)
  if (index >= 0) {
    config.middlewareStack.splice(index + 1, 0, step)
  } else {
    throw new Error(`Cannot insert step ${step} after non-existent step ${target}`)
  }
}

function insertBefore (config, target, step) {
  var index = _.indexOf(config.middlewareStack, target)
  if (index >= 0) {
    config.middlewareStack.splice(index, 0, step)
  } else {
    throw new Error(`Cannot insert step ${step} before non-existent step ${target}`)
  }
}

function prepend (config, step) {
  config.middlewareStack.unshift(step)
}

module.exports = function (config) {
  return {
    append: append.bind(null, config),
    insertAfter: insertAfter.bind(null, config),
    insertBefore: insertBefore.bind(null, config),
    prepend: prepend.bind(null, config)
  }
}
