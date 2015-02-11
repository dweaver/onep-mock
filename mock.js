/**
 * Mock One Platform server, for testing
 *
 * Supports a subset of one platform commands. See README.md for details.
 */
'use strict';

/**
 * Module dependencies
 */
var http = require('http');
var url = require('url');

var api = require('./api');

/**
 * Configuration
 */

/**
 * Routes
 */

var server = null;

/**
 * Start mock server
 */
exports.start = function(options) {
  if (!options) {
    options = {};
  }
  function onRequest(request, response) {
    var pathname = url.parse(request.url).pathname;
    if (pathname !== '/onep:v1/rpc/process' && pathname !== '/api:v1/rpc/process') {
      response.writeHead(404, {});
      response.end();
    } else {
      api.rpc(request, response);
    }
  }

  server = http.createServer(onRequest);
  var port = Number(options.port || process.env.PORT || 3001);
  server.listen(port);
  console.log("One Platform mock server listening on " + port);
};

/**
 * Stop mock server
 */
exports.stop = function() {
  server.close(); 
};

if (require.main === module) { 
  // called directly
  exports.start();
} else { 
  // required as a module
}
