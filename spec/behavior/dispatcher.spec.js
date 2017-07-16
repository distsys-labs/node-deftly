require('../setup')
const dispatchFn = require('../../src/dispatcher')
const snap = require('snapstack')()

function ActionError (message) {
  this.name = 'ActionError'
  this.message = message || 'Action error'
  this.stack = (new Error()).stack
}
ActionError.prototype = Object.create(Error.prototype)
ActionError.prototype.constructor = ActionError

function CustomError (message) {
  this.name = 'CustomError'
  this.message = message || 'Custom error'
  this.stack = (new Error()).stack
}
CustomError.prototype = Object.create(Error.prototype)
CustomError.prototype.constructor = CustomError

describe('Dispatcher', function () {
  var stackA
  var dispatcher
  var state
  before(function () {
    stackA = snap.stack([
      function one (env, next) {
        env.total ++
        next()
      },
      function two (env, next) {
        return env.total
      }
    ], 'A')

    state = {
      stacks: {},
      handlers: {},
      transforms: {},
      errors: {},
      snap: snap,
      config: require('../../src/defaults')
    }

    state.stacks[ 'A' ] = stackA
    dispatcher = dispatchFn(state)
  })

  it('should return expected result from baseline stack', function () {
    return stackA.execute({}, { total: 0 })
      .should.eventually.equal(1)
  })

  describe('when adding entire stack to middelware', function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1a')

      dispatcher.addMiddleware(newStack, 'A', 'things')
    })

    it("should add source stack's steps to new stack", function () {
      return newStack.execute({}, { total: 0 })
        .should.eventually.equal(3)
    })
  })

  describe("when adding middleware from stack's step", function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1b')

      dispatcher.addMiddleware(newStack, 'A.two', 'things')
    })

    it("should add source stack's steps to new stack", function () {
      return newStack.execute({}, { total: 0 })
        .should.eventually.equal(2)
    })
  })

  describe('when adding a condition to stack', function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1c')

      dispatcher.addMiddleware(newStack, [
        {
          when: { total: 2 },
          then: function (env, total, next) {
            return total * 5
          }
        },
        {
          when: true,
          then: function (env, total, next) {
            return total * 2
          }
        }
      ], 'things')
    })

    it('should activate condition 1', function () {
      return newStack.execute({}, { total: 0 })
        .should.eventually.equal(10)
    })

    it('should activate condition 2', function () {
      return newStack.execute({}, { total: 8 })
        .should.eventually.equal(20)
    })
  })

  describe('when adding a function to stack', function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1d')

      dispatcher.addMiddleware(newStack, function (env, total, next) {
        return Math.pow(total, 2)
      }, 'things')
    })

    it("should add source stack's steps to new stack", function () {
      return newStack.execute({}, { total: 1 })
        .should.eventually.equal(9)
    })
  })

  describe('when adding functions to stack', function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1d')

      dispatcher.addMiddleware(newStack, [
        function one (env, total, next) {
          env.total = total / 2
          next()
        },
        function two (env, total, next) {
          return Math.pow(total, 2)
        }
      ], 'things')
    })

    it("should add source stack's steps to new stack", function () {
      return newStack.execute({}, { total: 6 })
        .should.eventually.equal(16)
    })
  })

  describe('when adding non-uniform items to stack', function () {
    var newStack
    before(function () {
      newStack = snap.stack([
        function prefix (env, next) {
          env.total = env.total + 2
          next()
        }
      ], '1e')

      dispatcher.addMiddleware(newStack, [
        'A.one',
        function one (env, total, next) {
          env.total = total / 2
          next()
        },
        [
          {
            when: { total: 2 },
            then: function (env, total, next) {
              return total * 5
            }
          },
          {
            when: true,
            then: function (env, total, next) {
              return total * 2
            }
          }
        ]
      ], 'things')
    })

    it('should create valid stack (condition 1)', function () {
      return newStack.execute({}, { total: 1 })
        .should.eventually.equal(10)
    })

    it('should create valid stack (condition 2d)', function () {
      return newStack.execute({}, { total: 3 })
        .should.eventually.equal(6)
    })
  })

  describe('when getting a property from specification', function () {
    var resource, action
    before(function () {
      resource = {
        middleware: [ 1 ]
      }
      action = {
        middleware: [ 2 ]
      }
    })

    it('should return resource middleware correctly', function () {
      dispatcher.getProperty({}, resource, action, 'resource.middleware')
        .should.eql({ key: 'middleware', value: [ 1 ] })
    })

    it('should return action middleware correctly', function () {
      dispatcher.getProperty({}, resource, action, 'action.middleware')
        .should.eql({ key: 'middleware', value: [ 2 ] })
    })

    it('should throw an error on missing property', function () {
      dispatcher.getProperty({}, resource, action, 'resource.missing')
        .should.eql({ key: 'missing', value: undefined })
    })
  })

  describe('when creating handlers from resources', function () {
    before(function () {
      state.resources = {
        'r1': {
          name: 'r1',
          errors: {
            CustomError: {
              status: 501,
              data: 'This is a resource level error strategy'
            }
          },
          middleware: [
            function auth (env, credentials, next) {
              if (credentials) {
                env.user = { authorized: true }
              } else {
                env.user = { authorized: false }
              }
              next()
            },
            [
              {
                when: { user: { authorized: false } },
                then: function (env, next) {
                  return { unauthorized: true }
                }
              }
            ]
          ],
          transform: [
            {
              when: { unauthorized: true },
              then: function unauth (unauthorized) {
                return { status: 401, data: 'Go Away' }
              }
            }
          ],
          actions: {
            get: {
              handle: function (env, next) {
                return { status: 200, data: 'OK' }
              }
            },
            set: {
              handle: function (env, next) {
                return { status: 201, data: 'OK' }
              }
            },
            customActionError: {
              errors: {
                CustomError: function (env, err) {
                  return {
                    status: 502,
                    data: 'This is an action level error strategy'
                  }
                }
              },
              handle: function () {
                throw new ActionError()
              }
            }
          }
        }
      }
      dispatcher.createStacks()
    })

    it('should dispatch unauthorized envelope correctly', function () {
      var handler = state.handlers[ 'r1!get' ]
      return handler.execute({}, {})
        .then(function (result) {
          return state.transforms[ 'r1!get' ].execute({}, result)
        })
        .should.eventually.eql({ status: 401, data: 'Go Away' })
    })

    it('should dispatch authorized get correctly', function () {
      var handler = state.handlers[ 'r1!get' ]
      return handler.execute({}, { credentials: {} })
        .then(function (result) {
          return state.transforms[ 'r1!get' ].execute({}, result)
        })
        .should.eventually.eql({ status: 200, data: 'OK' })
    })

    it('should dispatch authorized get correctly', function () {
      var handler = state.handlers[ 'r1!set' ]
      return handler.execute({}, { credentials: {} })
        .then(function (result) {
          return state.transforms[ 'r1!set' ].execute({}, result)
        })
        .should.eventually.eql({ status: 201, data: 'OK' })
    })

    it('should use a resource error strategy when available', function () {
      var handle = state.errors[ 'r1!get' ]
      var error = new Error()
      return handle({
        resource: 'r1',
        action: 'get'
      }, error)
        .should.eql({
          status: 500,
          error: error,
          data: "An unhandled error of 'Error' occurred at r1 - get"
        })
    })

    it('should use the default error strategy when available', function () {
      var handle = state.errors[ 'r1!get' ]
      return handle({}, new CustomError())
        .should.eql({
          status: 501,
          data: 'This is a resource level error strategy'
        })
    })

    it('should use an action error strategy when available', function () {
      var handle = state.errors[ 'r1!customActionError' ]
      return handle({}, new CustomError())
        .should.eql({
          status: 502,
          data: 'This is an action level error strategy'
        })
    })
  })

  describe('when invalid stack is specified by name', function () {
    it('should throw an error about missing stack name', function () {
      dispatcher.findMiddleware.bind(null, 'B')
        .should.throw("A stack named 'B' was specified but not found")
    })
  })

  describe('when invalid step is specified by name', function () {
    it('should throw an error about missing step name', function () {
      dispatcher.findMiddleware.bind(null, 'A.four')
        .should.throw("A step named 'four' for stack 'A' was specified but not found")
    })
  })
})
