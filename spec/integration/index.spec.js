require('../setup.js')
const deftly = require('../../src/index')
const when = require('when')
const postal = require('postal.request-response')(require('postal'))
const fount = require('fount')

postal.configuration.promise.createDeferred = function () {
  return when.defer()
}

postal.configuration.promise.getPromise = function (dfd) {
  return dfd.promise
}

describe('Integration Test', function () {
  var telemetry
  before(function () {
    fount.registerAsValue('postal', postal)
    fount('transports').registerAsValue('postal', postal)
    telemetry = postal.channel('telemetry')
    return deftly.init({
      fount: fount,
      resources: [ './spec/extensions/resources/*.js' ],
      middleware: [ './spec/extensions/middleware/*.js' ],
      plugins: [ './spec/extensions/plugins/*.js' ],
      transports: [ './spec/extensions/transports/*.js' ]
    })
    .then(function (service) {
      service.metrics.recordUtilization()
      service.metrics.useLocalAdapter()
      return service.start()
    })
  })

  describe('when not authenticated', function () {
    it('should use custom error handler to return a 401', function () {
      return telemetry.request({
        topic: 'metrics',
        data: {}
      }).should.eventually.eql({ status: 401, data: 'Unauthorized' })
    })
  })

  describe('when unauthorized', function () {
    it('should use custom error handler to return a 403', function () {
      return telemetry.request({
        topic: 'metrics',
        headers: {
          authorize: 'user'
        },
        data: {}
      }).should.eventually.eql({ status: 403, data: 'Forbidden' })
    })
  })

  describe('with valid authentication and authorization', function () {
    it('should return metrics object', function () {
      return telemetry.request({
        topic: 'metrics',
        headers: {
          authorize: 'admin'
        },
        data: {}
      }).should.eventually.partiallyEql({ data: {} })
    })
  })

  after(function () {
    fount.purgeAll()
  })
})
