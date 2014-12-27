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
      assert.equal(response[i].status, 'ok', 'call succeeded');
    }
    callback(err, _.map(response, function(r) { return r.result; }));
  };
}

function makeR(auth, calls) {
  if (typeof calls === 'string') { throw 'Bad arg to makeR(). Did you mean to call makeR1?'; }
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

describe('info', function() {
  describe('root', function() {
    it('should return only keys we ask for', function(done) {
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
    it('should have infinite limit for each resource', function(done) {
      rpc(ROOT, 
        [['info', [{alias: ''}, {description: true}]]], 
        function(err, results) {
          assert(_.isEqual(results[0].description.limits, {
            "sms": "infinite",
            "http": "infinite",
            "dataport": "infinite",
            "share": "infinite",
            "dispatch": "infinite",
            "email_bucket": "infinite",
            "client": "infinite",
            "xmpp": "infinite",
            "xmpp_bucket": "infinite",
            "datarule": "infinite",
            "disk": "infinite",
            "email": "infinite",
            "http_bucket": "infinite",
            "sms_bucket": "infinite" 
        }), 'should have infinite limits: ' + JSON.stringify(results[0].description.limits, null, 2));
        done();
      }); 
    });
  });
});
