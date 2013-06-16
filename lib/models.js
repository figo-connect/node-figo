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

var querystring = require("querystring");


// ### Account type enumeration
var AccountType = {
  GIRO:        "Giro account",
  SAVINGS:     "Savings account",
  CREDIT_CARD: "Credit card",
  LOAN:        "Loan account",
  PAYPAL:      "PayPal",
  UNKNOWN:     "Unknown"
};

// ### Transaction type enumeration
var TransactionType = {
  TRANSFER:            "Transfer",
  STANDING_ORDER:      "Standing order",
  DIRECT_DEBIT:        "Direct debit",
  SALARY_OR_RENT:      "Salary or rent",
  ELECTRONIC_CASH:     "Electronic cash",
  GELDKARTE:           "GeldKarte",
  ATM:                 "ATM",
  CHARGES_OR_INTEREST: "Charges or interest",
  UNKNOWN:             "Unknown"
};


// ### Abstract base object for model objects
// 
// The constructor instantiates a model object from a JSON object.
// 
// Constructor parameters:
// 
// - **session** (`Session`) - figo `Session` object
// 
// - **obj** (`Object`) - use keys of this JSON object for model object creation
// 
var Base = function(session, obj) {
  this.session = session;

  for (var key in obj) {
    var value = obj[key];
    if (key === "status") {
      this[key] = new SynchronizationStatus(session, value);
    } else if (key.search(/_date$/) !== -1 || key.search(/_timestamp$/) !== -1) {
      this[key] = new Date(value);
    } else {
      this[key] = value;
    }
  }
};


// ### Object representing one bank account of the user
var Account = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  // 
  // - **account_id** (`String`) - Internal figo Connect account ID
  // 
  // - **bank_id** (`String`) - Internal figo Connect bank ID
  // 
  // - **name** (`String`) - Account name
  // 
  // - **owner** (`String`) - Account owner
  // 
  // - **auto_sync** (`Boolean`) -  This flag indicates whether the account will be automatically synchronized.
  // 
  // - **account_number** (`String`) - Account number
  // 
  // - **bank_code** (`String`) - Bank code
  // 
  // - **bank_name** (`String`) - Bank name
  // 
  // - **currency** (`String`) - Three-character currency code.
  // 
  // - **iban** (`String`) - IBAN
  // 
  // - **bic** (`String`) - BIC
  // 
  // - **type** (`String`) - Account type; One of the constants of the `AccountType` object
  // 
  // - **icon** (`String`) - Account icon URL
  // 
  // - **in_total_balance** (`Boolean`) -  This flag indicates whether the balance of this account is added to the total balance of accounts.
  // 
  // - **preview** (`Boolean`) -  This flag indicates whether this account is only shown as preview for an unpaid premium plan.
  // 
  // - **status** (`String`) - Synchronization status object

  // Methods:

  // **get_balance** - Request balance of this account.
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `AccountBalance` object.
  // 
  this.get_balance = function(callback) {
    var session = this.session;
    session.query_api("/rest/accounts/" + this.account_id + "/balance", null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else {
        callback(null, new AccountBalance(session, result));
      }
    });
  };

  // **get_transactions** - Request list of transactions of this account.
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
  //       The result parameter is an array of `Transaction` objects, one for each transaction of this account
  // 
  this.get_transactions = function(options, callback) {
    var session = this.session;
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
    session.query_api("/rest/accounts/" + this.account_id + "/transactions?" + querystring.stringify(options), null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else {
        var transactions = result["transactions"].map(function(transaction) {
          return new Transaction(session, transaction);
        });
        callback(null, transactions);
      }
    });
  };

  // **get_transaction** - Request specific transaction.
  // 
  // - **transaction_id** (`String`) - ID of the transaction to be retrieved
  // 
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an `Transaction` object.
  // 
  this.get_transaction = function(transaction_id, callback) {
    var session = this.session;
    session.query_api("/rest/accounts/" + account_id + "/transaction/" + transaction_id, null, "GET", function(error, result) {
      if (error) {
        callback(error);
      } else if (!result) {
        callback(null, null);
      } else {
        callback(null, new Transaction(session, result));
      }
    });
  };
};

Account.prototype = new Base();
Account.prototype.constructor = Account;


// ### Object representing the balance of a certain bank account of the user
var AccountBalance = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  // 
  // - **balance** (`Number`) - Account balance or `undefined` if the balance is not yet known.
  // 
  // - **balance_date** (`Date`) - Bank server timestamp of balance or `undefined` if the balance is not yet known.
  // 
  // - **credit_line** (`Number`) - Credit line
  // 
  // - **monthly_spending_limit** (`Number`) - User-defined spending limit
  // 
  // - **status** (`String`) - Synchronization status object
};

AccountBalance.prototype = new Base();
AccountBalance.prototype.constructor = AccountBalance;


// ### Object representing one bank transaction on a certain bank account of the user
var Transaction = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  // 
  // - **transaction_id** (`String`) - Internal figo Connect transaction ID
  // 
  // - **account_id** (`String`) - Internal figo Connect account ID
  // 
  // - **name** (`String`) - Name of originator or recipient
  // 
  // - **account_number** (`String`) - Account number of originator or recipient
  // 
  // - **bank_code** (`String`) - Bank code of originator or recipient
  // 
  // - **bank_name** (`String`) - Bank name of originator or recipient
  // 
  // - **amount** (`String`) - Transaction amount
  // 
  // - **currency** (`String`) - Three-character currency code
  // 
  // - **booking_date** (`Date`) - Booking date
  // 
  // - **value_date** (`Date`) - Value date
  // 
  // - **purpose** (`String`) - Purpose text
  // 
  // - **type** (`String`) - Transaction type; One of the constants of the `TransactionType` object
  // 
  // - **booking_text** (`String`) - Booking text
  // 
  // - **booked** (`Boolean`) - This flag indicates whether the transaction is booked or pending.
  // 
  // - **creation_timestamp** (`Date`) - Internal creation timestamp on the figo Connect server
  // 
  // - **modification_timestamp** (`Date`) - Internal modification timestamp on the figo Connect server
  // 
  // - **visited** (`Boolean`) - This flag indicates whether the transaction has already been marked as visited by the user.
};

Transaction.prototype = new Base();
Transaction.prototype.constructor = Transaction;


// ### Object representing the bank server synchronization status
var SynchronizationStatus = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  // 
  // - **code** (`Number`) - Internal figo Connect status code
  // 
  // - **message** (`String`) - Human-readable error message
  // 
  // - **sync_timestamp** (`Date`) - Timestamp of last synchronization
  // 
  // - **success_timestamp** (`Date`) - Timestamp of last successful synchronization
};

SynchronizationStatus.prototype = new Base();
SynchronizationStatus.prototype.constructor = SynchronizationStatus;


// ### Object representing a configured notification, e.g. a webhook or email hook
var Notification = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  // 
  // - **notification_id** (`String`) - Internal figo Connect notification ID from the notification registration response
  // 
  // - **observe_key** (`String`) - One of the notification keys specified in the figo Connect API specification
  // 
  // - **notify_url** (`String`) - Notification messages will be sent to this URL.
  // 
  // - **state** (`String`) - State similiar to sync and logon process; It will passed as POST payload for webhooks.
};

Notification.prototype = new Base();
Notification.prototype.constructor = Notification;


// Exported symbols.
module.exports = {
  AccountType:           AccountType,
  TransactionType:       TransactionType,
  Account:               Account,
  AccountBalance:        AccountBalance,
  Transaction:           Transaction,
  SynchronizationStatus: SynchronizationStatus,
  Notification:          Notification
};
