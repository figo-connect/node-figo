var figo = require("./lib/figo");

var session_1 = new figo.Session("ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ");
// Print out list of accounts and balances
session_1.get_accounts(function(error, accounts) {
  if (error) {
    console.log(error);
    return;
  }
  accounts.forEach(function(account) {
    console.log(account.name);
    console.log(account.balance.balance);
  });
});

var session_2 = new figo.Session("ASHWLIkouP2O6_bgA2wWReRhletgWKHYjLqDaqb0LFfamim9RjexTo22ujRIP_cjLiRiSyQXyt2kM1eXU2XLFZQ0Hro15HikJQT_eNeT_9XQ");
session_2.get_account("A1.2", function(error, account) {
  account.get_transactions(null, function(error, transactions) {
    transactions.forEach(function(transaction) {
      console.log(transaction.purpose);
    });
  });
});
