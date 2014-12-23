/* 
 * In memory storage for One Platform data.
 */
'use strict';
var _ = require('underscore');

var MockDb = function() {
  this.infotree = {
    rid: '0123456789012345678901234567890123456789',
    info: {
      "basic": {
        "subscribers": 0,
        "modified": 1310207844,
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
      },
      "children": [
        {
          rid: '1234567890123456789012345678901234567890',
          info: {
            "basic": {
              "subscribers": 0,
              "modified": 1310207844,
              "type": "client",
              "status": "activated"
            },
            "key": '2222222222222222222222222222222222222222',
            "description": {
              "public": false,
              "limits": {
                "sms_bucket": 100,
                "http_bucket": 100,
                "email": 100,
                "disk": 100,
                "datarule": 100,
                "xmpp_bucket": 100,
                "xmpp": 100,
                "sms": 100,
                "http": 100,
                "dataport": 100,
                "share": 100,
                "dispatch": 100,
                "email_bucket": 100,
                "client": 100,
                "io": 100
              },
              "name": "Mock Other Client",
              "locked": false,
              "meta": ""
            },
            "subscribers": [],
            "shares": [],
            "tags": [],
            "aliases": {
              "2345678901234567890123456789012345678901": ["mock_gas"]
            },
            "children": [
              {
                "rid": "2345678901234567890123456789012345678901",
                "info": {
                  "description": {
                    "name": "gas",
                    "format": "integer",
                    "subscribe": null,
                    "meta": "{\"datasource\": {\"unit\": \"\"}}",
                    "preprocess": [],
                    "public": false,
                    "retention": {
                      "count": "infinity",
                      "duration": "infinity"
                    }
                  },
                  "basic": {
                    "type": "dataport",
                    "modified": 1382333421,
                    "subscribers": 0
                  },
                  "subscribers": [],
                  "shares": [],
                  "tags": [],
                }
              }
            ]
          } // info 
        } // child 
      ]
    } 
  }
};

/**
 * returns true if fn(resource) is true. Otherwise if 
 * resource is a client, calls itself on each child
 * resource. Returns undefined if not found.
 */
function treeFind(resource, fn) {
  if (fn(resource)) {
    return resource;
  } 
  if (resource.info.basic.type === 'client') {
    if (_.has(resource.info, 'children')) {
      for (var i = 0; i < resource.info.children.length; i++) {
          var childResource = resource.info.children[i];
          var r = treeFind(childResource, fn)
          if (r) {
            return r; 
          }
      };
    }
  }
}

/**
 * find a resource for which fn(resource) is true,
 * otherwise return undefined
 */
MockDb.prototype.findResource = function(fn, callback) {
  var r = treeFind(this.infotree, fn);
  callback(null, r);
}

MockDb.prototype.findResourceInResource = function(resource, fn, callback) {
  var r = treeFind(resource, fn);
  callback(null, r);
}

MockDb.prototype.findResourceByAuth = function(auth, callback) {
  var mock = this;
  this.findResource(function(r) {
    return _.has(r.info, 'key') && r.info.key === auth.cik;  
  }, function(err, r) {
    if (err) { return callback(err); }
    if (_.has(auth, 'client_id')) {
      mock.findResource(function(r) {
        return r.info.basic.type === 'client' && r.rid === auth.client_id;
      }, callback);
    } else if (_.has(auth, 'resource_id')) {
      // TODO: http://docs.exosite.com/rpc/#authentication
      // authenticate as the owner of the given resource if the CIK 
      // identifies as an ancestor of the given resource.
      callback('resource_id in auth not supported');
    } else {
      callback(null, r);
    }
  });
}

MockDb.prototype.findResourceByRID = function(rid, callback) {
  this.findResource(function(r) {
    return r.rid === rid; 
  }, callback);
}

MockDb.prototype.findResourceByRIDInResource = function(resource, rid, callback) {
  console.log('findResourceByRIDInResource ' + rid);
  this.findResourceInResource(resource, function(r) {
    return r.rid === rid; 
  }, callback);
}
exports.Db = MockDb;
