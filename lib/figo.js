//
// Copyright (c) 2013 figo GmbH
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

// Built-in modules.
const crypto      = require("crypto");
const https       = require("https");
const querystring = require("querystring");
const tls         = require("tls");
const url         = require("url");

// External dependencies.
const clone       = require("clone");
const winston     = require("winston");

// Internal modules.
const models    = require("./models");
const FigoError = require("./errors").FigoError;


const removeTrailingSlash = function(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}


// ### Global configuration.
//
const Config = {
  api: url.parse('https://api.figo.me'),

  // Support legacy way (just api.figo.me) of setting the api_endpoint.
  set api_endpoint(endpoint) {
    endpoint = removeTrailingSlash(endpoint);
    this.api = url.parse(endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`);
  },

  get apiBaseUrl() {
    return removeTrailingSlash(this.api.href);
  },

  userAgent: 'node-figo/' + require('../package.json').version,
};

const RETRIABLE_ERRORS = [
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
];

// Override config, e.g. to use staging evironment.
const setConfig = function(config) {
  const fields = ['api_endpoint', 'userAgent'];

  for (var f of fields) {
    if (config.hasOwnProperty(f)) {
      Config[f] = config[f];
    }
  }
};

// ### HTTPS request object with certificate authentication and enhanced error handling.
//
// Constructor parameters:
//
// - **agent** (`HttpsAgent`) - `HttpsAgent` object
//
// - **path** (`String`) - the URL path on the server
//
// - **method** (`String`) - the HTTP method
//
// - **callback** (`Function`) - callback function with two parameters: `error` and `result`
//
var HttpsRequest = function(agent, path, method, callback) {
  var aborted = false;
  var buffers = [];
  var bufsize = 0;

  const options = {
    method: method,
    hostname: Config.api.hostname,
    port: 443,
    path: removeTrailingSlash(Config.api.path) + path,
    agent: agent
  };

  // Setup https.request object.
  var request = https.request(options, function(response) {

    response.on("data", function(chunk) {
      // Save received chunk of data.
      buffers.push(chunk);
      bufsize += chunk.length;
    });

    response.on("end", function() {
      // Concatenate all chunks into a single buffer.
      var pos = 0;
      var buffer = new Buffer(bufsize);
      for (var i = 0; i < buffers.length; i++) {
        buffers[i].copy(buffer, pos);
        pos += buffers[i].length;
      }
      var result = buffer.toString();

      // Evaluate HTTP response.
      if (this.statusCode >= 200 && this.statusCode < 300) {

        if (!result) {
          return callback(null, null);
        }
        var ext_error = null;
        var ext_result = undefined;

        try {
          ext_result = JSON.parse(result);
        } catch (error) {
          ext_error = new FigoError("json_error", error.message);
        }

        var task_path = path.match(/\/task\/progress\?id\=(.*)/);
        if(task_path != null) {
            if(ext_result.is_erroneous == true) {
                winston.log('info', {'task_id': task_path[1], 'response': result});
            } else {
                winston.log('debug', {'task_id': task_path[1], 'response': result});
            }
        } else {
            winston.log('debug', {'status_code': this.statusCode, 'path': path, 'response': result });
        }
        return callback(ext_error, ext_result);
      }

      try {
          var err = JSON.parse(result);
      } catch (error) {
          err = new FigoError("json_error", error.message);
      }

      winston.log('info', {'status_code': err.status, 'path': path, 'error': err.error });
      if(this.statusCode  == 404) {
        return callback(null, null);
      }
      return callback(new FigoError(err.error));
    });

  });

  // Setup common HTTP headers.
  request.setHeader("Accept", "application/json");
  request.setHeader("User-Agent", Config.userAgent);

  // Setup timeout.
  request.setTimeout(60 * 1000);

  request.on("timeout", function() {
    if (!aborted) {
      aborted = true;
      callback(new FigoError("timeout", "Server connection timed out."));
      request.abort();
    }
  });

  // Setup error handler.
  request.on("error", function(error) {
    if (!aborted) {
      aborted = true;
      callback(new FigoError("socket_error", error.message, error.errno));
      request.abort();
    }
  });

  return request;
};


// ### HTTPS agent object with certificate authentication.
//
var HttpsAgent = function() {
  var agent = new https.Agent();

  // Replace createConnection method with our own certificate authentication method.
  agent.createConnection = function(options) {
    var agent = this;
    var stream = tls.connect(options);

    return stream;
  };

  return agent;
};


// constant for number of attempts allowed to make to API, 1 initial and 2 retries, 3 total
var ALLOWED_NUMBER_OF_ATTEMPTS = 3;

// ### Initialization of https request with a retry count of three.
//
// - **agent** (`HttpsAgent`) - `HttpsAgent` object
//
// - **authorization** (`String`) - encoded authorization in https header
//
// - **contentType** (`String`) - content-type for https header
//
// - **path** (`String`) - the URL path on the server
//
// - **data** (`Object`) - If this parameter is defined, then it will be used as JSON-encoded POST content.
//
// - **method** (`Object`) - HTTP method (GET/POST/PUT/DELETE/etc.).
//
// - **stringify** (`Object`) - stringify function (either querystring.stringify or JSON.stringify).
//
// - **callback** (`Function`) - callback function with two parameters: `error` and `result`
//
var queryWithRetries = function (agent, authorization, contentType, path, data, method, stringify, callback) {
  var numberOfAttempts = 0;
  var query = function () {
    numberOfAttempts++;
    agent.figo_request = new HttpsRequest(agent, path, method, function(error, result) {
      agent.figo_request = null;
      if (error && numberOfAttempts < ALLOWED_NUMBER_OF_ATTEMPTS && RETRIABLE_ERRORS.indexOf(error.errno) > -1)
        return query();
      else
        return callback(error, result);
    });

    if (data) {
      data = stringify(clean(data));
    }

    agent.figo_request.setHeader("Authorization", authorization);
    agent.figo_request.setHeader("Content-Type", contentType);
    agent.figo_request.setHeader("Content-Length", (data ? Buffer.byteLength(data) : 0));

    if (data)
      agent.figo_request.write(data);

    agent.figo_request.end();
  };
  return query();
};

var clean = function (obj) {
  for (var propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined) {
      delete obj[propName];
    }
  }
  return obj;
};

// ### Represents a non user-bound connection to the figo Connect API.
//
// It's main purpose is to let user login via OAuth 2.0.
//
// Constructor parameters:
//
// - **client_id** (`String`) - the client ID
//
// - **client_secret** (`String`) - the client secret
//
// - **redirect_uri** (`String`) - optional redirect URI
//
var Connection = function(client_id, client_secret, redirect_uri) {

  // The agent object is required for persistent HTTPS connection and for certificate checking.
  var agent = new HttpsAgent();

  // Methods:
  //
  // **query_api** - Helper method for making a OAuth 2.0 request.
  //
  // - **path** (`String`) - the URL path on the server
  //
  // - **data** (`Object`) - If this parameter is defined, then it will be used as JSON-encoded POST content.
  //
  // - **method** (`String`) - the HTTP method
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`
  //
  this.query_api = function(path, data, method, callback) {

    return queryWithRetries(
      agent,
      "Basic " + new Buffer(client_id + ":" + client_secret).toString("base64"),
      "application/json",
      path,
      data,
      method,
      JSON.stringify,
      callback
    );
  };

  // **login_url** - Get the URL a user should open in the web browser to start the login process.
  //
  // When the process is completed, the user is redirected to the URL provided to
  // the constructor and passes on an authentication code. This code can be converted
  // into an access token for data access.
  //
  // - **state** (`String`) - this string will be passed on through the complete login
  //       process and to the redirect target at the end. It should be used to
  //       validated the authenticity of the call to the redirect URL.
  //
  // - **scope** (`String`) optional scope of data access to ask the user for, e.g. `accounts=ro`.
  //
  // Returns: the URL to be opened by the user
  //
  this.login_url = function(state, scope) {
    var options = { response_type: "code", client_id: client_id, state: state };
    if (scope) {
      options.scope = scope;
    }
    if (redirect_uri) {
      options.redirect_uri = redirect_uri;
    }
    return Config.apiBaseUrl + "/auth/code?" + querystring.stringify(options);
  };

  // **obtain_access_token** - Exchange authorization code or refresh token for access token.
  //
  // - **authorization_code_or_refresh_token** (`String`) - either the authorization
  //       code received as part of the call to the redirect URL at the end of the
  //       logon process, or a refresh token
  //
  // - **scope** (`String`) optional scope of data access to ask the user for, e.g. `accounts=ro`
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an object with the keys `access_token`, `refresh_token` and
  //       `expires,` as documented in the figo Connect API specification.
  //
  this.obtain_access_token = function(authorization_code_or_refresh_token, scope, callback) {
    // Authorization codes always start with "O" and refresh tokens always start with "R".
    var options = {};
    if (authorization_code_or_refresh_token.charAt(0) === "O") {
      options.grant_type = "authorization_code";
      options.code = authorization_code_or_refresh_token;
      if (redirect_uri) {
        options.redirect_uri = redirect_uri;
      }
    } else if (authorization_code_or_refresh_token.charAt(0) === "R") {
      options.grant_type = "refresh_token";
      options.refresh_token = authorization_code_or_refresh_token;
      if (scope) {
        options.scope = scope;
      }
    }
    this.query_api("/auth/token", options, "POST", callback);
  };

  // **revoke_token** - Revoke refresh token or access token.
  //
  // Note: This action has immediate effect, i.e. you will not be able use that token anymore after this call.
  //
  // - **refresh_token_or_access_token** (`String`) access or refresh token to be revoked
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.revoke_token = function(refresh_token_or_access_token, callback) {
    var options = { token: refresh_token_or_access_token };
    this.query_api("/auth/revoke", options, "POST", callback);
  };

  // **credential_login** - Return a Token dictionary which tokens are used for further API calls.
  //
  // - **username** (`String`) - figo username
  //
  // - **password** (`String`) - figo password
  //
  // - **callback** (`Function`) - callback functions with two parameters: `error` and `result`.
  //       The result parameter is an object with the keys `access_token`, `token_type`, `expires_in`,
  //       `refresh_token` and `scope` as documented in the figo Connect API specification.
  //
  this.credential_login = function(username, password, device_name, device_type, device_udid, scope, callback) {
    var options = { grant_type: "password", username: username, password: password };

    if (device_name)
      options.device_name = device_name;
    if (device_type)
      options.device_type = device_type;
    if (device_udid)
      options.device_udid = device_udid;
    if (scope)
      options.scope = scope;

    this.query_api("/auth/token", options, "POST", callback);
  };

  // **unlock_account** - Reset user password
  //
  // - **username** (`String`) - figo username
  //
  // - **unlock_code** (`Number`) - reset code from the email
  //
  // - **recovery_password** (`String`) - figo Account recovery password
  //
  // - **new_password** (`String`) - new Account password
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.unlock_account = function(username, unlock_code, recovery_password, new_password, callback) {
    var options = { username: username, unlock_code: unlock_code, recovery_password: recovery_password, new_password: new_password };
    this.query_api("/auth/unlock", options, "POST", callback);
  };

  // **create_user** - Create a new figo Account
  //
  // - **name** (`String`) - First and last name
  //
  // - **email** (`String`) - Email address; It must obey the figo username & password policy
  //
  // - **password**  (`String`) - New figo Account password; It must obey the figo username & password policy
  //
  // - **language** (`String`) - Two-letter code of preferred language
  //
  // - **send_newsletter** (`Boolean`) - This flag indicates whether the user has agreed to be contacted by email
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an object with the key `recovery_password` as documented in the figo Connect API specification.
  //
  this.create_user = function(name, email, password, language, send_newsletter, callback) {
    var options = { name: name, email: email, password: password };
    if (language)
      options.language = language;
    options.send_newsletter = typeof send_newsletter === "boolean" ? send_newsletter : null;

    this.query_api("/auth/user", options, "POST", callback);
  };

    // **get_catalog_banks** - Get a list of all supported banks
//
// - **country_code** (`String`) - optional country code the bank comes from
//
// - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
//       The result parameter is an array
//
    this.get_banks = function(country_code, callback) {
        if(typeof country_code != "undefined" && country_code != null) {
            this.query_api("/catalog/banks/" + country_code, null, "GET", callback);
        } else {
            this.query_api("/catalog/banks", null, "GET", callback);
        }
    };


// **get_catalog_services** - Get a list of all supported services
//
// - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
//       The result parameter is an array
//
    this.get_services = function(callback) {
        this.query_api("/catalog/services", null, "GET", callback);
    };

};

// **forgot_password** - Start forgot password process
//
// - **username** (`String`) - Username for the figo user who forgot his password
//
// - **callback** (`Function`) - callback function with one parameter: `error`
//
this.forgot_password = function(username, callback) {
  this.query_api("/auth/forgot", username, "POST", callback);
};

// **resend_unlock_code** - Re-send unlock code
//
// - **username** (`String`) - The figo Account email address
//
// - **callback** (`Function`) - callback function with one parameter: `error`
//
this.resend_unlock_code = function(username, callback) {
  this.query_api("/auth/user/resend_unlock_code", username, "POST", callback);
};




// ### Represents a user-bound connection to the figo Connect API and allows access to the user's data.
//
// Constructor parameters:
//
// - **access_token** (`String`) - the access token
//
var Session = function(access_token) {

  // The agent object is required for persistent HTTPS connection and for certificate checking.
  var agent = new HttpsAgent();

  // Methods:

  // **query_api** - Helper method for making a REST request.
  //
  // - **path** (`String`) - the URL path on the server
  //
  // - **data** (`Object`) - If this parameter is defined, then it will be used as JSON-encoded POST content.
  //
  // - **method** (`String`) - the HTTP method
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`
  //
  this.query_api = function(path, data, method, callback) {
    return queryWithRetries(
      agent,
      "Bearer " + access_token,
      "application/json",
      path,
      data,
      method,
      JSON.stringify,
      callback
    );
  };

  this.query_api_object = function(session, entity_type, path, data, method, collection_name, callback) {
    this.query_api(path, data, method, function(error, result) {
      if (error) {
        return callback(error);
      }
      if (!result) {
        return callback(null, null);
      }
      if (collection_name == null) {
        return callback(null, new entity_type(session, result));
      }
      return callback(null, result[ collection_name ].map(function (entry) {
        return new entity_type(session, entry);
      }));
    })
  }

  // **get_user** - Get the current figo Account
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `User` object
  //
  this.get_user = function(callback) {
    this.query_api_object(this, models.User, "/rest/user", null, "GET", null, callback);
  }

  // **resend_verification** - Re-send verification email
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.resend_verification = function(callback) {
    this.query_api("/rest/user/resend_verification", null, "POST", callback);
  };

  // **modify_user** - Modify figo Account
  //
  // - **user** (`User`) - modified user object to be saved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `User` object
  //
  this.modify_user = function(user, callback) {
    this.query_api_object(this, models.User, "/rest/user", user.dump(), "PUT", null, callback);
  }

  // **remove_user** - Delete figo Account
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`.
  //
  this.remove_user = function(callback) {
    this.query_api("/rest/user", null, "DELETE", callback);
  }

  // **get_accounts** - Retrieve list of accounts.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Account` objects, one for each account the user has granted the app access.
  //
  this.get_accounts = function(callback) {
    this.query_api_object(this, models.Account, "/rest/accounts", null, "GET", "accounts", callback);
  };

  // **get_accesses** - Retrieve list of accesses.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Access` objects.
  //
  this.get_accesses = function(callback) {
    this.query_api_object(this, models.Access, "/rest/accesses", null, "GET", "accesses", callback);
  };

  // **get_access** - Retrieve the details of a specific provider access identified by its ID.
  //
  // - **access_id** (`String`) - figo ID of the provider access.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Access` objects.
  //
  this.get_access = function(access_id, callback) {
    this.query_api_object(this, models.Access, "/rest/accesses/" + access_id, null, "GET", null, callback);
  };

  // **add_access** - Create a new provider access.
  //
  // - **access_method_id** (`String`) - figo ID of the provider access method.
  //
  // - **account_identifier** (`AccountIdentifier`) - an AccountIdentifier.
  //
  //            - **id** (`String`) - IBAN or AccountNumber or PAN.
  //
  //            - **currency** (`String`) - Three-letter currency code.
  //
  // - **credentials** (`Object`) - Credentials used for authentication with the financial service provider.
  //
  //            - **property name** (`String`)
  //
  // - **save_credentials** (`Boolean`) - Indicates whether your customer agreed to save static credentials.
  //
  // - **consent** (`Consent`) - Configuration of the PSD2 consents. Is ignored for non-PSD2 accesses.
  //
  //            - **recurring** (`Boolean`) - Indicates whether the consent is for an ongoing use-case.
  //
  //            - **period** (`Integer`) - Specify the period in days for which the consent is valid. Ignored if recurring is set to false.
  //
  //            - **scopes** (`Array`) - Define scope of the consent.
  //
  //            - **expires_at** (`Date`) - The date at which the consent expires.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Account` objects, one for each account the user has granted the app access.
  //
  this.add_access = function(access_method_id, account_identifier, credentials, save_credentials, consent, callback) {
    var options = { access_method_id: access_method_id };
    if (account_identifier)
      options.account_identifier = [account_identifier];
    if (credentials)
      options.credentials = credentials;
    if (save_credentials)
      options.save_credentials = save_credentials;
    if (consent)
      options.consent = consent;

      this.query_api_object(this, models.Access, "/rest/accesses", options, "POST", null, callback);
  };

  // **add_sync** - Start provider synchronization.
  //
  // - **access_id** (`String`) - figo ID of the provider access.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Sync` objects.
  //
  this.add_sync = function(access_id, callback) {
    this.query_api_object(this, models.Sync, "/rest/accesses/" + access_id + "/syncs", {}, "POST", null, callback);
  };

  // **get_sync** - Get synchronization.
  //
  // - **access_id** (`String`) - figo ID of the provider access.
  //
  // - **sync_id** (`String`) - figo ID of synchronization operation.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Access` objects.
  //
  this.get_sync = function(access_id, sync_id, callback) {
    this.query_api_object(this, models.Access, "/rest/accesses/" + access_id + "/syncs/" + sync_id, null, "GET", null, callback);
  };

  // **get_account** - Retrieve specific account.
  //
  // - **account_id** (`String`) - ID of the account to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Account` object.
  //
  this.get_account = function(account_id, callback) {
    this.query_api_object(this, models.Account, "/rest/accounts/" + account_id, null, "GET", null, callback);
  };

  // **remove_account** - Remove an account
  //
  // - **account** (`Account`) - account to be removed
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.remove_account = function(account, callback) {
    this.query_api("/rest/accounts/" + account.account_id, null, "DELETE", callback);
  }

  // **get_account_balance** - Get balance and account limits
  //
  // - **account_id** (`String`) - ID of the account to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `AccountBalance` object.
  //
  this.get_account_balance = function(account_id, callback) {
    this.query_api_object(this, models.AccountBalance, "/rest/accounts/" + account_id + "/balance", null, "GET", null, callback);
  }

  // **get_bank** - Retrieve bank
  //
  // - **bank_id** (`String`) - ID of the bank to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Bank` object.
  //
  this.get_bank = function(bank_id, callback) {
    this.query_api_object(this, models.Bank, "/rest/banks/" + bank_id, null, "GET", null, callback);
  }

  // **modify_bank** - Modify a bank
  //
  // - **bank** (`Bank`) - modified bank object to be saved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Bank` object.
  //
  this.modify_bank = function(bank, callback) {
    this.query_api_object(this, models.Bank, "/rest/banks/" + bank.bank_id, bank.dump(), "PUT", null, callback);
  }

  // **remove_bank_pin** - Remove the stored PIN for a bank (if there was one)
  //
  // - **bank** (`Bank`) - bank whose pin should be removed
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.remove_bank_pin = function(bank, callback) {
    this.query_api("/rest/banks/" + bank.bank_id + "/remove_pin", null, "POST", callback);
  }

  // **add_account** - Set up a new bank account
  //
  // - **country** (`String`) - Two-letter country code
  //
  // - **credentials** (`Array`) - List of login credential strings
  //
  // - **bank_code** (`String`) - Bank code (will be overriden if IBAN provided)
  //
  // - **iban** (`String`) - IBAN
  //
  // - **save_pin** (`Boolean`) - This flag indicates whether the user has chosen to save the PIN on the figo Connect server
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The `result` parameter contains a task token.
  //
  this.add_account = function(country, credentials, bank_code, iban, save_pin, callback) {
    var data = {"country": country, "credentials": credentials};
    if (iban) {
      data.iban = iban;
    } else if (bank_code) {
      data.bank_code = bank_code;
    }
    data.save_pin = typeof save_pin === "boolean" ? save_pin : false;
    this.query_api_object(this, models.TaskToken, "/rest/accounts", data, "POST", null, callback);
  };

  // **get_supported_payment_services** - Retrieve list of supported banks, credit cards, other payment services
  //
  // - **country_code** (`String`) - the country code the service comes from
  //
  // - **service** (`String`) - filter the type of service to request (optional): `banks`, `services` or everything (default)
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The `result` parameter contains a list services.
  //
  this.get_supported_payment_services = function(country_code, service, callback) {
    switch (service) {
      case "banks":
        //this.query_api("/rest/catalog/banks/" + country_code, null, "GET", callback);
        this.query_api_object(this, models.Service, "/rest/catalog/banks/" + country_code, null, "GET", null, callback);
        break;
      case "services":
        //this.query_api("/rest/catalog/services/" + country_code, null, "GET", callback);
        this.query_api_object(this, models.Service, "/rest/catalog/services/" + country_code, null, "GET", null, callback);
        break;
      default:
        //this.query_api("/rest/catalog/" + country_code, null, "GET", callback);
        this.query_api_object(this, models.Service, "/rest/catalog/" + country_code, null, "GET", null, callback);
    }
  };

  // **get_login_settings** - Retrieve login settings for a bank or service
  //
  // - **country_code** (`String`) - the country the service comes from
  //
  // - **item_id** (`String`) - bank code
  //
  this.get_login_settings = function(country_code, item_id, callback) {
    this.query_api_object(this, models.LoginSettings, "/rest/catalog/banks/" + country_code + "/" + item_id, null, "GET", null, callback);
  };

  // **get_security** - Retrieve a security.
  //
  // - **account_id** (`String`) - ID of the account the security belongs to
  //
  // - **security_id** (`String`) - ID of the security to retrieve
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a single security object.
  //
  this.get_security = function(account_id, security_id, callback) {
    this.query_api_object(this, models.Security, "/rest/accounts/" + account_id + "/securities/" + security_id, null, "GET", null, callback);
  };

  // **get_securities** - Retrieve securities of one or all accounts.
  //
  // - **options** (`Object`) - further options (all are optional)
  //
  //     - **account_id** (`String`) - ID of the account for which to retrieve the securities
  //
  //     - **accounts** (`Array`) - filter the securities to be only from these accounts
  //
  //     - **since** (`Date`) - ISO date filtering the returned securities by their creation or last modification date
  //
  //     - **since_type** (`String`) - defines hot the `since` will be interpreted: `traded`, `created` or `modified`
  //
  //     - **count** (`Number`) - limit the number of returned transactions
  //
  //     - **offset** (`Number`) - offset into the implicit list of transactions
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Security` objects.
  //
  this.get_securities = function(options, callback) {
    options = options == null ? {} : clone(options);
    if (typeof options.since !== "undefined")
      options.since = typeof options.since === "object" ? options.since.toISOString() : options.since;
    options.count = typeof options.count === "undefined" ? 1000 : options.count;
    options.offset = typeof options.offset === "undefined" ? 0 : options.offset;
    if (typeof options.account_id === "undefined") {
      this.query_api_object(this, models.Security, "/rest/securities?" + querystring.stringify(options), null, "GET", 'securities', callback);
    } else {
      var account_id = options.account_id;
      delete options.account_id;
      this.query_api_object(this, models.Security, "/rest/accounts/" + account_id + "/securities?" + querystring.stringify(options), null, "GET", "securities", callback);
    }
  };

  // **modify_security** - Modify a security.
  //
  // - **account_id** (`String`) - ID of the account the security belongs to
  //
  // - **security_id** (`String`) - ID of the security to change
  //
  // - **visited** (`Boolean`) - a bit showing whether the user has already seen this security or not
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.modify_security = function(account_id, security_id, visited, callback) {
    this.query_api("/rest/accounts/" + account_id + "/securities/" + security_id, {"visited": visited}, "PUT", callback);
  };

  // **modify_securities** - Modify securities of one or all accounts.
  //
  // - **visited** (`Boolean`) - a bit showing whether the user has already seen these securities or not
  //
  // - **account_id** (`String`) - ID of the account securities belongs to (optional)
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.modify_securities = function(visited, account_id, callback) {
    if (account_id) {
      this.query_api("/rest/accounts/" + account_id + "/securities", {"visited": visited}, "PUT", callback);
    } else {
      this.query_api("/rest/securities", {"visited": visited}, "PUT", callback);
    }
  };

  // **get_transactions** - Retrieve list of transactions.
  //
  // - **options** (`Object`) - further options
  //
  //     - **since** (`String`, `Date`) - This field can either be a transaction ID or a date.
  //
  //     - **count** (`Number`) - Limit the number of returned transactions.
  //
  //     - **offset** (`Number`) - which offset into the result set should be used to determin the first transaction to return (useful in combination with count)
  //
  //     - **include_pending** (`Boolean`) - This flag indicates whether pending transactions should be included
  //          in the response; pending transactions are always included as a complete set, regardless of
  //          the field `since`.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Transaction` objects, one for each transaction of the user.
  //
  this.get_transactions = function(options, callback) {
    options = options == null ? {} : clone(options);
    if (typeof options.since !== "undefined")
      options.since = typeof options.since === "object" ? options.since.toISOString() : options.since;
    options.count = typeof options.count === "undefined" ? 1000 : options.count;
    options.offset = typeof options.offset === "undefined" ? 0 : options.offset;
    options.include_pending = options.include_pending ? 1 : 0;

    if (typeof options.account_id === "undefined") {
      this.query_api_object(this, models.Transaction, "/rest/transactions?" + querystring.stringify(options), null, "GET", 'transactions', callback);
    } else {
      var account_id = options.account_id;
      delete options.account_id;

      this.query_api_object(this, models.Transaction, "/rest/accounts/" + account_id + "/transactions?" + querystring.stringify(options), null, "GET", 'transactions', callback);
    }
  };

  // **modify_transaction** - Modify a specific transaction.
  //
  // - **account_id (`String`) - ID of the account the transaction belongs to
  //
  // - **transaction_id (`String`) - ID of the transaction to change
  //
  // - **visited** (`Boolean`) - a bit showing whether the user has already seen this transaction or not
  //
  // - **callback** (`Function`) - a callback function with one parameter: `error`
  //
  this.modify_transaction = function(account_id, transaction_id, visited, callback) {
    this.query_api_object(this, models.Transaction, "/rest/accounts/" + account_id + "/transactions/" + transaction_id, {"visited": visited}, "PUT", null, callback);
  };

  // **modify_transactions** - Modify all transactions of one or all accounts.
  //
  // - **visited** (`Boolean`) - a bit showing whether the user has already seen these transactions or not
  //
  // - **account_id (`String`) - ID of the account transactions belongs to (optional)
  //
  // - **callback** (`Function`) - a callback function with one parameter: `error`
  //
  this.modify_transactions = function(visited, account_id, callback) {
    if (account_id) {
      this.query_api("/rest/accounts/" + account_id + "/transactions", {"visited": visited}, "PUT", callback);
    } else {
      this.query_api("/rest/transactions", {"visited": visited}, "PUT", callback);
    }
  };

  // **delete_transaction** - Remove specific transaction.
  //
  // - **account_id (`String`) - ID of the account the transaction belongs to
  //
  // - **transaction_id (`String`) - ID of the transaction to delete
  //
  // - **callback** (`Function`) - a callback function with one parameter: `error`
  //
  this.delete_transaction = function(account_id, transaction_id, callback) {
    this.query_api("/rest/accounts/" + account_id + "/transactions/" + transaction_id, null, "DELETE", callback);
  };

  // **get_standing_order** - Retreive a specific standing order.
  //
  // - **standing_order_id** (`String`) - ID of standing order to retreive
  //
  // - **cents** (`Boolean`) - whether to show the balance in cents (optional)
  //
  // - **callback** (`Function`) - a callback function with two parameters: `error` and `result`;
  //       The `result` parameter is a single `standing_order` object.
  //
  this.get_standing_order = function(standing_order_id, cents, callback) {
    cents = typeof cents === "boolean" ? cents : false;
    this.query_api_object(this, models.StandingOrder, "/rest/standing_orders/" + standing_order_id, null, "GET", null, callback);
  };

  // **get_standing_orders** - Get all standing orders.
  //
  // - **cents** (`Boolean`) - whether to show the balance in cents (optional)
  //
  // - **callback** (`Function`) - a callback function with two parameters: `error` and `result`;
  //       The `result` parameter is a list of `standing_order` objects.
  //
  this.get_standing_orders = function(cents, callback) {
    cents = typeof cents === "boolean" ? cents : false;
    this.query_api_object(this, models.StandingOrder, "/rest/standing_orders", null, "GET", "standing_orders", callback);
  }

  // **get_sync_url** - Retrieve the URL a user should open in the web browser to start the synchronization process.
  //
  // - **redirect_uri** (`String`) - The user will be redirected to this URL after the sync process completes.
  //
  // - **state** (`String`) - This string will be passed on through the complete synchronization process
  //       and to the redirect target at the end. It should be used to validated the authenticity of
  //       the call to the redirect URL.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the URL to be opened by the user.
  //
  this.get_sync_url = function(redirect_uri, state, callback) {
    this.query_api("/rest/sync", {redirect_uri: redirect_uri, state: state}, "POST", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, Config.apiBaseUrl + "/task/start?id=" + result.task_token);
      }
    });
  };

  // **get_notifications** - Retrieve list of registered notifications.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Notification` objects, one for each registered notification.
  //
  this.get_notifications = function(callback) {
    this.query_api_object(this, models.Notification, "/rest/notifications", null, "GET", 'notifications', callback);
  };

  // **get_notification** - Retrieve specific notification.
  //
  // - **notification_id** (`String`) - ID of the notification to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Notification` object for the respective notification.
  //
  this.get_notification = function(notification_id, callback) {
    this.query_api_object(this, models.Notification, "/rest/notifications/" + notification_id, null, "GET", null, callback);
  };

  // **add_notification** - Register notification.
  //
  // - **notification** (`Notification`) - new notification to be created. It should have no notification_id set
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the newly created `Notification` object.
  //
  this.add_notification = function(notification, callback) {
    this.query_api_object(this, models.Notification, "/rest/notifications", notification.dump(), "POST", null, callback);
  };

  // **modify_notification** - Modify notification.
  //
  // - **notification** (`Notification`) - modified notification object
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the modified `Notification` object.
  //
  this.modify_notification = function(notification, callback) {
    this.query_api_object(this, models.Notification, "/rest/notifications/" + notification.notification_id, notification.dump(), "PUT", null, callback);
  };

  // **remove_notification** - Unregister notification.
  //
  // - **notification** (`Notification`) - notification object which should be deleted
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.remove_notification = function(notification, callback) {
    this.query_api("/rest/notifications/" + notification.notification_id, null, "DELETE", callback);
  };

  // **get_payments** - Retrieve all payments (on all or one account)
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Payment` objects
  //
  this.get_payments = function(account_id, callback) {
    if (account_id == null) {
      this.query_api_object(this, models.Payment, "/rest/payments", null, "GET", 'payments', callback);
    } else {
      this.query_api_object(this, models.Payment, "/rest/accounts/" + account_id + "/payments", null, "GET", 'payments', callback);
    }
  };

  // **get_payment** - Retrieve a specific payment.
  //
  // - **account_id** (`String`) - ID of the account on which the payment is to be found
  //
  // - **payment_id** (`String`) - ID of the payment to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Payment` object for the respective payment.
  //
  this.get_payment = function(account_id, payment_id, callback) {
    this.query_api_object(this, models.Payment, "/rest/accounts/" + account_id + "/payments/" + payment_id, null, "GET", null, callback);
  };

  // **get_payment_proposals** - Retrieve payment proposals.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter contains array of dictionaries for the different payment partners.
  //
  this.get_payment_proposals = function(callback) {
    this.query_api("/rest/address_book", null, "GET", callback);
  };

  // **add_payment** - Submit a new payment
  //
  // - **payment** (`Payment`) - new payment to be created. It should have no payment_id set
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the newly created `Payment` object.
  //
  this.add_payment = function(payment, callback) {
    this.query_api_object(this, models.Payment, "/rest/accounts/" + payment.account_id + "/payments", payment.dump(), "POST", null, callback);
  };

  // **modify_payment** - Modify payment.
  //
  // - **payment** (`Payment`) - modified payment object
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the modified `Payment` object.
  //
  this.modify_payment = function(payment, callback) {
    this.query_api_object(this, models.Payment, "/rest/accounts/" + payment.account_id + "/payments/" + payment.payment_id, payment.dump(), "PUT", null, callback);
  };

  // **remove_payment** - Delete payment.
  //
  // - **payment** (`Payment`) - payment object which should be deleted
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.remove_payment = function(payment, callback) {
    this.query_api("/rest/accounts/" + payment.account_id + "/payments/" + payment.payment_id, null, "DELETE", callback);
  };

  // **submit_payment** - Submit payment to bank server
  //
  // - **payment** (`Payment`) - payment to be submitted
  //
  // - **tan_scheme_id** (`String`) - TAN scheme ID of user-selected TAN scheme
  //
  // - **state** (`String`) - Any kind of string that will be forwarded in the callback response message
  //
  // - **redirect_uri** (`String`) - At the end of the submission process a response will be sent to this callback URL
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the URL to be opened by the user.
  //
  this.submit_payment = function(payment, tan_scheme_id, state, redirect_uri, callback) {
    params = {tan_scheme_id: tan_scheme_id, state: state}
    if (redirect_uri !== null)
      params.redirect_uri = redirect_uri;

    this.query_api("/rest/accounts/" + payment.account_id + "/payments/" + payment.payment_id + "/submit", params, "POST", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, Config.apiBaseUrl + "/task/start?id=" + result.task_token);
      }
    });
  };

  // **start_task** - Start communication with bank server.
  //
  // - **task_token** (`Object`) - Task token object from the initial request
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.start_task = function(task_token, callback) {
    this.query_api("/task/start?id=" + task_token.task_token, null, "GET", callback);
  };

  // **get_task_state** - Poll the task progress.
  //
  // - **task** (`Object`) - Task object
  //
  // - **options** (`Object`) - further options (optional)
  //
  //     - **pin** (`Boolean`) - submit PIN
  //
  //     - **continue** (`Boolean`) - this flag signals to continue after an error condition or to skip a PIN or challenge-response entry
  //
  //     - **save_pin** (`Boolean`) - this flag indicates whether the user has chosen to save the PIN on the figo Connect server
  //
  //     - **response** (`Boolean`) - submit response to challenge
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a TaskState object which represents the current status of the task.
  //
  this.get_task_state = function(task, options, callback) {
    options = options == null ? {} : options;
    options.id = task.task_token;
    if (typeof options.pin !== "undefined")
      options.save_pin = typeof options.save_pin === "undefined" ? 0 : options.save_pin;
    options.continue = typeof options.continue === "undefined" ? 0 : options.continue;

    this.query_api_object(this, models.TaskState, "/task/progress?id=" + task.task_token, options, "POST", null, callback);
  };

  // **cancel_task** - Cancel a task.
  //
  // - **task_token** (`Object`) - Task token object
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.cancel_task = function(task_token, callback) {
    this.query_api_object(this, models.TaskToken, "/task/cancel?id=" + task_token.task_token, null, "POST", null, callback);
  };

  // **start_process** - Begin process.
  //
  // - **process_token** (`Object`) - Process token object
  //
  // - **callback** (`Function`) - callback function with one parameter: `error`
  //
  this.start_process = function(process_token, callback) {
    this.query_api("/process/start?id=" + process_token.process_token, null, "GET", callback);
  };

  // **create_process** - Create a process.
  //
  // - **proc** (`Object`) - Process object
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a ProcessToken object of a newly created process.
  //
  this.create_process = function(proc, callback) {
    this.query_api_object(this, models.ProcessToken, "/client/process", proc.dump(), "POST", null, callback);
  };

};




// Exported symbols.
module.exports = {
  Account:               models.Account,
  AccountBalance:        models.AccountBalance,
  Transaction:           models.Transaction,
  StandingOrder:         models.StandingOrder,
  Security:              models.Security,
  SynchronizationStatus: models.SynchronizationStatus,
  Notification:          models.Notification,
  Service:               models.Service,
  LoginSettings:         models.LoginSettings,
  User:                  models.User,
  Payment:               models.Payment,
  Bank:                  models.Bank,
  Credential:            models.Credential,
  TaskToken:             models.TaskToken,
  TaskState:             models.TaskState,
  Challenge:             models.Challenge,
  ProcessToken:          models.ProcessToken,
  Process:               models.Process,
  Config:                Config,
  Connection:            Connection,
  Session:               Session,
  setConfig:             setConfig
};
