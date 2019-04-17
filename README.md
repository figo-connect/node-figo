figo Node.js SDK
================

[![npm version](http://img.shields.io/npm/v/figo.svg)](https://www.npmjs.org/package/figo)
[![Build Status](https://secure.travis-ci.org/figo-connect/node-figo.svg)](https://travis-ci.org/figo-connect/node-figo)
[![dependencies Status](https://david-dm.org/figo-connect/node-figo/status.svg)](https://david-dm.org/figo-connect/node-figo)

figo Node.js SDK is a package that contains a set of wrappers for figo Connect API and enables you to start creating applications in a Node.js environment immediately.

figo Connect API
----------------

figo Connect API allows you easily access bank accounts including payments submitting and transaction history. Our main goal is to provide banking applications with rich user experience and seamless integration.

For more information please check [our website](http://figo.io).

### Get an API key

To get started with figo Connect you have to register your application first. Request your personal credentials using our online [application form](https://www.figo.io/client-id/) or just [email us](mailto:business@figo.io) and we will be more than happy to provide you with a client ID and a secret without any bureaucracy.

The Latest Version
------------------

The latest version of this SDK can be found in [GitHub repository](https://github.com/figo-connect/node-figo).

Documentation
-------------

Detailed API reference is available [online](http://docs.figo.io/v3/) on our website.

Installation
------------

### Using npm

To install the SDK via [npm](https://github.com/npm/npm) use following command:

```bash
npm install figo@latest
```

### Manually

Just clone our repository with your preferred method. For example:

```bash
git clone git://github.com/figo-connect/node-figo.git
```

Usage
-----

Make a connection:

```javascript
var figo = require('figo');

// Demo client
var client_id     = 'CaESKmC8MAhNpDe5rvmWnSkRE_7pkkVIIgMwclgzGcQY'; // Demo client ID
var client_secret = 'STdzfv0GXtEj_bwYn7AgCVszN1kKq5BdgEIKOM_fzybQ'; // Demo client secret

var connection = new figo.Connection(client_id, client_secret);
```
where `client_id` and `client_secret` are your application's credentials obtained from figo.

And create the first figo user:

```javascript
// User personal data
var name            = 'John Doe';
var email           = 'john.doe@example.com';
var password        = 'Swordfish';
var language        = 'en';

connection.create_user(name, email, password, language, null, function(error, recovery_password) {
  if (error) {
    console.error(error);
  } else {
    console.log(recovery_password);
  }
});
```

### Authentication

From the figo Connect [API reference](http://docs.figo.io/v3/#calling-the-figo-connect-api):
> “In order to access any information belonging to a user, a client has to authenticate with a token linking itself to the user. This token is called an *access token* and contains information on the client, the user and the level of access the client has to the users data.”

Log in to obtain such access token:

```javascript
var access_token = '';

connection.credential_login(username, password, null, null, null, null, function(error, token) {
  if (error) {
    console.error(error);
  } else {
    access_token = token.access_token;
  }
});
```

Once you have an access token you can perform the rest of operations with the API.

### Session

But first create a session using the access token from the previous step:

```javascript
var session = new figo.Session(access_token);
```

### Examples

#### Accounts

##### Retrieve all bank accounts

To get all the bank accounts user has chosen to share with your application use `get_accounts` function:

```javascript
session.get_accounts(function(error, accounts) {
  if (error) {
    console.error(error);
  } else {
    accounts.forEach(function(account) {
      // Do whatever you want
      console.log(account.account_number);
      console.log(account.balance.balance);
    });
  }
});
```

#### Transactions

##### Retrieve transactions of one or all accounts

```javascript
session.get_transactions(null, function(error, transactions) {
  if (error) {
    console.error(error);
  } else {
    transactions.forEach(function(transaction) {
      // Do whatever you want
      console.log(transaction.name);
    });
  }
});
```

#### Standing Orders

##### Retrieve standing orders of one or all accounts

```javascript
session.get_standing_orders(false, function(error, standingOrders) {
  if (error) {
    console.error(error);
  } else {
    standingOrders.forEach(function(standingOrder) {
      // Do whatever you want
      console.log(standingOrder.standing_order_id, standingOrder.purpose, standingOrder.amount);
    });
  }
});
```

#### Securities

##### Retrieve securities of one or all accounts

```javascript
session.get_securities(null, function(error, securities) {
  if (error) {
    console.error(error);
  } else {
    securities.forEach(function(security) {
      // Do whatever you want
      console.log(security.security_id, security.amount, security.currency);
    });
  }
});
```

#### Payments

##### Retrieve all or one payment(s)

```javascript
// Retrieve all available payments
session.get_payments(null, function(error, payments) {
  if (error) {
    console.error(error);
  } else {
    payments.forEach(function(payment) {
      console.log(payment.payment_id, payment.amount, payment.currency, payment.purpose);
    })
  }
});
```

##### Create a single payment

figo Connect API allows you not only to get an information related to bank accounts, but also to submit wire transfers on behalf of the account owner which is a two-step process:

1. First, you have to compile a payment object and submit it to the figo Connect API.
2. Second, you need to submit the newly created payment to the bank itself via the figo Connect API.
Although any interaction with the API is done live, customer bank's servers might take some time to reply. In order to handle this figo Connect API will create a [background task](http://docs.figo.io/v3/#task-processing) and will return a task token to your application on step two. Using this task token you can later poll the result of the task execution.

Tests
-----

### Running the Unit Tests

Make sure you have all the necessary dependencies:

```bash
npm install
```

You need to set the following environment variables:
  - `FIGO_CLIENT_ID`
  - `FIGO_CLIENT_SECRET`
  - `FIGO_API_ENDPOINT` (optional, defaults to `https://staging.figo.me/v3`)

```bash
npm test
```


License
-------

figo Node.js SDK is released under the [MIT License](http://opensource.org/licenses/MIT).

Changelog and New Features
--------------------------

### 3.1.1

- Dropped support for node.js 4.0
- removed cert-pinning to support new figo infrastructure

### 1.6.0

- Use SHA-256 to validate certificate fingerprint ([`5496e58`](https://github.com/figo-connect/node-figo/commit/5496e5823432b0751bd724f27afffc91370f1f65))
- Node.js versions 0.10 and older are no longer supported ([`afeb565`](https://github.com/figo-connect/node-figo/commit/afeb5658f5249aff57e7733309358e8711dfdf1a))

### 1.5.1

- Create a `.stack` property on `FigoError` object: https://github.com/figo-connect/node-figo/pull/27

### 1.5.0

- Minor [feature](https://github.com/figo-connect/node-figo/issues/12)

### 1.4.4

- Minor [bugfix](https://github.com/figo-connect/node-figo/issues/24)
- Code [beautified](https://github.com/figo-connect/node-figo/issues/18)

### 1.4.3

- Minor [bugfix](https://github.com/figo-connect/node-figo/issues/20)

### 1.4.2

- Minor [bugfix](https://github.com/figo-connect/node-figo/issues/14)

### 1.4.1

- Certificate [fingerprint update](https://github.com/figo-connect/node-figo/commit/bd382951d5b94445f982b3acaf0dab4aaf52324e)

### 1.4.0

- Errors are now instances of JavaScript standard built-in `Error` object

### 1.2.0

- Added wrappers for the following API calls
  - Authentication: Credential Login, Unlock a figo account;
  - User Management: Start forgot password process, Re-send unlock code, Re-send verification email;
  - Accounts: Set bank account sort order;
  - Account setup & synchronization: Retrieve list of supported banks, credit cards, other payment services, Retrieve list of supported credit cards and other payment services, Retrieve list of all supported banks, Retrieve login settings for a bank or service, Setup new bank account;
  - Transactions: Modify a transaction, Modify all transactions of one or all accounts, Delete a transaction;
  - Standing Orders: Retrieve standing_orders of one or all accounts;
  - Securities: Retrieve a security, Retrieve securities of one or all accounts, Modify a security, Modify all securities of one or all;
  - Payments: Retrieve payment proposals;
  - Task Processing: Begin task, Poll task state, Cancel a task;
  - Business Process System: Begin process, Create a process;

- Minor fixes

### 1.1.1

Previous release which was done before starting to maintain the above changelog.

Contributing and Bug Reporting
------------------------------

Please submit bug reports and your suggestions to the GitHub [issue tracker](https://github.com/figo-connect/node-figo/issues). Feel free to add pull requests as well.
