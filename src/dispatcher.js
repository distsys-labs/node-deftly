const _ = require('fauxdash')

// processes property value for a resource/action property containing middelware
// if it's a single function - add it
// if its a string, append the entire stack or a stack's step
// if it's a list of conditions, append that
// otherwise iterate through the various items using the same approach
function addMiddleware (state, stack, spec, name) {
  if (_.isFunction(spec)) {
    stack.append(spec, spec.name || name)
  } else if (_.isString(spec)) {
    const middleware = findMiddleware(state, spec)
    if (middleware.calls) {
      stack.appendStack(middleware)
    } else {
      stack.append(middleware.call, middleware.name)
    }
  } else if (Array.isArray(spec)) {
    if (spec.length) {
      if (spec[0].when && spec[0].then) {
        stack.append(spec, name)
      } else {
        _.each(spec, function (item, index) {
          addMiddleware(state, stack, item, [name, index].join('-'))
        })
      }
    }
  } else if (_.isObject(spec)) {
    stack.appendStack(spec)
  }
}

// iterate over all resources and actions and create the
// middleware and transform stacks for each resource!action pair
function createStacks (state) {
  const serviceErrors = state.config.service.errors || {}
  _.each(state.resources, function (resource) {
    const resourceErrors = resource.errors
    _.each(resource.actions, function (action, actionName) {
      action.name = actionName
      const actionErrors = action.errors
      let transform
      const key = [resource.name, action.name].join('!')

      if (state.config.middlewareStack) {
        const middleware = getStack(state, state.config.middlewareStack, resource, action)
        state.handlers[middleware.name] = middleware
      }
      if (state.config.transformStack) {
        transform = getStack(state, state.config.transformStack, resource, action)
      } else {
        transform = state.snap.stack(key)
      }
      transform.append(unit)
      state.transforms[transform.name] = transform
      const errors = Object.assign({}, serviceErrors, resourceErrors, actionErrors)
      state.errors[key] = handleError.bind(null, state, errors)
    })
  })
}

// not ideal perhaps, but something has to happen
function defaultErrorStrategy (env, error) {
  return {
    status: 500,
    error: error,
    data: `An unhandled error of '${error.name}' occurred at ${env.resource} - ${env.action}`
  }
}

// attempt to find the stack (and optionally the step)
// from loaded middleware
function findMiddleware (state, spec) {
  const parts = spec.split('.')
  const stackName = parts[0]
  const stepName = parts[1]
  const stack = state.stacks[stackName]
  if (!stack) {
    throw new Error(`A stack named '${stackName}' was specified but not found`)
  } else if (!stepName) {
    return stack
  }
  if (!stack.calls[stepName]) {
    throw new Error(`A step named '${stepName}' for stack '${stackName}' was specified but not found`)
  }
  // a new name is warranted so that we don't end up over-writing a previous step name
  // or have a future name over-write this
  const newName = [stackName, stepName].join(':')
  return { name: newName, call: stack.calls[stepName] }
}

function handleError (state, strategies, envelope, error) {
  const strategy = strategies[error.name] ||
          strategies[error.name.replace('Error', '')] ||
          strategies.Error ||
          defaultErrorStrategy
  if (_.isFunction(strategy)) {
    return strategy(envelope, error)
  } else if (strategy.handle) {
    const result = Object.assign({}, strategy)
    const handle = result.handle
    delete result.handle
    return Object.assign(result, handle(envelope, error))
  }
  return Object.assign({}, strategy)
}

// given a property specifier "service|resource|action.propertyName"
// find the property value
function getProperty (service, resource, action, propertySpec) {
  const parts = propertySpec.split('.')
  let target
  switch (parts[0]) {
    case 'action':
      target = action
      break
    case 'resource':
      target = resource
      break
    default:
      target = service
  }
  const property = parts[1]
  return { key: property, value: target ? target[property] : null }
}

// iterates over the parts of the service, resource and actions
// as configured in order to create a stack (middleware or transform)
function getStack (state, list, resource, action) {
  const handleName = [resource.name, action.name].join('!')
  const stack = state.snap.stack(handleName)
  _.each(list, function (propertySpec) {
    const property = getProperty(state.config.service || {}, resource, action, propertySpec)
    if (property.value) {
      addMiddleware(state, stack, property.value, property.key)
    }
  })
  return stack
}

// this exists so that the transform stack always has, at minimum
// a function that returns the result
function unit (env) { return env }

module.exports = function (state) {
  return {
    addMiddleware: addMiddleware.bind(null, state),
    createStacks: createStacks.bind(null, state),
    findMiddleware: findMiddleware.bind(null, state),
    handleError: handleError,
    getStack: getStack.bind(null, state),
    getProperty: getProperty
  }
}
