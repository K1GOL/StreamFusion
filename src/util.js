// Has various utility functions

module.exports = {
   semVerGreaterThan: function(ver1, ver2) {
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
   }
}
