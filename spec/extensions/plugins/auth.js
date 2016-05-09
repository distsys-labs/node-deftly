var _ = require( "lodash" );
var when = require( "when" );

function authorize( roles, envelope, next ) {
	if( _.includes( roles, envelope.role ) ) {
		next();
	} else {
		throwCustom( "Forbidden" );
	}
}

function authenticate( envelope, next ) {
	if( envelope.headers && envelope.headers.authorize ) {
		envelope.user = {
			id: envelope.headers.authorize
		};
		envelope.role = envelope.headers.authorize
	}
	next();
}

function checkUser( envelope, next ) {
	if( envelope.user && envelope.user.id && envelope.user.id !== "anonymous" ) {
		next();
	} else {
		throwCustom( "Unauthorized" );
	}
}

function throwCustom( error, message ) {
	var E = function ( message ) {
		this.name = error + "Error";
		this.message = message || error;
		this.stack = (new Error()).stack;
	};
	E.prototype = Object.create(Error.prototype);
	E.prototype.constructor = E;
	throw new E();
}

function initialize( deftly ) {
	deftly.config.middlewareStack.unshift( "resource.authenticate", "action.authenticate", "action.authorize" );
	deftly.forEachResource( function( resource ) {
		resource.authenticate = authenticate;
	} );
	deftly.forEachAction( function( action, resource ) {
		if( resource.authenticated || action.authenticated || !_.has( action, "authenticated" ) ) {
			action.authenticate = checkUser;
		}
		if( resource.roles && !_.has( action, "roles" ) ) {
			action.authorize = authorize.bind( null, resource.roles );
		} else if( action.roles ) {
			action.authorize = authorize.bind( null, action.roles );
		}
	} );
}

module.exports = function authExample() {
	return {
		initialize: initialize
	};
};
