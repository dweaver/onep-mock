var assert = require('assert');
var _ = require('underscore');
var localrpc = require('../localrpc');

var ROOT = "1111111111111111111111111111111111111111";

/**
 * Check that an RPC call basically succeeded, then
 * pass an array of results to a specific handler.
 */
function ok(request, callback) {
  return function(err, response) {
    assert.equal(err, null);
    assert.equal(response.length, request.calls.length, 'correct number of responses');
    for (var i = 0; i < response.length; i++) {
      assert.equal(response[i].status, 'ok', 
        'call succeeds:\n' + 
        JSON.stringify(request.calls[i]) +
        ' => ' + 
        JSON.stringify(response[i]));
    }
    callback(err, _.map(response, function(r) { return r.result; }));
  };
}

function makeR(auth, calls) {
  if (typeof calls === 'string' || typeof calls[0] === 'string') { throw 'Bad arg to makeR(). Did you mean to call makeR1?'; }
  if (typeof auth === 'string') { auth = {cik: auth}; }
  calls = _.map(calls, function(c) {
    return {procedure: c[0], arguments: c[1]};
  });
  return {
    calls: calls, 
    auth: auth
  };
}
function makeR1(auth, procedure, args) { return makeR(auth, [[procedure, args]]); }

/**
 * Convenience function for making RPC requests that are
 * expected to succeed.
 */
function rpc(auth, calls, callback) {
  var r = makeR(auth, calls);
  localrpc.request(r, ok(r, callback));
}

describe('lookup', function() {
  it('should return the RID for root', function(done) {
    rpc(ROOT,
      [['lookup', ['alias', '']]], 
      function(err, results) {
        assert.equal(results[0], '0123456789012345678901234567890123456789', 'lookup returned RID'); 
        done();
    });
  });
  it('should return the RID for a child of root', function(done) {
    rpc(ROOT,
      [['lookup', ['alias', 'mock_other']]], 
      function(err, results) {
        assert.equal(results[0], '1234567890123456789012345678901234567890', 'lookup returned RID'); 
        done();
    });
  });
  it('should fail to look up RID for alias of grandchild', function(done) {
    var r = makeR(ROOT, [['lookup', ['alias', 'mock_gas']]]);
    localrpc.request(r, function(err, response) {
        assert(!err, 'no general error');
        assert.notEqual(response[0].status, 'ok', 'status should not be ok');
        done();
      });
    });
});

describe('info', function() {
  it('should return only the requested keys', function(done) {
    rpc(ROOT, 
      [['info', [{alias: ''}, {description: true, subscribers: true}]]], 
      function(err, results) {
        var keys = _.keys(results[0]).sort();
        assert(
          _.isEqual(keys, ['description', 'subscribers']),
          JSON.stringify(_.keys(results[0]).sort()) + ' contains "description" and "subscribers"');
        done();
    });
  });
  it('should look like we expect', function(done) {
    rpc(ROOT, 
      [['info', [{alias: ''}, {basic: true, description: true, key: true, subscribers: true, shares: true, tags: true, aliases: true}]]], 
      function(err, results) {
        var info = results[0];
        assert(_.isEqual(info, {
          "basic": {
            "subscribers": 0,
            "modified": 1234567890,
            "type": "client",
            "status": "activated"
          },
          "key": '1111111111111111111111111111111111111111',
          "description": {
            "public": false,
            "limits": { 
              "sms_bucket": "infinite", "http_bucket": "infinite", "email": "infinite", "disk": "infinite", "datarule": "infinite",
              "xmpp_bucket": "infinite", "xmpp": "infinite", "sms": "infinite", "http": "infinite", "dataport": "infinite", 
              "share": "infinite", "dispatch": "infinite", "email_bucket": "infinite", "client": "infinite", "io": "infinite"
            },
            "name": "Mock Master Client",
            "locked": false,
            "meta": ""
          },
          "subscribers": [],
          "shares": [],
          "tags": [],
          "aliases": {
            "1234567890123456789012345678901234567890": ["mock_other"]
          }
        }), 'info looks right: ' + JSON.stringify(info, null, 2));
      done();
    }); 
  });
});
