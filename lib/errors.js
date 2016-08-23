// ### Base object for all errors transported via the figo Connect API
//
// Constructor parameters:
//
// - **error** (`String`) - the error code
//
// - **error_description** (`String`) - the error description
//
var FigoError = function(error, error_description, errno) {
  Error.captureStackTrace(this, FigoError);

  this.name = 'FigoError';
  this.error = error;
  this.message = this.error_description = error_description;
  this.errno = errno;
};
FigoError.prototype = Object.create(Error.prototype);
FigoError.prototype.constructor = FigoError;
FigoError.prototype.toString = function() {
  return this.error_description;
};

module.exports = {
  FigoError: FigoError
};
