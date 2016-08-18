// retrieve string that matches regex
var _contains = function (arr, str) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (arr[i].match(RegExp(str))) {
      return arr[i].substr(arr[i].indexOf("=") + 1);
    }
  }
  return false;
};

var endpointWasSet = function () {
  var host         = process.env.HOST         || _contains(process.argv, "--host=");
  var fingerprints = process.env.FINGERPRINTS || _contains(process.argv, "--fingerprints=");
  var access_token = process.env.ACCESS_TOKEN || _contains(process.argv, "--access_token=");
  if (host && fingerprints && access_token) {
    return {
      host: host,
      fingerprints: fingerprints,
      access_token: access_token,
    };
  }
  return false;
};

module.exports = {
  endpointWasSet: endpointWasSet,
};
