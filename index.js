'use strict';

var BlockApps = require('./lib/blockapps');

exports.initialize = function(dataSource, cb) {
  var settings = dataSource.settings;
  var connector = new BlockApps(settings);
  dataSource.connector = connector;
};
