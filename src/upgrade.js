// This file handles various upgrade procedures
// when file syntax changes between versions.
// const util = require('./util.js');
// const fs = require('fs');

module.exports = {
  // Takes inputs:
  // fromVersion, which is the version we are upgrading from
  // toVersion, which is the version we are upgrading to
  // files, object containing paths to various json files (settings, etc.)
  // callback, which is callback
  upgrade: function (fromVersion, toVersion, files) {
    // At the moment, not used for anything
    // TODO: delet this?
  }
};
