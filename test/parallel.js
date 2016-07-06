var expect = require("expect.js");
var chai = require("chai");
var assert = chai.assert;
var async = require("async");
var _ = require("lodash");

var figo = require("../lib/figo");
var FigoError = require("../lib/errors").FigoError;

// Demo client
var access_token = "ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ";

describe('Parallel query tests', function () {
  it('should successfully query in parallel', function (done) {
    var session = new figo.Session(access_token);
    async.waterfall(
      [ session.get_accounts.bind(session),
        function (accounts, callback) {
          accounts = _.map(accounts, function (account) {
            return {
              name: account.name,
              id: account.account_id
            }
          });
          async.mapSeries(accounts, function (account, callback) {
            var options = {
              account_id: account.id
            };
            session.get_transactions(options, function (err, transactions) {
              if (err) {
                return callback(err);
              }
              callback(err, transactions)
            });
          }, callback);
        },
        function (sequentialTransactions, callback) {
          async.waterfall([
            session.get_accounts.bind(session),
            function (accounts, callback) {
              accounts = _.map(accounts, function (account) {
                return {
                  name: account.name,
                  id: account.account_id
                }
              });
              async.map(accounts, function (account, callback) {
                var options = {
                  account_id: account.id
                };
                session.get_transactions(options, function (err, transactions) {
                  if (err) {
                    return callback(err);
                  }
                  callback(err, transactions)
                });
              }, callback);
            }
          ], function (err, parallelTransactions) {
            callback(err, {
              parallelTransactions: parallelTransactions,
              sequentialTransactions: sequentialTransactions
            })
          })
        }
      ], function (err, result) {
        if (err) {
          console.error(err)
          return done(err)
        }
        assert.equal(result.parallelTransactions.length, result.sequentialTransactions.length)
        return done()
      })
  })
})
