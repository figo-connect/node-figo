var express = require('express');
var router = express.Router();
var figo = require('../../lib/figo');
var connection = new figo.Connection("CaESKmC8MAhNpDe5rvmWnSkRE_7pkkVIIgMwclgzGcQY", "STdzfv0GXtEj_bwYn7AgCVszN1kKq5BdgEIKOM_fzybQ", "http://localhost:3000/callback");

router.param('account_id', function(req, res, next, id) {
  req.account_id = id;
  next();
});

router.get('/callback', function(req, res) {
  if (req.query.state != "qweqwe") {
    throw "Invalid state";
  }

  connection.obtain_access_token(req.query.code, null, function(error, result) {
    if(result) {
      req.session.figo_token = result.access_token;
    } else {
      console.log(error);
    }
    res.redirect("/");
  })
});

router.get('/logout', function(req, res) {
  req.session = null;
  res.redirect('/');
});


router.get('/:account_id', function(req, res, next) {
  if (!req.session.figo_token) {
    res.redirect(connection.login_url('qweqwe', 'accounts=ro transactions=ro balance=ro user=ro'));
  } else {
    var session = new figo.Session(req.session.figo_token);
    session.get_user(function(error, user) {
      session.get_accounts(function(error, accounts) {
        session.get_account(req.account_id, function(error, account) {
          account.get_transactions(null, function(error, transactions){
            res.render('index', { accounts: accounts, user: user, transactions: transactions, current_account: account });
          });
        });
      });
    });
  }
});

router.get('/', function(req, res) {
  if (!req.session.figo_token) {
    res.redirect(connection.login_url('qweqwe', 'accounts=ro transactions=ro balance=ro user=ro'));
  } else {
    var session = new figo.Session(req.session.figo_token);
    session.get_user(function(error, user) {
      session.get_accounts(function(error, accounts) {
        session.get_transactions(null, function(error, transactions){
          res.render('index', { accounts: accounts, user: user, transactions: transactions });
        });
      });
    });

  }
});


module.exports = router;
