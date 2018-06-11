# deftly - Resources

Resources are the way the outside world interacts with your service. The provide the gateway for interacting with your service's logic. Resources are defined declaratively.

> Important: they are _not_ where your models and logic belong. You will be happier if these live separately.

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
			handle: function( envelope ) {
			} || []
		}
	}
}
```

## Middleware Ordering

`deftly` will order groups of middleware to create a two-part stack; the first half produces the initial response and the second performs any transformations.

## Envelope

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

## Handle

The handle property can contain one or more functions. When providing multiple functions, each function should provide a `when` property that determines which handle is activated.

Each handle call is expected to resolve the middleware stack by returning a response. This can be done directly, via a promise or using the callback passed to the function.

```js
handle: function direct (envelope, next) {
	return { data: 'that was easy' };
}

handle: function promised (envelope, next) {
	return Promise.resolve({ data: 'this is also easy' });
}

handle: function callback (envelope, next) {
	next({ data: 'so simple' });
}
```

### Response

The recommended base properties are `data` and `headers` as all transports need the ability to trasmit the response and most of them will support the idea of supporting metadata (headers).

> Note: as with the resource definition, many transports will specify their own properties required to produce a response (like `status` for HTTP status codes)

```js
// defaults shown
{
	_request: { ... }, // the reqeuest envelope
	data: undefined,
	headers: {}, // set headers sent back in the response
}
```

### Supporting Metadata

Once a response has been produced by a handle, before the result is handed off to the transformers and then back to the transport, the entire request envelope is attached under `_request` and set as the `this` context for the transport stack. This makes it easy for transforms and the transport to access all information built up through middleware and the handler to this point.

## Dependency Injection

### Resources, Plugins, Transports and Middleware modules

Modules loaded can take dependencies on external modules that will be provided via fount. They do this by putting arguments on the function returned from the module that defines them:

```js
module.exports = function (envelope, dependency1, dependency2) {
	return { ... };
}
```

### Middleware

All middleware, including the handle call, will have arguments supplied from the envelope's properties or from fount. The first argument in any of these functions must always be the envelope.
