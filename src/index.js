var _ = require( "lodash" );
var when = require( "when" );
var defaults = require( "./defaults" );
var dispatcherFn = require( "./dispatcher" );

function forEachAction( state, filter, iterator ) {
	if( !iterator ) {
		iterator = filter;
		filter = function() { return true; };
	} else if( !_.isFunction( filter ) ) {
		filter = _.match( filter );
	}
	return _.reduce( state.resources, function( acc, resource, resourceName ) {
		var results = _.map( resource.actions, function( action, actionName ) {
			action.name = actionName;
			if( filter( action ) ) {
				return iterator( action, resource );
			}
		} );
		acc = acc.concat( _.filter( results ) );
		return acc;
	}, [] );
}

function forEachResource( state, filter, iterator ) {
	if( !iterator ) {
		iterator = filter;
		filter = function() { return true; };
	} else if( !_.isFunction( filter ) ) {
		filter = _.match( filter );
	}
	var results = _.map( state.resources, function( resource, resourceName ) {
		if( filter( resource ) ) {
			return iterator( resource );
		}
	} );
	return _.filter( results );
}

function handle( state, envelope ) {
	var key = [ envelope.resource, envelope.action ].join( "!" );
	var handler = state.handlers[ key ];
	var user = envelope.user || { id: "anonymous" };
	var transform = function replyTransform( reply ) {
		reply._request = envelope;
		return state.transforms[ key ].execute( envelope, reply );
	}
	var errorStrategy = state.errors[ key ].bind( state, envelope );
	if( handler ) {
		return state.metrics.instrument( {
			key: [ envelope.resource, envelope.action, "deftly" ],
			call: function() {
				return handler.execute( state, envelope )
					.then( transform, errorStrategy )
					.catch( errorStrategy );
			},
			onSuccess: unit,
			onFailure: unit,
			metadata: {
				user: user.id || user.name,
				transport: envelope.transport
			}
		} );
		
	} else {
		// chances are, if you hit this, you have a transport behaving
		// _very_ badly.
		state.log( "A transport has created" );
		return when( {
			status: 404,
			data: format( "No handler found for %s - %s", envelope.resource, envelope.action )
		} );
	}
}

function initialize( supplied ) {
	var config = normalizeConfig( supplied );
	var fount = config.fount;
	var metronic = config.metronic( config.metrics );

	fount.register( "fount", fount );
	fount.register( "config", config );
	fount.register( "metrics", metronic );

	var state = {
		fount: fount,
		log: require( "./log" ),
		metrics: metronic,
		modlo: require( "modlo" )( { fount: config.fount } ),
		snap: require( "snapstack" )( { fount: config.fount } ),
		errors: {},
		handlers: {},
		transforms: {},
		transports: {},
		middleware: {},
		stacks: {},
		plugins: {},
		resources: {},
		service: {
			middleware: undefined,
			transform: undefined,
		},
		config: config
	};

	state.start = start.bind( null, state );
	state.stop = stop.bind( null, state );
	state.handle = handle.bind( null, state );
	state.forEachAction = forEachAction.bind( null, state );
	state.forEachResource = forEachResource.bind( null, state );

	fount.register( "deftly", state );
	fount.register( "log", state.log );

	var promises = [ 
		loadPlugins( state ),
		loadMiddleware( state ),
		loadResources( state ),
		loadTransports( state )
	];

	return when.all( promises )
		.then( initializePlugins.bind( null, state ) )
		.then( initializeTransports.bind( null, state ) )
		.then( initializeDispatcher.bind( null, state ) );
}

function initializeDispatcher( state ) {
	var dispatcher = dispatcherFn( state );
	dispatcher.createStacks();
	return state;
}

function initializeExtension( state, extension ) {
	return extension.initialize( state );
}

function initializePlugins( state ) {
	return when.all( _.map( 
		state.plugins, initializeExtension.bind( null, state ) 
	) );
}

function initializeTransports( state ) {
	return when.all( _.map( 
		state.transports, initializeExtension.bind( null, state ) 
	) );
}

function loadMiddleware( state ) {
	if( state.config.middleware && state.config.middleware.length ) {
		return state.snap.load( state.config.middleware )
			.then( function( result ) {
				state.stacks = result;
				return result;
			} );
	} else {
		return when( {} );
	}
}

function loadExtensions( state, type ) {
	var list = state.config[ type ];
	var files = [];
	var names = [];
	_.each( list, function( x ) { 
		if( /[\/]/.test( x ) ) {
			files.push( x );
		} else {
			names.push( x );
		}
	} );
	var container = state.fount( type );
	if( files.length === 0 && names.length === 0 ) {
		return when( {} );
	}
	return state.modlo
		.load( { 
			fount: container,
			patterns: files,
			modules: names
		} )
		.then( function( result ) {
			var promises = _.map( result.loaded, function( extension ) {
				return container
					.resolve( extension )
					.then( function( result ) {
						result.name = result.name || extension;
						state[ type ][ extension ] = result;
						return {
							key: extension,
							value: result
						};
					} );
			} );
			return when.all( promises )
				.then( function( extensions ) {
					return _.reduce( extensions, function( acc, extension ) { 
						acc[ extension.key ] = extension.value;
						return acc;
					}, {} );
				} );
		} );
}

function loadPlugins( state ) {
	return loadExtensions( state, "plugins" );
}

function loadResources( state ) {
	return loadExtensions( state, "resources" );
}

function loadTransports( state ) {
	return loadExtensions( state, "transports" );
}

function normalizeConfig( supplied ) {
	supplied.plugins = toArray( supplied.plugins );
	supplied.middleware = toArray( supplied.middleware );
	supplied.resources = toArray( supplied.resources );
	supplied.transports = toArray( supplied.transports );
	return Object.assign( {}, defaults, supplied );
}

function start( state, transportName ) {
	if( transportName ) {
		var transport = state.transports[ transportName ]
		return startTransport( transport );
	} else {
		return when.all( _.map( state.transports, startTransport ) )	
	}
	
}

function startTransport( transport ) {
	return transport.start();
}

function stop( state, transportName ) {
	if( transportName ) {
		var transport = state.transports[ transportName ]
		return stopTransport( transport );
	} else {
		return when.all( _.map( state.transports, stopTransport ) )	
	}
}

function stopTransport( transport ) {
	return transport.stop();
}

function toArray( value ) {
	return _.isString( value ) ? [ value ] : ( value || [] );
}

function unit( x ) { return x; }

module.exports = {
	init: initialize,
	// exported for testing
	forEachAction: forEachAction,
	forEachResource: forEachResource,
	handle: handle,
	loadExtensions: loadExtensions,
	normalizeConfig: normalizeConfig,
	start: start,
	stop: stop
};