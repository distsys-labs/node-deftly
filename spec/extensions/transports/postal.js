var _ = require( "lodash" );
var when = require( "when" );
var fs = require( "fs" );
var path = require( "path" );
var hostname = require( "os" ).hostname();
var log;
var resourceChannels = {};

function getEnvelope( action, resource, data, envelope ) {
	var env =  {
		transport: "postal",
		action: action.name,
		resource: resource.name,
		data: data || {},
		headers: envelope.headers || {},
		route: [ envelope.channel, envelope.topic ].join( ":" ),
		user: envelope.user || { id: "anonymous" },
		role: envelope.role || "anonymous"
	};
	return env;
}

function createRoute( state, deftly, action, resource ) {
	var channel = state.postal.channel( resource.name );
	var topic = action.topic || action.name;
	channel.subscribe( topic, function( data, postalEnvelope ) {
		var envelope = getEnvelope( action, resource, data, postalEnvelope );
		deftly.handle( envelope )
			.then( 
				function( reply ) {
					postalEnvelope.reply( null, reply );
				},
				function( error ) {
					// only called if no error strategy was available
					postalEnvelope.reply( error );
				}
			);
	} );
}

function createRoutes( state, deftly ) {
	deftly.forEachAction( createRoute.bind( null, state, deftly ) );
}

function initialize( state, deftly ) {
	log = deftly.log.get( "http" ); 
	var configuration = deftly.config.http || {};
	Object.assign( state, {
		config: configuration
	} );
	var reply = when();
	if( configuration.configure ) {
		reply = configuration.configure( state );
		if( !reply.then ) {
			reply = when( reply );
		}
	}
	return reply.then( createRoutes.bind( null, state, deftly ) );
}

function start( state ) {
	// nothing to see here ...
}

function stop( state ) {
	// move along.
}

module.exports = function postalTransport( postal ) {
	var state = {
		postal: postal
	};
	return {
		initialize: initialize.bind( null, state ),
		start: start.bind( null, state ),
		stop: stop.bind( null, state )
	};
}