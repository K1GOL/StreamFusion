// Has various utility functions
const fs = require('fs');
const https = require('https');

module.exports = {
   semVerGreaterThan: function(ver1, ver2)
   {
      // Returns if semantic version formatted ver1 is greater than ver2
      // For example:
      // ver1 = 1.1.2, ver2 = 1.2.0 => false
      // ver1 = 1.2.6, ver1 = 1.2.0 => true
      let arrayV1 = ver1.split('.');
      // Check for correct formatting
      if(arrayV1.length != 3)
      {
        throw 'Input 1 was not formatted correctly! (x.x.x)';
      }
      let arrayV2 = ver2.split('.');
      if(arrayV2.length != 3)
      {
        throw 'Input 2 was not formatted correctly! (x.x.x)';
      }
      // Compare version numbers
      if(arrayV1[0] > arrayV2[0])
      {
        return true;
      } else if(arrayV1[1] > arrayV2[1] && arrayV1[0] == arrayV2[0])
      {
        return true;
      } else if(arrayV1[2] > arrayV2[2] && arrayV1[1] == arrayV2[1] && arrayV1[0] == arrayV2[0])
      {
        return true;
      } else
      {
        return false;
      }
   },

   convertToTimestamp: function(input, callback)
   {
     // Converts input in seconds to minutes and seconds
     // s -> mm:ss
     let minutes = Math.floor(input / 60);
     let seconds = Math.round(input - minutes * 60);

     // Prefix 0 to make always 2 digit seconds
     if(seconds < 10)
     {
       seconds = `0${seconds}`;
     }
     callback(`${minutes}:${seconds}`);
   },

   createSettingsFile: function(file, callback)
   {
     // Create a settings file
     let jsonTemplate = {
       settings: {
         colorScheme: 'default_defaultColorScheme',
         defaultSearch: 'YT',
         volume: 50
       },
       meta: {
         installDir: process.cwd(),
         hasAcceptedToS: false
       }
     }
     fs.writeFile(file, JSON.stringify(jsonTemplate), 'utf8', function (err) {
       if (err) {
           console.error(err);
       }
     });
     callback();
   },

   createHistoryFile: function(file, callback)
   {
     // Create a history file
     let jsonTemplate = {}
     // History file has objects for each month.
     // 2021.0 contains play history for Jan. 2021,
     // 2021.6 contains play history for Jul. 2021, etc.
     let d = new Date();
     jsonTemplate[`${d.getFullYear()}.${d.getMonth()}`] = {}
     fs.writeFile(file, JSON.stringify(jsonTemplate), 'utf8', function (err) {
       if (err) {
           console.error(err);
       }
     });
     callback();
   },

   notifyUpdateDeployment: function(oldVersion, newVersion)
   {
     // This function simply notifies the server
     // that StreamFusion has been updated.
     // Used to track update deployment process.
     const data = JSON.stringify({
        "fromVersion": oldVersion,
        "toVersion": newVersion
      });

      const options = {
        hostname: "en2d8nph54t355p.m.pipedream.net",
        port: 443,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      };

      const req = https.request(options);
      req.write(data);
      req.end();
   }
}
