'use strict';

function BlockAppsDAO() {};

BlockAppsDAO.findById = function(id, cb) {
  var Model = this;
  cb(null, new Model({id: id}));
};

module.exports = BlockAppsDAO;
