## deftly
A transport agnostic, resource oriented, middleware powered approach to microservices.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

## Concepts
`deftly` provides building blocks and common interfaces that establish a convention for how to stitch components together to build your service. While there are some opinions inherent in the way its put together, it is very easy to extend and alter.

 * define interfaces as resources
 * define high-level transport API
 * define high-level plugin API
 * use middleware to address cross-cutting concerns
 * opt-in defaults for logging and metrics
 * enourage light-weight, testable components that are easy to share

## Request / Response
At the highest conceptual level, deftly lets you build resource-based APIs that favor request / response (although what a transport does with the response is dependent on the transport implementation).

It does this by loading resources and extensions that it will then use to build a dispatcher that can process incoming requests via an envelope abstraction.

The high-level pipeline looks like this:

```
incoming 'message' -> transport
	transport creates envelope
		`deftly.handle (envelope)`
			resource[ action ]
				-> middleware
				<- transforms
	transport 'responds'
```

## Initialization Pipeline
The initialization pipeline is relatively straight-forward but understanding the order things happen in is important
```
deftly.configure (configuration)
	load middleware
	load plugins
	load resources
	load transports

	call init on all plugins (resource transforms)
	call init on all transports (creates routes that call into dispatch)
	create middleware stacks for resource/actions

deftly.start()
	calls start on one or more transports
```

## Resources
Resources are the way the outside world interacts with your service. The provide the gateway for interacting with your service's logic. Resources are defined declaratively.

> Important: they are _not_ where your models and logic belong.

> Note: there are other properties that will come into play for resources depending on what transports and plugins you are using. Refer to transport and plugin documentation to see what's required.

```js
{
	name: '',
	middleware: []|''|{}, // pre-handle middleware
	transforms: []|''|{}, // post-handle middleware
	errors: {}, // custom error handlers
	actions: {
		[actionName]: {
			middleware: []|''|{}, // action-specific middleware
			transforms: []|''|{}, // post-handle middleware
			errors: {}, // custom error handlers
			handle: function (envelope) {
			} || []
		}
	}
}
```

### Middleware Ordering
`deftly` will order groups of middleware to create a two-part stack; the first half produces the initial response and the second performs any transformations.

### Envelope
The envelope is an abstraction around an incoming payload that attempts to normalize various transport considerations so that the handles can be as close to transport-agnostic as possible.

While several of the properties can only be provided by the transport when the envelope is created, the following properties should be considered the standard/bare minimum.

```js
{
	transport: '', // required
	route: '',
	version: '',
	resource: '', // required
	action: '', // required
	headers: {},
	body: {}, // required
	user: {}
}
```

### Handle
The handle property can contain one or more functions. When providing multiple functions, each function should provide a `when` property that determins which handle is activated.

Each handle call is expected to resolve the middleware stack by returning a response. This can be done directly, via a promise or using the callback passed to the function.

```js
handle: function direct (envelope, next) {
	return { data: 'that was easy' }
}

handle: function promised (envelope, next) {
	return Promise.resolve({ data: 'this is also easy' })
}

handle: function callback (envelope, next) {
	next({ data: 'so simple' })
}
```

#### Response
While you are free to do just about anything, the recommended base properties are `data` and `headers` as all transports need the ability to trasmit the response and most of them will support the idea of supporting metadata (headers).

> Note: as with the resource definition, many transports will specify their own properties required to produce a response (like `status` for HTTP status codes)

```js
// defaults shown
{
	_request: {}, // the reqeuest envelope
	data: undefined,
	headers: {}, // set headers sent back in the response
}
```

#### Supporting Metadata
Once a response has been produced by a handle, before the result is handed off to the transformers and then back to the transport, the entire request envelope is attached under `_request` and set as the `this` context for the transport stack. This makes it easy for transforms and the transport to access all information built up through middleware and the handler to this point.

### Dependency Injection

#### Resources, Plugins, Transports and Middleware modules
Modules loaded can take dependencies on external modules that will be provided via fount. They do this by putting arguments on the function returned from the module that defines them:

```js
module.exports = function (envelope, dependency1, dependency2) {
	return {}
}
```

> !IMPORTANT! - by default, deftly uses a container per extension type. If registering a dependency for an extension that doesn't use namespaced arguments, register dependencies based on the type: `transports`, `resources`, and `transports`

#### Middleware
All middleware, including the handle call, will have arguments supplied from the envelope's properties or from fount. The first argument in any of these functions must always be the envelope.

## Configuration
`deftly`'s configuration is relatively simple. Each transport or plugin will likely require its own section in the configuration.

Of special note is the `middlewareStack` and `transformStack` properties which control how deftly builds the middleware and transform stacks for each action. This string array controls the order that properties on the service, resource and the action are evaluated when creating the stack of calls used when dispatching an incoming request from a transport.

While this can be set directly via configuration, there are also helper functions in the API so that things like plugins can introduce new properties at specific points in this list.

__defaults shown__
```js
{
	title: ', // process/service title
	resources: [ './src/resources/*.js' ],
	middleware: [ './src/middleware/*.js' ],
	plugins: [ './src/plugins/*.js' ],
	transports: [ './src/transports/*.js' ],
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
	fount: undefined, // uses an internal instance
	metronic: undefined, // uses an internal instance
	service: { // can be attached programatically
		errors: {}, // service-wide error handlers
		middleware: [],
		transforms: []
	}
}
```

`resources`, `middleware`, `transports` and `plugins` can all be one or more file globs and/or NPM module names.

## API

### `handle (envelope)`
Returns a promise based on the corresponding resource/action middelware stack. The result is a hash object (defined earlier) that the trasport is responsible for handling.

> IMPORTANT: the resource and action properties must be set on the envelope in order for deftly to know which stack to execute.

### `init (configuration)`
The init call creates a service instance based on the configuration provided and returns a promise that will resolve to the service handle.

### `start ([transport])`
Starts all the transports for the service. If a transport name is supplied, only that transport is started.

### `stop ([transport])`
Stops all the transports for the service. If a transport name is supplied, only that transport is stopped.

### Resource Processing
While the entire resource hash is available in the `resources` property, extensions will likely need the ability to process or alter resource and action definitions based on metadata added to them in the service. `deftly` provides a set of calls that will use filtering and iteration to make this task a little simpler.

#### `forEachResource ([filter], processor)`
The filter is optional but means your processor will be called for every resource that was loaded. Processor is a function that is passed a resource so that the extensions has the opportunity to process or alter the resource definition _before_ the middleware stacks are created.

#### `forEachAction([filter], processor)`
The filter is optional but means your processor will be called for every resource that was loaded. Processor is a function that is passed an action and its resource so that the extension has the opportunity to process or alter the action definition _before_ the middleware stacks are created.

```js
function processor (action, resource) {
	// do stuff here
}
```

### Stack Ordering
This allows plugins to introduce new middleware or transform segments to the middleware stacks built during resource processing. The first argument specifies which stack to add the property to. The `spec` argument should be a string that specifies the property to read and if that property is on the service, resource or action.

__examples
```js
	'service.authenticate'
	'resource.authorize'
	'action.authorize'
	'action.validate'
```

Because deftly has two different stacks in the call pipeline, it separates everything that happens before the `handle` call (`middleware`) from everything that happens after it (`transform`). In order to introduce a new step, the target stack is required

> Important: 'action.handle' is, by default, the last call in the middleware stack.

#### `stackOrder.append ('middleware'|'transport', spec)`

#### `stackOrder.prepend ('middleware'|'transport', spec)`

#### `stackOrder.insertAfter ('middleware'|'transport', spec, existingStep)`

#### `stackOrder.insertBefore ('middleware'|'transport', spec, existingStep)`

### `.log`
The handle to deftly's logging abstraction. Resources, transports and plugins all have access to this and should utilize this vs. a particular logging library directly. See [logging](/docs/logging.md) document for more details.

### `.metrics`
Provides a handle to the metronic instance (either the default or a custom instance provided). See the [metrics](/docs/metrics.md) more information on how deftly uses metronic for instrumentation.

### `.transport`
A hash of the loaded transports.

### `.middleware`
A hash of the loaded middleware.

### `.resources`
A hash of the loaded resources.

### `.plugins`
A hash of the loaded plugins.

## Use

```js
const deftly = require('deftly')
const config = require('./configuration')

deftly.init(config)
	.then(service => {
		service.start()
	})
```

[travis-url]: https://travis-ci.org/deftly/node-deftly
[travis-image]: https://travis-ci.org/deftly/node-deftly.svg?branch=master
[coveralls-url]: https://coveralls.io/github/deftly/node-deftly?branch=master
[coveralls-image]: https://coveralls.io/repos/github/deftly/node-deftly/badge.svg?branch=master
