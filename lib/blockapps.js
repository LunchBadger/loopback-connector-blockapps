'use strict';

var debug = require('debug')('loopback:connector:blockapps');
var blockapps = require('blockapps-js');
var fs = require('fs');
var _ = require('lodash');

var BlockAppsDAO = require('./dao');

var METHOD_CALL_FORMAT = {
  args: 'object',
  txParams: {
    value: Number,
    gasPrice: Number,
    gasLimit: Number,
  },
};

function BlockApps(settings) {
  this.name = 'BlockApps';

  if (settings.profile) {
    debug('setting profile to ' + settings.profile.name +
          ' @ ' + settings.profile.url);
    blockapps.setProfile(settings.profile.name, settings.profile.url);
  }
}

BlockApps.prototype.DataAccessObject = BlockAppsDAO;

BlockApps.prototype.define = function(modelData) {
  var settings = modelData.settings.blockchain;
  var model = modelData.model;
  var privateKey = model.getDataSource().settings.privateKey;

  // all models must have an ID property, and we want this model to have a
  // String ID property
  model.defineProperty('id', {type: String, id: true});

  getSolidityContract(settings, function(err, solObj) {
    if (err) {
      console.error(err.toString());
      return;
    }

    var argNames = getArgNames(solObj.xabi.constr);

    debug('mixing in constructor(' + _.join(argNames, ', ') + ')');
    model.construct = function(data, cb) {
      var argValues = argNames.map(function(name) { return data.args[name]; });
      debug('executing constr(' + _.join(argValues, ', ') + ')');

      solObj.construct
        .apply(solObj, argValues)
        .txParams(data.txParams || blockapps.ethbase.Transaction.defaults)
        .callFrom(privateKey)
        .then(function(solObj) {
          cb && cb(null, {id: solObj.account.address});
        })
        .catch(function(err) {
          cb && cb(err);
        });
    };

    setRemoting(model.construct, {
      description: 'Create a new contract instance',
      accepts: {arg: 'data', type: METHOD_CALL_FORMAT, http: {source: 'body'}},
      returns: {arg: 'results', type: 'object', root: true},
      http: {verb: 'post', 'path': '/'},
    });

    defineMethods(model, solObj);
  });
};

function getSolidityContract(settings, cb) {
  if (settings.contract) {
    debug('loading detached contract from file: ' + settings.contract);
    cb(null, attachContractFromFile(settings.contract));
  } else if (settings.sources) {
    debug('loading contract from sources: ', _.join(settings.sources, ', '));
    var sources = _.fromPairs(
      settings.sources.map(function(src) { return [src, undefined]; }));

    blockapps.Solidity({
      main: sources,
    }).then(function(solObj) {
      var found = false;

      _.values(solObj).map(function(fileContents) {
        if (fileContents[settings.main]) {
          found = true;
          cb(null, fileContents[settings.main]);
        }
      });

      if (!found) {
        cb(new Error('cannot find contract "' + settings.main + '"'));
      }
    }).catch(function(err) {
      cb(err);
    });
  } else {
    cb(new Error('blockchain settings must have either: ' +
                 '"sources" or "contract"'));
  }
}

function attachContractFromFile(fileName) {
  var strData = fs.readFileSync(fileName, {encoding: 'utf-8'});
  var data = JSON.parse(strData);
  return blockapps.Solidity.attach(data);
}

function defineMethods(model, solObj) {
  for (var funcName in solObj.xabi.funcs) {
    if (!solObj.xabi.funcs.hasOwnProperty(funcName)) {
      continue;
    }

    var funcSpec = solObj.xabi.funcs[funcName];
    createMethod(model, funcName, funcSpec, solObj);
  }
};

function createMethod(model, funcName, funcSpec, solObj) {
  var argNames = getArgNames(funcSpec.args);

  debug('mixing in method ' + funcName + '(' + _.join(argNames, ', ') + ')');

  model.prototype[funcName] = function(data, cb) {
    var address = this.id;
    var privateKey = this.getDataSource().settings.privateKey;
    var argValues = argNames.map(function(name) { return data.args[name]; });
    debug('executing ' + address + '/' + funcName + '(' +
          _.join(argValues, ', ') + ')');

    // Create a "detached" Solidity object, but with an address. This causes
    // Solidity.attach() to generate an object that can execute methods on the
    // contract.
    var copy = {
      bin: solObj.bin,
      xabi: solObj.xabi,
      name: solObj.name,
      address: address,
    };
    var solObjInst = blockapps.Solidity.attach(copy);

    solObjInst.state[funcName]
      .apply(solObjInst.state, argValues)
      .txParams(data.txParams || blockapps.ethbase.Transaction.defaults)
      .callFrom(privateKey)
      .then(function(result) {
        cb && cb(null, result);
      })
      .catch(function(err) {
        cb && cb(err);
      });
  };

  model.remoteMethod(funcName, {
    description: 'Call the ' + funcName + ' contract method',
    accepts: {arg: 'data', type: METHOD_CALL_FORMAT, http: {source: 'body'}},
    returns: {arg: 'results', type: 'object', root: true},
    http: {verb: 'post', 'path': '/' + funcName},
    isStatic: false,
  });
}

function setRemoting(fn, options) {
  options = options || {};
  for (var opt in options) {
    if (options.hasOwnProperty(opt)) {
      fn[opt] = options[opt];
    }
  }
  fn.shared = true;
}

function getArgNames(funcSpec) {
  var argPairs = _.toPairs(funcSpec);
  return _.sortBy(argPairs, function(i) { return i[1].index; })
          .map(function(i) { return i[0]; });
}

module.exports = BlockApps;
