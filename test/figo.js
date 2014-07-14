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
var expect = require('expect.js');
var figo   = require("../lib/figo");

// Demo access token.
var access_token = "ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ";

// enabling stack traces
process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err.stack);
});

describe("The figo session", function() {
  it("should list all accounts", function(done) {
    new figo.Session(access_token).get_accounts(function(error, accounts) {
      expect(error).to.be(null);
      expect(accounts).to.be.an("array");
      expect(accounts).to.have.length(2);
      done();
    });
  });

  it("should list all transactions", function(done) {
    new figo.Session(access_token).get_transactions(null, function(error, transactions) {
      expect(error).to.be(null);
      expect(transactions).to.be.an("array");
      expect(transactions.length).to.be.above(0);
      done();
    });
  });

  it("should list all payments", function(done) {
    new figo.Session(access_token).get_payments(null, function(error, payments) {
      expect(error).to.be(null);
      expect(payments).to.be.an("array");
      expect(payments.length).to.be.above(-1);
      done();
    });
  });

  it("should list all notifications", function(done) {
    new figo.Session(access_token).get_notifications(function(error, notifications) {
      expect(error).to.be(null);
      expect(notifications).to.be.an("array");
      expect(notifications.length).to.be.above(-1);
      done();
    });
  });

  it("should handle missing stuff correctly", function(done) {
    new figo.Session(access_token).get_account("A1.42", function(error, account) {
      expect(error).to.be(null);
      expect(account).to.be(null);
      done();
    });
  });

  it("should cope with errors", function(done) {
    new figo.Session(access_token).get_sync_url("http://localhost:3003/", "", function(error, result) {
      expect(error).to.be.an("object");
      expect(result).to.be(undefined);
      done();
    });
  });

  it("should provide access to the current user", function(done) {
    new figo.Session(access_token).get_user(function(error, user) {
      expect(error).to.be(null);
      expect(user).to.be.an("object");
      expect(user.email).to.be("demo@figo.me");
      done();
    });
  });

  it("should retrieve account A1.1", function(done) {
    new figo.Session(access_token).get_account("A1.1", function(error, account) {
      expect(error).to.be(null);
      expect(account).to.be.an("object");
      expect(account.account_id).to.be("A1.1");

      expect(account.balance).to.be.an("object");
      expect(account.balance.balance).to.be.an("number");
      expect(account.balance.balance_date).to.be.an("object");

      account.get_transactions(null, function(error, transactions) {
        expect(error).to.be(null);
        expect(transactions).to.be.an("array");
        expect(transactions.length).to.be.above(0);

        account.get_payments(function(error, payments) {
          expect(error).to.be(null);
          expect(payments).to.be.an("array");
          expect(payments.length).to.be.above(-1);
          done();
        });
      });
    });
  });

  it("should provie a sync URL", function(done) {
    new figo.Session(access_token).get_sync_url("qwe", "qew", function(error, sync_url) {
      expect(error).to.be(null);
      expect(sync_url).to.be.an("string");
      expect(sync_url.length).to.be.above(0);
      done();
    });
  });

  it("should allow management of a notification", function(done) {
    var session = new figo.Session(access_token);
    session.add_notification(new figo.Notification(session, {observe_key: "/rest/transactions", notify_uri: "http://figo.me/test", state: "qwe"}), function(error, notification) {
      expect(error).to.be(null);
      expect(notification).to.be.an("object");
      expect(notification.observe_key).to.be("/rest/transactions");
      expect(notification.notify_uri).to.be("http://figo.me/test");
      expect(notification.state).to.be("qwe");

      notification.session.get_notification(notification.notification_id, function(error, notification) {
        expect(error).to.be(null);
        expect(notification).to.be.an("object");
        expect(notification.notification_id.length).to.be.above(0);
        expect(notification.observe_key).to.be("/rest/transactions");
        expect(notification.notify_uri).to.be("http://figo.me/test");
        expect(notification.state).to.be("qwe");

        notification.state = "asd";
        notification.session.modify_notification(notification, function(error, notification) {
          expect(error).to.be(null);
          expect(notification).to.be.an("object");
          expect(notification.observe_key).to.be("/rest/transactions");
          expect(notification.notify_uri).to.be("http://figo.me/test");
          expect(notification.state).to.be("asd");

          notification.session.remove_notification(notification, function(error, result) {
            expect(error).to.be(null);
            expect(result).to.be(null);

            notification.session.get_notification(notification.notification_id, function(error, result) {
              expect(error).to.be(null);
              expect(result).to.be(null);
              done();
            });
          });
        });
      });
    });
  });

  it("should allow management of a payment", function(done) {
    var session = new figo.Session(access_token);
    session.add_payment(new figo.Payment(session, {account_id: "A1.1", type: "Transfer", account_number: "4711951501", bank_code: "90090042", name: "figo", purpose: "Thanks for all the fish.", amount: 0.89}), function(error, payment) {
      expect(error).to.be(null);
      expect(payment).to.be.an("object");
      expect(payment.account_id).to.be("A1.1");
      expect(payment.bank_name).to.be("Demobank");
      expect(payment.amount).to.be(0.89);

      payment.session.get_payment(payment.account_id, payment.payment_id, function(error, payment) {
        expect(error).to.be(null);
        expect(payment).to.be.an("object");
        expect(payment.account_id).to.be("A1.1");
        expect(payment.bank_name).to.be("Demobank");
        expect(payment.amount).to.be(0.89);

        payment.amount = 2.39;
        payment.session.modify_payment(payment, function(error, payment) {
          expect(error).to.be(null);
          expect(payment).to.be.an("object");
          expect(payment.account_id).to.be("A1.1");
          expect(payment.bank_name).to.be("Demobank");
          expect(payment.amount).to.be(2.39);

          payment.session.remove_payment(payment, function(error, result) {
            expect(error).to.be(null);
            expect(result).to.be(null);

            payment.session.get_payment(payment.account_id, payment.payment_id, function(error, result) {
              expect(error).to.be(null);
              expect(result).to.be(null);
              done();
            });
          });
        });
      });
    });
  });
});
