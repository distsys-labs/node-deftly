require('../setup')
const _ = require('fauxdash')
const log = require('../../src/log')

describe('Log', function () {
  var log1, log2, log3, logs, levels
  before(function () {
    log1 = log.get('alpha')
    log2 = log.get('alpha.bravo')
    log3 = log.get('charlie')
    logs = [ log1, log2, log3 ]
    levels = [ 'debug', 'info', 'warn', 'error', 'fatal' ]
  })

  describe('with no adapters', function () {
    it('should not throw errors when logging', function () {
      log1.debug.bind(null, 'test').should.not.throw()
      log2.debug.bind(null, 'test').should.not.throw()
      log3.debug.bind(null, 'test').should.not.throw()
    })
  })

  describe('with function adapter', function () {
    var captured = []
    before(function () {
      log.addAdapter(function capturer (entry) {
        captured.push(entry.message)
      })

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from all loggers at warning or higher', function () {
      captured.should.eql([
        'alpha warn',
        'alpha error',
        'alpha fatal',
        'alpha.bravo warn',
        'alpha.bravo error',
        'alpha.bravo fatal',
        'charlie warn',
        'charlie error',
        'charlie fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'capturer' ].should.not.be.null // eslint-disable-line
    })

    after(function () {
      log.reset()
    })
  })

  describe('with named function adapter', function () {
    var captured = []
    before(function () {
      log.addAdapter('test', function capturer (entry) {
        captured.push(entry.message)
      })

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from all loggers at warning or higher', function () {
      captured.should.eql([
        'alpha warn',
        'alpha error',
        'alpha fatal',
        'alpha.bravo warn',
        'alpha.bravo error',
        'alpha.bravo fatal',
        'charlie warn',
        'charlie error',
        'charlie fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'test' ].should.not.be.null // eslint-disable-line
    })

    after(function () {
      log.reset()
    })
  })

  describe('with custom config for function adapter', function () {
    var captured = []
    before(function () {
      log.addAdapter({ level: 2, filter: '-alpha*' }, function capturer (entry) {
        captured.push(entry.message)
      })

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from loggers at error or higher except alpha', function () {
      captured.should.eql([
        'charlie error',
        'charlie fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'capturer' ].should.not.be.null // eslint-disable-line
    })

    after(function () {
      log.reset()
    })
  })

  describe('with custom config for initializing function adapter', function () {
    var captured = []
    var calls = 0
    before(function () {
      function capture (entry) {
        captured.push(entry.message)
      }

      log.addAdapter(
        'test',
        { level: 5, filter: 'alpha', namespaceInit: true },
        function init (namespace) {
          calls++
          return {
            debug: capture,
            info: capture,
            warn: capture,
            error: capture,
            fatal: capture
          }
        }
      )

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture all entries from alpha logger', function () {
      captured.should.eql([
        'alpha debug',
        'alpha info',
        'alpha warn',
        'alpha error',
        'alpha fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'test' ].should.not.be.null // eslint-disable-line
    })

    it('should have memoized object creation (one call per active namespace)', function () {
      calls.should.equal(1)
    })

    after(function () {
      log.reset()
    })
  })

  describe('with object adapter', function () {
    var captured = []
    before(function () {
      function capture (entry) {
        captured.push(entry.message)
      }

      log.addAdapter(
        {
          name: 'simple',
          debug: capture,
          info: capture,
          warn: capture,
          error: capture,
          fatal: capture
        }
      )

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from all loggers at warn or higher', function () {
      captured.should.eql([
        'alpha warn',
        'alpha error',
        'alpha fatal',
        'alpha.bravo warn',
        'alpha.bravo error',
        'alpha.bravo fatal',
        'charlie warn',
        'charlie error',
        'charlie fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'simple' ].should.not.be.null // eslint-disable-line
    })

    after(function () {
      log.reset()
    })
  })

  describe('with named object adapter', function () {
    var captured = []
    before(function () {
      function capture (entry) {
        captured.push(entry.message)
      }

      log.addAdapter(
        'customName',
        {
          name: 'simple',
          debug: capture,
          info: capture,
          warn: capture,
          error: capture,
          fatal: capture
        }
      )

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from all loggers at warn or higher', function () {
      captured.should.eql([
        'alpha warn',
        'alpha error',
        'alpha fatal',
        'alpha.bravo warn',
        'alpha.bravo error',
        'alpha.bravo fatal',
        'charlie warn',
        'charlie error',
        'charlie fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'customName' ].should.not.be.null // eslint-disable-line
    })

    after(function () {
      log.reset()
    })
  })

  describe('with custom config for object adapter', function () {
    var captured = []
    before(function () {
      function capture (entry) {
        captured.push(entry.message)
      }

      log.addAdapter(
        'special',
        { level: 5, filter: 'alpha.bravo' },
        {
          name: 'simple',
          debug: capture,
          info: capture,
          warn: capture,
          error: capture,
          fatal: capture
        }
      )

      _.each(logs, function (l, i) {
        _.each(levels, function (level) {
          l[ level ]('%s %s', l.namespace, level)
        })
      })
    })

    it('should capture from all loggers at warn or higher', function () {
      captured.should.eql([
        'alpha.bravo debug',
        'alpha.bravo info',
        'alpha.bravo warn',
        'alpha.bravo error',
        'alpha.bravo fatal'
      ])
    })

    it('should have added function to loggers', function () {
      log.loggers[ 'special' ].should.not.be.null // eslint-disable-line
    })

    describe('with filter changes', function () {
      before(function () {
        captured = []

        log.loggers.special.removeFilter('alpha.bravo')
        log.loggers.special.config.level = 3

        log1.debug('no')
        log2.info('no')
        log3.warn('yes 1')
        log1.error('yes 2')
        log2.fatal('yes 3')

        log.loggers.special.addFilter('alpha*')

        log1.debug('no')
        log2.info('no')
        log1.error('yes 4')
        log2.error('yes 5')
        log3.error('no')

        log.loggers.special.addFilter('-alpha.bravo')

        log1.debug('no')
        log2.info('no')
        log1.error('yes 6')
        log2.fatal('no')
        log3.error('no')

        log.loggers.special.removeFilter('-alpha.bravo')

        log2.fatal('yes 7')

        log.loggers.special.setFilter('charlie')

        log1.warn('no')
        log2.warn('no')
        log3.warn('yes 8')
      })

      it('should have excluded any logs outside of filter parameters', function () {
        expect(_.find(captured, x => x === 'no')).to.be.undefined // eslint-disable-line
        captured.length.should.equal(8)
      })
    })

    after(function () {
      log.reset()
    })
  })
})
