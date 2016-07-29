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

var expect  = require("chai").expect;

// figo sdk
var figo      = require("../lib/figo");
var FigoError = require("../lib/errors").FigoError;

// Demo client
var client_id = "CaESKmC8MAhNpDe5rvmWnSkRE_7pkkVIIgMwclgzGcQY";
var client_secret = "STdzfv0GXtEj_bwYn7AgCVszN1kKq5BdgEIKOM_fzybQ";
var access_token = "ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ";

// enabling stack traces
process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err.stack);
});

describe("The figo session", function() {

  it("should list all accounts", function(done) {
    new figo.Session(access_token).get_accounts(function(error, accounts) {
      expect(error).to.be.null;
      expect(accounts).to.be.instanceof(Array);
      expect(accounts).to.have.length(3);
      done();
    });
  });

  it("shouldn't allow to add an account", function(done) {
    new figo.Session(access_token).add_account("de", ["figo", "figo"], "90090042", null, null, function(error, task_token) {
      expect(error).to.be.instanceof(Object);

      expect(error).to.be.instanceof(Error);
      expect(error).to.be.instanceof(FigoError);

      expect(error).to.have.property("stack");
      var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
      expect(stackTraceIsProper).to.be.true;

      expect(task_token).to.be.undefined;
      done();
    });
  });

  it("shouldn't list all supported banks, credit cards, other payment services", function(done) {
    new figo.Session(access_token).get_supported_payment_services("de", null, function(error, services) {
        expect(error).to.be.instanceof(Object);

        expect(error).to.be.instanceof(Error);
        expect(error).to.be.instanceof(FigoError);

        expect(error).to.have.property("stack");
        var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
        expect(stackTraceIsProper).to.be.true;

        expect(services).to.be.undefined;
        done();
    });
  });

  it("shouldn't list all supported credit cards and other payment services", function(done) {
    new figo.Session(access_token).get_supported_payment_services("de", "services", function(error, services) {
        expect(error).to.be.instanceof(Object);

        expect(error).to.be.instanceof(Error);
        expect(error).to.be.instanceof(FigoError);

        expect(error).to.have.property("stack");
        var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
        expect(stackTraceIsProper).to.be.true;

        expect(services).to.be.undefined;
        done();
    });
  });

  it("shouldn't list all supported banks", function(done) {
    new figo.Session(access_token).get_supported_payment_services("de", "banks", function(error, services) {
        expect(error).to.be.instanceof(Object);

        expect(error).to.be.instanceof(Error);
        expect(error).to.be.instanceof(FigoError);

        expect(error).to.have.property("stack");
        var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
        expect(stackTraceIsProper).to.be.true;

        expect(services).to.be.undefined;
        done();
    });
  });

  it("should list login settings for a bank or service", function(done) {
    new figo.Session(access_token).get_login_settings("de", "90090042", function(error, login_settings) {
        expect(error).to.be.instanceof(Object);

        expect(error).to.be.instanceof(Error);
        expect(error).to.be.instanceof(FigoError);

        expect(error).to.have.property("stack");
        var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
        expect(stackTraceIsProper).to.be.true;

        expect(login_settings).to.be.undefined;
        done();
    });
  });

  it("should list all transactions", function(done) {
    new figo.Session(access_token).get_transactions(null, function(error, transactions) {
      expect(error).to.be.null;
      expect(transactions).to.be.instanceof(Array);
      expect(transactions.length).to.be.above(0);
      expect(transactions[0]).to.contain.all.keys("transaction_id");
      done();
    });
  });

  it("should list all standing orders", function(done) {
    new figo.Session(access_token).get_standing_orders(null, function(error, standing_orders) {
      expect(error).to.be.null;
      expect(standing_orders).to.be.instanceof(Array);
      expect(standing_orders.length).to.be.above(0);
      expect(standing_orders[0]).to.contain.all.keys("standing_order_id");
      done();
    });
  });

  it("should list all securities", function(done) {
    new figo.Session(access_token).get_securities(null, function(error, securities) {
      expect(error).to.be.null;
      expect(securities).to.be.instanceof(Array);
      expect(securities.length).to.be.above(0);
      expect(securities[0]).to.contain.all.keys("security_id");
      done();
    });
  });

  it("should list all payments", function(done) {
    new figo.Session(access_token).get_payments(null, function(error, payments) {
      expect(error).to.be.null;
      expect(payments).to.be.instanceof(Array);
      expect(payments.length).to.be.above(0);
      expect(payments[0]).to.contain.all.keys("payment_id");
      done();
    });
  });

  it("should list all notifications", function(done) {
    new figo.Session(access_token).get_notifications(function(error, notifications) {
      expect(error).to.be.null;
      expect(notifications).to.be.instanceof(Array);
      expect(notifications.length).to.be.above(-1);
      done();
    });
  });

  it("should handle missing stuff correctly", function(done) {
    new figo.Session(access_token).get_account("A1.42", function(error, account) {
      expect(error).to.be.null;
      expect(account).to.be.null;
      done();
    });
  });

  it("should cope with errors", function(done) {
    new figo.Session(access_token).get_sync_url("https://example.com", "", function(error, result) {
      expect(error).to.be.instanceof(Object);

      expect(error).to.be.instanceof(Error);
      expect(error).to.be.instanceof(FigoError);

      expect(error).to.have.property("stack");
      var stackTraceIsProper = error.stack.indexOf('/lib/figo.js:') !== -1;
      expect(stackTraceIsProper).to.be.true;

      expect(result).to.be.undefined;
      done();
    });
  });

  it("should provide access to the current user", function(done) {
    new figo.Session(access_token).get_user(function(error, user) {
      expect(error).to.be.null;
      expect(user).to.be.instanceof(Object);
      expect(user.email).to.equal("demo@figo.me");
      done();
    });
  });

  it("should retrieve account A1.1", function(done) {
    new figo.Session(access_token).get_account("A1.1", function(error, account) {
      expect(error).to.be.null;
      expect(account).to.be.instanceof(Object);
      expect(account.account_id).to.equal("A1.1");

      expect(account.balance).to.be.instanceof(Object);
      expect(account.balance.balance).to.be.a("number");
      expect(account.balance.balance_date).to.be.instanceof(Object);

      account.get_transactions(null, function(error, transactions) {
        expect(error).to.be.null;
        expect(transactions).to.be.instanceof(Array);
        expect(transactions.length).to.be.above(0);

        account.get_payments(function(error, payments) {
          expect(error).to.be.null;
          expect(payments).to.be.instanceof(Array);
          expect(payments.length).to.be.above(-1);
          done();
        });
      });
    });
  });

  it("should provide a sync URL", function(done) {
    new figo.Session(access_token).get_sync_url("qwe", "qew", function(error, sync_url) {
      expect(error).to.be.null;
      expect(sync_url).to.be.an("string");
      expect(sync_url.length).to.be.above(0);
      done();
    });
  });

  it("should allow management of a notification", function(done) {
    var session = new figo.Session(access_token);
    session.add_notification(new figo.Notification(session, {observe_key: "/rest/transactions", notify_uri: "http://figo.me/test", state: "qwe"}), function(error, notification) {
      expect(error).to.be.null;
      expect(notification).to.be.instanceof(Object);
      expect(notification.observe_key).to.equal("/rest/transactions");
      expect(notification.notify_uri).to.equal("http://figo.me/test");
      expect(notification.state).to.equal("qwe");

      notification.session.get_notification(notification.notification_id, function(error, notification) {
        expect(error).to.be.null;
        expect(notification).to.be.instanceof(Object);
        expect(notification.notification_id.length).to.be.above(0);
        expect(notification.observe_key).to.equal("/rest/transactions");
        expect(notification.notify_uri).to.equal("http://figo.me/test");
        expect(notification.state).to.equal("qwe");

        notification.state = "asd";
        notification.session.modify_notification(notification, function(error, notification) {
          expect(error).to.be.null;
          expect(notification).to.be.instanceof(Object);
          expect(notification.observe_key).to.equal("/rest/transactions");
          expect(notification.notify_uri).to.equal("http://figo.me/test");
          expect(notification.state).to.equal("asd");

          notification.session.remove_notification(notification, function(error, result) {
            expect(error).to.be.null;
            expect(result).to.be.null;

            notification.session.get_notification(notification.notification_id, function(error, result) {
              expect(error).to.be.null;
              expect(result).to.be.null;
              done();
            });
          });
        });
      });
    });
  });

  it("should allow management of a payment", function(done) {
    var session = new figo.Session(access_token);
    session.add_payment(new figo.Payment(session, {
      account_id: "A1.1",
      type: "Transfer",
      account_number: "4711951501",
      bank_code: "90090042",
      name: "Mönckebergstraße",
      purpose: "Приятных покупок!",
      amount: 0.89000000000000001
    }), function(error, payment) {
      expect(error).to.be.null;
      expect(payment).to.be.instanceof(Object);
      expect(payment.account_id).to.equal("A1.1");
      expect(payment.bank_name).to.equal("Demobank");
      expect(payment.amount).to.equal(0.89);

      payment.session.get_payment(payment.account_id, payment.payment_id, function(error, payment) {
        expect(error).to.be.null;
        expect(payment).to.be.instanceof(Object);
        expect(payment.account_id).to.equal("A1.1");
        expect(payment.bank_name).to.equal("Demobank");
        expect(payment.amount).to.equal(0.89);

        payment.amount = 2.39;
        payment.session.modify_payment(payment, function(error, payment) {
          expect(error).to.be.null;
          expect(payment).to.be.instanceof(Object);
          expect(payment.account_id).to.equal("A1.1");
          expect(payment.bank_name).to.equal("Demobank");
          expect(payment.amount).to.equal(2.39);

          payment.session.remove_payment(payment, function(error, result) {
            expect(error).to.be.null;
            expect(result).to.be.null;

            payment.session.get_payment(payment.account_id, payment.payment_id, function(error, result) {
              expect(error).to.be.null;
              expect(result).to.be.null;
              done();
            });
          });
        });
      });
    });
  });
});

