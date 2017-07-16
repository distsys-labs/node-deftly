module.exports = function telemetry () {
  return {
    name: 'telemetry',
    errors: {
      ForbiddenError: {
        status: 403,
        data: 'Forbidden'
      },
      UnauthorizedError: {
        status: 401,
        data: 'Unauthorized'
      }
    },
    actions: {
      metrics: {
        authenticated: true,
        roles: [ 'system', 'admin' ],
        topic: 'metrics',
        handle: function (envelope, metrics) {
          var report = metrics.getReport()
          return { data: report }
        }
      },
      status: {
        topic: 'status',
        handle: [
          {
            when: { role: 'anonymous' },
            then: function (envelope) {
              return {}
            }
          },
          {
            when: true,
            then: function (envelope) {
              return {
                title: this.config.title
              }
            }
          }
        ]
      }
    }
  }
}
