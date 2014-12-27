/*
 * Serve RPC api
 */
'use strict';

var util = require('util');
var _ = require('underscore');

var localrpc = require('./localrpc');
var db = require('./db');

function logobj(obj) {
  if (typeof console !== 'undefined')
    console.log(JSON.stringify(obj, null, '\t'));
}

/**
 * Thin web API wrapper for RPC, delegating actual call handling to localrpc.
 */
exports.rpc = function (req, res) {
  localrpc.request(req.body, function(err, response) {
    res.json(response);
  });
};
