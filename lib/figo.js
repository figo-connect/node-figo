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

var https       = require("https");
var tls         = require("tls");
var querystring = require("querystring");
var models      = require("./models");


// ### Global configuration.
// 
var Config = {
  // figo Connect server hostname.
  api_endpoint:  "api.leanbank.com",

  // figo Connect SSL/TLS certificate fingerprints.
  valid_fingerprints: [ "A6:FE:08:F4:A8:86:F9:C1:BF:4E:70:0A:BD:72:AE:B8:8E:B7:78:52",
                        "AD:A0:E3:2B:1F:CE:E8:44:F2:83:BA:AE:E4:7D:F2:AD:44:48:7F:1E" ]
};


// ### Base object for all errors transported via the figo Connect API
// 
// Constructor parameters:
// 
// - **error** (`String`) - the error code
// 
// - **error_description** (`String`) - the error description
// 
var Error = function(error, error_description) {
  this.error = error;
  this.error_description = error_description;
};

Error.prototype.toString = function() {
  return this.error_description;
}


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

  var options = {
    method: method,
    hostname: Config.api_endpoint,
    port: 443,
    path: path,
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
          callback(null, {});
        } else {
          try {
            callback(null, JSON.parse(result));
          } catch (error) {
            callback(new Error("json_error", error.message));
          }
        }
      } else if (this.statusCode === 400) {
        try {
          var err = JSON.parse(result);
          callback(new Error(err.error, err.error_description));
        } catch (error) {
          callback(new Error("json_error", error.message));
        }
      } else if (this.statusCode === 401) {
        callback(new Error("unauthorized", "Missing, invalid or expired access token."));
      } else if (this.statusCode === 403) {
        callback(new Error("forbidden", "Insufficient permission."));
      } else if (this.statusCode === 404) {
        callback(null, null);
      } else if (this.statusCode === 405) {
        callback(new Error("method_not_allowed", "Unexpected request method."));
      } else if (this.statusCode === 503) {
        callback(new Error("service_unavailable", "Exceeded rate limit."));
      } else {
        callback(new Error("internal_server_error", "We are very sorry, but something went wrong."));
      }
    });

  });

  // Setup common HTTP headers.
  request.setHeader("Accept", "application/json");
  request.setHeader("User-Agent", "node-figo");

  // Setup timeout.
  request.setTimeout(60 * 1000);

  request.on("timeout", function() {
    if (!aborted) {
      aborted = true;
      callback(new Error("timeout", "Server connection timed out."));
      request.abort();
    }
  });

  // Setup error handler.
  request.on("error", function(error) {
    if (!aborted) {
      aborted = true;
      if (request.figo_ssl_error) {
        callback(new Error("ssl_error", "SSL/TLS certificate fingerprint mismatch."));
      } else {
        callback(new Error("socket_error", error.message));
      }
      request.abort();
    }
  });

  return request;
};


// ### HTTPS agent object with certificate authentication.
// 
var HttpsAgent = function() {
  var agent = new https.Agent({ hostname: Config.api_endpoint, port: 443 });

  // Replace createConnection method with our own certificate authentication method.
  agent.createConnection = function(options) {
    var agent = this;
    var stream = tls.connect(options);

    stream.on("secureConnect", function() {
       var certificate = stream.getPeerCertificate();
       if (!certificate || !certificate.fingerprint || Config.valid_fingerprints.indexOf(certificate.fingerprint) === -1) {
         agent.figo_request.figo_ssl_error = true;
         agent.figo_request.abort();
       }
    });

    return stream;
  };

  return agent;
}


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
  
  // **query_api** - Helper method for making a OAuth 2.0 request.
  // 
  // - **path** (`String`) - the URL path on the server
  // 
  // - **data** (`Object`) - If this parameter is defined, then it will be used as JSON-encoded POST content.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`
  // 
  this.query_api = function(path, data, callback) {
    if (agent.figo_request) {
      callback(new Error("sdk_error", "Each `Connection` object can only send one API request at the same time."));
    } else {
      var request = new HttpsRequest(agent, path, "POST", function(error, result) {
        agent.figo_request = null;
        callback(error, result);
      });
      agent.figo_request = request;

      if (data) {
        data = querystring.stringify(data);
      }

      request.setHeader("Authorization", "Basic " + new Buffer(client_id + ":" + client_secret).toString("base64"));
      request.setHeader("Content-Type", "application/x-www-form-urlencoded");
      request.setHeader("Content-Length", (data ? data.length.toString() : "0"));

      if (data) {
        request.write(data);
      }
      request.end();
    }
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
    return "https://" + Config.api_endpoint + "/auth/code?" + querystring.stringify(options);
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
    this.query_api("/auth/token", options, callback);
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
    this.query_api("/auth/revoke?" + querystring.stringify(options), callback);
  };

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
    if (agent.figo_request) {
      callback(new Error("sdk_error", "Each `Session` object can only send one API request at the same time."));
    } else {
      var request = new HttpsRequest(agent, path, method, function(error, result) {
        agent.figo_request = null;
        callback(error, result);
      });
      agent.figo_request = request;

      if (data) {
        data = JSON.stringify(data);
      }
      request.setHeader("Authorization", "Bearer " + access_token);
      request.setHeader("Content-Type", "application/json");
      request.setHeader("Content-Length", (data ? data.length.toString() : "0"));

      if (data) {
        request.write(data);
      }
      request.end();
    }
  };

  // **get_accounts** - Request list of accounts.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Account` objects, one for each account the user has granted the app access.
  // 
  this.get_accounts = function(callback) {
    var session = this;
    this.query_api("/rest/accounts", null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else {
        var accounts = result["accounts"].map(function(account) {
          return new models.Account(session, account);
        });
        callback(null, accounts);
      }
    });
  };

  // **get_account** - Request specific account.
  // 
  // - **account_id** (`String`) - ID of the account to be retrieved
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Account` object.
  // 
  this.get_account = function(account_id, callback) {
    var session = this;
    this.query_api("/rest/accounts/" + account_id, null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else if (!result) {
        callback(null, null);
      } else {
        callback(null, new models.Account(session, result));
      }
    });
  };

  // **get_transactions** - Request list of transactions.
  // 
  // - **options** (`Object`) - further options
  // 
  //     - **since** (`String`, `Date`) - This field can either be a transaction ID or a date.
  // 
  //     - **start_id** (`String`) - Do only return transactions which were booked after the start transaction ID.
  // 
  //     - **count** (`Number`) - Limit the number of returned transactions.
  // 
  //     - **include_pending** (`Boolean`) - This flag indicates whether pending transactions should be included
  //          in the response; pending transactions are always included as a complete set, regardless of
  //          the field `since`.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Transaction` objects, one for each transaction of the user.
  // 
  this.get_transactions = function(options, callback) {
    var session = this;
    if (!options) {
      options = {};
    }
    if (typeof options.since === "object") {
      options.since = options.since.toISOString();
    }
    if (typeof options.count === "undefined") {
      options.count = 1000;
    }
    options.include_pending = (options.include_pending ? 1 : 0);
    this.query_api("/rest/transactions?" + querystring.stringify(options), null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else {
        var transactions = result["transactions"].map(function(transaction) {
          return new models.Transaction(session, transaction);
        });
        callback(null, transactions);
      }
    });
  };

  // **get_sync_url** - Request the URL a user should open in the web browser to start the synchronization process.
  // 
  // - **redirect_uri** (`String`) - The user will be redirected to this URL after the sync process completes.
  // 
  // - **state** (`String`) - This string will be passed on through the complete synchronization process
  //       and to the redirect target at the end. It should be used to validated the authenticity of
  //       the call to the redirect URL.
  // 
  // - **options** (`Object`) - further options
  // 
  //     - **disable_notifications** (`Booleon`) - This flag indicates whether notifications should be sent.
  // 
  //     - **if_not_synced_since** (`Number`) - If this parameter is set, only those accounts will be
  //         synchronized, which have not been synchronized within the specified number of minutes.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the URL to be opened by the user.
  // 
  this.get_sync_url = function(redirect_uri, state, options, callback) {
    if (!options) {
      options = {};
    }
    options.redirect_uri = redirect_uri;
    options.state = state;
    this.query_api("/rest/sync", options, "POST", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, "https://" + Config.api_endpoint + "/task/start?id=" + result.task_token);
      }
    });
  };

  // **get_notifications** - Request list of registered notifications.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Notification` objects, one for each registered notification.
  // 
  this.get_notifications = function(callback) {
    var session = this;
    this.query_api("/rest/notifications", null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else {
        var notifications = result["notifications"].map(function(notification) {
          return new models.Notification(session, notification);
        });
        callback(null, notifications);
      }
    });
  };

  // **get_notification** - Request specific notification.
  // 
  // - **notification_id** (`String`) - ID of the notification to be retrieved
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Notification` object for the respective notification.
  // 
  this.get_notification = function(notification_id, callback) {
    var session = this;
    this.query_api("/rest/notifications/" + notification_id, null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else if (!result) {
        callback(null, null);
      } else {
        callback(null, new models.Notification(session, result));
      }
    });
  };

  // **add_notification** - Register notification.
  // 
  // - **observe_key** (`String`) - one of the notification keys specified in the figo Connect API specification
  // 
  // - **notify_url** (`String`) - Notification messages will be sent to this URL.
  // 
  // - **state** (`String`) - any kind of string that will be forwarded in the notification message
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is the newly created `Notification` object.
  // 
  this.add_notification = function(observe_key, notify_uri, state, callback) {
    var session = this;
    var options = { observe_key: observe_key, notify_uri: notify_uri, state: state };
    this.query_api("/rest/notifications", options, "POST", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, new models.Notification(session, result));
      }
    });
  };

  // **modify_notification** - Modify notification.
  // 
  // - **notification** (`Notification`) - modified notification object
  // 
  // - **callback** (`Function`) - callback function with one parameter: `error` and `result`;
  //       The result parameter is the modified `Notification` object.
  // 
  this.modify_notification = function(notification, callback) {
    var options = { observe_key: notification.observe_key, notify_uri: notification.notify_uri, state: notification.state };
    this.query_api("/rest/notifications/" + notification.notification_id, options, "PUT", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, notification);
      }
    });
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

};


// Exported symbols.
module.exports = {
  AccountType:           models.AccountType,
  TransactionType:       models.TransactionType,
  Account:               models.Account,
  AccountBalance:        models.AccountBalance,
  Transaction:           models.Transaction,
  SynchronizationStatus: models.SynchronizationStatus,
  Notification:          models.Notification,
  Config:                Config,
  Connection:            Connection,
  Session:               Session
};
