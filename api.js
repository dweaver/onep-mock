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

exports.rpc = function (req, res) {
  var localResponses = [];
  var overallError = null;
  
  function collectResponse(err, response) {
    if (err) { 
      console.log(err); 
      overallError = {
        "error": {
          "code": 500,
          "message": err,
          "context": "call"
        }
      };
      return;
    }
    localResponses.push(response);
  }
  // authenticate
  localrpc.authenticate(req.body.auth, function(err, caller) {
    if (caller === null) {
      res.json({"error": 
        {
          "code": 401,
          "message": "Invalid",
          "context": "auth"
        }
      });
    } else {
      for (var i = 0; i < req.body.calls.length; i++) {
        var call = req.body.calls[i];
        localrpc.call(call, caller, collectResponse);
      }
      res.json(overallError === null ? localResponses : overallError);
    }
  });
};
