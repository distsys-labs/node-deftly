const fount = require('fount')
const metronic = require('metronic')

module.exports = {
  title: '', // process/service title
  resources: [ './src/resources/*.js' ],
  middleware: [ './src/middleware/*.js' ],
  plugins: [ './src/plugins/*.js' ],
  transports: [ './src/transports/*.js' ],
  fount: fount, // uses an internal instance
  metronic: metronic, // uses an internal instance
  middlewareStack: [
    'service.middleware',
    'resource.middleware',
    'action.middleware',
    'action.handle'
  ],
  transformStack: [
    'service.transform',
    'resource.transform',
    'action.transform'
  ],
  service: {
    errors: {}, // service error handlers
    middleware: [],
    tranforms: []
  },
  metrics: {}
}
