// retrieve string that matches regex
var _getFromProcessArgs = function (str) {
  var arr = process.argv;
  for (var i = 0, len = arr.length; i < len; i++) {
    if (arr[i].match(RegExp(str))) {
      return arr[i].substr(arr[i].indexOf("=") + 1);
    }
  }
  return null;
};

var getEndpointFromProcessArgs = function () {
  var host         = process.env.HOST         || _getFromProcessArgs("--host=");
  var fingerprints = process.env.FINGERPRINTS || _getFromProcessArgs("--fingerprints=");
  var access_token = process.env.ACCESS_TOKEN || _getFromProcessArgs("--access_token=");
  if (host && fingerprints && access_token) {
    return {
      host: host,
      fingerprints: fingerprints,
      access_token: access_token,
    };
  }
  return null;
};

module.exports = {
  getEndpointFromProcessArgs: getEndpointFromProcessArgs,
};
