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
    if (key === "status" && typeof value === "object") {
      this[key] = new SynchronizationStatus(session, value);
    } else if (key === "balance" && typeof value === "object") {
      this[key] = new AccountBalance(session, value);
    } else if (key.search(/_date$/) !== -1 || key.search(/_timestamp$/) !== -1) {
      this[key] = new Date(value);
    } else {
      this[key] = value;
    }
  }
};
Base.prototype.dump = function() {
  var object = this;
  var result = {};
  this.dump_attributes.forEach(function(value) {
    if (typeof object[value] !== 'undefined') {
      if (object[value] != null) {
        result[value] = object[value];
      }
    }
  });
  return result;
}


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
  // - **additional_icons** (`Object`) - Account icon in other resolutions
  //
  // - **status** (`String`) - Synchronization status object
  //
  // - **balance** (`AccountBalance`) - the balance of the account

  // Methods:

  // **get_transactions** - Retrieve list of transactions of this account.
  //
  // - **options** (`Object`) - further options
  //
  //     - **since** (`String`, `Date`) - This field can either be a transaction ID or a date.
  //
  //     - **count** (`Number`) - Limit the number of returned transactions.
  //
  //     - **offset** (`Number`) - which offset into the result set should be used to determin the first transaction to return (useful in combination with count).
  //
  //     - **include_pending** (`Boolean`) - This flag indicates whether pending transactions should be included
  //          in the response; pending transactions are always included as a complete set, regardless of
  //          the field `since`.
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Transaction` objects, one for each transaction of this account
  //
  this.get_transactions = function(options, callback) {
    session.get_transactions(this.account_id, options, callback);
  };

  // **get_transaction** - Retrieve specific transaction.
  //
  // - **transaction_id** (`String`) - ID of the transaction to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Transaction` object.
  //
  this.get_transaction = function(transaction_id, cents, callback) {
    session.get_transaction(transaction_id, cents, callback);
  };

  // **get_payments** - Retrieve payments on this account
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Payment` objects.
  //
  this.get_payments = function(callback) {
    session.get_payments(this.account_id, callback);
  }

  // **get_payment** - Retrieve a specific payment on this account
  //
  // - **payment_id** (`String`) - ID of the payment to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Payment` object.
  //
  this.get_payment = function(payment_id, callback) {
    session.get_payment(this.account_id, payment_id, callback);
  }

  // **get_security** - Retrieve a specific security on this account
  //
  // - **security_id** (`String`) - ID of the security to be retrieved
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Security` object.
  //
  this.get_security = function(security_id, callback) {
    session.get_security(this.account_id, security_id, callback);
  }

  // **get_securities** - Retrieve all securities on this account
  //
  // - **callback** (`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is an array of `Security` objects.
  //
  this.get_securities = function(options, callback) {
    options.account_id = this.account_id;
    session.get_securities(options, callback);
  }

  // **get_bank** - Retrieve the bank of this account
  //
  // - **callback**(`Function`) - callback function with two parameters: `error` and `result`;
  //       The result parameter is a `Bank` object.
  //
  this.get_bank = function(callback) {
    session.get_bank(this.bank_id, callback);
  }
};
Account.prototype = new Base();
Account.prototype.constructor = Account;
Account.prototype.dump_attributes = ["name", "owner", "auto_sync"];


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
AccountBalance.prototype.dump_attributes = ["credit_line", "monthly_spending_limit"];


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
  // - **amount** (`Number`) - Transaction amount
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
  // - **bic** (`String`) - BIC
  //
  // - **iban** (`String`) - IBAN
  //
  // - **booking_key** (`String`) - Booking key
  //
  // - **creditor_id** (`String`) - Creditor ID
  //
  // - **mandate_reference** (`String`) - Mandate reference
  //
  // - **sepa_purpose_code** (`String`) - SEPA purpose code
  //
  // - **sepa_remittance_info** (`String`) - SEPA remittance info
  //
  // - **text_key_addition** (`String`) - Text key addition
  //
  // - **end_to_end_reference** (`String`) - End to end reference
  //
  // - **customer_reference** (`String`) - Customer reference
  //
  // - **prima_nota_number** (`Number`) - Prima nota number
};
Transaction.prototype = new Base();
Transaction.prototype.constructor = Transaction;
Transaction.prototype.dump_attributes = [];


// ### Object representing one standing order
var StandingOrder = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **standing_order_id** (`String`) - Internal figo Connect standing order ID
  //
  // - **account_id** (`String`) - Internal figo Connect account ID
  //
  // - **first_execution_date** (`Date`) - First execution date of the standing order
  //
  // - **last_execution_date** (`Date`) - Last execution date of the standing order (this field might be empty, if no last execution date is set)
  //
  // - **execution_day** (`Number`) - The day the standing order gets executed
  //
  // - **interval** (`String`) - The interval the standing order gets executed (possible values are weekly, monthly, two monthly, quarterly, half yearly and yearly)
  //
  // - **name** (`String`) - Name of recipient
  //
  // - **account_number** (`String`) - Account number recipient
  //
  // - **bank_code** (`String`) - Bank code of recipient
  //
  // - **bank_name** (`String`) - Bank name of recipient
  //
  // - **amount** (`Number`) - Standing order amount
  //
  // - **currency** (`String`) - Three-character currency code
  //
  // - **purpose** (`String`) - Purpose text (this field might be empty if the standing order has no purpose)
  //
  // - **creation_timestamp** (`Date`) - Internal creation timestamp on the figo Connect server
  //
  // - **modification_timestamp** (`Date`) - Internal modification timestamp on the figo Connect server
};
StandingOrder.prototype = new Base();
StandingOrder.prototype.constructor = StandingOrder;
StandingOrder.prototype.dump_attributes = [];


// ### Object representing bank security on a certain bank account of the user
var Security = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **security_id** (`String`) - Internal figo Connect security ID
  //
  // - **account_id** (`String`) - Internal figo Connect account ID
  //
  // - **name** (`String`) - Name of the security
  //
  // - **isin** (`String`) - International Securities Identification Number
  //
  // - **wkn** (`String`) - Wertpapierkennnummer (if available)
  //
  // - **currency** (`String`) - Three-character currency code when measured in currency (and not pieces)
  //
  // - **quantity** (`Number`) - Number of pieces or value
  //
  // - **amount** (`Number`) - Monetary value in account currency
  //
  // - **amount_original_currency** (`Number`) - Monetary value in trading currency
  //
  // - **exchange_rate** (`Number`) - Exchange rate between trading and account currency
  //
  // - **price** (`Number`) - Current price
  //
  // - **price_currency** (`String`) - Currency of current price
  //
  // - **purchase_price** (`Number`) - Purchase price
  //
  // - **purchase_price_currency** (`String`) - Currency of purchase price
  //
  // - **visited** (`Boolean`) - This flag indicates whether the security has already been marked as visited by the user
  //
  // - **trade_timestamp** (`Date`) - Trading timestamp
  //
  // - **creation_timestamp** (`Date`) - Internal creation timestamp on the figo Connect server
  //
  // - **modification_timestamp** (`Date`) - Internal modification timestamp on the figo Connect server
};
Security.prototype = new Base();
Security.prototype.constructor = Security;
Security.prototype.dump_attributes = ["name", "isin", "wkn", "currency", "quantity", "amount", "amount_original_currency", "exchange_rate", "price", "price_currency", "purchase_price", "purchase_price_currency", "visited"];


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
SynchronizationStatus.prototype.dump_attributes = [];


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
  // - **state** (`String`) - State similar to sync and logon process; It will passed as POST payload for webhooks.
};
Notification.prototype = new Base();
Notification.prototype.constructor = Notification;
Notification.prototype.dump_attributes = ["observe_key", "notify_uri", "state"];

// ### Object representing a payment service
var Service = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **name** (`String`) - Human readable name of the service
  //
  // - **bank_code** (`String`) - Bank code used for the service
  //
  // - **icon** (`String`) - URL to an logo of the bank
  //
  // - **additional_icons** (`Object`) - Dictionary mapping from resolution to URL for additional resolutions of the banks icon
}
Service.prototype = new Base();
Service.prototype.constructor = Service;
Service.prototype.dump_attributes = ["name", "bank_code", "icon", "additional_icons"];

// ### Object representing login settings for a banking service
var LoginSettings = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **bank_name** (`String`) - Human readable name of the bank
  //
  // - **supported** (`Boolean`) - Flag showing whether figo supports the bank
  //
  // - **icon** (`String`) - URL to an logo of the bank
  //
  // - **additional_icons** (`Object`) - Dictionary mapping from resolution to URL for additional resolutions of the banks icon
  //
  // - **credentials** (`Array`) - List of credentials needed to connect to the bank
  //
  // - **auth_type** (`String`) - Kind of authentication used by the bank
  //
  // - **advice** (`String`) - Any additional advice useful to locate the required credentials
}
LoginSettings.prototype = new Base();
LoginSettings.prototype.constructor = LoginSettings;
LoginSettings.prototype.dump_attributes = ["bank_name", "supported", "icon", "additional_icons", "credentials", "auth_type", "advice"];

// ### Object representing a BankContact
var Bank = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **bank_id** (`String`) - Internal figo Connect bank ID
  //
  // - **sepa_creditor_id** (`String`) - SEPA direct debit creditor ID
  //
  // - **save_pin** (`Boolean`) - This flag indicates whether the user has chosen to save the PIN on the figo Connect server
}
Bank.prototype = new Base();
Bank.prototype.constructor = Bank;
Bank.prototype.dump_attributes = ["sepa_creditor_id"];

// ### Object representing a Payment
var Payment = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **payment_id** (`String`) - Internal figo Connect payment ID
  //
  // - **account_id** (`String`) -  Internal figo Connect account ID
  //
  // - **type** (`String`) -  Payment type
  //
  // - **name** (`String`) -  Name of creditor or debtor
  //
  // - **account_number** (`String`) -  Account number of creditor or debtor
  //
  // - **bank_code** (`String`) -  Bank code of creditor or debtor
  //
  // - **iban** (`String`) - IBAN of creditor or debtor. Will overwrite bank_code and account_number if both are set
  //
  // - **bank_name** (`String`) -  Bank name of creditor or debtor
  //
  // - **bank_icon** (`String`) -  Icon of creditor or debtor bank
  //
  // - **bank_additional_icons** (`Object`) -  Icon of the creditor or debtor bank in other resolutions
  //
  // - **amount** (`Number`) -  Order amount
  //
  // - **currency** (`String`) -  Three-character currency code
  //
  // - **purpose** (`String`) -  Purpose text
  //
  // - **submission_timestamp** (`Date`) -  Timestamp of submission to the bank server
  //
  // - **creation_timestamp** (`Date`) -  Internal creation timestamp on the figo Connect server
  //
  // - **modification_timestamp** (`Date`) -  Internal modification timestamp on the figo Connect server
  //
  // - **transaction_id** (`String`) -  Transaction ID. This field is only set if the payment has been matched to a transaction
}
Payment.prototype = new Base();
Payment.prototype.constructor = Payment;
Payment.prototype.dump_attributes = ["type", "name", "account_number", "bank_code", "iban", "amount", "currency", "purpose"];

// ### Object representing an user
var User = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **user_id** (`String`) - Internal figo Connect user ID
  //
  // - **name** (`String`) -  First and last name
  //
  // - **email** (`String`) -  Email address
  //
  // - **address** (`Object`) -  Postal address for bills, etc.
  //
  // - **verified_email** (`Boolean`) - This flag indicates whether the email address has been verified
  //
  // - **send_newsletter** (`Boolean`) -  This flag indicates whether the user has agreed to be contacted by email
  //
  // - **language** (`String`) -  Two-letter code of preferred language
  //
  // - **premium** (`Boolean`) -  This flag indicates whether the figo Account plan is free or premium
  //
  // - **premium_expires_on** (`Date`) -  Timestamp of premium figo Account expiry
  //
  // - **premium_subscription** (`String`) -  Provider for premium subscription or Null of no subscription is active
  //
  // - **join_date** (`Date`) -  Timestamp of figo Account registration
}
User.prototype = new Base();
User.prototype.constructor = User;
User.prototype.dump_attributes = ["name", "address", "send_newsletter", "language"];

// ### Object representing a login credential field for a banking service
var Credential = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **label** (`String`) - Label for text input field
  //
  // - **masked** (`Boolean`) - This indicates whether the this text input field is used for password entry and therefore should be masked
  //
  // - **optional** (`Boolean`) - This flag indicates whether this text input field is allowed to contain the empty string
}
Credential.prototype = new Base();
Credential.prototype.constructor = Credential;
Credential.prototype.dump_attributes = ["label", "masked", "optional"];

// ### Object representing a task token
var TaskToken = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **task_token** (`Object`) - Task ID
}
TaskToken.prototype = new Base();
TaskToken.prototype.constructor = TaskToken;
TaskToken.prototype.dump_attributes = ["task_token"];

// ### Object representing a task state
var TaskState = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **account_id** (`String`) - Account ID of currently processed accoount
  //
  // - **message** (`String`) - Status message or error message for currently processed amount
  //
  // - **is_waiting_for_pin** (`Boolean`) - The figo Connect server is waiting for PIN
  //
  // - **is_waiting_for_response** (`Boolean`) - The figo Connect server is waiting for a response to the parameter challenge
  //
  // - **is_erroneous** (`Boolean`) - An error occurred and the figo Connect server is waiting for continuation
  //
  // - **is_ended** (`Boolean`) - The communication with a bank server has been completed
  //
  // - **challenge** (`Object`) - A challenge object
}
TaskState.prototype = new Base();
TaskState.prototype.constructor = TaskState;
TaskState.prototype.dump_attributes = ["account_id", "message", "is_waiting_for_pin", "is_waiting_for_response", "is_erroneous", "is_ended", "challenge"];

// ### Object representing a challenge
var Challenge = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **title** (`String`) - Challenge title
  //
  // - **label** (`String`) - Response label
  //
  // - **format** (`String`) - Challenge data format
  //
  // - **data** (`String`) - Challenge data
}
Challenge.prototype = new Base();
Challenge.prototype.constructor = Challenge;
Challenge.prototype.dump_attributes = ["title", "label", "format"];

// ### Object representing a process token
var ProcessToken = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **process_token** (`Object`) - Process ID
}
ProcessToken.prototype = new Base();
ProcessToken.prototype.constructor = ProcessToken;
ProcessToken.prototype.dump_attributes = ["process_token"];

// ### Object representing a Bsiness Process
var Process = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **email** (`String`) - The email of the existing user to use as context or the new user to create beforehand
  //
  // - **password** (`String`) - The password of the user existing or new user
  //
  // - **redirect_uri** (`String`) - The authorization code will be sent to this callback URL
  //
  // - **state** (`String`) - Any kind of string that will be forwarded in the callback response message
  //
  // - **steps** (`String`) - A list of steps definitions
}
Process.prototype = new Process();
Process.prototype.constructor = Process;
Process.prototype.dump_attributes = ["email", "password", "redirect_uri", "state", "steps"];

// ### Object representing a provider access
var Access = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **id** (`String`) - figo ID of the provider access.
  //
  // - **access_method_id** (`String`) - figo ID of the provider access method.
  //
  // - **consent** (`Consent`) - Configuration of the PSD2 consents. Is ignored for non-PSD2 accesses.
  //
  //            - **recurring** (`Boolean`) - Indicates whether the consent is for an ongoing use-case.
  //
  //            - **period** (`Integer`) - Specify the period in days for which the consent is valid. Ignored if recurring is set to false.
  //
  //            - **scopes** (`Array`) - Define scope of the consent.
  //
  //            - **accounts** (`Array`) - An array of accounts.
  //
  //            - **expires_at** (`Date`) - The date at which the consent expires.
  //
  // - **created_at** (`Date`) - Entity creation timestamp.
  //
  // - **auth_methods** (`Array of AuthMethod`) - List of supported methods for payment initiation and authentication.
  //
  //            - **id** (`String`) - figo ID of TAN scheme.
  //
  //            - **medium_name** (`String`) - Description of the medium used to generate the authentication response.
  //
  //            - **type** (`String`) - Type of authentication method.
  //
  //            - **additional_info** (`String`) - Additional information on the authentication method as key/value pairs.
}
Access.prototype = new Base();
Access.prototype.constructor = Access;
Access.prototype.dump_attributes = [];

// ### Object representing a synchronization
var Sync = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **id** (`String`) - figo ID of synchronization operation.
  //
  // - **status** (`String`) - The processing state that the work item currently is in.
  //
  // - **challenge** (`Object`) - AuthMethodSelectChallenge (object) or EmbeddedChallenge (object) or RedirectChallenge (object) or DecoupledChallenge (object) (Challenge).
  //
  // - **error** (`Object`) - Error detailing why the background operation failed.
  //
  // - **created_at** (`Time`) - Time at which the sync was created.
  //
  // - **started_at** (`Time`) - Time at which the sync was started.
  //
  // - **ended_at** (`Time`) - Time at which the sync was ended.
}
Sync.prototype = new Base();
Sync.prototype.constructor = Sync;
Sync.prototype.dump_attributes = [];

// ### Object representing a synchronization challenge
var SynchronizationChallenge = function(session, json) {
  Base.call(this, session, json);

  // Properties:
  //
  // - **id** (`String`) - figo ID of synchronization operation.
  //
  // - **created_at** (`Time`) - Time at which the challenge was created.
  //
  // - **type** (`String`)
  //
  // Challenge can be rapresented in multiple ways depending on type, here the list:
  //
  //  AuthMethodSelectChallenge
  //
  //          - **auth_methods** (`Array of AuthMethod`)
  //
  //  EmbeddedChallenge
  //
  //          - **format** (`Photo`)
  //          - **version** (`String`)
  //          - **data** (`String`)
  //          - **additional_info** (`String`)
  //          - **label** (`String`)
  //          - **input_format** (`String`)
  //          - **max_length** (`Integer`)
  //          - **min_length** (`Integer`)
  //
  //  RedirectChallenge
  //
  //          - **location** (`String`)
  //
  //  DecoupledChallenge
  //
  //          - **message** (`String`)
}
SynchronizationChallenge.prototype = new Base();
SynchronizationChallenge.prototype.constructor = SynchronizationChallenge;
SynchronizationChallenge.prototype.dump_attributes = [];


// Exported symbols.
module.exports = {
  Access:                   Access,
  Account:                  Account,
  AccountBalance:           AccountBalance,
  Transaction:              Transaction,
  StandingOrder:            StandingOrder,
  Security:                 Security,
  SynchronizationChallenge: SynchronizationChallenge,
  SynchronizationStatus:    SynchronizationStatus,
  Notification:             Notification,
  Service:                  Service,
  LoginSettings:            LoginSettings,
  Bank:                     Bank,
  User:                     User,
  Payment:                  Payment,
  Credential:               Credential,
  TaskToken:                TaskToken,
  TaskState:                TaskState,
  Challenge:                Challenge,
  ProcessToken:             ProcessToken,
  Process:                  Process,
  Sync:                     Sync
};
