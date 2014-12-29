/* 
 * In memory storage for One Platform data.
 */
"use strict";
var _ = require('underscore');

var MockDb = function() {
  this.series = {
    // these must always be sorted in ascending order
    '2345678901234567890123456789012345678901': [
      [1419791112, 12],
      [1419791212, 23],
      [1419791312, 34],
    ]
  };
  this.infotree = {
    rid: '0123456789012345678901234567890123456789',
    info: {
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
  };
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
          var r = treeFind(childResource, fn);
          if (r) {
            return r; 
          }
      }
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
};

MockDb.prototype.findResourceInResource = function(resource, fn, callback) {
  var r = treeFind(resource, fn);
  callback(null, r);
};

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
};

MockDb.prototype.findResourceByRID = function(rid, callback) {
  this.findResource(function(r) {
    return r.rid === rid; 
  }, callback);
};

MockDb.prototype.findResourceByRIDInResource = function(resource, rid, callback) {
  this.findResourceInResource(resource, function(r) {
    return r.rid === rid; 
  }, callback);
};

/**
 * Remove one of the resource's children and all its descendants.
 */
MockDb.prototype.dropResource = function(resource, rid, callback) {
  var resourceToDrop = _.find(resource.info.children, function(r) { return r.rid === rid; });
  if (resourceToDrop) {
    resource.info.children.splice(resource.info.children.indexOf(resourceToDrop), 1);
    callback(null, { status: 'ok' });
  } else {
    callback('Resource ' + rid + ' not found');
  }
};

/**
 * Record time series points. Assumes rid and points have
 * been validated as existing, writable, and in the correct format.
 */
MockDb.prototype.record = function(rid, points, callback) {
  if (!_.has(this.series, rid)) {
    return callback(rid + ' not found in series.');
  }
  var series = this.series[rid];
  _.each(points, function(point, i) {
    var pt = _.find(series, function(p) { return p[0] === point[0]; });
    if (pt) {
      // update existing point
      pt[1] = point[1];
    } else {
      // insert new point
      var idx = _.sortedIndex(series, point, function(p) { return p[0]; });
      series.splice(idx, 0, point);
    }
  });
  callback(null);
};

MockDb.prototype.read = function(rid, options, callback) {
  /* options are: 
  {
    starttime: 0,
    endtime: now,
    sort: 'desc',
    limit: 1,
    selection: 'all'
  } */
  if (!_.has(this.series, rid)) {
    return callback(rid + ' not found in series.');
  }
  var series = this.series[rid];

  // filter to points inside the time window starttime - endtime
  var wind = [];
  for (var i = 0; i < series.length; i++) {
    if (series[i][0] > options.endtime) { break; }
    if (series[i][0] >= options.starttime) { wind.push(series[i]); }
  }

  // sort points
  if (options.sort === 'desc') {
    wind.reverse();
  }

  // limit point count
  var limited = wind.slice(0, options.limit);
  
  callback(null, limited);
};

/**
 * Flush (delete) time series points. Assumes rid has
 * been validated as existing and writable.
 */
MockDb.prototype.flush = function(rid, options, callback) {
  if (!_.has(this.series, rid)) {
    return callback(rid + ' not found in series.');
  }
  this.series[rid] = _.reject(this.series[rid], function(p) {
    if (_.has(options, 'newerthan') && p[0] <= options.newerthan &&
        _.has(options, 'olderthan') && p[0] >= options.olderthan) {
      return false;
    }
    if (_.has(options, 'newerthan') && p[0] <= options.newerthan) {
      return false;
    }
    if (_.has(options, 'olderthan') && p[0] >= options.olderthan) {
      return false;
    }
    return true;
  });
  callback(null);
};

/**
 * Create a resource. Assumes parent has
 * been validated as existing and writable.
 */
MockDb.prototype.create = function(resource, parent, callback) {
  parent.info.children.push(resource);
  var type = resource.info.basic.type;
  if (type === 'dataport' || type === 'datarule') {
    this.series[resource.rid] = [];
  }
  callback(null);
};

exports.Db = MockDb;
