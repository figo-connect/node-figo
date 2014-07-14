node-figo [![Build Status](https://secure.travis-ci.org/figo-connect/node-figo.png)](https://travis-ci.org/figo-connect/node-figo) [![npm version]http://img.shields.io/npm/v/figo.svg](https://www.npmjs.org/package/figo)
=========

Node.js bindings for the figo Connect API: http://docs.figo.io

Usage
=====

First, you've to install the package:

```bash
npm install -g figo
```

Now you can create a new session and access data:

```javascript
var figo = require("figo");
var async = require("async");

var session = new figo.Session("ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ");

// Print out list of account numbers and balances.
session.get_accounts(function(error, accounts) {
  if (!error) {
    async.mapSeries(accounts, function(account, callback) {
      account.get_balance(callback);
    }, function(error, balances) {
      for (var i = 0; i < accounts.length; i++) {
        console.log(accounts[i].account_number);
        console.log(balances[i].balance);
      }

      // Print out the list of all transaction originators/recipients of a specific account.
      session.get_account("A1.1", function(error, account) {
        if (!error) {
          account.get_transactions(null, function(error, transactions) {
            if (!error) {
              for (var i = 0; i < transactions.length; i++) {
                console.log(transactions[i].name);
              }
            }
          });
        }
      });

    });
  }
});
```

It is just as simple to allow users to login through the API:

```javascript
var figo = require("figo");
var open = require("open");

var connection = new figo.Connection("<client ID>", "<client secret>", "http://my-domain.org/redirect-url");

var start_login = function() {
  // Open webbrowser to kick of the login process.
  open(connection.login_url("qweqwe"));
};

var process_redirect = function(authorization_code, state) {
  // Handle the redirect URL invocation from the initial start_login call.

  // Ignore bogus redirects.
  if (state !== "qweqwe") {
    return;
  }

  // Trade in authorization code for access token.
  var token_dict = connection.obtain_access_token(authorization_code, null, function(error, token_dict) {
    if (!error) {

      // Start session.
      var session = new figo.Session(token_dict["access_token"]);

      // Print out list of account numbers.
      session.get_accounts(function(error, accounts) {
        if (!error) {
          for (var i = 0; i < accounts.length; i++) {
            console.log(accounts[i].account_number);
          }
        }
      });

    }
  });
};
```
