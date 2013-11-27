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

var assert = require("assert");
var vows   = require("vows");
var figo   = require("../lib/figo");


// Use our staging server for unit tests.
figo.Config.api_endpoint = "api.staging.figo.me";
figo.Config.valid_fingerprints = [ "A6:FE:08:F4:A8:86:F9:C1:BF:4E:70:0A:BD:72:AE:B8:8E:B7:78:52",
                                   "AD:A0:E3:2B:1F:CE:E8:44:F2:83:BA:AE:E4:7D:F2:AD:44:48:7F:1E",
                                   "E0:46:84:06:D0:1B:0B:6E:3D:3F:7F:A4:F5:D7:32:C2:56:BA:2F:0A" ];


// Demo access token.
var access_token = "ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ";


vows.describe("Test API wrapper for figo Connect.").addBatch({

  "The list of accounts": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_accounts(this.callback);
    },
    "is not empty": function(error, accounts) {
      assert(!error);
      assert.strictEqual(typeof accounts, "object");
      assert(accounts.length > 0);
    }
  },

  "Account ID A1.1": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_account("A1.1", this.callback);
    },
    "exists": function(error, account) {
      assert(!error);
      assert.strictEqual(typeof account, "object");
      assert.strictEqual(account.account_id, "A1.1");
    }
  },

  "The balance of": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_account("A1.2", this.callback);
    },
    "account ID 1.2": {
      topic: function(account) {
        account.get_balance(this.callback);
      },
      "exists": function(error, balance) {
        assert(!error);
        assert.strictEqual(typeof balance, "object");
        assert.strictEqual(typeof balance.balance, "number");
        assert.strictEqual(typeof balance.balance_date, "object");
      }
    }
  },

  "The list of transactions of": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_account("A1.2", this.callback);
    },
    "account ID 1.2": {
      topic: function(account) {
        account.get_transactions(null, this.callback);
      },
      "is not empty": function(error, transactions) {
        assert(!error);
        assert.strictEqual(typeof transactions, "object");
        assert(transactions.length > 0);
      }
    }
  },

  "The list of transactions": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_transactions(null, this.callback);
    },
    "is not empty": function(error, transactions) {
      assert(!error);
      assert.strictEqual(typeof transactions, "object");
      assert(transactions.length > 0);
    }
  },

  "The list of notifications": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_notifications(this.callback);
    },
    "exists": function(error, notifications) {
      assert(!error);
      assert.strictEqual(typeof notifications, "object");
      assert(notifications.length >= 0);
    }
  },

  "A sync URL": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.get_sync_url("qwe", "qew", null, this.callback);
    },
    "can be requested": function(error, sync_url) {
      assert(!error);
      assert.strictEqual(typeof sync_url, "string");
      assert(sync_url.length > 0);
    }
  },

  "A notification": {
    topic: function() {
      var session = new figo.Session(access_token);
      session.add_notification("/rest/transactions", "http://figo.me/test", "qwe", this.callback);
    },
    "can be created": function(error, notification) {
      assert(!error);
      assert.strictEqual(typeof notification, "object");
    },
    "can be requested": {
      topic: function(notification) {
        var session = notification.session;
        session.get_notification(notification.notification_id, this.callback);
      },
      "yes": function(error, notification) {
        assert(!error);
        assert.strictEqual(typeof notification, "object");
        assert.strictEqual(notification.observe_key, "/rest/transactions");
        assert.strictEqual(notification.notify_uri, "http://figo.me/test");
        assert.strictEqual(notification.state, "qwe");
      },
      "and modified": {
        topic: function(notification) {
          var session = notification.session;
          notification.state = "asd";
          session.modify_notification(notification, this.callback);
        },
        "yes": function(error, notification) {
          assert(!error);
        },
        "and again be requested": {
          topic: function(notification) {
            var session = notification.session;
            session.get_notification(notification.notification_id, this.callback);
          },
          "yes": function(error, notification) {
            assert(!error);
            assert.strictEqual(typeof notification, "object");
            assert.strictEqual(notification.observe_key, "/rest/transactions");
            assert.strictEqual(notification.notify_uri, "http://figo.me/test");
            assert.strictEqual(notification.state, "asd");
          },
          "and deleted": {
            topic: function(notification) {
              var session = notification.session;
              session.remove_notification(notification, this.callback);
            },
            "yes": function(error, result) {
              assert(!error);
            }
          }
        }
      }
    }
  }

}).export(module);
