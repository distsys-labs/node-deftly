# deftly - transports

Transports are libraries that should wire up resources to a specific protocol. Like plugins, they provide an `initialize` call the returns a promise. In addition to this call, transports should also provide `stop` and `start` calls so that the service can control them.

## `initialize( service )`

Transports should use the service API to create routes for all resource actions that they are able to. The initialize call must return a promise

## `start()`

Starts accepting incoming requests. Should return a promise that resolves when the transport has started successfully.

## `stop()`
Stops accepting incoming requests. Should return a promise that resolves when the transport has stopped successfully.

# Transport Example

Express is a popular HTTP framework for a reason. It's flexible, powerful, battle tested and relatively simple to use. But not all services have the same set of needs and that can cause standardizing on one consistent express setup to create a lot of pain.

By externalizing transports, deftly avoids being coupled to a single HTTP library and then being over-prescriptive/restrictive on top of that.

This example demonstrates how simple a transport module _could_ be. It even provides the service with the ability to put a configure function in its config section so that your service gets a chance to make any modifications to the express setup before the transport is finalized.

It adds a `url` and `method` property to each action and falls back to a default if nothing is specified. While it's not a fully-featured example, it should provide enough implementation to make it clear how everything fits together.

```js
const express = require('express');
const http = require('http');

function getEnvelope (action, resource, req) {
	// again oversimplified, but it'll do
	return {
		transport: 'http',
		action: action.name,
		resource: resource.name,
		body: req.body || {},
		headers: req.headers || {},
		route: req.url,
		user: req.user,
		cookies: req.cookies
	}
}

// this is just terribly oversimplified, but it serves its purpose
function getUrl (resource, action) {
	return action.url ? action.url : '/' + [ resource.name, action.name ].join('/');
}

function createRoute (app, deftly, action, resource) {
	const url = getUrl(resource, action);
	const method = action.method || '*'; // lol
	app[ method ].use(url, (req, res) => {
		const envelope = getEnvelope(action, resource, req);
		deftly.handle(envelope)
			.then(
				response => {
					if (response.headers) {
						_.each(response.headers, function(v, k) {
							res.set(k, v);
						});
					}
					res
						.status(response.status || 200)
						.send(response.data);
				},
				error => {
					// only called if no error strategy was available
					res.send(500, 'oops');
				}
			);
	});
}

function createRoutes(state, deftly) {
	deftly.forEachAction(createRoute.bind(null, state.express, deftly);
}

function initialize(deftly) {
	const configuration = deftly.config.http;
	Object.assign(state, {
		config: configuration
	});
	if(configuration.configure) {
		const result = configuration.configure(state);
		if(!result.then) {
			result = when(result);
		}
	}
	return result.then(createRoutes.bind(null, state, deftly);
}

function start(state) {
	state.http.listen(state.config.port || 8800);
}

function stop(state) {
	state.http.close();
}

module.exports = function expressTransport() {
	const app = express();
	const state = {
		express: app;
		http: http.createServer(app)
	};
	return {
		createRoute: createRoute.bind(null, state.app),
		createRoutes: createRoutes.bind(null, state),
		getEnvelope: getEnvelope,
		getUrl: getUrl,
		initialize: initialize.bind(null, state),
		start: start.bind(null, state),
		stop: stop.bind(null, state)
	};
}
```
