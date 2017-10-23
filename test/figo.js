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

figo.Config.api_endpoint = process.env.FIGO_API_ENDPOINT || 'api.figo.me'
if (process.env.FIGO_API_FINGERPRINT) {
  figo.Config.valid_fingerprints.push(process.env.FIGO_API_FINGERPRINT);
}

var connection = new figo.Connection(process.env.FIGO_CLIENT_ID, process.env.FIGO_CLIENT_SECRET)
var email = Math.random().toString(36).substring(7) + "@example.com";
var password = Math.random().toString(36).substring(7);
var access_token = '';
var task = '';
var account_id = '';


function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}


// enabling stack traces
process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err.stack);
});


describe("Tests", function() {
  it("should create a new user", function(done) {
    connection.create_user('JS SDK Test', email, password, 'de', false, function(error, recovery_password) {
      expect(error).to.be.null;
      expect(recovery_password).to.be.instanceof(Object);
      done();
    });
  });

  it("should get an accesstoken", function(done) {
    connection.credential_login(email, password, null, null, null, null, function(error, token) {
      expect(error).to.be.null;
      expect(token).to.be.instanceof(Object);
      access_token = token.access_token;
      done();
    });
  });

  it("should add account", function(done) {
    new figo.Session(access_token).add_account("de", ["figo", "figo"], "90090042", null, null, function(error, token) {
      expect(error).to.be.null;
      expect(token).to.be.instanceof(Object);
      task = token;
      done();
    });
  });

  it("should finish synchronization", function(done) {
    sleep(10000).then(function() {
      new figo.Session(access_token).get_task_state(task, null, function(error, data) {
        expect(data).to.be.instanceof(Object)
        expect(data.is_ended).to.be.true;
        expect(data.is_erroneous).to.be.false;
        account_id = data.account_id;
        done();
      });
    });
  });

  it("should list all accounts", function(done) {
    new figo.Session(access_token).get_accounts(function(error, accounts) {
      expect(error).to.be.null;
      expect(accounts).to.be.instanceof(Array);
      expect(accounts).to.have.length(3);
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
      expect(standing_orders.length).to.be.above(-1);
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
      expect(payments.length).to.be.above(-1);
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


  it("should provide access to the current user", function(done) {
    new figo.Session(access_token).get_user(function(error, user) {
      expect(error).to.be.null;
      expect(user).to.be.instanceof(Object);
      expect(user.email).to.equal(email);
      done();
    });
  });

  it("should retrieve account", function(done) {
    new figo.Session(access_token).get_account(account_id, function(error, account) {
      expect(error).to.be.null;
      expect(account).to.be.instanceof(Object);
      expect(account.account_id).to.equal(account_id);

      expect(account.balance).to.be.instanceof(Object);
      expect(account.balance.balance).to.be.a("number");
      expect(account.balance.balance_date).to.be.instanceof(Object);

      account.get_transactions(null, function(error, transactions) {
        expect(error).to.be.null;
        expect(transactions).to.be.instanceof(Array);
        expect(transactions.length).to.be.above(-1);

        account.get_payments(function(error, payments) {
          expect(error).to.be.null;
          expect(payments).to.be.instanceof(Array);
          expect(payments.length).to.be.above(-1);
          done();
        });
      });
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

  /*
  it("should allow management of a payment", function(done) {
    var session = new figo.Session(access_token);
    session.add_payment(new figo.Payment(session, {
      account_id: account_id,
      type: "Transfer",
      account_number: "4711951501",
      bank_code: "90090042",
      name: "Mönckebergstraße",
      purpose: "Приятных покупок!",
      amount: 0.89
    }), function(error, payment) {
      expect(error).to.be.null;
      expect(payment).to.be.instanceof(Object);
      expect(payment.account_id).to.equal(account_id);
      expect(payment.bank_name).to.equal("Demobank");
      expect(payment.amount).to.equal(0.89);
      payment.session.get_payment(payment.account_id, payment.payment_id, function(error, payment) {
        expect(error).to.be.null;
        expect(payment).to.be.instanceof(Object);
        expect(payment.account_id).to.equal(account_id);
        expect(payment.bank_name).to.equal("Demobank");
        expect(payment.amount).to.equal(0.89);

        payment.amount = 2.39;
        payment.session.modify_payment(payment, function(error, payment) {
          expect(error).to.be.null;
          expect(payment).to.be.instanceof(Object);
          expect(payment.account_id).to.equal(account_id);
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
  });*/

  it("should delete user", function(done) {
    new figo.Session(access_token).remove_user(function(error) {
      expect(error).to.be.null;
      done();
    });
  });
});
