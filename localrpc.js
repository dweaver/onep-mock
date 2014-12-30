/** 
 * Partial implementation of One Platform RPC.
 */
'use strict';
var _ = require('underscore');

var db = require('./db');
var Db = new db.Db();

var RIDRE = /[a-fA-F0-9]{40}/;

// set STRICT to true to look more exactly like 1P 
// (e.g. not include messages in errors)
var STRICT = false;

function authenticate(auth, callback) {
  Db.findResourceByAuth(auth, callback);
}

/**
 * Generate an RID
 *
 * @returns {String} - random identifier
 */
function makeid() {
  var text = "";
  var possible = "abcdef0123456789";
  for( var i=0; i < 40; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Get the servers current timestamp (seconds since epoch)
 */
function getServerTimestamp() {
  return Math.round(new Date().getTime() / 1000);
}

/* convert a set of points to the resource's native format */
function convertFormat(resource, points) {
  points = _.map(points, function(p) {
    switch(resource.info.description.format) {
      case 'integer':
        if (typeof p[1] === 'string') {
          p[1] = parseInt(p[1]);
          if (_.isNaN(p[1])) {
            // if a string doesn't parse, 1P sets it to 1.
            p[1] = 1;
          }
        }
        p[1] = Math.floor(p[1]);
        break;
      case 'float':
        if (typeof p[1] === 'string') {
          p[1] = parseFloat(p[1]);
          if (_.isNaN(p[1])) {
            // if a string doesn't parse, 1P sets it to 1.
            p[1] = 1.0;
          }
        }
        break;
      default:
        // string
        p[1] = p[1] + '';
        break;
    }
    return p;
  });  
  return points;
}

/**
 * Record points to the database, handling format conversion and enforcing 
 * resource-specific things.
 */
function record(resource, rid, points, callback) {
  Db.findResourceByRIDInResource(resource, rid, function(err, targetResource) {
    if (err) { return callback(err); }
    if (!targetResource) {
      err = {
        status: 'restricted'
      };
      if (!STRICT) {
        err.error = {
          message: 'Failed to find resource ' + rid + ' in ' + resource.rid
        };
      }
      callback(err);
    } else {
      points = convertFormat(targetResource, points);
      Db.record(rid, points, function(err) {
        callback(err);
      });
    }
  });
}

/**
 * Look up argument. Returns RID string or error object.
 */
function getRidForArg(arg, resource) {
  if (typeof arg === 'string') {
    return arg;
  } else {
    if (_.has(arg, 'alias')) {
      if (arg.alias === '') {
        return resource.rid;
      }
      if (_.has(resource.info, 'aliases')) {
        var rids = _.keys(resource.info.aliases);
        for (var i = 0; i < rids.length; i++) {
          var rid = rids[i];
          if (_.contains(resource.info.aliases[rid], arg.alias)) {
            return rid;
          } 
        }
      }
    }
  } 
  var err = {
    status: 'invalid'
  };
  if (!STRICT) {
    err.error = {
      message: 'Alias lookup failed for ' + JSON.stringify(arg)
    };
  }
  return err;
}

/** 
 * Validate a description argument.
 */
function validateDescription(description, type) {
  function validateFormat(description) {
    if (!_.has(description, 'format')) { return 'invalid: missing "format"'; }
    var formats = ['float', 'integer', 'string'];
    if (!_.contains(formats, description.format)) { 
      return 'invalid: format must be in ' + JSON.stringify(formats); 
    }
    return description;
  }
  switch(type) {

    case 'client':
      // http://docs.exosite.com/rpc/#create-client 
      _.defaults(description, {
        limits: {},
        locked: false,
        meta: "",
        name: "",
        public: false 
      });
      _.defaults(description.limits, {
        client: 0,
        dataport: 0,
        datarule: 0,
        disk: 0,
        dispatch: 0,
        email: 0,
        email_bucket: 0,
        http: 0,
        http_bucket: 0,
        share: 0,
        sms: 0,
        sms_bucket: 0,
        xmpp: 0,
        xmpp_bucket: 0
      });
      description = _.pick(description, ['limits', 'locked', 'meta', 'name', 'public']);
      break;

    case 'dataport':
      // http://docs.exosite.com/rpc/#create-dataport
      description = validateFormat(description);
      if (typeof description !== 'object') {
        return description;
      }
      _.defaults(description, {
        meta: "",
        name: "",
        preprocess: [],
        public: false,
        retention: {},
        subscribe: null
      });
      _.defaults(description.retention, {
        count: "infinity",
        duration: "infinity"
      });
      description = _.pick(description, ['format', 'meta', 'name', 'preprocess', 'public', 'retention', 'subscribe']);
      break;

    case 'datarule':
      // http://docs.exosite.com/rpc/#create-datarule
      description = validateFormat(description);
      if (typeof description !== 'object') {
        return description;
      }
      if (!_.has(description, 'rule')) { return 'missing "rule"'; }
      var rules = _.keys(description.rule);
      if (rules.length !== 1) { return 'wrong number of rules'; }
      if (!_.contains(['simple', 'timeout', 'interval', 'duration', 'count', 'script'], rules[0])) {
        return 'unrecognized rule ' + rules[0];
      } 
      if (rules[0] === 'script' && typeof description.rule.script !== 'string') {
        return '"script" rule must be a string'; 
      }
      // TODO: validate simple datarules
      _.defaults(description, {
        meta: "",
        name: "",
        preprocess: [],
        public: false,
        retention: {},
        subscribe: null
      });
      _.defaults(description.retention, {
        count: "infinity",
        duration: "infinity"
      });
      description = _.pick(description, ['format', 'meta', 'name', 'preprocess', 'public', 'retention', 'subscribe']);
      
      break;
    case 'dispatch':
      break;
    case 'clone':
      return 'create clone is not supported';
    default:
      return 'unrecognized create type ' + type;
  }
  return description;
}

function makeCall(call, resource, callback) {
  function filterInfo(info, options) {
    if (options.length === 0) {
      return info;
    }
    var inf = {};
    _.each(supported_attrs, function(attr) {
      if (options[attr]) { 
        inf[attr] = info[attr];
      }
    });
    return inf;
  }
  var options = null;
  var rid = null;
  var alias = null;
  var now = null;
  var desc = null;
  // make a call on behalf of resource,
  // and call callback.
  switch (call.procedure) {

    case 'info':  
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      options = call.arguments[1];
      var supported_attrs = ['description', 'basic', 'key', 'aliases', 'subscribers', 'shares', 'tags'];
      if (_.isEmpty(options)) {
        options = _.object(_.map(supported_attrs, function(a) { return [a, true]; }));
      }
      var unsupported = _.filter(_.keys(options), function(a) {
        return !_.contains(supported_attrs, a); 
      });
      if (unsupported.length > 0) {
        callback('info does not support any of ' + JSON.stringify(unsupported) + '. Only these: ' + JSON.stringify(supported_attrs));
      }
      
      Db.findResourceByRIDInResource(resource, rid, function(error, targetResource) {
        if (error) { return callback(error); }
        if (!targetResource) {
          var err = {
            status: 'restricted'
          };
          if (!STRICT) {
            err.error = {
              message: 'Failed to find resource ' + rid + ' in ' + resource.rid
            };
          }
          callback(err);
        } else {
          callback(null, {
            status: 'ok',
            result: filterInfo(targetResource.info, options)
          });
        }
      });
      break;

    case 'listing':
      var typeList = call.arguments[0];
      var supportedTypes = ['client', 'dataport', 'datarule', 'dispatch'];
      var unsupportedTypes = _.filter(typeList, function(t) {
        return !_.contains(supportedTypes, t); 
      });
      if (unsupportedTypes.length > 0) {
        // invalid
        return callback('listing does not support types ' + 
          JSON.stringify(unsupportedTypes) + '. Only these: ' + 
          JSON.stringify(supportedTypes));
      }

      options = call.arguments[1];
      if (!(_.keys(options).length === 0 ||
          (_.keys(options).length === 1 && 
          options.owned === true))) {
        callback('listing only supports option "owned"');
      }
      var result = {};
      if (_.has(resource.info, 'children')) {
        _.each(typeList, function(typ) {
          result[typ] = _.pluck(
            _.filter(resource.info.children, function(r) { return r.info.basic.type === typ; }),
            'rid');
        });
      }
      callback(null, {
        status: 'ok',
        result: result
      });
      break;
    
    case 'lookup':
      var thing = call.arguments[0];
      var id = call.arguments[1];
      switch (thing) {
        case 'alias':
        case 'aliased':
          if (id === '') {
            callback(null, {
              status: 'ok',
              result: resource.rid
            });
          } else {
            rid = getRidForArg({alias: id}, resource);
            if (typeof rid !== 'string') {
              return callback(rid);
            }
            callback(null, {
              status: 'ok',
              result: rid
            });
          }
          break;
        default:
          callback('lookup only supports "alias"');
          break;
      }
      break;

    case 'update':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      if (rid === resource.rid) {
        // resource can't update itself
        return callback({status: 'restricted'});
      }
      desc = call.arguments[1];
      Db.findResourceByRIDInResource(resource, rid, function(error, targetResource) {
        if (error) { return callback(error); }
        if (!targetResource) {
          return callback(null, {status: 'invalid'});
        }
        var aliases = resource.info.aliases;
        targetResource.info.description = _.extend(targetResource.info.description, desc);
        callback(null, { status: 'ok' }); 
      });
      
      break;

    case 'create':
      var type = call.arguments[0];
      desc = call.arguments[1];
      desc = validateDescription(desc, type);
      if (typeof desc !== 'object') {
        // here's where the platform gives you the error 'invalid'
        callback(desc);
      }
      var info = {
        basic: {
          type: type,
          modified: Math.round(new Date().getTime() / 1000),
          status: 'activated',
          subscribers: 0 
        },  
        tags: [],
        shares: [],
        subscribers: [],
        description: desc
      };
      rid = makeid();
      var newResource = {
        rid: rid,
        info: info
      }; 
      if (type === 'client') {
        newResource.info.children = [];
        newResource.info.key = makeid();
        newResource.info.aliases = [];
      }
      Db.create(newResource, resource, function(err) {
        if (err) { return callback(err); }
        callback(null, {
                status: 'ok',
                result: rid
        });
      });
      break;

    case 'drop':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      Db.dropResource(resource, rid, function(err) {
        if (err) { return callback(err); }
        callback(null, { status: 'ok' });
      });
      break;

    case 'map':
      if (call.arguments[0] !== 'alias') {
        return callback('first argument to map must be "alias"');
      }
      rid = call.arguments[1];
      alias = call.arguments[2];

      if (!rid.match(RIDRE)) {
        return callback('second argument to map doesn\'t look like an RID. Instead it\'s: ' + call.arguments[1]);
      }

      // alias should not already be mapped in this resource
      var alreadyMappedRid = getRidForArg({alias: alias}, resource);
      if (typeof alreadyMappedRid === 'string') {
        return callback({status: 'invalid'});
      }

      Db.findResourceByRIDInResource(resource, rid, function(error, targetResource) {
        if (error) { return callback(error); }
        if (!targetResource) {
          return callback(null, {status: 'invalid'});
        }
        var aliases = resource.info.aliases;
        if (_.has(aliases, rid)) {
          if (!_.contains(aliases[rid], alias)) {
            aliases[rid].push(alias);
          }
        } else {
          aliases[rid] = [alias];
        }
        callback(null, { status: 'ok' }); 
      });
      
      break;

    case 'unmap':
      if (call.arguments[0] !== 'alias') {
        return callback('first argument to unmap must be "alias"');
      }
      alias = call.arguments[1];
      var aliases = resource.info.aliases;
      _.each(aliases, function(aliasList, rid) {
        var idx = aliasList.indexOf(alias);
        if (idx !== -1) {
          // remove the alias
          aliasList.splice(idx, 1); 
        }
      });
      // Note: 1P returns OK status if alias doesn't exist
      callback(null, {status: 'ok'});
      break; 

    case 'write':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      var value = call.arguments[1];
      now = getServerTimestamp();
      points = [[now, value]];
      record(resource, rid, points, function(err) {
        if (err) { return callback(err); }
        return callback(null, {status: 'ok'});
      });
      break;

    case 'record':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      var points = call.arguments[1];
      // third argument seems to be ignored by 1P, so we don't look at it.
      now = getServerTimestamp();
      points = _.map(points, function(p) {
        if (p[0] < 0) {
          return [now + p[0], p[1]];
        } else {
          return p;
        }
      });
      record(resource, rid, points, function(err) {
        if (err) { return callback(err); }
        return callback(null, {status: 'ok'});
      });
      break;

    case 'read':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      now = getServerTimestamp();
      options = _.defaults(call.arguments[1], {
        starttime: 0,
        endtime: now,
        sort: 'desc',
        limit: 1,
        selection: 'all'
      });
      if (options.selection !== 'all') {
        return callback('"' + options.selection + '" is not supported by the mock server for the read command, only "all"');
      }
      Db.read(rid, options, function(err, points) {
        if (err) { return callback(err); }
        return callback(null, {
          status: 'ok',
          result: points
        });
      });
      
      break; 

    case 'flush':
      rid = getRidForArg(call.arguments[0], resource);
      if (typeof rid !== 'string') {
        return callback(rid);
      }
      options = call.arguments[1];

      Db.flush(rid, options, function(err) {
        if (err) { return callback(err); }
        return callback(null, {
          status: 'ok'
        });
      });
      break;

    default:
      throw 'Mock server does not support procedure ' + call.procedure;
  }  
}

/**
 * Callback for responding to a 1P RPC call
 *
 * @callback callCallback
 * @param {string} err - error message for individual call failure
 * @param {object} response - RPC call response object (may be an error)
 */

/**
 * Makes a single RPC call, e.g., read, create
 *
 * @param {object} call - call itself
 * @param {object} caller - 1P resource call is made on behalf of
 * @param {callCallback} callback - 
 */
function call(call, caller, callback) {
  var response = null;
  makeCall(call, caller, function(error, response) {
    if (error) { 
      if (typeof error === 'object') {
        response = error;
      } else {
        response = {
          status: 'fail',
          error: {
            code: 500,
            message: error
          }
        };
      } 
    }
    if (call.hasOwnProperty('id')) {
      response.id = call.id;
    } 
    callback(null, response);
  });
}

/**
 * Callback for responding to a request
 *
 * @callback requestCallback
 * @param {string} err - error message for individual call failure
 * @param {object} response - RPC response body object
 */

/**
 * Make an RPC request.
 *
 * @param {object} body - request body
 * @param {requestCallback} callback
 *
 */
exports.request = function(body, callback) {
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
  
  var required = ['auth', 'calls'];
  for (var i = 0; i < required.length; i++) {
    if (!_.has(body, required[i])) {
      return callback(null, {
        "error": { 
          "code": 400, 
          "message": "Invalid request",
          "context": required[i]
        }
      });
    }
  }

  authenticate(body.auth, function(err, caller) {
    if (err) { return callback(err); }
    if (caller === null) {
      return callback(null, {
        "error": {
          "code": 401,
          "message": "Authorization failed"
      }});
    }
    for (var i = 0; i < body.calls.length; i++) {
      call(body.calls[i], caller, collectResponse);
    }
    callback(null, overallError === null ? localResponses : overallError);
  });
};
