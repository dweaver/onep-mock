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
    assert.equal(response.length, request.calls.length, 
      'correct number of responses in response ' + 
      JSON.stringify(response) + 
      ' for call ' + JSON.stringify(request.calls));
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

/**
 * Convenience function for making RPC requests that may
 * or may not succeed. 
 */
function rpcraw(auth, calls, callback) {
  var r = makeR(auth, calls);
  localrpc.request(r, callback);
}

describe('listing', function() {
  it('should return rid of one client below root', function(done) {
    rpc(ROOT,
      [['listing', [['client', 'dataport', 'datarule', 'dispatch'], {owned: true}]]],
      function(err, results) {
        assert(_.isEqual(results[0], {
          client: ['1234567890123456789012345678901234567890'],
          dataport: [],
          datarule: [],
          dispatch: []
        }), 'listing matches');
        done();
      });
  });
  it('should only return requested types', function(done) {
    rpc(ROOT,
      [['listing', [['dispatch'], {owned: true}]]],
      function(err, results) {
        assert(_.isEqual(results[0], {
          dispatch: []
        }), 'listing matches');
        done();
      });
  });
  it('should fail for unknown type', function(done) {
    rpcraw(ROOT, 
      [['listing', [['function'], {owned: true}]]], 
      function(err, response) {
        assert(!err, 'no general error');
        assert.notEqual(response[0].status, 'ok', 'status should not be ok:' + JSON.stringify(response[0]));
        done();
    });
  });
  it('should fail for unsupported option', function(done) {
    var r = makeR(ROOT, [['listing', [['dataport'], {owned: true, aliased: true}]]]);
    localrpc.request(r, function(err, response) {
        assert(!err, 'no general error');
        assert.notEqual(response[0].status, 'ok', 'status should not be ok:' + JSON.stringify(response[0]));
        done();
      });
  });
});

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

describe('create / drop', function() {
  var clientRid = null;
  it('should create a client', function(done) {
    var desc = {            
      "limits": {
        "client":       "inherit",
        "dataport":     "inherit",
        "datarule":     "inherit",
        "disk":         "inherit",
        "dispatch":     "inherit",
        "email":        "inherit",
        "email_bucket": "inherit",
        "http":         "inherit",
        "http_bucket":  "inherit",
        "share":        "inherit",
        "sms":          0,
        "sms_bucket":   0,
        "xmpp":         "inherit",
        "xmpp_bucket":  "inherit"
      },
      "locked": false,
      "meta": "hullo",
      "name": "",
      "public": false
    };
    rpc(ROOT,
      [['create', ['client', desc]]],
      function(err, results) {
        clientRid = results[0];
        assert(clientRid.match(/[a-fA-F0-9]{40}/), 'returns what looks like an RID');
        rpc(ROOT,
          [['info', [clientRid, {description: true, basic: true}]],
           ['listing', [['client'], {}]]],
          function(err, results) {
            assert(_.isEqual(results[0].description, desc));
            var basic = results[0].basic;
            assert(_.matches(basic, {
              type: 'client',
              status: 'activated',
              subscribers: 0
            }));
            assert.equal(typeof basic.modified, 'number');
             
            assert(_.contains(results[1].client, clientRid), 'created client is in listing');

            done();
          });
      });
  });
  it('should drop created client', function(done) {
    rpc(ROOT,
      [['drop', [clientRid]]],
      function(err, results) {
        rpc(ROOT,
          [['listing', [['client'], {}]]],
          function(err, results) {
            assert(_.isEqual(results[0], {
              client: ['1234567890123456789012345678901234567890']
            }), 'dropped client is not listed');
            done();
          });
      });
  });
});

describe('map / unmap', function() {
  var alias = 'test_alias';
  it('should map an alias', function(done) {
    rpc(ROOT,
      [['map', ['alias', '1234567890123456789012345678901234567890', alias]]], 
      function(err, results) {
        rpc(ROOT,
          [['info', [{'alias': alias}, {key: true}]],
           ['lookup', ['alias', alias]],
           ['info', [{alias: ''}, {aliases: true}]]],
          function(err, results) {
            assert(_.isEqual(results[0], {key: '2222222222222222222222222222222222222222'}),
              'key should be 2s: ' + JSON.stringify(results[0]));
            assert.equal(results[1], '1234567890123456789012345678901234567890');
            assert(_.contains(results[2].aliases['1234567890123456789012345678901234567890'], alias));
            done();
          });
        }); 
    });
  it('should not map an existing alias', function(done) {
    rpcraw(ROOT,
      [['map', ['alias', '1234567890123456789012345678901234567890', alias]]], 
      function(err, response) {
        assert.equal(response[0].status, 'invalid');
        done();
    });
  });
  it('should unmap an alias', function(done) {
    rpc(ROOT,
      [['unmap', ['alias', alias]]], 
      function(err, results) {
        rpcraw(ROOT,
          [['info', [{'alias': alias}, {key: true}]],
           ['lookup', ['alias', alias]],
           ['info', [{alias: ''}, {aliases: true}]]],
          function(err, response) {
            assert.equal(response[0].status, 'invalid');
            assert.equal(response[1].status, 'invalid');
            assert.equal(response[2].status, 'ok');
            assert(_.isEqual(
              response[2].result, 
              {aliases: {'1234567890123456789012345678901234567890': ["mock_other"]}}),
              'previous alias should still be there: ' + JSON.stringify(response[2].result));
            done();
          });
        }); 
    });
});

function testCalls(cik, tests, callback) {
  _.each(tests, function(test, i) {
    var r = makeR(cik, [test.call]);
    localrpc.request(r, function(err, response) {
      assert.equal(err, null);
      var message = _.has(test, 'message') ? test.message : 'testCalls() ' + i;
      if (_.has(test, 'response')) {
        assert(_.matches(response[i], test.response), 
          message + 'response matches: ' + JSON.stringify(response[0]));
      } else if (_.has(test, 'result')) {
        assert.equal(response[0].status, 'ok', 
          message + 'call succeeded: ' + JSON.stringify(response[0]));
        assert(_.isEqual(response[0].result, test.result),
          message + '\nresult:   ' + JSON.stringify(response[0].result) + '\nexpected: ' + JSON.stringify(test.result));
      } else {
        assert.equal(response[0].status, 'ok', 
          message + 'call succeeded: ' + JSON.stringify(response[0]));
      }
    });
  });
  callback(null);
}
  

describe('read', function() {
  var pts = [
    [1419791112, 12],
    [1419791212, 23],
    [1419791312, 34],
  ];
  var cik = '2222222222222222222222222222222222222222';
  var rid = '2345678901234567890123456789012345678901'; 

  it('should read with various options', function(done) {
    testCalls(cik,
      [{call: ['read', [rid, {}]], 
        result: [[1419791312, 34]]},
       {call: ['read', [rid, {limit: 2, sort: 'asc'}]],
        result: [[1419791112, 12], [1419791212, 23]]},
       {call: ['read', [rid, {limit: 4}]],
        result: [[1419791312, 34], [1419791212, 23], [1419791112, 12]]},
       {call: ['read', [rid, {starttime: 1419791112, endtime: 1419791212, limit: 100}]],
        result: [[1419791212, 23], [1419791112, 12]]},
       {call: ['read', [rid, {starttime: 1419791112, endtime: 1419791312, limit: 4}]],
        result: [[1419791312, 34], [1419791212, 23], [1419791112, 12]]},
       {call: ['read', [rid, {starttime: 1419790000, endtime: 1419791000}]],
        result: []},
       {call: ['read', [rid + '1', {}]],
        response: {status: 'invalid'}}
      ], 
      function(err) { 
        assert(!err);
        done(); 
      });
  });
});

describe('write', function() {
  var rid = '2345678901234567890123456789012345678901'; 
  it('should write a value', function(done) {
    rpc(ROOT, [['write', [rid, 77]]],
      function(err, results) {
        assert(!err);
        rpc(ROOT, [['read', [rid, {}]]],
          function(err, results) {
            assert(!err);
            assert.equal(results[0][0][1], 77);
            done();
          });  
      });
  }); 
});

describe('record', function() {
  var rid = '2345678901234567890123456789012345678901'; 
  var points = [[23456, 99], [12345, 88]];
  it('should record a value', function(done) {
    rpc(ROOT, [['record', [rid, points, {}]]],
      function(err, results) {
        assert(!err);
        rpc(ROOT, 
          [['read', [rid, {
            starttime: points[1][0], 
            endtime: points[0][0], 
            limit: 2}]]],
          function(err, results) {
            assert(!err);
            assert(_.isEqual(results[0], points),
              'points returned: ' + JSON.stringify(results[0]));
            done();
          });  
      });
  }); 
  it('should not require third argument', function(done) {
    rpc(ROOT, [['record', [rid, [[1, 44]]]]], function(err, results) { 
      assert(!err); 
      done();
    });
  });
  it('should record a negative value', function(done) {
    var now = Math.round(new Date().getTime() / 1000);
    var points = [[-5, 99]];
    // -1 / +1 is a buffer
    var starttime = now + points[0][0] - 1;
    var endtime = now + points[0][0] + 1;
    rpc(ROOT, [['record', [rid, points, {}]]],
      function(err, results) {
        assert(!err);
        rpc(ROOT, 
          [['read', [rid, {
            starttime: starttime,
            endtime: endtime }]]],
          function(err, results) {
            assert(!err);
            assert.equal(results[0][0][1], points[0][1],
              'wrong value in point returned: ' + JSON.stringify(results[0]) + 
              ' instead of ' + JSON.stringify(points));
            assert(starttime <= results[0][0][0] && results[0][0][0] <= endtime,
              'time in range recorded');
            done();
          });  
      });
  }); 
});

describe('flush', function() {
  var rid = '2345678901234567890123456789012345678901'; 
  var points = [[2, 99], [1, 88]];
  it('should flush things', function(done) {
    testCalls(ROOT,
      [{call: ['record', [rid, points, {}]]},
       {call: ['read', [rid, {starttime: 1, endtime: 2, limit: 2}]], 
        result: points},
       {call: ['flush', [rid, {}]]},
       {call: ['read', [rid, {starttime: 1, endtime: 2, limit: 2}]],
        result: []},
       {call: ['record', [rid, points, {}]]},
       {call: ['flush', [rid, {newerthan:1}]]},
       {call: ['read', [rid, {starttime: 1, endtime: 2, limit: 2}]],
        result: [points[1]]},
       {call: ['record', [rid, points, {}]]},
       {call: ['flush', [rid, {olderthan:2}]]},
       {call: ['read', [rid, {starttime: 1, endtime: 2, limit: 2}]],
        result: [points[0]]}
      ], 
      function(err) { 
        assert(!err);
        done(); 
      });
  });
});
