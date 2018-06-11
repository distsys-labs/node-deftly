# deftly - plugins

Plugins are modules that will get plugged into fount and have the opportunity to process or alter resources, actions and configuration before the transports process them during their initialize call. This provides a lot of flexibility as you can add entirely new features to deftly with this.

> Note: see the [validation plugin example](#plugin-example) to get a concrete idea for how powerful this can be.

## `initialize( service)`

The plugin can use the service instance API to perform any tasks it needs to in relation to the resource and action definitions. It must return a promise so that initialization can continue.

## Plugin Example

I've always like [`joi`](https://github.com/hapijs/joi) from Walmart Labs as a way to validate things. While it would have been easy for me to add a validate property to the resource that I then plugged into joi, that creates a hard dependency and limits or at least pressures a service to validating incoming requests via joi. Less obviously, it requires changes to deftly if there are issues or limitations in how I implemented this integration.

Using the plugin approach, the feature can be introduced optionally. A service would need to include this module in its dependencies. `deftly` no longer takes an additional hard dependency that services may not use and it's simple to provide different validation plugins that use the same property and data format.

```js
// this plugin will alter any action with a validate
// property and put a middleware call in its place that
// uses the provided Joi schema either by hash or function.
// The result of the validation will either update the envelope's
// data for all following middleware calls in the stack or
// return a ValidationError which the service can handle any number
// of ways either via deftly's error strategies or trasnforms.

const joi = require('joi');
const _ = require('lodash');

// note - we're ignoring the resource argument because we don't need it here
function extendAction(action) {
	var schema;
	// we can support a hash of specs or even allow
	// validate to be a function that returns a joi schema
	if (_.isFunction(action.validate) {
		schema = action.validate();
	} else {
		schema = joi.object().keys(action.validate);
	}

	// now that we have our schema, we can replace the validate
	// property on the action with a middleware function that
	// evaluates the envelope's data property using the schema
	action.validate = getMiddleware(schema);
}

function getMiddleware(schema) {
	return function validate(envelope, data, joi, next) {
		joi.validate(data, schema, (err, val) => {
			if (err) {
				// this will cause the result of the stack to be a
				// ValidationError which the resource or action
				// can define a strategy for handling
				next(err);
			} else {
				envelope.data = val;
			}
		});
	};
}

function initialize(deftly) {
	// alter how deftly is building the middleware stack
	deftly.insertBefore('action.middleware', 'action.validate');

	// unecessary but demonstrating that plugins can
	// add dependencies for use in the call stacks later on
	deftly.fount.registerModule('joi');

	// the filter can be anything that lodash filter accepts as criteria
	deftly.forEachAction('action.validate', extendAction);

	return Promise.resolve(); // initialization must return a promise
}

module.exports = function joiValidation() {
	return {
		extendAction: extendAction, // exported for testing
		getMiddleware: getMiddleware, // exported for testing
		initialize: initialize
	};
};
```
