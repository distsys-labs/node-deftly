require('../setup')
const deftly = require('../../src/index')

describe('Index', function () {
  describe('when changing middleware stacks', function () {
    let service
    before(function () {
      return deftly.init({})
        .then(function (x) {
          service = x
          service.stackOrder.prepend('first')
          service.stackOrder.append('last')
          service.stackOrder.insertAfter('first', 'second')
          service.stackOrder.insertBefore('last', 'almost')
        })
    })

    it('should insert steps in the expected order', function () {
      service.config.middlewareStack.should.eql([
        'first',
        'second',
        'service.middleware',
        'resource.middleware',
        'action.middleware',
        'action.handle',
        'almost',
        'last'
      ])
    })
  })
})
