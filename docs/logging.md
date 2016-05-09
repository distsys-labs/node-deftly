## deftly - logging
`deftly` provides a very flexible logging adapter that should allow you to easily plug in just about any logging library you like. It may sound like a lot of effort, but it's quite trivial to start with something simple:

### Logging
You get a namespaced log by calling `get` on `deftly.log`. After that entries are created by calling the method that sets the level of the entry ( `debug`, `info`, `warn`, `error`, `fatal` ):

```js
var myLog = flobot.log.get( "myLog" );

myLog.debug( "a debug entry" );
myLog.info( "an %s entry", "info" ); // old-school interpolation
myLog.warn( `a ${localVar} entry` );
myLog.error( { detail: "a error entry" } ); // entry.message will be an object 
myLog.fatal( "a fatal entry" );
```

### Adapters
Adapters have a simple task: processing the log entry. Log level and namespace based filtering are handled by deftly itself.

An adapter can be a function or simple object with functions named after each level. You can supply a name for the adapter explicitly or you can provide a named function or the object can have a `name` property.

#### Configuration
Each adapter is supplied with a default configuration:

```js
{
	filter: "",
	level: 3, // warnings or higher
	namespaceInit: false // called if the adapter is a factory
}
```

#### Filtering
This approach uses the same filtering format as the [`debug`](https://github.com/visionmedia/debug) library. You can space or comma delimit multiple namespace filters. 
 
 * A filter beginning with a `-` will exclude entries that match
 * A filter ending in a wildcard (`*`) will match anything after
 * Filters that don't end with a wildcard match namespaces exactly

Filters can be changed programmatically after the fact:

```js
// adds a filter
deftly.log.loggers.loggername.addFilter( "stuff*" );

// removes the filter specified
deftly.log.loggers.loggername.removeFilter( "-other" );

// resets all filters based on the string provided
deftly.log.loggers.loggername.setFilter( "good,-bad" );
```

#### `namespaceInit`
If the adapter is a function that takes the namespace and returns a log function or object, this parameter must be set to `true`.

#### Entry
Each adapter is passed an entry hash that it can choose how to process:

```js
{
	type: "", // the level name "debug" - "fatal"
	level: 1-5, // 1 - fatal, 5 - debug
	namespace: "", // the namespace the message was logged on
	message: ""|{}, // can be an object, but likely a string
}
```

### Example - console.log adapter
This code will create a logger named `console` at level 3 (warn or above) without any namespace filters. It will write logs that look like this to the console:

```js
// will create a logger called `console`
// defaults to level 3 (warn or above)
// listening to all namespaces (unfiltered)
deftly.log.addAdapter( function consoleLogger( entry ) {
	console.log( `${entry.namespace} [${entry.type}]: ${entry.message}` );
} );
```

### Example - DEBUG adapter
Using libraries that can also perform their own filtering may seem odd, but generally the best approach is to have the logging library log everything sent to it.

> Note: set `DEBUG=*` in the environment before the process starts.

```js
var debug = require( "debug" );
function debugInit( namespace ) {
	var dbg = debug( namespace );
	return function( entry ) {
		dbg( entry.message );
	}
}
deftly.log.addAdapter( "debug", { namespaceInit: true }, debugInit );
```
