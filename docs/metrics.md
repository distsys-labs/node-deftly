# deftly - metrics

Deftly uses [`metronic`](https://github.com/arobson/metronic) for capturing metrics and resource utilization. This library comes with its own set of ways to publish these metrics and make them available to any number of aggregators. It can capture metrics locally and provide a JSON report, however and placing a resource around this for remote retrieval is trivial.

## Instrumenting

`deftly` instruments the top-level promise when handling an envelope. Statistics for the handle stack's duration and rate are captured as a histogram. This means that execution time is captured starting at the beginning of the call to the stack to the end of the very last transform call in the stack:

```
incoming "message" -> transport
	transport creates envelope
		`deftly.handle( envelope )`  <-- instrumentation starts here
			resource[ action ]										|
				-> middleware										|
				<- transforms 		   <-- instrumentation stops here
	transport "responds"
```

The key used to capture these measurements is in the format:

`{machineName}.{processTitle}.{resource}.{action}.deftly`

The `deftly` at the end of the metric key is there to make it easy for transports to differentiate metrics collected at that level. This is ideal since it will help pinpoint how much time is being spent in transport implementation vs. your resource action's handle stack.

## Instrumenting an HTTP Transport

A few assumptions are in place in the following example, but this should provide a rough idea for how any transport might capture telemetry around the transport implementation. This can become very useful when trying to pinpoint where time is being spent. These functions are in no way intended to provide a comprehensive implementation for an HTTP transport based on connect middleware, but should provide just enough that you can see that it's straight-forward.

```js
// attaches route-specific middleware per resource/action
function createContext( state, action, resource ) {
	const url = getUrl( resource, action );
	const method = action.method ? action.method.toLowerCase() : 'all';
	state.express[ method ] (
		url,
		setContext.bind( null, action, resource )
	);
}

// construct a URL based on action properties if they exist
function getUrl( resource, action ) {
	if( action.url ) {
		return [ '/', resource.name, action.url ].join( '' );
	} else {
		return [ '/', resource.name, '/', action.name ].join( '' );
	}
}

// the transport's initialize call
function initialize( deftly ) {
	deftly.forEachAction( createContext.bind( null, app ) ); //
	app.use( telemetry.bind( null, deftly ) );
	deftly.forEachAction( createRoute.bind( null, app, deftly ) );
}

// sets the metric key on the request for future use in the telemetry middelware
function setMetricKey( resourceName, actionName, req, res, next ) {
	req.metricKey = [ resourceName, actionName ].join( '.' );
	next();
}

// assumes you have access to the service instance as `deftly` in the transport module
function telemetry( req, res, next ) {
	const metricKey = req.metricKey || req.url.replace( /[\/]/g, '-' );
	const timer = deftly.metrics.timer( metricKey.concat( 'duration' ) );
	res.once( 'finish', function() {
		const elapsed = timer.record( { name: 'HTTP_API_DURATION' } );
	} );
	next();
}
```

### Metrics Resource Example
A very simple way to see the metrics being captured without any other adapters would be to turn on the local metrics adapter and then supply a resource that exposes the metrics report:

__index.js__
```js
const deftly = require('deftly');
deftly.init( {
	resources: [ './src/resources/*.js' ],
	middleware: [ './src/middleware/*.js' ],
	plugins: [ './src/plugins/*.js' ],
	transports: [ './src/transports/*.js' ]
} )
.then( function( service ) {
	service.metrics.recordUtilization();
	service.metrics.useLocalAdapter();
	service.start();
} );
```

__telemetry.js__ - loaded as a resource
```js
// this example includes HTTP transport specific properties
// depending on transport routing, it would likely be served
// as GET http://localhost:{port}/telemetry
module.exports = function() {
	return {
		name: 'telemetry',
		actions: {
			'metrics': {
				method: 'GET',
				url: '/',
				handle: function( envelope, metrics ) {
					var report = metrics.getReport();
					return { data: report };
				}
			}
		}
	};
};
```
