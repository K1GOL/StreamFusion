// Has various utility functions
const fs = require('fs');

module.exports = {
  semVerGreaterThan: function (ver1, ver2) {
    // Returns if semantic version formatted ver1 is greater than ver2
    // For example:
    // ver1 = 1.1.2, ver2 = 1.2.0 => false
    // ver1 = 1.2.6, ver1 = 1.2.0 => true
    const arrayV1 = ver1.split('.');
    // Check for correct formatting
    if (arrayV1.length !== 3) {
      throw new Error('Input 1 was not formatted correctly! (x.x.x)');
    }
    const arrayV2 = ver2.split('.');
    if (arrayV2.length !== 3) {
      throw new Error('Input 2 was not formatted correctly! (x.x.x)');
    }
    // Compare version numbers
    if (arrayV1[0] > arrayV2[0]) {
      return true;
    } else if (arrayV1[1] > arrayV2[1] && arrayV1[0] === arrayV2[0]) {
      return true;
    } else if (arrayV1[2] > arrayV2[2] && arrayV1[1] === arrayV2[1] && arrayV1[0] === arrayV2[0]) {
      return true;
    } else {
      return false;
    }
  },

  convertToTimestamp: function (input, callback) {
    // Converts input in seconds to minutes and seconds
    // s -> mm:ss
    const minutes = Math.floor(input / 60);
    let seconds = Math.round(input - minutes * 60);

    // Prefix 0 to make always 2 digit seconds
    if (seconds < 10) {
      seconds = `0${seconds}`;
    }
    callback(`${minutes}:${seconds}`); // eslint-disable-line
  },

  createSettingsFile: function (file, callback) {
    // Create a settings file
    const jsonTemplate = {
      settings: {
        colorScheme: 'default_defaultColorScheme',
        defaultSearch: 'YT',
        volume: 50,
        overlayEnabled: true
      },
      meta: {
        installDir: process.cwd(),
        hasAcceptedToS: false
      }
    };
    fs.writeFile(file, JSON.stringify(jsonTemplate), 'utf8', function (err) {
      if (err) {
        console.error(err);
      }
    });
    callback();
  },

  createHistoryFile: function (file, callback) {
    // Create a history file
    const jsonTemplate = {};
    // History file has objects for each month.
    // 2021.0 contains play history for Jan. 2021,
    // 2021.6 contains play history for Jul. 2021, etc.
    const d = new Date();
    jsonTemplate[`${d.getFullYear()}.${d.getMonth()}`] = {};
    fs.writeFile(file, JSON.stringify(jsonTemplate), 'utf8', function (err) {
      if (err) {
        console.error(err);
      }
    });
    callback();
  }
};
