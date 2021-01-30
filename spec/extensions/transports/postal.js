function getEnvelope (action, resource, data, envelope) {
  const env = {
    transport: 'postal',
    action: action.name,
    resource: resource.name,
    data: data || {},
    headers: envelope.headers || {},
    route: [envelope.channel, envelope.topic].join(':'),
    user: envelope.user || { id: 'anonymous' },
    role: envelope.role || 'anonymous'
  }
  return env
}

function createRoute (state, deftly, action, resource) {
  const channel = state.postal.channel(resource.name)
  const topic = action.topic || action.name
  channel.subscribe(topic, function (data, postalEnvelope) {
    const envelope = getEnvelope(action, resource, data, postalEnvelope)
    deftly.handle(envelope)
      .then(
        function (reply) {
          postalEnvelope.reply(null, reply)
        },
        function (error) {
          // only called if no error strategy was available
          postalEnvelope.reply(error)
        }
      )
  })
}

function createRoutes (state, deftly) {
  deftly.forEachAction(createRoute.bind(null, state, deftly))
}

function initialize (state, deftly) {
  deftly.log.get('http')
  const configuration = deftly.config.http || {}
  Object.assign(state, {
    config: configuration
  })
  let reply = Promise.resolve()
  if (configuration.configure) {
    reply = configuration.configure(state)
    if (!reply.then) {
      reply = Promise.resolve(reply)
    }
  }
  return reply.then(createRoutes.bind(null, state, deftly))
}

function start (state) {
  // nothing to see here ...
}

function stop (state) {
  // move along.
}

module.exports = function postalTransport (postal) {
  const state = {
    postal: postal
  }
  return {
    initialize: initialize.bind(null, state),
    start: start.bind(null, state),
    stop: stop.bind(null, state)
  }
}
