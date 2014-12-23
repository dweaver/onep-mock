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
  var local_responses = [];
  var onep_calls = [];
  
  // authenticate
  localrpc.authenticate(req.body.auth, function(err, caller) {
    if (caller === null) {
      // TODO: return overall error
      console.log('res.json');
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
        localrpc.call(call, caller, function(err, response) {
          if (err) { 
            console.log(err); 
            res.json({"error": 
              {
                "code": 500,
                "message": err,
                "context": "call"
              }
            });
            return;
          }
          local_responses.push(response);
        });
      }
      res.json(local_responses);
    }
  });
  
};


