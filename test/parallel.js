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

//var expect = require("expect.js");
var expect = require("chai").expect;
var async = require("async");

var figo = require("../lib/figo");

// Demo client
var client_id = "CaESKmC8MAhNpDe5rvmWnSkRE_7pkkVIIgMwclgzGcQY";
var client_secret = "STdzfv0GXtEj_bwYn7AgCVszN1kKq5BdgEIKOM_fzybQ";
var access_token = "ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ";

describe('Parallel query tests', function () {
  var accounts,
    sequentialTransactions = [],
    parallelTransactions = [];

  it("should list all accounts", function(done) {
    new figo.Session(access_token).get_accounts(function(error, accts) {
      expect(error).to.not.be.ok;
      expect(accts).to.be.instanceof(Array);
      expect(accts).to.have.length(3);
      accounts = accts;
      done();
    });
  });

  it("should list all accounts (in sync)", function(done) {
    new figo.Session(access_token).get_transactions(null, function(error, transactions) {
      expect(error).to.not.be.ok;
      expect(transactions).to.be.instanceof(Array);
      expect(transactions.length).to.be.above(0);
      expect(transactions[0]).to.contain.all.keys("transaction_id");
      sequentialTransactions = transactions;
      done();
    });
  });

  it("should list all accounts (in parallel)", function(done) {
    async.map(accounts,
      function(account, callback) {
        new figo.Session(access_token).get_transactions({account_id: account.account_id}, function(error, transactions) {
          if (error)
            callback(error);
          else
            callback(null, transactions);
        });
      },
      function(error, transactions) {
        var len = transactions.length;
        for (var i=0; i<len; i++) {
          parallelTransactions = parallelTransactions.concat(transactions[i]);
        }
        expect(sequentialTransactions.length).to.equal(parallelTransactions.length);
        done();
      });
  });
});
