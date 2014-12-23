// Mock One Platform server, for testing
//
// Supports a subset of one platform commands:
// - create (type: client only)
// - info (basic, description, and key only)
// - drop
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

/**
 * Start Server
 */
var port = Number(process.env.PORT || 3001);
app.listen(port, function() {
    console.log("One Platform mock server listening on " + port);
});
