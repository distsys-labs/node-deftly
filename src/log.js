const _ = require('fauxdash')
const format = require('util').format
const levels = {
  'debug': 5,
  'info': 4,
  'warn': 3,
  'error': 2,
  'fatal': 1
}

const defaultConfig = {
  level: 3,
  filter: '',
  namespaceInit: false,
  filters: {
    should: {},
    ignore: {}
  }
}

const instance = { loggers: {} }

const memoizationCache = new Map()

// normalizes arguments for logger creation
// from a user supplied object or function
function addAdapter (state, name, config, logger) {
  if (_.isFunction(name)) {
    logger = name
    name = logger.name
    config = config || {}
  } else if (_.isFunction(config)) {
    logger = config
    if (_.isObject(name)) {
      config = name
      name = logger.name
    } else {
      config = {}
    }
  } else if (_.isObject(name)) {
    logger = name
    name = logger.name
    config = config || {}
  } else if (config && config.fatal) {
    logger = config
    config = {}
  }
  addLogger(state, name, config, logger)
}

// add the regex filter to the right hash for use later
function addFilter (config, filter) {
  if (filter) {
    if (filter[ 0 ] === '-') {
      config.filters.ignore[ filter ] = new RegExp('^' + filter.slice(1).replace(/[*]/g, '.*?') + '$')
    } else {
      config.filters.should[ filter ] = new RegExp('^' + filter.replace(/[*]/g, '.*?') + '$')
    }
  }
}

// creates a logger from a user supplied adapter
function addLogger (state, name, config, adapter) {
  config = Object.assign({}, defaultConfig, config)
  setFilters(config)
  const logger = {
    name: name,
    config: config,
    adapter: adapter,
    addFilter: addFilter.bind(null, config),
    removeFilter: removeFilter.bind(null, config),
    setFilter: setFilter.bind(null, config),
    setFilters: setFilters.bind(null, config)
  }
  if (config.namespaceInit) {
    logger.init = memoize(adapter)
  }
  logger.log = onEntry.bind(null, logger)
  state.loggers[ name ] = logger
}

// create a bound prepMessage call for each log level
function attach (state, logger, namespace) {
  _.each(levels, function (level, name) {
    logger[ name ] = prepMessage.bind(null, state, name, namespace)
  })
}

// create a namespaced log instance for use in modules
function init (state, namespace) {
  namespace = namespace || 'deftly'
  const logger = { namespace: namespace }
  attach(state, logger, namespace)
  return logger
};

// calls log for each logger
function log (state, type, namespace, message) {
  const level = levels[ type ]
  _.each(state.loggers, function (logger) {
    logger.log({
      type: type,
      level: level,
      namespace: namespace,
      message: message
    })
  })
}

function memoize (fn) {
  const memoized = function (...parameters) {
    const key = parameters[0]
    if (memoizationCache.has(key)) {
      return memoizationCache.get(key)
    }
    const result = fn.apply(null, parameters)
    memoizationCache.set(key, result)
    return result
  }
  return memoized
}

function onEntry (logger, entry) {
  if (shouldRender(logger.config, entry)) {
    const log = logger.init ? logger.init(entry.namespace) : logger.adapter
    if (log[ entry.type ]) {
      log[ entry.type ](entry)
    } else {
      log(entry)
    }
  }
}

// handles message format if necessary before calling the
// actual log function to emit
function prepMessage (state, level, namespace, message) {
  if (_.isString(message)) {
    const formatArgs = Array.prototype.slice.call(arguments, 3)
    message = format.apply(null, formatArgs)
  }
  log(state, level, namespace, message)
}

// remove the regex filter from the correct hash
function removeFilter (config, filter) {
  if (filter) {
    if (config.filters.ignore[ filter ]) {
      delete config.filters.ignore[ filter ]
    } else {
      delete config.filters.should[ filter ]
    }
  }
}

// primarily for use in testing
function reset (state) {
  state.loggers = {}
}

// resets filter for particular log adapter
function setFilter (config, filter) {
  config.filter = filter || ''
  setFilters(config)
}

// sets should and musn't filters
function setFilters (config) {
  const parts = config.filter.split(/[\s,]+/)
  config.filters = {
    should: {},
    ignore: {}
  }
  _.each(parts, addFilter.bind(null, config))
}

// check entry against configuration to see if it should
// be logged by adapter
function shouldRender (config, entry) {
  // if we're below the log level, return false
  if (config.level < entry.level) {
    return false
  }

  // if we match the ignore list at all, return false
  const ignoreMatch = _.find(_.values(config.filters.ignore), ignore => {
    return ignore.test(entry.namespace)
  })
  if (ignoreMatch) {
    return false
  }

  // if a should filter exists but we don't have a match, return false
  let shouldFiltered = false
  const shouldMatch = _.find(_.values(config.filters.should), should => {
    shouldFiltered = true
    return should.test(entry.namespace)
  })
  if ((shouldFiltered && !shouldMatch)) {
    return false
  }

  return true
}

Object.assign(instance, {
  addAdapter: addAdapter.bind(null, instance),
  get: init.bind(null, instance),
  reset: reset.bind(null, instance)
})

module.exports = instance
