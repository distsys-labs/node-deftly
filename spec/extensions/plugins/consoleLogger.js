function initialize( deftly ) {
	deftly.log.addAdapter( { level: 4 }, function consoleLog( entry ) {
		console.log( `  ${entry.namespace} [${entry.type}]: ${entry.message}` );
	} );
}

module.exports = function consoleLog() {
	return {
		initialize: initialize
	};
};
