/*
 * Serve RPC api
 */
'use strict';

var util = require('util');
var _ = require('underscore');

var localrpc = require('./localrpc');
var db = require('./db');

function logobj(obj) {
  if (typeof console !== 'undefined') {
    console.log(JSON.stringify(obj, null, '\t'));
  }
}

/**
 * Thin web API wrapper for RPC, delegating actual call handling to localrpc,
 * which is not webserver aware.
 */
exports.rpc = function (req, res) {
  var body = '';
  req.on('data', function (chunk) {
    body += chunk;
  });
  req.on('end', function () {
    var bodyObj = null;
    try {
      bodyObj = JSON.parse(body);
    } catch (e) {
      // not valid JSON
      res.writeHead(400, {});
      res.end();
    }
    localrpc.request(bodyObj, function(err, response) {
      var jsonResponse = JSON.stringify(response);
      res.write(jsonResponse);
      res.end();
    });
  });
};
