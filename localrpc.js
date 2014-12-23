/** 
 * Partial implementation of One Platform RPC.
 */
'use strict';
var _ = require('underscore');

var db = require('./db');
var Db = new db.Db();

exports.authenticate = function(auth, callback) {
  Db.findResourceByAuth(auth, callback);
}

/**
 * Look up argument
 */
function ridForArg(arg, resource) {
  if (typeof arg === 'string') {
    return arg;
  } else {
    if (_.has(arg, 'alias')) {
      if (arg.alias === '') {
        return resource.rid;
      }
      if (_.has(resource, 'aliases')) {
        _.each(resource.aliases, function(aliases, rid) {
          if (_.contains(aliases, arg.alias)) {
            return rid;
          } 
        });
      }
    }
  } 
}

function make_call(call, resource, callback) {
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
  // make a call on behalf of resource,
  // and call callback.
  switch (call.procedure) {
    case 'info':  
      var rid = ridForArg(call.arguments[0], resource);
      if (!rid) {
        callback('Alias lookup failed for ' + JSON.stringify(call.arguments[0]));
      }
      var options = call.arguments[1];
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
        if (error) callback(error)
        else {
          if (!target_resource) {
            callback('Failed to find resource ' + rid + ' in ' + resource.rid);
          } else {
            callback(null, {
              status: 'ok',
              result: filterInfo(target_resource.info, options)
            });
          }
        }
      });
      break;
    case 'listing':
      var type_list = call.arguments[0];
      // ignored for now
      var options = call.arguments[1];
      if (!(_.keys(options).length === 0 
            || (_.keys(options).length === 1 && 
                options.owned === true))) {
        callback('listing only supports option "owned"');
      }
      var result = {};
      if (_.has(resource.info, 'children')) {
        _.each(type_list, function(typ) {
          console.log('resource.info.children:', resource.info.children);
          result[typ] = _.pluck(
            _.filter(resource.info.children, function(r) { console.log('r:', r); return r.info.basic.type === typ }),
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
          break
      }
      break;
    default:
      throw 'Mock server does not support procedure ' + call.procedure;
  }  
}

exports.call = function(call, caller, callback) {
  var response = null;
  var rid = caller.rid;
  Db.findResourceByRID(rid, function(error, resource) {
    if (error) callback(error)
    else {
      make_call(call, resource, function(error, response) {
        if (error) { return callback(error); }
        if (call.hasOwnProperty('id')) {
          response.id = call.id;
        } 
        callback(null, response);
      });
    } 
  });
}
