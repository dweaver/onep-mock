/** 
 * Partial implementation of One Platform RPC.
 */
'use strict';
var _ = require('underscore');

var db = require('./db');
var Db = new db.Db();

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
 * Look up argument
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
  // make a call on behalf of resource,
  // and call callback.
  switch (call.procedure) {
    case 'info':  
      rid = getRidForArg(call.arguments[0], resource);
      if (!rid) {
        return callback('Alias lookup failed for ' + JSON.stringify(call.arguments[0]));
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
      
      Db.findResourceByRIDInResource(resource, rid, function(error, target_resource) {
        if (error) { return callback(error); }
        if (!target_resource) {
          callback('Failed to find resource ' + rid + ' in ' + resource.rid);
        } else {
          callback(null, {
            status: 'ok',
            result: filterInfo(target_resource.info, options)
          });
        }
      });
      break;
    case 'listing':
      var type_list = call.arguments[0];
      // ignored for now
      options = call.arguments[1];
      if (!(_.keys(options).length === 0 ||
          (_.keys(options).length === 1 && 
          options.owned === true))) {
        callback('listing only supports option "owned"');
      }
      var result = {};
      if (_.has(resource.info, 'children')) {
        _.each(type_list, function(typ) {
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
            callback('lookup alias only supports self');
          }
          break;
        default:
          callback('lookup only supports "alias"');
          break;
      }
      break;

    case 'create':
      var type = call.arguments[0];
      var desc = call.arguments[1];
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
      resource.info.children.push(newResource);
      callback(null, {
              status: 'ok',
              result: rid
      });
      break;

    case 'drop':
      rid = getRidForArg(call.arguments[0], resource);
      if (!rid) {
        return callback('Alias lookup failed for ' + JSON.stringify(call.arguments[0]));
      }
      Db.dropResource(resource, rid, function(err) {
        if (err) { return callback(err); }
        callback(null, { status: 'ok' });
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
      console.log('Error in call: ', error);
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
};

/**
 * Make an RPC request.
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
