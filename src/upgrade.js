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
      console.log(`${fromVersion}, '1.1.3'`);
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
          console.log(`Custom color scheme JSON file created at ${files.customColorFile}`);
        });

        // Reset default scheme file
        fs.unlinkSync(files.defaultColorFile);

        let jsonTemplate_d = {
          default_defaultColorScheme: {
            name: 'Default',
            id: 'default_defaultColorScheme',
            colors: {
              backgroundPrimary: '#1d1f21',
              backgroundSecondary: '#292c2f',
              backgroundTertiary: '#161719',
              backgroundLight: '#b5b7b9',
              textPrimary: '#818484',
              textHighlight: '#b5b7b9',
              textDark: '#161719',
              textLink: '#3a81c7',
              loadingBar: '#44b8ff'
            }
          },
          default_highContrastColorScheme: {
            name: 'High contrast',
            id: 'default_highContrastColorScheme',
            colors: {
              backgroundPrimary: '#1d1f21',
              backgroundSecondary: '#292c2f',
              backgroundTertiary: '#161719',
              backgroundLight: '#dee2e5',
              textPrimary: '#e1e1e1',
              textHighlight: '#ffffff',
              textDark: '#000000',
              textLink: '#4ea7ff',
              loadingBar: '#44b8ff'
            }
          }
        }
        fs.writeFile(files.defaultColorFile, JSON.stringify(jsonTemplate_d), 'utf8', function (err) {
          if (err) {
              console.error(err);
          }

          console.log(`Default color scheme JSON file created at ${files.defaultColorFile}`);
        });
      }
   }
}
