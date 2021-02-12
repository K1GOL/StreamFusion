// This file handles various upgrade procedures
// when file syntax changes between versions.
const util = require('./util.js');
const fs = require('fs');

module.exports = {
  // Takes inputs:
  // fromVersion, which is the version we are upgrading from
  // toVersion, which is the version we are upgrading to
  // files, object containing paths to various json files (settings, etc.)
  // callback, which is callback
   upgrade: function(fromVersion, toVersion, files) {
      // files is an object taking values:
      // customColorFile

      // Handle color files format change in 1.1.2 => 1.1.3
      if(!util.semVerGreaterThan(fromVersion, '1.1.3'))
      {
        let colorData = JSON.parse(fs.readFileSync(files.customColorFile))
        // Prevent modification multiple times
        if(colorData.colors)
        {
          return;
        }

        fs.unlinkSync(files.customColorFile);
        // Create a color scheme file with the color data
        let jsonTemplate_c = {
          customColorScheme: {
            name: 'Custom color scheme',
            id: 'customColorScheme',
            colors: colorData
          }
        }
        fs.writeFile(files.customColorFile, JSON.stringify(jsonTemplate_c), 'utf8', function (err) {
          if (err) {
              console.error(err);
          }
        });
      }
   }
}
