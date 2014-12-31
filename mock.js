/**
 * Mock One Platform server, for testing
 *
 * Supports a subset of one platform commands. See README.md for details.
 */
'use strict';

/**
 * Module dependencies
 */
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var logfmt = require('logfmt');

var api = require('./api');

var app = express();

/**
 * Configuration
 */

// all environments
app.use(logfmt.requestLogger());
app.use(bodyParser.json());

/**
 * Routes
 */
// JSON API
app.post('/onep:v1/rpc/process', api.rpc);
app.post('/api:v1/rpc/process', api.rpc);

var server = null;

/**
 * Start mock server
 */
exports.start = function(options) {
  if (!options) {
    options = {};
  }
  var port = Number(process.env.PORT || options.port || 3001);
  server = app.listen(port, function() {
    console.log("One Platform mock server listening on " + port);
  });
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
