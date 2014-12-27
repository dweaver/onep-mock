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

describe('info', function() {
  describe('root', function() {
    it('should have infinite client limit', function(done){
      var r = makeR1(ROOT, 'info', [{'alias': ''}, {}]);
      localrpc.request(r, ok(r, function(err, results) {
        assert.equal(results[0].description.limits.client, 'infinite', 'limit is infinite');
        done();
      })); 
    });
  });
});
