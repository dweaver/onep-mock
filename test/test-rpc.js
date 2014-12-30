var assert = require('assert');
var _ = require('underscore');
var async = require('async');
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
      jstr(response) + 
      ' for call ' + jstr(request.calls));
    for (var i = 0; i < response.length; i++) {
      assert.equal(response[i].status, 'ok', 
        'call succeeds:\n' + 
        jstr(request.calls[i]) + ' => ' + jstr(response[i]));
    }
    callback(err, _.map(response, function(r) { return r.result; }));
  };
}

/**
 * Convenience function for stringify.
 */
function jstr(o) {
  return JSON.stringify(o);
}

function makeR(auth, calls) {
  if (typeof calls === 'string' || typeof calls[0] === 'string') { throw 'Bad arg to makeR().'; }
  if (typeof auth === 'string') { auth = {cik: auth}; }
  calls = _.map(calls, function(c) {
    return {procedure: c[0], arguments: c[1]};
  });
  return {
    calls: calls, 
    auth: auth
  };
}

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
        assert.notEqual(response[0].status, 'ok', 'status should not be ok:' + jstr(response[0]));
        done();
    });
  });
  it('should fail for unsupported option', function(done) {
    var r = makeR(ROOT, [['listing', [['dataport'], {owned: true, aliased: true}]]]);
    localrpc.request(r, function(err, response) {
        assert(!err, 'no general error');
        assert.notEqual(response[0].status, 'ok', 'status should not be ok:' + jstr(response[0]));
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
          jstr(_.keys(results[0]).sort()) + ' contains "description" and "subscribers"');
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
        }), 'info looks right: ' + jstr(info, null, 2));
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
              'key should be 2s: ' + jstr(results[0]));
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
              'previous alias should still be there: ' + jstr(response[2].result));
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
      var message = _.has(test, 'message') && test.message !== null ? 
        test.message : 'testCalls() ' + i;
      if (_.has(test, 'response')) {
        if (_.isFunction(test.response)) {
          var o = test.response(response[0]);
          if (_.isObject(o)) {
            assert(o.pass, o.message);
          } else {
            assert(o,
              message + ' response function with response ' + 
              jstr(response[0]));
          }
        } else {
          assert(_.matches(response[i], test.response), 
            message + 'response matches: ' + jstr(response[0]));
        }
      } else if (_.has(test, 'result')) {
        assert.equal(response[0].status, 'ok', 
          message + 'call succeeded: ' + jstr(response[0]));
        assert(_.isEqual(response[0].result, test.result),
          message + '\nresult:   ' + jstr(response[0].result) + '\nexpected: ' + jstr(test.result));
      } else {
        assert.equal(response[0].status, 'ok', 
          message + 'call succeeded: ' + jstr(response[0]));
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

/**
 * Create a test client with an assortment of dataports and datarules under it.
 */
function makeTestClient(cik, callback) {
  var cb = function(err) { assert(!err); };
  var childcik = null;
  async.waterfall([
    function(callback) {
      rpc(cik, [['create', ['client', { limits: { dataport: 3 } }]]], callback);
    },
    function(results, callback) {
      var rid = results[0];
      rpc(ROOT, [['info', [rid, {key: true}]]], callback);
    },
    function(results, callback) {
      childcik = results[0].key;
      // create dataports
      rpc(childcik, [
        ['create', ['dataport', {format: 'float', name: 'float_name'}]],
        ['create', ['dataport', {format: 'integer', name: 'integer_name'}]],
        ['create', ['dataport', {format: 'string', name: 'string_name'}]],
        ['create', ['datarule', {format: 'string', name: 'script_name', 
          rule: {script: 'debug("hello world")'}}]],
        ['create', ['client', {name: 'client_name'}]],
      ], callback);
    },
    function(results, callback) {
      // map aliases to each child
      rpc(childcik, [
        ['map', ['alias', results[0], 'dp.float']],
        ['map', ['alias', results[1], 'dp.integer']],
        ['map', ['alias', results[2], 'dp.string']],
        ['map', ['alias', results[3], 'dr']],
        ['map', ['alias', results[4], 'cl']]
      ], callback);
    }
  ], function(err, result) {
    callback(err, childcik);
  });
}

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
              'points returned: ' + jstr(results[0]));
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
              'wrong value in point returned: ' + jstr(results[0]) + 
              ' instead of ' + jstr(points));
            assert(starttime <= results[0][0][0] && results[0][0][0] <= endtime,
              'time in range recorded');
            done();
          });  
      });
  }); 
});

describe('write/record format', function() {
  it('should correctly write and record various formats', function(done) {
    makeTestClient(ROOT, function(err, cik) {
      function tf(alias, val, expectval, callback) {
        testCalls(cik,
          [{call: ['flush', [{alias: alias}, {}]]},
           {call: ['record', [{alias: alias}, [[1, val]]]]},
           {call: ['read', [{alias: alias}, {}]], result: [[1, expectval]]},
           {call: ['write', [{alias: alias}, val]]},
           {call: ['read', [{alias: alias}, {}]], response: function(response) {
              return response.status === 'ok' && response.result[0][1];
            }}],
          function(err) {
            assert(!err);
            callback(err);
          });
      }
      // record and read back various values
      async.series([
        // float val
        function(cb) { tf('dp.float', 77.7, 77.7, cb); },
        function(cb) { tf('dp.integer', 77.7, 77, cb); },
        function(cb) { tf('dp.string', 77.7, '77.7', cb); },
        function(cb) { tf('dp.float', '77.7', 77.7, cb); },
        function(cb) { tf('dp.integer', '77.7', 77, cb); },
        function(cb) { tf('dp.string', '77.7', '77.7', cb); },
        // string val
        function(cb) { tf('dp.float', 'foo', 1.0, cb); },
        function(cb) { tf('dp.integer', 'foo', 1, cb); },
        function(cb) { tf('dp.string', 'foo', 'foo', cb); },
        // integer val
        function(cb) { tf('dp.float', 77, 77, cb); },
        function(cb) { tf('dp.integer', 77, 77, cb); },
        function(cb) { tf('dp.string', 77, '77', cb); },
        function(cb) { tf('dp.float', '77', 77, cb); },
        function(cb) { tf('dp.integer', '77', 77, cb); },
        function(cb) { tf('dp.string', '77', '77', cb); },
      ], function(err) { 
        assert(!err);
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

describe('update', function() {
  var rid = '2345678901234567890123456789012345678901'; 
  var name = 'test name';
  var meta = 'test meta';
  it('updates various parts of resource', function(done) {
    makeTestClient(ROOT, function(err, cik) {
      function tf(alias, obj, expectStatus, expectObj, callback, msg) {
        testCalls(cik,
          [{call: ['update', [{alias: alias}, obj]],
            response: function(r) {
              return {
                pass: r.status === expectStatus,
                message: 'updating ' + jstr(obj) + ' expected status "' + expectStatus + 
                  '", got "' + r.status + '" instead' +
                  (_.isString(msg) ? '(' + msg + ')' : '')
              };
            }},
           {call: ['info', [{alias: alias}, {description: true}]],
            response: function(r) {
              var desc = r.result.description;
              return {
                pass: r.status === 'ok' && 
                  (_.isFunction(expectObj) ? expectObj(r) : _.matches(expectObj)(desc)),
                message: 'description after update: ' + 
                  jstr(desc) + ' vs. expected ' + 
                  (_.isFunction(expectObj) ? expectObj : jstr(expectObj)) + 
                  (_.isString(msg) ? '(' + msg + ')' : '')
              };
            }}],
          function(err) {
            assert(!err);
            callback(err);
          });
      }
      // update and read back various values
      var alias = 'dp.float';
      function limitSmsIs(sms) {
        return function(response) { 
          return response.result.description.limits.sms === sms;
        };
      }
      function retentionIs(retention) {
        return function(response) { 
          return _.isEqual(response.result.description.retention, retention);
        };
      }
      function retentionUnchanged(response) {
        return _.isEqual(response.result.description.retention, {count: 1, duration: 1});
      }
      async.series([
        // name
        function(cb) { tf(alias, {name: name}, 'ok', {name: name}, cb); },
        function(cb) { tf(alias, {name: 14}, 'invalid', {name: name}, cb); },
        function(cb) { tf(alias, {name: null}, 'invalid', {name: name}, cb); },
        // meta
        function(cb) { tf(alias, {meta: meta}, 'ok', {meta: meta}, cb); },
        function(cb) { tf('', {meta: meta + '1'}, 'restricted', {meta: ''}, cb,
          'client is not allowed to update itself'); },
        function(cb) { tf(alias, {meta: 14}, 'invalid', {meta: meta}, cb); },
        function(cb) { tf(alias, {meta: null}, 'invalid', {meta: meta}, cb); },
        // locked
        function(cb) { tf('cl', {locked: true}, 'ok', {locked: true}, cb); },
        function(cb) { tf('cl', {locked: false}, 'ok', {locked: false}, cb); },
        function(cb) { tf('cl', {locked: 'foo'}, 'invalid', {locked: false}, cb); },
        function(cb) { tf('cl', {locked: 14}, 'invalid', {locked: false}, cb); },
        function(cb) { tf('cl', {locked: null}, 'invalid', {locked: false}, cb); },
        // public 
        function(cb) { tf(alias, {public: true}, 'ok', {public: true}, cb); },
        function(cb) { tf(alias, {public: false}, 'ok', {public: false}, cb); },
        function(cb) { tf(alias, {public: 'foo'}, 'invalid', {public: false}, cb); },
        function(cb) { tf(alias, {public: 14}, 'invalid', {public: false}, cb); },
        function(cb) { tf(alias, {public: null}, 'invalid', {public: false}, cb); },
        // limits
        function(cb) { tf('cl', {limits: {sms: 1}}, 'ok', limitSmsIs(1), cb); },
        function(cb) { tf('cl', {limits: {sms: 'inherit'}}, 'ok', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: null}, 'invalid', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: 12}, 'invalid', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: 'inherit'}, 'invalid', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: {sms: null}}, 'invalid', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: {sms: 'inheri'}}, 'invalid', limitSmsIs('inherit'), cb); },
        function(cb) { tf('cl', {limits: {sms: 12.3}}, 'invalid', limitSmsIs('inherit'), cb); },
        // retention
        function(cb) { tf(alias, {retention: {count: 3}}, 'ok', 
          retentionIs({count: 3, duration: 'infinity'}), cb); },
        function(cb) { tf(alias, {retention: {count: 2}}, 'ok', 
          retentionIs({count: 2, duration: 'infinity'}), cb); },
        function(cb) { tf(alias, {retention: {count: 'infinity'}}, 'ok', 
          retentionIs({count: 'infinity', duration: 'infinity'}), cb); },
        function(cb) { tf(alias, {retention: {count: 1, duration: 1}}, 'ok', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: null}, 'invalid', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: 'infinity'}, 'invalid', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: 11}, 'invalid', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: {count: 'nfinite'}}, 'invalid', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: {duration: null}}, 'invalid', 
          retentionUnchanged, cb); },
        function(cb) { tf(alias, {retention: {duration: 1.5}}, 'invalid', 
          retentionUnchanged, cb); },
        // unknown property is ignored
        function(cb) { tf(alias, {foo: 'bar'}, 'ok', function(response) {
          return !_.has(response.result.description, 'foo');
        }, cb); },
      ], function(err) { 
        assert(!err);
        done(); 
      });
    });
  });
});
