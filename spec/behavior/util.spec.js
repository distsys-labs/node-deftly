require('../setup')
var util = require('../../src/util')

describe('Utility', function () {
  describe('when getting argument list from functions', function () {
    function one (acc, one, two) { return one + two }
    function two (acc, three, next) { return three }
    function three (envelope, three, cb) { return three }
    function four (obj, four, five, six) { return four + five + six }
    let argSet
    before(function () {
      argSet = util.getArgumentsFor(one, two, three, four)
    })

    it('should get complete argument list without duplicates', function () {
      argSet.should.eql({
        arguments: [
          'envelope',
          'one',
          'two',
          'three',
          'four',
          'five',
          'six'
        ],
        callbacks: [
          'next',
          'cb'
        ]
      })
    })
  })
})
